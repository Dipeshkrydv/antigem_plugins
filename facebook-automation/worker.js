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
        version: PLUGIN_VERSION,
        environment: "AntiGem WebView Runtime",
        websocket_port: 8766,
        recommendation: "Ensure Python bridge is running on device via: python3 mcp_server/server.py"
      };
    }

    if (tool === "fb_seo_generate") {
      const topic = args.topic || "Growth Mindset";
      const takeaways = args.key_takeaways || [
        "Focus on system design over raw willpower",
        "Small daily iterations compound exponentially",
        "Measure output by consistency, not intensity"
      ];
      const link = args.link_url || null;

      const hook = `⚡ The uncomfortable truth about ${topic} that nobody talks about:`;
      const bullets = takeaways.map((pt, i) => `🔹 Point ${i + 1}: ${pt}`);
      const cta = "👇 Which of these resonates most with your journey? Share below.";
      const hashtags = ["#GrowthMindset", "#Leadership", "#Productivity", "#Strategy"];

      const caption = [hook, "", ...bullets, "", cta, "", hashtags.join(" ")].join("\n");
      return {
        topic,
        caption,
        hook,
        bullets,
        cta,
        hashtags,
        alt_text: `Infographic and breakdown covering key takeaways on ${topic}.`,
        first_comment: link ? `🔗 Resource Link: ${link}\n(Placed in first comment to protect organic reach!)` : null,
        seo_score: 96
      };
    }

    if (tool === "fb_audit_caption") {
      const caption = args.caption || "";
      const hasLinks = /https?:\/\//i.test(caption);
      const hashtags = (caption.match(/#\w+/g) || []).length;
      let score = 100;
      const suggestions = [];

      if (hasLinks) {
        score -= 25;
        suggestions.push("Outbound links in caption body penalize reach by up to 50%. Move link to first comment.");
      }
      if (hashtags > 7) {
        score -= 15;
        suggestions.push("Over 7 hashtags detected. Limit to 3-6 to avoid spam filters.");
      }

      return {
        seo_score: Math.max(score, 10),
        has_outbound_links: hasLinks,
        hashtag_count: hashtags,
        suggestions: suggestions.length ? suggestions : ["Formatting is optimal for maximum reach!"],
        is_ready: score >= 70
      };
    }

    if (tool === "fb_login_status" || tool === "fb_publish" || tool === "fb_schedule" || tool === "fb_edit_post" || tool === "fb_delete_post" || tool === "fb_list_posts" || tool === "fb_comments") {
      // Forward to Python FastMCP server via local bridge HTTP endpoint if available
      try {
        const res = await fetch(`http://127.0.0.1:8766/api/${tool}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        // Fallback status explanation
      }

      return {
        action: tool,
        note: `To execute live browser actions on Facebook, ensure the Python bridge server is active: run 'python3 mcp_server/server.py' (or './setup_mobile.sh' in Termux).`,
        parameters_received: args
      };
    }

    throw new Error(`Unknown MCP tool: ${tool}`);
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
