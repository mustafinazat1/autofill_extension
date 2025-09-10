chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "copy-css-selector",
    title: "Copy CSS Selector",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "copy-xpath",
    title: "Copy XPath",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "copy-value",
    title: "Copy Value",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "copy-variants",
    title: "Copy Selector Variants",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab.id) return;

  // ---------- Copy CSS ----------
  if (info.menuItemId === "copy-css-selector") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.activeElement || document.body;

        function showToast(el, message) {
          const rect = el.getBoundingClientRect();
          const toast = document.createElement('div');
          toast.textContent = message;
          toast.style.position = 'absolute';
          toast.style.top = `${rect.top + window.scrollY - 30}px`;
          toast.style.left = `${rect.left + window.scrollX}px`;
          toast.style.background = 'rgba(0,0,0,0.85)';
          toast.style.color = 'white';
          toast.style.padding = '5px 10px';
          toast.style.fontSize = '12px';
          toast.style.borderRadius = '4px';
          toast.style.zIndex = '10000';
          toast.style.transition = 'opacity 0.3s';
          toast.style.opacity = '0';
          document.body.appendChild(toast);
          requestAnimationFrame(() => { toast.style.opacity = '1'; });
          setTimeout(() => {
            toast.style.opacity = '0';
            toast.addEventListener('transitionend', () => toast.remove());
          }, 2000);
        }

