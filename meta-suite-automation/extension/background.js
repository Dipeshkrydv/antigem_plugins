/**
 * Antigravity Meta Bridge Extension - Background Service Worker
 * Zero-logic dumb bridge: extracts live cookies/tokens & relays DOM commands over WebSocket.
 */

const WS_URL = "ws://127.0.0.1:8765";
let ws = null;
let reconnectTimer = null;
let reconnectDelay = 2000;
const MAX_RECONNECT_DELAY = 15000;
let pingTimer = null;

// Connect to Local MCP Server WebSocket
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[MetaBridge] Connected to MCP server at " + WS_URL);
      reconnectDelay = 2000;
      updatePopupState({ connected: true, lastError: null });

      // Start 20s heartbeat ping to keep connection active
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING", timestamp: Date.now() }));
        }
      }, 20000);

      // Perform initial session sync immediately upon connection
      syncAllSessions();
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
        // Relay message to active sidepanel / popup views
        chrome.runtime.sendMessage(message).catch(() => {});
      } catch (err) {
        console.error("[MetaBridge] Failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      console.warn("[MetaBridge] WebSocket closed. Scheduling reconnect...");
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      ws = null;
      updatePopupState({ connected: false });
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error("[MetaBridge] WebSocket error:", err);
      updatePopupState({ connected: false, lastError: "WebSocket connection error" });
    };
  } catch (err) {
    console.error("[MetaBridge] WebSocket connection exception:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    connectWebSocket();
  }, reconnectDelay);
}

// Helper to broadcast state to chrome.storage for popup UI
function updatePopupState(partialState) {
  chrome.storage.local.get(["bridgeState"], (res) => {
    const current = res.bridgeState || {};
    const updated = { ...current, ...partialState, updatedAt: Date.now() };
    chrome.storage.local.set({ bridgeState: updated });
  });
}

// -------------------------------------------------------------
// 1. Session Sync: Instagram & Facebook Cookies & Page Tokens
// -------------------------------------------------------------
async function getCookiesForDomain(domain) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain }, (cookies) => {
      const cookieMap = {};
      if (cookies) {
        for (const c of cookies) {
          cookieMap[c.name] = c.value;
        }
      }
      resolve(cookieMap);
    });
  });
}

async function clearAllCookiesForPlatform(platform) {
  const plat = (platform || "all").toLowerCase();
  return new Promise((resolve) => {
    chrome.cookies.getAll({}, async (allCookies) => {
      if (!allCookies || allCookies.length === 0) {
        return resolve(0);
      }
      const matching = allCookies.filter((c) => {
        const d = (c.domain || "").toLowerCase();
        if (plat === "facebook" || plat === "business_suite") {
          return d.includes("facebook.com") || d.includes("fb.com") || d.includes("messenger.com");
        }
        if (plat === "instagram") {
          return d.includes("instagram.com");
        }
        if (plat === "youtube") {
          return d.includes("youtube.com") || d.includes("google.com");
        }
        if (plat === "tiktok") {
          return d.includes("tiktok.com");
        }
        if (plat === "all") {
          return (
            d.includes("facebook.com") ||
            d.includes("fb.com") ||
            d.includes("messenger.com") ||
            d.includes("instagram.com") ||
            d.includes("youtube.com") ||
            d.includes("tiktok.com")
          );
        }
        return d.includes(plat);
      });

      console.log(`[MetaBridge] Removing ${matching.length} cookies for platform: ${plat}`);
      const removePromises = matching.map((c) => {
        const protocol = c.secure ? "https:" : "http:";
        const cleanDomain = c.domain.replace(/^\./, "");
        const url = `${protocol}//${cleanDomain}${c.path || "/"}`;
        return new Promise((r) => {
          chrome.cookies.remove({ url, name: c.name, storeId: c.storeId }, () => {
            r();
          });
        });
      });

      await Promise.all(removePromises);
      console.log(`[MetaBridge] Finished removing ${matching.length} cookies for platform: ${plat}`);
      resolve(matching.length);
    });
  });
}

// Backward-compatibility wrapper
async function clearCookiesForDomain(domain) {
  return clearAllCookiesForPlatform(domain);
}

async function redirectOrClosePlatformTabs(platform) {
  const plat = (platform || "all").toLowerCase();
  let urlPatterns = [];
  let targetLoginUrl = "";

  if (plat === "facebook") {
    urlPatterns = ["*://*.facebook.com/*", "*://facebook.com/*"];
    targetLoginUrl = "https://www.facebook.com/login/";
  } else if (plat === "business_suite") {
    urlPatterns = ["*://business.facebook.com/*", "*://*.business.facebook.com/*"];
    targetLoginUrl = "https://business.facebook.com/";
  } else if (plat === "instagram") {
    urlPatterns = ["*://*.instagram.com/*", "*://instagram.com/*"];
    targetLoginUrl = "https://www.instagram.com/accounts/login/";
  } else if (plat === "youtube") {
    urlPatterns = ["*://*.youtube.com/*", "*://studio.youtube.com/*"];
    targetLoginUrl = "https://www.youtube.com/";
  } else if (plat === "tiktok") {
    urlPatterns = ["*://*.tiktok.com/*"];
    targetLoginUrl = "https://www.tiktok.com/login";
  } else if (plat === "all") {
    urlPatterns = [
      "*://*.facebook.com/*",
      "*://facebook.com/*",
      "*://business.facebook.com/*",
      "*://*.instagram.com/*",
      "*://*.youtube.com/*",
      "*://*.tiktok.com/*"
    ];
    targetLoginUrl = "https://www.facebook.com/login/";
  }

  if (urlPatterns.length > 0) {
    try {
      const tabs = await chrome.tabs.query({ url: urlPatterns });
      for (const tab of tabs) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try { localStorage.clear(); } catch (e) {}
              try { sessionStorage.clear(); } catch (e) {}
            }
          });
        } catch (e) {}

        if (targetLoginUrl) {
          chrome.tabs.update(tab.id, { url: targetLoginUrl }).catch(() => {});
        } else {
          chrome.tabs.reload(tab.id).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[MetaBridge] Could not redirect platform tabs on logout:", e);
    }
  }
}

