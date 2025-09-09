console.debug("content.js загружен на этапе document_start для URL:", window.location.href);

const injectedScript = document.createElement("script");
injectedScript.src = chrome.runtime.getURL("injected.js");
injectedScript.onload = () => console.debug("injected.js добавлен в страницу:", window.location.href);
document.documentElement.appendChild(injectedScript);

chrome.storage.sync.get(["rules"], ({ rules }) => {
  console.debug("Получены правила:", rules);
  if (!rules || !Array.isArray(rules)) {
    console.debug("Правила отсутствуют или некорректны");
    return;
  }

  setTimeout(() => {
    const matchingRule = findMatchingRule(rules, window.location.href, true);
    if (matchingRule) {
      console.debug("Найдено подходящее правило:", matchingRule.url);
      executeRule(matchingRule).then(() => {
        console.debug("Правило успешно выполнено:", matchingRule.url);
      }).catch(err => {
        console.error("Ошибка выполнения правила:", err);
      });
    } else {
      console.debug("Подходящее правило не найдено для URL:", window.location.href);
    }
  }, 500);
});