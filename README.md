
`Doomless Scroll` is a chrome extension that makes X less addictive.


## Quick Start (Local Setup)

1. Clone this repo:

```bash
git clone https://github.com/arieldeveloper/stop-doomscrolling.git
```

2. Open extension management in your browser:
  - Chrome: `chrome://extensions`
  - Edge: `edge://extensions`
  - Brave: `brave://extensions`

3. Enable **Developer mode** (top-right toggle).

4. Click **Load unpacked**.

5. Select this project folder you cloned.

Done. Use X without doomscrolling.

## When making changes

There is no compile/build step. Edit files directly, then reload the extension.

1. Make code changes.
2. Go to `chrome://extensions`.
3. Click the extension’s **Reload** button.
4. Refresh `x.com` tab(s) to reload the content script.

## How It Works

- `content.js` watches feed posts via `IntersectionObserver` and increments a local daily count as posts become visible.
- Count updates are sent to `background.js` using `chrome.runtime.sendMessage`.
- `background.js` stores daily totals in `chrome.storage.local`, updates icon badge, and resets counters when the date changes.
- `popup.js` reads/writes settings (`dailyLimit`, `darkMode`, `extensionEnabled`) from `chrome.storage.local`.

## Stored Data / Privacy

All data is stored locally in your browser via `chrome.storage.local`.

Stored keys include:

- `dailyCount`
- `lastDate`
- `siteBreakdown`
- `dailyLimit`
- `darkMode`
- `extensionEnabled`

The extension does not require a backend server and does not send analytics.
