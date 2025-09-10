document.addEventListener("DOMContentLoaded", () => {
  const ruleSelect = document.getElementById("ruleSelect");
  const fillButton = document.getElementById("fillButton");
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

  // Загрузка групп и заполнение селектора
  chrome.storage.sync.get(["groups"], ({ groups }) => {
    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      ruleSelect.innerHTML = '<option value="">Нет доступных правил</option>';
      fillButton.disabled = true;
      return;
    }

    ruleSelect.innerHTML = '<option value="">Выберите правило...</option>';
    groups.forEach((group, groupIndex) => {
      if (!group.rules || !Array.isArray(group.rules)) {
        console.debug("Группа не содержит корректных правил:", group.groupName);
        return;
      }
      group.rules.forEach((rule, ruleIndex) => {
        const option = document.createElement("option");
        // Store both groupIndex and ruleIndex in the value, e.g., "0-1" for group 0, rule 1
        option.value = `${groupIndex}-${ruleIndex}`;
        option.textContent = `${group.groupName}: ${rule.title || rule.url || `Правило ${ruleIndex + 1}`}`;
        ruleSelect.appendChild(option);
      });
    });

    // Disable button if no rules were added
    if (ruleSelect.options.length === 1) {
      ruleSelect.innerHTML = '<option value="">Нет доступных правил</option>';
      fillButton.disabled = true;
    }
  });

  // Активация кнопки "Заполнить"
  ruleSelect.addEventListener("change", () => {
    fillButton.disabled = ruleSelect.value === "";
  });

  // Кнопка "Заполнить" — ручное выполнение выбранного правила
  fillButton.addEventListener("click", () => {
    const value = ruleSelect.value;
    if (!value) {
      showNotification("Выберите правило!");
      return;
    }

    // Parse groupIndex and ruleIndex from the value (e.g., "0-1")
    const [groupIndex, ruleIndex] = value.split("-").map(Number);
    if (isNaN(groupIndex) || isNaN(ruleIndex)) {
      showNotification("Некорректное правило выбрано!");
      return;
    }

    chrome.storage.sync.get(["groups"], ({ groups }) => {
      const group = groups[groupIndex];
      if (!group || !group.rules) {
        showNotification("Группа не найдена!");
        return;
      }
      const rule = group.rules[ruleIndex];
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

  // Открытие настроек
  settingsLink.addEventListener("click", e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage(() => showNotification("Открыта страница настроек!"));
  });
});