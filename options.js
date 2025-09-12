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

  /** ------------------- Notifications ------------------- **/
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
    if (currentGroupIndex !== -1 && currentRuleIndex !== -1) {
      saveStepsToRule(groups[currentGroupIndex].rules[currentRuleIndex]);
    }
    chrome.storage.local.set({ groups }, () =>
      console.debug("Автосохранение групп:", groups)
    );
  }, 1000);

  /** ------------------- Storage ------------------- **/
  chrome.storage.local.get(["groups"], ({ groups: storedGroups }) => {
    groups = Array.isArray(storedGroups) ? storedGroups : [];
    renderRuleList();
  });

  addGroupBtn.addEventListener("click", () => addGroup());

  saveRulesBtn.addEventListener("click", () => {
    if (currentGroupIndex !== -1 && currentRuleIndex !== -1) {
      saveStepsToRule(groups[currentGroupIndex].rules[currentRuleIndex]);
    }
    chrome.storage.local.set({ groups }, () => showNotification("Правила сохранены!"));
  });

  exportRulesBtn.addEventListener("click", () => {
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
        if (!Array.isArray(importedGroups))
          throw new Error("Импортированный файл должен содержать массив групп");
        groups = importedGroups;
        chrome.storage.local.set({ groups }, () => {
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

  /** ------------------- Groups & Rules ------------------- **/
  function addGroup(name = "Новая группа") {
    groups.push({ groupName: name, rules: [] });
    renderRuleList();
    autoSave();
  }

  function addRuleToGroup(groupIndex) {
    const newRule = { title: "Новое правило", steps: [] };
    groups[groupIndex].rules.push(newRule);
    renderRuleList();
    selectRule(groupIndex, groups[groupIndex].rules.length - 1);
    autoSave();
  }

  function selectRule(groupIndex, ruleIndex) {
    currentGroupIndex = groupIndex;
    currentRuleIndex = ruleIndex;
    renderRuleDetails(groups[groupIndex].rules[ruleIndex]);
  }

  function renderRuleList() {
    ruleList.innerHTML = "";
    groups.forEach((group, gIdx) => {
      const groupEl = document.createElement("div");
      groupEl.className = "mb-2";

      const header = document.createElement("div");
      header.className = "d-flex align-items-center justify-content-between mb-1";

      const nameInput = document.createElement("input");
      nameInput.className = "form-control form-control-sm";
      nameInput.value = group.groupName;
      nameInput.addEventListener("blur", () => {
        group.groupName = nameInput.value.trim() || "Новая группа";
        autoSave();
      });

      const addRuleBtn = document.createElement("button");
      addRuleBtn.className = "btn btn-sm btn-success ms-2";
      addRuleBtn.textContent = "➕";
      addRuleBtn.addEventListener("click", () => addRuleToGroup(gIdx));

      header.append(nameInput, addRuleBtn);
      groupEl.appendChild(header);

      group.rules.forEach((rule, rIdx) => {
        const ruleEl = document.createElement("div");
        ruleEl.className = "list-group-item list-group-item-action";
        ruleEl.textContent = rule.title || `Правило ${rIdx + 1}`;
        ruleEl.addEventListener("click", () => selectRule(gIdx, rIdx));
        groupEl.appendChild(ruleEl);
      });

      ruleList.appendChild(groupEl);
    });
  }

  function renderRuleDetails(rule) {
    ruleDetailsContainer.innerHTML = `
      <h4>${rule.title}</h4>
    `;
    loadStepsFromRule(rule);
  }

  /** ------------------- Drawflow ------------------- **/
  let editor = new Drawflow(document.getElementById("drawflow"));
  editor.reroute = true;
  editor.start();

  // Drag&Drop шагов
  document.querySelectorAll(".step-type").forEach((el) => {
    el.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("step-type", el.dataset.type);
    });
  });

  const dfContainer = document.getElementById("drawflow");
  dfContainer.addEventListener("dragover", (ev) => ev.preventDefault());
  dfContainer.addEventListener("drop", (ev) => {
    ev.preventDefault();
    if (currentGroupIndex === -1 || currentRuleIndex === -1) return;
    const type = ev.dataTransfer.getData("step-type");
    const x = ev.clientX - dfContainer.getBoundingClientRect().left;
    const y = ev.clientY - dfContainer.getBoundingClientRect().top;
    const newStep = { type, selector: "", value: "", description: "", enabled: true, x, y };
    groups[currentGroupIndex].rules[currentRuleIndex].steps.push(newStep);
    addStepNode(newStep, x, y);
    autoSave();
  });

  editor.on("nodeSelected", (id) => {
    const node = editor.getNodeFromId(id);
    node.html.addEventListener("dblclick", () => openStepEditor(id));
  });

  function addStepNode(step, x, y) {
    const html = `
      <div>
        <b>${step.type}</b><br>
        <small>${step.description || ""}</small>
      </div>
    `;
    editor.addNode(
      step.type,
      1, 1,
      x, y,
      step.type,
      step,
      html
    );
  }

  function loadStepsFromRule(rule) {
    editor.clear();
    rule.steps.forEach((step) => {
      addStepNode(step, step.x || 100, step.y || 100);
    });
    // connections
    rule.steps.forEach((step, idx) => {
      if (step.connections) {
        step.connections.forEach((targetId) => {
          try {
            editor.addConnection(idx + 1, targetId, "output_1", "input_1");
          } catch {}
        });
      }
    });
  }

  function saveStepsToRule(rule) {
    const exportData = editor.export();
    rule.steps = Object.values(exportData.drawflow.Home.data).map((node) => ({
      type: node.name,
      selector: node.data.selector,
      value: node.data.value,
      description: node.data.description,
      enabled: node.data.enabled,
      x: node.pos_x,
      y: node.pos_y,
      connections: node.outputs.output_1.connections.map((c) => c.node),
    }));
  }

  /** ------------------- Step Editor Modal ------------------- **/
  let currentNodeId = null;
  const stepSelector = document.getElementById("stepSelector");
  const stepValue = document.getElementById("stepValue");
  const stepDescription = document.getElementById("stepDescription");
  const stepEnabled = document.getElementById("stepEnabled");
  const saveStepBtn = document.getElementById("saveStepBtn");

  function openStepEditor(nodeId) {
    currentNodeId = nodeId;
    const node = editor.getNodeFromId(nodeId);

    stepSelector.value = node.data.selector || "";
    stepValue.value = node.data.value || "";
    stepDescription.value = node.data.description || "";
    stepEnabled.checked = node.data.enabled !== false;

    const modal = new bootstrap.Modal(document.getElementById("stepEditorModal"));
    modal.show();
  }

  saveStepBtn.addEventListener("click", () => {
    if (!currentNodeId) return;
    const node = editor.getNodeFromId(currentNodeId);

    node.data.selector = stepSelector.value.trim();
    node.data.value = stepValue.value.trim();
    node.data.description = stepDescription.value.trim();
    node.data.enabled = stepEnabled.checked;

    // обновляем HTML
    node.html.innerHTML = `
      <div>
        <b>${node.data.type}</b><br>
        <small>${node.data.description}</small>
      </div>
    `;

    autoSave();
    bootstrap.Modal.getInstance(document.getElementById("stepEditorModal")).hide();
  });
});
