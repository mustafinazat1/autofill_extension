chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "selectorPicked") {
    // пересылаем всем открытым вкладкам Options Page
    chrome.runtime.sendMessage(msg);
  }
});