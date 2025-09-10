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
  setTimeout(async () => {
    const matchedRules = findMatchingRules(rules, window.location.href, true);

    if (!matchedRules.length) {
      console.debug("Подходящее правило не найдено для URL:", window.location.href);
      return;
    }

    let ruleToRun;

    if (matchedRules.length === 1) {
      ruleToRun = matchedRules[0];
    } else {
      // Открываем попап для выбора правила
      ruleToRun = await promptUserToSelectRule(matchedRules, window.location.href);
    }

    if (ruleToRun) {
      executeRule(ruleToRun).then(() => {
        console.debug("Правило успешно выполнено:", ruleToRun.url);
      }).catch(err => {
        console.error("Ошибка выполнения правила:", err);
      });
    }
  }, 500);
});

function promptUserToSelectRule(rules, url) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.6)";
    overlay.style.zIndex = 9999;
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.fontFamily = "Arial, sans-serif";

    const box = document.createElement("div");
    box.style.background = "#f9f9f9";
    box.style.padding = "25px";
    box.style.borderRadius = "12px";
    box.style.minWidth = "350px";
    box.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
    box.style.textAlign = "center";
    box.innerHTML = `<h3 style="margin-bottom: 15px;">Выберите правило для URL:</h3>
                     <p style="margin-bottom: 20px; font-size: 0.9em; color: #555;">${url}</p>`;

    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexDirection = "column";
    buttonsContainer.style.gap = "10px";

    rules.forEach((rule, index) => {
      const btn = document.createElement("button");
      btn.textContent = rule.title || rule.url || `Правило ${index + 1}`;
      btn.style.padding = "10px 15px";
      btn.style.border = "none";
      btn.style.borderRadius = "6px";
      btn.style.backgroundColor = "#007bff";
      btn.style.color = "#fff";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "1em";
      btn.addEventListener("mouseenter", () => btn.style.backgroundColor = "#0056b3");
      btn.addEventListener("mouseleave", () => btn.style.backgroundColor = "#007bff");
      btn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(rule); // выбранное правило
      });
      buttonsContainer.appendChild(btn);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Отмена";
    cancelBtn.style.marginTop = "15px";
    cancelBtn.style.padding = "8px 12px";
    cancelBtn.style.border = "none";
    cancelBtn.style.borderRadius = "6px";
    cancelBtn.style.backgroundColor = "#ccc";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.fontSize = "0.9em";
    cancelBtn.addEventListener("mouseenter", () => cancelBtn.style.backgroundColor = "#aaa");
    cancelBtn.addEventListener("mouseleave", () => cancelBtn.style.backgroundColor = "#ccc");
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(null); // ничего не выполнять
    });

    box.appendChild(buttonsContainer);
    box.appendChild(cancelBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}