function getChromeCopySelector(element) {
  if (!(element instanceof Element)) return '';

  const path = [];

  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();

    // Если у элемента есть корректный id → используем его и выходим
    if (
      element.id &&
      typeof element.id === 'string' &&
      element.id.trim() !== ''
    ) {
      selector = `#${CSS.escape(element.id)}`;
      path.unshift(selector);
      break;
    }

    // Проверяем :nth-of-type среди соседей
    const parent = element.parentNode;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        e => e.nodeName === element.nodeName
      );
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(element) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    element = element.parentNode;
  }

  return path.join(' > ');
}


        const selector = getChromeCopySelector(el);
        navigator.clipboard.writeText(selector).then(() => showToast(el, selector));
      }
    });
  }

  // ---------- Copy XPath ----------
  if (info.menuItemId === "copy-xpath") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.activeElement || document.body;

        function showToast(el, message) {
          const rect = el.getBoundingClientRect();
          const toast = document.createElement('div');
          toast.textContent = message;
          toast.style.position = 'absolute';
          toast.style.top = `${rect.top + window.scrollY - 30}px`;
          toast.style.left = `${rect.left + window.scrollX}px`;
          toast.style.background = 'rgba(0,0,0,0.85)';
          toast.style.color = 'white';
          toast.style.padding = '5px 10px';
          toast.style.fontSize = '12px';
          toast.style.borderRadius = '4px';
          toast.style.zIndex = '10000';
          toast.style.transition = 'opacity 0.3s';
          toast.style.opacity = '0';
          document.body.appendChild(toast);
          requestAnimationFrame(() => { toast.style.opacity = '1'; });
          setTimeout(() => {
            toast.style.opacity = '0';
            toast.addEventListener('transitionend', () => toast.remove());
          }, 2000);
        }

        function getXPath(element) {
          if (!element) return '';
          if (element.id) return `//*[@id="${element.id}"]`;
          const parts = [];
          let current = element;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            if (current.id) {
              parts.unshift(`*[@id="${current.id}"]`);
              break;
            }
            let index = 1;
            let sibling = current.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            const tag = current.tagName.toLowerCase();
            parts.unshift(`${tag}[${index}]`);
            current = current.parentNode;
          }
          return '/' + parts.join('/');
        }

        const xpath = getXPath(el);
        navigator.clipboard.writeText(xpath).then(() => showToast(el, xpath));
      }
    });
  }

  // ---------- Copy Value ----------
  if (info.menuItemId === "copy-value") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.activeElement;

        function showToast(el, message) {
          const rect = el.getBoundingClientRect();
          const toast = document.createElement('div');
          toast.textContent = message;
          toast.style.position = 'absolute';
          toast.style.top = `${rect.top + window.scrollY - 30}px`;
          toast.style.left = `${rect.left + window.scrollX}px`;
          toast.style.background = 'rgba(0,0,0,0.85)';
          toast.style.color = 'white';
          toast.style.padding = '5px 10px';
          toast.style.fontSize = '12px';
          toast.style.borderRadius = '4px';
          toast.style.zIndex = '10000';
          toast.style.transition = 'opacity 0.3s';
          toast.style.opacity = '0';
          document.body.appendChild(toast);
          requestAnimationFrame(() => { toast.style.opacity = '1'; });
          setTimeout(() => {
            toast.style.opacity = '0';
            toast.addEventListener('transitionend', () => toast.remove());
          }, 2000);
        }

        function showValuePanel(element, values) {
          const rect = element.getBoundingClientRect();
          const panel = document.createElement('ul');
          panel.style.position = 'absolute';
          panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
          panel.style.left = `${rect.left + window.scrollX}px`;
          panel.style.background = 'white';
          panel.style.border = '1px solid #ccc';
          panel.style.borderRadius = '4px';
          panel.style.padding = '5px 0';
          panel.style.margin = '0';
          panel.style.listStyle = 'none';
          panel.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
          panel.style.zIndex = '10000';
          panel.style.maxHeight = '300px';
          panel.style.overflowY = 'auto';
          panel.style.fontSize = '13px';

          values.forEach(v => {
            const li = document.createElement('li');
            li.innerHTML = v.optgroup
              ? `<em>${v.optgroup}</em> › <strong>${v.text}</strong> (${v.value})`
              : `<strong>${v.text}</strong> (${v.value})`;
            li.style.padding = '4px 10px';
            li.style.cursor = 'pointer';
            li.addEventListener('mouseenter', () => li.style.background = '#f0f0f0');
            li.addEventListener('mouseleave', () => li.style.background = '');
            li.addEventListener('click', () => {
              navigator.clipboard.writeText(v.value);
              showToast(element, `Copied: ${v.value}`);
              panel.remove();
            });
            panel.appendChild(li);
          });

          document.body.appendChild(panel);

          const clickOutside = (e) => {
            if (!panel.contains(e.target)) {
              panel.remove();
              document.removeEventListener('click', clickOutside);
            }
          };
          document.addEventListener('click', clickOutside);
        }

        function getSelectValues(element) {
          const values = [];
          Array.from(element.children).forEach(child => {
            if (child.tagName === 'OPTION') {
              values.push({
                value: child.value || '',
                text: (child.textContent || child.value || '').trim() || '(empty)',
                optgroup: null
              });
            } else if (child.tagName === 'OPTGROUP') {
              const groupLabel = child.label || '(Group)';
              Array.from(child.options).forEach(o => {
                values.push({
                  value: o.value || '',
                  text: (o.textContent || o.value || '').trim() || '(empty)',
                  optgroup: groupLabel
                });
              });
            }
          });
          return values;
        }

        function copyValue(element) {
          if (!element) return;
          if (element.tagName === 'SELECT') {
            showValuePanel(element, getSelectValues(element));
          } else if (element.tagName === 'INPUT' && element.type === 'radio') {
            const radios = document.querySelectorAll(`input[name="${element.name}"]`);
            const values = Array.from(radios).map(r => ({
              value: r.value,
              text: r.value,
              optgroup: null
            }));
            showValuePanel(element, values);
          } else {
            const value = element.value || element.textContent || '';
            navigator.clipboard.writeText(value);
            showToast(element, `Copied: ${value}`);
          }
        }

        copyValue(el);
      }
    });
  }

  // ---------- Copy Variants ----------
   // ---------- Copy Variants ----------
  if (info.menuItemId === "copy-variants") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.activeElement || document.body;

        function showToast(message) {
          const toast = document.createElement('div');
          toast.textContent = message;
          toast.style.position = 'fixed';
          toast.style.bottom = '20px';
          toast.style.left = '50%';
          toast.style.transform = 'translateX(-50%)';
          toast.style.background = 'rgba(0,0,0,0.85)';
          toast.style.color = 'white';
          toast.style.padding = '6px 12px';
          toast.style.fontSize = '13px';
          toast.style.borderRadius = '4px';
          toast.style.zIndex = '10000';
          toast.style.transition = 'opacity 0.3s';
          toast.style.opacity = '0';
          document.body.appendChild(toast);
          requestAnimationFrame(() => { toast.style.opacity = '1'; });
          setTimeout(() => {
            toast.style.opacity = '0';
            toast.addEventListener('transitionend', () => toast.remove());
          }, 2000);
        }

function getXPath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

  // Если есть корректный id (строка и не пустая)
  if (element.id && typeof element.id === 'string' && element.id.trim() !== '') {
    return `//*[@id="${element.id}"]`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current.id && typeof current.id === 'string' && current.id.trim() !== '') {
      parts.unshift(`*[@id="${current.id}"]`);
      break;
    }

    let index = 1;
    let sibling = current.previousSibling;

    while (sibling) {
      if (
        sibling.nodeType === Node.ELEMENT_NODE &&
        sibling.tagName === current.tagName
      ) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    const tag = current.tagName.toLowerCase();
    parts.unshift(`${tag}[${index}]`);
    current = current.parentNode;
  }

  return '/' + parts.join('/');
}


