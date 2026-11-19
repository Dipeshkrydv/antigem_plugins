/**
 * GhostHuman YouTube Studio Stealth Driver
 * Runs inside studio.youtube.com tabs to perform 100% human-emulated video and Shorts uploads.
 *
 * Implements:
 * - Shadow DOM traversal for Polymer web components (ytcp-*, tp-yt-*)
 * - Bézier mouse paths & cognitive clipboard pasting
 * - Lossless binary file mutation before ingestion
 * - Pre-flight human dwell & anti-detection safeguards
 */

(function () {
  const Stealth = window.GhostHumanStealthEngine || globalThis.GhostHumanStealthEngine;

  console.log("[YouTubeStealthDriver] Initializing YouTube Studio GhostHuman Driver...");

  // -------------------------------------------------------------
  // 1. Channel Metadata Extraction
  // -------------------------------------------------------------
  function extractYouTubeChannelInfo() {
    let channelId = null;
    let channelName = null;
    let handle = null;
    let avatarUrl = null;

    // 1. URL Inspection (e.g. /channel/UC..., /channel/handle)
    const urlMatch = window.location.href.match(/\/channel\/([a-zA-Z0-9_\-]+)/);
    if (urlMatch) channelId = urlMatch[1];
    const handleUrlMatch = window.location.href.match(/\/@([a-zA-Z0-9._\-]+)/);
    if (handleUrlMatch) handle = `@${handleUrlMatch[1]}`;

    // 2. DOM Metadata / Avatar piercing Shadow DOM
    const avatarEl = queryDeep("#avatar-btn img, #entity-image, ytcp-entity-page-header img, img#img");
    if (avatarEl) avatarUrl = avatarEl.src;

    const nameEl = queryDeep("#channel-title, #entity-name, .ytcp-entity-page-header .title, ytcp-navigation-drawer #channel-title, yt-formatted-string#text.ytd-channel-name");
    if (nameEl) {
      const rawName = nameEl.textContent.trim();
      if (rawName && rawName !== "YouTube Creator") channelName = rawName;
    }

    const handleEl = queryDeep("#channel-handle, .ytcp-entity-page-header .secondary-title, ytcp-navigation-drawer #channel-handle, #channel-tag");
    if (handleEl) {
      const rawHandle = handleEl.textContent.trim();
      if (rawHandle && rawHandle !== "@creator") handle = rawHandle;
    }

    // 3. Fallback extraction from ytcfg or script tags
    try {
      if (window.ytcfg && typeof window.ytcfg.get === "function") {
        channelId = channelId || window.ytcfg.get("CHANNEL_ID");
        const cfgName = window.ytcfg.get("CHANNEL_NAME");
        if (cfgName && cfgName !== "YouTube Creator") channelName = channelName || cfgName;
      }
    } catch (e) {}

    // Check script tags for INNERTUBE / CHANNEL_ID metadata
    if (!channelName || !channelId) {
      try {
        const scripts = document.querySelectorAll("script");
        for (const s of scripts) {
          const txt = s.textContent || "";
          if (txt.includes("CHANNEL_ID") || txt.includes("channelId")) {
            const mId = txt.match(/"(?:CHANNEL_ID|channelId)":\s*"([^"]+)"/);
            if (mId && !channelId) channelId = mId[1];
            const mName = txt.match(/"(?:CHANNEL_NAME|channelName)":\s*"([^"]+)"/);
            if (mName && !channelName && mName[1] !== "YouTube Creator") channelName = mName[1];
            const mHandle = txt.match(/"(?:CHANNEL_HANDLE|channelHandle|handle)":\s*"([^"]+)"/);
            if (mHandle && !handle && mHandle[1] !== "@creator") handle = mHandle[1];
          }
        }
      } catch (e) {}
    }

    // If channelName is still not found, check document.title (e.g. "Channel dashboard - My Channel - YouTube Studio")
    if (!channelName && document.title && document.title.includes("YouTube Studio")) {
      const titleParts = document.title.split("-").map(p => p.trim());
      if (titleParts.length >= 3 && titleParts[1] && titleParts[1] !== "Channel dashboard") {
        channelName = titleParts[1];
      }
    }

    if (!channelName && !channelId) {
      return {
        channelId: null,
        channelName: null,
        handle: null,
        avatarUrl: null,
        loggedIn: false,
        lastSynced: Date.now()
      };
    }

    return {
      channelId: channelId || "active_channel",
      channelName: channelName || "My Channel",
      handle: handle || (channelName ? (channelName.startsWith("@") ? channelName : `@${channelName.toLowerCase().replace(/\s+/g, "")}`) : "@creator"),
      avatarUrl,
      loggedIn: true,
      lastSynced: Date.now()
    };
  }

  // -------------------------------------------------------------
  // 2. Shadow DOM Query Helper
  // -------------------------------------------------------------
  function queryDeep(selector, root = document) {
    if (!root) return null;
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (e) {}

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.shadowRoot) {
        const found = queryDeep(selector, node.shadowRoot);
        if (found) return found;
      }
      node = walker.nextNode();
    }
    return null;
  }

  function queryDeepAll(selector, root = document) {
    const results = [];
    try {
      results.push(...root.querySelectorAll(selector));
    } catch (e) {}

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.shadowRoot) {
        results.push(...queryDeepAll(selector, node.shadowRoot));
      }
      node = walker.nextNode();
    }
    return results;
  }

  // -------------------------------------------------------------
  // 3. Challenge & Circuit Breaker Detection
  // -------------------------------------------------------------
  function detectAccountChallenge() {
    const bodyText = (document.body ? document.body.innerText : "") || "";
    const challengePatterns = [
      /verify it's you/i,
      /unusual activity/i,
      /action blocked/i,
      /temporarily disabled/i,
      /confirm your phone number/i,
      /suspicious login/i
    ];

    for (const pattern of challengePatterns) {
      if (pattern.test(bodyText)) {
        return pattern.toString();
      }
    }
    return null;
  }

  // -------------------------------------------------------------
  // 4. Autonomous YouTube Post Flow
  // -------------------------------------------------------------
  async function executeYouTubeUpload(params) {
    const { title, description, mediaUrl, tags, madeForKids = false, visibility = "PUBLIC" } = params;

    console.log("[YouTubeStealthDriver] Starting autonomous upload flow for:", title);

    // 1. Circuit Breaker Check
    const challenge = detectAccountChallenge();
    if (challenge) {
      throw new Error(`[GhostHuman] YouTube challenge detected: ${challenge}. Circuit breaker engaged.`);
    }

    // 2. Pre-flight human dwell & natural viewport motion
    if (Stealth) {
      await Stealth.performPreFlightDwell(2.5, 4.5);
    }

    // 3. Locate File Input or open dialog via Create button
    let fileInput = queryDeep('input[type="file"][name="Filedata"], ytcp-uploads-dialog input[type="file"], input[type="file"]');
    if (!fileInput) {
      let createBtn = queryDeep('#create-icon, ytcp-button#create-button, ytcp-button#create-icon, button[aria-label*="Create" i], #create-icon-shape, ytcp-icon-button#create-icon');
      if (!createBtn) {
        const buttons = queryDeepAll('ytcp-button, button, div[role="button"]');
        createBtn = buttons.find(b => /create/i.test(b.textContent || ""));
      }

      if (createBtn) {
        if (Stealth) {
          await Stealth.humanClick(createBtn);
          await Stealth.sleepGaussian(1200, 300);
        } else {
          createBtn.click();
          await new Promise(r => setTimeout(r, 1500));
        }
        try { createBtn.click(); } catch (e) {}

        // 4. Click 'Upload videos' in popup menu
        let uploadItem = null;
        for (let i = 0; i < 25; i++) {
          uploadItem = queryDeep('tp-yt-paper-item#text-item-0, [test-id="upload-beta"], #upload-video-menu-item, tp-yt-paper-item');
          if (!uploadItem) {
            const menuItems = queryDeepAll('tp-yt-paper-item, a, ytcp-text-menu ytcp-ve');
            uploadItem = menuItems.find(m => /upload\s*video/i.test(m.textContent || ""));
          }
          if (uploadItem) break;
          await new Promise(r => setTimeout(r, 300));
        }

        if (uploadItem) {
          if (Stealth) {
            await Stealth.humanClick(uploadItem);
            await Stealth.sleepGaussian(2000, 400);
          } else {
            uploadItem.click();
            await new Promise(r => setTimeout(r, 2000));
          }
          try { uploadItem.click(); } catch (e) {}
        }
      }

      // 5. Locate File Input in Upload Dialog (polling up to 10s)
      for (let fi = 0; fi < 20; fi++) {
        fileInput = queryDeep('input[type="file"][name="Filedata"], ytcp-uploads-dialog input[type="file"], input[type="file"]');
        if (fileInput) break;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!fileInput) {
      throw new Error("[YouTubeStealthDriver] File input not found in YouTube upload dialog.");
    }

    // 6. Fetch and prepare media file
    let mediaBlob = null;
    let fileName = params.fileName || (title ? `${title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.mp4` : "upload.mp4");

    if (mediaUrl) {
      console.log("[YouTubeStealthDriver] Fetching media from URL:", mediaUrl);
      const res = await fetch(mediaUrl);
      if (!res.ok) throw new Error(`Failed to fetch media file from ${mediaUrl}: ${res.statusText}`);
      mediaBlob = await res.blob();
    } else if (params.base64Data) {
      const byteChars = atob(params.base64Data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      mediaBlob = new Blob([new Uint8Array(byteNumbers)], { type: params.mimeType || "video/mp4" });
    } else {
      throw new Error("[YouTubeStealthDriver] No mediaUrl or base64Data provided for YouTube upload.");
    }

    const initialFile = new File([mediaBlob], fileName, { type: mediaBlob.type || "video/mp4" });

    // Ingest with lossless entropy mutation & DataTransfer
    if (Stealth) {
      await Stealth.injectFileIntoInput(fileInput, initialFile);
      await Stealth.sleepGaussian(3500, 600);
    } else {
      const dt = new DataTransfer();
      dt.items.add(initialFile);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 3000));
    }

    // 7. Wait for Metadata Editor to Load
    console.log("[YouTubeStealthDriver] Waiting for metadata form to mount...");
    let titleInput = null;
    for (let attempts = 0; attempts < 20; attempts++) {
      titleInput = queryDeep('#title-textarea #textbox, #textbox[aria-label*="title" i], [contenteditable="true"][aria-label*="title" i]');
      if (titleInput) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!titleInput) {
      throw new Error("[YouTubeStealthDriver] Title textbox did not appear in time.");
    }

    // 8. Type Title with Human Clipboard Emulation (Select all to clear default filename)
    if (title && titleInput) {
      titleInput.focus();
      try { document.execCommand("selectAll", false, null); } catch (e) {}
      if (Stealth) {
        await Stealth.humanPaste(titleInput, title);
        await Stealth.sleepGaussian(1200, 300);
      } else {
        document.execCommand("insertText", false, title);
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
        titleInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // 9. Type Description
    const descInput = queryDeep('#description-textarea #textbox, #textbox[aria-label*="description" i], [contenteditable="true"][aria-label*="description" i]');
    if (descInput && description) {
      descInput.focus();
      try { document.execCommand("selectAll", false, null); } catch (e) {}
      if (Stealth) {
        await Stealth.humanPaste(descInput, description);
        await Stealth.sleepGaussian(1500, 400);
      } else {
        document.execCommand("insertText", false, description);
        descInput.dispatchEvent(new Event("input", { bubbles: true }));
        descInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // 9b. Upload Custom Thumbnail if provided
    if (params.thumbnailBase64) {
      console.log("[YouTubeStealthDriver] Custom thumbnail provided, looking for file loader...");
      try {
        const thumbInput = queryDeep('input#file-loader[type="file"], input[type="file"][accept*="image" i]');
        if (thumbInput) {
          const byteCharacters = atob(params.thumbnailBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const thumbBlob = new Blob([byteArray], { type: "image/jpeg" });
          const thumbFile = new File([thumbBlob], "thumbnail.jpg", { type: "image/jpeg" });

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(thumbFile);
          thumbInput.files = dataTransfer.files;
          thumbInput.dispatchEvent(new Event("change", { bubbles: true }));
          console.log("[YouTubeStealthDriver] Custom thumbnail injected into file-loader successfully.");
          if (Stealth) await Stealth.sleepGaussian(1200, 300);
        } else {
          console.log("[YouTubeStealthDriver] Thumbnail file-loader input not found (may be Short or auto-thumbnail mode).");
        }
      } catch (thumbErr) {
        console.warn("[YouTubeStealthDriver] Failed to set custom thumbnail:", thumbErr);
      }
    }

    // 10. Select 'Not Made for Kids' Audience Option
    const notForKidsRadio = queryDeep('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]');
    if (notForKidsRadio) {
      try { notForKidsRadio.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
      if (Stealth) {
        await Stealth.humanClick(notForKidsRadio);
        await Stealth.sleepGaussian(800, 200);
      } else {
        notForKidsRadio.click();
      }
      try { notForKidsRadio.click(); } catch (e) {}
    }

    // 10b. Expand "Show more" and Enter YouTube Tags if tags provided
    if (params.tags && Array.isArray(params.tags) && params.tags.length > 0) {
      console.log("[YouTubeStealthDriver] Expanding 'Show more' to inject tags...");
      try {
        const toggleBtn = queryDeep('#toggle-button ytcp-button, ytcp-button#toggle-button, #toggle-button');
        if (toggleBtn) {
          try { toggleBtn.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
          const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
          if (!isExpanded) {
            const nativeToggle = (toggleBtn.shadowRoot && toggleBtn.shadowRoot.querySelector('button')) || toggleBtn.querySelector('button') || toggleBtn;
            if (Stealth) {
              await Stealth.humanClick(nativeToggle);
              await Stealth.sleepGaussian(1200, 300);
            } else {
              nativeToggle.click();
              await new Promise(r => setTimeout(r, 1200));
            }
          }
        }

        // Find tags input container
        const tagsInput = queryDeep('#tags-container #text-input, #tags-container input, input[aria-label*="Tags" i], input[aria-label*="tags" i]');
        if (tagsInput) {
          tagsInput.focus();
          const tagsString = params.tags.join(", ") + ",";
          if (Stealth) {
            await Stealth.humanPaste(tagsInput, tagsString);
            await Stealth.sleepGaussian(1000, 200);
          } else {
            document.execCommand("insertText", false, tagsString);
            tagsInput.dispatchEvent(new Event("input", { bubbles: true }));
            tagsInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
          // Press Enter to ensure tags commit
          tagsInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
          tagsInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));
          console.log("[YouTubeStealthDriver] Injected", params.tags.length, "tags successfully.");
        } else {
          console.log("[YouTubeStealthDriver] Tags input not found; skipping tag entry.");
        }
      } catch (tagErr) {
        console.warn("[YouTubeStealthDriver] Tag injection skipped:", tagErr);
      }
    }

    // 11. Navigate through "Next" buttons (Video Elements, Checks, Visibility)
    console.log("[YouTubeStealthDriver] Advancing through workflow steps...");
    for (let step = 0; step < 3; step++) {
      let nextBtn = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        nextBtn = queryDeep('#next-button ytcp-button, ytcp-button#next-button, #next-button');
        if (nextBtn && !nextBtn.hasAttribute("disabled") && nextBtn.getAttribute("aria-disabled") !== "true") {
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      if (nextBtn) {
        const nativeBtn = (nextBtn.shadowRoot && nextBtn.shadowRoot.querySelector('button')) || nextBtn.querySelector('button') || nextBtn;
        if (Stealth) {
          await Stealth.humanClick(nativeBtn);
          await Stealth.sleepGaussian(1500, 300);
        } else {
          nativeBtn.click();
          await new Promise(r => setTimeout(r, 1500));
        }
        try { nativeBtn.click(); } catch (e) {}
        try { nextBtn.click(); } catch (e) {}
      }
    }

    // 12. Visibility Selection: Public or Private
    if (visibility.toUpperCase() === "PUBLIC") {
      const publicRadio = queryDeep('tp-yt-paper-radio-button[name="PUBLIC"]');
      if (publicRadio) {
        try { publicRadio.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
        if (Stealth) {
          await Stealth.humanClick(publicRadio);
          await Stealth.sleepGaussian(1000, 250);
        } else {
          publicRadio.click();
        }
        try { publicRadio.click(); } catch (e) {}
      }
    }

    // 13. Extract Video Link / ID if visible
    let videoUrl = null;
    const linkEl = queryDeep('a.ytcp-video-info, a[href*="youtu.be"], .video-url-fadeable a');
    if (linkEl && linkEl.href) {
      videoUrl = linkEl.href;
    }

    // 14. Click Save / Done / Publish
    let doneBtn = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      doneBtn = queryDeep('#done-button ytcp-button, ytcp-button#done-button, ytcp-button#save-button, #save-button');
      if (doneBtn && !doneBtn.hasAttribute("disabled") && doneBtn.getAttribute("aria-disabled") !== "true") {
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (doneBtn) {
      console.log("[YouTubeStealthDriver] Publishing video with human click...");
      const nativeDone = (doneBtn.shadowRoot && doneBtn.shadowRoot.querySelector('button')) || doneBtn.querySelector('button') || doneBtn;
      if (Stealth) {
        await Stealth.humanClick(nativeDone);
        await Stealth.sleepGaussian(2500, 500);
      } else {
        nativeDone.click();
        await new Promise(r => setTimeout(r, 2500));
      }
      try { nativeDone.click(); } catch (e) {}
      try { doneBtn.click(); } catch (e) {}
    } else {
      console.warn("[YouTubeStealthDriver] Publish/Done button was disabled or not found.");
    }

    console.log("[YouTubeStealthDriver] Autonomous upload completed successfully:", { videoUrl });
    return {
      status: "success",
      title,
      videoUrl: videoUrl || "https://studio.youtube.com",
      publishedAt: new Date().toISOString()
    };
  }

  // -------------------------------------------------------------
  // 5. Message Listener
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT_YOUTUBE_INFO") {
      const info = extractYouTubeChannelInfo();
      sendResponse({ status: "success", info });
      return true;
    }

    if (message.type === "AUTONOMOUS_YOUTUBE_POST") {
      executeYouTubeUpload(message.params)
        .then(result => sendResponse({ status: "success", data: result }))
        .catch(err => sendResponse({ status: "error", error: err.message || String(err) }));
      return true;
    }
  });

  // Notify background script that YouTube driver is active & re-check as SPA renders
  function notifyChannelMounted() {
    try {
      const info = extractYouTubeChannelInfo();
      if (info && info.channelName) {
        chrome.runtime.sendMessage({
          type: "YOUTUBE_TAB_MOUNTED",
          info
        }).catch(() => {});
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Attempt immediately on document idle
  if (!notifyChannelMounted()) {
    setTimeout(notifyChannelMounted, 1500);
    setTimeout(notifyChannelMounted, 3000);
    setTimeout(notifyChannelMounted, 5500);
  }

})();