async function syncAllSessions() {
  await Promise.all([
    syncInstagramSession(),
    syncFacebookSession(),
    syncBusinessSuiteSession(),
    syncYouTubeSession(),
    syncTikTokSession()
  ]);

  // Persist One-Time Setup Configuration
  chrome.storage.local.get(["bridgeState"], (res) => {
    const s = res.bridgeState || {};
    const oneTimeConfig = {
      isConfigured: !!(s.fbLoggedIn || s.igLoggedIn || s.businessSuiteLoggedIn || s.youtubeLoggedIn || s.tiktokLoggedIn),
      autoCanvas: true,
      facebook: { active: !!s.fbLoggedIn, user: s.fbUser },
      instagram: { active: !!s.igLoggedIn, user: s.igUser },
      businessSuite: { active: !!s.businessSuiteLoggedIn, user: s.businessSuiteUser },
      youtube: { active: !!s.youtubeLoggedIn, user: s.youtubeChannel },
      tiktok: { active: !!s.tiktokLoggedIn, user: s.tiktokUser },
      lastVerified: Date.now()
    };
    chrome.storage.local.set({ oneTimeConfig });
    console.log("[MetaBridge] Permanent One-Time Connection verified and saved.");
  });
}

// Helper to fetch Facebook user name in background if tab unavailable
async function fetchFacebookUserName() {
  try {
    const res = await fetch("https://www.facebook.com/", {
      credentials: "include",
      headers: { "Accept": "text/html,application/xhtml+xml,application/xml" }
    });
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/"CurrentUserInitialData",\[\],\{[^}]*"NAME":"([^"]+)"/i) ||
                  text.match(/"USER_NAME":"([^"]+)"/i) ||
                  text.match(/"NAME":"([A-Z][a-zA-Z\s]{2,30})"/i);
    if (match && match[1] && !match[1].includes("\\")) {
      return match[1].trim();
    }
  } catch (e) {
    console.warn("[MetaBridge] fetchFacebookUserName error:", e);
  }
  return null;
}

// Helper to fetch Instagram user handle in background if tab unavailable
async function fetchInstagramUserName() {
  try {
    const res = await fetch("https://www.instagram.com/", {
      credentials: "include",
      headers: { "Accept": "text/html,application/xhtml+xml" }
    });
    if (!res.ok) return null;
    const text = await res.text();
    const viewerMatch = text.match(/"viewer":\s*\{[^}]*"username":"([^"]+)"/i) ||
                        text.match(/"raw_viewer":\s*\{[^}]*"username":"([^"]+)"/i) ||
                        text.match(/"username":"([a-zA-Z0-9._]{3,30})","badge_count"/i);
    if (viewerMatch && viewerMatch[1]) {
      return viewerMatch[1].trim();
    }
  } catch (e) {
    console.warn("[MetaBridge] fetchInstagramUserName error:", e);
  }
  return null;
}

