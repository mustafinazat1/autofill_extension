console.debug("executor.js загружен");

let variables = {}; // 🔹 Глобальные переменные для текущего запуска

/**
 * Выполнение шага по правилу
 */
async function executeRule(rule) {
  console.debug("Начало выполнения правила:", rule.url);
  for (let index = 0; index < rule.steps.length; index++) {
    const step = rule.steps[index];
    if (!step.enabled) {
      console.debug(`Шаг #${index + 1} (${step.description || step.type}) отключён, пропуск`);
      continue;
    }
    console.debug(`Выполнение шага #${index + 1} (${step.description || step.type}):`, step);

    try {
      let el = null;

      // поддержка старых правил
      if (step.selector && step.selectorType) {
        step.selectors = [{ type: step.selectorType, value: step.selector }];
      }

      if (Array.isArray(step.selectors)) {
        for (const sel of step.selectors) {
          if (!sel.value) continue;
          if (sel.type === "xpath") {
            console.debug(`Пробую XPath: ${sel.value}`);
            el = document.evaluate(sel.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          } else if (sel.type === "css") {
            console.debug(`Пробую CSS: ${sel.value}`);
            el = document.querySelector(sel.value);
          }
          if (el) {
            console.debug(`Элемент найден по ${sel.type}:`, el);
            break;
          }
        }
      }

      switch (step.type) {
        case "fill":
          if (!el) {
            console.warn(`Элемент не найден`);
            continue;
          }
          if (el.tagName === "INPUT") {
            if (el.type === "checkbox") {
              el.checked = !!step.value;
            } else if (el.type === "radio") {
              const radios = document.getElementsByName(el.name);
              Array.from(radios).forEach(r => {
                r.checked = (r.value === step.value);
              });
            } else {
              el.value = step.value;
            }
          } else if (el.tagName === "SELECT") {
            const option = Array.from(el.options).find(o => o.value === step.value || o.text === step.value);
            if (option) el.value = option.value;
          } else {
            el.textContent = step.value;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          break;

        case "click":
          if (el) el.click();
          else console.warn("Элемент для клика не найден");
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
          window.postMessage({ fromContentScript: true, action: "setPromptValue", value: step.value }, "*");
          break;

        default:
          console.warn(`Неизвестный тип шага: ${step.type}`);
      }
    } catch (err) {
      console.error(`Ошибка при выполнении шага #${index + 1}:`, err);
    }
  }
}


function findMatchingRule(rules, url, autoRun) {
  console.debug("Поиск подходящего правила для URL:", url);
  return rules.find(rule => (rule.autoRun == autoRun || !autoRun) && url.includes(rule.url));
}

window.executeRule = executeRule;
window.findMatchingRule = findMatchingRule;
