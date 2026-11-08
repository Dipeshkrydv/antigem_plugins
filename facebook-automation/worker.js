// AntiGem WebView MCP Service Worker for Facebook Automation Studio
const PLUGIN_ID = "facebook-automation";
const PLUGIN_VERSION = "1.0.0";

self.addEventListener("install", (event) => {
  console.log(`[${PLUGIN_ID}] Service Worker installed (v${PLUGIN_VERSION})`);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log(`[${PLUGIN_ID}] Service Worker activated`);
  if (self.clients && self.clients.claim) {
    event.waitUntil(self.clients.claim());
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "mcp_tool_call") return false;

  (async () => {
    const tool = message.tool;
    const args = message.args || {};

    if (tool === "fb_status") {
      return {
        id: PLUGIN_ID,
        name: "Facebook Automation & SEO Studio",
        version: PLUGIN_VERSION,
        status: "ready",
        bridge_port: 8766,
        features: {
          anti_duplicate: "SHA-256 media checksum + normalized caption text hash",
          in_flight_lock: "Atomic SQLite lock with TTL",
          mobile_ready: "Optimized for Kiwi Browser on Android & Chrome Desktop",
          seo_engine: "Algorithm-optimized post formatting with first-comment links"
        }
      };
    }

    if (tool === "fb_doctor") {
      return {
        status: "healthy",
        plugin: PLUGIN_ID,
        version: PLUGIN_VERSION
      };
    }

    throw new Error(`MCP Tool '${tool}' must be executed via Python FastMCP server (mcp_server/server.py).`);
  })()
    .then(result => sendResponse({
      isError: false,
      content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }]
    }))
    .catch(error => sendResponse({
      isError: true,
      content: [{ type: "text", text: error.message }]
    }));

  return true;
});