function getChromeCopySelector(element) {
  if (!(element instanceof Element)) return '';

  const path = [];

  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();

    // Если у элемента есть корректный id → используем его и выходим
    if (
      element.id &&
      typeof element.id === 'string' &&
      element.id.trim() !== ''
    ) {
      selector = `#${CSS.escape(element.id)}`;
      path.unshift(selector);
      break;
    }

    // Проверяем :nth-of-type среди соседей
    const parent = element.parentNode;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        e => e.nodeName === element.nodeName
      );
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(element) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    element = element.parentNode;
  }

  return path.join(' > ');
}



function generateSelectors(element) {
  const tag = element.tagName.toLowerCase();
  const list = [];

  function makeUniqueCss(selector, element) {
    const matches = document.querySelectorAll(selector);
    if (matches.length === 1) return selector;
    if (matches.length > 1) {
      // усиливаем nth-of-type
      const parent = element.parentNode;
      if (parent) {
        const siblings = Array.from(parent.children).filter(e => e.tagName === element.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(element) + 1;
          return selector + `:nth-of-type(${index})`;
        }
      }
    }
    return selector; // fallback
  }

  function makeUniqueXPath(xpath, element) {
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength === 1) return xpath;
    // добавляем [1], [2] и т.п. если совпадает больше
    for (let i = 0; i < result.snapshotLength; i++) {
      if (result.snapshotItem(i) === element) {
        return `(${xpath})[${i + 1}]`;
      }
    }
    return xpath; // fallback
  }

  // Основной "как у Chrome"
  list.push({ type: "CSS", value: makeUniqueCss(getChromeCopySelector(element), element) });

  // По ID
  if (element.id) {
    list.push({ type: "By ID", value: `#${element.id}` });
    list.push({ type: "Tag+ID", value: `${tag}#${element.id}` });
  }

  // По классу
  if (element.classList.length > 0) {
    const classSelector = '.' + Array.from(element.classList).join('.');
    list.push({ type: "By Class", value: makeUniqueCss(`${tag}${classSelector}`, element) });
  }

  // По стандартным атрибутам
  ["name", "type", "title", "placeholder"].forEach(attr => {
    if (element.hasAttribute(attr)) {
      list.push({
        type: `By [${attr}]`,
        value: makeUniqueCss(`${tag}[${attr}="${element.getAttribute(attr)}"]`, element)
      });
    }
  });

  // По data-* атрибутам
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith("data-")) {
      list.push({
        type: `By ${attr.name}`,
        value: makeUniqueCss(`${tag}[${attr.name}="${attr.value}"]`, element)
      });
    }
  });

  // По nth-of-type (fallback)
  if (element.parentNode) {
    const siblings = Array.from(element.parentNode.children).filter(e => e.tagName === element.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      list.push({ type: "nth-of-type", value: `${tag}:nth-of-type(${index})` });
    }
  }

  // XPath полный
  list.push({ type: "XPath", value: getXPath(element) });

  // XPath по тексту
  const text = (element.textContent || "").trim();
  if (text) {
    const shortText = text.length > 20 ? text.slice(0, 20) + "…" : text;
    list.push({
      type: "XPath contains(text)",
      value: makeUniqueXPath(`//${tag}[contains(normalize-space(.), "${shortText}")]`, element)
    });
  }

  return list;
}


        function showSelectorPanel(element, selectors) {
          const rect = element.getBoundingClientRect();
          const panel = document.createElement('ul');
          panel.style.position = 'absolute';
          panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
          panel.style.left = `${rect.left + window.scrollX}px`;
          panel.style.background = 'white';
          panel.style.border = '1px solid #ccc';
          panel.style.borderRadius = '4px';
          panel.style.padding = '5px 0';
          panel.style.margin = '0';
          panel.style.listStyle = 'none';
          panel.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
          panel.style.zIndex = '10000';
          panel.style.fontSize = '13px';
          panel.style.maxHeight = '300px';
          panel.style.overflowY = 'auto';

          selectors.forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${s.type}</strong>: <code>${s.value}</code>`;
            li.style.padding = '4px 10px';
            li.style.cursor = 'pointer';
            li.addEventListener('mouseenter', () => li.style.background = '#f0f0f0');
            li.addEventListener('mouseleave', () => li.style.background = '');
            li.addEventListener('click', () => {
              navigator.clipboard.writeText(s.value);
              showToast(`Copied: ${s.value}`);
              panel.remove();
            });
            panel.appendChild(li);
          });

          document.body.appendChild(panel);

          const clickOutside = (e) => {
            if (!panel.contains(e.target)) {
              panel.remove();
              document.removeEventListener('click', clickOutside);
            }
          };
          document.addEventListener('click', clickOutside);
        }

        showSelectorPanel(el, generateSelectors(el));
      }
    });
  }
});
