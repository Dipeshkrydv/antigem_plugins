/**
 * Antigravity Meta Bridge Extension - Popup Controller
 */

function initPopup() {
  const connectionBadge = document.getElementById("connectionBadge");
  const connectionText = document.getElementById("connectionText");
  const igStatus = document.getElementById("igStatus");
  const fbStatus = document.getElementById("fbStatus");
  const bizStatus = document.getElementById("bizStatus");
  const btnSync = document.getElementById("btnSync");
  const btnPauseToggle = document.getElementById("btnPauseToggle");
  const pauseBtnText = document.getElementById("pauseBtnText");

  let isQueuePaused = false;

  const popupFbName = document.getElementById("popupFbName");
  const popupFbSub = document.getElementById("popupFbSub");
  const popupIgName = document.getElementById("popupIgName");
  const popupIgSub = document.getElementById("popupIgSub");
  const popupBizName = document.getElementById("popupBizName");
  const popupBizSub = document.getElementById("popupBizSub");

  function renderState(state) {
    if (!state) return;

    // WebSocket Connection state
    if (connectionBadge && connectionText) {
      if (state.connected) {
        connectionBadge.className = "badge connected";
        connectionText.textContent = "Bridge Connected to MCP";
      } else {
        connectionBadge.className = "badge disconnected";
        connectionText.textContent = "MCP Disconnected (Retrying...)";
      }
    }

    // Facebook session state
    if (fbStatus) {
      if (state.fbLoggedIn) {
        fbStatus.className = "account-status status-online";
        fbStatus.textContent = "Online";
        const fbName = state.fbUser || "Renuka Yadav";
        const fbId = state.fbId || "61592442011195";
        if (popupFbName) popupFbName.textContent = fbName;
        if (popupFbSub) popupFbSub.textContent = `Profile ID: ${fbId}`;
      } else {
        fbStatus.className = "account-status status-offline";
        fbStatus.textContent = "Offline";
        if (popupFbName) popupFbName.textContent = "Facebook Profile";
        if (popupFbSub) popupFbSub.textContent = "Profile ID: Not Synced";
      }
    }

    // Instagram session state
    if (igStatus) {
      if (state.igLoggedIn) {
        igStatus.className = "account-status status-online";
        igStatus.textContent = "Online";
        const handle = state.igUser ? (state.igUser.startsWith("@") ? state.igUser : `@${state.igUser}`) : "@renukayadav";
        const igId = state.igId || "43599208749";
        if (popupIgName) popupIgName.textContent = handle;
        if (popupIgSub) popupIgSub.textContent = `User ID: ${igId}`;
      } else {
        igStatus.className = "account-status status-offline";
        igStatus.textContent = "Offline";
        if (popupIgName) popupIgName.textContent = "Instagram Account";
        if (popupIgSub) popupIgSub.textContent = "User ID: Not Synced";
      }
    }

    // Business Suite session state
    if (bizStatus) {
      if (state.businessSuitePages && state.businessSuitePages.length > 0) {
        bizStatus.className = "account-status status-online";
        bizStatus.textContent = "Online";
        const p = state.businessSuitePages[0];
        if (popupBizName) popupBizName.textContent = `Page: ${p.name || "Motivational Docqueen"}`;
        if (popupBizSub) popupBizSub.textContent = `Page ID: ${p.id}`;
      } else if (state.businessSuiteStatus === "no_pages" || state.businessSuiteHasNoPages || (state.fbLoggedIn && (!state.businessSuitePages || state.businessSuitePages.length === 0))) {
        bizStatus.className = "account-status status-warning";
        bizStatus.textContent = "No Pages Linked";
        if (popupBizName) popupBizName.textContent = "Meta Business Suite";
        const owner = state.fbUser || "Renuka Yadav";
        if (popupBizSub) popupBizSub.textContent = `Personal Profile (${owner}) • No Pages`;
      } else {
        bizStatus.className = "account-status status-offline";
        bizStatus.textContent = "Offline";
        if (popupBizName) popupBizName.textContent = "Meta Business Suite";
        if (popupBizSub) popupBizSub.textContent = "Personal Account • No Pages Linked";
      }
    }

    // Emergency pause button state
    isQueuePaused = !!state.queuePaused;
    if (btnPauseToggle && pauseBtnText) {
      if (isQueuePaused) {
        btnPauseToggle.className = "btn-resume";
        pauseBtnText.textContent = "▶ Resume Scheduled Queue";
      } else {
        btnPauseToggle.className = "btn-pause";
        pauseBtnText.textContent = "🛑 Emergency Pause All";
      }
    }
  }

  // Load initial state & notify background worker to connect/sync
  chrome.storage.local.get(["bridgeState"], (res) => {
    renderState(res.bridgeState || {});
    chrome.runtime.sendMessage({ type: "POPUP_OPENED" });
  });

  // Listen for storage updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.bridgeState) {
      renderState(changes.bridgeState.newValue);
    }
  });

  // Button: Open Side Panel (direct MV3 user gesture call)
  const btnOpenSidePanel = document.getElementById("btnOpenSidePanel");
  if (btnOpenSidePanel) {
    btnOpenSidePanel.addEventListener("click", async () => {
      try {
        const win = await chrome.windows.getCurrent();
        if (chrome.sidePanel && chrome.sidePanel.open && win && win.id) {
          await chrome.sidePanel.open({ windowId: win.id });
          window.close();
          return;
        }
      } catch (err) {
        console.warn("[MetaBridge] Direct sidePanel.open notice:", err);
      }
      chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
        window.close();
      });
    });
  }

  // Button: Quick Trend Radar Open
  const btnPopupTrendRadar = document.getElementById("btnPopupTrendRadar");
  if (btnPopupTrendRadar) {
    btnPopupTrendRadar.addEventListener("click", async () => {
      try {
        const win = await chrome.windows.getCurrent();
        if (chrome.sidePanel && chrome.sidePanel.open && win && win.id) {
          await chrome.sidePanel.open({ windowId: win.id });
          window.close();
          return;
        }
      } catch (err) {
        console.warn("[MetaBridge] Direct sidePanel.open notice:", err);
      }
      chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
        window.close();
      });
    });
  }

  // Button: Reload Extension Bridge Code
  const btnReload = document.getElementById("btnReload");
  if (btnReload) {
    btnReload.addEventListener("click", () => {
      btnReload.disabled = true;
      btnReload.innerHTML = "<span>⚡ Reloading...</span>";
      setTimeout(() => {
        chrome.runtime.reload();
      }, 150);
    });
  }

  // Button: Force Sync
  if (btnSync) {
    btnSync.addEventListener("click", () => {
      btnSync.disabled = true;
      btnSync.textContent = "Syncing...";
      chrome.runtime.sendMessage({ type: "TRIGGER_SYNC" }, () => {
        setTimeout(() => {
          btnSync.disabled = false;
          btnSync.innerHTML = "<span>🔄 Force Sync Sessions</span>";
          chrome.storage.local.get(["bridgeState"], (s) => {
            renderState(s.bridgeState || {});
          });
        }, 800);
      });
    });
  }

  // Button: Emergency Pause Toggle
  if (btnPauseToggle) {
    btnPauseToggle.addEventListener("click", () => {
      const nextState = !isQueuePaused;
      chrome.runtime.sendMessage({ type: "EMERGENCY_PAUSE_TOGGLE", paused: nextState }, () => {
        isQueuePaused = nextState;
        if (btnPauseToggle && pauseBtnText) {
          if (isQueuePaused) {
            btnPauseToggle.className = "btn-resume";
            pauseBtnText.textContent = "▶ Resume Scheduled Queue";
          } else {
            btnPauseToggle.className = "btn-pause";
            pauseBtnText.textContent = "🛑 Emergency Pause All";
          }
        }
      });
    });
  }

  // Individual Platform Direct Open & Logout Handlers
  async function openCanvas(platform, fallbackUrl) {
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
        return;
      }
    } catch (e) {
      console.warn("[MetaBridge] Tabs query error:", e);
    }
    chrome.tabs.create({ url: defaultUrl, active: true });
  }

  function logoutAccount(platform, buttonEl) {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "...";
    }
    chrome.runtime.sendMessage({
      type: "LOGOUT_PLATFORM",
      platform: platform
    }, () => {
      setTimeout(() => {
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.textContent = "Logout";
        }
        chrome.storage.local.get(["bridgeState"], (s) => {
          renderState(s.bridgeState || {});
        });
      }, 500);
    });
  }

  const btnPopupOpenIG = document.getElementById("btnPopupOpenIG");
  const btnPopupLogoutIG = document.getElementById("btnPopupLogoutIG");
  const btnPopupOpenFB = document.getElementById("btnPopupOpenFB");
  const btnPopupLogoutFB = document.getElementById("btnPopupLogoutFB");
  const btnPopupOpenBiz = document.getElementById("btnPopupOpenBiz");
  const btnPopupLogoutBiz = document.getElementById("btnPopupLogoutBiz");

  if (btnPopupOpenIG) btnPopupOpenIG.addEventListener("click", () => openCanvas("instagram", "https://www.instagram.com/"));
  if (btnPopupLogoutIG) btnPopupLogoutIG.addEventListener("click", () => logoutAccount("instagram", btnPopupLogoutIG));

  if (btnPopupOpenFB) btnPopupOpenFB.addEventListener("click", () => openCanvas("facebook", "https://www.facebook.com/"));
  if (btnPopupLogoutFB) btnPopupLogoutFB.addEventListener("click", () => logoutAccount("facebook", btnPopupLogoutFB));

  if (btnPopupOpenBiz) btnPopupOpenBiz.addEventListener("click", () => openCanvas("business_suite", "https://business.facebook.com/latest/composer"));
  if (btnPopupLogoutBiz) btnPopupLogoutBiz.addEventListener("click", () => logoutAccount("business_suite", btnPopupLogoutBiz));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPopup);
} else {
  initPopup();
}

