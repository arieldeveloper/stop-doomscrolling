# Doomless Scroll (Chrome Extension)

`Doomless Scroll` is a Manifest V3 browser extension that makes X/Twitter less addictive.

## What This Repository Contains

This project is a plain JavaScript browser extension with no build step.

- `manifest.json`: Extension manifest (MV3)
- `content.js`: Feed cleanup + post counting logic (runs on `x.com` / `twitter.com`)
- `styles.css`: Monochrome/feed-reduction styles + counter/banner styling
- `background.js`: Daily stats sync + badge updates + daily reset alarm
- `popup.html` + `popup.js`: Extension popup UI and settings
- `icons/`: Extension icons

## Prerequisites

- Google Chrome (recommended) or any Chromium browser that supports MV3 extensions:
  - Chrome
  - Brave
  - Microsoft Edge
  - Arc

No Node.js, npm, or bundler is required.

## Quick Start (Local Setup)

1. Clone this repo:

```bash
git clone https://github.com/<your-username>/stop-doomscrolling.git
cd stop-doomscrolling
```

2. Open extension management in your browser:
  - Chrome: `chrome://extensions`
  - Edge: `edge://extensions`
  - Brave: `brave://extensions`

3. Enable **Developer mode** (top-right toggle).

4. Click **Load unpacked**.

5. Select this project folder (the one containing `manifest.json`).

6. Open `https://x.com` (or refresh existing X/Twitter tabs).

7. Pin the extension and open the popup to configure:
  - Daily limit
  - Extension enabled/disabled
  - Dark mode

## Development Workflow

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
