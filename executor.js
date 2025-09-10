console.debug("executor.js загружен");

function substituteQuery(value, queryArgs) {
  if (typeof value !== "string") return value;
  return value.replace(/q\{([^\}]+)\}/g, (_, key) => {
    return queryArgs[key] !== undefined ? queryArgs[key] : "";
  });
}

async function executeRule(rule) {
  console.debug("Начало выполнения правила:", rule.url);

  // Получаем query-параметры для подстановок
  const queryArgs = {};
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of params.entries()) {
    if (key.startsWith("__ext_")) {
      queryArgs[key.replace("__ext_", "")] = value;
    }
  }

  for (let index = 0; index < rule.steps.length; index++) {
    const step = rule.steps[index];
    if (!step.enabled) {
      console.debug(`Шаг #${index + 1} (${step.description || step.type}) отключён, пропуск`);
      continue;
    }
    console.debug(`Выполнение шага #${index + 1} (${step.description || step.type}):`, step);

    try {
      let el = null;

      if (step.selector && step.selectorType) {
        step.selectors = [{ type: step.selectorType, value: step.selector }];
      }

      if (Array.isArray(step.selectors)) {
        for (const sel of step.selectors) {
          if (!sel.value) continue;
          if (sel.type === "xpath") {
            el = document.evaluate(sel.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          } else if (sel.type === "css") {
            el = document.querySelector(sel.value);
          }
          if (el) break;
        }
      }

      switch (step.type) {
        case "fill":
          if (!el) { console.warn("Элемент не найден"); continue; }
          const stepValue = substituteQuery(step.value, queryArgs); // <-- подстановка q{}
          if (el.tagName === "INPUT") {
            if (el.type === "checkbox") el.checked = !!stepValue;
            else if (el.type === "radio") {
              const radios = document.getElementsByName(el.name);
              Array.from(radios).forEach(r => { r.checked = r.value === stepValue; });
            } else el.value = stepValue;
          } else if (el.tagName === "SELECT") {
            const option = Array.from(el.options).find(o => o.value === stepValue || o.text === stepValue);
            if (option) el.value = option.value;
          } else {
            el.textContent = stepValue;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          break;

        case "click":
          if (el) el.click(); else console.warn("Элемент для клика не найден");
          break;

        case "wait":
          await new Promise(res => setTimeout(res, parseInt(step.value) * 1000 || 0));
          break;

        case "blockAlert":
          window.postMessage({ fromContentScript: true, action: "setBlockAlertActive", value: true }, "*");
          break;

        case "setConfirm":
          window.postMessage({ fromContentScript: true, action: "setConfirmValue", value: step.value === "1" ? 0 : 1 }, "*");
          break;

        case "setPrompt":
          const promptValue = substituteQuery(step.value, queryArgs);
          window.postMessage({ fromContentScript: true, action: "setPromptValue", value: promptValue }, "*");
          break;

        default:
          console.warn(`Неизвестный тип шага: ${step.type}`);
      }
    } catch (err) {
      console.error(`Ошибка при выполнении шага #${index + 1}:`, err);
    }
  }
}

function maskToRegex(mask) {
  // Экранируем спецсимволы регулярок кроме * и #
  let regexStr = mask.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

  // * → любой набор символов
  regexStr = regexStr.replace(/\*/g, ".*");

  // # → только цифры
  regexStr = regexStr.replace(/#/g, "[0-9]+");

  return new RegExp("^" + regexStr + "$");
}

function matchUrlByMask(mask, url) {
  return maskToRegex(mask).test(url);
}

function findMatchingRule(rules, url, autoRun) {
  console.debug("Поиск подходящего правила для URL:", url);
  return rules.find(rule => {
    const autorunOk = (rule.autoRun == autoRun || !autoRun);
    const matched = matchUrlByMask(rule.url, url);
    return autorunOk && matched;
  })};

window.executeRule = executeRule;
window.findMatchingRule = findMatchingRule;
