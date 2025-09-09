document.addEventListener("DOMContentLoaded", () => {
  const ruleSelect = document.getElementById("ruleSelect");
  const fillButton = document.getElementById("fillButton");
  const executeButton = document.getElementById("executeButton");
  const settingsLink = document.getElementById("settingsLink");
  const notification = document.getElementById("notification");

  function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.classList.add("show");
    console.debug("Показ уведомления в popup:", message);
    setTimeout(() => {
      notification.classList.remove("show");
    }, duration);
  }

  // локальный аналог findMatchingRule
  function findMatchingRule(rules, url) {
    return rules.find(rule => url.includes(rule.url));
  }

  // Загрузка правил и заполнение селектора
  chrome.storage.sync.get(["rules"], ({ rules }) => {
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      ruleSelect.innerHTML = '<option value="">Нет доступных правил</option>';
      fillButton.disabled = true;
      executeButton.disabled = true;
      return;
    }

    ruleSelect.innerHTML = '<option value="">Выберите правило...</option>';
    rules.forEach((rule, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = rule.title || rule.url || `Правило ${index + 1}`;
      ruleSelect.appendChild(option);
    });
  });

  // Активация кнопки "Заполнить"
  ruleSelect.addEventListener("change", () => {
    fillButton.disabled = ruleSelect.value === "";
  });

  // Кнопка "Заполнить" — ручное выполнение выбранного правила
  fillButton.addEventListener("click", () => {
    const ruleIndex = parseInt(ruleSelect.value);
    if (isNaN(ruleIndex)) {
      showNotification("Выберите правило!");
      return;
    }

    chrome.storage.sync.get(["rules"], ({ rules }) => {
      const rule = rules[ruleIndex];
      if (!rule) {
        showNotification("Правило не найдено!");
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) return showNotification("Активная вкладка не найдена!");
        const tab = tabs[0];

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (rule) => {
            if (window.executeRule) {
              window.executeRule(rule);
            } else {
              console.error("executeRule не найден в контенте страницы!");
            }
          },
          args: [rule]
        }, () => showNotification("Правило выполнено!"));
      });
    });
  });

  // Кнопка "Выполнить" — автопоиск по URL
  executeButton.addEventListener("click", () => {
    chrome.storage.sync.get(["rules"], ({ rules }) => {
      if (!rules || !Array.isArray(rules)) return showNotification("Правила отсутствуют!");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) return showNotification("Активная вкладка не найдена!");
        const tab = tabs[0];

        const matchingRule = findMatchingRule(rules, tab.url);
        if (!matchingRule) return showNotification("Подходящее правило не найдено!");

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (rule) => {
            if (window.executeRule) {
              window.executeRule(rule);
            } else {
              console.error("executeRule не найден в контенте страницы!");
            }
          },
          args: [matchingRule]
        }, () => showNotification("Правило выполнено!"));
      });
    });
  });

  // Открытие настроек
  settingsLink.addEventListener("click", e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage(() => showNotification("Открыта страница настроек!"));
  });
});
