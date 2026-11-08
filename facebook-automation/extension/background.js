/**
 * Background Service Worker: Facebook WebSocket Bridge Client
 * Connects to ws://127.0.0.1:8766 and relays commands to Facebook DOM tabs.
 */

const WS_URL = "ws://127.0.0.1:8766";
let socket = null;
let reconnectTimer = null;
let isConnecting = false;

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

      // Send initial status
      socket.send(JSON.stringify({
        type: "STATUS",
        client_info: {
          client: "antigravity-facebook-extension",
          version: "1.0.0",
          platform: navigator.userAgent
        }
      }));
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

async function findOrCreateFacebookTab() {
  const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
  if (tabs.length > 0) {
    return tabs[0];
  }
  // Open new Facebook tab if none exists
  return await chrome.tabs.create({ url: "https://www.facebook.com/", active: false });
}

async function handleMcpCommand(command) {
  const { request_id, action, payload } = command;

  try {
    const tab = await findOrCreateFacebookTab();
    if (!tab || !tab.id) {
      throw new Error("Could not find or create a Facebook tab.");
    }

    // Forward command to content script
    chrome.tabs.sendMessage(tab.id, { action, payload }, (response) => {
      const lastErr = chrome.runtime.lastError;
      let replyPayload;

      if (lastErr) {
        replyPayload = {
          type: "MCP_RESPONSE",
          request_id: request_id,
          success: false,
          error: "Content script unreachable on Facebook tab: " + lastErr.message
        };
      } else {
        replyPayload = {
          type: "MCP_RESPONSE",
          request_id: request_id,
          ...response
        };
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(replyPayload));
      }
    });
  } catch (err) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "MCP_RESPONSE",
        request_id: request_id,
        success: false,
        error: err.message
      }));
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

// Start connection on service worker init
connectBridge();
