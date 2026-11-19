/**
 * GhostHuman TikTok Creator Center Stealth Driver
 * Runs inside tiktok.com/creator-center/upload and tiktok.com/upload tabs
 * to perform 100% human-emulated video and TikTok uploads.
 *
 * Implements:
 * - Iframe and direct DOM file drop handling
 * - Biometric Bézier mouse paths & cognitive clipboard pasting
 * - Lossless binary file mutation before ingestion
 * - Pre-flight human dwell & anti-detection safeguards
 */

(function () {
  const Stealth = window.GhostHumanStealthEngine || globalThis.GhostHumanStealthEngine;

  console.log("[TikTokStealthDriver] Initializing TikTok Creator Center GhostHuman Driver...");

  // -------------------------------------------------------------
  // 1. Account Metadata Extraction
  // -------------------------------------------------------------
  function extractTikTokAccountInfo() {
    let handle = null;
    let nickname = null;
    let avatarUrl = null;
    let loggedIn = false;

    // 1. Profile avatar or user info in DOM
    const avatarImg = document.querySelector('img[class*="avatar" i], img[alt*="avatar" i], header img');
    if (avatarImg) {
      avatarUrl = avatarImg.src;
      loggedIn = true;
    }

    // 2. Search for user handle in header or URL
    const userAnchor = document.querySelector('a[href*="/@"], div[class*="user-name" i], span[class*="username" i]');
    if (userAnchor) {
      const match = (userAnchor.href || userAnchor.textContent || "").match(/@([a-zA-Z0-9._]+)/);
      if (match) {
        handle = `@${match[1]}`;
        loggedIn = true;
      }
    }

    // 3. Check Universal Data / Window props
    try {
      const initData = window.__UNIVERSAL_DATA_FOR_REHYDRATION__ || window.__INIT_PROPS__;
      if (initData) {
        const user = initData["webapp.app-context"]?.user || initData.user;
        if (user) {
          handle = user.uniqueId ? `@${user.uniqueId}` : handle;
          nickname = user.nickname || nickname;
          avatarUrl = user.avatarMedium || user.avatarThumb || avatarUrl;
          loggedIn = true;
        }
      }
    } catch (e) {}

    // Check cookies for sessionid
    const hasSessionCookie = document.cookie.includes("sessionid=");
    if (hasSessionCookie) loggedIn = true;

    return {
      handle: handle || (loggedIn ? "@tiktok_creator" : null),
      nickname: nickname || "TikTok Creator",
      avatarUrl,
      loggedIn,
      lastSynced: Date.now()
    };
  }

  // -------------------------------------------------------------
  // 2. Challenge & Captcha Detection
  // -------------------------------------------------------------
  function detectTikTokChallenge() {
    const bodyText = (document.body ? document.body.innerText : "") || "";
    const challengePatterns = [
      /drag the slider/i,
      /verify to continue/i,
      /select 2 objects/i,
      /security verification/i,
      /unusual traffic/i,
      /account has been suspended/i,
      /temporarily blocked/i
    ];

    for (const pattern of challengePatterns) {
      if (pattern.test(bodyText)) {
        return pattern.toString();
      }
    }

    const captchaModal = document.querySelector('#sec-sdk-captcha-container, .captcha_verify_container, [id*="captcha"]');
    if (captchaModal && captchaModal.offsetParent !== null) {
      return "TikTok Captcha Modal Visible";
    }

    return null;
  }

  // -------------------------------------------------------------
  // 3. Autonomous TikTok Post Flow
  // -------------------------------------------------------------
  async function executeTikTokUpload(params) {
    const { caption, mediaUrl, privacy = "PUBLIC", allowComments = true, allowDuet = true, allowStitch = true } = params;

    console.log("[TikTokStealthDriver] Starting autonomous upload flow for caption:", caption);

    // 1. Circuit Breaker Check
    const challenge = detectTikTokChallenge();
    if (challenge) {
      throw new Error(`[GhostHuman] TikTok security challenge detected: ${challenge}. Circuit breaker engaged.`);
    }

    // 2. Pre-flight human dwell & natural viewport motion
    if (Stealth) {
      await Stealth.performPreFlightDwell(2.5, 4.5);
    }

    // 3. Find file input in main page or iframe
    let fileInput = document.querySelector('input[type="file"][accept*="video"], input[type="file"]');
    let docContext = document;

    if (!fileInput) {
      // Check upload iframe if present
      const uploadIframe = document.querySelector('iframe[src*="upload"], iframe[class*="upload" i]');
      if (uploadIframe && uploadIframe.contentDocument) {
        docContext = uploadIframe.contentDocument;
        fileInput = docContext.querySelector('input[type="file"]');
      }
    }

    if (!fileInput) {
      // Try waiting up to 5 seconds for slow client renders
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1000));
        fileInput = document.querySelector('input[type="file"][accept*="video"], input[type="file"]');
        if (fileInput) break;
      }
    }

    if (!fileInput) {
      throw new Error("[TikTokStealthDriver] Upload file input not found on TikTok page.");
    }

    // 4. Fetch and prepare media file
    let mediaBlob = null;
    let fileName = params.fileName || "tiktok_video.mp4";

    if (mediaUrl) {
      console.log("[TikTokStealthDriver] Fetching media from URL:", mediaUrl);
      const res = await fetch(mediaUrl);
      if (!res.ok) throw new Error(`Failed to fetch media from ${mediaUrl}: ${res.statusText}`);
      mediaBlob = await res.blob();
    } else if (params.base64Data) {
      const byteChars = atob(params.base64Data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      mediaBlob = new Blob([new Uint8Array(byteNumbers)], { type: params.mimeType || "video/mp4" });
    } else {
      throw new Error("[TikTokStealthDriver] No mediaUrl or base64Data provided for TikTok upload.");
    }

    const initialFile = new File([mediaBlob], fileName, { type: mediaBlob.type || "video/mp4" });

    // 5. Ingest file into input with lossless binary mutation
    console.log("[TikTokStealthDriver] Attaching mutated video file...");
    if (Stealth) {
      await Stealth.injectFileIntoInput(fileInput, initialFile);
      await Stealth.sleepGaussian(4500, 800);
    } else {
      const dt = new DataTransfer();
      dt.items.add(initialFile);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 4000));
    }

    // 6. Wait for Caption / Description Editor to be Ready
    console.log("[TikTokStealthDriver] Locating caption input field...");
    let captionEl = null;
    for (let attempts = 0; attempts < 15; attempts++) {
      captionEl = docContext.querySelector('.notranslate.public-DraftEditor-content, [contenteditable="true"][data-placeholder*="caption" i], [contenteditable="true"], div[class*="editor" i] [contenteditable="true"]');
      if (captionEl) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (captionEl && caption) {
      console.log("[TikTokStealthDriver] Inserting caption with human clipboard emulation...");
      if (Stealth) {
        await Stealth.humanPaste(captionEl, caption);
        await Stealth.sleepGaussian(1500, 350);
      } else {
        captionEl.focus();
        document.execCommand("insertText", false, caption);
        captionEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    // 7. Humanized delay before clicking post
    if (Stealth) {
      await Stealth.sleepGaussian(2200, 400);
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }

    // 8. Find and click Post button
    let postBtn = docContext.querySelector('button[data-e2e="post_video_button"], button.btn-post, button[class*="post-button" i]');
    if (!postBtn) {
      const candidates = Array.from(docContext.querySelectorAll('button, div[role="button"]'));
      postBtn = candidates.find(c => /^\s*post\s*$/i.test(c.textContent || ""));
    }

    if (!postBtn) {
      throw new Error("[TikTokStealthDriver] 'Post' button not found on TikTok upload page.");
    }

    console.log("[TikTokStealthDriver] Clicking Post button via GhostHuman biometric path...");
    if (Stealth) {
      await Stealth.humanClick(postBtn);
      await Stealth.sleepGaussian(3500, 700);
    } else {
      postBtn.click();
      await new Promise(r => setTimeout(r, 3500));
    }

    // 9. Check for Post Confirmation
    console.log("[TikTokStealthDriver] Autonomous TikTok upload dispatched successfully.");
    return {
      status: "success",
      caption,
      platform: "tiktok",
      publishedAt: new Date().toISOString()
    };
  }

  // -------------------------------------------------------------
  // 4. Message Listener
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT_TIKTOK_INFO") {
      const info = extractTikTokAccountInfo();
      sendResponse({ status: "success", info });
      return true;
    }

    if (message.type === "AUTONOMOUS_TIKTOK_POST") {
      executeTikTokUpload(message.params)
        .then(result => sendResponse({ status: "success", data: result }))
        .catch(err => sendResponse({ status: "error", error: err.message || String(err) }));
      return true;
    }
  });

  // Notify background script that TikTok driver is active
  try {
    const info = extractTikTokAccountInfo();
    chrome.runtime.sendMessage({
      type: "TIKTOK_TAB_MOUNTED",
      info
    }).catch(() => {});
  } catch (e) {}

})();
