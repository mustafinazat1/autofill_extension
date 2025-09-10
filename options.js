document.addEventListener("DOMContentLoaded", () => {
  const ruleList = document.getElementById("ruleList");
  const ruleDetailsContainer = document.getElementById("ruleDetailsContainer");
  const addGroupBtn = document.getElementById("addRuleBtn"); 
  const saveRulesBtn = document.getElementById("saveRulesBtn");
  const exportRulesBtn = document.getElementById("exportRulesBtn");
  const importRulesInput = document.getElementById("importRulesInput");
  const notification = document.getElementById("notification");

  let groups = [];
  let currentGroupIndex = -1;
  let currentRuleIndex = -1;
  let currentStepEl = null;

  function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.classList.add("show", "alert", "alert-success", "fade");
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
    chrome.storage.sync.set({ groups }, () => console.debug("Автосохранение групп:", groups));
  }, 1000);

  // Загрузка данных
  chrome.storage.sync.get(["groups"], ({ groups: storedGroups }) => {
    groups = Array.isArray(storedGroups) ? storedGroups : [];
    renderRuleList();
  });

  addGroupBtn.addEventListener("click", () => addGroup());
  saveRulesBtn.addEventListener("click", () => {
    updateCurrentRuleFromUI();
    chrome.storage.sync.set({ groups }, () => showNotification("Правила сохранены!"));
  });

  exportRulesBtn.addEventListener("click", () => {
    updateCurrentRuleFromUI();
    const data = JSON.stringify(groups, null, 2);
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
    if (!file) return showNotification("Выберите файл для импорта!");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedGroups = JSON.parse(e.target.result);
        if (!Array.isArray(importedGroups)) throw new Error("Импортированный файл должен содержать массив групп");
        importedGroups.forEach(group => {
          if (!group.groupName || !Array.isArray(group.rules)) throw new Error("Некорректная структура группы");
          group.rules.forEach(rule => {
            if (!rule.steps || !Array.isArray(rule.steps)) throw new Error("Некорректная структура правила");
            rule.steps.forEach(step => {
              if (!step.selectors || !Array.isArray(step.selectors)) throw new Error("У шага должен быть массив selectors");
            });
            if (!rule.title) rule.title = "";
          });
        });
        groups = importedGroups;
        chrome.storage.sync.set({ groups }, () => {
          renderRuleList();
          ruleDetailsContainer.innerHTML = "";
          currentGroupIndex = -1;
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

  /*** ------------------- Группы и правила ------------------- ***/

  function addGroup(name = "Новая группа") {
    groups.push({ groupName: name, rules: [] });
    renderRuleList();
    autoSave();
  }

  function addRuleToGroup(groupIndex) {
    const newRule = { title: "", url: "", autoRun: false, steps: [] };
    groups[groupIndex].rules.push(newRule);
    renderRuleList();
    selectRule(groupIndex, groups[groupIndex].rules.length - 1);
    autoSave();
  }

  function duplicateRule(groupIndex, ruleIndex) {
    const ruleCopy = JSON.parse(JSON.stringify(groups[groupIndex].rules[ruleIndex]));
    groups[groupIndex].rules.splice(ruleIndex + 1, 0, ruleCopy);
    renderRuleList();
  }

  function duplicateGroup(groupIndex) {
    const groupCopy = JSON.parse(JSON.stringify(groups[groupIndex]));
    groups.splice(groupIndex + 1, 0, groupCopy);
    renderRuleList();
  }

  function selectRule(groupIndex, ruleIndex) {
    updateCurrentRuleFromUI();
    currentGroupIndex = groupIndex;
    currentRuleIndex = ruleIndex;
    renderRuleDetails(groups[groupIndex].rules[ruleIndex]);
  }

  /*** ------------------- Рендеринг списка групп и правил ------------------- ***/

  function renderRuleList() {
    ruleList.innerHTML = "";
    groups.forEach((group, gIdx) => {
      const groupEl = document.createElement("div");
      groupEl.className = "group mb-2";

      const header = document.createElement("div");
      header.className = "group-header p-2";

      const nameInput = document.createElement("input");
      nameInput.className = "group-name-input form-control form-control-sm mb-2";
      nameInput.value = group.groupName;

      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "group-header-buttons d-flex gap-2";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "toggleGroup btn btn-secondary btn-sm";
      toggleBtn.textContent = "▼";

      const duplicateBtn = document.createElement("button");
      duplicateBtn.className = "duplicateGroup btn btn-warning btn-sm";
      duplicateBtn.textContent = "📋";

      const addRuleBtn = document.createElement("button");
      addRuleBtn.className = "addRuleToGroup btn btn-warning btn-sm";
      addRuleBtn.textContent = "➕";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "deleteGroup btn btn-warning btn-sm";
      deleteBtn.textContent = "✖";

      buttonsContainer.append(toggleBtn, duplicateBtn, addRuleBtn, deleteBtn);
      header.append(nameInput, buttonsContainer);

      nameInput.addEventListener("blur", () => {
        group.groupName = nameInput.value.trim() || "Новая группа";
        autoSave();
      });
      nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });

      const rulesContainer = document.createElement("div");
      rulesContainer.className = "rules-in-group px-2 pb-2";

      toggleBtn.addEventListener("click", () => {
        rulesContainer.classList.toggle("collapsed");
        toggleBtn.textContent = rulesContainer.classList.contains("collapsed") ? "►" : "▼";
      });

      duplicateBtn.addEventListener("click", () => duplicateGroup(gIdx));
      addRuleBtn.addEventListener("click", () => addRuleToGroup(gIdx));
      deleteBtn.addEventListener("click", () => {
        if (confirm(`Удалить группу "${group.groupName}"?`)) {
          groups.splice(gIdx, 1);
          currentGroupIndex = -1;
          currentRuleIndex = -1;
          ruleDetailsContainer.innerHTML = "";
          renderRuleList();
          autoSave();
        }
      });

      group.rules.forEach((rule, rIdx) => {
        const ruleEl = document.createElement("div");
        ruleEl.className = "rule-list-item list-group-item d-flex align-items-center";
        const ruleText = document.createElement("span");
        ruleText.className = "rule-list-item-text flex-grow-1 text-truncate";
        ruleText.textContent = `${rIdx + 1}. ${rule.title || rule.url || `Правило ${rIdx + 1}`}`;
        const duplicateBtn = document.createElement("button");
        duplicateBtn.className = "btn btn-primary btn-sm";
        duplicateBtn.textContent = "📋";
        duplicateBtn.addEventListener("click", (e) => { e.stopPropagation(); duplicateRule(gIdx, rIdx); });
        ruleEl.append(ruleText, duplicateBtn);
        ruleEl.addEventListener("click", () => selectRule(gIdx, rIdx));
        rulesContainer.appendChild(ruleEl);
      });

      groupEl.append(header, rulesContainer);
      ruleList.appendChild(groupEl);
    });
  }

  function updateRuleListItemTitle(groupIndex, ruleIndex) {
    const groupEl = ruleList.children[groupIndex];
    const ruleEl = groupEl.querySelectorAll(".rule-list-item")[ruleIndex];
    const rule = groups[groupIndex].rules[ruleIndex];
    ruleEl.querySelector(".rule-list-item-text").textContent = `${ruleIndex + 1}. ${rule.title || rule.url || `Правило ${ruleIndex + 1}`}`;
  }

  /*** ------------------- Детали правила ------------------- ***/

  function renderRuleDetails(rule) {
    ruleDetailsContainer.innerHTML = `
      <div class="rule-details card active">
        <div class="card-body">
          <div class="copy-rule d-flex gap-2 mb-2">
            <select class="target-group form-select form-select-sm"></select>
            <button class="copyRuleToGroup btn btn-primary btn-sm">Скопировать в группу</button>
          </div>
          <input class="rule-title form-control form-control-sm mb-2" placeholder="Название правила" value="${rule.title || ""}">
          <input class="rule-url form-control form-control-sm mb-2" placeholder="Часть URL" value="${rule.url}">
          <label class="checkbox-label form-check mb-2">
            <input type="checkbox" class="rule-autorun form-check-input" ${rule.autoRun ? "checked" : ""}>
            <span class="form-check-label">Автозапуск</span>
          </label>
          <div class="rule-actions d-flex gap-2 mb-2">
            <button class="deleteRule btn btn-danger btn-sm">✖</button>
            <button class="addStep btn btn-success btn-sm">Добавить шаг</button>
          </div>
          <div class="stepsContainer"></div>
        </div>
      </div>
    `;

    const detailsEl = ruleDetailsContainer.querySelector(".rule-details");
    const stepsContainer = detailsEl.querySelector(".stepsContainer");
    const addStepBtn = detailsEl.querySelector(".addStep");
    const deleteRuleBtn = detailsEl.querySelector(".deleteRule");

    const titleInput = detailsEl.querySelector(".rule-title");
    titleInput.addEventListener("input", () => {
      rule.title = titleInput.value.trim();
      updateRuleListItemTitle(currentGroupIndex, currentRuleIndex);
      autoSave();
    });

    detailsEl.querySelector(".rule-url").addEventListener("input", autoSave);
    detailsEl.querySelector(".rule-autorun").addEventListener("change", autoSave);

    // Копирование правила
    const targetSelect = detailsEl.querySelector(".target-group");
    groups.forEach((g, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = g.groupName;
      targetSelect.appendChild(opt);
    });

    detailsEl.querySelector(".copyRuleToGroup").addEventListener("click", () => {
      const targetIndex = parseInt(targetSelect.value);
      if (targetIndex === currentGroupIndex) return showNotification("Выберите другую группу!");
      const ruleCopy = JSON.parse(JSON.stringify(groups[currentGroupIndex].rules[currentRuleIndex]));
      groups[targetIndex].rules.push(ruleCopy);
      renderRuleList();
      showNotification(`Правило скопировано в группу "${groups[targetIndex].groupName}"`);
      autoSave();
    });

    // Рендер шагов
    rule.steps.forEach((step, idx) => addStepToUI(stepsContainer, step, idx + 1));

    addStepBtn.addEventListener("click", () => {
      const newStep = { type: "fill", selectors: [{ type: "xpath", value: "" }], value: "", description: "", enabled: true };
      rule.steps.push(newStep);
      addStepToUI(stepsContainer, newStep, rule.steps.length);
      autoSave();
    });

    deleteRuleBtn.addEventListener("click", () => {
      if (currentGroupIndex === -1 || currentRuleIndex === -1) return;
      groups[currentGroupIndex].rules.splice(currentRuleIndex, 1);
      currentRuleIndex = -1;
      ruleDetailsContainer.innerHTML = "";
      renderRuleList();
      autoSave();
    });
  }

  /*** ------------------- Шаги и селекторы ------------------- ***/

  function addStepToUI(container, step, number) {
    const stepEl = document.createElement("div");
    stepEl.className = "step-item card mb-2";
    stepEl.dataset.index = number - 1;
    stepEl.innerHTML = `
      <div class="card-body">
        <div class="step-header d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span class="step-number">Шаг ${number}</span>
          <label class="checkbox-label form-check">
            <input type="checkbox" class="step-enabled form-check-input" ${step.enabled !== false ? "checked" : ""}>
            <span class="form-check-label">Включён</span>
          </label>
          <select class="step-type form-select form-select-sm w-auto">
            <option value="fill" ${step.type === "fill" ? "selected" : ""}>Заполнить</option>
            <option value="click" ${step.type === "click" ? "selected" : ""}>Клик</option>
            <option value="wait" ${step.type === "wait" ? "selected" : ""}>Ожидание</option>
            <option value="blockAlert" ${step.type === "blockAlert" ? "selected" : ""}>Блокировать alert</option>
            <option value="setConfirm" ${step.type === "setConfirm" ? "selected" : ""}>Confirm (0/1)</option>
            <option value="setPrompt" ${step.type === "setPrompt" ? "selected" : ""}>Prompt</option>
          </select>
          <div class="step-controls d-flex gap-2">
            <button class="moveUp btn btn-primary btn-sm">↑</button>
            <button class="moveDown btn btn-primary btn-sm">↓</button>
            <button class="duplicateStep btn btn-warning btn-sm">📋</button>
            <button class="deleteStep btn btn-danger btn-sm">✖</button>
          </div>
        </div>
        <input class="step-description form-control form-control-sm mb-2" placeholder="Описание шага" value="${step.description || ""}">
        ${step.type !== "blockAlert" ? `<input class="step-value form-control form-control-sm mb-2" placeholder="Значение" value="${step.value || ""}">` : ""}
        <div class="selectors-container"></div>
      </div>
    `;
    container.appendChild(stepEl);

    // Подсветка активного шага
    stepEl.addEventListener("click", () => {
      if (currentStepEl) currentStepEl.classList.remove("active-step");
      stepEl.classList.add("active-step");
      currentStepEl = stepEl;
    });

    renderSelectors(stepEl.querySelector(".selectors-container"), step.selectors);

    stepEl.querySelector(".step-enabled")?.addEventListener("change", autoSave);
    stepEl.querySelector(".step-value")?.addEventListener("input", autoSave);
    stepEl.querySelector(".step-description")?.addEventListener("input", autoSave);
    stepEl.querySelector(".step-type")?.addEventListener("change", autoSave);

    stepEl.querySelector(".deleteStep").addEventListener("click", () => {
      container.removeChild(stepEl);
      groups[currentGroupIndex].rules[currentRuleIndex].steps.splice(stepEl.dataset.index, 1);
      updateStepNumbers();
      autoSave();
    });

    stepEl.querySelector(".duplicateStep").addEventListener("click", () => {
      const dupStep = JSON.parse(JSON.stringify(step));
      const idx = parseInt(stepEl.dataset.index);
      groups[currentGroupIndex].rules[currentRuleIndex].steps.splice(idx + 1, 0, dupStep);
      renderRuleDetails(groups[currentGroupIndex].rules[currentRuleIndex]);
      autoSave();
    });

    stepEl.querySelector(".moveUp").addEventListener("click", () => {
      const idx = parseInt(stepEl.dataset.index);
      const steps = groups[currentGroupIndex].rules[currentRuleIndex].steps;
      if (idx > 0) [steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]];
      renderRuleDetails(groups[currentGroupIndex].rules[currentRuleIndex]);
      autoSave();
    });

    stepEl.querySelector(".moveDown").addEventListener("click", () => {
      const idx = parseInt(stepEl.dataset.index);
      const steps = groups[currentGroupIndex].rules[currentRuleIndex].steps;
      if (idx < steps.length - 1) [steps[idx + 1], steps[idx]] = [steps[idx], steps[idx + 1]];
      renderRuleDetails(groups[currentGroupIndex].rules[currentRuleIndex]);
      autoSave();
    });

    updateStepNumbers();
  }

  function renderSelectors(container, selectors) {
    container.innerHTML = "";

    function updateSelectorsFromUI() {
      const rows = container.querySelectorAll(".selector-row");
      rows.forEach((row, idx) => {
        selectors[idx] = {
          type: row.querySelector(".selector-type").value,
          value: row.querySelector(".selector-value").value
        };
      });
    }

    selectors.forEach((sel, idx) => {
      const row = document.createElement("div");
      row.className = "selector-row d-flex align-items-start gap-2 mb-2";
      row.innerHTML = `
        <select class="selector-type form-select form-select-sm">
          <option value="xpath" ${sel.type === "xpath" ? "selected" : ""}>XPath</option>
          <option value="css" ${sel.type === "css" ? "selected" : ""}>CSS</option>
        </select>
        <textarea class="selector-value form-control form-control-sm" rows="2">${sel.value}</textarea>
        <button class="deleteSelector btn btn-danger btn-sm">✖</button>
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
    addBtn.className = "btn btn-success btn-sm";
    addBtn.textContent = "Добавить селектор";
    addBtn.addEventListener("click", () => {
      updateSelectorsFromUI();
      selectors.push({ type: "xpath", value: "" });
      renderSelectors(container, selectors);
      autoSave();
    });
    container.appendChild(addBtn);
  }

  function updateStepNumbers() {
    const stepsContainer = document.querySelector(".stepsContainer");
    if (!stepsContainer) return;
    const stepItems = Array.from(stepsContainer.children).filter(el => el.classList.contains("step-item"));
    stepItems.forEach((stepEl, index) => {
      stepEl.dataset.index = index;
      const stepNumberEl = stepEl.querySelector(".step-number");
      if (stepNumberEl) stepNumberEl.textContent = `Шаг ${index + 1}`;
    });
  }

  function updateCurrentRuleFromUI() {
    if (currentGroupIndex === -1 || currentRuleIndex === -1) return;
    const detailsEl = ruleDetailsContainer.querySelector(".rule-details");
    if (!detailsEl) return;

    const rule = groups[currentGroupIndex].rules[currentRuleIndex];
    rule.title = detailsEl.querySelector(".rule-title").value.trim();
    rule.url = detailsEl.querySelector(".rule-url").value.trim();
    rule.autoRun = detailsEl.querySelector(".rule-autorun").checked;

    const stepsContainer = detailsEl.querySelector(".stepsContainer");
    const stepEls = Array.from(stepsContainer.children).filter(el => el.classList.contains("step-item"));
    rule.steps = stepEls.map(stepEl => {
      const selRows = stepEl.querySelectorAll(".selector-row");
      const selectors = Array.from(selRows).map(row => ({
        type: row.querySelector(".selector-type").value,
        value: row.querySelector(".selector-value").value
      }));
      return {
        type: stepEl.querySelector(".step-type").value,
        value: stepEl.querySelector(".step-value")?.value || "",
        description: stepEl.querySelector(".step-description")?.value || "",
        enabled: stepEl.querySelector(".step-enabled").checked,
        selectors
      };
    });
  }
});