const DAILY_LIMIT_KEY = "dailyLimit";
const DARK_MODE_KEY = "darkMode";
const EXTENSION_ENABLED_KEY = "extensionEnabled";
const DEFAULT_LIMIT = 150;

function today() {
  return new Date().toDateString();
}

function applyWarning(el, count, limit) {
  el.classList.remove("warn", "limit");
  if (count >= limit) el.classList.add("limit");
  else if (count >= limit * 0.75) el.classList.add("warn");
}

chrome.storage.local.get(
  [
    "dailyCount",
    "lastDate",
    "siteBreakdown",
    DAILY_LIMIT_KEY,
    DARK_MODE_KEY,
    EXTENSION_ENABLED_KEY,
  ],
  (data) => {
    const limit = data[DAILY_LIMIT_KEY] ?? DEFAULT_LIMIT;
    const count = data.lastDate === today() ? data.dailyCount ?? 0 : 0;
    const pct = Math.min(100, Math.round((count / limit) * 100));
    const breakdown = data.siteBreakdown ?? {};

    // Main counter
    const countEl = document.getElementById("today-count");
    countEl.textContent = `${count} / ${limit}`;
    applyWarning(countEl, count, limit);

    // Progress bar
    const bar = document.getElementById("progress-bar");
    bar.style.width = `${pct}%`;
    applyWarning(bar, count, limit);

    // Site breakdown
    ["x"].forEach((site) => {
      const el = document.getElementById(`count-${site}`);
      if (el) el.textContent = breakdown[site] ?? 0;
    });

    // Limit input
    document.getElementById("limit-input").value = limit;

    // Dark mode toggle
    document.getElementById("dark-mode-toggle").checked = Boolean(
      data[DARK_MODE_KEY]
    );

    // Extension enabled toggle (defaults to on)
    const isEnabled = data[EXTENSION_ENABLED_KEY] !== false;
    document.getElementById("enabled-toggle").checked = isEnabled;
  }
);

document.getElementById("save-limit").addEventListener("click", () => {
  const val = parseInt(document.getElementById("limit-input").value, 10);
  if (!isNaN(val) && val >= 10) {
    chrome.storage.local.set({ [DAILY_LIMIT_KEY]: val }, () => {
      const btn = document.getElementById("save-limit");
      btn.textContent = "Saved ✓";
      setTimeout(() => {
        btn.textContent = "Save limit";
      }, 1500);
    });
  }
});

document.getElementById("reset-today").addEventListener("click", () => {
  chrome.storage.local.set(
    { dailyCount: 0, lastDate: today(), siteBreakdown: {} },
    () => window.location.reload()
  );
});

document.getElementById("dark-mode-toggle").addEventListener("change", (e) => {
  chrome.storage.local.set({ [DARK_MODE_KEY]: e.target.checked });
});

document.getElementById("enabled-toggle").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ [EXTENSION_ENABLED_KEY]: enabled }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabId = tabs[0]?.id;
      if (activeTabId) chrome.tabs.reload(activeTabId);
    });
  });
});

document.getElementById("creator-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://x.com/arielchouminov" });
});
