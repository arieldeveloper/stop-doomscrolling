const DAILY_LIMIT_KEY = "dailyLimit";
const EXTENSION_ENABLED_KEY = "extensionEnabled";
const DEFAULT_LIMIT = 150;

function today() {
  return new Date().toDateString();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "UPDATE_STATS") return;

  const { count, site } = message.payload;

  chrome.storage.local.get(
    ["dailyCount", "lastDate", "siteBreakdown", DAILY_LIMIT_KEY, EXTENSION_ENABLED_KEY],
    (data) => {
      const isEnabled = data[EXTENSION_ENABLED_KEY] !== false;
      if (!isEnabled) {
        sendResponse({ ok: true, ignored: true });
        return;
      }

      const currentDate = data.lastDate;
      const todayStr = today();

      // Reset counters on a new day
      const prevCount = currentDate === todayStr ? (data.dailyCount ?? 0) : 0;
      const prevBreakdown = currentDate === todayStr ? (data.siteBreakdown ?? {}) : {};

      // Only write if the new count is higher (content script may re-send lower values on reload seed)
      if (count <= prevCount && currentDate === todayStr) {
        sendResponse({ ok: true });
        return;
      }

      const newBreakdown = { ...prevBreakdown };
      if (site) {
        newBreakdown[site] = (newBreakdown[site] ?? 0) + (count - prevCount);
      }

      chrome.storage.local.set({
        dailyCount: count,
        lastDate: todayStr,
        siteBreakdown: newBreakdown
      });

      // Badge on the extension icon showing today's count
      const limit = data[DAILY_LIMIT_KEY] ?? DEFAULT_LIMIT;
      const badgeText = count >= limit ? "!" : String(count);
      const badgeColor = count >= limit ? "#c00" : count >= limit * 0.75 ? "#c07000" : "#111";

      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: badgeColor });

      sendResponse({ ok: true });
    }
  );

  // Keep message channel open for async response
  return true;
});

// Clear badge / reset on new day at midnight
chrome.alarms.create("midnight-reset", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "midnight-reset") return;

  chrome.storage.local.get(["lastDate"], (data) => {
    if (data.lastDate !== today()) {
      chrome.storage.local.set({
        dailyCount: 0,
        lastDate: today(),
        siteBreakdown: {}
      });
      chrome.action.setBadgeText({ text: "" });
    }
  });
});

function syncActionState() {
  chrome.storage.local.get([EXTENSION_ENABLED_KEY], (data) => {
    const isEnabled = data[EXTENSION_ENABLED_KEY] !== false;

    if (!isEnabled) {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#666" });
      return;
    }

    chrome.storage.local.get(["dailyCount", "lastDate", DAILY_LIMIT_KEY], (stats) => {
      const limit = stats[DAILY_LIMIT_KEY] ?? DEFAULT_LIMIT;
      const count = stats.lastDate === today() ? stats.dailyCount ?? 0 : 0;
      const badgeText = count >= limit ? "!" : String(count);
      const badgeColor = count >= limit ? "#c00" : count >= limit * 0.75 ? "#c07000" : "#111";
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!(EXTENSION_ENABLED_KEY in changes)) return;
  syncActionState();
});

syncActionState();
