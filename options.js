const textarea = document.getElementById("urls");
const status = document.getElementById("status");
let savedOrigins = [];

function parseOrigins(text) {
  const origins = new Set();
  const invalid = [];
  for (const line of text.split("\n").map(s => s.trim()).filter(Boolean)) {
    try {
      const url = new URL(/^https?:\/\//i.test(line) ? line : "https://" + line);
      origins.add(url.origin);
    } catch {
      invalid.push(line);
    }
  }
  return { origins: [...origins], invalid };
}

function show(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "error" : "";
}

chrome.storage.sync.get("jiraOrigins").then(({ jiraOrigins = [] }) => {
  savedOrigins = jiraOrigins;
  textarea.value = jiraOrigins.join("\n");
});

document.getElementById("save").addEventListener("click", () => {
  const { origins, invalid } = parseOrigins(textarea.value);
  if (invalid.length) return show("Некоректний URL: " + invalid.join(", "), true);

  // permissions.request must be called synchronously inside the user gesture.
  const request = origins.length
    ? chrome.permissions.request({ origins: origins.map(o => o + "/*") })
    : Promise.resolve(true);

  request.then(async granted => {
    if (!granted) return show("Дозвіл не надано — збереження скасовано.", true);
    const removed = savedOrigins.filter(o => !origins.includes(o));
    if (removed.length) await chrome.permissions.remove({ origins: removed.map(o => o + "/*") });
    await chrome.storage.sync.set({ jiraOrigins: origins });
    savedOrigins = origins;
    textarea.value = origins.join("\n");
    show("Збережено ✓");
  }).catch(e => show(e.message, true));
});
