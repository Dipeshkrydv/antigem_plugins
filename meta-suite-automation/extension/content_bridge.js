/**
 * Antigravity Meta Bridge Extension - Content Bridge
 * Injected into Facebook, Instagram, and Meta Business Suite tabs.
 * Extracts in-page security tokens & executes step-by-step DOM commands with human typing & jitter.
 */

// -------------------------------------------------------------
// 1. Token Extraction Helpers
// -------------------------------------------------------------
function extractFacebookTokens() {
  const html = document.documentElement.innerHTML;
  let fb_dtsg = null;
  let lsd = null;
  let userName = null;
  let userId = null;
  let access_token = null;
  let hasNoPages = false;
  let pages = [];

  // 1. Search for fb_dtsg in inline scripts or inputs
  const dtsgMatch = html.match(/"DTSGInitialData",\[\],\{"token":"(.*?)"\}/) ||
                    html.match(/"token":"([a-zA-Z0-9_\-:]+)"/);
  if (dtsgMatch) {
    fb_dtsg = dtsgMatch[1];
  } else {
    const input = document.querySelector('input[name="fb_dtsg"]');
    if (input) fb_dtsg = input.value;
  }

  // 2. Search for LSD token
  const lsdMatch = html.match(/"LSD",\[\],\{"token":"(.*?)"\}/);
  if (lsdMatch) {
    lsd = lsdMatch[1];
  } else {
    const input = document.querySelector('input[name="lsd"]');
    if (input) lsd = input.value;
  }

  // 3. Search for Meta Business Suite access token if available
  const tokenMatch = html.match(/(EAAG[a-zA-Z0-9]+)/) ||
                     html.match(/(EAAB[a-zA-Z0-9]+)/) ||
                     html.match(/"accessToken":"(EA[a-zA-Z0-9]+)"/);
  if (tokenMatch) {
    access_token = tokenMatch[1];
  }

  // 4. Extract Real User Name from CurrentUserInitialData or script JSON
  const currentMatch = html.match(/"CurrentUserInitialData",\[\],\{[^}]*"NAME":"([^"]+)"/i) ||
                       html.match(/"USER_NAME":"([^"]+)"/i) ||
                       html.match(/"NAME":"([A-Z][a-zA-Z\s]{2,30})"/i);
  if (currentMatch && currentMatch[1] && !currentMatch[1].includes("\\")) {
    userName = currentMatch[1].trim();
  }

  // Extract User ID
  const idMatch = html.match(/"CurrentUserInitialData",\[\],\{[^}]*"USER_ID":"(\d+)"/i) ||
                  html.match(/"USER_ID":"(\d+)"/i) ||
                  html.match(/"ACCOUNT_ID":"(\d+)"/i);
  if (idMatch) {
    userId = idMatch[1];
  }

  // 5. Autonomous Detection & Extraction of Meta Business Suite Page(s)
  const isBizSuite = window.location.hostname.includes("business.facebook.com");
  const href = window.location.href;
  const searchParams = new URLSearchParams(window.location.search);
  const assetIdFromUrl = searchParams.get("asset_id") || searchParams.get("page_id") || (href.match(/[?&](?:asset_id|page_id)=(\d+)/) || [])[1];

  let detectedPageName = null;
  let detectedPageId = assetIdFromUrl;

  if (isBizSuite) {
    // A. Check Composer "Post to" container or header text
    if (!detectedPageName) {
      const composerTitles = Array.from(document.querySelectorAll('div[aria-label*="preview" i] strong, div[aria-label*="Post to" i] span, div[role="combobox"] span, div[role="dialog"] h2, div[role="dialog"] h3'));
      for (const el of composerTitles) {
        const txt = el.textContent ? el.textContent.trim() : "";
        if (txt.length > 2 && !/^(post to|facebook|create post|preview|publish|feed)/i.test(txt)) {
          detectedPageName = txt;
          break;
        }
      }
    }

    // C. Check script tags for selected asset JSON
    if (!detectedPageName) {
      const jsonMatch = html.match(/"selected_asset":\s*\{[^}]*"id":"(\d+)"[^}]*"name":"([^"]+)"/i) ||
                        html.match(/"asset_id":"(\d+)"[^}]*"name":"([^"]+)"/i) ||
                        html.match(/"page_name":"([^"]+)"/i);
      if (jsonMatch) {
        if (jsonMatch[2]) {
          detectedPageId = detectedPageId || jsonMatch[1];
          detectedPageName = jsonMatch[2].trim();
        } else if (jsonMatch[1]) {
          detectedPageName = jsonMatch[1].trim();
        }
      }
    }

    // D. Check Document Title
    if (!detectedPageName && document.title) {
      const titleMatch = document.title.match(/^(.*?)\s*\|\s*Meta Business Suite/i) ||
                         document.title.match(/^(.*?)\s*-\s*Meta Business Suite/i);
      if (titleMatch && titleMatch[1] && !/create post|home|inbox|notifications/i.test(titleMatch[1].trim())) {
        detectedPageName = titleMatch[1].trim();
      }
    }

    // E. Assemble discovered Business Suite Page
    if (detectedPageId || detectedPageName) {
      const pId = detectedPageId || "me";
      const pName = detectedPageName || (pId === "me" ? "Facebook Page" : "Facebook Page");
      pages.push({
        id: pId,
        name: pName,
        category: "Facebook Page"
      });
      hasNoPages = false;
    }
  } else {
    // On regular www.facebook.com tabs, check if Facebook Page / page ID is present
    if (html.includes("Facebook Page") || html.includes("me")) {
      pages.push({
        id: "me",
        name: "Facebook Page",
        category: "Facebook Page"
      });
      hasNoPages = false;
    }
  }

  // 6. Inspect Meta Business Suite Error/Notice Screen (ONLY if no pages were detected)
  if (pages.length === 0) {
    const bodyText = document.body ? (document.body.innerText || "") : "";
    const noAccessMatch = bodyText.match(/Your account,\s*([^,]+),\s*does not have access to any Facebook Pages/i) ||
                          bodyText.match(/Unable to access Meta Business Suite with this account\.\s*Your account,\s*([^,]+),/i);
    if (noAccessMatch && noAccessMatch[1]) {
      userName = noAccessMatch[1].trim();
      hasNoPages = true;
    } else if (/does not have access to any Facebook Pages|Unable to access Meta Business Suite/i.test(bodyText)) {
      hasNoPages = true;
    }
  } else {
    hasNoPages = false;
  }

  // 7. DOM Profile Links Fallback
  if (!userName) {
    const profileCandidates = [
      'a[aria-label*="Your profile" i] span',
      'a[href*="/profile.php"] span',
      'div[role="navigation"] a[href*="profile.php"] span',
      'div[role="navigation"] a[href*="/me/"] span',
      'div[role="banner"] [aria-label*="profile" i] span'
    ];
    for (const sel of profileCandidates) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 1 && !/^(profile|menu|home|watch)/i.test(el.textContent.trim())) {
        userName = el.textContent.trim();
        break;
      }
    }
  }

  // 8. Document Title Fallback
  if (!userName && document.title) {
    const cleanTitle = document.title
      .replace(/\(\d+\)\s*/, "")
      .replace(/\s*\|\s*Facebook.*/i, "")
      .replace(/\s*-\s*Facebook.*/i, "")
      .trim();
    if (cleanTitle && cleanTitle.length > 2 && !/^(facebook|log in|sign up|welcome|meta business suite)/i.test(cleanTitle)) {
      userName = cleanTitle;
    }
  }

  return {
    fb_dtsg,
    lsd,
    userName,
    userId,
    access_token,
    page_access_token: access_token,
    hasNoPages,
    pages
  };
}

