(() => {
  const EXTENSION_ENABLED_KEY = "extensionEnabled";

  // ─── Site Detection ───────────────────────────────────────────────────────
  const host = location.hostname;
  const SITE = host.includes("x.com") || host.includes("twitter.com")
    ? "x"
    : null;

  if (!SITE) return;

  // ─── Selectors per site ───────────────────────────────────────────────────
  const SELECTORS = {
    x: {
      post: ["article[data-testid='tweet']", "article"],
      text: ["div[data-testid='tweetText']", "article div[lang]"],
    },
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  const viewedPosts = new Set(); // DOM elements seen in this page session
  const postTimestamps = []; // epoch ms for posts seen this page session
  let historicCount = 0; // posts seen before this tab session (loaded from storage)
  let syncedCount = 0; // latest total count synced from storage
  let dailyLimit = 150;
  let limitReached = false;
  let lastSentCount = -1;
  let sessionStart = Date.now();
  let isExtensionEnabled = true;

  function setExtensionEnabled(enabled) {
    isExtensionEnabled = enabled;
    document.documentElement.classList.toggle("doomless-enabled", enabled);

    if (!enabled) {
      document.documentElement.classList.remove("doomless-dark");
      document.getElementById("doomless-counter")?.remove();
      document.getElementById("doomless-banner")?.remove();
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function getSelectors(type) {
    return SELECTORS[SITE]?.[type] ?? [];
  }

  function queryPosts() {
    for (const sel of getSelectors("post")) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    }
    return [];
  }

  function extractText(postEl) {
    for (const sel of getSelectors("text")) {
      const el = postEl.querySelector(sel);
      if (el?.innerText?.trim()) return el.innerText.trim();
    }
    return postEl.innerText?.trim().split("\n")[0] ?? "";
  }

  // ─── Counter UI ────────────────────────────────────────────────────────────
  function getOrCreateCounter() {
    let el = document.getElementById("doomless-counter");
    if (!el) {
      el = document.createElement("div");
      el.id = "doomless-counter";
      document.body.appendChild(el);
    }
    return el;
  }

  function postsPerMinute() {
    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const recent = postTimestamps.filter((t) => t >= oneMinAgo);
    return recent.length;
  }

  function sessionMinutes() {
    return Math.max(1, Math.round((Date.now() - sessionStart) / 60_000));
  }

  function applyDarkMode(enabled) {
    document.documentElement.classList.toggle("doomless-dark", enabled);
  }

  function updateCounter() {
    if (!isExtensionEnabled) return;
    const el = getOrCreateCounter();
    const localCount = historicCount + viewedPosts.size;
    const count = Math.max(syncedCount, localCount);
    const ppm = postsPerMinute();
    const pct = Math.min(100, Math.round((count / dailyLimit) * 100));

    const warningClass =
      count >= dailyLimit ? "limit" : count >= dailyLimit * 0.75 ? "warn" : "";
    el.className = warningClass;

    if (count >= dailyLimit && !limitReached) {
      limitReached = true;
      showLimitBanner();
    }

    el.innerHTML = `
      <div class="dl-label">Doomless Feed</div>
      <div class="dl-stat"><span class="dl-num">${count}</span><span class="dl-unit"> / ${dailyLimit} posts</span></div>
      <div class="dl-bar-wrap"><div class="dl-bar" style="width:${pct}%"></div></div>
      <div class="dl-meta">${ppm} posts/min &nbsp;·&nbsp; ${sessionMinutes()} min session</div>
    `;

    // persist to storage via background
    if (count !== lastSentCount) {
      lastSentCount = count;
      chrome.runtime.sendMessage({
        type: "UPDATE_STATS",
        payload: { count, site: SITE },
      });
    }
  }

  // ─── Limit Banner ──────────────────────────────────────────────────────────
  function showLimitBanner() {
    if (document.getElementById("doomless-banner")) return;
    const banner = document.createElement("div");
    banner.id = "doomless-banner";
    banner.innerHTML = `
      <strong>You've hit your daily limit of ${dailyLimit} posts.</strong><br>
      Consider closing this tab and doing something else.
      <button id="doomless-dismiss">Dismiss</button>
    `;
    document.body.appendChild(banner);
    document
      .getElementById("doomless-dismiss")
      .addEventListener("click", () => {
        banner.remove();
      });
  }

  // ─── Minimal Feed Renderer ────────────────────────────────────────────────
  // Instead of relying purely on CSS, we proactively strip distracting elements.
  function stripDistractions() {
    if (!isExtensionEnabled) return;
    // Avoid forcing 100vh on nested app roots; that can create a trailing blank bar.
    if (SITE === "x") {
      [document.documentElement, document.body].forEach((el) => {
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("min-height", "0", "important");
      });

      const timeline = document.querySelector("main[role='main']");
      if (timeline) {
        timeline.style.setProperty("padding-bottom", "0", "important");
        timeline.style.setProperty("margin-bottom", "0", "important");
      }
    }

    // Images, video, SVG icons (not emoji SVGs)
    document.querySelectorAll("img, video").forEach((el) => el.remove());

    // Site-specific sidebar / ad containers
    const sidebarSelectors = {
      x: ["aside[aria-label]", "[data-testid='sidebarColumn']"],
    };

    (sidebarSelectors[SITE] ?? []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // Remove sticky bottom bars (cookie prompts, app nags, chat docks).
    const bottomBarSelectors = {
      x: [
        "[data-testid='BottomBar']",
        "[data-testid='DMDrawer']",
        "[data-testid='DMDrawerContent']",
        "[aria-label='Messages'][role='region']",
        "[aria-label*='message' i][role='region']",
      ],
    };

    (bottomBarSelectors[SITE] ?? []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // Generic fallback: remove late-injected bottom/right docks and blank drawers.
    document.querySelectorAll("body *").forEach((el) => {
      if (el.id === "doomless-counter" || el.id === "doomless-banner") return;
      if (el.closest("#doomless-counter, #doomless-banner")) return;

      const styles = window.getComputedStyle(el);
      if (styles.position !== "fixed" && styles.position !== "sticky") return;

      const rect = el.getBoundingClientRect();
      const nearBottom = rect.bottom >= window.innerHeight - 2;
      const nearRight = rect.right >= window.innerWidth - 2;
      const startsInLowerHalf = rect.top >= window.innerHeight * 0.35;
      const drawerWidth = rect.width >= window.innerWidth * 0.8 || rect.width <= 520;
      const plausibleHeight = rect.height >= 44 && rect.height <= window.innerHeight * 0.7;
      const isRightDock = nearRight && rect.width <= 180 && rect.height >= 44;
      const anchoredBottomOrRight =
        styles.bottom !== "auto" || (styles.right !== "auto" && startsInLowerHalf);
      const isAppRoot =
        rect.top <= 2 &&
        rect.left <= 2 &&
        rect.width >= window.innerWidth * 0.95 &&
        rect.height >= window.innerHeight * 0.9;

      if (isAppRoot) return;

      const textDensity = (el.innerText || "").replace(/\s+/g, "").length;
      const hasMainContent = !!el.querySelector("article, main, [role='main']");
      const shouldRemove =
        anchoredBottomOrRight &&
        (nearBottom || isRightDock) &&
        startsInLowerHalf &&
        drawerWidth &&
        plausibleHeight &&
        (isRightDock || textDensity <= 40) &&
        !hasMainContent;

      if (shouldRemove) {
        el.remove();
      }
    });
  }

  // ─── IntersectionObserver for viewed posts ─────────────────────────────────
  const viewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !viewedPosts.has(entry.target)) {
          viewedPosts.add(entry.target);
          postTimestamps.push(Date.now());
          updateCounter();
        }
      });
    },
    { threshold: 0.5 }
  );

  const observedSet = new Set();

  function observeNewPosts() {
    if (!isExtensionEnabled) return;
    queryPosts().forEach((post) => {
      if (!observedSet.has(post)) {
        observedSet.add(post);
        viewObserver.observe(post);
      }
    });
  }

  // ─── MutationObserver for dynamic feed loads ───────────────────────────────
  let mutationTimer = null;
  const feedObserver = new MutationObserver(() => {
    if (!isExtensionEnabled) return;
    // Debounce to avoid thrashing on rapid DOM updates
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      stripDistractions();
      observeNewPosts();
    }, 200);
  });

  feedObserver.observe(document.body, { childList: true, subtree: true });

  // ─── Storage change listener (handles reset + limit updates from popup) ────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    let needsUpdate = false;

    if ("dailyCount" in changes) {
      const newVal = changes.dailyCount.newValue ?? 0;
      // When count is reset to 0, clear in-memory session state too
      if (newVal === 0) {
        historicCount = 0;
        syncedCount = 0;
        viewedPosts.clear();
        postTimestamps.length = 0;
        limitReached = false;
        lastSentCount = -1;
        const banner = document.getElementById("doomless-banner");
        if (banner) banner.remove();
      } else {
        syncedCount = newVal;
      }
      needsUpdate = true;
    }

    if ("dailyLimit" in changes) {
      dailyLimit = changes.dailyLimit.newValue ?? 150;
      needsUpdate = true;
    }

    if ("darkMode" in changes) {
      if (isExtensionEnabled) {
        applyDarkMode(Boolean(changes.darkMode.newValue));
      }
    }

    if (EXTENSION_ENABLED_KEY in changes) {
      const enabled = changes[EXTENSION_ENABLED_KEY].newValue !== false;
      setExtensionEnabled(enabled);
      if (enabled) {
        stripDistractions();
        observeNewPosts();
        updateCounter();
      }
    }

    if (needsUpdate) updateCounter();
  });

  // ─── Boot ──────────────────────────────────────────────────────────────────
  chrome.storage.local.get(
    ["dailyCount", "lastDate", "dailyLimit", "darkMode", EXTENSION_ENABLED_KEY],
    (data) => {
      const isEnabled = data[EXTENSION_ENABLED_KEY] !== false;
      setExtensionEnabled(isEnabled);
      if (!isEnabled) return;

      const today = new Date().toDateString();
      if (data.dailyLimit) dailyLimit = data.dailyLimit;
      const initialCount = data.lastDate === today ? (data.dailyCount ?? 0) : 0;
      historicCount = initialCount;
      syncedCount = initialCount;
      lastSentCount = initialCount;
      applyDarkMode(Boolean(data.darkMode));
      stripDistractions();
      observeNewPosts();
      updateCounter();
    }
  );
})();