async function syncBusinessSuiteSession() {
  try {
    const fbCookies = await getCookiesForDomain(".facebook.com");
    const bizCookies = await getCookiesForDomain("business.facebook.com");
    const merged = { ...fbCookies, ...bizCookies };
    const cUser = merged["c_user"];
    const xs = merged["xs"];

    if (!cUser || !xs) {
      console.log("[MetaBridge] No active Meta Business Suite login found.");
      updatePopupState({
        businessSuiteLoggedIn: false,
        businessSuiteStatus: "offline",
        businessSuiteStatusLabel: "Offline",
        businessSuiteUser: "Meta Business Suite",
        businessSuitePages: []
      });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "SESSION_SYNC",
          platform: "business_suite",
          status: "offline",
          username: "Meta Business Suite",
          account_id: null,
          cookies: {},
          tokens: {}
        }));
      }
      return;
    }

    let tokens = {};
    let hasNoPages = false;
    let pages = [];

    // 0. Pre-load cached pages from storage so state is retained across navigation
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(["cachedPages", "discoveredPages"], resolve);
    });
    if (stored && Array.isArray(stored.cachedPages) && stored.cachedPages.length > 0) {
      pages = [...stored.cachedPages];
    } else if (stored && Array.isArray(stored.discoveredPages) && stored.discoveredPages.length > 0) {
      pages = [...stored.discoveredPages];
    }

    // 1. Query active Business Suite tab(s)
    const tabs = await chrome.tabs.query({ url: "*://business.facebook.com/*" });
    for (const tab of tabs) {
      // Direct URL Asset ID extraction (e.g. composer?asset_id=me)
      const assetMatch = tab.url && tab.url.match(/[?&](?:asset_id|page_id)=(\d+)/);
      if (assetMatch) {
        const aId = assetMatch[1];
        const pName = aId === "me" ? "Facebook Page" : (tab.title && !tab.title.includes("Meta") ? tab.title.split("|")[0].trim() : "Facebook Page");
        if (!pages.some(p => p.id === aId)) {
          pages.unshift({ id: aId, name: pName, category: "Facebook Page" });
        }
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_TOKENS" });
        if (response && response.tokens) {
          tokens = { ...tokens, ...response.tokens };
          if (response.tokens.pages && response.tokens.pages.length > 0) {
            for (const p of response.tokens.pages) {
              const idx = pages.findIndex(x => x.id === p.id);
              if (idx >= 0) {
                pages[idx] = { ...pages[idx], ...p };
              } else {
                pages.unshift(p);
              }
            }
          }
          if (response.tokens.hasNoPages && pages.length === 0) {
            hasNoPages = true;
          }
        }
      } catch (e) {}
    }

    // 2. Also inspect regular Facebook tabs for managed pages
    if (pages.length === 0) {
      const fbTabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
      for (const tab of fbTabs) {
        if (!tab.url.includes("business.facebook.com")) {
          try {
            const resp = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_TOKENS" });
            if (resp && resp.tokens && resp.tokens.pages && resp.tokens.pages.length > 0) {
              for (const p of resp.tokens.pages) {
                if (!pages.some(x => x.id === p.id)) pages.push(p);
              }
            }
          } catch (e) {}
        }
      }
    }

    // 3. Grounded Fallback: User's verified Facebook Page "Facebook Page"
    if (pages.length === 0 && (cUser === "me" || String(cUser).length >= 10)) {
      pages.push({
        id: "me",
        name: "Facebook Page",
        category: "Facebook Page"
      });
    }

    // Persist discovered pages so sidepanel/popup retain them
    if (pages.length > 0) {
      chrome.storage.local.set({ cachedPages: pages, discoveredPages: pages });
      hasNoPages = false;
    }

    const effectiveHasPages = pages.length > 0;
    const businessSuiteStatus = effectiveHasPages ? "online" : "no_pages";
    const statusLabel = effectiveHasPages ? "Online" : "No Pages Linked";
    const userDisplay = effectiveHasPages
      ? (pages[0].name || "Facebook Page")
      : "Personal Account (No Pages)";

    const payload = {
      type: "SESSION_SYNC",
      platform: "business_suite",
      account_id: pages.length > 0 ? pages[0].id : cUser,
      username: userDisplay,
      cookies: merged,
      tokens: { ...tokens, pages, hasNoPages: !effectiveHasPages, statusLabel },
      status: businessSuiteStatus,
      user_agent: navigator.userAgent
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      console.log("[MetaBridge] Synced Meta Business Suite session: status =", businessSuiteStatus, "page =", userDisplay);
    }

    updatePopupState({
      businessSuiteLoggedIn: effectiveHasPages || !!cUser,
      businessSuiteStatus: businessSuiteStatus,
      businessSuiteStatusLabel: statusLabel,
      businessSuiteUser: userDisplay,
      businessSuitePages: pages,
      businessSuiteHasNoPages: !effectiveHasPages
    });
  } catch (err) {
    console.error("[MetaBridge] Error syncing Business Suite session:", err);
  }
}

async function syncInstagramSession() {
  try {
    const igCookies = await getCookiesForDomain(".instagram.com");
    const dsUserId = igCookies["ds_user_id"];
    const sessionId = igCookies["sessionid"];

    if (!sessionId || !dsUserId) {
      console.log("[MetaBridge] No active Instagram login found.");
      updatePopupState({ igLoggedIn: false, igUser: null, igId: null });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "SESSION_SYNC",
          platform: "instagram",
          status: "logged_out",
          username: "Instagram Account",
          account_id: null,
          cookies: {},
          tokens: {}
        }));
      }
      return;
    }

    let tokens = {};
    const tabs = await chrome.tabs.query({ url: "*://*.instagram.com/*" });
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_TOKENS" });
        if (response && response.tokens && response.tokens.username) {
          tokens = response.tokens;
          break;
        }
      } catch (e) {}
    }

    let realHandle = tokens.username;
    if (!realHandle || realHandle === dsUserId) {
      realHandle = await fetchInstagramUserName();
    }

    // Check storage or fallback to formatted user
    if (!realHandle || realHandle === dsUserId) {
      const stored = await new Promise(r => chrome.storage.local.get(["bridgeState"], res => r(res.bridgeState || {})));
      if (stored.igUser && stored.igUser !== dsUserId && !/^\d+$/.test(stored.igUser)) {
        realHandle = stored.igUser;
      } else {
        realHandle = "creator";
      }
    }

    const finalHandle = (realHandle || "creator").replace(/^@/, "");

    const payload = {
      type: "SESSION_SYNC",
      platform: "instagram",
      account_id: dsUserId,
      username: finalHandle,
      cookies: igCookies,
      tokens: { ...tokens, username: finalHandle, userId: dsUserId },
      status: "healthy",
      user_agent: navigator.userAgent
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      console.log("[MetaBridge] Synced Instagram session for account:", finalHandle, `(${dsUserId})`);
    }

    updatePopupState({
      igLoggedIn: true,
      igUser: finalHandle,
      igId: dsUserId
    });
  } catch (err) {
    console.error("[MetaBridge] Error syncing Instagram session:", err);
  }
}

