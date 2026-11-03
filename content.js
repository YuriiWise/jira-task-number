(() => {
  const KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;
  const ANCHOR_SELECTORS = [
    '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]', // Jira Cloud
    "#key-val" // Jira Server / Data Center
  ].join(",");
  const anchors = new WeakMap(); // button -> anchor element

  const isIssueKey = s => KEY_RE.test(s);

  function keyFromElement(el) {
    const text = el.textContent.trim();
    if (isIssueKey(text)) return text;
    const href = el.getAttribute("href") || "";
    const last = href.split("?")[0].split("/").pop();
    return isIssueKey(last) ? last : null;
  }

  function keyFromLocation() {
    const selected = new URLSearchParams(location.search).get("selectedIssue");
    if (selected && isIssueKey(selected)) return selected;
    const m = location.pathname.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/);
    return m ? m[1] : null;
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  function createButton(anchor) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jira-copy-key-btn";
    btn.textContent = "Copy";
    anchors.set(btn, anchor);
    btn.addEventListener("mouseenter", () => {
      btn.title = "Копіювати " + (keyFromElement(anchor) || "");
    });
    btn.addEventListener("click", async e => {
      e.preventDefault();
      e.stopPropagation();
      const key = keyFromElement(anchor); // read at click time: modal may switch issues
      if (!key) return;
      await copy(key);
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      clearTimeout(btn._timer);
      btn._timer = setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1500);
    });
    return btn;
  }

  function attach(anchor) {
    if (anchor.dataset.jiraCopyAttached) return;
    if (!keyFromElement(anchor)) return;
    anchor.dataset.jiraCopyAttached = "1";
    anchor.after(createButton(anchor));
  }

  function injectButtons() {
    // Drop buttons whose anchor was re-rendered away by the SPA.
    document.querySelectorAll(".jira-copy-key-btn").forEach(btn => {
      const a = anchors.get(btn);
      if (!a || !a.isConnected) btn.remove();
    });

    const found = document.querySelectorAll(ANCHOR_SELECTORS);
    if (found.length) return found.forEach(attach);

    // Fallback: only inside the issue modal, or on the /browse page itself —
    // never on board/backlog cards, which also link to /browse/KEY.
    const key = keyFromLocation();
    if (!key) return;
    const dialog = document.querySelector('[role="dialog"]');
    const scope = dialog || (location.pathname.includes("/browse/") ? document : null);
    if (!scope) return;
    const link = scope.querySelector(`a[href$="/browse/${key}"]`);
    if (link) attach(link);
  }

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      injectButtons();
    });
  }).observe(document.body, { childList: true, subtree: true });

  injectButtons();
})();
