document.addEventListener("DOMContentLoaded", () => {
  const ruleList = document.getElementById("ruleList");
  const ruleDetailsContainer = document.getElementById("ruleDetailsContainer");
  const addRuleBtn = document.getElementById("addRuleBtn");
  const saveRulesBtn = document.getElementById("saveRulesBtn");
  const exportRulesBtn = document.getElementById("exportRulesBtn");
  const importRulesInput = document.getElementById("importRulesInput");
  const notification = document.getElementById("notification");

  let rules = [];
  let currentRuleIndex = -1;

  function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.classList.add("show");
    setTimeout(() => notification.classList.remove("show"), duration);
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const autoSave = debounce(() => {
    updateCurrentRuleFromUI();
    chrome.storage.sync.set({ rules }, () => {
      console.debug("Автосохранение правил:", rules);
    });
  }, 1000);

  chrome.storage.sync.get(["rules"], ({ rules: storedRules }) => {
    if (!storedRules || !Array.isArray(storedRules)) {
      rules = [];
    } else {
      // конвертация старых правил (с одним selector)
      rules = storedRules.map(rule => {
        if (!rule.title) rule.title = "";
        rule.steps = rule.steps.map(step => {
          if (!step.selectors) {
            step.selectors = [{
              type: step.selectorType || "xpath",
              value: step.selector || ""
            }];
          }
          delete step.selector;
          delete step.selectorType;
          return step;
        });
        return rule;
      });
    }
    renderRuleList();
  });

  addRuleBtn.addEventListener("click", () => {
    const newRule = { title: "", url: "", autoRun: false, steps: [] };
    rules.push(newRule);
    renderRuleList();
    selectRule(rules.length - 1);
    autoSave();
  });

  saveRulesBtn.addEventListener("click", () => {
    updateCurrentRuleFromUI();
    chrome.storage.sync.set({ rules }, () => {
      showNotification("Правила сохранены!");
    });
  });

  exportRulesBtn.addEventListener("click", () => {
    updateCurrentRuleFromUI();
    const data = JSON.stringify(rules, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autofill_rules.json";
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Правила экспортированы!");
  });

  importRulesInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
      showNotification("Выберите файл для импорта!");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedRules = JSON.parse(e.target.result);
        if (!Array.isArray(importedRules)) {
          throw new Error("Импортированный файл должен содержать массив правил");
        }
        importedRules.forEach(rule => {
          if (!rule.url || !Array.isArray(rule.steps)) {
            throw new Error("Некорректная структура правила");
          }
          rule.steps.forEach(step => {
            if (!step.selectors || !Array.isArray(step.selectors)) {
              throw new Error("У шага должен быть массив selectors");
            }
          });
          if (!rule.title) rule.title = "";
        });
        rules = importedRules;
        chrome.storage.sync.set({ rules }, () => {
          renderRuleList();
          ruleDetailsContainer.innerHTML = "";
          currentRuleIndex = -1;
          showNotification("Правила успешно импортированы!");
        });
      } catch (err) {
        showNotification("Ошибка при импорте: " + err.message);
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  });

  function renderRuleList() {
    ruleList.innerHTML = "";
    rules.forEach((rule, index) => {
      const item = document.createElement("div");
      item.className = "rule-list-item";
      item.textContent = rule.title || rule.url || `Правило ${index + 1}`;
      item.dataset.index = index;
      item.addEventListener("click", () => selectRule(index));
      ruleList.appendChild(item);
    });
    if (currentRuleIndex !== -1 && ruleList.children[currentRuleIndex]) {
      selectRule(currentRuleIndex);
    }
  }

  function selectRule(index) {
    updateCurrentRuleFromUI();
    currentRuleIndex = index;
    Array.from(ruleList.children).forEach(item => item.classList.remove("active"));
    if (ruleList.children[index]) {
      ruleList.children[index].classList.add("active");
    }
    renderRuleDetails(rules[index]);
  }

  function renderRuleDetails(rule) {
    ruleDetailsContainer.innerHTML = `
      <div class="rule-details active">
        <input class="rule-title" placeholder="Название правила" value="${rule.title || ""}">
        <input class="rule-url" placeholder="Часть URL" value="${rule.url}">
        <label class="checkbox-label">
          <input type="checkbox" class="rule-autorun" ${rule.autoRun ? "checked" : ""}>
          <span>Автозапуск</span>
        </label>
        <div class="rule-actions">
          <button class="deleteRule">Удалить правило</button>
          <button class="addStep">Добавить шаг</button>
        </div>
        <div class="stepsContainer steps-container"></div>
      </div>
    `;

    const detailsEl = ruleDetailsContainer.querySelector(".rule-details");
    const stepsContainer = detailsEl.querySelector(".stepsContainer");
    const addStepBtn = detailsEl.querySelector(".addStep");
    const deleteRuleBtn = detailsEl.querySelector(".deleteRule");

    detailsEl.querySelector(".rule-title").addEventListener("input", autoSave);
    detailsEl.querySelector(".rule-url").addEventListener("input", autoSave);
    detailsEl.querySelector(".rule-autorun").addEventListener("change", autoSave);

    rule.steps.forEach((step, index) => {
      addStepToUI(stepsContainer, step, index + 1);
    });

    addStepBtn.addEventListener("click", () => {
      const newStep = {
        type: "fill",
        selectors: [{ type: "xpath", value: "" }],
        value: "",
        description: "",
        enabled: true
      };
      rule.steps.push(newStep);
      addStepToUI(stepsContainer, newStep, rule.steps.length);
      autoSave();
    });

    deleteRuleBtn.addEventListener("click", () => {
      rules.splice(currentRuleIndex, 1);
      currentRuleIndex = -1;
      renderRuleList();
      ruleDetailsContainer.innerHTML = "";
      autoSave();
    });
  }

  function updateCurrentRuleFromUI() {
    if (currentRuleIndex === -1) return;
    const detailsEl = ruleDetailsContainer.querySelector(".rule-details");
    if (!detailsEl) return;

    rules[currentRuleIndex].title = detailsEl.querySelector(".rule-title").value.trim();
    rules[currentRuleIndex].url = detailsEl.querySelector(".rule-url").value.trim();
    rules[currentRuleIndex].autoRun = detailsEl.querySelector(".rule-autorun").checked;

    rules[currentRuleIndex].steps = [];
    detailsEl.querySelectorAll(".step-item").forEach((stepEl, stepIndex) => {
      const type = stepEl.querySelector(".step-type").value;
      const value = stepEl.querySelector(".step-value")?.value || "";
      const description = stepEl.querySelector(".step-description")?.value || "";
      const enabled = stepEl.querySelector(".step-enabled").checked;

      const selectors = [];
      stepEl.querySelectorAll(".selector-row").forEach(row => {
        const selType = row.querySelector(".selector-type").value;
        const selValue = row.querySelector(".selector-value").value.trim();
        if (selValue) selectors.push({ type: selType, value: selValue });
      });

      rules[currentRuleIndex].steps.push({
        type,
        selectors,
        value,
        description,
        enabled
      });
    });

    ruleList.children[currentRuleIndex].textContent =
      rules[currentRuleIndex].title || rules[currentRuleIndex].url || `Правило ${currentRuleIndex + 1}`;
  }

  function addStepToUI(container, step, number) {
    const stepEl = document.createElement("div");
    stepEl.className = "step-item";
    stepEl.dataset.index = number - 1;
    stepEl.innerHTML = `
      <div class="step-header">
        <span class="step-number">${number}</span>
        <label class="checkbox-label">
          <input type="checkbox" class="step-enabled" ${step.enabled !== false ? "checked" : ""}>
          <span>Включён</span>
        </label>
        <select class="step-type">
          <option value="fill" ${step.type === "fill" ? "selected" : ""}>Заполнить</option>
          <option value="click" ${step.type === "click" ? "selected" : ""}>Клик</option>
          <option value="wait" ${step.type === "wait" ? "selected" : ""}>Ожидание</option>
          <option value="blockAlert" ${step.type === "blockAlert" ? "selected" : ""}>Блокировать alert</option>
          <option value="setConfirm" ${step.type === "setConfirm" ? "selected" : ""}>Confirm (0/1)</option>
          <option value="setPrompt" ${step.type === "setPrompt" ? "selected" : ""}>Prompt</option>
        </select>
<div class="step-controls">
  <button class="moveUp">↑</button>
  <button class="moveDown">↓</button>
  <button class="duplicateStep">Дублировать</button>
  <button class="deleteStep">Удалить шаг</button>
</div>
      </div>
      <div>
        <input class="step-description" placeholder="Описание шага" value="${step.description || ""}">
      </div>
      <div class="selectors-container"></div>
      ${step.type !== "blockAlert" ? `
      <div>
        <input class="step-value" placeholder="Значение" value="${step.value || ""}">
      </div>` : ""}
    `;
    container.appendChild(stepEl);

    // селекторы
    renderSelectors(stepEl.querySelector(".selectors-container"), step.selectors);

    stepEl.querySelector(".step-enabled")?.addEventListener("change", autoSave);
    stepEl.querySelector(".step-value")?.addEventListener("input", autoSave);
    stepEl.querySelector(".step-description")?.addEventListener("input", autoSave);
    stepEl.querySelector(".step-type").addEventListener("change", autoSave);

    stepEl.querySelector(".deleteStep").addEventListener("click", () => {
      container.removeChild(stepEl);
      rules[currentRuleIndex].steps.splice(stepEl.dataset.index, 1);
      updateStepNumbers();
      autoSave();
    });

stepEl.querySelector(".duplicateStep").addEventListener("click", () => {
  const dupStep = JSON.parse(JSON.stringify(step));
  const idx = parseInt(stepEl.dataset.index);
  rules[currentRuleIndex].steps.splice(idx + 1, 0, dupStep);
  renderRuleDetails(rules[currentRuleIndex]);
  autoSave();
});



    stepEl.querySelector(".moveUp").addEventListener("click", () => {
      const idx = parseInt(stepEl.dataset.index);
      if (idx > 0) {
        [rules[currentRuleIndex].steps[idx - 1], rules[currentRuleIndex].steps[idx]] =
          [rules[currentRuleIndex].steps[idx], rules[currentRuleIndex].steps[idx - 1]];
        renderRuleDetails(rules[currentRuleIndex]);
        autoSave();
      }
    });

    stepEl.querySelector(".moveDown").addEventListener("click", () => {
      const idx = parseInt(stepEl.dataset.index);
      if (idx < rules[currentRuleIndex].steps.length - 1) {
        [rules[currentRuleIndex].steps[idx + 1], rules[currentRuleIndex].steps[idx]] =
          [rules[currentRuleIndex].steps[idx], rules[currentRuleIndex].steps[idx + 1]];
        renderRuleDetails(rules[currentRuleIndex]);
        autoSave();
      }
    });

    updateStepNumbers();
  }

  

function renderSelectors(container, selectors) {
  container.innerHTML = "";

  function updateSelectorsFromUI() {
    const rows = container.querySelectorAll(".selector-row");
    rows.forEach((row, idx) => {
      const selType = row.querySelector(".selector-type").value;
      const selValue = row.querySelector(".selector-value").value;
      selectors[idx] = { type: selType, value: selValue };
    });
  }

  selectors.forEach((sel, idx) => {
    const row = document.createElement("div");
    row.className = "selector-row";
    row.innerHTML = `
      <select class="selector-type">
        <option value="xpath" ${sel.type === "xpath" ? "selected" : ""}>XPath</option>
        <option value="css" ${sel.type === "css" ? "selected" : ""}>CSS</option>
      </select>
      <textarea class="selector-value">${sel.value}</textarea>
      <button class="deleteSelector">✖</button>
    `;

    row.querySelector(".selector-type").addEventListener("change", autoSave);
    row.querySelector(".selector-value").addEventListener("input", autoSave);
    row.querySelector(".deleteSelector").addEventListener("click", () => {
      updateSelectorsFromUI();
      selectors.splice(idx, 1);
      renderSelectors(container, selectors);
      autoSave();
    });

    container.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = "Добавить селектор";
  addBtn.addEventListener("click", () => {
    updateSelectorsFromUI(); // <-- сохраняем текущее состояние перед добавлением
    selectors.push({ type: "xpath", value: "" });
    renderSelectors(container, selectors);
    autoSave();
  });
  container.appendChild(addBtn);
}

  function updateStepNumbers() {
    const stepsContainer = document.querySelector(".stepsContainer");
    if (stepsContainer) {
      const stepItems = Array.from(stepsContainer.children).filter(el => el.classList.contains("step-item"));
      stepItems.forEach((stepEl, index) => {
        stepEl.dataset.index = index;
        const stepNumberEl = stepEl.querySelector(".step-number");
        if (stepNumberEl) stepNumberEl.textContent = index + 1;
      });
    }
  }
});