async function syncFacebookSession() {
  try {
    const fbCookies = await getCookiesForDomain(".facebook.com");
    const cUser = fbCookies["c_user"];
    const xs = fbCookies["xs"];

    if (!cUser || !xs) {
      console.log("[MetaBridge] No active Facebook login found.");
      updatePopupState({ fbLoggedIn: false, fbUser: null, fbId: null });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "SESSION_SYNC",
          platform: "facebook",
          status: "logged_out",
          username: "Facebook Profile",
          account_id: null,
          cookies: {},
          tokens: {}
        }));
      }
      return;
    }

    let tokens = {};
    const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_TOKENS" });
        if (response && response.tokens && response.tokens.userName) {
          tokens = response.tokens;
          break;
        }
      } catch (e) {}
    }

    let realName = tokens.userName;
    if (!realName || realName === cUser) {
      realName = await fetchFacebookUserName();
    }

    // Check storage or fallback to known profile name from Meta error dialog
    if (!realName || realName === cUser) {
      const stored = await new Promise(r => chrome.storage.local.get(["bridgeState"], res => r(res.bridgeState || {})));
      if (stored.fbUser && stored.fbUser !== cUser && !/^\d+$/.test(stored.fbUser)) {
        realName = stored.fbUser;
      } else if (cUser === "me") {
        realName = "Facebook User";
      }
    }

    const finalName = realName || "Facebook User";

    const payload = {
      type: "SESSION_SYNC",
      platform: "facebook",
      account_id: cUser,
      username: finalName,
      cookies: fbCookies,
      tokens: { ...tokens, userName: finalName, userId: cUser },
      status: "healthy",
      user_agent: navigator.userAgent
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      console.log("[MetaBridge] Synced Facebook session for account:", finalName, `(${cUser})`);
    }

    updatePopupState({
      fbLoggedIn: true,
      fbUser: finalName,
      fbId: cUser
    });
  } catch (err) {
    console.error("[MetaBridge] Error syncing Facebook session:", err);
  }
}

async function syncYouTubeSession() {
  try {
    const ytCookies = await getCookiesForDomain(".youtube.com");
    const googleCookies = await getCookiesForDomain(".google.com");
    const merged = { ...googleCookies, ...ytCookies };
    const hasLogin = !!(merged["LOGIN_INFO"] || merged["SAPISID"] || merged["SSID"] || merged["SID"] || merged["HSID"]);

    if (!hasLogin) {
      console.log("[MetaBridge] No active YouTube login found.");
      updatePopupState({ youtubeLoggedIn: false, youtubeChannel: null, youtubeHandle: null, youtubeNeedsSync: false });
      return;
    }

    let channelInfo = { channelId: null, channelName: null, handle: null };
    const tabs = await chrome.tabs.query({ url: ["*://studio.youtube.com/*", "*://*.youtube.com/*"] });
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_YOUTUBE_INFO" });
        if (response && response.info && response.info.channelName && response.info.channelName !== "YouTube Creator") {
          channelInfo = response.info;
          break;
        }
      } catch (e) {}
    }

    const hasRealChannel = !!(channelInfo.channelName && channelInfo.channelName !== "YouTube Creator");

    if (hasRealChannel) {
      const payload = {
        type: "SESSION_SYNC",
        platform: "youtube",
        account_id: channelInfo.channelId || "youtube_creator",
        username: channelInfo.channelName,
        handle: channelInfo.handle || `@${channelInfo.channelName.toLowerCase().replace(/\s+/g, "")}`,
        cookies: merged,
        status: "healthy",
        user_agent: navigator.userAgent
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        console.log("[MetaBridge] Synced YouTube session:", channelInfo.channelName);
      }

      updatePopupState({
        youtubeLoggedIn: true,
        youtubeChannel: channelInfo.channelName,
        youtubeHandle: channelInfo.handle,
        youtubeNeedsSync: false
      });
    } else {
      console.log("[MetaBridge] Google session detected. Syncing YouTube session readiness.");
      const fallbackName = popupState.youtubeChannel || "YouTube Creator";
      const payload = {
        type: "SESSION_SYNC",
        platform: "youtube",
        account_id: channelInfo.channelId || "youtube_creator",
        username: fallbackName,
        handle: channelInfo.handle || "@creator",
        cookies: merged,
        status: "healthy",
        user_agent: navigator.userAgent
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        console.log("[MetaBridge] Synced YouTube session (readiness standby):", fallbackName);
      }

      updatePopupState({
        youtubeLoggedIn: true,
        youtubeChannel: fallbackName,
        youtubeHandle: channelInfo.handle || "@creator",
        youtubeNeedsSync: false
      });
    }
  } catch (err) {
    console.error("[MetaBridge] Error syncing YouTube session:", err);
  }
}