function extractInstagramTokens() {
  const html = document.documentElement.innerHTML;
  let ig_app_id = "936619743392459"; // Default web client ID
  let username = null;
  let fullName = null;
  let userId = null;

  const appIdMatch = html.match(/"appId":"(\d+)"/) || html.match(/"X-IG-App-ID":"(\d+)"/);
  if (appIdMatch) {
    ig_app_id = appIdMatch[1];
  }

  // 1. Current logged in profile username from navigation profile picture
  const navProfile = document.querySelector('a[href^="/"][role="link"] img[alt*="profile picture" i]');
  if (navProfile && navProfile.alt) {
    const match = navProfile.alt.match(/(.+?)'s profile picture/i);
    if (match && match[1]) {
      username = match[1].trim();
    }
  }

  // 2. Navigation sidebar profile link
  if (!username) {
    const navLinks = Array.from(document.querySelectorAll('a[role="link"][href^="/"]'));
    for (const l of navLinks) {
      const href = l.getAttribute("href") || "";
      const segs = href.replace(/^\//, "").replace(/\/$/, "").split("/");
      if (segs.length === 1 && segs[0] && !["explore", "reels", "direct", "stories", "accounts", "create", "p"].includes(segs[0])) {
        // Confirm it has a profile avatar inside
        if (l.querySelector('img') || l.querySelector('svg[aria-label="Profile"]')) {
          username = segs[0];
          break;
        }
      }
    }
  }

  // 3. Inline scripts for viewer JSON
  if (!username) {
    const viewerMatch = html.match(/"viewer":\s*\{[^}]*"username":"([^"]+)"/i) ||
                        html.match(/"raw_viewer":\s*\{[^}]*"username":"([^"]+)"/i) ||
                        html.match(/"username":"([a-zA-Z0-9._]{3,30})","badge_count"/i);
    if (viewerMatch && viewerMatch[1]) {
      username = viewerMatch[1].trim();
    }
  }

  // 4. Extract Full Name if available
  const nameMatch = html.match(/"full_name":"([^"]+)"/i);
  if (nameMatch && nameMatch[1]) {
    fullName = nameMatch[1].trim();
  }

  // 5. Extract User ID
  const idMatch = html.match(/"viewer":\s*\{[^}]*"id":"(\d+)"/i) || html.match(/"raw_viewer":\s*\{[^}]*"id":"(\d+)"/i);
  if (idMatch && idMatch[1]) {
    userId = idMatch[1];
  }

  return { ig_app_id, username, fullName, userId };
}

// -------------------------------------------------------------
// 2. Realistic Human Simulation (Typing & Clicking)
// -------------------------------------------------------------
// 2. Humanized Biometric Typing & Pointer Simulation
// -------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// DOM Sentinel: Checks if Meta has displayed any block or warning banner
function checkDomForMetaBlock() {
  // Only check modal dialogs, alert dialogs, or system overlays
  const modalContainers = Array.from(document.querySelectorAll('div[role="dialog"], div[role="alertdialog"], div[aria-modal="true"], div[data-pagelet="root"] > div[role="alert"], .uiLayer'));
  let blockText = "";
  for (const m of modalContainers) {
    // Exclude valid create post dialogs unless they explicitly say temporarily blocked
    const hasPostSign = (m.textContent || "").toLowerCase().includes("temporarily blocked");
    if (m.querySelector('div[role="textbox"][contenteditable="true"]') && !hasPostSign) {
      continue;
    }
    blockText += " " + (m.innerText || m.textContent || "");
  }

  // Also check top system alert banners
  const alerts = Array.from(document.querySelectorAll('div[role="alert"], div[role="banner"]'));
  for (const a of alerts) {
    blockText += " " + (a.innerText || a.textContent || "");
  }

  const dangerPhrases = [
    "you're temporarily blocked",
    "misusing this feature by going too fast",
    "we restrict certain activity",
    "suspect automated behavior",
    "we limit how often you can post",
    "confirm your identity"
  ];

  blockText = blockText.toLowerCase();
  for (const phrase of dangerPhrases) {
    if (blockText.includes(phrase)) {
      console.error(`[SUPERVISOR HARD LOCK] Meta restriction screen detected: "${phrase}"`);
      chrome.runtime.sendMessage({
        type: "SUPERVISOR_HARD_LOCK",
        phrase,
        url: window.location.href,
        lockDurationMs: 24 * 3600 * 1000 // 24-hour hard lock
      });
      return { blocked: true, phrase };
    }
  }
  return { blocked: false };
}

// Keystroke Streamer: 65ms–180ms per character with a 1.5s–3s pause every 14 words
// Anti-Comment Box Guard: strictly excludes comment boxes and reply streams from post composer targets
function isCommentBox(el) {
  if (!el) return false;
  if (el.closest('form[action*="comment"], div[aria-label*="comment" i], div[aria-label*="टिप्पणी" i], div[aria-label*="प्रतिक्रिया" i], div[data-visualcompletion*="comment"], div[aria-label*="Write an answer" i]')) {
    return true;
  }
  // Any textbox inside an article/feed unit is a comment box, NOT create post composer
  if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"], div[data-pagelet*="StoryReader"]')) {
    return true;
  }
  const aria = (el.getAttribute("aria-label") || "").toLowerCase();
  if (aria.includes("comment") || aria.includes("टिप्पणी") || aria.includes("प्रतिक्रिया") || aria.includes("reply") || aria.includes("जवाफ")) {
    return true;
  }
  return false;
}

