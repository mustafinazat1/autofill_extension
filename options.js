document.addEventListener("DOMContentLoaded", () => {
  const ruleList = document.getElementById("ruleList");
  const ruleDetailsContainer = document.getElementById("ruleDetailsContainer");
  const addGroupBtn = document.getElementById("addRuleBtn");
  const saveRulesBtn = document.getElementById("saveRulesBtn");
  const exportRulesBtn = document.getElementById("exportRulesBtn");
  const importRulesInput = document.getElementById("importRulesInput");
  const notification = document.getElementById("notification");
  const dfContainer = document.getElementById("drawflow");

  let groups = [];
  let currentGroupIndex = -1;
  let currentRuleIndex = -1;

  // Drawflow editor
  const editor = new Drawflow(dfContainer);
  editor.reroute = true;
  editor.start();

  // map nodeId -> dblclick handler so we can avoid duplicate listeners
  const nodeListeners = {};

  /*** Helpers ***/
  function showNotification(msg, duration = 3000) {
    notification.textContent = msg;
    notification.classList.add("show", "alert", "alert-success", "fade");
    setTimeout(() => notification.classList.remove("show"), duration);
  }

  function debounce(fn, wait) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
  }

  const autoSave = debounce(() => {
    if (currentGroupIndex !== -1 && currentRuleIndex !== -1) {
      const rule = groups[currentGroupIndex].rules[currentRuleIndex];
      saveDrawflowToRule(rule);
    }
    chrome.storage.local.set({ groups }, () => console.debug("Автосохранение", groups));
  }, 800);

  /*** Storage load ***/
  chrome.storage.local.get(["groups"], ({ groups: stored }) => {
    groups = Array.isArray(stored) ? stored : [];
    renderRuleList();
  });

  addGroupBtn.addEventListener("click", () => {
    groups.push({ groupName: "Новая группа", rules: [] });
    renderRuleList();
    autoSave();
  });

  saveRulesBtn.addEventListener("click", () => {
    if (currentGroupIndex !== -1 && currentRuleIndex !== -1) {
      saveDrawflowToRule(groups[currentGroupIndex].rules[currentRuleIndex]);
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
    showNotification("Экспорт готов");
  });

  importRulesInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return showNotification("Выберите файл!");
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error("Ожидается массив групп");
        groups = imported;
        chrome.storage.local.set({ groups }, () => {
          renderRuleList();
          ruleDetailsContainer.innerHTML = "";
          editor.clear();
          currentGroupIndex = -1;
          currentRuleIndex = -1;
          showNotification("Импорт выполнен");
        });
      } catch (err) {
        showNotification("Ошибка импорта: " + err.message);
      }
      importRulesInput.value = "";
    };
    r.readAsText(file);
  });

  /*** Render list ***/
  function renderRuleList() {
    ruleList.innerHTML = "";
    groups.forEach((g, gi) => {
      const groupEl = document.createElement("div");
      groupEl.className = "group mb-2";

      const header = document.createElement("div");
      header.className = "group-header p-2 d-flex flex-column";

      const nameInput = document.createElement("input");
      nameInput.className = "group-name-input form-control form-control-sm mb-1";
      nameInput.value = g.groupName || "Новая группа";

      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "group-header-buttons d-flex gap-2";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "toggleGroup btn btn-secondary btn-sm";
      toggleBtn.textContent = "▼";

      const duplicateGroupBtn = document.createElement("button");
      duplicateGroupBtn.className = "duplicateGroup btn btn-warning btn-sm";
      duplicateGroupBtn.textContent = "📋";

      const addRuleBtn = document.createElement("button");
      addRuleBtn.className = "addRuleToGroup btn btn-warning btn-sm";
      addRuleBtn.textContent = "➕";

      const deleteGroupBtn = document.createElement("button");
      deleteGroupBtn.className = "deleteGroup btn btn-warning btn-sm";
      deleteGroupBtn.textContent = "✖";

      buttonsContainer.append(toggleBtn, duplicateGroupBtn, addRuleBtn, deleteGroupBtn);
      header.append(nameInput, buttonsContainer);

      nameInput.addEventListener("blur", () => {
        g.groupName = nameInput.value.trim() || "Новая группа";
        autoSave();
      });
      nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });

      duplicateGroupBtn.addEventListener("click", () => duplicateGroup(gi));
      addRuleBtn.addEventListener("click", () => addRuleToGroup(gi));
      deleteGroupBtn.addEventListener("click", () => {
        if (confirm(`Удалить группу "${g.groupName}"?`)) {
          groups.splice(gi, 1);
          currentGroupIndex = -1;
          currentRuleIndex = -1;
          ruleDetailsContainer.innerHTML = "";
          editor.clear();
          renderRuleList();
          autoSave();
        }
      });

      const rulesContainer = document.createElement("div");
      rulesContainer.className = "rules-in-group px-2 pb-2";

      toggleBtn.addEventListener("click", () => {
        rulesContainer.classList.toggle("collapsed");
        toggleBtn.textContent = rulesContainer.classList.contains("collapsed") ? "►" : "▼";
      });

      g.rules.forEach((rule, ri) => {
        const ruleEl = document.createElement("div");
        ruleEl.className = "rule-list-item list-group-item d-flex align-items-center";
        const ruleText = document.createElement("span");
        ruleText.className = "rule-list-item-text flex-grow-1 text-truncate";
        ruleText.textContent = `${ri + 1}. ${rule.title || rule.url || `Правило ${ri + 1}`}`;
        const duplicateRuleBtn = document.createElement("button");
        duplicateRuleBtn.className = "btn btn-primary btn-sm";
        duplicateRuleBtn.textContent = "📋";
        duplicateRuleBtn.addEventListener("click", (e) => { e.stopPropagation(); duplicateRule(gi, ri); });
        ruleEl.append(ruleText, duplicateRuleBtn);
        ruleEl.addEventListener("click", () => selectRule(gi, ri));
        rulesContainer.appendChild(ruleEl);
      });

      groupEl.append(header, rulesContainer);
      ruleList.appendChild(groupEl);
    });
  }

  function addRuleToGroup(groupIndex) {
    const r = { title: "Новое правило", url: "", autoRun: false, drawflow: { Home: { data: {} } }, steps: [] };
    groups[groupIndex].rules.push(r);
    currentGroupIndex = groupIndex;
    currentRuleIndex = groups[groupIndex].rules.length - 1;
    const rule = groups[currentGroupIndex].rules[currentRuleIndex];
    
    // Clear the canvas before adding the Start node
    editor.clear();
    // Add mandatory Start step
    const startNodeId = editor.addNode(
      "start",
      0,
      1,
      100,
      100,
      "start",
      { type: "start", selectors: [], value: "", description: "Начало", enabled: true, isFirst: true },
      `<div class="start-node"><label class="node-toggle"><input type="checkbox" class="node-enabled" checked> <b>start</b></label><span class="node-desc">Начало</span></div>`
    );
    // Save the Start step to rule.drawflow immediately
    saveDrawflowToRule(rule);
    // Render the rule details after the Start node is added
    renderRuleList();
    renderRuleDetails(rule);
  }

  function duplicateGroup(groupIndex) {
    const groupCopy = JSON.parse(JSON.stringify(groups[groupIndex]));
    groups.splice(groupIndex + 1, 0, groupCopy);
    renderRuleList();
    autoSave();
  }

  function duplicateRule(groupIndex, ruleIndex) {
    const ruleCopy = JSON.parse(JSON.stringify(groups[groupIndex].rules[ruleIndex]));
    groups[groupIndex].rules.splice(ruleIndex + 1, 0, ruleCopy);
    renderRuleList();
    autoSave();
  }

  function selectRule(groupIndex, ruleIndex) {
    if (currentGroupIndex !== -1 && currentRuleIndex !== -1) {
      saveDrawflowToRule(groups[currentGroupIndex].rules[currentRuleIndex]);
    }
    currentGroupIndex = groupIndex;
    currentRuleIndex = ruleIndex;
    renderRuleDetails(groups[groupIndex].rules[ruleIndex]);
  }

  /*** Rule details (title/url/actions) ***/
  function renderRuleDetails(rule) {
    // Check if rule has a Start step
    const hasStartStep = rule.drawflow?.Home?.data
      ? Object.values(rule.drawflow.Home.data).some(n => n.name === "start" && n.data?.isFirst)
      : false;

    ruleDetailsContainer.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="copy-rule d-flex gap-2 mb-2">
            <select class="target-group form-select form-select-sm"></select>
            <button class="copyRuleToGroup btn btn-primary btn-sm">Скопировать в группу</button>
          </div>
          <div class="mb-2 d-flex gap-2">
            <input class="form-control form-control-sm rule-title" placeholder="Название" value="${escapeHtml(rule.title || "")}">
            <input class="form-control form-control-sm rule-url" placeholder="Часть URL" value="${escapeHtml(rule.url || "")}">
            <label class="form-check form-check-inline mb-0">
              <input type="checkbox" class="form-check-input rule-autorun" ${rule.autoRun ? "checked" : ""}>
              <span class="form-check-label">Автозапуск</span>
            </label>
          </div>
          <div class="mb-2">
            <button class="btn btn-sm btn-danger delete-rule">Удалить правило</button>
          </div>
          <hr>
          <h5>Типы шагов</h5>
          <div id="stepPalette" class="mt-2 d-flex flex-wrap gap-2">
            <div class="step-type btn btn-outline-primary btn-sm ${hasStartStep ? 'disabled' : ''}" ${hasStartStep ? '' : 'draggable="true"'} data-type="start">🚀 Старт</div>
            <div class="step-type btn btn-outline-primary btn-sm" draggable="true" data-type="fill">✏️ Заполнить</div>
            <div class="step-type btn btn-outline-primary btn-sm" draggable="true" data-type="click">🖱️ Клик</div>
            <div class="step-type btn btn-outline-primary btn-sm" draggable="true" data-type="wait">⏱️ Ожидание</div>
            <div class="step-type btn btn-outline-primary btn-sm" draggable="true" data-type="blockAlert">🚫 Блок alert</div>
            <div class="step-type btn btn-outline-primary btn-sm" draggable="true" data-type="setConfirm">✅ Confirm (0/1)</div>
            <div class="step-type btn btn-outline-primary btn-sm" draggable="true" data-type="setPrompt">📝 Prompt</div>
          </div>
        </div>
      </div>
    `;
    const details = ruleDetailsContainer.querySelector(".card");
    const titleInput = details.querySelector(".rule-title");
    const urlInput = details.querySelector(".rule-url");
    const autorun = details.querySelector(".rule-autorun");

    titleInput.addEventListener("input", () => { rule.title = titleInput.value.trim(); renderRuleList(); autoSave(); });
    urlInput.addEventListener("input", () => { rule.url = urlInput.value.trim(); autoSave(); });
    autorun.addEventListener("change", () => { rule.autoRun = autorun.checked; autoSave(); });

    // Копирование правила в другую группу
    const targetSelect = details.querySelector(".target-group");
    groups.forEach((g, idx) => {
      if (idx === currentGroupIndex) return;
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = g.groupName;
      targetSelect.appendChild(opt);
    });
    details.querySelector(".copyRuleToGroup").addEventListener("click", () => {
      const targetIndex = parseInt(targetSelect.value);
      if (isNaN(targetIndex)) return showNotification("Выберите группу!");
      const ruleCopy = JSON.parse(JSON.stringify(rule));
      groups[targetIndex].rules.push(ruleCopy);
      renderRuleList();
      showNotification(`Правило скопировано в "${groups[targetIndex].groupName}"`);
      autoSave();
    });

    details.querySelector(".delete-rule").addEventListener("click", () => {
      if (!confirm("Удалить правило?")) return;
      groups[currentGroupIndex].rules.splice(currentRuleIndex, 1);
      currentRuleIndex = -1;
      ruleDetailsContainer.innerHTML = "";
      editor.clear();
      renderRuleList();
      autoSave();
    });

    // Attach dragstart to step types
    details.querySelectorAll(".step-type:not(.disabled)").forEach(el => {
      el.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("step-type", el.dataset.type);
      });
    });

    // render drawflow for this rule
    loadDrawflowFromRule(rule);
  }

  /*** Drawflow helper functions ***/
  function getNodeElement(nodeId) {
    const candidates = [
      document.getElementById(`node-${nodeId}`),
      document.querySelector(`#node-${nodeId}`),
      document.querySelector(`[data-node="${nodeId}"]`),
      document.querySelector(`.drawflow-node[data-node="${nodeId}"]`),
      document.querySelector(`.drawflow-node#node-${nodeId}`)
    ];
    for (const el of candidates) if (el) return el;
    return document.querySelector(`.drawflow-node[data-id="${nodeId}"]`) || null;
  }

  function attachNodeDblClick(nodeId) {
    let attempts = 0;
    const maxAttempts = 40;
    function tryAttach() {
      const el = getNodeElement(nodeId);
      if (el) {
        if (nodeListeners[nodeId]) el.removeEventListener('dblclick', nodeListeners[nodeId]);
        const handler = () => openStepEditor(nodeId);
        el.addEventListener('dblclick', handler);
        nodeListeners[nodeId] = handler;
      } else {
        attempts++;
        if (attempts < maxAttempts) requestAnimationFrame(tryAttach);
        else console.debug("Не найден DOM ноды для", nodeId);
      }
    }
    tryAttach();
  }

  function setNodeVisibleContent(nodeId, nodeData) {
    const el = getNodeElement(nodeId);
    if (!el) return;
    const candidates = ['.drawflow-node-content', '.drawflow_content_node', '.box', '.content-box', '.drawflow_node_content'];
    let content = null;
    for (const sel of candidates) {
      content = el.querySelector(sel);
      if (content) break;
    }
    if (!content) content = el;
    const type = escapeHtml(nodeData.type || nodeData.name || '');
    const desc = escapeHtml(nodeData.description || '');
    const isFirst = nodeData.isFirst ? 'start-node' : '';
    const checked = nodeData.enabled !== false ? 'checked' : '';
    // Get the first selector's value (if any) and truncate to 30 characters
    const selectorValue = nodeData.selectors && nodeData.selectors.length > 0 
      ? escapeHtml(nodeData.selectors[0].value || '').substring(0, 30) + (nodeData.selectors[0].value.length > 30 ? '...' : '')
      : '';
    // Get the node's value (if any)
    const value = escapeHtml(nodeData.value || '');
    // Combine description, value, and selector into the node description
    const nodeDescContent = [
      desc,
      value ? `Value: ${value}` : '',
      selectorValue ? `Selector: ${selectorValue}` : ''
    ].filter(Boolean).join('<br>');
    
    content.innerHTML = `
      <div class="${isFirst}">
        <label class="node-toggle">
          <input type="checkbox" class="node-enabled" ${checked}>
          <b>${type}</b>
        </label>
        <span class="node-desc">${nodeDescContent}</span>
      </div>
    `;
    const checkbox = content.querySelector('.node-enabled');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // Prevent triggering drag or dblclick
        const newData = { ...nodeData, enabled: checkbox.checked };
        if (typeof editor.updateNodeDataFromId === "function") {
          editor.updateNodeDataFromId(nodeId, newData);
        } else {
          try {
            const n = editor.drawflow.Home.data[nodeId];
            if (n) {
              n.data = { ...n.data, enabled: checkbox.checked };
            }
          } catch (err) { console.warn(err); }
        }
        autoSave();
      });
    }
  }

  function saveDrawflowToRule(rule) {
    try {
      const exported = editor.export();
      rule.drawflow = exported.drawflow;
      const nodes = rule.drawflow?.Home?.data || {};

      // Find the Start node
      const startNode = Object.values(nodes).find(n => n.name === "start" && n.data?.isFirst);
      if (!startNode) {
        rule.steps = [];
        return;
      }

      // Build step sequence by following connections
      const steps = [];
      const visited = new Set();
      const traverse = (nodeId) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = nodes[nodeId];
        if (!node) return;

        steps.push({
          id: node.id,
          type: node.name,
          selectors: node.data?.selectors || [],
          value: node.data?.value || "",
          description: node.data?.description || "",
          enabled: node.data?.enabled !== false,
          isFirst: node.data?.isFirst || false,
          x: node.pos_x,
          y: node.pos_y,
          connections: Object.values(node?.outputs || {}).flatMap(o => o.connections.map(c => c.node))
        });

        // Follow connections
        const connections = Object.values(node?.outputs || {}).flatMap(o => o.connections.map(c => c.node));
        connections.forEach(nextNodeId => traverse(nextNodeId));
      };

      traverse(startNode.id);
      rule.steps = steps;
    } catch (err) {
      console.error("saveDrawflowToRule err", err);
      rule.steps = [];
    }
  }

  function loadDrawflowFromRule(rule) {
    // Check if rule has a valid Start step in drawflow data
    const hasStartStep = rule.drawflow?.Home?.data
      ? Object.values(rule.drawflow.Home.data).some(n => n.name === "start" && n.data?.isFirst)
      : false;

    if (rule.drawflow && rule.drawflow.Home && rule.drawflow.Home.data && Object.keys(rule.drawflow.Home.data).length > 0 && hasStartStep) {
      // Load existing drawflow data
      editor.import({ drawflow: rule.drawflow });
      setTimeout(() => {
        const data = rule.drawflow.Home.data || {};
        Object.keys(data).forEach(id => {
          try {
            setNodeVisibleContent(id, data[id].data || { type: data[id].name, description: data[id].data?.description });
          } catch (e) { /* noop */ }
          attachNodeDblClick(id);
        });
      }, 50);
    } else {
      // Clear the canvas and add a single Start step only if none exists
      editor.clear();
      for (const k in nodeListeners) delete nodeListeners[k];
      editor.addNode(
        "start",
        0,
        1,
        100,
        100,
        "start",
        { type: "start", selectors: [], value: "", description: "Начало", enabled: true, isFirst: true },
        `<div class="start-node"><label class="node-toggle"><input type="checkbox" class="node-enabled" checked> <b>start</b></label><span class="node-desc">Начало</span></div>`
      );
      saveDrawflowToRule(rule); // Save the Start step to rule.drawflow
    }
  }

  /*** Drawflow events: auto-save when connections/nodes change ***/
  editor.on("nodeCreated", (id) => {
    attachNodeDblClick(id);
    setTimeout(() => {
      const nodeObj = (editor.drawflow && editor.drawflow.Home && editor.drawflow.Home.data && editor.drawflow.Home.data[id]) || null;
      if (nodeObj) setNodeVisibleContent(id, nodeObj.data || { type: nodeObj.name, description: nodeObj.data?.description });
    }, 20);
    autoSave();
  });

  editor.on("nodeRemoved", () => autoSave());
  editor.on("connectionCreated", () => autoSave());
  editor.on("connectionRemoved", () => autoSave());
  editor.on("nodeMoved", () => autoSave());
  editor.on("import", () => autoSave());

  /*** Modal editor for a node ***/
  let currentNodeId = null;
  const stepTypeEl = document.getElementById("stepType");
  const selectorsContainerEl = document.getElementById("selectorsContainer");
  const stepValueEl = document.getElementById("stepValue");
  const stepDescEl = document.getElementById("stepDescription");
  const stepEnabledEl = document.getElementById("stepEnabled");
  const saveStepBtn = document.getElementById("saveStepBtn");
  const duplicateStepBtn = document.getElementById("duplicateStepBtn");
  const deleteStepBtn = document.getElementById("deleteStepBtn");
  const stepModalEl = document.getElementById("stepEditorModal");
  const stepModal = new bootstrap.Modal(stepModalEl);

  function openStepEditor(nodeId) {
    currentNodeId = nodeId;
    const nodeObj = (editor.drawflow && editor.drawflow.Home && editor.drawflow.Home.data && editor.drawflow.Home.data[nodeId]) || null;
    const data = nodeObj ? nodeObj.data : (editor.getNodeFromId ? editor.getNodeFromId(nodeId).data : {});
    stepTypeEl.value = data?.type || nodeObj?.name || data?.name || "";
    stepValueEl.value = data?.value || "";
    stepDescEl.value = data?.description || "";
    stepEnabledEl.checked = data?.enabled !== false;
    renderSelectors(selectorsContainerEl, data?.selectors || []);

    // Hide value if type is blockAlert or start
    const valueGroup = stepValueEl.closest(".mb-2");
    if (stepTypeEl.value === "blockAlert" || stepTypeEl.value === "start") {
      valueGroup.style.display = "none";
    } else {
      valueGroup.style.display = "block";
    }

    // Disable delete/duplicate for Start step
    if (data?.isFirst) {
      deleteStepBtn.disabled = true;
      duplicateStepBtn.disabled = true;
    } else {
      deleteStepBtn.disabled = false;
      duplicateStepBtn.disabled = false;
    }

    stepModal.show();
  }

  saveStepBtn.addEventListener("click", () => {
    if (!currentNodeId) return;
    const selectors = [];
    const selRows = selectorsContainerEl.querySelectorAll(".selector-row");
    selRows.forEach(row => {
      selectors.push({
        type: row.querySelector(".selector-type").value,
        value: row.querySelector(".selector-value").value
      });
    });
    const newData = {
      selectors,
      value: stepValueEl.value.trim(),
      description: stepDescEl.value.trim(),
      enabled: !!stepEnabledEl.checked,
      type: stepTypeEl.value || "",
      isFirst: editor.getNodeFromId(currentNodeId)?.data?.isFirst || false
    };
    if (typeof editor.updateNodeDataFromId === "function") {
      editor.updateNodeDataFromId(currentNodeId, newData);
    } else {
      try {
        const n = editor.drawflow.Home.data[currentNodeId];
        if (n) {
          n.data = Object.assign({}, n.data || {}, newData);
        }
      } catch (e) { console.warn(e); }
    }
    setNodeVisibleContent(currentNodeId, newData);
    autoSave();
    stepModal.hide();
  });

  duplicateStepBtn.addEventListener("click", () => {
    if (!currentNodeId) return;
    const nodeInfo = editor.getNodeFromId(currentNodeId);
    if (!nodeInfo || nodeInfo.data?.isFirst) return;
    const dataCopy = JSON.parse(JSON.stringify(nodeInfo.data || {}));
    delete dataCopy.isFirst; // Ensure duplicated node is not marked as first
    const html = `<div><label class="node-toggle"><input type="checkbox" class="node-enabled" ${dataCopy.enabled !== false ? 'checked' : ''}> <b>${escapeHtml(nodeInfo.name)}</b></label><span class="node-desc">${escapeHtml(dataCopy.description)}</span></div>`;
    const newId = editor.addNode(
      nodeInfo.name,
      nodeInfo.inputs_number || 1,
      nodeInfo.outputs_number || 1,
      nodeInfo.pos_x + 50,
      nodeInfo.pos_y + 50,
      nodeInfo.class || nodeInfo.name,
      dataCopy,
      html
    );
    stepModal.hide();
    autoSave();
  });

  deleteStepBtn.addEventListener("click", () => {
    if (!currentNodeId || !confirm("Удалить шаг?") || editor.getNodeFromId(currentNodeId)?.data?.isFirst) return;
    editor.removeNodeId(`node-${currentNodeId}`);
    stepModal.hide();
    autoSave();
  });

  /*** Render multiple selectors in modal ***/
  function renderSelectors(container, selectors) {
    container.innerHTML = "";

    selectors.forEach((sel, idx) => {
      const row = document.createElement("div");
      row.className = "selector-row d-flex align-items-start gap-2 mb-2";
      row.innerHTML = `
        <select class="selector-type form-select form-select-sm">
          <option value="xpath" ${sel.type === "xpath" ? "selected" : ""}>XPath</option>
          <option value="css" ${sel.type === "css" ? "selected" : ""}>CSS</option>
        </select>
        <textarea class="selector-value form-control form-control-sm" rows="2">${escapeHtml(sel.value)}</textarea>
        <button class="deleteSelector btn btn-danger btn-sm">✖</button>
      `;
      row.querySelector(".selector-type").addEventListener("change", () => {
        selectors[idx].type = row.querySelector(".selector-type").value;
        autoSave();
      });
      row.querySelector(".selector-value").addEventListener("input", () => {
        selectors[idx].value = row.querySelector(".selector-value").value;
        autoSave();
      });
      row.querySelector(".deleteSelector").addEventListener("click", () => {
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
      selectors.push({ type: "xpath", value: "" });
      renderSelectors(container, selectors);
      autoSave();
    });
    container.appendChild(addBtn);
  }

  /*** Drag & drop from palette onto canvas ***/
  dfContainer.addEventListener("dragover", (ev) => ev.preventDefault());
  dfContainer.addEventListener("drop", (ev) => {
    ev.preventDefault();
    if (currentGroupIndex === -1 || currentRuleIndex === -1) {
      showNotification("Сначала выберите правило");
      return;
    }
    const type = ev.dataTransfer.getData("step-type");
    if (!type) return;
    // Prevent adding another Start step
    if (type === "start" && ruleHasStartStep()) {
      showNotification("Только один стартовый шаг разрешен!");
      return;
    }
    const rect = dfContainer.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const isFirst = type === "start";
    const data = { 
      type, 
      selectors: type === "start" ? [] : [{ type: "xpath", value: "" }], 
      value: "", 
      description: type === "start" ? "Начало" : "", 
      enabled: true, 
      isFirst 
    };
    const html = `<div class="${isFirst ? 'start-node' : ''}"><label class="node-toggle"><input type="checkbox" class="node-enabled" checked> <b>${escapeHtml(type)}</b></label><span class="node-desc">${escapeHtml(data.description)}</span></div>`;
    editor.addNode(type, isFirst ? 0 : 1, 1, x, y, type, data, html);
    // nodeCreated handler attaches dblclick and autosave
  });

  function ruleHasStartStep() {
    if (currentGroupIndex === -1 || currentRuleIndex === -1) return false;
    const rule = groups[currentGroupIndex].rules[currentRuleIndex];
    const hasInData = rule.drawflow?.Home?.data
      ? Object.values(rule.drawflow.Home.data).some(n => n.name === "start" && n.data?.isFirst)
      : false;
    const hasInCanvas = editor.drawflow?.Home?.data
      ? Object.values(editor.drawflow.Home.data).some(n => n.name === "start" && n.data?.isFirst)
      : false;
    return hasInData || hasInCanvas;
  }

  /*** Utilities ***/
  function escapeHtml(s) {
    if (!s && s !== 0) return "";
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
});