async function syncTikTokSession() {
  try {
    const ttCookies = await getCookiesForDomain(".tiktok.com");
    const sessionId = ttCookies["sessionid"] || ttCookies["sessionid_ss"];

    if (!sessionId) {
      console.log("[MetaBridge] No active TikTok login found.");
      updatePopupState({ tiktokLoggedIn: false, tiktokUser: null });
      return;
    }

    let accountInfo = { handle: null, nickname: null };
    const tabs = await chrome.tabs.query({ url: "*://*.tiktok.com/*" });
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_TIKTOK_INFO" });
        if (response && response.info) {
          accountInfo = response.info;
          break;
        }
      } catch (e) {}
    }

    const payload = {
      type: "SESSION_SYNC",
      platform: "tiktok",
      account_id: accountInfo.handle || sessionId.slice(0, 12),
      username: accountInfo.nickname || accountInfo.handle || "TikTok Creator",
      handle: accountInfo.handle || "@tiktok_creator",
      cookies: ttCookies,
      status: "healthy",
      user_agent: navigator.userAgent
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      console.log("[MetaBridge] Synced TikTok session:", accountInfo.handle || accountInfo.nickname);
    }

    updatePopupState({
      tiktokLoggedIn: true,
      tiktokUser: accountInfo.handle || accountInfo.nickname || "TikTok Creator"
    });
  } catch (err) {
    console.error("[MetaBridge] Error syncing TikTok session:", err);
  }
}

// -------------------------------------------------------------
// 2. DOM Instruction Relay Worker
// -------------------------------------------------------------
async function handleServerMessage(message) {
  const { type, id, instruction, params } = message;

  if (type === "PING") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
    }
    return;
  }

  if (type === "FORCE_SESSION_SYNC") {
    await syncAllSessions();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "SYNC_COMPLETE", id }));
    }
    return;
  }

  if (type === "RELOAD_EXTENSION") {
    console.log("[MetaBridge] Reloading extension worker...");
    chrome.runtime.reload();
    return;
  }

  if (type === "DOM_INSTRUCTION") {
    try {
      const result = await executeDomInstruction(instruction, params || {});
      sendDomResult(id, "success", result);
    } catch (err) {
      sendDomResult(id, "error", null, err.message || String(err));
    }
  }
}

function sendDomResult(id, status, data = null, error = null) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "DOM_RESULT",
      id,
      status,
      data,
      error
    }));
  }
}

async function getOrOpenTab(urlPattern, defaultUrl) {
  const tabs = await chrome.tabs.query({ url: urlPattern });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    return tabs[0];
  }
  return await chrome.tabs.create({ url: defaultUrl, active: true });
}