// Fast Human Copy-Paste Method: Definitive single-insertion via execCommand insertText
async function pasteHumanText(element, text) {
  if (!element || !text) return;
  element.focus();
  try { element.click(); } catch (e) {}
  await sleep(100);

  const isContentEditable = element.isContentEditable || element.getAttribute("contenteditable") === "true";

  if (isContentEditable) {
    // 1. Explicitly position caret inside element
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    // 2. Select all existing text and delete cleanly
    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (e) {}

    // 3. Definitive single insertion of text, emojis, and linebreaks
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch (e) {}

    // 4. Fallback if execCommand did not register
    const currentVal = (element.innerText || element.textContent || "").trim();
    if (!inserted || currentVal.length < 5 || /what['’]s on your mind/i.test(currentVal)) {
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        const pasteEvt = new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(pasteEvt);
      } catch (e) {}
    }

    const afterVal = (element.innerText || element.textContent || "").trim();
    if (afterVal.length < 5 || /what['’]s on your mind/i.test(afterVal)) {
      try {
        element.innerText = text;
      } catch (e) {}
    }
  } else {
    element.value = text;
  }

  // 5. Dispatch input and change events so React/Lexical registers state
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(150);
}

// Alias humanType to fast pasteHumanText for universal consistency
async function humanType(element, text) {
  return await pasteHumanText(element, text);
}

// Randomized Pointer Click: Natural bounding box offset with snappy, responsive cadence
async function humanClick(element, fast = false) {
  const blockCheck = checkDomForMetaBlock();
  if (blockCheck.blocked) {
    throw new Error(`[SUPERVISOR SUPPRESSED]: Action blocked because Meta restriction screen is active ("${blockCheck.phrase}"). 24-hour protection lock engaged.`);
  }

  // Only scroll if element is outside the current viewport
  const rect = element.getBoundingClientRect();
  const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
  if (!inViewport) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(120 + Math.random() * 80);
  }

  const updatedRect = element.getBoundingClientRect();
  // Randomized offset inside 20% to 80% of width/height
  const clientX = Math.round(updatedRect.left + updatedRect.width * (0.2 + Math.random() * 0.6));
  const clientY = Math.round(updatedRect.top + updatedRect.height * (0.2 + Math.random() * 0.6));

  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1
  };

  element.dispatchEvent(new PointerEvent("pointerover", eventInit));
  element.dispatchEvent(new MouseEvent("mouseover", eventInit));
  element.dispatchEvent(new PointerEvent("pointerdown", eventInit));
  element.dispatchEvent(new MouseEvent("mousedown", eventInit));
  if (typeof element.focus === "function") element.focus();

  // Snappy click duration (25ms to 50ms)
  await sleep(25 + Math.random() * 30);

  element.dispatchEvent(new PointerEvent("pointerup", eventInit));
  element.dispatchEvent(new MouseEvent("mouseup", eventInit));
  element.dispatchEvent(new MouseEvent("click", eventInit));
  if (typeof element.click === "function") {
    try { element.click(); } catch (e) {}
  }

  // Snappy post-click cadence (200ms to 350ms)
  await sleep(fast ? 80 : (200 + Math.random() * 150));
}

// -------------------------------------------------------------
// 3. Message Listener for Injected DOM Instructions
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE_TOKENS") {
    const isFB = window.location.hostname.includes("facebook.com");
    const isIG = window.location.hostname.includes("instagram.com");
    let tokens = {};
    if (isFB) tokens = extractFacebookTokens();
    if (isIG) tokens = extractInstagramTokens();
    sendResponse({ tokens });
    return true;
  }

  if (message.type === "RELAY_DOM_ACTION") {
    handleDomAction(message.action, message.params)
      .then((data) => sendResponse({ status: "success", data }))
      .catch((err) => sendResponse({ status: "error", error: err.message || String(err) }));
    return true; // Keep channel open for async response
  }
});

