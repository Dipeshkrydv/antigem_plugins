/**
 * Background Service Worker: Facebook WebSocket Bridge Client (v1.1.0)
 * Connects to ws://127.0.0.1:8766 and relays commands to Facebook DOM tabs.
 * Automatically opens Facebook in the browser, waits for tab load, checks cookies
 * for one-time login verification, and injects content_bridge.js if needed.
 */

const WS_URL = "ws://127.0.0.1:8766";
const FB_HOME_URL = "https://www.facebook.com/";
let socket = null;
let reconnectTimer = null;
let isConnecting = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectBridge() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  isConnecting = true;

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      isConnecting = false;
      console.log("[FB Bridge] Connected to MCP server at " + WS_URL);
      chrome.storage.local.set({ bridge_connected: true, last_connected_at: Date.now() });

      socket.send(
        JSON.stringify({
          type: "STATUS",
          client_info: {
            client: "antigravity-facebook-extension",
            version: "1.1.0",
            platform: navigator.userAgent
          }
        })
      );
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "MCP_COMMAND") {
          await handleMcpCommand(message);
        }
      } catch (err) {
        console.error("[FB Bridge] Error handling message:", err);
      }
    };

    socket.onclose = () => {
      isConnecting = false;
      socket = null;
      chrome.storage.local.set({ bridge_connected: false });
      scheduleReconnect();
    };

    socket.onerror = (err) => {
      console.warn("[FB Bridge] WebSocket error:", err);
      if (socket) socket.close();
    };
  } catch (err) {
    isConnecting = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectBridge, 3000);
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === "complete" && tab.url && tab.url !== "about:blank") {
        return tab;
      }
    } catch (_) {}
    await sleep(350);
  }
  return await chrome.tabs.get(tabId).catch(() => null);
}

async function findOrCreateFacebookTab(targetUrl = null, activate = true) {
  const tabs = await chrome.tabs.query({ url: ["*://*.facebook.com/*", "*://facebook.com/*"] });
  let tab = tabs.length > 0 ? tabs[0] : null;

  if (!tab) {
    tab = await chrome.tabs.create({ url: targetUrl || FB_HOME_URL, active: activate });
    await waitForTabComplete(tab.id, 25000);
    await sleep(1000);
    return tab;
  }

  const updateProps = {};
  if (activate && !tab.active) updateProps.active = true;
  if (targetUrl && tab.url !== targetUrl) updateProps.url = targetUrl;

  if (Object.keys(updateProps).length > 0) {
    tab = await chrome.tabs.update(tab.id, updateProps);
    await waitForTabComplete(tab.id, 25000);
    await sleep(800);
  } else if (tab.status !== "complete") {
    await waitForTabComplete(tab.id, 15000);
  }

  return tab;
}

async function getFacebookAuthCookieState() {
  try {
    if (chrome.cookies && typeof chrome.cookies.getAll === "function") {
      const cookies = await chrome.cookies.getAll({ domain: "facebook.com" });
      const cUser = cookies.find((c) => c.name === "c_user" && c.value && c.value !== "0");
      const xs = cookies.find((c) => c.name === "xs" && c.value);
      return {
        hasAuthCookies: Boolean(cUser && xs),
        cookieUserId: cUser ? cUser.value : null
      };
    }
  } catch (_) {}
  return { hasAuthCookies: false, cookieUserId: null };
}

async function sendMessageToTabWithRetry(tabId, message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) resolve({ __sendError: err.message });
        else resolve(response);
      });
    });

    if (!res || !res.__sendError) {
      return res;
    }

    // Inject content_bridge.js dynamically if the tab was just opened
    if (attempt === 0 && chrome.scripting && typeof chrome.scripting.executeScript === "function") {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content_bridge.js"]
        });
        await sleep(500);
      } catch (_) {}
    }
  }
  throw new Error("Content script unreachable on Facebook tab after retry.");
}

async function handleMcpCommand(command) {
  const { request_id, action, payload = {} } = command;

  try {
    let targetUrl = payload.target_url || null;
    if (!targetUrl && action === "PUBLISH_POST") {
      if (payload.post_type === "reel") targetUrl = "https://www.facebook.com/reels/create";
      else if (payload.post_type === "story") targetUrl = "https://www.facebook.com/stories/create";
      else if (payload.target_type === "page" && payload.target_id) {
        targetUrl = `https://www.facebook.com/${payload.target_id}`;
      } else if (payload.target_type === "group" && payload.target_id) {
        targetUrl = `https://www.facebook.com/groups/${payload.target_id}`;
      }
    }

    const tab = await findOrCreateFacebookTab(targetUrl, true);
    if (!tab || !tab.id) {
      throw new Error("Could not find or open a Facebook tab in the browser.");
    }

    const cookieState = await getFacebookAuthCookieState();
    const enrichedPayload = {
      ...payload,
      __cookieState: cookieState
    };

    const response = await sendMessageToTabWithRetry(tab.id, {
      action,
      payload: enrichedPayload
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "MCP_RESPONSE",
          request_id,
          ...response
        })
      );
    }
  } catch (err) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "MCP_RESPONSE",
          request_id,
          success: false,
          stop_loop: true,
          error: err.message
        })
      );
    }
  }
}

// Alarms & Keep-alive
chrome.alarms.create("bridge_heartbeat", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "bridge_heartbeat") {
    connectBridge();
  }
});

connectBridge();