async function executeDomInstruction(instruction, params) {
  switch (instruction) {
    case "OPEN_TAB": {
      const tab = await chrome.tabs.create({ url: params.url, active: params.active ?? true });
      return { tabId: tab.id, url: tab.url };
    }

    case "FOCUS_TAB": {
      if (params.tabId) {
        await chrome.tabs.update(params.tabId, { active: true });
        return { tabId: params.tabId, active: true };
      }
      throw new Error("tabId required for FOCUS_TAB");
    }

    case "OPEN_OR_FOCUS_TAB": {
      let pattern = ["*://facebook.com/*", "*://*.facebook.com/*"];
      let defaultUrl = "https://www.facebook.com/";
      if (params.platform === "instagram") {
        pattern = ["*://instagram.com/*", "*://*.instagram.com/*"];
        defaultUrl = "https://www.instagram.com/";
      } else if (params.platform === "business_suite") {
        pattern = ["*://business.facebook.com/*", "*://*.business.facebook.com/*"];
        defaultUrl = "https://business.facebook.com/latest/composer";
      } else if (params.platform === "youtube") {
        pattern = ["*://studio.youtube.com/*", "*://*.youtube.com/*"];
        defaultUrl = "https://studio.youtube.com";
      } else if (params.platform === "tiktok") {
        pattern = ["*://*.tiktok.com/creator-center/*", "*://*.tiktok.com/upload*", "*://*.tiktok.com/*"];
        defaultUrl = "https://www.tiktok.com/creator-center/upload";
      }
      if (params.url) defaultUrl = params.url;

      const tabs = await chrome.tabs.query({ url: pattern });
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          try { await chrome.windows.update(tabs[0].windowId, { focused: true }); } catch (e) {}
        }
        return { tabId: tabs[0].id, action: "focused", url: tabs[0].url };
      } else {
        const tab = await chrome.tabs.create({ url: defaultUrl, active: true });
        return { tabId: tab.id, action: "opened", url: tab.url };
      }
    }

    case "LOGOUT_PLATFORM": {
      const platform = (params.platform || "all").toLowerCase();
      console.log(`[MetaBridge] Logging out platform: ${platform}`);
      await clearAllCookiesForPlatform(platform);
      await redirectOrClosePlatformTabs(platform);

      const updates = {};
      if (platform === "instagram" || platform === "all") {
        updates.igLoggedIn = false;
        updates.igUser = null;
        updates.igId = null;
      }
      if (platform === "facebook" || platform === "all") {
        updates.fbLoggedIn = false;
        updates.fbUser = null;
        updates.fbId = null;
      }
      if (platform === "business_suite" || platform === "all" || platform === "facebook") {
        updates.businessSuiteLoggedIn = false;
        updates.businessSuiteUser = null;
        updates.businessSuitePages = [];
        updates.businessSuiteHasNoPages = true;
        updates.businessSuiteStatus = "offline";
        updates.businessSuiteStatusLabel = "Offline";
        hasAutoOpenedBizSuite = false;
        chrome.storage.local.remove(["cachedPages", "discoveredPages"]);
      }
      if (platform === "youtube" || platform === "all") {
        updates.youtubeLoggedIn = false;
        updates.youtubeChannel = null;
        updates.youtubeHandle = null;
      }
      if (platform === "tiktok" || platform === "all") {
        updates.tiktokLoggedIn = false;
        updates.tiktokUser = null;
      }
      updatePopupState(updates);

      return { status: "logged_out", platform };
    }

    case "EXECUTE_CONTENT_ACTION":
    case "CLICK_SELECTOR":
    case "TYPE_HUMAN_TEXT":
    case "UPLOAD_FILE_INPUT":
    case "INJECT_FILE_DATATRANSFER":
    case "AUTONOMOUS_FACEBOOK_POST":
    case "AUTONOMOUS_BUSINESS_SUITE_POST":
    case "AUTONOMOUS_INSTAGRAM_POST":
    case "AUTONOMOUS_YOUTUBE_POST":
    case "AUTONOMOUS_TIKTOK_POST":
    case "SCROLL":
    case "DELETE_POST_DOM":
    case "EDIT_POST_DOM":
    case "PURGE_DUMMY_POSTS_DOM":
    case "EXTRACT_PAGE_DATA": {
      // Autonomous canvas detection: Find matching tab or open one automatically
      let targetTabId = params.tabId;
      if (!targetTabId) {
        let pattern = ["*://business.facebook.com/*", "*://*.business.facebook.com/*"];
        let defaultUrl = "https://business.facebook.com/latest/composer";

        if (params.platform === "instagram") {
          pattern = ["*://instagram.com/*", "*://*.instagram.com/*"];
          defaultUrl = "https://www.instagram.com/";
        } else if (params.platform === "youtube" || instruction === "AUTONOMOUS_YOUTUBE_POST") {
          pattern = ["*://studio.youtube.com/*", "*://*.youtube.com/*"];
          defaultUrl = "https://studio.youtube.com";
        } else if (params.platform === "tiktok" || instruction === "AUTONOMOUS_TIKTOK_POST") {
          pattern = ["*://*.tiktok.com/creator-center/upload*", "*://*.tiktok.com/upload*", "*://*.tiktok.com/*"];
          defaultUrl = "https://www.tiktok.com/creator-center/upload";
        } else if (instruction === "AUTONOMOUS_FACEBOOK_POST" || params.target_type === "profile" || (params.target_url && params.target_url.includes("facebook.com") && !params.target_url.includes("business.facebook.com"))) {
          pattern = ["*://www.facebook.com/*", "*://facebook.com/*", "*://web.facebook.com/*"];
          defaultUrl = params.target_url || "https://www.facebook.com/";
        } else {
          pattern = ["*://business.facebook.com/*", "*://*.business.facebook.com/*"];
          defaultUrl = "https://business.facebook.com/latest/composer";
        }

        if (params.target_url) {
          defaultUrl = params.target_url;
        }

        let tabs = [];
        if (params.platform === "youtube" || instruction === "AUTONOMOUS_YOUTUBE_POST") {
          tabs = await chrome.tabs.query({ url: "*://studio.youtube.com/*" });
          if (tabs.length === 0) {
            tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
          }
        } else {
          tabs = await chrome.tabs.query({ url: pattern });
        }

        if (tabs.length === 0) {
          // Autonomous navigation: open single canvas tab sequentially
          const newTab = await chrome.tabs.create({ url: defaultUrl, active: true });
          targetTabId = newTab.id;
          // Fast poll for tab to complete loading (replaces 4.5s freeze)
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 200));
            try {
              const t = await chrome.tabs.get(targetTabId);
              if (t.status === "complete") break;
            } catch (e) {}
          }
          await new Promise((r) => setTimeout(r, 1200));
        } else {
          // RULE #4: Execute everything sequentially inside a single active tab
          const activeTab = tabs.find(t => t.active) || tabs[0];
          targetTabId = activeTab.id;

          // For Facebook posting: stay on tab if on feed/profile, but navigate if stuck on photo/media/permalink viewer
          const isFbPost = instruction === "AUTONOMOUS_FACEBOOK_POST" || params.target_type === "profile";
          const isFbSubpage = activeTab.url && (activeTab.url.includes("/photo") || activeTab.url.includes("/permalink") || activeTab.url.includes("/watch") || activeTab.url.includes("/stories") || activeTab.url.includes("/messages"));
          const alreadyOnFb = activeTab.url && activeTab.url.includes("facebook.com") && !activeTab.url.includes("business.facebook.com") && !isFbSubpage;
          const isBizPost = instruction === "AUTONOMOUS_BUSINESS_SUITE_POST";
          const hasMatchingAsset = !params.target_id || (activeTab.url && activeTab.url.includes(`asset_id=${params.target_id}`));
          const alreadyOnBizComposer = activeTab.url && activeTab.url.includes("business.facebook.com/latest/composer") && hasMatchingAsset;

          if ((!isFbPost || !alreadyOnFb) && (!isBizPost || !alreadyOnBizComposer)) {
            const destUrl = (isBizPost && params.target_id && params.target_id !== "me") ? `https://business.facebook.com/latest/composer?asset_id=${params.target_id}` : (isBizPost ? "https://business.facebook.com/latest/composer" : defaultUrl);
            if (destUrl && (!activeTab.url || !activeTab.url.startsWith(destUrl.replace(/\/$/, "")))) {
              await chrome.tabs.update(targetTabId, { url: destUrl, active: true });
              await new Promise((r) => setTimeout(r, 600));
              for (let i = 0; i < 25; i++) {
                await new Promise((r) => setTimeout(r, 200));
                try {
                  const t = await chrome.tabs.get(targetTabId);
                  if (t.status === "complete") break;
                } catch (e) {}
              }
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
      }

      // Send instruction packet to content script with auto-injection fallback
      const isYt = instruction === "AUTONOMOUS_YOUTUBE_POST" || params.platform === "youtube";
      const isTt = instruction === "AUTONOMOUS_TIKTOK_POST" || params.platform === "tiktok";
      const scriptMessage = isYt
        ? { type: "AUTONOMOUS_YOUTUBE_POST", params: params }
        : isTt
        ? { type: "AUTONOMOUS_TIKTOK_POST", params: params }
        : { type: "RELAY_DOM_ACTION", action: instruction, params: params };

      return await sendToContentScriptWithAutoInject(targetTabId, scriptMessage);
    }

    default:
      throw new Error(`Unknown DOM instruction: ${instruction}`);
  }
}

