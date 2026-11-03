const SCRIPT_ID = "jira-copy";

async function syncContentScripts() {
  const { jiraOrigins = [] } = await chrome.storage.sync.get("jiraOrigins");
  const matches = [];
  for (const origin of jiraOrigins) {
    const pattern = origin + "/*";
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }

  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) return;

  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches,
    js: ["content.js"],
    css: ["content.css"],
    runAt: "document_idle",
    persistAcrossSessions: true
  }]);
}

// Several events fire together (e.g. saving options triggers both
// permissions.onAdded and storage.onChanged). Run syncs one at a time so
// parallel calls don't both register the same script ID.
let queue = Promise.resolve();
function scheduleSync() {
  queue = queue
    .then(syncContentScripts)
    .catch(e => console.error("syncContentScripts failed:", e));
}

chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.jiraOrigins) scheduleSync();
});
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);
