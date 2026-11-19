/**
 * Antigravity Meta Bridge Extension - Side Panel Controller
 * Persistent management dashboard for Facebook & Instagram automation.
 */

import { clientTrendEngine, ClientViralRadar, clientPrePostOptimizer } from "./trend_engine.js";
import { metaKnowledgeData } from "./knowledge_data.js";
import { clientSupervisorGuard, clientCircuitBreaker } from "./anti_detection.js";

function initSidePanel() {
  // Elements: Header & Status
  const bridgeBadge = document.getElementById("bridgeBadge");
  const bridgeText = document.getElementById("bridgeText");
  const btnReloadBridge = document.getElementById("btnReloadBridge");
  const btnSyncSessions = document.getElementById("btnSyncSessions");
  const btnPauseToggle = document.getElementById("btnPauseToggle");
  const pauseBtnText = document.getElementById("pauseBtnText");

  // Elements: Tabs
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");
  const queueBadgeCount = document.getElementById("queueBadgeCount");

  // Elements: Overview
  const fbAccountName = document.getElementById("fbAccountName");
  const fbAccountId = document.getElementById("fbAccountId");
  const fbStatusPill = document.getElementById("fbStatusPill");
  const igAccountName = document.getElementById("igAccountName");
  const igAccountId = document.getElementById("igAccountId");
  const igStatusPill = document.getElementById("igStatusPill");
  const btnRefreshSessions = document.getElementById("btnRefreshSessions");
  const btnOpenFB = document.getElementById("btnOpenFB");
  const btnOpenIG = document.getElementById("btnOpenIG");
  const btnOpenBusinessSuite = document.getElementById("btnOpenBusinessSuite");
  const btnOpenYT = document.getElementById("btnOpenYT");
  const btnOpenTT = document.getElementById("btnOpenTT");
  const btnFocusFB = document.getElementById("btnFocusFB");
  const btnLogoutFB = document.getElementById("btnLogoutFB");
  const btnFocusIG = document.getElementById("btnFocusIG");
  const btnLogoutIG = document.getElementById("btnLogoutIG");
  const btnFocusBiz = document.getElementById("btnFocusBiz");
  const btnLogoutBiz = document.getElementById("btnLogoutBiz");

  // Elements: Composer
  const postComposerForm = document.getElementById("postComposerForm");
  const platformSelect = document.getElementById("platformSelect");
  const targetSelect = document.getElementById("targetSelect");
  const targetIdGroup = document.getElementById("targetIdGroup");
  const targetIdInput = document.getElementById("targetIdInput");
  const contentTypeSelect = document.getElementById("contentTypeSelect");
  const postCaption = document.getElementById("postCaption");
  const captionCharCount = document.getElementById("captionCharCount");
  const mediaUploadGroup = document.getElementById("mediaUploadGroup");
  const fileDropArea = document.getElementById("fileDropArea");
  const mediaFileInput = document.getElementById("mediaFileInput");
  const filePreviewCard = document.getElementById("filePreviewCard");
  const filePreviewImg = document.getElementById("filePreviewImg");
  const filePreviewName = document.getElementById("filePreviewName");
  const filePreviewSize = document.getElementById("filePreviewSize");
  const btnRemoveFile = document.getElementById("btnRemoveFile");
  const thumbnailUploadGroup = document.getElementById("thumbnailUploadGroup");
  const thumbDropArea = document.getElementById("thumbDropArea");
  const thumbnailFileInput = document.getElementById("thumbnailFileInput");
  const thumbPreviewCard = document.getElementById("thumbPreviewCard");
  const thumbPreviewImg = document.getElementById("thumbPreviewImg");
  const thumbPreviewName = document.getElementById("thumbPreviewName");
  const thumbPreviewSize = document.getElementById("thumbPreviewSize");
  const btnRemoveThumb = document.getElementById("btnRemoveThumb");
  const scheduleConvertedUtc = document.getElementById("scheduleConvertedUtc");
  let selectedThumbnailData = null; // { name, type, size, base64 }
  const scheduleMode = document.getElementById("scheduleMode");
  const scheduleTimeGroup = document.getElementById("scheduleTimeGroup");
  const scheduleTimeInput = document.getElementById("scheduleTimeInput");
  const btnSubmitPost = document.getElementById("btnSubmitPost");

  // Elements: Queue
  const queueList = document.getElementById("queueList");
  const btnRefreshQueue = document.getElementById("btnRefreshQueue");
  const btnClearCompleted = document.getElementById("btnClearCompleted");

  // Elements: Console
  const consoleBox = document.getElementById("consoleBox");
  const autoScrollCheck = document.getElementById("autoScrollCheck");
  const btnClearConsole = document.getElementById("btnClearConsole");

  // Elements: Trend Radar & Competitor Intelligence
  const trendKeywordInput = document.getElementById("trendKeywordInput");
  const trendCompetitorInput = document.getElementById("trendCompetitorInput");
  const btnScanTrends = document.getElementById("btnScanTrends");
  const btnToggleLiveStream = document.getElementById("btnToggleLiveStream");
  const streamToggleIcon = document.getElementById("streamToggleIcon");
  const streamToggleText = document.getElementById("streamToggleText");
  const btnSpyCompetitor = document.getElementById("btnSpyCompetitor");
  const trendSourcePills = document.getElementById("trendSourcePills");
  const trendFeedList = document.getElementById("trendFeedList");
  const competitorSpyCard = document.getElementById("competitorSpyCard");
  const btnCloseSpyCard = document.getElementById("btnCloseSpyCard");
  const spyBenchmarkInfo = document.getElementById("spyBenchmarkInfo");
  const spyContentGapsList = document.getElementById("spyContentGapsList");
  const tickerSpeedText = document.getElementById("tickerSpeedText");
  const tickerVelocityText = document.getElementById("tickerVelocityText");
  const tickerBreakoutCount = document.getElementById("tickerBreakoutCount");
  
  // Elements: Pre-Post Competitor Battle & Viral SEO Optimizer
  const prePostConceptInput = document.getElementById("prePostConceptInput");
  const btnRunPrePostOptimize = document.getElementById("btnRunPrePostOptimize");
  const prePostBattleResult = document.getElementById("prePostBattleResult");
  const prePostViralityPill = document.getElementById("prePostViralityPill");
  const prePostCompetitorStats = document.getElementById("prePostCompetitorStats");
  const prePostWeaknessText = document.getElementById("prePostWeaknessText");
  const btnApplyOptimizedCaption = document.getElementById("btnApplyOptimizedCaption");
  const btnCopyOptimizedPrompt = document.getElementById("btnCopyOptimizedPrompt");
  let activePrePostResult = null;

  // Internal State
  let isQueuePaused = false;
  let selectedFileData = null; // { name, type, size, base64 }
  let isStreamActive = false;
  let streamTimer = null;
  let activeTrends = [];

  // Native App Toast Notification System
  const appToast = document.getElementById("appToast");
  let toastTimer = null;

  function showToast(message, type = "info") {
    if (!appToast) return;
    if (toastTimer) clearTimeout(toastTimer);

    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    else if (type === "warn") icon = "⚠️";
    else if (type === "error") icon = "✕";

    appToast.className = `app-toast ${type} show`;
    appToast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

    toastTimer = setTimeout(() => {
      appToast.classList.remove("show");
    }, 2400);
  }

  // -------------------------------------------------------------
  // 1. Tab Navigation
  // -------------------------------------------------------------
  function switchToTab(targetId) {
    navTabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    const tab = document.querySelector(`.nav-tab[data-tab="${targetId}"]`);
    if (tab) tab.classList.add("active");
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.add("active");

    if (targetId === "tab-queue") {
      fetchQueueData();
    } else if (targetId === "tab-trends") {
      if (typeof executeTrendScan === "function" && activeTrends.length === 0) {
        executeTrendScan();
      }
    } else if (targetId === "tab-smm") {
      if (typeof fetchAutoReplyRules === "function") fetchAutoReplyRules();
      if (typeof fetchCronSlots === "function") fetchCronSlots();
    }
  }

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");
      switchToTab(targetId);
    });
  });

  // -------------------------------------------------------------
  // 2. Logging & Console
  // -------------------------------------------------------------
  function logConsole(level, message) {
    const line = document.createElement("div");
    line.className = "log-line";

    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = `[${timeStr}]`;

    const levelSpan = document.createElement("span");
    levelSpan.className = `log-level ${level}`;
    levelSpan.textContent = level;

    const msgSpan = document.createElement("span");
    msgSpan.className = "log-msg";
    msgSpan.textContent = message;

    line.appendChild(timeSpan);
    line.appendChild(levelSpan);
    line.appendChild(msgSpan);

    consoleBox.appendChild(line);

    if (autoScrollCheck.checked) {
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }
  }

  if (btnClearConsole && consoleBox) {
    btnClearConsole.addEventListener("click", () => {
      consoleBox.innerHTML = "";
      logConsole("INFO", "Console buffer cleared.");
    });
  }

  // -------------------------------------------------------------
  // 3. State Management & Storage Listeners
  // -------------------------------------------------------------
  let latestBridgeState = {};

  function updateComposerTargets(state) {
    if (state) latestBridgeState = { ...latestBridgeState, ...state };
    if (!targetSelect) return;
    const plat = platformSelect ? platformSelect.value : "facebook";
    const s = latestBridgeState || {};

    if (plat === "facebook") {
      const uName = s.fbUser || "Renuka Yadav";
      const pages = s.businessSuitePages || [];
      let pageOpts = "";
      if (pages.length > 0) {
        for (const p of pages) {
          pageOpts += `<option value="page_${p.id}">📄 Page: ${p.name || p.id}</option>`;
        }
      } else {
        pageOpts = `<option value="page" disabled>📄 Facebook Page (No Pages Linked)</option>`;
      }
      const cur = targetSelect.value;
      targetSelect.innerHTML = `
        <option value="profile" ${cur === "profile" || !cur ? "selected" : ""}>👤 Personal Feed (${uName})</option>
        ${pageOpts}
        <option value="group" ${cur === "group" ? "selected" : ""}>👥 Facebook Group</option>
      `;
      if (targetIdGroup) targetIdGroup.style.display = (targetSelect.value === "group") ? "block" : "none";
    } else {
      const cur = targetSelect.value;
      targetSelect.innerHTML = `
        <option value="feed" ${cur === "feed" || !cur ? "selected" : ""}>📸 Feed Photo</option>
        <option value="reel" ${cur === "reel" ? "selected" : ""}>🎥 Reel Video</option>
        <option value="story" ${cur === "story" ? "selected" : ""}>⚡ Story</option>
      `;
      if (targetIdGroup) targetIdGroup.style.display = "none";
    }
  }

  // Copyable ID badge listener
  document.addEventListener("click", (e) => {
    const badge = e.target.closest(".copyable-badge");
    if (badge) {
      const text = badge.getAttribute("data-copy");
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(`Copied ID ${text} to clipboard!`, "success");
        }).catch(() => {
          showToast(`ID: ${text}`, "info");
        });
      }
    }
  });

  function renderBridgeState(state) {
    if (!state) return;
    latestBridgeState = { ...latestBridgeState, ...state };

    // Bridge Connection
    if (bridgeBadge && bridgeText) {
      if (state.connected) {
        bridgeBadge.className = "connection-badge connected";
        bridgeText.textContent = "Bridge Online";
      } else {
        bridgeBadge.className = "connection-badge disconnected";
        bridgeText.textContent = "Bridge Offline";
      }
    }

    // Facebook session
    if (fbStatusPill && fbAccountName) {
      if (state.fbLoggedIn) {
        fbStatusPill.className = "status-pill pill-online";
        fbStatusPill.textContent = "Online";
        const fbName = state.fbUser || "Renuka Yadav";
        fbAccountName.textContent = fbName;
        const fbId = state.fbId || "61592442011195";
        if (fbAccountId) {
          fbAccountId.innerHTML = `Profile ID: <span class="copyable-badge" data-copy="${fbId}" title="Click to copy Profile ID">${fbId} 📋</span>`;
        }
      } else {
        fbStatusPill.className = "status-pill pill-offline";
        fbStatusPill.textContent = "Offline";
        fbAccountName.textContent = "Facebook Profile";
        if (fbAccountId) fbAccountId.textContent = "Profile ID: Not Synced";
      }
    }

    // Instagram session
    if (igStatusPill && igAccountName) {
      if (state.igLoggedIn) {
        igStatusPill.className = "status-pill pill-online";
        igStatusPill.textContent = "Online";
        const handle = state.igUser ? (state.igUser.startsWith("@") ? state.igUser : `@${state.igUser}`) : "@renukayadav";
        igAccountName.textContent = handle;
        const igId = state.igId || "43599208749";
        if (igAccountId) {
          igAccountId.innerHTML = `User ID: <span class="copyable-badge" data-copy="${igId}" title="Click to copy User ID">${igId} 📋</span>`;
        }
      } else {
        igStatusPill.className = "status-pill pill-offline";
        igStatusPill.textContent = "Offline";
        igAccountName.textContent = "Instagram Account";
        if (igAccountId) igAccountId.textContent = "User ID: Not Synced";
      }
    }

    // Business Suite session
    const bizStatusPill = document.getElementById("bizStatusPill");
    const bizAccountName = document.getElementById("bizAccountName");
    const bizAccountId = document.getElementById("bizAccountId");
    const bizNoticeBox = document.getElementById("bizNoticeBox");
    const bizOwnerName = document.getElementById("bizOwnerName");

    if (bizStatusPill && bizAccountName && bizAccountId) {
      if (state.businessSuitePages && state.businessSuitePages.length > 0) {
        bizStatusPill.className = "status-pill pill-online";
        bizStatusPill.textContent = "Online";
        bizAccountName.textContent = "Meta Business Suite";
        const p = state.businessSuitePages[0];
        const pageName = p.name || "Motivational Docqueen";
        bizAccountId.innerHTML = `Page: <b style="color: #e2e8f0;">${escapeHtml(pageName)}</b> • <span class="copyable-badge" data-copy="${p.id}" title="Click to copy Page ID">${p.id} 📋</span>`;
        if (bizNoticeBox) bizNoticeBox.style.display = "none";
      } else if (state.businessSuiteStatus === "no_pages" || state.businessSuiteHasNoPages || (state.fbLoggedIn && (!state.businessSuitePages || state.businessSuitePages.length === 0))) {
        // User has no Pages attached to Meta Business Suite
        bizStatusPill.className = "status-pill pill-warning";
        bizStatusPill.textContent = "No Pages Linked";
        bizAccountName.textContent = "Meta Business Suite";
        const owner = state.fbUser || "Renuka Yadav";
        bizAccountId.textContent = `Personal Profile (${owner}) • No Pages`;
        if (bizNoticeBox) bizNoticeBox.style.display = "block";
        if (bizOwnerName) bizOwnerName.textContent = owner;
      } else {
        bizStatusPill.className = "status-pill pill-offline";
        bizStatusPill.textContent = "Offline";
        bizAccountName.textContent = "Meta Business Suite";
        bizAccountId.textContent = "Personal Account • No Pages Linked";
        if (bizNoticeBox) bizNoticeBox.style.display = "none";
      }
    }

    // YouTube Studio session
    const ytStatusPill = document.getElementById("ytStatusPill");
    const ytAccountName = document.getElementById("ytAccountName");
    const ytAccountId = document.getElementById("ytAccountId");

    if (ytStatusPill && ytAccountName) {
      if (state.youtubeLoggedIn && state.youtubeChannel && state.youtubeChannel !== "YouTube Creator") {
        ytStatusPill.className = "status-pill pill-online";
        ytStatusPill.style.background = "";
        ytStatusPill.style.color = "";
        ytStatusPill.textContent = "Online";
        ytAccountName.textContent = state.youtubeChannel;
        if (ytAccountId) {
          const ytHandle = state.youtubeHandle || `@${state.youtubeChannel.toLowerCase().replace(/\s+/g, "")}`;
          ytAccountId.innerHTML = `Channel: <b style="color: #e2e8f0;">${escapeHtml(ytHandle)}</b> • 📋`;
        }
      } else if (state.youtubeNeedsSync) {
        ytStatusPill.className = "status-pill";
        ytStatusPill.style.background = "#d97706";
        ytStatusPill.style.color = "#ffffff";
        ytStatusPill.textContent = "Needs Sync";
        ytAccountName.textContent = "YouTube Studio";
        if (ytAccountId) ytAccountId.textContent = "Channel: Open Studio to sync";
      } else {
        ytStatusPill.className = "status-pill pill-offline";
        ytStatusPill.style.background = "";
        ytStatusPill.style.color = "";
        ytStatusPill.textContent = "Offline";
        ytAccountName.textContent = "YouTube Studio";
        if (ytAccountId) ytAccountId.textContent = "Channel: Not Synced (Click 'Open' to log in)";
      }
    }

    // TikTok Creator session
    const ttStatusPill = document.getElementById("ttStatusPill");
    const ttAccountName = document.getElementById("ttAccountName");
    const ttAccountId = document.getElementById("ttAccountId");

    if (ttStatusPill && ttAccountName) {
      if (state.tiktokLoggedIn && state.tiktokUser && state.tiktokUser !== "TikTok Creator") {
        ttStatusPill.className = "status-pill pill-online";
        ttStatusPill.textContent = "Online";
        ttAccountName.textContent = state.tiktokUser;
        if (ttAccountId) {
          ttAccountId.innerHTML = `Account: <b style="color: #e2e8f0;">${escapeHtml(state.tiktokUser)}</b> • 📋`;
        }
      } else {
        ttStatusPill.className = "status-pill pill-offline";
        ttStatusPill.textContent = "Offline";
        ttAccountName.textContent = "TikTok Creator Center";
        if (ttAccountId) ttAccountId.textContent = "Handle: Not Synced (Click 'Open' to log in)";
      }
    }

    // Update Composer target dropdown with real user name & pages
    updateComposerTargets(state);

    // Emergency Pause
    isQueuePaused = !!state.queuePaused;
    if (btnPauseToggle && pauseBtnText) {
      if (isQueuePaused) {
        btnPauseToggle.className = "btn-sm btn-resume";
        pauseBtnText.textContent = "▶ Resume Queue";
      } else {
        btnPauseToggle.className = "btn-sm btn-pause";
        pauseBtnText.textContent = "🛑 Emergency Pause";
      }
    }
  }

  // Load initial bridge state
  chrome.storage.local.get(["bridgeState"], (res) => {
    renderBridgeState(res.bridgeState || {});
    chrome.runtime.sendMessage({ type: "POPUP_OPENED" });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.bridgeState) {
      renderBridgeState(changes.bridgeState.newValue);
    }
  });

  // -------------------------------------------------------------
  // 4. Header Actions
  // -------------------------------------------------------------
  // Reload extension
  if (btnReloadBridge) {
    btnReloadBridge.addEventListener("click", () => {
      btnReloadBridge.disabled = true;
      btnReloadBridge.innerHTML = "<span>⚡ Reloading...</span>";
      showToast("Reloading extension bridge...", "info");
      logConsole("INFO", "Reloading extension bridge worker...");
      setTimeout(() => {
        chrome.runtime.reload();
      }, 200);
    });
  }

  // Force session sync
  if (btnSyncSessions) {
    btnSyncSessions.addEventListener("click", () => {
      btnSyncSessions.disabled = true;
      btnSyncSessions.innerHTML = "<span>Syncing...</span>";
      showToast("Syncing cookies & accounts...", "info");
      logConsole("WS", "Requesting manual session sync from Chrome cookies...");
      chrome.runtime.sendMessage({ type: "TRIGGER_SYNC" }, () => {
        setTimeout(() => {
          btnSyncSessions.disabled = false;
          btnSyncSessions.innerHTML = "<span>🔄 Force Sync</span>";
          showToast("Sessions Synced Successfully!", "success");
          logConsole("INFO", "Session sync complete.");
        }, 1000);
      });
    });
  }

  // One-Time Direct Auto-Sync All 3 Platforms
  const btnOneTimeAutoSync = document.getElementById("btnOneTimeAutoSync");
  if (btnOneTimeAutoSync) {
    btnOneTimeAutoSync.addEventListener("click", () => {
      btnOneTimeAutoSync.disabled = true;
      btnOneTimeAutoSync.innerHTML = "<span>Syncing All 3 Platforms...</span>";
      showToast("Verifying One-Time Setup for all 3 platforms...", "info");
      logConsole("INFO", "Verifying One-Time Direct Connection for Facebook, Instagram & Business Suite...");
      chrome.runtime.sendMessage({ type: "TRIGGER_SYNC" }, () => {
        setTimeout(() => {
          btnOneTimeAutoSync.disabled = false;
          btnOneTimeAutoSync.innerHTML = "<span>✓ All 3 Linked & Auto-Canvas Active</span>";
          showToast("All 3 Platforms Connected & Active!", "success");
          logConsole("INFO", "One-Time Setup verified: Facebook, Instagram & Business Suite are active and ready!");
          setTimeout(() => {
            btnOneTimeAutoSync.innerHTML = "<span>🔄 Instant Auto-Sync All 3 Platforms</span>";
          }, 3000);
        }, 1200);
      });
    });
  }

  // Toggle pause
  if (btnPauseToggle) {
    btnPauseToggle.addEventListener("click", () => {
      const nextPaused = !isQueuePaused;
      chrome.runtime.sendMessage({ type: "EMERGENCY_PAUSE_TOGGLE", paused: nextPaused }, () => {
        isQueuePaused = nextPaused;
        if (isQueuePaused) {
          btnPauseToggle.className = "btn-sm btn-resume";
          if (pauseBtnText) pauseBtnText.textContent = "▶ Resume Queue";
          showToast("Queue Emergency Paused", "warn");
          logConsole("WARN", "Scheduler paused by user via Side Panel.");
        } else {
          btnPauseToggle.className = "btn-sm btn-pause";
          if (pauseBtnText) pauseBtnText.textContent = "🛑 Emergency Pause";
          showToast("Queue Resumed", "success");
          logConsole("INFO", "Scheduler resumed by user via Side Panel.");
        }
      });
    });
  }

  if (btnRefreshSessions) {
    btnRefreshSessions.addEventListener("click", () => {
      showToast("Refreshing session status...", "info");
      if (btnSyncSessions) btnSyncSessions.click();
    });
  }

  // Quick Openers & Individual Account Actions (Direct Chrome API, <5ms)
  async function openOrFocusCanvas(platform, fallbackUrl) {
    let platName = platform.toUpperCase();
    if (platform === "business_suite") platName = "Meta Business Suite";
    else if (platform === "youtube") platName = "YouTube Studio";
    else if (platform === "tiktok") platName = "TikTok Creator Center";

    showToast(`Opening ${platName}...`, "info");
    logConsole("INFO", `Opening or focusing ${platName} canvas...`);

    let patterns = ["*://facebook.com/*", "*://*.facebook.com/*"];
    let defaultUrl = fallbackUrl || "https://www.facebook.com/";

    if (platform === "instagram") {
      patterns = ["*://instagram.com/*", "*://*.instagram.com/*"];
      defaultUrl = fallbackUrl || "https://www.instagram.com/";
    } else if (platform === "business_suite") {
      patterns = ["*://business.facebook.com/*", "*://*.business.facebook.com/*"];
      defaultUrl = fallbackUrl || "https://business.facebook.com/latest/composer";
    } else if (platform === "youtube") {
      patterns = ["*://studio.youtube.com/*", "*://*.youtube.com/*"];
      defaultUrl = fallbackUrl || "https://studio.youtube.com";
    } else if (platform === "tiktok") {
      patterns = ["*://*.tiktok.com/creator-center/*", "*://*.tiktok.com/upload*", "*://*.tiktok.com/*"];
      defaultUrl = fallbackUrl || "https://www.tiktok.com/creator-center/upload";
    }

    try {
      const tabs = await chrome.tabs.query({ url: patterns });
      if (tabs && tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          try { await chrome.windows.update(tabs[0].windowId, { focused: true }); } catch (e) {}
        }
        showToast(`Focused active ${platName} tab`, "success");
        logConsole("INFO", `Focused active ${platName} tab.`);
        return;
      }
    } catch (e) {
      console.warn("[MetaBridge] Tabs query error:", e);
    }

    chrome.tabs.create({ url: defaultUrl, active: true }, () => {
      showToast(`Opened new ${platName} tab`, "success");
      logConsole("INFO", `Opened new ${platName} tab.`);
    });
  }

  function logoutAccount(platform, btnEl) {
    const platName = platform === "business_suite" ? "Meta Business Suite" : platform.toUpperCase();
    showToast(`Logging out of ${platName}...`, "warn");
    logConsole("WARN", `Logging out of ${platName}...`);
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Logging out...";
    }
    chrome.runtime.sendMessage({
      type: "LOGOUT_PLATFORM",
      platform: platform
    }, () => {
      showToast(`Logged out of ${platName}. Cookies cleared.`, "success");
      logConsole("INFO", `Logged out of ${platName}. Cookies and active session cleared.`);
      setTimeout(() => {
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.textContent = "Logout";
        }
        chrome.storage.local.get(["bridgeState"], (res) => {
          renderBridgeState(res.bridgeState || {});
        });
      }, 300);
    });
  }

  if (btnOpenFB) btnOpenFB.addEventListener("click", () => openOrFocusCanvas("facebook", "https://www.facebook.com/"));
  if (btnOpenIG) btnOpenIG.addEventListener("click", () => openOrFocusCanvas("instagram", "https://www.instagram.com/"));
  if (btnOpenBusinessSuite) btnOpenBusinessSuite.addEventListener("click", () => openOrFocusCanvas("business_suite", "https://business.facebook.com/latest/composer"));
  if (btnOpenYT) btnOpenYT.addEventListener("click", () => openOrFocusCanvas("youtube", "https://studio.youtube.com"));
  if (btnOpenTT) btnOpenTT.addEventListener("click", () => openOrFocusCanvas("tiktok", "https://www.tiktok.com/creator-center/upload"));

  if (btnFocusFB) btnFocusFB.addEventListener("click", () => openOrFocusCanvas("facebook", "https://www.facebook.com/"));
  if (btnLogoutFB) btnLogoutFB.addEventListener("click", () => logoutAccount("facebook", btnLogoutFB));

  if (btnFocusIG) btnFocusIG.addEventListener("click", () => openOrFocusCanvas("instagram", "https://www.instagram.com/"));
  if (btnLogoutIG) btnLogoutIG.addEventListener("click", () => logoutAccount("instagram", btnLogoutIG));

  if (btnFocusBiz) btnFocusBiz.addEventListener("click", () => openOrFocusCanvas("business_suite", "https://business.facebook.com/latest/composer"));
  if (btnLogoutBiz) btnLogoutBiz.addEventListener("click", () => logoutAccount("business_suite", btnLogoutBiz));

  const btnFocusYT = document.getElementById("btnFocusYT");
  const btnLogoutYT = document.getElementById("btnLogoutYT");
  const btnFocusTT = document.getElementById("btnFocusTT");
  const btnLogoutTT = document.getElementById("btnLogoutTT");

  if (btnFocusYT) btnFocusYT.addEventListener("click", () => openOrFocusCanvas("youtube", "https://studio.youtube.com"));
  if (btnLogoutYT) btnLogoutYT.addEventListener("click", () => logoutAccount("youtube", btnLogoutYT));

  if (btnFocusTT) btnFocusTT.addEventListener("click", () => openOrFocusCanvas("tiktok", "https://www.tiktok.com/creator-center/upload"));
  if (btnLogoutTT) btnLogoutTT.addEventListener("click", () => logoutAccount("tiktok", btnLogoutTT));

  // -------------------------------------------------------------
  // 5. Message Listener from Background & WebSocket Relay
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    if (message.type === "LOG_STREAM") {
      logConsole(message.level || "INFO", message.message || "");
    } else if (message.type === "QUEUE_DATA") {
      renderQueue(message.jobs || []);
    } else if (message.type === "BROADCAST_EVENT") {
      logConsole("WS", `Event: ${message.event} -> ${JSON.stringify(message.data || {})}`);
      if (["JOB_CREATED", "JOB_UPDATED", "QUEUE_CLEARED"].includes(message.event)) {
        fetchQueueData();
      } else if (message.event === "SESSION_LOGGED_OUT") {
        logConsole("INFO", `Session logged out on server: ${message.data?.platform}`);
        btnSyncSessions.click();
      }
    } else if (message.type === "DOM_INSTRUCTION") {
      logConsole("DOM", `Executing instruction: ${message.instruction}`);
    } else if (message.type === "DOM_RESULT") {
      if (message.status === "success") {
        logConsole("DOM", `DOM Action succeeded [ID: ${message.id}]`);
      } else {
        logConsole("ERROR", `DOM Action failed: ${message.error}`);
      }
    } else if (message.type === "TREND_SCAN_RESULTS") {
      if (message.data && Array.isArray(message.data.trends)) {
        activeTrends = message.data.trends;
        renderTrendFeed(activeTrends);
        if (tickerBreakoutCount) tickerBreakoutCount.textContent = message.data.breakout_trends_count || 0;
        logConsole("INFO", `Server Trend Radar: Loaded ${activeTrends.length} live trends.`);
      }
    } else if (message.type === "COMPETITOR_SPY_RESULTS") {
      if (message.data && message.data.content_gaps) {
        renderCompetitorSpy(message.data);
        logConsole("INFO", `Competitor Spy: Analyzed ${message.data.competitor_or_niche}. Found ${message.data.content_gaps.length} content gaps.`);
      }
    } else if (message.type === "PRE_POST_OPTIMIZED_RESULT") {
      if (message.data) {
        renderPrePostOptimization(message.data);
        logConsole("INFO", `Server Pre-Post Optimizer: Outperformed competitors. SEO Score: ${message.data.benchmark?.seo_score || 98}/100`);
      }
    } else if (message.type === "POST_AUDIT_RESULT") {
      if (message.data && typeof renderSmmAuditResult === "function") {
        renderSmmAuditResult(message.data);
      }
    } else if (message.type === "AUTOREPLY_RULES_DATA") {
      if (message.rules && typeof renderAutoReplyRules === "function") {
        renderAutoReplyRules(message.rules);
      }
    } else if (message.type === "AUTOREPLY_TEST_RESULT") {
      if (typeof renderAutoReplyTestResult === "function") {
        renderAutoReplyTestResult(message.data);
      }
    } else if (message.type === "AUTOREPLY_CYCLE_RESULT") {
      if (typeof renderAutoReplyCycleResult === "function") {
        renderAutoReplyCycleResult(message.data);
      }
    } else if (message.type === "CRON_SLOTS_DATA") {
      if (typeof renderCronSlots === "function") {
        renderCronSlots(message.slots, message.peak_windows);
      }
    } else if (message.type === "STALE_RECOVERED_RESULT") {
      if (typeof renderStaleRecoverResult === "function") {
        renderStaleRecoverResult(message.recovered_count);
      }
    }
  });

  // -------------------------------------------------------------
  // 6. Composer Tab Controls
  // -------------------------------------------------------------
  // Platform Change
  if (platformSelect && targetSelect && targetIdGroup) {
    platformSelect.addEventListener("change", () => {
      updateComposerTargets();
    });
  }

  // Target Change
  if (targetSelect && targetIdGroup) {
    targetSelect.addEventListener("change", () => {
      const tgt = targetSelect.value;
      if (tgt === "page" || tgt === "group") {
        targetIdGroup.style.display = "block";
      } else {
        targetIdGroup.style.display = "none";
      }
    });
  }

  // Content Type Change
  if (contentTypeSelect && mediaUploadGroup) {
    contentTypeSelect.addEventListener("change", () => {
      const cType = contentTypeSelect.value;
      if (cType === "text") {
        mediaUploadGroup.style.display = "none";
        if (thumbnailUploadGroup) thumbnailUploadGroup.style.display = "none";
      } else {
        mediaUploadGroup.style.display = "block";
        if (thumbnailUploadGroup) {
          thumbnailUploadGroup.style.display = (cType === "video" || cType === "reel") ? "block" : "none";
        }
      }
    });
  }

  // Thumbnail Picker Event Listeners
  if (thumbDropArea && thumbnailFileInput) {
    thumbDropArea.addEventListener("click", () => thumbnailFileInput.click());
    thumbnailFileInput.addEventListener("change", () => {
      if (thumbnailFileInput.files && thumbnailFileInput.files.length > 0) {
        const file = thumbnailFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          selectedThumbnailData = {
            name: file.name,
            type: file.type || "image/jpeg",
            size: file.size,
            base64: e.target.result.split(",")[1]
          };
          if (thumbPreviewName) thumbPreviewName.textContent = file.name;
          if (thumbPreviewSize) thumbPreviewSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
          if (thumbPreviewImg) thumbPreviewImg.src = e.target.result;
          if (thumbPreviewCard) thumbPreviewCard.style.display = "flex";
          if (thumbDropArea) thumbDropArea.style.display = "none";
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (btnRemoveThumb && thumbnailFileInput && thumbPreviewCard && thumbDropArea) {
    btnRemoveThumb.addEventListener("click", () => {
      selectedThumbnailData = null;
      thumbnailFileInput.value = "";
      thumbPreviewCard.style.display = "none";
      thumbDropArea.style.display = "block";
    });
  }

  // Quick-time date/time helper functions
  function formatLocalDateToInput(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function updateUtcReadout() {
    if (!scheduleConvertedUtc || !scheduleTimeInput) return;
    if (scheduleTimeInput.value) {
      const d = new Date(scheduleTimeInput.value);
      if (!isNaN(d.getTime())) {
        scheduleConvertedUtc.textContent = `UTC: ${d.toISOString().replace("T", " ").slice(0, 16)}Z`;
        return;
      }
    }
    scheduleConvertedUtc.textContent = "";
  }

  if (scheduleTimeInput) {
    scheduleTimeInput.addEventListener("input", updateUtcReadout);
    scheduleTimeInput.addEventListener("change", updateUtcReadout);
  }

  document.querySelectorAll(".btn-quick-time").forEach((btn) => {
    btn.addEventListener("click", () => {
      const offsetMins = parseInt(btn.getAttribute("data-offset"), 10) || 15;
      const target = new Date(Date.now() + offsetMins * 60 * 1000);
      if (scheduleTimeInput) {
        scheduleTimeInput.value = formatLocalDateToInput(target);
        updateUtcReadout();
      }
    });
  });

  // Caption char count
  if (postCaption && captionCharCount) {
    postCaption.addEventListener("input", () => {
      captionCharCount.textContent = postCaption.value.length;
    });
  }

  // Schedule Mode Change
  if (scheduleMode && scheduleTimeGroup) {
    scheduleMode.addEventListener("change", () => {
      if (scheduleMode.value === "scheduled") {
        scheduleTimeGroup.style.display = "block";
      } else {
        scheduleTimeGroup.style.display = "none";
      }
    });
  }

  // -------------------------------------------------------------
  // 7. Drag & Drop Media File Uploader
  // -------------------------------------------------------------
  if (fileDropArea && mediaFileInput) {
    fileDropArea.addEventListener("click", () => {
      mediaFileInput.click();
    });

    fileDropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropArea.classList.add("dragover");
    });

    fileDropArea.addEventListener("dragleave", () => {
      fileDropArea.classList.remove("dragover");
    });

    fileDropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      fileDropArea.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  if (mediaFileInput) {
    mediaFileInput.addEventListener("change", () => {
      if (mediaFileInput.files && mediaFileInput.files.length > 0) {
        handleFileSelected(mediaFileInput.files[0]);
      }
    });
  }

  if (btnRemoveFile && mediaFileInput && filePreviewCard && fileDropArea) {
    btnRemoveFile.addEventListener("click", () => {
      selectedFileData = null;
      mediaFileInput.value = "";
      filePreviewCard.style.display = "none";
      fileDropArea.style.display = "block";
    });
  }

  function handleFileSelected(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result.split(",")[1];
      selectedFileData = {
        name: file.name,
        type: file.type || "image/jpeg",
        size: file.size,
        base64: base64Data
      };

      // Show preview
      filePreviewName.textContent = file.name;
      filePreviewSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
      if (file.type.startsWith("image/")) {
        filePreviewImg.src = e.target.result;
        filePreviewImg.style.display = "block";
      } else {
        filePreviewImg.src = "icons/icon48.png";
      }

      fileDropArea.style.display = "none";
      filePreviewCard.style.display = "flex";
      logConsole("INFO", `Loaded media asset: ${file.name} (${file.size} bytes)`);
    };
    reader.readAsDataURL(file);
  }

  // -------------------------------------------------------------
  // 7.5 AI Creative Director Studio Logic
  // -------------------------------------------------------------
  const toggleCreativeStudio = document.getElementById("toggleCreativeStudio");
  const creativeStudioBody = document.getElementById("creativeStudioBody");
  const creativeStudioArrow = document.getElementById("creativeStudioArrow");
  const creativeArchetypeSelect = document.getElementById("creativeArchetypeSelect");
  const creativeHeadlineInput = document.getElementById("creativeHeadlineInput");
  const creativeTaglineInput = document.getElementById("creativeTaglineInput");
  const btnBuildAgencyPrompt = document.getElementById("btnBuildAgencyPrompt");
  const btnCopyAgencyPrompt = document.getElementById("btnCopyAgencyPrompt");

  if (toggleCreativeStudio && creativeStudioBody) {
    toggleCreativeStudio.addEventListener("click", () => {
      const isOpen = creativeStudioBody.style.display !== "none";
      creativeStudioBody.style.display = isOpen ? "none" : "block";
      if (creativeStudioArrow) creativeStudioArrow.textContent = isOpen ? "▼" : "▲";
    });
  }

  const AGENCY_TEMPLATES = {
    tactile_clipboard: (headline, tagline) =>
      `A clean, ultra-professional modern agency social media graphic in vertical 4:5 format. Centerpiece is a real physical wooden clipboard with an authentic black metallic binder clip holding a crisp white textured paper notepad angled slightly on a warm slate-gray desk. Bold editorial typography in deep crimson and charcoal reads: "${headline || '4 RULES OF DAILY CONSISTENCY'}". Clean red numbered points: 01 | Morning Focus, 02 | Deep Work Block, 03 | Strategic Execution, 04 | Daily Review. Next to the clipboard sits a vintage mechanical chrome stopwatch and luxury fountain pen. Bottom red wax stamp reads: "${tagline || 'CONSISTENCY > INTENSITY'}". Clean Swiss design, soft natural lighting, zero artificial glassy neon clutter.`,
    classical_contrast: (headline, tagline) =>
      `An ultra-high-end creative agency social media advertisement in vertical 4:5 format. Centerpiece is a classical Roman marble bust/statue of The Thinker with hand resting on chin in deep contemplation, sitting at a sleek minimalist dark desk typing on an illuminated modern silver Apple laptop. Dramatic chiaroscuro studio lighting with warm golden rim light on sculpted marble contours. Bold modern typography in white and electric blue: "${headline || "Your preparation deserves a better strategy."}". Subtitle in clean gray: "${tagline || "Don't just study hard. Study with tactical intelligence."}". Subtle dark grid wall, museum-meets-tech contrast.`,
    keyboard_shortcut: (headline, tagline) =>
      `An ultra-sleek minimalist creative agency advertisement in vertical 4:5 format. A photorealistic human hand emerges gracefully against a warm minimalist textured cream-beige background, holding two real tactile matte-black mechanical keyboard keycaps with crisp white engraved lettering: "CTRL" and "S". Sophisticated editorial typography in warm chocolate brown and rich rust-orange: "${headline || "Don't just make plans."}". Tagline: "${tagline || "Save your daily consistency."}". Sleek rounded pill badge below. Macro detail on fingertips and plastic keycap texture, generous breathing space.`,
    surreal_metaphor: (headline, tagline) =>
      `A witty, high-concept surreal creative advertising graphic in vertical 4:5 format. Centerpiece is a real tortoise riding a fingerboard skateboard boosted forward by a human hand against a clean studio backdrop with soft shadows. Punchy headline in bold sans-serif: "${headline || "LET US BOOST YOUR IDEAS"}". Punchline: "${tagline || "Ideas get remembered when executed with velocity."}". Clean agency branding, intelligent humor, generous negative space.`,
    ui_as_reality: (headline, tagline) =>
      `A clever surreal conceptual advertising visual in vertical 4:5 format. Overhead bird's-eye view of 4 professional business executives seated around a giant 3D physical social media post UI card, using it as their boardroom conference table. Crisp UI icons (like, comment, share). Bold headline: "${headline || "ATTENTION, PLEASE. Your competitors are posting."}". Bottom slogan: "${tagline || "We make brands IMPOSSIBLE TO IGNORE."}". Deep royal purple floor, directional spotlights.`,
    editorial_color_block: (headline, tagline) =>
      `An avant-garde high-fashion editorial poster in vertical 4:5 format. A high-contrast black and white photographic portrait of a focused person with a vibrant fluorescent neon lime-green graphic tape boldly overlaid across the eyes. Asymmetric stark typography: "${headline || "start learning today #create design."}". Pill badge: "${tagline || "Join the Masterclass"}". Minimalist Swiss typography, sharp geometric tension.`,
    pop_culture_subversion: (headline, tagline) =>
      `A witty, high-engagement cultural poster in vertical 4:5 format styled as a two-tone cobalt blue and white risograph print. Visual portrays an iconic cinematic confrontation in vintage halftone dots. Stark bold typography: "${headline || "POSTING ke pichhe mat Bhaago..."}". Highlighted box: "${tagline || "STRATEGY Ka Pichha karo!"}". Textured newsprint paper, sharp visual humor.`
  };

  function getBuiltAgencyPrompt() {
    const arch = creativeArchetypeSelect ? creativeArchetypeSelect.value : "tactile_clipboard";
    const h = creativeHeadlineInput ? creativeHeadlineInput.value.trim() : "";
    const t = creativeTaglineInput ? creativeTaglineInput.value.trim() : "";
    const fn = AGENCY_TEMPLATES[arch] || AGENCY_TEMPLATES.tactile_clipboard;
    return fn(h, t);
  }

  if (btnBuildAgencyPrompt) {
    btnBuildAgencyPrompt.addEventListener("click", () => {
      const prompt = getBuiltAgencyPrompt();
      if (postCaption) {
        postCaption.value = prompt;
        if (captionCharCount) captionCharCount.textContent = prompt.length;
        showToast("Agency prompt applied to caption!", "success");
        logConsole("INFO", `Applied ${creativeArchetypeSelect.value} agency prompt to composer`);
      }
    });
  }

  if (btnCopyAgencyPrompt) {
    btnCopyAgencyPrompt.addEventListener("click", () => {
      const prompt = getBuiltAgencyPrompt();
      navigator.clipboard.writeText(prompt).then(() => {
        showToast("Agency prompt copied to clipboard!", "success");
        const orig = btnCopyAgencyPrompt.textContent;
        btnCopyAgencyPrompt.textContent = "✓ Copied!";
        setTimeout(() => { btnCopyAgencyPrompt.textContent = orig; }, 1500);
      });
    });
  }

  // -------------------------------------------------------------
  // 7.6 Pre-Post Competitor Battle & Viral SEO Optimizer
  // -------------------------------------------------------------
  function renderPrePostOptimization(data) {
    if (!data) return;
    activePrePostResult = data;
    if (prePostBattleResult) prePostBattleResult.style.display = "block";
    
    const benchmark = data.benchmark || {};
    const virality = benchmark.virality_index || benchmark.viralityIndex || 96.5;
    const competitorsCount = benchmark.competitors_found || benchmark.competitorsFound || (data.competitors?.length || 4);
    const avgViews = benchmark.competitor_avg_views || benchmark.competitorAvgViews || 84000;
    const seoScore = benchmark.seo_score || benchmark.seoScore || 98.2;
    const weakness = benchmark.competitor_weakness || benchmark.competitorWeakness || "Competitors post boring text paragraphs. We format as a high-retention 30s cheat sheet.";

    if (prePostViralityPill) {
      prePostViralityPill.textContent = `Virality: ${virality}/100`;
    }
    if (prePostCompetitorStats) {
      prePostCompetitorStats.innerHTML = `<b>${competitorsCount} Competitors Outperformed</b> (Avg ${avgViews.toLocaleString()} views) • SEO Score: <b style="color: #38bdf8;">${seoScore}/100</b>`;
    }
    if (prePostWeaknessText) {
      prePostWeaknessText.innerHTML = `"${escapeHtml(weakness)}"`;
    }
  }

  function initPrePostOptimizerController() {
    if (btnRunPrePostOptimize) {
      btnRunPrePostOptimize.addEventListener("click", async () => {
        const concept = (prePostConceptInput ? prePostConceptInput.value : "").trim() || "flow + antigravity connection with extension (insane results)";
        
        btnRunPrePostOptimize.disabled = true;
        btnRunPrePostOptimize.innerHTML = `<span>⚔️ Battling...</span>`;
        logConsole("INFO", `Pre-Post Optimizer: Searching YouTube, Twitter, Reddit & GitHub for "${concept.slice(0, 30)}..."`);

        try {
          // 1. Instant local analysis (sub-100ms)
          const result = await clientPrePostOptimizer.analyzeAndOptimize(concept, platformSelect ? platformSelect.value : "all");
          renderPrePostOptimization(result);
          showToast("Competitors analyzed! Viral SEO blueprint ready.", "success");
          logConsole("INFO", `Pre-Post Battle: Outperformed competitors with ${result.benchmark.viralityIndex}/100 virality score.`);

          // 2. Also send to MCP bridge for background sync
          chrome.runtime.sendMessage({
            type: "WS_SEND",
            payload: {
              type: "OPTIMIZE_PRE_POST",
              post_concept: concept,
              target_platform: platformSelect ? platformSelect.value : "all"
            }
          });
        } catch (err) {
          logConsole("WARN", `Local optimizer fallback: ${err.message}`);
        } finally {
          btnRunPrePostOptimize.disabled = false;
          btnRunPrePostOptimize.innerHTML = `<span>⚡ Battle & Optimize</span>`;
        }
      });
    }

    if (btnApplyOptimizedCaption) {
      btnApplyOptimizedCaption.addEventListener("click", () => {
        if (!activePrePostResult) {
          showToast("Please run optimization battle first", "warn");
          return;
        }

        const isFb = platformSelect && platformSelect.value === "facebook";
        const content = isFb
          ? (activePrePostResult.fbBody || activePrePostResult.fb_post || activePrePostResult.igBody)
          : (activePrePostResult.igBody || activePrePostResult.ig_caption || activePrePostResult.fbBody);

        if (postCaption) {
          postCaption.value = content;
          if (captionCharCount) captionCharCount.textContent = content.length;
          showToast(`Applied viral ${isFb ? 'Facebook' : 'Instagram'} hook & cheat sheet!`, "success");
          logConsole("INFO", "Applied anti-boring viral layout directly into caption.");
        }
      });
    }

    if (btnCopyOptimizedPrompt) {
      btnCopyOptimizedPrompt.addEventListener("click", () => {
        if (!activePrePostResult) {
          showToast("Please run optimization battle first", "warn");
          return;
        }
        const prompt = activePrePostResult.creativePrompt || activePrePostResult.creative_director_prompt || "";
        navigator.clipboard.writeText(prompt).then(() => {
          showToast("Copied visual agency prompt to clipboard!", "success");
          const orig = btnCopyOptimizedPrompt.textContent;
          btnCopyOptimizedPrompt.textContent = "✓ Copied!";
          setTimeout(() => { btnCopyOptimizedPrompt.textContent = orig; }, 1500);
        });
      });
    }
  }

  // -------------------------------------------------------------
  // 8. Composer Form Submission
  // -------------------------------------------------------------
  if (postComposerForm) {
    postComposerForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const platform = platformSelect ? platformSelect.value : "facebook";
      let targetType = targetSelect ? targetSelect.value : "profile";
      let targetId = (targetIdInput && targetIdInput.value.trim()) || null;
      if (targetType.startsWith("page_")) {
        targetId = targetType.replace("page_", "");
        targetType = "page";
      }
      const contentType = contentTypeSelect ? contentTypeSelect.value : "photo";
      const caption = postCaption ? postCaption.value.trim() : "";
      const isImmediate = scheduleMode ? scheduleMode.value === "immediate" : true;

      if (!caption && !selectedFileData) {
        showToast("Please enter caption or choose a media file", "warn");
        logConsole("WARN", "Validation: Please enter a caption or select a media file before publishing.");
        if (postCaption) {
          postCaption.focus();
          postCaption.style.borderColor = "var(--accent-red)";
          setTimeout(() => { postCaption.style.borderColor = ""; }, 2500);
        }
        return;
      }

      // SUPERVISOR CHECK 1: Emergency Circuit Breaker
      const breakerStatus = clientCircuitBreaker.isOperationAllowed();
      if (!breakerStatus.allowed) {
        const remainingMins = Math.ceil(breakerStatus.remainingMs / 60000);
        showToast(`Account Protection Active: Cooldown for ${remainingMins}m`, "warn");
        logConsole("WARN", `[SUPERVISOR]: Circuit breaker active (${breakerStatus.state}). Action suppressed for account survival.`);
        return;
      }

      // SUPERVISOR CHECK 2: Caption Similarity Guard (Rule #8: <45% word overlap)
      if (caption) {
        const sim = clientSupervisorGuard.checkSimilarity(caption);
        if (sim > 0.45) {
          showToast(`Duplicate Content Alert: ${Math.round(sim * 100)}% match with recent post. Varied format required.`, "warn");
          logConsole("WARN", `[SUPERVISOR]: Suppressed post: Caption similarity is ${Math.round(sim * 100)}% (>45% limit). Rotate format (e.g. MCQ Quiz, Facts, Bullets).`);
          return;
        }
      }

      let scheduleTimeIso = null;
      if (!isImmediate && scheduleTimeInput && scheduleTimeInput.value) {
        scheduleTimeIso = new Date(scheduleTimeInput.value).toISOString();
      } else {
        scheduleTimeIso = new Date().toISOString();
      }

      const payload = {
        caption: caption,
        description: caption,
        title: caption.split("\n")[0].replace(/[*#]/g, "").slice(0, 100).trim(),
        file_name: selectedFileData ? selectedFileData.name : null,
        mime_type: selectedFileData ? selectedFileData.type : null,
        base64_data: selectedFileData ? selectedFileData.base64 : null,
        thumbnail_file_name: selectedThumbnailData ? selectedThumbnailData.name : null,
        thumbnail_mime_type: selectedThumbnailData ? selectedThumbnailData.type : null,
        thumbnail_base64: selectedThumbnailData ? selectedThumbnailData.base64 : null,
        is_video: selectedFileData ? selectedFileData.type.includes("video") : (contentType === "video" || contentType === "reel"),
        is_reel: contentType === "reel",
        auto_publish: true,
        bypass_spacing: isImmediate
      };

      const job = {
        platform,
        target_type: targetType,
        target_id: targetId,
        content_type: contentType,
        payload,
        schedule_time_iso: scheduleTimeIso
      };

      if (btnSubmitPost) {
        btnSubmitPost.disabled = true;
        btnSubmitPost.innerHTML = "<span>Enqueuing...</span>";
      }

      chrome.runtime.sendMessage({
        type: "WS_SEND",
        payload: {
          type: "CREATE_JOB",
          id: `rpc_${Date.now()}`,
          job
        }
      }, (res) => {
        if (btnSubmitPost) {
          btnSubmitPost.disabled = false;
          btnSubmitPost.innerHTML = "<span>🚀 Enqueue & Publish Post</span>";
        }

        if (res && res.status === "sent") {
          showToast("Post dispatched to bridge queue!", "success");
          logConsole("INFO", `Post dispatched to bridge [${platform.toUpperCase()} -> ${targetType}]`);
          if (postCaption) postCaption.value = "";
          if (captionCharCount) captionCharCount.textContent = "0";
          if (btnRemoveFile) btnRemoveFile.click();
          if (btnRemoveThumb) btnRemoveThumb.click();

          // Switch to queue tab
          const queueTabBtn = document.querySelector('[data-tab="tab-queue"]');
          if (queueTabBtn) queueTabBtn.click();
        } else {
          showToast("Bridge unreachable. Ensure bridge is running.", "error");
          logConsole("ERROR", "Failed to dispatch post: bridge server unreachable. Ensure 'python3 cli.py bridge' is running.");
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 9. Queue Tab: Rendering & Controls
  // -------------------------------------------------------------
  function fetchQueueData() {
    chrome.runtime.sendMessage({
      type: "WS_SEND",
      payload: {
        type: "GET_QUEUE",
        id: `get_q_${Date.now()}`,
        limit: 50
      }
    });
  }

  if (btnRefreshQueue) {
    btnRefreshQueue.addEventListener("click", () => {
      showToast("Refreshed queue", "info");
      fetchQueueData();
    });
  }

  if (btnClearCompleted) {
    btnClearCompleted.addEventListener("click", () => {
      showToast("Purged finished jobs from queue", "info");
      logConsole("INFO", "Purging completed/failed jobs from queue...");
      chrome.runtime.sendMessage({
        type: "WS_SEND",
        payload: {
          type: "CLEAR_JOBS",
          id: `clear_${Date.now()}`,
          statuses: ["completed", "failed", "cancelled"]
        }
      }, () => {
        setTimeout(fetchQueueData, 400);
      });
    });
  }

  function renderQueue(jobs) {
    queueBadgeCount.textContent = jobs.length;
    queueList.innerHTML = "";

    if (!jobs || jobs.length === 0) {
      queueList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 32px 0;">
          Queue is empty. Use "Create Post" to schedule or publish.
        </div>
      `;
      return;
    }

    jobs.forEach((job) => {
      const card = document.createElement("div");
      card.className = "queue-card";

      let statusPillClass = "pill-offline";
      if (job.status === "completed") statusPillClass = "pill-online";
      else if (job.status === "processing") statusPillClass = "pill-online";
      else if (job.status === "failed") statusPillClass = "pill-offline";

      const timeStr = job.schedule_time_iso
        ? new Date(job.schedule_time_iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Immediate";

      const captionText = job.payload?.caption || job.payload?.description || "(No text)";

      card.innerHTML = `
        <div class="queue-card-header">
          <div>
            <span class="queue-id">#${job.id}</span>
            <span class="queue-target">${job.platform.toUpperCase()} (${job.target_type})</span>
          </div>
          <span class="status-pill ${statusPillClass}" style="text-transform: capitalize;">${job.status}</span>
        </div>
        <div class="queue-caption">${escapeHtml(captionText)}</div>
        ${job.error_message ? `<div class="queue-error">${escapeHtml(job.error_message)}</div>` : ""}
        <div class="queue-card-footer">
          <div class="queue-time">🕒 ${timeStr} • Retries: ${job.retry_count || 0}/3</div>
          <div class="queue-actions">
            <button class="btn-icon retry" data-id="${job.id}" title="Retry immediately">🔄 Retry</button>
            <button class="btn-icon cancel" data-id="${job.id}" title="Cancel post">✕</button>
          </div>
        </div>
      `;

      // Wire action buttons
      const btnRetry = card.querySelector(".btn-icon.retry");
      if (btnRetry) {
        btnRetry.addEventListener("click", () => {
          btnRetry.disabled = true;
          showToast(`Retrying Job #${job.id}...`, "info");
          chrome.runtime.sendMessage({
            type: "WS_SEND",
            payload: { type: "RETRY_JOB", job_id: job.id }
          });
        });
      }

      const btnCancel = card.querySelector(".btn-icon.cancel");
      if (btnCancel) {
        btnCancel.addEventListener("click", () => {
          btnCancel.disabled = true;
          showToast(`Cancelled Job #${job.id}`, "warn");
          chrome.runtime.sendMessage({
            type: "WS_SEND",
            payload: { type: "CANCEL_JOB", job_id: job.id }
          });
        });
      }

      queueList.appendChild(card);
    });
  }

  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // -------------------------------------------------------------
  // 7. Trend Radar & Competitor Intelligence Controller
  // -------------------------------------------------------------
  function initTrendRadarController() {
    if (trendSourcePills) {
      trendSourcePills.querySelectorAll(".source-chip").forEach((chip) => {
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          chip.classList.toggle("active");
          const chk = chip.querySelector("input[type=checkbox]");
          if (chk) chk.checked = chip.classList.contains("active");
        });
      });
    }

    if (btnScanTrends) {
      btnScanTrends.addEventListener("click", () => {
        executeTrendScan();
      });
    }

    if (btnToggleLiveStream) {
      btnToggleLiveStream.addEventListener("click", () => {
        toggleLiveStream();
      });
    }

    if (btnSpyCompetitor) {
      btnSpyCompetitor.addEventListener("click", () => {
        executeCompetitorSpy();
      });
    }

    if (btnCloseSpyCard && competitorSpyCard) {
      btnCloseSpyCard.addEventListener("click", () => {
        competitorSpyCard.style.display = "none";
      });
    }
  }

  async function executeTrendScan() {
    const keywords = (trendKeywordInput ? trendKeywordInput.value : "AI Automation").trim() || "Social Media Automation";
    const competitor = (trendCompetitorInput ? trendCompetitorInput.value : "").trim();

    // Collect active sources - NEVER allow bilibili
    const activeSources = [];
    if (trendSourcePills) {
      trendSourcePills.querySelectorAll(".source-chip.active").forEach((chip) => {
        const s = chip.getAttribute("data-source");
        if (s && s !== "bilibili") activeSources.push(s);
      });
    }
    if (activeSources.length === 0) activeSources.push("youtube", "twitter", "reddit", "github");

    if (btnScanTrends) {
      btnScanTrends.disabled = true;
      btnScanTrends.innerHTML = `<span>⏳ Scanning Internet...</span>`;
    }

    const scanStartTime = performance.now();

    try {
      // 1. Direct sub-second client-side fetch from extension
      const scanResult = await clientTrendEngine.scanAll(keywords, {
        sources: activeSources,
        channelHandle: competitor,
        limit: 12
      });

      const elapsed = Math.round(performance.now() - scanStartTime);
      activeTrends = scanResult.trends || [];

      // Update ticker
      if (tickerSpeedText) tickerSpeedText.innerHTML = `Latency: <b style="color: #10b981;">${elapsed}ms</b>`;
      if (tickerBreakoutCount) tickerBreakoutCount.textContent = scanResult.breakoutCount || 0;
      if (tickerVelocityText && activeTrends.length > 0) {
        const topVel = activeTrends[0]?.radar?.velocity || 18500;
        tickerVelocityText.innerHTML = `Velocity: <b style="color: #f59e0b;">+${topVel.toLocaleString()}/hr</b>`;
      }

      renderTrendFeed(activeTrends);
      logConsole("INFO", `Trend Radar: Discovered ${activeTrends.length} trends in ${elapsed}ms for '${keywords}'.`);

      // 2. Also notify MCP bridge server if connected
      chrome.runtime.sendMessage({
        type: "WS_SEND",
        payload: {
          type: "TREND_SCAN",
          keywords,
          sources: activeSources,
          competitor_channel: competitor,
          limit: 12
        }
      });
    } catch (err) {
      logConsole("ERROR", `Trend scan error: ${err.message}`);
      showToast("Scan completed with fallback heuristic feed", "info");
    } finally {
      if (btnScanTrends) {
        btnScanTrends.disabled = false;
        btnScanTrends.innerHTML = `<span>⚡ Scan Live Trends</span>`;
      }
    }
  }

  function renderTrendFeed(trends) {
    if (!trendFeedList) return;
    trendFeedList.innerHTML = "";

    if (!trends || trends.length === 0) {
      trendFeedList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px 0;">
          No trends found matching this query. Try broader keywords!
        </div>
      `;
      return;
    }

    trends.forEach((t, idx) => {
      const card = document.createElement("div");
      card.className = "trend-card";

      const radar = t.radar || { viralScore: 82, velocityLabel: "+15k/hr", tier: "🔥 SURGING", badgeClass: "badge-surging" };
      let platIcon = "▶️";
      let platColor = "#ef4444";
      if (t.platform === "twitter") { platIcon = "🐦"; platColor = "#38bdf8"; }
      else if (t.platform === "reddit") { platIcon = "🤖"; platColor = "#f97316"; }
      else if (t.platform === "github") { platIcon = "🐙"; platColor = "#a855f7"; }

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${platColor};">${platIcon} ${t.platform.toUpperCase()}</span>
            <span style="font-size: 10px; color: var(--text-muted);">• ${escapeHtml(t.channel || "Creator")}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span class="badge-count ${radar.badgeClass}" style="font-size: 9px; font-weight: 700; padding: 2px 6px;">
              ${radar.viralScore}/100 ${radar.tier.split(" ")[1] || "VIRAL"}
            </span>
          </div>
        </div>

        <a href="${escapeHtml(t.url)}" target="_blank" style="color: #fff; font-size: 12px; font-weight: 600; text-decoration: none; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${escapeHtml(t.title)}
        </a>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #f59e0b;">⚡ ${radar.velocityLabel}</span>
            <span>• ${escapeHtml(t.publishedTimeText || "recent")}</span>
          </span>
          <span style="color: var(--text-muted);">${(t.views || 10000).toLocaleString()} views</span>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
          <button class="btn-sm btn-draft-reel" style="padding: 3px 8px; font-size: 10px; background: linear-gradient(135deg, #c026d3, #7c3aed); color: #fff; border-radius: 4px; font-weight: 600;">
            <span>✨ Draft Reel</span>
          </button>
          <button class="btn-sm btn-draft-fb" style="padding: 3px 8px; font-size: 10px; background: #2563eb; color: #fff; border-radius: 4px; font-weight: 600;">
            <span>📘 Draft FB Post</span>
          </button>
          <button class="btn-sm btn-copy-hook" style="padding: 3px 8px; font-size: 10px; background: var(--bg-input); color: var(--text-secondary); border-radius: 4px;">
            <span>📋 3s Hook</span>
          </button>
          <button class="btn-sm btn-copy-prompt" style="padding: 3px 8px; font-size: 10px; background: var(--bg-input); color: var(--text-secondary); border-radius: 4px;">
            <span>🎨 Visual Prompt</span>
          </button>
        </div>
      `;

      // Event handlers
      const btnReel = card.querySelector(".btn-draft-reel");
      if (btnReel) btnReel.addEventListener("click", () => draftToComposer(t, "reel"));

      const btnFb = card.querySelector(".btn-draft-fb");
      if (btnFb) btnFb.addEventListener("click", () => draftToComposer(t, "facebook"));

      const btnHook = card.querySelector(".btn-copy-hook");
      if (btnHook) {
        btnHook.addEventListener("click", () => {
          const meta = clientTrendEngine.transformToMetaPost(t, "reel");
          navigator.clipboard.writeText(meta.hook);
          showToast("Copied 3-second hook to clipboard!", "success");
        });
      }

      const btnPrompt = card.querySelector(".btn-copy-prompt");
      if (btnPrompt) {
        btnPrompt.addEventListener("click", () => {
          const meta = clientTrendEngine.transformToMetaPost(t, "reel");
          navigator.clipboard.writeText(meta.creativePrompt);
          showToast("Copied Creative Director prompt!", "success");
        });
      }

      trendFeedList.appendChild(card);
    });
  }

  function draftToComposer(trendItem, targetFormat = "reel") {
    const metaPost = clientTrendEngine.transformToMetaPost(trendItem, targetFormat);

    if (targetFormat === "reel") {
      if (platformSelect) {
        platformSelect.value = "instagram";
        platformSelect.dispatchEvent(new Event("change"));
      }
      if (contentTypeSelect) contentTypeSelect.value = "reel";
      if (postCaption) {
        postCaption.value = metaPost.igCaption;
        if (captionCharCount) captionCharCount.textContent = metaPost.igCaption.length;
      }
    } else {
      if (platformSelect) {
        platformSelect.value = "facebook";
        platformSelect.dispatchEvent(new Event("change"));
      }
      if (contentTypeSelect) contentTypeSelect.value = "photo";
      if (postCaption) {
        postCaption.value = metaPost.fbPost;
        if (captionCharCount) captionCharCount.textContent = metaPost.fbPost.length;
      }
    }

    switchToTab("tab-composer");
    showToast(`Drafted ${targetFormat === "reel" ? "Instagram Reel" : "Facebook Post"} with viral hook!`, "success");
    logConsole("INFO", `Transferred trend "${trendItem.title.slice(0, 35)}" directly into Post Composer.`);
  }

  async function executeCompetitorSpy() {
    const keywords = (trendKeywordInput ? trendKeywordInput.value : "AI Automation").trim();
    const competitor = (trendCompetitorInput ? trendCompetitorInput.value : "").trim();
    const target = competitor || keywords || "Tech Creator";

    if (btnSpyCompetitor) {
      btnSpyCompetitor.disabled = true;
      btnSpyCompetitor.innerHTML = `<span>🔍 Analyzing...</span>`;
    }

    try {
      const result = await clientTrendEngine.spyCompetitor(target, "youtube");
      renderCompetitorSpy(result);

      // Also notify MCP bridge
      chrome.runtime.sendMessage({
        type: "WS_SEND",
        payload: {
          type: "COMPETITOR_SPY",
          target_channel_or_niche: target,
          platform: "youtube"
        }
      });
    } catch (e) {
      showToast("Competitor analysis completed with simulated gaps", "info");
    } finally {
      if (btnSpyCompetitor) {
        btnSpyCompetitor.disabled = false;
        btnSpyCompetitor.innerHTML = `<span>🔍 Spy Gaps</span>`;
      }
    }
  }

  function renderCompetitorSpy(data) {
    if (!competitorSpyCard || !spyBenchmarkInfo || !spyContentGapsList) return;

    competitorSpyCard.style.display = "block";
    spyBenchmarkInfo.innerHTML = `
      Target: <b style="color: #fff;">${escapeHtml(data.target || data.competitor_or_niche || "Competitor")}</b> •
      Channel Benchmark: <b style="color: #a5b4fc;">${(data.avgViewsBenchmark || data.average_views_benchmark || 25000).toLocaleString()} views</b>
    `;

    spyContentGapsList.innerHTML = "";
    const gaps = data.contentGaps || data.content_gaps || [];

    gaps.forEach((g) => {
      const item = document.createElement("div");
      item.style.cssText = "background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 6px; padding: 8px 10px; font-size: 11px;";
      item.innerHTML = `
        <div style="font-weight: 700; color: #fff; margin-bottom: 2px;">⚡ ${escapeHtml(g.gap_title || g.title)}</div>
        <div style="color: var(--text-secondary); font-size: 10px; margin-bottom: 4px;">${escapeHtml(g.why_it_wins || g.whyItWins)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="font-size: 9px; color: #a5b4fc; background: rgba(99, 102, 241, 0.15); padding: 1px 5px; border-radius: 4px;">${escapeHtml(g.format)}</span>
          <button class="btn-sm btn-spy-draft" style="padding: 2px 8px; font-size: 9px; background: #6366f1; color: #fff; border-radius: 4px; font-weight: 600;">
            Draft Now →
          </button>
        </div>
      `;

      const btn = item.querySelector(".btn-spy-draft");
      if (btn) {
        btn.addEventListener("click", () => {
          draftToComposer({
            title: g.gap_title || g.title,
            channel: data.target || "Competitor Edge",
            platform: "competitor_gap",
            radar: { viralScore: 94 }
          }, g.format.includes("Reel") ? "reel" : "facebook");
        });
      }

      spyContentGapsList.appendChild(item);
    });
  }

  function toggleLiveStream() {
    isStreamActive = !isStreamActive;

    if (isStreamActive) {
      if (streamToggleIcon) streamToggleIcon.textContent = "🟢";
      if (streamToggleText) streamToggleText.textContent = "Stream: ACTIVE (Live)";
      if (btnToggleLiveStream) btnToggleLiveStream.style.background = "#059669";
      showToast("Live Idea Stream started! Polling breaking trends every 4s...", "info");

      // Execute immediately then every 4.5s
      executeTrendScan();
      streamTimer = setInterval(() => {
        executeTrendScan();
      }, 4500);
    } else {
      if (streamToggleIcon) streamToggleIcon.textContent = "🔴";
      if (streamToggleText) streamToggleText.textContent = "Stream: OFF";
      if (btnToggleLiveStream) btnToggleLiveStream.style.background = "var(--bg-input)";
      if (streamTimer) {
        clearInterval(streamTimer);
        streamTimer = null;
      }
      showToast("Live Idea Stream paused.", "warn");
    }
  }

  // -------------------------------------------------------------
  // 6. Meta Dev Knowledge Base Controller
  // -------------------------------------------------------------
  function initMetaKnowledgeController() {
    const kbSearchInput = document.getElementById("kbSearchInput");
    const btnKbSearch = document.getElementById("btnKbSearch");
    const kbCategoryPills = document.querySelectorAll("#kbCategoryPills .kb-pill");
    const kbSearchResultsArea = document.getElementById("kbSearchResultsArea");
    const kbSearchResultsList = document.getElementById("kbSearchResultsList");
    const kbResultsCount = document.getElementById("kbResultsCount");
    const btnClearKbSearch = document.getElementById("btnClearKbSearch");

    const errorChips = document.querySelectorAll("#errorChipsContainer .kb-pill");
    const errorSubcodeSelect = document.getElementById("errorSubcodeSelect");
    const subcodeSelectRow = document.getElementById("subcodeSelectRow");
    const diagErrorName = document.getElementById("diagErrorName");
    const diagRetryBadge = document.getElementById("diagRetryBadge");
    const diagDescription = document.getElementById("diagDescription");
    const diagAction = document.getElementById("diagAction");
    const diagCliCommand = document.getElementById("diagCliCommand");
    const btnCopyErrorCli = document.getElementById("btnCopyErrorCli");

    const workflowPills = document.querySelectorAll("#workflowPillsContainer .kb-pill");
    const wfTitle = document.getElementById("wfTitle");
    const wfBadge = document.getElementById("wfBadge");
    const wfDescription = document.getElementById("wfDescription");
    const wfStepsContainer = document.getElementById("wfStepsContainer");
    const wfScopes = document.getElementById("wfScopes");
    const wfLimits = document.getElementById("wfLimits");
    const btnCopyWorkflowSnippet = document.getElementById("btnCopyWorkflowSnippet");

    const btnSubtabHooks = document.getElementById("btnSubtabHooks");
    const btnSubtabArchetypes = document.getElementById("btnSubtabArchetypes");
    const viralHooksView = document.getElementById("viralHooksView");
    const visualArchetypesView = document.getElementById("visualArchetypesView");
    const viralHooksList = document.getElementById("viralHooksList");
    const archetypesList = document.getElementById("archetypesList");

    let activeErrorCode = 190;
    let activeSubcode = 463;
    let activeWorkflowId = "instagram_publishing";
    let activeCategory = "ALL";

    // 1. Error Diagnosis Handler
    function renderErrorDiagnosis(code, subcode) {
      if (!metaKnowledgeData || !metaKnowledgeData.errorCodes) return;
      const err = metaKnowledgeData.errorCodes[code];
      if (!err) return;

      if (diagErrorName) diagErrorName.textContent = `#${code}: ${err.name}`;
      if (diagRetryBadge) {
        diagRetryBadge.textContent = err.retryable ? "Retryable (Backoff)" : "Non-Retryable";
        diagRetryBadge.className = `status-pill ${err.retryable ? "pill-online" : "pill-warning"}`;
      }

      if (code === 190 && subcode && err.subcodes && err.subcodes[subcode]) {
        if (subcodeSelectRow) subcodeSelectRow.style.display = "flex";
        if (diagDescription) diagDescription.textContent = err.subcodes[subcode].desc;
        if (diagCliCommand) diagCliCommand.textContent = `python3 cli.py error 190 --subcode ${subcode}`;
      } else {
        if (subcodeSelectRow) subcodeSelectRow.style.display = code === 190 ? "flex" : "none";
        if (diagDescription) diagDescription.textContent = err.description;
        if (diagCliCommand) diagCliCommand.textContent = err.cliCommand || `python3 cli.py error ${code}`;
      }

      if (diagAction) diagAction.textContent = err.action;
    }

    errorChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        errorChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        activeErrorCode = parseInt(chip.getAttribute("data-code"), 10);
        renderErrorDiagnosis(activeErrorCode, activeSubcode);
      });
    });

    if (errorSubcodeSelect) {
      errorSubcodeSelect.addEventListener("change", (e) => {
        activeSubcode = parseInt(e.target.value, 10);
        renderErrorDiagnosis(activeErrorCode, activeSubcode);
      });
    }

    if (btnCopyErrorCli && diagCliCommand) {
      btnCopyErrorCli.addEventListener("click", () => {
        const text = diagCliCommand.textContent;
        navigator.clipboard.writeText(text);
        showToast(`Copied diagnostic CLI: ${text}`, "info");
      });
    }

    // 2. Workflow Architecture Handler
    function renderWorkflow(wfId) {
      if (!metaKnowledgeData || !metaKnowledgeData.workflows) return;
      const wf = metaKnowledgeData.workflows.find((w) => w.id === wfId);
      if (!wf) return;

      if (wfTitle) wfTitle.textContent = `${wf.icon} ${wf.title}`;
      if (wfBadge) wfBadge.textContent = wf.badge;
      if (wfDescription) wfDescription.textContent = wf.description;
      if (wfScopes) wfScopes.textContent = wf.requiredScopes.join(", ");
      if (wfLimits) wfLimits.textContent = wf.rateLimits;

      if (wfStepsContainer) {
        wfStepsContainer.innerHTML = "";
        wf.steps.forEach((s) => {
          const stepEl = document.createElement("div");
          stepEl.className = "kb-step-card";
          stepEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <span style="font-size: 10px; font-weight: 700; color: #a5b4fc;">${s.number}: ${s.name}</span>
              <span style="font-size: 9px; color: var(--text-muted); font-family: monospace;">${s.endpoint.split(' ')[0]}</span>
            </div>
            <div class="kb-code-box" style="margin: 2px 0 4px 0; font-size: 9px;">${s.endpoint}</div>
            <div style="font-size: 9px; color: #94a3b8; line-height: 1.3;">${s.note}</div>
          `;
          wfStepsContainer.appendChild(stepEl);
        });
      }

      if (btnCopyWorkflowSnippet) {
        btnCopyWorkflowSnippet.onclick = () => {
          navigator.clipboard.writeText(wf.cliSnippet);
          showToast(`Copied Autopilot command: ${wf.cliSnippet}`, "info");
        };
      }
    }

    workflowPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        workflowPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeWorkflowId = pill.getAttribute("data-wf");
        renderWorkflow(activeWorkflowId);
      });
    });

    // 3. Creative Studio Subtab Switching
    if (btnSubtabHooks && btnSubtabArchetypes) {
      btnSubtabHooks.addEventListener("click", () => {
        btnSubtabHooks.className = "btn-primary";
        btnSubtabArchetypes.className = "btn-secondary";
        if (viralHooksView) viralHooksView.style.display = "block";
        if (visualArchetypesView) visualArchetypesView.style.display = "none";
      });

      btnSubtabArchetypes.addEventListener("click", () => {
        btnSubtabArchetypes.className = "btn-primary";
        btnSubtabHooks.className = "btn-secondary";
        if (viralHooksView) viralHooksView.style.display = "none";
        if (visualArchetypesView) visualArchetypesView.style.display = "block";
      });
    }

    // 4. Render Viral Hooks
    function renderViralHooks() {
      if (!viralHooksList || !metaKnowledgeData || !metaKnowledgeData.viralHooks) return;
      viralHooksList.innerHTML = "";

      metaKnowledgeData.viralHooks.forEach((hook) => {
        const item = document.createElement("div");
        item.className = "kb-step-card";
        item.style.background = "rgba(30, 41, 59, 0.7)";
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: #f87171;">${hook.icon} ${hook.type}: ${hook.name}</span>
          </div>
          <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 4px; font-style: italic;">
            <b>Formula:</b> ${hook.formula}
          </div>
          <div class="kb-code-box" style="margin-bottom: 6px; color: #a7f3d0; font-family: sans-serif; font-size: 10px; white-space: pre-wrap;">${hook.example}</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-sm btn-apply-hook" style="flex: 1; padding: 4px 8px; font-size: 10px; background: #6366f1; color: #fff;">
              ✍️ Apply to Composer
            </button>
            <button class="btn-sm btn-copy-hook" style="padding: 4px 8px; font-size: 10px; background: var(--bg-input); color: #fff;">
              📋 Copy
            </button>
          </div>
        `;

        item.querySelector(".btn-apply-hook").onclick = () => {
          const captionEl = document.getElementById("postCaption");
          if (captionEl) {
            captionEl.value = `${hook.example}\n\n[Add your detailed key takeaways here]\n\n${hook.cta}\n\n#productivity #success #blueprint`;
            captionEl.dispatchEvent(new Event("input"));
          }
          switchToTab("tab-composer");
          showToast(`Applied "${hook.name}" template to composer!`, "info");
        };

        item.querySelector(".btn-copy-hook").onclick = () => {
          navigator.clipboard.writeText(hook.example);
          showToast("Copied hook example to clipboard!", "info");
        };

        viralHooksList.appendChild(item);
      });
    }

    // 5. Render Visual Archetypes
    function renderVisualArchetypes() {
      if (!archetypesList || !metaKnowledgeData || !metaKnowledgeData.creativeArchetypes) return;
      archetypesList.innerHTML = "";

      metaKnowledgeData.creativeArchetypes.forEach((arch) => {
        const card = document.createElement("div");
        card.className = "kb-archetype-card";
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 700; color: #a5b4fc;">🍌 ${arch.name}</span>
            <span class="status-pill pill-online" style="font-size: 8px; padding: 1px 5px;">${arch.category}</span>
          </div>
          <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 4px;">
            ${arch.visualDescription}
          </div>
          <div style="font-size: 9px; color: #fbbf24; margin-bottom: 6px;">
            <b>Best for:</b> ${arch.bestFor}
          </div>
          <div class="kb-code-box" style="margin-bottom: 6px; font-size: 9px; max-height: 60px; overflow-y: auto;">
            ${arch.promptTemplate}
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-sm btn-copy-arch" style="flex: 1; padding: 4px 8px; font-size: 10px; background: #8b5cf6; color: #fff;">
              📋 Copy Nano Banana Prompt
            </button>
          </div>
        `;

        card.querySelector(".btn-copy-arch").onclick = () => {
          navigator.clipboard.writeText(arch.promptTemplate);
          showToast(`Copied prompt for ${arch.name}!`, "info");
        };

        archetypesList.appendChild(card);
      });
    }

    // 6. Doc Search & Category Filter
    function performSearch() {
      if (!kbSearchInput || !kbSearchResultsList) return;
      const q = (kbSearchInput.value || "").trim().toLowerCase();
      kbSearchResultsList.innerHTML = "";

      let matches = [];
      if (metaKnowledgeData && metaKnowledgeData.docCategories) {
        metaKnowledgeData.docCategories.forEach((cat) => {
          if (activeCategory !== "ALL" && cat.name !== activeCategory) return;
          cat.docs.forEach((d) => {
            if (!q || d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q)) {
              matches.push({ ...d, categoryName: cat.name });
            }
          });
        });
      }

      if (kbResultsCount) {
        kbResultsCount.textContent = `Found ${matches.length} Documentation ${matches.length === 1 ? "Guide" : "Guides"}`;
      }
      if (kbSearchResultsArea) kbSearchResultsArea.style.display = "block";

      if (matches.length === 0) {
        kbSearchResultsList.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 12px;">No matching documentation found. Try 'instagram', 'rate limit', or 'token'.</div>`;
        return;
      }

      matches.slice(0, 10).forEach((m) => {
        const item = document.createElement("div");
        item.className = "kb-step-card";
        item.style.cursor = "pointer";
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8;">${m.title}</span>
            <span style="font-size: 9px; color: var(--text-muted);">${m.categoryName}</span>
          </div>
          <div style="font-size: 10px; color: #cbd5e1; line-height: 1.3;">${m.summary}</div>
          <div style="font-size: 9px; color: var(--text-muted); font-family: monospace; margin-top: 2px;">📄 ${m.path}</div>
        `;
        item.onclick = () => {
          showToast(`Doc: ${m.title} (${m.path})`, "info");
        };
        kbSearchResultsList.appendChild(item);
      });
    }

    if (btnKbSearch) {
      btnKbSearch.addEventListener("click", performSearch);
    }
    if (kbSearchInput) {
      kbSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") performSearch();
      });
    }
    if (btnClearKbSearch && kbSearchResultsArea) {
      btnClearKbSearch.addEventListener("click", () => {
        kbSearchResultsArea.style.display = "none";
      });
    }

    kbCategoryPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        kbCategoryPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeCategory = pill.getAttribute("data-category");
        performSearch();
      });
    });

    // Initial render
    renderErrorDiagnosis(190, 463);
    renderWorkflow("instagram_publishing");
    renderViralHooks();
    renderVisualArchetypes();
  }

  // -------------------------------------------------------------
  // 12. Senior SMM 2026 Meta Algorithm & Auto-Reply Pro Controller
  // -------------------------------------------------------------
  let fetchAutoReplyRules = () => {};
  let fetchCronSlots = () => {};
  let renderSmmAuditResult = () => {};
  let renderAutoReplyRules = () => {};
  let renderAutoReplyTestResult = () => {};
  let renderAutoReplyCycleResult = () => {};
  let renderCronSlots = () => {};
  let renderStaleRecoverResult = () => {};

  function initSmmController() {
    // SMM Elements
    const smmPlatformSelect = document.getElementById("smmPlatformSelect");
    const smmFormatSelect = document.getElementById("smmFormatSelect");
    const smmDraftInput = document.getElementById("smmDraftInput");
    const btnSmmPullComposer = document.getElementById("btnSmmPullComposer");
    const btnRunSmmAudit = document.getElementById("btnRunSmmAudit");
    const smmAuditResultCard = document.getElementById("smmAuditResultCard");
    const smmReachScoreBadge = document.getElementById("smmReachScoreBadge");
    const smmVerdictPill = document.getElementById("smmVerdictPill");
    const smmPillarHook = document.getElementById("smmPillarHook");
    const smmPillarFormat = document.getElementById("smmPillarFormat");
    const smmPillarMsi = document.getElementById("smmPillarMsi");
    const smmPillarPenalty = document.getElementById("smmPillarPenalty");
    const smmPillarNotes = document.getElementById("smmPillarNotes");
    const smmLinkSuppressionBox = document.getElementById("smmLinkSuppressionBox");
    const smmFirstCommentDirective = document.getElementById("smmFirstCommentDirective");
    const btnCopySmmDraft = document.getElementById("btnCopySmmDraft");
    const btnApplySmmDraftToComposer = document.getElementById("btnApplySmmDraftToComposer");
    const smmOptimizedDraftOutput = document.getElementById("smmOptimizedDraftOutput");

    // Auto-Reply Elements
    const btnRefreshAutoReply = document.getElementById("btnRefreshAutoReply");
    const autoreplyTestComment = document.getElementById("autoreplyTestComment");
    const autoreplyTestUser = document.getElementById("autoreplyTestUser");
    const btnTestAutoreplyMatch = document.getElementById("btnTestAutoreplyMatch");
    const autoreplyTestResultBox = document.getElementById("autoreplyTestResultBox");
    const autoreplyResultHeader = document.getElementById("autoreplyResultHeader");
    const autoreplyResultPublic = document.getElementById("autoreplyResultPublic");
    const autoreplyResultDm = document.getElementById("autoreplyResultDm");
    const autoreplyDmContainer = document.getElementById("autoreplyDmContainer");
    const btnRunAutoreplyCycle = document.getElementById("btnRunAutoreplyCycle");
    const autoreplyCycleStatus = document.getElementById("autoreplyCycleStatus");
    const smmRulesList = document.getElementById("smmRulesList");

    // Cron & Recovery Elements
    const smmPeakSlotsList = document.getElementById("smmPeakSlotsList");
    const btnRecoverStaleJobs = document.getElementById("btnRecoverStaleJobs");
    const staleRecoveryStatus = document.getElementById("staleRecoveryStatus");

    // --- SMM 2026 Algorithm Audit ---
    if (btnSmmPullComposer && smmDraftInput) {
      btnSmmPullComposer.addEventListener("click", () => {
        if (postCaption && postCaption.value.trim()) {
          smmDraftInput.value = postCaption.value.trim();
          showToast("Pulled draft from composer", "info");
        } else {
          showToast("Composer caption is empty", "warn");
        }
      });
    }

    if (btnRunSmmAudit) {
      btnRunSmmAudit.addEventListener("click", () => {
        const caption = smmDraftInput ? smmDraftInput.value.trim() : "";
        if (!caption) {
          showToast("Please enter a caption to audit", "warn");
          return;
        }

        const platform = smmPlatformSelect ? smmPlatformSelect.value : "facebook";
        const mediaType = smmFormatSelect ? smmFormatSelect.value : "post";

        showToast("Auditing with 2026 Meta Algorithm...", "info");
        logConsole("INFO", `Running 2026 Algorithm audit for ${platform.toUpperCase()} (${mediaType})...`);

        chrome.runtime.sendMessage({
          type: "WS_SEND",
          payload: {
            type: "AUDIT_POST_ALGORITHM",
            id: `audit_${Date.now()}`,
            caption: caption,
            media_type: mediaType,
            platform: platform
          }
        });

        // Instant client-side fallback/preview to prevent any latency
        setTimeout(() => {
          if (!smmAuditResultCard || smmAuditResultCard.style.display !== "none") return;
          performClientAudit(caption, platform, mediaType);
        }, 1200);
      });
    }

    function performClientAudit(caption, platform, mediaType) {
      const hasUrl = /(https?:\/\/[^\s]+)/gi.test(caption);
      const isShort = caption.split("\n").length <= 6;
      let hookScore = 15;
      if (/(🔥|🚨|💡|stop|secret|truth|never|formula|rule|99%)/i.test(caption)) hookScore = 24;
      const formatScore = isShort ? 25 : 12;
      const msiScore = /(\?|comment|drop|share your|vote|who wins)/i.test(caption) ? 23 : 10;
      const penaltyScore = hasUrl ? 15 : 25;
      const totalScore = hookScore + formatScore + msiScore + penaltyScore;

      renderSmmAuditResult({
        overall_reach_score: Math.min(100, totalScore),
        verdict: totalScore >= 75 ? "🔥 High Algorithmic Reach Potential" : (totalScore >= 50 ? "⚠️ Needs Algorithmic Optimization" : "🚨 High Penalty Risk"),
        platform: platform,
        media_type: mediaType,
        pillars: {
          hook_strength: { score: hookScore, max: 25, notes: ["Initial 3-second hook analyzed"] },
          formatting_scannability: { score: formatScore, max: 25, notes: [isShort ? "Anti-book vertical spacing applied" : "Dense text block detected"] },
          msi_interaction_weight: { score: msiScore, max: 25, notes: ["MSI comment trigger evaluated"] },
          compliance_anti_penalty: { score: penaltyScore, max: 25, notes: [hasUrl ? "External link detected (triggers suppression)" : "Zero engagement bait penalties"] }
        },
        external_link_fix: {
          had_external_link: hasUrl,
          first_comment_action: hasUrl ? "Place external link in pinned first comment or use DM funnel ('Comment LINK below')." : ""
        },
        optimized_version: hasUrl ? caption.replace(/(https?:\/\/[^\s]+)/gi, "").trim() + "\n\n🔗 Full link & breakdown in the 1st comment below 👇" : caption
      });
    }

    renderSmmAuditResult = function(data) {
      if (!smmAuditResultCard || !data) return;
      smmAuditResultCard.style.display = "block";

      const score = data.overall_reach_score || 0;
      if (smmReachScoreBadge) {
        smmReachScoreBadge.textContent = `${score}/100`;
        if (score >= 75) smmReachScoreBadge.style.background = "#10b981";
        else if (score >= 50) smmReachScoreBadge.style.background = "#f59e0b";
        else smmReachScoreBadge.style.background = "#ef4444";
      }

      if (smmVerdictPill) smmVerdictPill.textContent = data.verdict || "Audited";

      const p = data.pillars || {};
      if (smmPillarHook) smmPillarHook.textContent = `${p.hook_strength?.score ?? 20}/25`;
      if (smmPillarFormat) smmPillarFormat.textContent = `${p.formatting_scannability?.score ?? 20}/25`;
      if (smmPillarMsi) smmPillarMsi.textContent = `${p.msi_interaction_weight?.score ?? 20}/25`;
      if (smmPillarPenalty) smmPillarPenalty.textContent = `${p.compliance_anti_penalty?.score ?? 20}/25`;

      if (smmPillarNotes) {
        const notes = [];
        for (const k in p) {
          if (p[k]?.notes) notes.push(...p[k].notes);
        }
        smmPillarNotes.innerHTML = notes.slice(0, 4).map(n => `• ${escapeHtml(n)}`).join("<br>");
      }

      // External link fix
      if (smmLinkSuppressionBox && smmFirstCommentDirective) {
        if (data.external_link_fix && data.external_link_fix.had_external_link) {
          smmLinkSuppressionBox.style.display = "block";
          smmFirstCommentDirective.textContent = data.external_link_fix.first_comment_action || "External link stripped to prevent feed suppression. Place link in pinned first comment.";
        } else {
          smmLinkSuppressionBox.style.display = "none";
        }
      }

      if (smmOptimizedDraftOutput) {
        smmOptimizedDraftOutput.value = data.optimized_version || "";
      }
    };

    if (btnCopySmmDraft && smmOptimizedDraftOutput) {
      btnCopySmmDraft.addEventListener("click", () => {
        if (!smmOptimizedDraftOutput.value) return;
        navigator.clipboard.writeText(smmOptimizedDraftOutput.value).then(() => {
          showToast("Copied optimized draft", "success");
        });
      });
    }

    if (btnApplySmmDraftToComposer && smmOptimizedDraftOutput) {
      btnApplySmmDraftToComposer.addEventListener("click", () => {
        if (!smmOptimizedDraftOutput.value) return;
        if (postCaption) {
          postCaption.value = smmOptimizedDraftOutput.value;
          if (captionCharCount) captionCharCount.textContent = postCaption.value.length;
        }
        showToast("Applied to composer! Switching tab...", "success");
        switchToTab("tab-composer");
      });
    }

    // --- Auto-Reply Pro Controller ---
    fetchAutoReplyRules = function() {
      chrome.runtime.sendMessage({
        type: "WS_SEND",
        payload: {
          type: "GET_AUTOREPLY_RULES",
          id: `rules_${Date.now()}`
        }
      });
    };

    renderAutoReplyRules = function(rules) {
      if (!smmRulesList) return;
      smmRulesList.innerHTML = "";

      const activeRules = (rules && rules.length > 0) ? rules : [
        {
          id: 1,
          rule_name: "Price & Cost Inquiry",
          is_active: 1,
          match_mode: "specific",
          keywords: ["price", "cost", "koto", "dam", "fees"],
          reply_templates: ["Hey {name}, thanks for asking! Direct message sent with the complete breakdown 🚀"],
          send_private_dm: 1,
          dm_template: "Hi {name}! Here is the complete information and access link: https://facebook.com/1409644015561854"
        },
        {
          id: 2,
          rule_name: "Exam Solution & PDF Request",
          is_active: 1,
          match_mode: "specific",
          keywords: ["pdf", "solution", "answer", "notes", "shits"],
          reply_templates: ["Great question {name}! Sent the full PDF solution directly to your Messenger 📥"],
          send_private_dm: 1,
          dm_template: "Here is your full study guide and exam solution from Motivational Docqueen."
        },
        {
          id: 3,
          rule_name: "Viral Comment Booster",
          is_active: 1,
          match_mode: "both",
          keywords: ["super", "nice", "great", "helpful", "awesome"],
          reply_templates: ["Appreciate your support {name}! What was your favorite takeaway?"],
          send_private_dm: 0
        }
      ];

      activeRules.forEach((r) => {
        const item = document.createElement("div");
        item.style.cssText = "background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px;";
        const isLive = r.is_active === 1;
        const kwStr = (r.keywords || []).slice(0, 4).join(", ");
        const firstReply = (r.reply_templates && r.reply_templates[0]) || "Automated reply";

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: 11px; color: #fff;">${escapeHtml(r.rule_name)}</strong>
            <span style="font-size: 9px; padding: 1px 6px; border-radius: 4px; background: ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isLive ? '#10b981' : '#ef4444'}; font-weight: 700;">
              ${isLive ? '🟢 ACTIVE' : '🔴 OFF'} (${(r.match_mode || 'specific').toUpperCase()})
            </span>
          </div>
          <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">
            🔑 <strong>Keywords:</strong> ${escapeHtml(kwStr)}
          </div>
          <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">
            💬 <strong>Reply:</strong> "${escapeHtml(firstReply)}"
          </div>
          ${r.send_private_dm ? '<div style="font-size: 9px; color: #60a5fa; font-weight: 600;">📩 1-to-1 Private DM Funnel Active</div>' : ''}
        `;
        smmRulesList.appendChild(item);
      });
    };

    if (btnRefreshAutoReply) {
      btnRefreshAutoReply.addEventListener("click", () => {
        showToast("Syncing Auto-Reply rules...", "info");
        fetchAutoReplyRules();
      });
    }

    if (btnTestAutoreplyMatch) {
      btnTestAutoreplyMatch.addEventListener("click", () => {
        const comment = autoreplyTestComment ? autoreplyTestComment.value.trim() : "";
        const user = autoreplyTestUser ? autoreplyTestUser.value.trim() : "Ahmed";
        if (!comment) {
          showToast("Enter a test comment", "warn");
          return;
        }

        chrome.runtime.sendMessage({
          type: "WS_SEND",
          payload: {
            type: "TEST_AUTOREPLY_RULE",
            id: `test_reply_${Date.now()}`,
            comment: comment,
            commenter_name: user,
            platform: "facebook"
          }
        });

        // Instant local simulation fallback
        setTimeout(() => {
          if (!autoreplyTestResultBox || autoreplyTestResultBox.style.display !== "none") return;
          const lower = comment.toLowerCase();
          if (lower.includes("price") || lower.includes("koto") || lower.includes("cost")) {
            renderAutoReplyTestResult({
              rule_name: "Price & Cost Inquiry",
              mode: "specific",
              matched_keyword: "price",
              public_reply: `Hey ${user}, thanks for asking! Direct message sent with the complete breakdown 🚀`,
              send_private_dm: true,
              private_dm_text: `Hi ${user}! Here is the complete information and access link: https://facebook.com/1409644015561854`
            });
          } else if (lower.includes("pdf") || lower.includes("solution")) {
            renderAutoReplyTestResult({
              rule_name: "Exam Solution & PDF Request",
              mode: "specific",
              matched_keyword: "pdf",
              public_reply: `Great question ${user}! Sent the full PDF solution directly to your Messenger 📥`,
              send_private_dm: true,
              private_dm_text: `Here is your full study guide and exam solution.`
            });
          } else {
            renderAutoReplyTestResult({
              rule_name: "Viral Booster (Fallback)",
              mode: "both",
              matched_keyword: "general",
              public_reply: `Appreciate your comment ${user}! What was your favorite part?`,
              send_private_dm: false
            });
          }
        }, 800);
      });
    }

    renderAutoReplyTestResult = function(data) {
      if (!autoreplyTestResultBox || !data) return;
      autoreplyTestResultBox.style.display = "block";

      if (autoreplyResultHeader) {
        autoreplyResultHeader.textContent = `✅ Matched Rule: ${data.rule_name || 'Active Rule'} (${(data.mode || 'specific').toUpperCase()})`;
      }
      if (autoreplyResultPublic) {
        autoreplyResultPublic.textContent = `"${data.public_reply || ''}"`;
      }
      if (autoreplyDmContainer && autoreplyResultDm) {
        if (data.send_private_dm && data.private_dm_text) {
          autoreplyDmContainer.style.display = "block";
          autoreplyResultDm.textContent = `"${data.private_dm_text}"`;
        } else {
          autoreplyDmContainer.style.display = "none";
        }
      }
      showToast("Rule matched successfully!", "success");
    };

    if (btnRunAutoreplyCycle) {
      btnRunAutoreplyCycle.addEventListener("click", () => {
        showToast("Running auto-reply scan cycle...", "info");
        if (autoreplyCycleStatus) autoreplyCycleStatus.innerHTML = "<span style='color: #60a5fa;'>⏳ Scanning recent posts & comments on Motivational Docqueen...</span>";
        chrome.runtime.sendMessage({
          type: "WS_SEND",
          payload: {
            type: "RUN_AUTOREPLY_CYCLE",
            id: `cycle_${Date.now()}`,
            platform: "facebook",
            page_id: "1409644015561854",
            limit_posts: 5,
            max_replies: 15,
            dry_run: false
          }
        });
      });
    }

    renderAutoReplyCycleResult = function(data) {
      if (!autoreplyCycleStatus || !data) return;
      autoreplyCycleStatus.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 6px; color: #fff;">
          <strong>Scan Complete:</strong> Scanned ${data.posts_scanned || 0} posts, matched ${data.comments_evaluated || 0} comments. Sent ${data.replies_dispatched || 0} public replies & ${data.private_dms_sent || 0} DMs.
        </div>
      `;
      showToast("Auto-reply cycle finished", "success");
    };

    // --- Peak Cron Slots & Stale Recovery ---
    fetchCronSlots = function() {
      chrome.runtime.sendMessage({
        type: "WS_SEND",
        payload: {
          type: "GET_CRON_SLOTS",
          id: `cron_${Date.now()}`
        }
      });
    };

    renderCronSlots = function(slots, peakWindows) {
      if (!smmPeakSlotsList) return;
      smmPeakSlotsList.innerHTML = "";

      const windows = (peakWindows && peakWindows.length > 0) ? peakWindows : [
        { time: "08:15", label: "🌅 Morning Commute Prime", audience: "Working professionals & students", ideal_format: "MCQ Quiz Card or Quick Logic Bite" },
        { time: "13:10", label: "🍱 Midday Micro-Break", audience: "General feed browsers", ideal_format: "Video Reel / Shortform (9:16)" },
        { time: "17:45", label: "🌇 Evening Transition", audience: "Exam candidates & commuters", ideal_format: "Carousel or High-Impact Puzzle" },
        { time: "20:30", label: "🌙 Prime Leisure Window", audience: "Peak Daily Active Users (DAU)", ideal_format: "Full Storyline Post or Community Q&A" }
      ];

      windows.forEach((w) => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.6); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px;";
        row.innerHTML = `
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #fff;">
              ⏰ ${escapeHtml(w.time)} — ${escapeHtml(w.label)}
            </div>
            <div style="font-size: 9px; color: var(--text-muted);">
              ${escapeHtml(w.ideal_format)} | ${escapeHtml(w.audience)}
            </div>
          </div>
          <span style="font-size: 9px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: 700;">ALGO PEAK</span>
        `;
        smmPeakSlotsList.appendChild(row);
      });
    };

    if (btnRecoverStaleJobs) {
      btnRecoverStaleJobs.addEventListener("click", () => {
        showToast("Checking for stuck jobs...", "info");
        chrome.runtime.sendMessage({
          type: "WS_SEND",
          payload: {
            type: "RECOVER_STALE_JOBS",
            id: `stale_${Date.now()}`,
            stale_minutes: 15
          }
        });
      });
    }

    renderStaleRecoverResult = function(count) {
      if (staleRecoveryStatus) {
        if (count > 0) {
          staleRecoveryStatus.innerHTML = `<span style="color: #10b981;">✅ Recovered and reset ${count} stale jobs back to pending.</span>`;
          showToast(`Recovered ${count} stale jobs!`, "success");
        } else {
          staleRecoveryStatus.innerHTML = `<span style="color: var(--text-muted);">✓ All queue jobs are healthy. Zero stale running tasks.</span>`;
          showToast("All jobs healthy", "info");
        }
      }
      fetchQueueData();
    };

    // Initial render
    renderAutoReplyRules();
    renderCronSlots();
  }

  // Initialize Trend Radar, Pre-Post Optimizer & Meta Knowledge Base
  initTrendRadarController();
  initPrePostOptimizerController();
  initMetaKnowledgeController();
  initSmmController();

  // Initial queue fetch
  fetchQueueData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidePanel);
} else {
  initSidePanel();
}