async function handleDomAction(action, params) {
  switch (action) {
    case "CLICK_SELECTOR": {
      let element = null;
      if (params.selector) {
        try {
          element = document.querySelector(params.selector);
        } catch (e) {
          // Ignore invalid selector syntax and fall back to text search
        }
      }
      if (!element && params.text) {
        const regex = new RegExp(params.text, "i");
        const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a, span'));
        element = candidates.find(el => regex.test(el.textContent));
      }
      if (!element) {
        throw new Error(`Element not found for selector: ${params.selector} or text: ${params.text}`);
      }
      await humanClick(element);
      return { clicked: true, selector: params.selector };
    }

    case "TYPE_HUMAN_TEXT": {
      const element = document.querySelector(params.selector);
      if (!element) {
        throw new Error(`Input element not found for selector: ${params.selector}`);
      }
      await humanType(element, params.text);
      return { typed: true, length: params.text.length };
    }

    case "SCROLL": {
      const distance = params.distance || 500;
      window.scrollBy({ top: distance, behavior: "smooth" });
      await sleep(400);
      return { scrolled: distance, scrollY: window.scrollY };
    }

    case "PURGE_DUMMY_POSTS_DOM": {
      const articles = Array.from(document.querySelectorAll('div[role="article"], div[data-pagelet*="FeedUnit"]'));
      const dummyPosts = articles.filter(a => (a.textContent || "").includes("Humanized content"));
      let deletedCount = 0;

      for (const post of dummyPosts) {
        try {
          const menuBtn = post.querySelector('div[aria-label*="Actions" i], div[aria-label*="More" i], div[role="button"][aria-haspopup="menu"], svg[aria-label*="Actions" i], svg[aria-label*="More" i]');
          if (!menuBtn) continue;

          await humanClick(menuBtn.closest('div[role="button"]') || menuBtn, true);
          await sleep(700);

          const menuItems = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"], span'));
          const trashBtn = menuItems.find(el => /move\s*to\s*trash|delete\s*post|ट्र्यासमा\s*सार्नुहोस्|मेटाउनुहोस्/i.test(el.textContent || el.getAttribute("aria-label") || ""));
          if (trashBtn) {
            await humanClick(trashBtn.closest('div[role="menuitem"]') || trashBtn.closest('div[role="button"]') || trashBtn, true);
            await sleep(900);

            const confirmBtns = Array.from(document.querySelectorAll('div[role="button"], button'));
            const confirmBtn = confirmBtns.find(el => {
              const txt = (el.textContent || el.getAttribute("aria-label") || "").trim();
              return /move|delete|सार्नुहोस्|मेटाउनुहोस्/i.test(txt) && !/cancel|रद्द|dismiss|keep/i.test(txt);
            });
            if (confirmBtn) {
              await humanClick(confirmBtn, true);
              deletedCount++;
              await sleep(1500);
            }
          }
        } catch (e) {
          console.warn("Failed to delete a dummy post:", e);
        }
      }
      return { deletedCount, success: true };
    }

    case "DELETE_POST_DOM": {
      // Find 3 dots menu button on the post (multi-tier resilient detection)
      let menuBtn = null;
      const articles = Array.from(document.querySelectorAll('div[role="article"], div[data-pagelet*="FeedUnit"], div[data-pagelet*="ProfileTimeline"] div[role="article"]'));
      for (const art of articles) {
        const btn = art.querySelector('div[aria-haspopup="menu"][role="button"], div[aria-label*="Actions" i], div[aria-label*="More" i], div[aria-label*="विकल्प" i], div[aria-label*="कार्य" i], svg[aria-label*="More" i]');
        if (btn) {
          menuBtn = btn.closest('div[role="button"]') || btn;
          break;
        }
      }

      if (!menuBtn) {
        menuBtn = document.querySelector('div[role="feed"] div[role="button"][aria-haspopup="menu"], div[role="article"] div[role="button"][aria-haspopup="menu"], div[aria-label*="Actions for this post" i], div[aria-label*="More options" i]');
      }

      if (!menuBtn) {
        throw new Error("[CONTENT BRIDGE]: Could not find post 3-dots actions menu button.");
      }
      await humanClick(menuBtn);
      await sleep(600);

      // Click "Delete post" or "Move to trash" in dropdown
      const menuItems = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"], span'));
      const deleteRegex = /delete\s*post|move\s*to\s*trash|delete|हटाउनुहोस्|रद्दीटोकरी|हटाएं|हटाओ/i;
      const deleteItem = menuItems.find(el => deleteRegex.test((el.textContent || el.getAttribute("aria-label") || "").trim()));
      if (!deleteItem) {
        throw new Error("[CONTENT BRIDGE]: Could not find Delete option in post menu.");
      }
      await humanClick(deleteItem.closest('div[role="menuitem"]') || deleteItem);
      await sleep(800);

      // Confirm modal button click
      const confirmBtns = Array.from(document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button, div[role="button"], button'));
      const confirmRegex = /delete|move\s*to\s*trash|trash|हटाउनुहोस्|रद्दीटोकरी|हटाएं/i;
      const confirmBtn = confirmBtns.find(el => confirmRegex.test((el.textContent || "").trim()) && !/cancel|रद्द/i.test(el.textContent));
      if (confirmBtn) {
        await humanClick(confirmBtn);
        await sleep(500);
      }
      return { deleted: true, post_id: params.post_id };
    }

    case "EDIT_POST_DOM": {
      // 1. Locate the target post or the top post
      window.scrollTo({ top: 0, behavior: "instant" });
      await sleep(200);

      // Find the 3 dots menu on the top feed item / article
      const articles = Array.from(document.querySelectorAll('div[role="feed"] div[role="article"], div[data-pagelet*="ProfileTimeline"] div[role="article"], div[role="article"]'));
      let menuBtn = null;
      for (const art of articles) {
        const btn = art.querySelector('div[aria-label*="Actions" i], div[aria-label*="More" i], div[aria-label*="विकल्प" i], div[aria-label*="कार्य" i], svg[aria-label*="More" i]');
        if (btn) {
          menuBtn = btn.closest('div[role="button"]') || btn;
          break;
        }
      }

      if (!menuBtn) {
        menuBtn = document.querySelector('div[aria-label*="Actions for this post" i], div[aria-label*="More options" i]');
      }

      if (!menuBtn) {
        throw new Error("[CONTENT BRIDGE]: Could not find post 3-dots actions menu button.");
      }

      await humanClick(menuBtn);
      await sleep(500);

      // 2. Click "Edit post" in the dropdown menu
      const menuItems = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"], span'));
      const editRegex = /edit\s*post|edit\s*caption|सम्पादन\s*गर्नुहोस्|सम्पादन|पोस्ट\s*संपादित\s*करें|संपादित\s*करें/i;
      const editItem = menuItems.find(el => editRegex.test((el.textContent || el.getAttribute("aria-label") || "").trim()));

      if (!editItem) {
        const found = Array.from(document.querySelectorAll('div[role="menu"] div[role="menuitem"], div[role="menu"] span, div[role="menuitem"]')).map(el => (el.textContent || el.getAttribute("aria-label") || "").trim()).filter(Boolean);
        throw new Error("[CONTENT BRIDGE]: Menu items: " + found.slice(0, 15).join(" // "));
      }

      await humanClick(editItem.closest('div[role="menuitem"]') || editItem);
      await sleep(1000);

      // 3. Find the edit dialog composer
      let editModal = null;
      let editBox = null;
      for (let w = 0; w < 20; w++) {
        const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
        for (const d of dialogs) {
          const tb = d.querySelector('div[role="textbox"][contenteditable="true"]');
          if (tb) {
            editModal = d;
            editBox = tb;
            break;
          }
        }
        if (editBox) break;
        await sleep(150);
      }

      if (!editBox) {
        throw new Error("[CONTENT BRIDGE]: Edit post dialog textbox not found.");
      }

      // 4. Paste clean text with single-insertion guarantee
      if (params.text) {
        await pasteHumanText(editBox, params.text);
      }

      // 5. Click Save button
      const saveRegex = /^(save|बचत\s*गर्नुहोस्|बचत|सुरक्षित\s*गर्नुहोस्|सेव\s*करें|सेव)$/i;
      let saveBtn = null;
      for (let sAttempt = 0; sAttempt < 20; sAttempt++) {
        const btns = Array.from((editModal || document).querySelectorAll('div[role="button"], button'));
        saveBtn = btns.find(b => {
          const t = (b.textContent || b.getAttribute("aria-label") || "").trim();
          const disabled = b.getAttribute("aria-disabled") === "true" || b.disabled;
          return saveRegex.test(t) && !disabled;
        });
        if (saveBtn) break;
        await sleep(100);
      }

      if (saveBtn) {
        await humanClick(saveBtn);
      } else {
        throw new Error("[CONTENT BRIDGE]: Save button not found in edit post dialog.");
      }

      await sleep(800);
      return { success: true, edited: true };
    }

    case "INJECT_FILE_DATATRANSFER": {
      const inputEl = document.querySelector(params.selector || 'input[type="file"]');
      if (!inputEl) {
        throw new Error("File input element not found for DataTransfer injection.");
      }
      const mimeType = params.mime_type || "image/jpeg";
      const fileName = params.file_name || "media_asset.jpg";
      const binaryString = atob(params.base64_data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputEl.files = dataTransfer.files;

      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(500);
      return { injected: true, fileName, bytes: len };
    }

    case "AUTONOMOUS_FACEBOOK_POST": {
      // Supported for www.facebook.com personal feed, profile, or groups
      if (!window.location.hostname.includes("facebook.com")) {
        throw new Error("[CONTENT BRIDGE]: AUTONOMOUS_FACEBOOK_POST requires a facebook.com domain.");
      }

      // Check DOM for existing Meta restriction screens ("You're Temporarily Blocked", "Going too fast", etc.)
      const initialDanger = checkDomForMetaBlock();
      if (initialDanger.blocked) {
        throw new Error(`[SUPERVISOR HARD LOCK]: Meta restriction screen detected ("${initialDanger.phrase}"). Action halted to protect account.`);
      }

      // 1. Locate or Open Facebook Post Composer (Strictly filter out comment boxes!)
      let modal = null;
      let textbox = null;

      // Check if a Create Post dialog is already open
      const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
      for (const d of dialogs) {
        // Exclude image viewers or post comment viewers
        if (d.querySelector('div[data-pagelet*="FeedUnit"], div[role="article"]')) continue;
        const tb = d.querySelector('div[role="textbox"][contenteditable="true"]');
        if (tb && !isCommentBox(tb)) {
          const text = (d.textContent || "").toLowerCase();
          const hasPostSign = text.includes("post") || text.includes("mind") || text.includes("दिमाग") || text.includes("सोच") || text.includes("पोस्ट") || text.includes("share") || text.includes("photo") || d.querySelector('div[aria-label*="Post" i], div[aria-label*="पोस्ट" i]');
          if (hasPostSign) {
            modal = d;
            textbox = tb;
            break;
          }
        }
      }

      if (!textbox) {
        // Locate Composer trigger button on top of Feed, Profile, or Group
        window.scrollTo({ top: 0, behavior: "instant" });
        await sleep(50);

        const triggerRegex = /what[’']?s\s*on\s*your\s*mind|write\s*something|create\s*(a\s*)?post|के\s*सोचिरहनुभएको|दिमागमा|तपाईंको\s*दिमाग|लेख्नुहोस्|केही\s*लेख्नु|पोस्ट\s*बनाउनुहोस्|कुछ\s*लिखें|पोस्ट\s*करें|photo\/video|फोटो\/भिडियो/i;
        
        // Find composer trigger with robust polling (handles dynamic React pagelet mounting)
        let composerTrigger = null;
        for (let pollTrigger = 0; pollTrigger < 20; pollTrigger++) {
          const composerContainers = Array.from(document.querySelectorAll('div[data-pagelet*="Composer"], div[data-pagelet*="ProfileComposer"], div[role="region"], div[role="main"]'));
          for (const container of composerContainers) {
            const candidates = Array.from(container.querySelectorAll('div[role="button"], button, span'));
            composerTrigger = candidates.find(el => {
              if (isCommentBox(el)) return false;
              if (el.closest('div[data-pagelet*="FeedUnit"], div[role="article"]')) return false;
              const text = (el.textContent || el.getAttribute("aria-label") || "").trim();
              return triggerRegex.test(text);
            });
            if (composerTrigger) break;
          }

          if (!composerTrigger) {
            const directPageletBtn = document.querySelector('div[data-pagelet*="Composer"] div[role="button"], div[data-pagelet*="ProfileComposer"] div[role="button"]');
            if (directPageletBtn && !isCommentBox(directPageletBtn) && !directPageletBtn.closest('div[data-pagelet*="FeedUnit"]')) {
              composerTrigger = directPageletBtn;
            }
          }

          if (!composerTrigger) {
            const allCandidates = Array.from(document.querySelectorAll('div[role="button"], button, span'));
            composerTrigger = allCandidates.find(el => {
              if (isCommentBox(el)) return false;
              if (el.closest('div[data-pagelet*="FeedUnit"], div[role="article"]')) return false;
              const text = (el.textContent || el.getAttribute("aria-label") || "").trim();
              return triggerRegex.test(text);
            });
          }

          if (composerTrigger) break;
          await sleep(150);
        }

        if (composerTrigger) {
          const btn = composerTrigger.closest('div[role="button"]') || composerTrigger;
          await humanClick(btn, true);
          try { btn.click(); } catch (e) {}
          try { composerTrigger.click(); } catch (e) {}
        }

        // Micro-poll for Composer modal dialog and valid textbox to appear
        for (let waitStep = 0; waitStep < 40; waitStep++) {
          await sleep(200);
          const currentDialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
          for (const d of currentDialogs) {
            const tb = d.querySelector('div[role="textbox"][contenteditable="true"]') ||
                       d.querySelector('div[data-lexical-editor="true"]') ||
                       d.querySelector('div[contenteditable="true"]');
            if (tb && !isCommentBox(tb)) {
              modal = d;
              textbox = tb;
              break;
            }
          }
          if (textbox) break;
          // Fallback check: composer pagelet textbox
          const pageletTb = document.querySelector('div[data-pagelet*="Composer"] div[role="textbox"][contenteditable="true"]') ||
                            document.querySelector('div[data-pagelet*="Composer"] div[data-lexical-editor="true"]');
          if (pageletTb && !isCommentBox(pageletTb)) {
            textbox = pageletTb;
            break;
          }
        }
      }

      if (!textbox) {
        throw new Error("Facebook composer modal text box not found. Make sure Create Post dialog is open.");
      }

      const targetContainer = modal || document;

      // 1.5 Populate text BEFORE media attachment while the main textbox is wide open
      if (params.text && textbox) {
        await pasteHumanText(textbox, params.text);
      }

      // 2. Attach media (image or reel/video) via Existing DOM Input or Detached Input Capture + Drop Fallback
      if (params.base64_data) {
        // Discard any auto-recovered draft media inside composer first (anti-multi-photo)
        try {
          const draftRemoveBtns = Array.from(targetContainer.querySelectorAll('div[aria-label*="Remove photo" i], div[aria-label*="Remove video" i], div[aria-label*="Remove attachment" i], div[aria-label*="Remove media" i], div[aria-label*="हटाउनुहोस्" i], div[aria-label*="हटाएं" i]')).filter(b => {
            const lbl = (b.getAttribute("aria-label") || "").toLowerCase();
            return !lbl.includes("dialog") && !lbl.includes("window") && !lbl.includes("screen");
          });
          for (const drb of draftRemoveBtns) {
            try { drb.click(); } catch (e) {}
            await sleep(80);
          }
        } catch (e) {}

        const mimeType = params.mime_type || (params.is_video ? "video/mp4" : "image/jpeg");
        const fileName = params.file_name || (params.is_video ? "reel.mp4" : "photo.jpg");
        const binaryString = atob(params.base64_data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType, lastModified: Date.now() });
        const dt = new DataTransfer();
        dt.items.add(file);

        let capturedInput = null;
        const origInputClick = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function (...args) {
          if (this && this.type === "file") {
            capturedInput = this;
            return;
          }
          return origInputClick.apply(this, args);
        };

        let fileInput = targetContainer.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
        try {
          if (!fileInput) {
            const photoBtn = targetContainer.querySelector('div[aria-label*="Photo" i], div[aria-label*="photo" i], div[aria-label*="Video" i], svg[aria-label*="Photo" i], div[aria-label*="फोटो" i], div[aria-label*="भिडियो" i], div[aria-label*="तस्विर" i]');
            if (photoBtn) {
              await humanClick(photoBtn.closest('div[role="button"]') || photoBtn, true);
              for (let fp = 0; fp < 15; fp++) {
                await sleep(80);
                fileInput = capturedInput || targetContainer.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
                if (fileInput) break;
              }
            }
          }
        } finally {
          HTMLInputElement.prototype.click = origInputClick;
        }

        if (fileInput) {
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event("input", { bubbles: true }));
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const hasPreviewMounted = () => {
          const hasBlobImg = Array.from(targetContainer.querySelectorAll("img")).some(img => {
            const src = img.getAttribute("src") || "";
            const r = img.getBoundingClientRect();
            return (src.startsWith("blob:") || src.startsWith("data:image/")) && r.width >= 36 && r.height >= 36;
          });
          const hasVid = Boolean(targetContainer.querySelector("video"));
          const hasRemove = Boolean(targetContainer.querySelector('[aria-label*="Remove photo" i], [aria-label*="Edit photo" i], [aria-label*="Edit All" i]'));
          return hasBlobImg || hasVid || hasRemove;
        };

        await sleep(600);
        if (!hasPreviewMounted()) {
          // Synthetic DragEvent("drop") fallback onto composer dropzone/textbox
          const dropZone = textbox || targetContainer;
          for (const evtName of ["dragenter", "dragover", "drop"]) {
            dropZone.dispatchEvent(new DragEvent(evtName, { bubbles: true, cancelable: true, dataTransfer: dt }));
          }
        }

        // Wait for media preview or active submit button
        for (let mp = 0; mp < 20; mp++) {
          if (hasPreviewMounted()) break;
          await sleep(120);
        }

        // Single-Photo Deduplication Guard: if >1 remove photo button exists for a single image upload, remove extras
        const extraRemoves = Array.from(targetContainer.querySelectorAll('div[aria-label*="Remove photo" i], div[aria-label*="Remove attachment" i]'));
        for (let rIdx = 1; rIdx < extraRemoves.length; rIdx++) {
          try { extraRemoves[rIdx].click(); } catch (e) {}
        }
      }

      // 3. Re-acquire active textbox AFTER media dropzone mount and verify/paste text
      if (params.text) {
        for (let t_poll = 0; t_poll < 10; t_poll++) {
          const freshTb = targetContainer.querySelector('div[role="textbox"][contenteditable="true"]') ||
                          targetContainer.querySelector('div[data-lexical-editor="true"]') ||
                          targetContainer.querySelector('div[contenteditable="true"]') ||
                          document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]') ||
                          document.querySelector('div[role="dialog"] div[data-lexical-editor="true"]');
          if (freshTb && !isCommentBox(freshTb)) {
            textbox = freshTb;
            break;
          }
          // Click placeholder "What's on your mind..." if collapsed above photo preview on phone
          const ph = Array.from(targetContainer.querySelectorAll('div, span')).find(el =>
            /^(what['’]?s on your mind|write something|के सोचिरहनुभएको)/i.test((el.innerText || "").trim())
          );
          if (ph) {
            try { ph.click(); } catch (e) {}
          }
          await sleep(100);
        }

        const existingVal = (textbox.innerText || textbox.textContent || "").trim();
        if (existingVal.length < 10 || /what['’]s on your mind/i.test(existingVal)) {
          await pasteHumanText(textbox, params.text);
        }

        // Verification & Self-Healing: ensure textbox actually contains the caption
        let textVerified = false;
        for (let v = 0; v < 4; v++) {
          const cur = (textbox.innerText || textbox.textContent || "").trim();
          if (cur.length >= 10 && !/what['’]s on your mind/i.test(cur)) {
            textVerified = true;
            break;
          }
          await sleep(150);
          await pasteHumanText(textbox, params.text);
        }

        if (!textVerified) {
          try {
            textbox.focus();
            document.execCommand("selectAll", false, null);
            document.execCommand("insertText", false, params.text);
          } catch (e) {}
        }
      }

      // 4. Submit / Post: wait until Post button is active (fast micro-polling)
      if (params.auto_publish) {
        let pubBtn = null;
        const postRegex = /^(post|publish|पोस्ट\s*गर्नुहोस्|पोस्ट\s*गर्नुहोस|पोस्ट\s*गर|पोस्ट\s*करें|साझा\s*गर्नुहोस्|शेयर\s*करें|प्रकाशित\s*करें)$/i;
        const targetScope = modal || document;
        for (let attempt = 0; attempt < 25; attempt++) {
          const postBtns = Array.from(targetScope.querySelectorAll('div[role="button"], button'));
          pubBtn = postBtns.find(b => {
            const label = (b.getAttribute("aria-label") || "").trim();
            const text = (b.textContent || "").trim();
            const isPost = postRegex.test(label) || postRegex.test(text);
            const isDisabled = b.getAttribute("aria-disabled") === "true" || b.disabled;
            return isPost && !isDisabled;
          });
          if (pubBtn) break;
          await sleep(100);
        }

        if (pubBtn) {
          await humanClick(pubBtn, true);
        } else {
          const fallbackBtn = Array.from(targetScope.querySelectorAll('div[role="button"], button')).find(b => {
            const t = (b.getAttribute("aria-label") || b.textContent || "").trim();
            return postRegex.test(t);
          });
          if (fallbackBtn) {
            await humanClick(fallbackBtn, true);
          } else {
            throw new Error("[CONTENT BRIDGE]: Active Post button not found in Facebook composer dialog.");
          }
        }

        // Global Anti-Repeat: Wait for Facebook modal dialog to disappear completely from DOM (up to 35s)
        let modalDismissed = false;
        const postStartTime = Date.now();
        while (Date.now() - postStartTime < 35000) {
          await sleep(150);

          const remainingDialogs = Array.from(document.querySelectorAll('div[role="dialog"]')).filter(d => {
            if (d.querySelector('div[data-pagelet*="FeedUnit"], div[role="article"]')) return false;
            const text = (d.textContent || "").toLowerCase();
            return text.includes("create post") || text.includes("पोस्ट") || text.includes("add to your post") || text.includes("तपाईंको पोस्ट");
          });

          if (remainingDialogs.length === 0) {
            modalDismissed = true;
            break;
          }

          // Check if Facebook raised an error alert dialog
          const errorDialog = document.querySelector('div[role="alertdialog"]');
          if (errorDialog) {
            const errText = errorDialog.textContent || "";
            throw new Error(`[CONTENT BRIDGE]: Facebook rejected post with alert: ${errText}`);
          }
        }

        if (!modalDismissed) {
          console.warn("[CONTENT BRIDGE]: Facebook post modal did not disappear within 35s. Attempting clean state exit.");
        }
        await sleep(400);
      }

      return { completed: true, canvas: "Facebook Standard Web", target_type: params.target_type };
    }

    case "AUTONOMOUS_BUSINESS_SUITE_POST": {
      // RULE #1: NEVER ESCAPE TO WWW.FACEBOOK.COM CONSUMER FEED
      if (!window.location.hostname.includes("business.facebook.com")) {
        throw new Error(
          "[SUPERVISOR SUPPRESSED]: Action blocked by MetaSupervisorGuard. Allowed host is 'business.facebook.com'. Never operate on consumer feed."
        );
      }

      // Check DOM for existing blocks
      const initialDanger = checkDomForMetaBlock();
      if (initialDanger.blocked) {
        throw new Error(`[SUPERVISOR SUPPRESSED]: Meta restriction screen active ("${initialDanger.phrase}"). 24-hour protection lock engaged.`);
      }

      // 1. Locate text editor in Meta Business Suite composer with retry polling
      let textbox = null;
      const composerSelectors = [
        'div[role="textbox"][contenteditable="true"]',
        'div[data-lexical-editor="true"]',
        'div.notranslate[contenteditable="true"]',
        'div[data-editor="true"]',
        'div.DraftEditor-root div[contenteditable="true"]',
        'div[aria-label*="What\'s on your mind" i]',
        'div[aria-label*="Write an update" i]',
        'div[aria-label*="Post details" i]',
        'div[aria-label*="Text" i]',
        'div[contenteditable="true"]',
        'textarea'
      ];

      const isAlreadyOnComposer = window.location.href.includes("/composer");

      for (let attempt = 0; attempt < 40; attempt++) {
        // ONLY click "Create post" if NOT already on /composer (clicking on composer triggers page reload)
        if (!textbox && !isAlreadyOnComposer && attempt === 0) {
          const createPostBtn = Array.from(document.querySelectorAll('div[role="button"], button')).find(b =>
            /create\s*(a\s*)?post|new\s*post|पोस्ट\s*बनाउनुहोस्/i.test(b.textContent || b.getAttribute('aria-label') || '')
          );
          if (createPostBtn && !document.querySelector('div[role="dialog"]')) {
            try { createPostBtn.click(); } catch (e) {}
            await sleep(1500);
          }
        }

        for (const sel of composerSelectors) {
          textbox = document.querySelector(sel);
          if (textbox && !isCommentBox(textbox)) break;
        }
        if (textbox) break;
        await sleep(400);
      }

      if (!textbox) {
        // Fallback: check if modal dialog is present
        const fbModal = document.querySelector('div[role="dialog"]');
        if (fbModal) {
          textbox = fbModal.querySelector('div[role="textbox"][contenteditable="true"]') || fbModal.querySelector('div[contenteditable="true"]');
        }
      }

      if (!textbox) {
        throw new Error("Meta Business Suite composer text area not found after 16s. Ensure composer canvas has loaded.");
      }

      // 1. If media provided, inject via DataTransfer into file input FIRST
      if (params.base64_data) {
        let capturedInput = null;
        const origInputClick = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function (...args) {
          if (this && this.type === "file") {
            capturedInput = this;
            return;
          }
          return origInputClick.apply(this, args);
        };

        let fileInput = document.querySelector('input[type="file"]') || document.querySelector('input[accept*="image"]');
        try {
          if (!fileInput) {
            const addPhotoBtn = Array.from(document.querySelectorAll('div[role="button"], button')).find(b =>
              /add\s*photo|add\s*video|photo\/video|upload|media|तस्बिर\s*थप्नुहोस्/i.test(b.textContent || b.getAttribute('aria-label') || '')
            );
            if (addPhotoBtn) {
              await humanClick(addPhotoBtn.closest('div[role="button"]') || addPhotoBtn, true);
              for (let fp = 0; fp < 30; fp++) {
                await sleep(100);
                fileInput = capturedInput || document.querySelector('input[type="file"]') || document.querySelector('input[accept*="image"]');
                if (fileInput) break;
              }
            }
          }
        } finally {
          HTMLInputElement.prototype.click = origInputClick;
        }

        if (fileInput) {
          const mimeType = params.mime_type || (params.is_video ? "video/mp4" : "image/jpeg");
          const fileName = params.file_name || (params.is_video ? "reel.mp4" : "photo.jpg");
          const binaryString = atob(params.base64_data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });
          const file = new File([blob], fileName, { type: mimeType });
          const dt = new DataTransfer();
          dt.items.add(file);
          try {
            fileInput.files = dt.files;
          } catch (e) {
            Object.defineProperty(fileInput, "files", {
              value: dt.files,
              writable: false
            });
          }
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          fileInput.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(2500); // Wait for media card thumbnail upload to register
        }
        // 2. Anti-Ad Guard: Strictly ensure "Make this an ad post" switch is OFF (Organic Only)
        try {
          const adSwitches = Array.from(document.querySelectorAll('input[type="checkbox"][role="switch"], input[role="switch"]')).filter(i =>
            /make this an ad|ad post|विज्ञापन/i.test(i.getAttribute('aria-label') || '')
          );
          for (const s of adSwitches) {
            if (s.checked || s.getAttribute('aria-checked') === 'true') {
              await humanClick(s);
              await sleep(300);
            }
          }
        } catch (e) {}

        // 3. Custom Thumbnail / Video Cover Ingestion in Meta Business Suite
        if (params.thumbnail_base64 && params.is_video) {
          try {
            let thumbBtn = null;
            for (let t_attempt = 0; t_attempt < 8; t_attempt++) {
              thumbBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(b =>
                /video\s*options|thumbnail|edit\s*video|cover|विकल्प/i.test(b.textContent || b.getAttribute('aria-label') || '')
              );
              if (thumbBtn) break;
              await sleep(500);
            }
            if (thumbBtn) {
              await humanClick(thumbBtn);
              await sleep(800);
              const customThumbBtn = Array.from(document.querySelectorAll('button, div[role="button"], span')).find(b =>
                /upload\s*image|custom|add\s*image/i.test(b.textContent || b.getAttribute('aria-label') || '')
              );
              if (customThumbBtn) {
                await humanClick(customThumbBtn);
                await sleep(400);
              }
              let thumbInput = document.querySelector('input[type="file"][accept*="image"], input[accept*="image"]');
              if (thumbInput) {
                const tBytes = atob(params.thumbnail_base64);
                const tArr = new Uint8Array(tBytes.length);
                for (let i = 0; i < tBytes.length; i++) tArr[i] = tBytes.charCodeAt(i);
                const tBlob = new Blob([tArr], { type: params.thumbnail_mime_type || "image/jpeg" });
                const tFile = new File([tBlob], params.thumbnail_file_name || "cover.jpg", { type: params.thumbnail_mime_type || "image/jpeg" });
                const tDt = new DataTransfer();
                tDt.items.add(tFile);
                thumbInput.files = tDt.files;
                thumbInput.dispatchEvent(new Event("change", { bubbles: true }));
                thumbInput.dispatchEvent(new Event("input", { bubbles: true }));
                await sleep(1200);
                const saveBtn = Array.from(document.querySelectorAll('div[role="dialog"] button, div[role="dialog"] div[role="button"]')).find(b =>
                  /save|done|apply/i.test(b.textContent || b.getAttribute('aria-label') || '')
                );
                if (saveBtn) await humanClick(saveBtn);
                await sleep(600);
              }
            }
          } catch (thumbErr) {
            console.warn("[MetaBridge] Non-critical thumbnail upload fallback:", thumbErr);
          }
        }

        // 4. Native MBS Schedule Toggle (If future scheduling requested)
        if (params.schedule_time_iso && !params.bypass_spacing) {
          try {
            const schedSwitches = Array.from(document.querySelectorAll('input[type="checkbox"][role="switch"], input[role="switch"]')).filter(i =>
              /set date and time|schedule|समय निर्धारण/i.test(i.getAttribute('aria-label') || '')
            );
            for (const sw of schedSwitches) {
              if (!sw.checked && sw.getAttribute('aria-checked') !== 'true') {
                await humanClick(sw);
                await sleep(500);
              }
            }
          } catch (e) {}
        }
      }

      // 5. Re-acquire textbox after media mount and paste text with verification
      if (params.text) {
        for (let re = 0; re < 15; re++) {
          for (const sel of composerSelectors) {
            const freshTb = document.querySelector(sel);
            if (freshTb && !isCommentBox(freshTb)) {
              textbox = freshTb;
              break;
            }
          }
          if (textbox) break;
          await sleep(100);
        }

        if (textbox) {
          await pasteHumanText(textbox, params.text);
          // Verification
          let textVerified = false;
          for (let v = 0; v < 3; v++) {
            const cur = (textbox.innerText || textbox.textContent || "").trim();
            if (cur.length >= 10) {
              textVerified = true;
              break;
            }
            await sleep(150);
            await pasteHumanText(textbox, params.text);
          }
        }
      }

      // Natural Human Reading Pause (1.5s - 2.5s) per User Rule #6 (Anti-Boring, Fast Publish)
      await sleep(1500 + Math.random() * 1000);

      // Sentinel: Check DOM again right before clicking submit
      const prePublishCheck = checkDomForMetaBlock();
      if (prePublishCheck.blocked) {
        throw new Error(`[SUPERVISOR SUPPRESSED]: Meta restriction screen active ("${prePublishCheck.phrase}"). 24-hour protection lock engaged.`);
      }

      // 3. Autonomous Publish or Schedule with Single-Click Anti-Panic Rule
      if (params.auto_publish) {
        let pubBtn = null;
        for (let attempt = 0; attempt < 30; attempt++) {
          const publishBtns = Array.from(document.querySelectorAll('div[role="button"], button'));
          pubBtn = publishBtns.find(b => {
            const t = (b.textContent || b.getAttribute("aria-label") || "").trim();
            const isDisabled = b.getAttribute("aria-disabled") === "true" || b.disabled;
            return /^(publish|schedule|post|साझा\s*गर्नुहोस्|प्रकाशित\s*करें)$/i.test(t) && !/cancel|draft/i.test(t) && !isDisabled;
          });
          if (pubBtn) break;
          await sleep(500);
        }

        if (!pubBtn) {
          const fallback = Array.from(document.querySelectorAll('div[role="button"], button')).find(b =>
            /publish|schedule|post/i.test(b.textContent || b.getAttribute("aria-label") || "") && !/cancel|draft/i.test(b.textContent || "")
          );
          if (fallback) pubBtn = fallback;
        }

        if (pubBtn) {
          // Dismiss any autocomplete popup
          try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
          } catch (e) {}
          await humanClick(pubBtn);
          await sleep(3500);

          const postClickCheck = checkDomForMetaBlock();
          if (postClickCheck.blocked) {
            throw new Error(`[SUPERVISOR SUPPRESSED]: Meta restriction screen appeared after submit ("${postClickCheck.phrase}"). 24-hour protection lock engaged.`);
          }
        } else {
          throw new Error("Meta Business Suite Publish button not found or remained disabled after media upload.");
        }
      }

      return { completed: true, canvas: "Meta Business Suite" };
    }

    case "AUTONOMOUS_INSTAGRAM_POST": {
      // 1. Check if Create modal is already open
      let modal = document.querySelector('div[role="dialog"]');
      if (!modal) {
        // Find Create / New Post button on Instagram sidebar
        const createBtn = Array.from(document.querySelectorAll('a, div[role="button"], button, svg, span')).find(el => {
          const label = el.getAttribute("aria-label") || el.textContent || "";
          return /^(create|new\s*post|नयाँ\s*पोस्ट|बनाउनुहोस्|बनाएं)$/i.test(label.trim());
        });
        if (createBtn) {
          const clickable = createBtn.closest('a') || createBtn.closest('div[role="button"]') || createBtn;
          await humanClick(clickable);
          await sleep(1200);
        }
        for (let mWait = 0; mWait < 15; mWait++) {
          modal = document.querySelector('div[role="dialog"]');
          if (modal) break;
          await sleep(250);
        }
        modal = modal || document.body;
      }

      // 2. Inject media via DataTransfer into file input
      if (params.base64_data) {
        let fileInput = modal.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
        if (!fileInput) {
          const selectFromCompBtn = Array.from(modal.querySelectorAll('button, div[role="button"]')).find(b =>
            /select\s*from\s*computer|कम्प्युटरबाट|कंप्यूटर\s*से/i.test(b.textContent || "")
          );
          if (selectFromCompBtn) {
            await humanClick(selectFromCompBtn);
            await sleep(500);
            fileInput = modal.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
          }
        }

        if (fileInput) {
          const mimeType = params.mime_type || (params.is_video ? "video/mp4" : "image/jpeg");
          const fileName = params.file_name || (params.is_video ? "reel.mp4" : "photo.jpg");
          const binaryString = atob(params.base64_data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });
          const file = new File([blob], fileName, { type: mimeType });
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          fileInput.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(2000);
        }

        // Handle video "Reels" notice modal if shown
        if (params.is_video) {
          await sleep(1000);
          const okBtns = Array.from(document.querySelectorAll('div[role="dialog"] button, div[role="button"]')).filter(b =>
            /^(ok|got it|continue|dismiss)$/i.test((b.textContent || b.getAttribute("aria-label") || "").trim())
          );
          if (okBtns.length > 0) {
            try { await humanClick(okBtns[0]); } catch (e) {}
            await sleep(600);
          }
        }
      }

      // 3. Click "Next" on Crop & Filter Screens
      const nextRegex = /^(next|अगला|अर्को)$/i;
      for (let step = 0; step < 2; step++) {
        let nextBtn = null;
        for (let attempt = 0; attempt < 20; attempt++) {
          const btns = Array.from((modal || document).querySelectorAll('div[role="button"], button'));
          nextBtn = btns.find(b => {
            const t = (b.textContent || b.getAttribute("aria-label") || "").trim();
            const isDisabled = b.getAttribute("aria-disabled") === "true" || b.disabled;
            return nextRegex.test(t) && !isDisabled;
          });
          if (nextBtn) break;
          await sleep(400);
        }
        if (nextBtn) {
          await humanClick(nextBtn);
          await sleep(1000);
        }
      }

      // 4. Type caption into textarea / contenteditable textbox
      let captionBox = (modal || document).querySelector('div[aria-label*="caption" i], div[role="textbox"][contenteditable="true"], textarea');
      if (captionBox && params.text) {
        await pasteHumanText(captionBox, params.text);
        await sleep(600);
      }

      // 5. Click "Share" button
      if (params.auto_publish) {
        let shareBtn = null;
        const shareRegex = /^(share|साझा\s*गर्नुहोस्|शेयर\s*करें)$/i;
        for (let attempt = 0; attempt < 20; attempt++) {
          const btns = Array.from((modal || document).querySelectorAll('div[role="button"], button'));
          shareBtn = btns.find(b => {
            const t = (b.textContent || b.getAttribute("aria-label") || "").trim();
            const isDisabled = b.getAttribute("aria-disabled") === "true" || b.disabled;
            return shareRegex.test(t) && !isDisabled;
          });
          if (shareBtn) break;
          await sleep(400);
        }
        if (shareBtn) {
          await humanClick(shareBtn);
          await sleep(3500);
        }
      }

      return { completed: true, canvas: "Instagram Web" };
    }

    case "EXTRACT_PAGE_DATA": {
      const pageData = {
        title: document.title,
        url: window.location.href,
        tokens: window.location.hostname.includes("facebook.com")
          ? extractFacebookTokens()
          : extractInstagramTokens()
      };
      return pageData;
    }

    default:
      throw new Error(`Unsupported content action: ${action}`);
  }
}

// Keepalive port connection to background worker to prevent MV3 dormancy while tab is open
function initBridgeKeepalive() {
  try {
    const port = chrome.runtime.connect({ name: "meta-bridge-keepalive" });
    port.onDisconnect.addListener(() => {
      setTimeout(initBridgeKeepalive, 2500);
    });
  } catch (e) {
    // Suppress if extension reloaded
  }
}

initBridgeKeepalive();
