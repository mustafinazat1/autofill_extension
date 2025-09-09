(function() {
  console.debug("injected.js загружен");

  let isBlockAlertActive = false;
  let confirmValue = null; // 0 = OK, 1 = Cancel, null = стандартный confirm
  let promptValue = null;  // string или null

  const originalAlert = window.alert;
  const originalConfirm = window.confirm;
  const originalPrompt = window.prompt;

  window.alert = function(msg) {
    if (isBlockAlertActive) {
      console.debug("alert заблокирован:", msg);
      return true;
    }
    console.debug("Вызов стандартного alert:", msg);
    return originalAlert.call(window, msg);
  };

  window.confirm = function(msg) {
    if (confirmValue !== null) {
      const result = confirmValue === 0;
      console.debug(`confirm перехвачен (возвращает ${result ? "OK" : "Cancel"}):`, msg);
      return result;
    }
    console.debug("Вызов стандартного confirm:", msg);
    return originalConfirm.call(window, msg);
  };

  window.prompt = function(msg, def) {
    if (promptValue !== null) {
      console.debug("prompt перехвачен, возвращает:", promptValue, "для:", msg, "default:", def);
      return promptValue || "";
    }
    console.debug("Вызов стандартного prompt:", msg, "default:", def);
    return originalPrompt.call(window, msg, def);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || !event.data.fromContentScript) return;
    switch (event.data.action) {
      case "setBlockAlertActive":
        isBlockAlertActive = event.data.value;
        console.debug("isBlockAlertActive =", isBlockAlertActive);
        break;
      case "setConfirmValue":
        confirmValue = event.data.value;
        console.debug("confirmValue =", confirmValue);
        break;
      case "setPromptValue":
        promptValue = event.data.value;
        console.debug("promptValue =", promptValue);
        break;
    }
  }, false);

  console.debug("Перехват alert/confirm/prompt активирован");
})();