async function sendToContentScriptWithAutoInject(tabId, message) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (e) {}

  return new Promise((resolve, reject) => {
    function trySend(attempt) {
      chrome.tabs.sendMessage(tabId, message, async (response) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || "";
          console.warn(`[MetaBridge] tab ${tabId} message attempt ${attempt} warning:`, errMsg);

          if (attempt <= 3 && (
            errMsg.includes("Receiving end does not exist") ||
            errMsg.includes("Could not establish connection") ||
            errMsg.includes("message channel closed")
          )) {
            try {
              let files = ["stealth_engine.js", "content_bridge.js"];
              try {
                const targetTab = await chrome.tabs.get(tabId);
                const tabUrl = (targetTab && targetTab.url) || "";
                if (tabUrl.includes("youtube.com")) {
                  files = ["stealth_engine.js", "youtube_driver.js"];
                } else if (tabUrl.includes("tiktok.com")) {
                  files = ["stealth_engine.js", "tiktok_driver.js"];
                }
              } catch (tabErr) {}

              console.log(`[MetaBridge] Auto-injecting ${files.join(", ")} into tab ${tabId}...`);
              await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: files
              });
              await new Promise((r) => setTimeout(r, 800));
              return trySend(attempt + 1);
            } catch (injectErr) {
              console.warn(`[MetaBridge] Injection error: ${injectErr.message}. Retrying...`);
              await new Promise((r) => setTimeout(r, 1500));
              return trySend(attempt + 1);
            }
          }
          return reject(new Error(errMsg));
        }

        if (response && response.error) {
          return reject(new Error(response.error));
        }
        resolve(response ? response.data : {});
      });
    }

    trySend(1);
  });
}

// -------------------------------------------------------------
// 3. Cookie and Tab Event Listeners (One-Time Continuous Sync & Auto-Open)
// -------------------------------------------------------------
let cookieDebounceTimer = null;
let isLoggingOut = false;
let hasAutoOpenedBizSuite = false;

async function autoOpenMetaBusinessSuite() {
  if (hasAutoOpenedBizSuite) {
    return;
  }

  try {
    const fbCookies = await getCookiesForDomain(".facebook.com");
    if (!fbCookies["c_user"] || !fbCookies["xs"]) return;

    // Check if Meta Business Suite tab is already open
    const existing = await chrome.tabs.query({ url: "*://business.facebook.com/*" });
    if (existing && existing.length > 0) {
      hasAutoOpenedBizSuite = true;
      console.log("[MetaBridge] Meta Business Suite tab already exists:", existing[0].id);
      syncBusinessSuiteSession();
      return;
    }

    // Determine target URL: prefer composer with known page ID, fallback to latest/home
    const stored = await new Promise(r => chrome.storage.local.get(["cachedPages"], res => r(res.cachedPages || [])));
    let targetUrl = "https://business.facebook.com/latest/home";
    if (stored && stored.length > 0 && stored[0].id && stored[0].id !== "me") {
      targetUrl = `https://business.facebook.com/latest/composer?asset_id=${stored[0].id}`;
    }

    hasAutoOpenedBizSuite = true;
    console.log("[MetaBridge] Auto-opening Meta Business Suite after Facebook login:", targetUrl);
    
    // Auto-open Meta Business Suite in Chrome
    await chrome.tabs.create({ url: targetUrl, active: true });

    // Ensure MCP WebSocket is connected
    connectWebSocket();

    // Sync all sessions after canvas loads
    setTimeout(() => {
      syncAllSessions();
    }, 3500);
  } catch (err) {
    console.warn("[MetaBridge] autoOpenMetaBusinessSuite error:", err);
  }
}

chrome.cookies.onChanged.addListener((changeInfo) => {
  // CRITICAL: Reset auto-open flag on logout or cookie removal
  if (changeInfo.removed) {
    if (changeInfo.cookie && changeInfo.cookie.name === "c_user") {
      hasAutoOpenedBizSuite = false;
    }
    return;
  }
  if (isLoggingOut) return;

  const { domain, name } = changeInfo.cookie;
  if (domain.includes("instagram.com") && ["sessionid", "ds_user_id", "csrftoken"].includes(name)) {
    if (cookieDebounceTimer) clearTimeout(cookieDebounceTimer);
    cookieDebounceTimer = setTimeout(() => syncInstagramSession(), 2000);
  }
  if (domain.includes("facebook.com") && ["c_user", "xs"].includes(name)) {
    if (cookieDebounceTimer) clearTimeout(cookieDebounceTimer);
    cookieDebounceTimer = setTimeout(async () => {
      connectWebSocket();
      await syncFacebookSession();
      await syncBusinessSuiteSession();
      await autoOpenMetaBusinessSuite();
    }, 2000);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Keep MCP bridge WebSocket connected on tab completion
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }

    if (tab.url.includes("instagram.com")) {
      syncInstagramSession();
    } else if (tab.url.includes("business.facebook.com")) {
      syncBusinessSuiteSession();
    } else if (tab.url.includes("facebook.com")) {
      syncFacebookSession();
      syncBusinessSuiteSession();
      autoOpenMetaBusinessSuite();
    }
  }
});

// Listen for popup & side panel messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TRIGGER_SYNC" || msg.type === "POPUP_OPENED") {
    connectWebSocket();
    syncAllSessions().then(() => sendResponse({ status: "ok", connected: ws && ws.readyState === WebSocket.OPEN }));
    return true;
  }
  if (msg.type === "SUPERVISOR_HARD_LOCK") {
    console.error(`[MetaBridge] SUPERVISOR_HARD_LOCK triggered: "${msg.phrase}"`);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "SUPERVISOR_HARD_LOCK",
        phrase: msg.phrase,
        url: msg.url,
        account_id: "me",
        platform: "facebook"
      }));
    }
    updatePopupState({ queuePaused: true, hardLocked: true, lockReason: msg.phrase });
    sendResponse({ status: "locked" });
    return true;
  }
  if (msg.type === "EMERGENCY_PAUSE_TOGGLE") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "EMERGENCY_PAUSE_TOGGLE",
        paused: msg.paused
      }));
    }
    updatePopupState({ queuePaused: msg.paused });
    sendResponse({ status: "ok" });
    return true;
  }
  if (msg.type === "WS_SEND") {
    connectWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg.payload));
      sendResponse({ status: "sent" });
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (ws && ws.readyState === WebSocket.OPEN) {
          clearInterval(interval);
          ws.send(JSON.stringify(msg.payload));
          sendResponse({ status: "sent" });
        } else if (attempts > 40) {
          clearInterval(interval);
          sendResponse({ status: "error", error: "WebSocket not connected. Please ensure python3 cli.py bridge is running." });
        }
      }, 100);
    }
    return true;
  }
  if (msg.type === "LOGOUT_PLATFORM") {
    const platform = (msg.platform || "all").toLowerCase();
    console.log(`[MetaBridge] Direct logout request for: ${platform}`);
    (async () => {
      try {
        isLoggingOut = true;
        await clearAllCookiesForPlatform(platform);
        await redirectOrClosePlatformTabs(platform);

        const updates = {};
        if (platform === "instagram" || platform === "all") {
          updates.igLoggedIn = false;
          updates.igUser = null;
          updates.igId = null;
        }
        if (platform === "facebook" || platform === "all") {
          updates.fbLoggedIn = false;
          updates.fbUser = null;
          updates.fbId = null;
        }
        if (platform === "business_suite" || platform === "all" || platform === "facebook") {
          updates.businessSuiteLoggedIn = false;
          updates.businessSuiteUser = null;
          updates.businessSuitePages = [];
          updates.businessSuiteHasNoPages = true;
          updates.businessSuiteStatus = "offline";
          updates.businessSuiteStatusLabel = "Offline";
          chrome.storage.local.remove(["cachedPages", "discoveredPages"]);
        }
        if (platform === "youtube" || platform === "all") {
          updates.youtubeLoggedIn = false;
          updates.youtubeChannel = null;
          updates.youtubeHandle = null;
        }
        if (platform === "tiktok" || platform === "all") {
          updates.tiktokLoggedIn = false;
          updates.tiktokUser = null;
        }
        updatePopupState(updates);

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "LOGOUT_ACCOUNT", platform: platform }));
        }

        setTimeout(() => {
          isLoggingOut = false;
        }, 3000);

        sendResponse({ status: "ok", platform });
      } catch (err) {
        isLoggingOut = false;
        console.error("[MetaBridge] Logout error:", err);
        sendResponse({ status: "error", error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "YOUTUBE_TAB_MOUNTED") {
    if (msg.info) {
      updatePopupState({
        youtubeLoggedIn: true,
        youtubeChannel: msg.info.channelName || msg.info.handle || "YouTube Creator",
        youtubeHandle: msg.info.handle
      });
      syncYouTubeSession();
    }
    return true;
  }

  if (msg.type === "TIKTOK_TAB_MOUNTED") {
    if (msg.info) {
      updatePopupState({
        tiktokLoggedIn: true,
        tiktokUser: msg.info.handle || msg.info.nickname || "TikTok Creator"
      });
      syncTikTokSession();
    }
    return true;
  }
  if (msg.type === "OPEN_PLATFORM_TAB") {
    (async () => {
      try {
        const res = await executeDomInstruction("OPEN_OR_FOCUS_TAB", { platform: msg.platform, url: msg.url });
        sendResponse({ status: "ok", data: res });
      } catch (err) {
        sendResponse({ status: "error", error: err.message });
      }
    })();
    return true;
  }
});

// Listen for keepalive connections from active FB/IG tabs
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "meta-bridge-keepalive") {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  }
});

// Periodic keepalive alarm (1 min minimum in Chrome MV3)
try {
  chrome.alarms.create("keepAliveWs", { periodInMinutes: 1 });
} catch (e) {
  console.warn("[MetaBridge] Could not create keepalive alarm:", e);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAliveWs") {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  }
});

// Initial WebSocket connection attempt
connectWebSocket();
