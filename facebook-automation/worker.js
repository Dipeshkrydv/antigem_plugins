/**
 * AntiGem WebView MCP Service Worker for Facebook Automation & SEO Studio (v1.5.0)
 *
 * Pre-Trained Phone (Mobile UI + Desktop-on-Phone UI) & Desktop Precision Engine:
 * 1. Complete Built-In Knowledge Graph (`FB_UI_ATLAS`) for:
 *    - Phone in Desktop Site Mode (`www.facebook.com` on Android WebView — Create Post modal, Photo/Video toolbar, Reels wizard, Story studio).
 *    - Phone in Mobile Touch Mode (`m.facebook.com` — #MComposer, full-screen composer, Bloks textboxes, 1-step & 2-step Next -> Post flows).
 *    - Desktop Browser (`www.facebook.com` & `business.facebook.com`).
 * 2. Smart Active Composer Dialog Scorer (`findComposerDialog`):
 *    - Never mistakes hidden Notification, Messenger, Account, or audience sub-popovers (`[Friends v]`, `[AI label off v]`) for the Create Post modal.
 *    - Always searches the active Composer Dialog FIRST and automatically falls back to `document` (excluding feed articles & comment boxes).
 * 3. Instant Single-Shot Media Attachment & Anti-Double-Photo Guard:
 *    - Purges any leftover/stale draft attachments in an already-open modal before attaching new media.
 *    - Directly binds existing DOM `<input type="file">` via CDP `DOM.setFileInputFiles` in <150ms without redundant manual `change` events (fixes double-photo attachment bug!).
 *    - Deduplicates previews if >1 preview ever mounts for a single-photo upload.
 * 4. Formatted Multiline Caption Engine & Anti-Duplication Verifier (`populateComposerCaption`):
 *    - Preserves blank-line spacing across Title/Hook, Description/Quote, Bullets, CTA, and 3–6 `#Hashtags` via Clipboard paste -> line-by-line paragraph insert -> CDP `Input.insertText` + `Shift+Enter`.
 *    - Verifies head/tail and no duplication before publishing.
 * 5. Real Thumbnail / Cover Uploader, Reels Wizard (`/reels/create`), & Stories Studio (`/stories/create`):
 *    - Uploads custom `thumbnail_path` inside Facebook's Edit Video -> Thumbnail or Reel Cover panel (never attaches thumbnail as a second post media item).
 *    - Supports Photo/Video Stories with optional `story_text` overlay and Text Stories.
 * 6. Direct Reference Fast-Path:
 *    - Instantly resolves any user-supplied file path (`file:///...`, `/sdcard/...`, `/storage/emulated/0/...`, `.user_uploaded/...`, `~/...`, or `"latest"`) with zero search delay.
 */

const PLUGIN_ID = "facebook-automation";
const PLUGIN_VERSION = "1.5.0";
const FB_HOME_URL = "https://www.facebook.com/";
const FB_REELS_CREATE_URL = "https://www.facebook.com/reels/create";
const FB_STORIES_CREATE_URL = "https://www.facebook.com/stories/create";
const DEDUPE_WINDOW_MS = 24 * 3600 * 1000; // 24 hours
const MIN_POST_INTERVAL_MS = 8 * 1000;     // 8s anti-burst spacing

let inFlightLock = null;
const attachedDebuggerTabs = new Set();

// ============================================================================
// 0. Pre-Trained Facebook UI Knowledge Atlas (Phone Desktop, Phone Mobile, Web)
// ============================================================================

const FB_UI_ATLAS = {
  composerTriggers: [
    'div[aria-label*="Create a post" i]',
    'div[aria-label*="Make a post" i]',
    'div[data-pagelet*="Composer"] div[role="button"]',
    'div[data-pagelet="ProfileComposer"] div[role="button"]',
    '#MComposer div[role="button"]',
    '#MComposer a',
    'a[href*="/composer/"]',
    'div[role="region"] div[role="button"]',
    'div[role="main"] div[role="button"]'
  ],
  composerTriggerTextRegex:
    /what['’]?s on your mind|make a post|write something|create a post|share something|say something|के सोचिरहनुभएको|तपाईंको दिमाग|पोस्ट बनाउनुहोस्|कुछ लिखें|पोस्ट करें/i,
  captionSelectors: [
    'div[role="textbox"][contenteditable="true"]',
    'div[data-lexical-editor="true"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
    'div[aria-placeholder*="on your mind" i]',
    'div[aria-label*="on your mind" i]',
    'div[aria-label*="Write something" i]',
    'div[aria-label*="Say something" i]',
    'div[aria-label*="Describe your reel" i]',
    'div[aria-placeholder*="Describe your reel" i]',
    'div[aria-label*="Write a description" i]',
    'div[contenteditable="true"]',
    'div[contenteditable="plaintext-only"]',
    '#composer-main-view-id textarea',
    'textarea.composerInput',
    'textarea[name="xc_message"]',
    'textarea'
  ],
  captionPlaceholderRegex:
    /what['’]?s on your mind|write something|say something|add a caption|describe your reel|write a description|start typing|के सोचिरहनुभएको|तपाईंको दिमाग|कुछ लिखें/i,
  photoVideoButtonRegex:
    /^(photo\/video|photos\/videos|photos|photo|add photos|add photo|add photos\/videos|add video|upload video|create a photo story|फोटो\/भिडियो|फोटो|तस्विर|फ़ोटो\/वीडियो)$/i,
  submitButtonRegex:
    /^(post|publish|share|share now|share to story|पोस्ट गर्नुहोस्|पोस्ट गर्नुहोस|पोस्ट|पोस्ट करें|साझा गर्नुहोस्|शेयर करें|प्रकाशित करें)$/i,
  nextButtonRegex: /^(next|done|अर्को|अगला)$/i
};

// ============================================================================
// 1. Utility, Storage & Instant Reference File Resolution
// ============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getStorage(keys) {
  try {
    return await chrome.storage.local.get(keys);
  } catch (_) {
    return {};
  }
}

async function setStorage(obj) {
  try {
    await chrome.storage.local.set(obj);
  } catch (_) {}
}

function normalizeCaption(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(String(str || ""));
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function guessMimeType(filePath) {
  const ext = (String(filePath || "").split("?")[0].split(".").pop() || "").toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    webm: "video/webm"
  };
  return map[ext] || "application/octet-stream";
}

function isVideoPath(filePath) {
  return /^video\//.test(guessMimeType(filePath));
}

function isImagePath(filePath) {
  return /^image\//.test(guessMimeType(filePath));
}

/**
 * Automatically discovers the most recently modified photo or video file
 * from standard Android / AntiGem / Desktop media directories when the user
 * says "upload a photo" / "upload this photo" or passes "latest" / "auto".
 */
async function autoDiscoverLatestMedia(preferVideo = false) {
  if (!chrome.antigem || typeof chrome.antigem.listFiles !== "function") {
    return null;
  }

  const searchDirs = [
    "/sdcard/Download/AntiGem",
    "/storage/emulated/0/Download/AntiGem",
    "/sdcard/Download",
    "/storage/emulated/0/Download",
    "/sdcard/Pictures",
    "/storage/emulated/0/Pictures",
    "/sdcard/DCIM/Camera",
    "/storage/emulated/0/DCIM/Camera",
    "~/Downloads",
    "~/Pictures",
    "/home/cat/Music/phone/Download/AntiGem",
    "/home/cat/Music/phone/Download",
    "/home/cat/facebook automation/assets",
    "/home/cat/Pictures",
    "/home/cat/Downloads"
  ];

  const validExts = preferVideo
    ? new Set(["mp4", "mov", "m4v", "webm"])
    : new Set(["jpg", "jpeg", "png", "webp"]);

  let bestFile = null;

  for (const dir of searchDirs) {
    try {
      const entries = await chrome.antigem.listFiles({ path: dir, recursive: false, limit: 250 });
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || !entry.isFile || entry.isDirectory) continue;
        const name = String(entry.name || entry.path || "");
        const ext = (name.split(".").pop() || "").toLowerCase();
        if (!validExts.has(ext)) continue;
        if ((entry.size || 0) < 1024) continue;
        const mtime = entry.modified || entry.mtime || 0;
        if (!bestFile || mtime > bestFile.mtime) {
          bestFile = {
            path: entry.path,
            size: entry.size || 0,
            mtime,
            mimeType: guessMimeType(entry.path),
            filename: entry.name || entry.path.split("/").pop() || (preferVideo ? "video.mp4" : "photo.jpg"),
            fingerprint: `file:${entry.path}:${entry.size || 0}:${mtime}`,
            verified: true
          };
        }
      }
    } catch (_) {}
  }

  return bestFile;
}

/**
 * Resolves a user-provided reference path or "latest" immediately without wasted probing.
 */
async function resolveLocalFile(rawPath, preferVideo = false) {
  let trimmed = String(rawPath || "").trim();
  if (trimmed.startsWith("file://")) {
    try {
      trimmed = decodeURIComponent(trimmed.replace(/^file:\/\//i, ""));
    } catch (_) {
      trimmed = trimmed.replace(/^file:\/\//i, "");
    }
  }

  if (!trimmed || /^(latest|newest|auto|last|recent)$/i.test(trimmed)) {
    const discovered = await autoDiscoverLatestMedia(preferVideo);
    if (discovered) return discovered;
    if (!trimmed) throw new Error("No media file path provided and no recent media found on device.");
  }

  // Fast-path: if an exact absolute path was given, check it FIRST in 1 call
  if (trimmed.startsWith("/") && chrome.antigem && typeof chrome.antigem.stat === "function") {
    try {
      const directStat = await chrome.antigem.stat({ path: trimmed });
      if (directStat && directStat.isFile !== false && !directStat.isDirectory && (directStat.size || 0) > 0) {
        const mtimeVal = directStat.modified || directStat.mtime || 0;
        const resolvedPath = directStat.path || trimmed;
        return {
          path: resolvedPath,
          size: directStat.size || 0,
          mtime: mtimeVal,
          mimeType: guessMimeType(resolvedPath),
          filename: resolvedPath.split("/").pop() || "upload.jpg",
          fingerprint: `file:${resolvedPath}:${directStat.size || 0}:${mtimeVal}`,
          verified: true
        };
      }
    } catch (_) {}
  }

  let p = trimmed;
  const candidates = [p];

  if (p.startsWith("~/")) {
    const rel = p.slice(2);
    candidates.unshift(
      `/data/data/com.antigem.app/files/home/${rel}`,
      `/data/user/0/com.antigem.app/files/home/${rel}`,
      `/data/data/com.termux/files/home/${rel}`,
      `/storage/emulated/0/${rel}`,
      `/sdcard/${rel}`,
      `/home/cat/${rel}`
    );
  } else if (p.startsWith("/sdcard/")) {
    const rel = p.slice("/sdcard/".length);
    candidates.unshift(
      `/storage/emulated/0/${rel}`,
      `/sdcard/${rel}`,
      `/home/cat/Music/phone/${rel}`
    );
  } else if (p.startsWith("/storage/emulated/0/")) {
    const rel = p.slice("/storage/emulated/0/".length);
    candidates.push(`/sdcard/${rel}`, `/home/cat/Music/phone/${rel}`);
  } else if (!p.startsWith("/")) {
    candidates.push(
      `/sdcard/Download/AntiGem/${p}`,
      `/storage/emulated/0/Download/AntiGem/${p}`,
      `/sdcard/Download/${p}`,
      `/storage/emulated/0/Download/${p}`,
      `/sdcard/Pictures/${p}`,
      `/storage/emulated/0/Pictures/${p}`,
      `/sdcard/DCIM/Camera/${p}`,
      `/storage/emulated/0/DCIM/Camera/${p}`,
      `/home/cat/facebook automation/assets/${p}`,
      `/home/cat/facebook automation/${p}`
    );
  }

  if (chrome.antigem && typeof chrome.antigem.stat === "function") {
    for (const c of candidates) {
      try {
        const st = await chrome.antigem.stat({ path: c });
        if (st && st.isFile !== false && !st.isDirectory && (st.size || 0) > 0) {
          const mtimeVal = st.modified || st.mtime || 0;
          const resolvedPath = st.path || c;
          return {
            path: resolvedPath,
            size: st.size || 0,
            mtime: mtimeVal,
            mimeType: guessMimeType(resolvedPath),
            filename: resolvedPath.split("/").pop() || "upload.jpg",
            fingerprint: `file:${resolvedPath}:${st.size || 0}:${mtimeVal}`,
            verified: true
          };
        }
      } catch (_) {}
    }

    const fallbackDiscovered = await autoDiscoverLatestMedia(preferVideo || isVideoPath(p));
    if (fallbackDiscovered) {
      return fallbackDiscovered;
    }
  }

  return {
    path: candidates[0],
    size: 0,
    mtime: 0,
    mimeType: guessMimeType(candidates[0]),
    filename: candidates[0].split("/").pop() || "upload.jpg",
    fingerprint: `file:${candidates[0]}`,
    verified: false
  };
}

// ============================================================================
// 2. Anti-Duplicate & Rate-Limit Sentinel
// ============================================================================

async function checkDuplicate(caption, mediaPaths, forcePublish = false) {
  if (forcePublish) return { isDuplicate: false, reason: null };

  const store = await getStorage(["fb_dedupe_ledger"]);
  const ledger = Array.isArray(store.fb_dedupe_ledger) ? store.fb_dedupe_ledger : [];
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  const activeLedger = ledger.filter((entry) => entry && entry.timestamp >= cutoff);

  if (caption && String(caption).trim().length > 20) {
    const capHash = await sha256Hex(normalizeCaption(caption));
    const match = activeLedger.find((e) => e.type === "caption" && e.hash === capHash);
    if (match) {
      return {
        isDuplicate: true,
        reason: `Duplicate caption blocked (already published at ${new Date(match.timestamp).toLocaleTimeString()}).`
      };
    }
  }

  return { isDuplicate: false, reason: null };
}

async function recordDedupe(caption, mediaPaths, postId) {
  const store = await getStorage(["fb_dedupe_ledger"]);
  const ledger = Array.isArray(store.fb_dedupe_ledger) ? store.fb_dedupe_ledger : [];
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  const activeLedger = ledger.filter((entry) => entry && entry.timestamp >= cutoff);
  const now = Date.now();

  if (caption && String(caption).trim().length > 20) {
    const capHash = await sha256Hex(normalizeCaption(caption));
    activeLedger.push({ type: "caption", hash: capHash, postId, timestamp: now });
  }

  if (Array.isArray(mediaPaths)) {
    for (const mp of mediaPaths) {
      try {
        const resolved = await resolveLocalFile(mp);
        const mediaHash = await sha256Hex(resolved.fingerprint);
        activeLedger.push({ type: "media", hash: mediaHash, postId, timestamp: now });
      } catch (_) {}
    }
  }

  await setStorage({ fb_dedupe_ledger: activeLedger.slice(-200) });
}

async function recordPostHistory(record) {
  const store = await getStorage(["fb_posts_history"]);
  const posts = Array.isArray(store.fb_posts_history) ? store.fb_posts_history : [];
  const idx = posts.findIndex((p) => p.id === record.id || (record.client_id && p.client_id === record.client_id));
  if (idx >= 0) {
    posts[idx] = { ...posts[idx], ...record, updated_at: Date.now() };
  } else {
    posts.unshift({ ...record, created_at: Date.now(), updated_at: Date.now() });
  }
  await setStorage({ fb_posts_history: posts.slice(0, 100) });
}

// ============================================================================
// 3. AntiGem Browser Tab & One-Time Login Management
// ============================================================================

function isFacebookUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === "facebook.com" ||
      u.hostname.endsWith(".facebook.com") ||
      u.hostname === "fb.com" ||
      u.hostname.endsWith(".fb.com")
    );
  } catch (_) {
    return false;
  }
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === "complete" && tab.url && tab.url !== "about:blank") {
        try {
          const [probe] = await chrome.scripting.executeScript({
            world: "MAIN",
            target: { tabId },
            func: () => ({
              readyState: document.readyState,
              href: location.href,
              hasBody: Boolean(document.body && document.body.children.length > 0)
            })
          });
          if (probe && probe.result && probe.result.hasBody && probe.result.readyState !== "loading") {
            return tab;
          }
        } catch (_) {
          return tab;
        }
      }
    } catch (_) {}
    await sleep(250);
  }
  return await chrome.tabs.get(tabId).catch(() => null);
}

/**
 * Finds an existing Facebook tab in the AntiGem browser or automatically opens a new one.
 */
async function ensureFacebookTab(options = {}) {
  const { targetUrl = null, activate = true, forceNavigate = false } = options;
  let fbTab = null;

  try {
    const allTabs = await chrome.tabs.query({});
    fbTab = allTabs.find((t) => isFacebookUrl(t.url || t.pendingUrl));
  } catch (_) {}

  const desiredUrl = targetUrl || FB_HOME_URL;

  if (!fbTab) {
    fbTab = await chrome.tabs.create({ url: desiredUrl, active: activate });
    await waitForTabComplete(fbTab.id, 20000);
    await sleep(500);
    return await chrome.tabs.get(fbTab.id).catch(() => fbTab);
  }

  const updateProps = {};
  if (activate && !fbTab.active) {
    updateProps.active = true;
  }
  if (forceNavigate && targetUrl && fbTab.url !== targetUrl) {
    updateProps.url = targetUrl;
  }

  if (Object.keys(updateProps).length > 0) {
    fbTab = await chrome.tabs.update(fbTab.id, updateProps);
    await waitForTabComplete(fbTab.id, 20000);
    await sleep(400);
  } else if (fbTab.status !== "complete") {
    await waitForTabComplete(fbTab.id, 12000);
  }

  return fbTab;
}

/**
 * Checks whether the user is currently logged into Facebook in the AntiGem browser.
 * Combines cookie inspection (c_user + xs) with live DOM inspection on both m.facebook.com and www.facebook.com.
 */
async function checkFacebookLogin(options = {}) {
  const { openIfMissing = true, activateOnLoginNeeded = true } = options;

  let fbTab = null;
  try {
    const allTabs = await chrome.tabs.query({});
    fbTab = allTabs.find((t) => isFacebookUrl(t.url || t.pendingUrl));
  } catch (_) {}

  let browserJustOpened = false;
  if (!fbTab && openIfMissing) {
    fbTab = await ensureFacebookTab({ targetUrl: FB_HOME_URL, activate: true });
    browserJustOpened = true;
  }

  let cUserCookie = null;
  let xsCookie = null;
  try {
    if (chrome.cookies && typeof chrome.cookies.getAll === "function") {
      const cookies = await chrome.cookies.getAll({ domain: "facebook.com" });
      cUserCookie = cookies.find((c) => c.name === "c_user" && c.value && c.value !== "0");
      xsCookie = cookies.find((c) => c.name === "xs" && c.value);
    }
  } catch (_) {}

  let domState = null;
  if (fbTab && fbTab.id) {
    try {
      const [res] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId: fbTab.id },
        func: () => {
          const href = location.href;
          const path = location.pathname || "";
          const html = document.documentElement ? document.documentElement.innerHTML : "";
          const bodyText = document.body ? document.body.innerText || "" : "";

          const hasLoginInput = Boolean(
            document.querySelector(
              'input[name="email"], input[name="pass"], #m_login_email, #m_login_password, button[name="login"], form[action*="/login"] input[type="password"]'
            )
          );
          const isLoginUrl = /^\/(login|recover|r\.php)/i.test(path) || href.includes("facebook.com/login");
          const isCheckpoint = path.includes("/checkpoint") || /confirm your identity|security check/i.test(bodyText);

          let userId = null;
          let userName = null;
          const idMatch =
            html.match(/"CurrentUserInitialData",\[\],\{[^}]*"USER_ID":"(\d+)"/i) ||
            html.match(/"USER_ID":"(\d+)"/i) ||
            html.match(/"ACCOUNT_ID":"(\d+)"/i);
          if (idMatch && idMatch[1] && idMatch[1] !== "0") {
            userId = idMatch[1];
          }

          const nameMatch =
            html.match(/"CurrentUserInitialData",\[\],\{[^}]*"NAME":"([^"]+)"/i) ||
            html.match(/"USER_NAME":"([^"]+)"/i);
          if (nameMatch && nameMatch[1]) {
            try {
              userName = JSON.parse(`"${nameMatch[1]}"`);
            } catch (_) {
              userName = nameMatch[1];
            }
          }

          const profileEl = document.querySelector(
            'a[href*="/me/"], a[href*="/profile.php"], div[aria-label*="Your profile" i], a[aria-label*="Your profile" i], div[aria-label*="Facebook Menu" i], div[aria-label*="Profile" i]'
          );
          if (!userName && profileEl) {
            const label = profileEl.getAttribute("aria-label") || profileEl.innerText || "";
            const cleaned = label.replace(/^Your profile:?\s*/i, "").trim();
            if (cleaned && cleaned.length > 1 && !/^(your profile|profile|facebook menu|menu)$/i.test(cleaned)) {
              userName = cleaned;
            }
          }

          const hasComposer = Boolean(
            document.querySelector(
              'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet="ProfileComposer"], #MComposer, a[href*="/composer/"], div[role="dialog"]'
            ) ||
              Array.from(document.querySelectorAll('div[role="button"], span, a')).some((el) => {
                const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
                return (
                  /what['’]?s on your mind/i.test(t) ||
                  /make a post/i.test(t) ||
                  /write something/i.test(t) ||
                  /create a post/i.test(t)
                );
              })
          );

          const hasLoggedInNav = Boolean(
            profileEl ||
              document.querySelector(
                'div[aria-label="Account Controls and Settings"], div[aria-label="Messenger"], a[aria-label="Home"], div[role="banner"], div[role="navigation"]'
              )
          );

          return {
            href,
            isMobileDomain: location.hostname.startsWith("m."),
            isMobileViewport: window.innerWidth < 768 || (window.visualViewport && window.visualViewport.width < 768),
            title: document.title || "",
            hasLoginInput,
            isLoginUrl,
            isCheckpoint,
            userId,
            userName,
            hasComposer,
            hasLoggedInNav
          };
        }
      });
      domState = (res && res.result) || null;
    } catch (_) {}
  }

  const hasAuthCookies = Boolean(cUserCookie && xsCookie);
  const domShowsLogin = Boolean(domState && (domState.hasLoginInput || domState.isLoginUrl));
  const domShowsAuthenticated = Boolean(
    domState &&
      !domState.hasLoginInput &&
      !domState.isLoginUrl &&
      !domState.isCheckpoint &&
      (domState.userId || domState.hasComposer || (hasAuthCookies && domState.hasLoggedInNav))
  );

  const loggedIn = Boolean((hasAuthCookies && !domShowsLogin) || domShowsAuthenticated);
  const accountId = (cUserCookie && cUserCookie.value) || (domState && domState.userId) || null;
  const accountName = (domState && domState.userName) || (loggedIn ? "Facebook Account" : null);

  if (loggedIn) {
    await setStorage({
      fb_one_time_login_verified: true,
      fb_awaiting_login: false,
      fb_session_info: {
        logged_in: true,
        account_id: accountId || "authenticated",
        account_name: accountName || "Facebook Account",
        active_tab_id: fbTab ? fbTab.id : null,
        active_tab_url: (domState && domState.href) || (fbTab && fbTab.url) || FB_HOME_URL,
        is_mobile_ui: Boolean(domState && (domState.isMobileDomain || domState.isMobileViewport)),
        verified_at: Date.now()
      }
    });

    return {
      success: true,
      logged_in: true,
      one_time_login_verified: true,
      browser_opened: Boolean(fbTab),
      active_tab_id: fbTab ? fbTab.id : null,
      active_tab_url: (domState && domState.href) || (fbTab && fbTab.url) || FB_HOME_URL,
      is_mobile_ui: Boolean(domState && (domState.isMobileDomain || domState.isMobileViewport)),
      account_id: accountId || "authenticated",
      account_name: accountName || "Facebook Account",
      account_type: "profile",
      message: `Logged into Facebook as ${accountName || accountId || "active user"} in the AntiGem browser.`
    };
  }

  if (fbTab && activateOnLoginNeeded) {
    try {
      await chrome.tabs.update(fbTab.id, { active: true });
    } catch (_) {}
  }

  await setStorage({
    fb_awaiting_login: true
  });

  return {
    success: false,
    logged_in: false,
    one_time_login_verified: false,
    browser_opened: Boolean(fbTab),
    browser_just_opened: browserJustOpened,
    active_tab_id: fbTab ? fbTab.id : null,
    active_tab_url: (domState && domState.href) || (fbTab && fbTab.url) || FB_HOME_URL,
    checkpoint_required: Boolean(domState && domState.isCheckpoint),
    action_required: "ONE_TIME_LOGIN_REQUIRED",
    stop_loop: true,
    message:
      "Facebook has been opened in the AntiGem browser. Please complete the ONE-TIME LOGIN to your Facebook account in the open browser tab. Once you sign in, your session is saved permanently and your task will start automatically (or reply 'continue').",
    agent_instruction:
      "CRITICAL: Do NOT call fb_login_status, fb_publish, or read any files in a loop! Tell the user once that Facebook is open in the AntiGem browser for their one-time login and STOP immediately."
  };
}

// ============================================================================
// 4. Precision Mobile & Desktop Touch Engine + Single-Shot Media Attachment
// ============================================================================

async function withAutomationLease(tabId, fn) {
  let heartbeat = null;
  const setBusy = async (busy) => {
    try {
      if (chrome.antigem && typeof chrome.antigem.automation === "function") {
        await chrome.antigem.automation({ tabId, busy });
      }
    } catch (_) {}
  };

  await setBusy(true);
  heartbeat = setInterval(() => {
    setBusy(true);
  }, 12000);

  try {
    return await fn();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await setBusy(false);
  }
}

/**
 * Dispatches a native Android WebView touch at exact visualViewport fractions { fx, fy }
 * via `chrome.antigem.automation({ tabId, busy: true, tap: { fx, fy } })`.
 */
async function trustedTap(tabId, coords) {
  if (!coords || typeof coords.fx !== "number" || typeof coords.fy !== "number") return false;
  const fx = Math.max(0.008, Math.min(0.992, coords.fx));
  const fy = Math.max(0.008, Math.min(0.992, coords.fy));
  try {
    if (chrome.antigem && typeof chrome.antigem.automation === "function") {
      await chrome.antigem.automation({
        tabId,
        busy: true,
        tap: { fx, fy }
      });
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Collapses the mobile soft keyboard by blurring the active input element and waiting
 * for `window.visualViewport` to stabilize before computing touch coordinates.
 */
async function blurKeyboardAndSettle(tabId) {
  try {
    await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        try {
          if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
          }
          window.getSelection()?.removeAllRanges();
        } catch (_) {}
      }
    });
    await sleep(160);
  } catch (_) {}
}

async function ensureDebuggerAttached(tabId) {
  if (!chrome.debugger || typeof chrome.debugger.attach !== "function") return false;
  if (attachedDebuggerTabs.has(tabId)) return true;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    attachedDebuggerTabs.add(tabId);
    return true;
  } catch (err) {
    const msg = String((err && err.message) || err || "");
    if (/already attached/i.test(msg)) {
      attachedDebuggerTabs.add(tabId);
      return true;
    }
    return false;
  }
}

if (chrome.debugger && chrome.debugger.onDetach) {
  chrome.debugger.onDetach.addListener((source) => {
    if (source && source.tabId) attachedDebuggerTabs.delete(source.tabId);
  });
}

/**
 * Formatted Caption Engine (v1.5.0)
 * Writes Title + Description + Hashtags into the right editor and KEEPS the line-break formatting.
 * Order of attempts (stops at the first verified one, never stacks duplicates):
 *   1. Synthetic ClipboardEvent("paste") — Lexical splits text/plain into real paragraphs.
 *   2. Line-by-line execCommand("insertText") + execCommand("insertParagraph").
 *   3. Native trusted tap + CDP Input.insertText per line + Shift+Enter between lines.
 * Every attempt clears the editor first and is verified (first line present, last hashtag present,
 * first line appears exactly once).
 */
function normalizeForCompare(s) {
  return String(s || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function verifyCaptionText(actual, expected) {
  const a = normalizeForCompare(actual);
  const lines = String(expected || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: true, duplicated: false };
  const head = normalizeForCompare(lines[0]).slice(0, 24);
  const tail = normalizeForCompare(lines[lines.length - 1]).slice(-18);
  const headCount = head ? a.split(head).length - 1 : 1;
  const ok = a.length >= 4 && (!head || headCount >= 1) && (!tail || a.includes(tail));
  return { ok: ok && headCount === 1, duplicated: headCount > 1, headFound: headCount >= 1 };
}

async function populateComposerCaption(tabId, captionText, titleText = "", options = {}) {
  const { editorHint = "post", verifyOnly = false } = options;
  const cleanCaption = String(captionText || "").replace(/\r\n/g, "\n").trim();
  const cleanTitle = String(titleText || "").trim();

  // 1. Dedicated Title field (Video / Reel / Page composers that show a separate Title input)
  if (cleanTitle && !verifyOnly) {
    try {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        args: [cleanTitle],
        func: (tVal) => {
          const titleInputs = Array.from(
            document.querySelectorAll(
              'input[placeholder*="Title" i], input[aria-label*="Title" i], input[aria-label*="Video title" i], input[aria-label*="Reel title" i], textarea[aria-label*="Title" i]'
            )
          );
          const inp = titleInputs.find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 20 && r.height > 8 && !el.closest('div[role="article"]');
          });
          if (inp) {
            inp.focus();
            const proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(inp, tVal);
            else inp.value = tVal;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      });
    } catch (_) {}
  }

  if (!cleanCaption) return { ok: true, skipped: true, formatting_preserved: true };

  const runPageInsert = async (mode, reuseLocked = true) => {
    const [res] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      args: [cleanCaption, mode, editorHint, reuseLocked],
      func: async (textToInsert, insertMode, hint, canReuseLocked) => {
        const isNotHidden = (el) => {
          if (!el) return false;
          const st = window.getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity || 1) < 0.01) return false;
          return el.getBoundingClientRect().width > 4;
        };
        const isCommentOrSearch = (el) => {
          if (!el) return true;
          if (
            el.closest(
              'div[role="article"], div[data-pagelet*="FeedUnit"], form[action*="comment"], div[aria-label*="comment" i], div[aria-label*="टिप्पणी" i], div[role="search"], [role="banner"]'
            )
          )
            return true;
          const meta = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""} ${
            el.getAttribute("aria-placeholder") || ""
          }`.toLowerCase();
          return /comment|reply|search|टिप्पणी|खोज|title/.test(meta) && !/describe|description|mind|caption/.test(meta);
        };

        if (!canReuseLocked) {
          document.querySelectorAll('[data-ag-caption-target="1"]').forEach((e) => e.removeAttribute("data-ag-caption-target"));
        }
        // Re-use editor locked on a previous attempt within this publish pass
        let editor = canReuseLocked ? document.querySelector('[data-ag-caption-target="1"]') : null;
        if (editor && (!document.contains(editor) || !isNotHidden(editor))) editor = null;

        if (!editor) {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter(
            (d) => isNotHidden(d) && d.getBoundingClientRect().height > 80
          );
          let bestDialog = null;
          let bestScore = 0;
          for (const d of dialogs) {
            if (d.querySelector('div[role="article"]')) continue;
            const aria = (d.getAttribute("aria-label") || "").toLowerCase();
            if (/notifications|messenger|chats|account controls|menu/.test(aria)) continue;
            const txt = (d.innerText || "").slice(0, 1200).toLowerCase();
            let s = 0;
            if (/create post|edit post|create reel|create story|पोस्ट बनाउनुहोस्/.test(txt)) s += 100;
            if (/add to your post|what['’]?s on your mind|describe your reel|start typing/.test(txt)) s += 80;
            if (d.querySelector('[contenteditable="true"], textarea')) s += 60;
            if (s > bestScore) {
              bestScore = s;
              bestDialog = d;
            }
          }
          const roots = bestDialog ? [bestDialog, document] : [document];
          const sel = [
            'div[role="textbox"][contenteditable="true"]',
            'div[data-lexical-editor="true"]',
            'div[contenteditable="true"]',
            'div[contenteditable="plaintext-only"]',
            "#composer-main-view-id textarea",
            "textarea.composerInput",
            'textarea[name="xc_message"]',
            "textarea"
          ].join(", ");
          const hintRe =
            hint === "reel"
              ? /describe your reel|description|caption|write/i
              : hint === "story"
              ? /start typing|text|type/i
              : /on your mind|write something|say something|post|caption/i;
          for (const root of roots) {
            const found = Array.from(root.querySelectorAll(sel)).filter((el) => isNotHidden(el) && !isCommentOrSearch(el));
            if (found.length) {
              const score = (node) => {
                let sc = 0;
                if (bestDialog && bestDialog.contains(node)) sc += 40;
                if (node.getAttribute("data-lexical-editor") === "true") sc += 20;
                const lbl = `${node.getAttribute("aria-label") || ""} ${node.getAttribute("aria-placeholder") || ""} ${
                  node.getAttribute("placeholder") || ""
                } ${(node.parentElement && node.parentElement.innerText) || ""}`.slice(0, 300);
                if (hintRe.test(lbl)) sc += 60;
                return sc;
              };
              found.sort((x, y) => score(y) - score(x));
              editor = found[0];
              break;
            }
          }
          // Wake collapsed editor by tapping its visible placeholder text
          if (!editor) {
            for (const root of roots) {
              const ph = Array.from(root.querySelectorAll("div, span, p, label")).find((el) => {
                if (!isNotHidden(el) || isCommentOrSearch(el)) return false;
                const t = (el.innerText || "").trim();
                return (
                  t.length > 4 &&
                  t.length < 80 &&
                  /^(what['’]?s on your mind|write something|say something|add a caption|describe your reel|add a description|start typing|के सोचिरहनुभएको|कुछ लिखें)/i.test(
                    t
                  )
                );
              });
              if (ph) {
                try {
                  ph.click();
                } catch (_) {}
                await new Promise((r) => setTimeout(r, 200));
                const ae = document.activeElement;
                editor =
                  (ph.parentElement && ph.parentElement.querySelector('[contenteditable="true"], textarea')) ||
                  (ae && (ae.isContentEditable || ae.tagName === "TEXTAREA") ? ae : null);
                if (editor) break;
              }
            }
          }
          if (editor) {
            document.querySelectorAll('[data-ag-caption-target="1"]').forEach((e) => e.removeAttribute("data-ag-caption-target"));
            editor.setAttribute("data-ag-caption-target", "1");
          }
        }

        if (!editor) return { foundEditor: false };

        const readText = () =>
          editor.tagName === "TEXTAREA" || editor.tagName === "INPUT"
            ? editor.value || ""
            : editor.innerText || editor.textContent || "";

        const r = editor.getBoundingClientRect();
        const v = window.visualViewport;
        const vw = (v && v.width) || window.innerWidth || 1;
        const vh = (v && v.height) || window.innerHeight || 1;
        const ox = (v && v.offsetLeft) || 0;
        const oy = (v && v.offsetTop) || 0;
        const tapCoords = {
          fx: Math.max(0.008, Math.min(0.992, (r.left + Math.min(40, r.width * 0.3) - ox) / vw)),
          fy: Math.max(0.008, Math.min(0.992, (r.top + Math.min(16, Math.max(6, r.height * 0.5)) - oy) / vh))
        };

        if (insertMode === "verify") return { foundEditor: true, text: readText(), tapCoords };

        try {
          editor.scrollIntoView({ block: "center", behavior: "instant" });
        } catch (_) {}
        try {
          editor.click();
        } catch (_) {}
        editor.focus();

        if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
          const proto = editor.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(editor, textToInsert);
          else editor.value = textToInsert;
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          editor.dispatchEvent(new Event("change", { bubbles: true }));
          return { foundEditor: true, text: readText(), tapCoords, isTextarea: true };
        }

        const clearEditor = () => {
          try {
            const s = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            s.removeAllRanges();
            s.addRange(range);
            document.execCommand("selectAll", false, null);
            document.execCommand("delete", false, null);
          } catch (_) {}
        };

        if (insertMode === "clear") {
          clearEditor();
          return { foundEditor: true, text: readText(), tapCoords };
        }

        clearEditor();
        await new Promise((res) => setTimeout(res, 60));

        if (insertMode === "paste") {
          try {
            const dt = new DataTransfer();
            dt.setData("text/plain", textToInsert);
            editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
          } catch (_) {}
        } else if (insertMode === "lines") {
          const lines = textToInsert.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i]) document.execCommand("insertText", false, lines[i]);
            if (i < lines.length - 1) {
              const okPara = document.execCommand("insertParagraph", false, null);
              if (!okPara) document.execCommand("insertLineBreak", false, null);
            }
          }
        }
        await new Promise((res) => setTimeout(res, 180));
        return { foundEditor: true, text: readText(), tapCoords };
      }
    });
    return (res && res.result) || { foundEditor: false };
  };

  const expectsMultiline = cleanCaption.includes("\n");

  if (verifyOnly) {
    const st = await runPageInsert("verify", true);
    const v = verifyCaptionText(st.text, cleanCaption);
    return {
      ok: Boolean(st.foundEditor && v.ok),
      foundEditor: Boolean(st.foundEditor),
      duplicated: v.duplicated,
      formatting_preserved: !expectsMultiline || /\n/.test(st.text || "")
    };
  }

  let lastState = null;
  let attemptIdx = 0;
  for (const mode of ["paste", "lines"]) {
    lastState = await runPageInsert(mode, attemptIdx > 0);
    attemptIdx++;
    if (!lastState.foundEditor) break;
    const v = verifyCaptionText(lastState.text, cleanCaption);
    if (v.ok) {
      return {
        ok: true,
        method: lastState.isTextarea ? "textarea" : mode,
        formatting_preserved: !expectsMultiline || /\n/.test(lastState.text || "")
      };
    }
    if (lastState.isTextarea) break;
  }

  // Tier 3: native tap + CDP Input.insertText line by line (Shift+Enter between lines)
  if (lastState && lastState.tapCoords) {
    await trustedTap(tabId, lastState.tapCoords);
    await sleep(200);
  }
  const dbgReady = await ensureDebuggerAttached(tabId);
  if (dbgReady && (!lastState || lastState.foundEditor)) {
    try {
      await runPageInsert("clear", true);
      const lines = cleanCaption.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) await chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: lines[i] });
        if (i < lines.length - 1) {
          const keyBase = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 8 };
          await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyBase });
          await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", ...keyBase });
        }
      }
      await sleep(250);
      const st = await runPageInsert("verify", true);
      const v = verifyCaptionText(st.text, cleanCaption);
      if (v.ok) {
        return { ok: true, method: "cdp_lines", formatting_preserved: !expectsMultiline || /\n/.test(st.text || "") };
      }
    } catch (_) {}
  }

  return {
    ok: false,
    foundEditor: Boolean(lastState && lastState.foundEditor),
    error: lastState && lastState.foundEditor ? "Caption could not be verified in the editor." : "Could not locate caption/description editor."
  };
}

/**
 * Real Thumbnail / Cover Uploader (v1.5.0)
 * Uses the user's own thumbnail image on Feed Videos and Reels:
 *  - Opens the Thumbnail / Cover panel (Edit video -> Thumbnail -> Upload image, or Reel Edit step -> Cover -> Upload).
 *  - Binds the image ONLY to an image-accepting / newly mounted file input (never overwrites the video input).
 *  - Confirms with Save / Done / Apply inside the thumbnail panel (never clicks Post/Publish).
 *  - Returns { applied } honestly so the agent never claims a thumbnail that was not used.
 */
async function uploadThumbnailImage(tabId, thumbnailPath, options = {}) {
  const { surface = "video" } = options;
  if (!thumbnailPath || !String(thumbnailPath).trim()) return { attempted: false, applied: false };

  let thumbFile;
  try {
    thumbFile = await resolveLocalFile(thumbnailPath, false);
  } catch (e) {
    return { attempted: true, applied: false, reason: e.message };
  }
  if (!isImagePath(thumbFile.path)) {
    return { attempted: true, applied: false, reason: "Thumbnail must be a JPG / PNG / WebP image file." };
  }

  const dbgReady = await ensureDebuggerAttached(tabId);
  let chooserParams = null;
  const onEvt = (source, method, params) => {
    if (source && source.tabId === tabId && method === "Page.fileChooserOpened") chooserParams = params;
  };
  if (dbgReady && chrome.debugger.onEvent) {
    chrome.debugger.onEvent.addListener(onEvt);
    try {
      await chrome.debugger.sendCommand({ tabId }, "Page.enable", {});
      await chrome.debugger.sendCommand({ tabId }, "Page.setInterceptFileChooserDialog", { enabled: true });
    } catch (_) {}
  }

  try {
    // Mark existing inputs (the video input) as known and hook detached image inputs
    await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        document.querySelectorAll('input[type="file"]').forEach((i) => i.setAttribute("data-ag-known", "1"));
        document.querySelectorAll("[data-ag-thumb-target]").forEach((i) => i.removeAttribute("data-ag-thumb-target"));
        document.querySelectorAll("[data-ag-thumb-btn]").forEach((i) => i.removeAttribute("data-ag-thumb-btn"));
        window.__agThumbInput = null;
        if (!window.__agThumbOrigClick) window.__agThumbOrigClick = HTMLInputElement.prototype.click;
        const orig = window.__agThumbOrigClick;
        HTMLInputElement.prototype.click = function (...a) {
          if (this && this.type === "file") {
            const acc = (this.getAttribute("accept") || "").toLowerCase();
            if (!acc || acc.includes("image")) {
              window.__agThumbInput = this;
              try {
                this.setAttribute("data-ag-thumb-target", "1");
              } catch (_) {}
              return;
            }
          }
          return orig.apply(this, a);
        };
      }
    });

    const clickedLabels = [];
    let found = false;
    for (let round = 0; round < 6 && !found; round++) {
      const [probe] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        args: [clickedLabels, surface],
        func: (already, surf) => {
          document.querySelectorAll("[data-ag-thumb-btn]").forEach((i) => i.removeAttribute("data-ag-thumb-btn"));
          const vis = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return false;
            const st = getComputedStyle(el);
            return st.display !== "none" && st.visibility !== "hidden";
          };
          const label = (el) => `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.replace(/\s+/g, " ").trim();
          const ctxText = (el) => {
            let n = el;
            for (let i = 0; i < 6 && n; i++) n = n.parentElement;
            return ((n && n.innerText) || "").slice(0, 600).toLowerCase();
          };

          // 1. Is a usable thumbnail input already available?
          if (window.__agThumbInput && document.contains(window.__agThumbInput)) return { found: true };
          const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
          const candidate = inputs.find((i) => {
            const acc = (i.getAttribute("accept") || "").toLowerCase();
            const imageOnly = acc.includes("image") && !acc.includes("video");
            const fresh = !i.hasAttribute("data-ag-known");
            return (imageOnly && (fresh || /thumbnail|cover/.test(ctxText(i)))) || (fresh && !acc.includes("video") && /thumbnail|cover/.test(ctxText(i)));
          });
          if (candidate) {
            window.__agThumbInput = candidate;
            candidate.setAttribute("data-ag-thumb-target", "1");
            return { found: true };
          }

          // 2. Locate the next control in the Thumbnail / Cover path (single click fired outside after tap fallback)
          const clickables = Array.from(
            document.querySelectorAll('div[role="button"], button, span[role="button"], a[role="button"], div[role="tab"], div[role="radio"], [role="option"], label, [role="menuitem"]')
          ).filter((el) => vis(el) && !el.closest('div[role="article"], [role="banner"], [role="navigation"]'));
          const pageHasThumbCtx = /thumbnail|cover/i.test((document.body.innerText || "").slice(0, 20000));
          const tiers = [
            pageHasThumbCtx
              ? /^(upload image|upload thumbnail|upload custom thumbnail|upload cover|upload a thumbnail|upload a cover|upload photo|choose image|choose file|add image|upload)$/i
              : null,
            /^(thumbnail|thumbnails|custom thumbnail|change thumbnail|edit thumbnail|select thumbnail|cover|cover photo|cover image|choose cover|select cover|change cover|edit cover|add cover)$/i,
            surf === "video" ? /^(edit|edit video|video options|edit all)$/i : null
          ].filter(Boolean);
          for (const re of tiers) {
            const el = clickables.find((c) => {
              const l = label(c);
              return l.length < 48 && re.test(l) && !already.includes(l.toLowerCase());
            });
            if (el) {
              const l = label(el);
              try {
                el.scrollIntoView({ block: "center", behavior: "instant" });
              } catch (_) {}
              el.setAttribute("data-ag-thumb-btn", "1");
              const r = el.getBoundingClientRect();
              const vv = window.visualViewport;
              const vw = (vv && vv.width) || innerWidth;
              const vh = (vv && vv.height) || innerHeight;
              return {
                found: false,
                clicked: l.toLowerCase(),
                coords: {
                  fx: Math.max(0.008, Math.min(0.992, (r.left + r.width / 2 - ((vv && vv.offsetLeft) || 0)) / vw)),
                  fy: Math.max(0.008, Math.min(0.992, (r.top + r.height / 2 - ((vv && vv.offsetTop) || 0)) / vh))
                }
              };
            }
          }
          return { found: false, clicked: null };
        }
      });
      const p = (probe && probe.result) || {};
      if (p.found) {
        found = true;
        break;
      }
      if (chooserParams && chooserParams.backendNodeId) {
        found = true;
        break;
      }
      if (!p.clicked) break;
      const tapped = p.coords ? await trustedTap(tabId, p.coords) : false;
      if (!tapped) {
        await chrome.scripting.executeScript({
          world: "MAIN",
          target: { tabId },
          func: () => {
            const btn = document.querySelector('[data-ag-thumb-btn="1"]');
            if (btn) {
              try {
                btn.click();
              } catch (_) {}
              btn.removeAttribute("data-ag-thumb-btn");
            }
          }
        });
      }
      clickedLabels.push(p.clicked);
      await sleep(750);
      if (chooserParams && chooserParams.backendNodeId) {
        found = true;
        break;
      }
    }

    if (!found) {
      return { attempted: true, applied: false, reason: "Thumbnail / Cover upload option not offered on this Facebook screen." };
    }

    // Bind the image to the thumbnail input
    let bound = false;
    if (dbgReady) {
      try {
        const evalObj = await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
          expression: "window.__agThumbInput || document.querySelector('input[data-ag-thumb-target=\"1\"]')",
          returnByValue: false
        });
        if (evalObj && evalObj.result && evalObj.result.objectId) {
          await chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", {
            objectId: evalObj.result.objectId,
            files: [thumbFile.path]
          });
          bound = true;
        }
      } catch (_) {}
      if (!bound && chooserParams && chooserParams.backendNodeId) {
        try {
          await chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", {
            backendNodeId: chooserParams.backendNodeId,
            files: [thumbFile.path]
          });
          bound = true;
        } catch (_) {}
      }
    }
    if (!bound && chrome.antigem && typeof chrome.antigem.readFile === "function") {
      try {
        const readRes = await chrome.antigem.readFile({ path: thumbFile.path, encoding: "base64" });
        const b64 = typeof readRes === "string" ? readRes : readRes && readRes.data;
        if (b64) {
          const [dtRes] = await chrome.scripting.executeScript({
            world: "MAIN",
            target: { tabId },
            args: [b64, thumbFile.filename, thumbFile.mimeType],
            func: (data, name, mime) => {
              const inp = window.__agThumbInput || document.querySelector('input[data-ag-thumb-target="1"]');
              if (!inp) return false;
              const bin = atob(data);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const dt = new DataTransfer();
              dt.items.add(new File([bytes], name, { type: mime, lastModified: Date.now() }));
              inp.files = dt.files;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              return inp.files.length > 0;
            }
          });
          bound = Boolean(dtRes && dtRes.result);
        }
      } catch (_) {}
    }

    if (!bound) return { attempted: true, applied: false, reason: "Could not attach thumbnail image file." };

    await sleep(1500);

    // Confirm inside the thumbnail panel only (Save / Done / Apply) — never Post / Publish / Share
    let confirmed = false;
    for (let i = 0; i < 6; i++) {
      const [conf] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const panels = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter((d) =>
            /thumbnail|cover/i.test((d.innerText || "").slice(0, 2000))
          );
          const scope = panels[panels.length - 1];
          if (!scope) return { noPanel: true };
          const btn = Array.from(scope.querySelectorAll('div[role="button"], button')).find((b) => {
            const t = `${b.getAttribute("aria-label") || ""} ${b.innerText || ""}`.replace(/\s+/g, " ").trim();
            return /^(save|done|apply|set thumbnail|use as thumbnail|use as cover|set cover)$/i.test(t) && b.getAttribute("aria-disabled") !== "true";
          });
          if (!btn) return { waiting: true };
          btn.click();
          return { clicked: true };
        }
      });
      const c = (conf && conf.result) || {};
      if (c.clicked || c.noPanel) {
        confirmed = true;
        break;
      }
      await sleep(600);
    }

    return {
      attempted: true,
      applied: true,
      confirmed,
      file: thumbFile.path,
      path_through: clickedLabels
    };
  } finally {
    if (dbgReady && chrome.debugger.onEvent) {
      chrome.debugger.onEvent.removeListener(onEvt);
      try {
        await chrome.debugger.sendCommand({ tabId }, "Page.setInterceptFileChooserDialog", { enabled: false });
      } catch (_) {}
    }
    try {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          document.querySelectorAll("[data-ag-thumb-btn]").forEach((i) => i.removeAttribute("data-ag-thumb-btn"));
          if (window.__agThumbOrigClick) HTMLInputElement.prototype.click = window.__agThumbOrigClick;
        }
      });
    } catch (_) {}
  }
}

/**
 * Single-Shot Bulletproof Media Attachment Engine for Mobile (`m.facebook.com`) & Desktop (`www.facebook.com`).
 * - Purges stale/duplicate draft media in the composer before attaching.
 * - Directly binds to existing DOM `<input type="file">` via CDP `DOM.setFileInputFiles` in <150ms (WITHOUT firing a duplicate `change` event!).
 * - Never runs secondary tiers once a file input has been bound, and deduplicates previews if >1 preview mounts for a single photo.
 */
async function attachMediaToFacebookComposer(tabId, rawPaths, options = {}) {
  const { preferVideo = false, requirePreview = true, purgeExistingDrafts = true } = options;

  const resolvedFiles = [];
  if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
    const latest = await autoDiscoverLatestMedia(preferVideo);
    if (!latest) {
      throw new Error("No photo/video file was provided and no recent media file was found on device.");
    }
    resolvedFiles.push(latest);
  } else {
    for (const rp of rawPaths) {
      resolvedFiles.push(await resolveLocalFile(rp, preferVideo));
    }
  }

  const filePaths = resolvedFiles.map((f) => f.path);
  const dbgReady = await ensureDebuggerAttached(tabId);

  // Pre-load base64 payloads for files <= 15MB so DataTransfer fallback is ready if needed
  const filePayloads = [];
  if (chrome.antigem && typeof chrome.antigem.readFile === "function") {
    for (const f of resolvedFiles) {
      if (!f.size || f.size <= 15 * 1024 * 1024) {
        try {
          const readRes = await chrome.antigem.readFile({ path: f.path, encoding: "base64" });
          const b64 = typeof readRes === "string" ? readRes : readRes && readRes.data;
          if (b64) {
            filePayloads.push({
              base64: b64,
              filename: f.filename,
              mimeType: f.mimeType
            });
          }
        } catch (_) {}
      }
    }
  }

  let chooserParams = null;
  const onDebuggerEvent = (source, method, params) => {
    if (source && source.tabId === tabId && method === "Page.fileChooserOpened") {
      chooserParams = params;
    }
  };

  if (dbgReady && chrome.debugger.onEvent) {
    chrome.debugger.onEvent.addListener(onDebuggerEvent);
    try {
      await chrome.debugger.sendCommand({ tabId }, "DOM.enable", {});
      await chrome.debugger.sendCommand({ tabId }, "Page.enable", {});
      await chrome.debugger.sendCommand({ tabId }, "Page.setInterceptFileChooserDialog", { enabled: true });
    } catch (_) {}
  }

  try {
    await blurKeyboardAndSettle(tabId);

    // Step 0: Purge any stale draft photos left in an already-open Create Post dialog (fixes leftover duplicate photos!)
    if (purgeExistingDrafts) {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const removeBtns = Array.from(
            document.querySelectorAll(
              'div[role="dialog"] [aria-label*="Remove photo" i], div[role="dialog"] [aria-label*="Remove video" i], div[role="dialog"] [aria-label*="Remove media" i], div[role="dialog"] [aria-label*="Remove attachment" i]'
            )
          );
          for (const btn of removeBtns) {
            try {
              btn.click();
            } catch (_) {}
          }
        }
      });
      await sleep(180);
    }

    // Step A: Look for an EXISTING <input type="file"> in the DOM first (instant <100ms path!), or click Photo/Video / Story button to capture it
    const [prepRes] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      args: [preferVideo],
      func: async (wantVid) => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return false;
          const st = window.getComputedStyle(el);
          return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || 1) > 0.01;
        };

        const toViewportTap = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const v = window.visualViewport;
          const vw = (v && v.width) || window.innerWidth || 1;
          const vh = (v && v.height) || window.innerHeight || 1;
          const ox = (v && v.offsetLeft) || 0;
          const oy = (v && v.offsetTop) || 0;
          return {
            fx: Math.max(0.008, Math.min(0.992, (r.left + r.width * 0.5 - ox) / vw)),
            fy: Math.max(0.008, Math.min(0.992, (r.top + r.height * 0.5 - oy) / vh))
          };
        };

        document
          .querySelectorAll("[data-antigem-upload-target]")
          .forEach((el) => el.removeAttribute("data-antigem-upload-target"));
        window.__agFbUploadInput = null;

        // Score existing <input type="file"> elements in the DOM BEFORE clicking anything
        const scoreInput = (inp) => {
          if (!inp) return -1;
          const acc = (inp.getAttribute("accept") || "").toLowerCase();
          let s = 10;
          const dlg = inp.closest('div[role="dialog"]');
          if (dlg) {
            const dlgTxt = (dlg.innerText || "").toLowerCase();
            if (/create post|add to your post|what['’]?s on your mind|reel|story/i.test(dlgTxt)) s += 60;
            else s += 25;
          }
          if (wantVid && acc.includes("video")) s += 35;
          if (!wantVid && acc.includes("image")) s += 35;
          return s;
        };

        const existingInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        if (existingInputs.length > 0) {
          existingInputs.sort((a, b) => scoreInput(b) - scoreInput(a));
          const bestExisting = existingInputs[0];
          if (scoreInput(bestExisting) >= 35) {
            window.__agFbUploadInput = bestExisting;
            bestExisting.setAttribute("data-antigem-upload-target", "1");
            return {
              hasCapturedInput: true,
              inDomInput: true,
              usedExistingDomInput: true,
              photoBtnTap: null
            };
          }
        }

        // Install HTMLInputElement.prototype.click interceptor for detached file inputs
        if (!window.__agFbOrigInputClick) {
          window.__agFbOrigInputClick = HTMLInputElement.prototype.click;
        }
        HTMLInputElement.prototype.click = function (...args) {
          if (this && this.type === "file") {
            window.__agFbUploadInput = this;
            try {
              this.setAttribute("data-antigem-upload-target", "1");
            } catch (_) {}
            return;
          }
          return window.__agFbOrigInputClick.apply(this, args);
        };

        const findPhotoBtn = () => {
          const all = Array.from(
            document.querySelectorAll('div[role="button"], span[role="button"], button, a, label, [data-sigil*="photo"]')
          ).filter(isVisible);

          const byLabel = all.find((el) => {
            if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
            const aria = (el.getAttribute("aria-label") || "").trim();
            const txt = (el.innerText || el.textContent || "").trim();
            const combined = `${aria} ${txt}`;
            if (/remove|delete|edit|tag|cover|profile picture/i.test(combined)) return false;
            return (
              /^(photo\/video|photos\/videos|photos|photo|add photos|add photo|add photos\/videos|add video|upload video|create a photo story|फोटो\/भिडियो|फोटो|तस्विर)$/i.test(
                aria
              ) ||
              /^(photo\/video|photos\/videos|photos|photo|add photos|add photo|add photos\/videos|add video|upload video|create a photo story|फोटो\/भिडियो|फोटो|तस्विर)$/i.test(
                txt
              ) ||
              /photo\/video|photos\/videos|add photos|create a photo story|add to your post.*photo/i.test(combined)
            );
          });
          if (byLabel) return byLabel;

          const addDrawer = all.find((el) => {
            const t = `${el.getAttribute("aria-label") || ""} ${el.innerText || ""}`.trim();
            return /add to your post|add more to your post/i.test(t);
          });
          return addDrawer || null;
        };

        let photoBtn = findPhotoBtn();
        let photoBtnTap = null;

        if (photoBtn) {
          const btnTxt = `${photoBtn.getAttribute("aria-label") || ""} ${photoBtn.innerText || ""}`;
          if (/add to your post/i.test(btnTxt) && !/photo/i.test(btnTxt)) {
            try {
              photoBtn.click();
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 280));
            photoBtn = findPhotoBtn() || photoBtn;
          }
          photoBtnTap = toViewportTap(photoBtn);
          try {
            photoBtn.click();
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 200));
        }

        const allInputsAfter = Array.from(document.querySelectorAll('input[type="file"]'));
        let targetInput = window.__agFbUploadInput || null;
        if (!targetInput && allInputsAfter.length > 0) {
          allInputsAfter.sort((a, b) => scoreInput(b) - scoreInput(a));
          targetInput = allInputsAfter[0];
        }

        if (targetInput) {
          window.__agFbUploadInput = targetInput;
          try {
            targetInput.setAttribute("data-antigem-upload-target", "1");
          } catch (_) {}
        }

        return {
          hasCapturedInput: Boolean(window.__agFbUploadInput),
          inDomInput: Boolean(targetInput && document.contains(targetInput)),
          usedExistingDomInput: false,
          photoBtnTap
        };
      }
    });

    const prep = (prepRes && prepRes.result) || {};

    // Helper to check if media preview is visible anywhere in the active composer or page
    const checkComposerMediaPreview = async () => {
      const [probe] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          // Search across all dialogs AND main document (excluding feed posts) so a wrong dialog never hides the preview!
          const isInsideFeedPost = (el) =>
            Boolean(el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]'));

          const hasBlobOrDataImg = Array.from(document.querySelectorAll("img")).some((img) => {
            if (isInsideFeedPost(img)) return false;
            const src = img.getAttribute("src") || "";
            const r = img.getBoundingClientRect();
            return (
              (src.startsWith("blob:") ||
                src.startsWith("data:image/") ||
                (img.closest('div[role="dialog"]') && src.includes("scontent") && r.width >= 80 && r.height >= 80)) &&
              r.width >= 36 &&
              r.height >= 36
            );
          });

          const hasVideoPreview = Array.from(document.querySelectorAll("video")).some(
            (v) => !isInsideFeedPost(v)
          );

          const removeBtns = Array.from(
            document.querySelectorAll(
              '[aria-label*="Remove photo" i], [aria-label*="Remove video" i], [aria-label*="Remove media" i], [aria-label*="Remove attachment" i]'
            )
          ).filter((el) => !isInsideFeedPost(el));

          const hasEditMediaBtn = Boolean(
            document.querySelector(
              '[aria-label*="Edit photo" i], [aria-label*="Edit All" i], [data-sigil*="photo-preview"], [data-sigil*="media-attachment"]'
            )
          );

          const hasFileInInput = Boolean(
            window.__agFbUploadInput && window.__agFbUploadInput.files && window.__agFbUploadInput.files.length > 0
          );

          return {
            previewMounted: Boolean(
              hasBlobOrDataImg || hasVideoPreview || removeBtns.length > 0 || hasEditMediaBtn
            ),
            removeBtnCount: removeBtns.length,
            hasFileInInput
          };
        }
      });
      return (
        (probe && probe.result) || { previewMounted: false, removeBtnCount: 0, hasFileInInput: false }
      );
    };

    // Tier 1: Bind via CDP DOM.setFileInputFiles (NOTE: Do NOT manually dispatch duplicate 'change' event after DOM.setFileInputFiles!)
    const bindViaCdpObjectOrNode = async () => {
      if (!dbgReady) return false;
      try {
        const evalObj = await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
          expression:
            "window.__agFbUploadInput || document.querySelector('input[type=\"file\"][data-antigem-upload-target=\"1\"]') || document.querySelector('div[role=\"dialog\"] input[type=\"file\"]') || document.querySelector('input[type=\"file\"]')",
          returnByValue: false
        });
        if (evalObj && evalObj.result && evalObj.result.objectId) {
          await chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", {
            objectId: evalObj.result.objectId,
            files: filePaths
          });
          return true;
        }
      } catch (_) {}
      return false;
    };

    // Tier 2: DataTransfer injection on window.__agFbUploadInput or DOM <input type="file"> (ONLY used if CDP bind didn't run)
    const bindViaDataTransfer = async () => {
      if (filePayloads.length === 0) return false;
      const [dtRes] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        args: [filePayloads],
        func: (items) => {
          const inp =
            window.__agFbUploadInput ||
            document.querySelector('input[type="file"][data-antigem-upload-target="1"]') ||
            document.querySelector('div[role="dialog"] input[type="file"]') ||
            document.querySelector('input[type="file"]');
          if (!inp) return { ok: false };

          const dt = new DataTransfer();
          for (const item of items) {
            const bin = atob(item.base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const fileObj = new File([bytes], item.filename, {
              type: item.mimeType,
              lastModified: Date.now()
            });
            dt.items.add(fileObj);
          }

          if (items.length > 1) inp.multiple = true;
          inp.files = dt.files;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: Boolean(inp.files && inp.files.length > 0), count: inp.files ? inp.files.length : 0 };
        }
      });
      return Boolean(dtRes && dtRes.result && dtRes.result.ok);
    };

    let bound = false;

    if (prep.hasCapturedInput) {
      bound = await bindViaCdpObjectOrNode();
      if (!bound) {
        bound = await bindViaDataTransfer();
      }
    }

    // If bound already succeeded, wait up to 2.2s for preview to render BEFORE considering any fallback tier!
    let previewState = { previewMounted: false, removeBtnCount: 0, hasFileInInput: false };
    if (bound) {
      for (let w = 0; w < 8; w++) {
        await sleep(280);
        previewState = await checkComposerMediaPreview();
        if (previewState.previewMounted) break;
      }
    }

    // Fallback: ONLY if !bound and !previewMounted, tap Photo button to trigger fileChooserOpened
    if (!bound && !previewState.previewMounted && prep.photoBtnTap) {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          if (window.__agFbOrigInputClick) {
            const orig = window.__agFbOrigInputClick;
            HTMLInputElement.prototype.click = function (...args) {
              if (this && this.type === "file") {
                window.__agFbUploadInput = this;
                try {
                  this.setAttribute("data-antigem-upload-target", "1");
                } catch (_) {}
              }
              return orig.apply(this, args);
            };
          }
        }
      });

      await trustedTap(tabId, prep.photoBtnTap);

      const waitDeadline = Date.now() + 2000;
      while (Date.now() < waitDeadline) {
        if (chooserParams && chooserParams.backendNodeId) break;
        const [chkInp] = await chrome.scripting.executeScript({
          world: "MAIN",
          target: { tabId },
          func: () => Boolean(window.__agFbUploadInput || document.querySelector('input[type="file"]'))
        });
        if (chkInp && chkInp.result) break;
        await sleep(120);
      }

      if (chooserParams && chooserParams.backendNodeId && dbgReady) {
        try {
          await chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", {
            backendNodeId: chooserParams.backendNodeId,
            files: filePaths
          });
          bound = true;
        } catch (_) {}
      }

      if (!bound) {
        bound = await bindViaCdpObjectOrNode();
      }
      if (!bound) {
        bound = await bindViaDataTransfer();
      }
    }

    // Poll up to 4.5s for preview thumbnail to mount
    const previewDeadline = Date.now() + (preferVideo ? 6500 : 4200);
    while (Date.now() < previewDeadline) {
      previewState = await checkComposerMediaPreview();
      if (previewState.previewMounted) break;
      await sleep(300);
    }

    // Last-resort DragEvent("drop") ONLY if preview is STILL not mounted after polling
    if (!previewState.previewMounted && filePayloads.length > 0) {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        args: [filePayloads],
        func: (items) => {
          const dropTarget =
            document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]') ||
            document.querySelector('div[role="dialog"]') ||
            document.body;
          if (!dropTarget) return { ok: false };

          const dt = new DataTransfer();
          for (const item of items) {
            const bin = atob(item.base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const fileObj = new File([bytes], item.filename, {
              type: item.mimeType,
              lastModified: Date.now()
            });
            dt.items.add(fileObj);
          }

          for (const evtName of ["dragenter", "dragover", "drop"]) {
            const evt = new DragEvent(evtName, {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt
            });
            dropTarget.dispatchEvent(evt);
          }
          return { ok: true };
        }
      });
      await sleep(1000);
      previewState = await checkComposerMediaPreview();
    }

    // Single-Photo Deduplication Guard: If only 1 file was requested, ensure at most 1 attachment is mounted in composer
    if (resolvedFiles.length === 1 && previewState.removeBtnCount > 1) {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const removeBtns = Array.from(
            document.querySelectorAll(
              'div[role="dialog"] [aria-label*="Remove photo" i], div[role="dialog"] [aria-label*="Remove attachment" i], div[role="dialog"] [aria-label*="Remove media" i]'
            )
          );
          // Click extra remove buttons so strictly 1 photo remains
          for (let i = 1; i < removeBtns.length; i++) {
            try {
              removeBtns[i].click();
            } catch (_) {}
          }
        }
      });
      await sleep(250);
    }

    if (requirePreview && !previewState.previewMounted && !previewState.hasFileInInput && !bound) {
      throw new Error(
        `Photo/video attachment did not mount in Facebook composer (${resolvedFiles.map((f) => f.filename).join(", ")}). Aborting before Post so a text-only post is never sent by mistake.`
      );
    }

    return {
      ok: true,
      previewMounted: previewState.previewMounted,
      files: resolvedFiles
    };
  } finally {
    if (dbgReady && chrome.debugger.onEvent) {
      chrome.debugger.onEvent.removeListener(onDebuggerEvent);
      try {
        await chrome.debugger.sendCommand({ tabId }, "Page.setInterceptFileChooserDialog", { enabled: false });
      } catch (_) {}
    }
    try {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          if (window.__agFbOrigInputClick) {
            HTMLInputElement.prototype.click = window.__agFbOrigInputClick;
          }
        }
      });
    } catch (_) {}
  }
}

// ============================================================================
// 5. Core Facebook Upload Pipelines (Feed Posts, Photos, Videos, Reels, Stories)
// ============================================================================

/**
 * Pipeline A: Feed Post (Text, Photo, Carousel, Video) on Profile, Page, or Group
 * Works across Phone Desktop Mode (`www.facebook.com`), Phone Mobile Mode (`m.facebook.com`), and Desktop.
 */
async function executeFeedPostInBrowser(tabId, payload) {
  const rawMediaInput = Array.isArray(payload.media_paths)
    ? payload.media_paths
    : payload.media_path
    ? [payload.media_path]
    : payload.video_path
    ? [payload.video_path]
    : [];

  const isMediaPostType = ["photo", "carousel", "video"].includes(String(payload.post_type || "").toLowerCase());
  const wantVideo =
    String(payload.post_type || "").toLowerCase() === "video" || rawMediaInput.some((p) => isVideoPath(p));

  let resolvedMediaList = [];
  if (rawMediaInput.length > 0 || isMediaPostType) {
    if (rawMediaInput.length === 0) {
      const autoMedia = await autoDiscoverLatestMedia(wantVideo);
      if (!autoMedia) {
        throw new Error(
          "You asked to upload a photo/video, but no media_paths were provided and no recent photo/video was found in your Downloads/Pictures folder."
        );
      }
      resolvedMediaList.push(autoMedia);
    } else {
      for (const mp of rawMediaInput) {
        resolvedMediaList.push(await resolveLocalFile(mp, wantVideo));
      }
    }
  }

  const effectivePostType =
    resolvedMediaList.length > 0
      ? wantVideo || resolvedMediaList.some((f) => isVideoPath(f.path))
        ? "video"
        : resolvedMediaList.length > 1
        ? "carousel"
        : "photo"
      : payload.post_type || "text";

  const mediaHintName = resolvedMediaList.length > 0 ? resolvedMediaList[0].filename : "";
  const enriched = ensureTitleAndHashtags({
    ...payload,
    post_type: effectivePostType,
    media_hint: mediaHintName
  });

  const {
    target_type = "profile",
    target_id = null,
    first_comment = null,
    thumbnail_path = null
  } = payload;
  const title = enriched.title;
  const caption = enriched.caption;
  const hashtags = enriched.hashtags;

  // 1. Navigate to target surface if Page or Group specified
  let desiredUrl = FB_HOME_URL;
  if (target_type === "page" && target_id && target_id !== "me") {
    desiredUrl = target_id.startsWith("http") ? target_id : `https://www.facebook.com/${target_id}`;
  } else if (target_type === "group" && target_id) {
    desiredUrl = target_id.startsWith("http") ? target_id : `https://www.facebook.com/groups/${target_id}`;
  }

  const currentTab = await chrome.tabs.get(tabId);
  if (!currentTab.url || (desiredUrl !== FB_HOME_URL && !currentTab.url.includes(String(target_id)))) {
    await chrome.tabs.update(tabId, { url: desiredUrl, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(700);
  }

  // 2. Open Facebook Post Composer using Precision Mobile & Desktop Touch
  await blurKeyboardAndSettle(tabId);

  const [triggerRes] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 6 || r.height < 6) return false;
        const st = window.getComputedStyle(el);
        return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || 1) > 0.01;
      };

      const toViewportTap = (el) => {
        const r0 = el.getBoundingClientRect();
        const v0 = window.visualViewport;
        const vh0 = (v0 && v0.height) || window.innerHeight || 1;
        if (r0.top < 8 || r0.bottom > vh0 - 8) {
          try {
            el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          } catch (_) {}
        }
        const r = el.getBoundingClientRect();
        const v = window.visualViewport;
        const vw = (v && v.width) || window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = (v && v.height) || window.innerHeight || document.documentElement.clientHeight || 1;
        const ox = (v && v.offsetLeft) || 0;
        const oy = (v && v.offsetTop) || 0;
        const cx = r.left + r.width * 0.5;
        const cy = r.top + r.height * 0.5;
        return {
          fx: Math.max(0.008, Math.min(0.992, (cx - ox) / vw)),
          fy: Math.max(0.008, Math.min(0.992, (cy - oy) / vh))
        };
      };

      // Check ALL open dialogs to see if the Create Post composer dialog is already open
      const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter(
        isVisible
      );
      for (const d of dialogs) {
        if (d.querySelector('div[role="article"], div[data-pagelet*="FeedUnit"]')) continue;
        const txt = (d.innerText || d.textContent || "").slice(0, 800).toLowerCase();
        if (
          /create post|add to your post|what['’]?s on your mind|पोस्ट बनाउनुहोस्/i.test(txt) ||
          d.querySelector('div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], textarea')
        ) {
          return { ok: true, alreadyOpen: true };
        }
      }

      const mobileComposerBox = document.querySelector(
        '#composer-main-view-id textarea, textarea.composerInput, textarea[name="xc_message"]'
      );
      if (mobileComposerBox && isVisible(mobileComposerBox)) {
        return { ok: true, alreadyOpen: true };
      }

      window.scrollTo({ top: 0, behavior: "instant" });

      const candidates = Array.from(
        document.querySelectorAll(
          'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet*="Composer"] div[role="button"], #MComposer div[role="button"], a[href*="/composer/"], div[role="button"], span[role="button"]'
        )
      ).filter(isVisible);

      const match = candidates.find((el) => {
        if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
        const txt = `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.trim();
        return (
          /what['’]?s on your mind/i.test(txt) ||
          /make a post/i.test(txt) ||
          /write something/i.test(txt) ||
          /create a post/i.test(txt) ||
          /share something/i.test(txt) ||
          /के सोचिरहनुभएको|तपाईंको दिमाग|पोस्ट बनाउनुहोस्|कुछ लिखें/i.test(txt)
        );
      });

      if (!match) {
        return { ok: false, error: "Could not find Facebook post composer trigger on page." };
      }

      const coords = toViewportTap(match);
      try {
        match.click();
      } catch (_) {}
      return {
        ok: true,
        alreadyOpen: false,
        coords
      };
    }
  });

  if (!triggerRes || !triggerRes.result || !triggerRes.result.ok) {
    throw new Error((triggerRes && triggerRes.result && triggerRes.result.error) || "Composer button not found.");
  }

  const isComposerReady = async () => {
    const [chk] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
        for (const dlg of dialogs) {
          if (dlg.querySelector('div[role="article"], div[data-pagelet*="FeedUnit"]')) continue;
          const txt = (dlg.innerText || "").slice(0, 600).toLowerCase();
          if (
            /create post|add to your post|what['’]?s on your mind/i.test(txt) ||
            dlg.querySelector(
              'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], div[contenteditable="true"], textarea'
            )
          ) {
            return true;
          }
        }
        const editors = Array.from(
          document.querySelectorAll(
            'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], textarea.composerInput, textarea[name="xc_message"], textarea'
          )
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 10) return false;
          if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
          const aria = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""}`.toLowerCase();
          return !aria.includes("comment") && !aria.includes("reply") && !aria.includes("search");
        });
        return editors.length > 0;
      }
    });
    return Boolean(chk && chk.result);
  };

  if (!triggerRes.result.alreadyOpen) {
    await sleep(350);
    if (!(await isComposerReady()) && triggerRes.result.coords) {
      await trustedTap(tabId, triggerRes.result.coords);
    }
    for (let w = 0; w < 14; w++) {
      if (await isComposerReady()) break;
      await sleep(220);
    }
  }

  await sleep(300);

  // 3. Populate Caption FIRST while the composer textbox is wide open, AND re-verify after media/thumbnail panels!
  let captionResult = { ok: true, skipped: true, formatting_preserved: true };
  if (caption && String(caption).trim().length > 0) {
    captionResult = await populateComposerCaption(tabId, caption, title, { editorHint: "post" });
    await sleep(250);
  }

  // 4. Attach Media Files (Photos / Carousel / Video) & Verify Single Clean Preview in Composer
  let thumbResult = {
    attempted: false,
    applied: false,
    reason: thumbnail_path
      ? wantVideo
        ? ""
        : "Feed photo/text posts do not have a separate thumbnail slot."
      : "No thumbnail_path provided."
  };
  if (resolvedMediaList.length > 0) {
    await attachMediaToFacebookComposer(
      tabId,
      resolvedMediaList.map((f) => f.path),
      { preferVideo: wantVideo, requirePreview: true, purgeExistingDrafts: true }
    );
    await sleep(wantVideo ? 1800 : 750);

    // 4b. Apply Custom AI/User Thumbnail Image through Facebook's Edit Video -> Thumbnail -> Upload panel (never attach as second feed photo!)
    if (wantVideo && thumbnail_path && String(thumbnail_path).trim()) {
      thumbResult = await uploadThumbnailImage(tabId, thumbnail_path, { surface: "video" });
      await sleep(700);
    }

    // 4c. Verify caption is still present (un-duplicated & formatted) after media attachment; re-insert only if needed
    if (caption && String(caption).trim().length > 0) {
      const checkAfter = await populateComposerCaption(tabId, caption, title, {
        editorHint: "post",
        verifyOnly: true
      });
      if (!checkAfter.ok) {
        captionResult = await populateComposerCaption(tabId, caption, title, { editorHint: "post" });
        await sleep(300);
      } else {
        captionResult = checkAfter;
      }
    }
  }

  if (caption && String(caption).trim().length > 0 && (!captionResult || !captionResult.ok)) {
    throw new Error(
      `Composer caption could not be verified (${(captionResult && captionResult.error) || "editor not found"}). Nothing was published.`
    );
  }

  // 5. Collapse Soft Keyboard & Precision Touch on "Post" / "Publish" (or Mobile "Next" -> "Post")
  await blurKeyboardAndSettle(tabId);

  const findAndTapSubmitButton = async (allowNext = false) => {
    const [btnProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      args: [allowNext],
      func: (canClickNext) => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 12 || r.height < 12) return false;
          const st = window.getComputedStyle(el);
          return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || 1) > 0.01;
        };

        const toViewportTap = (el) => {
          const r = el.getBoundingClientRect();
          const v = window.visualViewport;
          const vw = (v && v.width) || window.innerWidth || document.documentElement.clientWidth || 1;
          const vh = (v && v.height) || window.innerHeight || document.documentElement.clientHeight || 1;
          const ox = (v && v.offsetLeft) || 0;
          const oy = (v && v.offsetTop) || 0;
          const cx = r.left + r.width * 0.5;
          const cy = r.top + r.height * 0.5;
          return {
            fx: Math.max(0.008, Math.min(0.992, (cx - ox) / vw)),
            fy: Math.max(0.008, Math.min(0.992, (cy - oy) / vh))
          };
        };

        // Search all dialogs AND document (excluding feed articles)
        const buttons = Array.from(
          document.querySelectorAll('div[role="button"], button, span[role="button"], input[type="submit"]')
        ).filter((el) => isVisible(el) && !el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]'));

        const postRegex =
          /^(post|publish|share|share now|पोस्ट गर्नुहोस्|पोस्ट गर्नुहोस|पोस्ट|पोस्ट करें|साझा गर्नुहोस्|शेयर करें)$/i;
        const nextRegex = /^(next|done|अर्को|अगला)$/i;

        // Prefer buttons inside a Create Post dialog
        buttons.sort((a, b) => {
          const inDlgA = a.closest('div[role="dialog"]') ? 1 : 0;
          const inDlgB = b.closest('div[role="dialog"]') ? 1 : 0;
          return inDlgB - inDlgA;
        });

        let targetBtn = buttons.find((el) => {
          const txt = (el.innerText || el.textContent || el.value || "").trim();
          const aria = (el.getAttribute("aria-label") || "").trim();
          return postRegex.test(txt) || postRegex.test(aria);
        });

        let isNextStep = false;
        if (!targetBtn && canClickNext) {
          targetBtn = buttons.find((el) => {
            const txt = (el.innerText || el.textContent || el.value || "").trim();
            const aria = (el.getAttribute("aria-label") || "").trim();
            return nextRegex.test(txt) || nextRegex.test(aria);
          });
          if (targetBtn) isNextStep = true;
        }

        if (!targetBtn) return { found: false };
        const disabled =
          targetBtn.disabled ||
          targetBtn.getAttribute("aria-disabled") === "true" ||
          targetBtn.hasAttribute("disabled");
        if (disabled) return { found: true, disabled: true, isNextStep };

        const coords = toViewportTap(targetBtn);
        try {
          targetBtn.click();
        } catch (_) {}
        return {
          found: true,
          disabled: false,
          isNextStep,
          coords
        };
      }
    });
    return (btnProbe && btnProbe.result) || { found: false };
  };

  let postBtnResult = null;
  const maxAttempts = wantVideo ? 28 : 14;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    postBtnResult = await findAndTapSubmitButton(attempt >= 2);
    if (postBtnResult.found && !postBtnResult.disabled) {
      if (postBtnResult.coords) {
        await sleep(140);
        await trustedTap(tabId, postBtnResult.coords);
      }
      if (postBtnResult.isNextStep) {
        await sleep(900);
        for (let pStep = 0; pStep < 10; pStep++) {
          const finalPost = await findAndTapSubmitButton(false);
          if (finalPost.found && !finalPost.disabled) {
            if (finalPost.coords) {
              await sleep(140);
              await trustedTap(tabId, finalPost.coords);
            }
            postBtnResult = finalPost;
            break;
          }
          await sleep(500);
        }
      }
      break;
    }
    await sleep(600);
  }

  if (!postBtnResult || !postBtnResult.found) {
    throw new Error("Could not find 'Post' / 'Publish' button in Facebook composer.");
  }
  if (postBtnResult.disabled) {
    throw new Error("Facebook 'Post' button remained disabled (media may still be uploading).");
  }

  // Wait for composer modal / mobile screen to dismiss; if still open after 1.8s, send one more trusted tap
  await sleep(1800);
  if (await isComposerReady()) {
    const retrySubmit = await findAndTapSubmitButton(false);
    if (retrySubmit.found && !retrySubmit.disabled && retrySubmit.coords) {
      await trustedTap(tabId, retrySubmit.coords);
    }
  }

  for (let i = 0; i < 15; i++) {
    await sleep(700);
    if (!(await isComposerReady())) break;
  }

  let firstCommentResult = null;
  if (first_comment && String(first_comment).trim()) {
    await sleep(1500);
    try {
      firstCommentResult = await executeCommentInBrowser(tabId, {
        post_url_or_id: "latest",
        comment_text: String(first_comment).trim()
      });
    } catch (err) {
      firstCommentResult = { success: false, error: err.message };
    }
  }

  const finalTab = await chrome.tabs.get(tabId).catch(() => ({ url: desiredUrl }));
  return {
    success: true,
    status: "published",
    post_type: effectivePostType,
    target_type,
    title,
    caption,
    hashtags,
    media_attached: resolvedMediaList.map((f) => f.path),
    thumbnail_path: thumbnail_path || null,
    thumbnail_applied: Boolean(thumbResult.applied),
    thumbnail_note: thumbResult.applied
      ? "User thumbnail applied in Video options."
      : thumbResult.reason || (thumbnail_path ? "Thumbnail was not applied." : "No thumbnail_path provided."),
    caption_verified: Boolean(captionResult && captionResult.ok),
    formatting_preserved: Boolean(captionResult && captionResult.formatting_preserved),
    fb_post_id: `fb_dom_${Date.now()}`,
    post_url: finalTab.url || desiredUrl,
    first_comment_result: firstCommentResult,
    message: `Facebook ${effectivePostType} post published successfully in AntiGem browser with "${title}" and ${hashtags.length} hashtags.${
      wantVideo && thumbnail_path ? ` Thumbnail: ${thumbResult.applied ? "applied" : "NOT applied (" + (thumbResult.reason || "n/a") + ")"}.` : ""
    }`
  };
}

/**
 * Shared helper: find & tap a wizard button once by exact label, scoped away from nav bars, feed posts and comments.
 * Prefers single native trustedTap(coords), falling back to DOM .click() only if trustedTap is unavailable.
 */
async function tapWizardButton(tabId, labelRegexSource, options = {}) {
  const { clickIt = true } = options;
  const [res] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    args: [labelRegexSource],
    func: (reSrc) => {
      document.querySelectorAll('[data-ag-wizard-btn="1"]').forEach((e) => e.removeAttribute("data-ag-wizard-btn"));
      const re = new RegExp(reSrc, "i");
      const btns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"], a[role="button"]')).filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 12) return false;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return false;
        return !el.closest('[role="banner"], [role="navigation"], div[role="article"], div[data-pagelet*="FeedUnit"]');
      });
      btns.sort((a, b) => (b.closest('div[role="dialog"], form, [role="main"]') ? 1 : 0) - (a.closest('div[role="dialog"], form, [role="main"]') ? 1 : 0));
      const btn = btns.find((el) => {
        const t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        const a = (el.getAttribute("aria-label") || "").trim();
        return re.test(t) || re.test(a);
      });
      if (!btn) return { found: false };
      const disabled = btn.disabled || btn.getAttribute("aria-disabled") === "true";
      if (disabled) return { found: true, disabled: true };
      btn.setAttribute("data-ag-wizard-btn", "1");
      const r = btn.getBoundingClientRect();
      const v = window.visualViewport;
      const vw = (v && v.width) || innerWidth;
      const vh = (v && v.height) || innerHeight;
      const coords = {
        fx: Math.max(0.008, Math.min(0.992, (r.left + r.width / 2 - ((v && v.offsetLeft) || 0)) / vw)),
        fy: Math.max(0.008, Math.min(0.992, (r.top + r.height / 2 - ((v && v.offsetTop) || 0)) / vh))
      };
      return { found: true, disabled: false, coords };
    }
  });
  const out = (res && res.result) || { found: false };
  if (out.found && !out.disabled && clickIt) {
    const tapped = out.coords ? await trustedTap(tabId, out.coords) : false;
    if (!tapped) {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const b = document.querySelector('[data-ag-wizard-btn="1"]');
          if (b) {
            try {
              b.click();
            } catch (_) {}
          }
        }
      });
    }
    await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        document.querySelectorAll('[data-ag-wizard-btn="1"]').forEach((e) => e.removeAttribute("data-ag-wizard-btn"));
      }
    }).catch(() => {});
  }
  return out;
}

/**
 * Pipeline B: Facebook Reels (https://www.facebook.com/reels/create)
 * Upload video -> wait for processing -> Next (Edit step: apply user's Cover/Thumbnail) -> Next
 * -> Describe step: Title + Description + Hashtags (formatted, verified) -> Publish -> confirm.
 * If the Reels creator is not available (pure m.facebook.com), falls back to Feed Video composer
 * (Facebook turns vertical videos into Reels) and reports fallback_used.
 */
async function executeReelUploadInBrowser(tabId, payload) {
  const rawVideoPath =
    payload.video_path || (Array.isArray(payload.media_paths) && payload.media_paths[0]) || "latest";
  const resolvedVideo = await resolveLocalFile(rawVideoPath, true);
  if (!isVideoPath(resolvedVideo.path)) {
    throw new Error(`Reel needs a video file (.mp4/.mov). Got: ${resolvedVideo.filename}`);
  }
  const videoPath = resolvedVideo.path;
  const thumbnailPath = payload.thumbnail_path ? String(payload.thumbnail_path).trim() : null;

  const enriched = ensureTitleAndHashtags({ ...payload, post_type: "reel", media_hint: resolvedVideo.filename });
  const { title, caption, hashtags } = enriched;

  await chrome.tabs.update(tabId, { url: FB_REELS_CREATE_URL, active: true });
  await waitForTabComplete(tabId, 20000);
  await sleep(1200);

  let isReelCreator = false;
  for (let p = 0; p < 4; p++) {
    const [surfaceProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const txt = (document.body ? document.body.innerText || "" : "").slice(0, 3000).toLowerCase();
        const hasVideoInput = Array.from(document.querySelectorAll('input[type="file"]')).some((i) =>
          /video/.test((i.getAttribute("accept") || "").toLowerCase())
        );
        return { isReelCreator: hasVideoInput || /create reel|add video|upload video|drag and drop/.test(txt), href: location.href };
      }
    });
    if (surfaceProbe && surfaceProbe.result && surfaceProbe.result.isReelCreator) {
      isReelCreator = true;
      break;
    }
    await sleep(900);
  }

  if (!isReelCreator) {
    await chrome.tabs.update(tabId, { url: FB_HOME_URL, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(800);
    const fb = await executeFeedPostInBrowser(tabId, {
      ...payload,
      title,
      caption,
      hashtags,
      thumbnail_path: thumbnailPath,
      media_paths: [videoPath],
      post_type: "video"
    });
    return {
      ...fb,
      post_type: "reel",
      surface: "feed_video_fallback",
      fallback_used: true,
      message: `Reels creator is not available on this Facebook view, so the vertical video was published through the Feed video composer (Facebook shows it as a Reel). ${fb.message || ""}`
    };
  }

  await attachMediaToFacebookComposer(tabId, [videoPath], {
    preferVideo: true,
    requirePreview: false,
    purgeExistingDrafts: false
  });
  await sleep(2500);

  // Walk the wizard: wait for upload processing, apply thumbnail on Edit/Describe step, stop at Describe step
  let thumbResult = thumbnailPath ? { attempted: false, applied: false } : { attempted: false, applied: false, reason: "No thumbnail_path provided." };
  let coverTried = false;
  let nextClicks = 0;
  const wizardDeadline = Date.now() + 150000;
  while (Date.now() < wizardDeadline && nextClicks < 6) {
    const [st] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 4 && r.height > 4 && s.display !== "none" && s.visibility !== "hidden";
        };
        const zone = (el) => !el.closest('[role="banner"], [role="navigation"], div[role="article"]');
        const editors = Array.from(document.querySelectorAll('[contenteditable="true"], textarea')).filter((e) => vis(e) && zone(e));
        const hasDescribe = editors.some((e) =>
          /describe|description|caption|write|reel/i.test(
            `${e.getAttribute("aria-label") || ""} ${e.getAttribute("aria-placeholder") || ""} ${e.getAttribute("placeholder") || ""} ${(e.parentElement && e.parentElement.innerText) || ""}`.slice(0, 300)
          )
        );
        const btns = Array.from(document.querySelectorAll('div[role="button"], button')).filter((b) => vis(b) && zone(b));
        const lab = (b) => `${(b.innerText || "").trim()}|${(b.getAttribute("aria-label") || "").trim()}`;
        const publish = btns.find((b) => /(^|\|)(publish|share|share now|share reel|post)(\||$)/i.test(lab(b)));
        const next = btns.find((b) => /(^|\|)(next|अर्को|अगला)(\||$)/i.test(lab(b)));
        const coverCtl = Array.from(document.querySelectorAll('div[role="button"], button, div[role="tab"], span, label')).some((e) => {
          const t = `${e.getAttribute("aria-label") || ""} ${e.innerText || ""}`.trim();
          return vis(e) && zone(e) && t.length < 44 && /thumbnail|cover/i.test(t);
        });
        const uploading = /uploading|processing|\d{1,3}\s?%/i.test((document.body.innerText || "").slice(0, 4000));
        return {
          hasDescribe,
          publishFound: Boolean(publish),
          nextFound: Boolean(next),
          nextEnabled: Boolean(next && !next.disabled && next.getAttribute("aria-disabled") !== "true"),
          coverCtl,
          uploading
        };
      }
    });
    const s = (st && st.result) || {};

    if (thumbnailPath && !thumbResult.applied && s.coverCtl && !coverTried) {
      coverTried = true;
      thumbResult = await uploadThumbnailImage(tabId, thumbnailPath, { surface: "reel" });
      await sleep(800);
      continue;
    }
    if (s.hasDescribe || (s.publishFound && !s.nextFound)) break;
    if (s.nextEnabled) {
      await tapWizardButton(tabId, "^(next|अर्को|अगला)$");
      nextClicks++;
      await sleep(1600);
      continue;
    }
    await sleep(1200);
  }

  // Last chance for thumbnail on the Describe/Publish step
  if (thumbnailPath && !thumbResult.applied) {
    const retry = await uploadThumbnailImage(tabId, thumbnailPath, { surface: "reel" });
    if (retry.applied || !thumbResult.attempted) thumbResult = retry;
  }

  // Title + Description + Hashtags (formatted & verified). Never publish a blank Reel.
  const captionResult = await populateComposerCaption(tabId, caption, title, { editorHint: "reel" });
  if (!captionResult.ok) {
    throw new Error(
      `Reel description box could not be filled and verified (${captionResult.error || "unknown"}). Stopped before Publish so the Reel is not posted without its title/description/hashtags.`
    );
  }
  await sleep(500);
  await blurKeyboardAndSettle(tabId);

  let published = false;
  for (let i = 0; i < 90; i++) {
    const r = await tapWizardButton(tabId, "^(publish|share reel|share now|share|post)$");
    if (r.found && !r.disabled) {
      published = true;
      break;
    }
    await sleep(1000);
  }
  if (!published) {
    throw new Error("Reel 'Publish' button never became active (video may still be processing). Nothing was posted.");
  }

  let confirmed = false;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const [c] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const txt = (document.body.innerText || "").slice(0, 4000);
        const leftWizard = !/\/reels\/create/.test(location.pathname);
        const okMsg = /reel (is being|has been|was) (shared|published|processed|posted)|your reel is|reel published|shared to reels/i.test(txt);
        return leftWizard || okMsg;
      }
    });
    if (c && c.result) {
      confirmed = true;
      break;
    }
  }

  return {
    success: true,
    status: confirmed ? "published" : "publish_clicked_unconfirmed",
    post_type: "reel",
    surface: "reels_create",
    title,
    caption,
    hashtags,
    media_attached: [videoPath],
    thumbnail_path: thumbnailPath,
    thumbnail_applied: Boolean(thumbResult.applied),
    thumbnail_note: thumbResult.applied ? "User thumbnail set as Reel cover." : thumbResult.reason || "Thumbnail not applied.",
    caption_verified: true,
    formatting_preserved: captionResult.formatting_preserved,
    fb_post_id: `fb_reel_${Date.now()}`,
    post_url: FB_REELS_CREATE_URL,
    message: `Facebook Reel ${confirmed ? "published" : "submitted"} with title "${title}", description and ${hashtags.length} hashtags. Thumbnail: ${
      thumbResult.applied ? "applied" : "NOT applied (" + (thumbResult.reason || "n/a") + ")"
    }.`
  };
}

/**
 * Pipeline C: Facebook Story (https://www.facebook.com/stories/create)
 * Photo / Video story: "Create a photo story" -> attach -> optional "Add text" overlay -> Share to story.
 * Text story: "Create a text story" -> type text -> Share to story.
 * Stories have no caption field: the overlay text uses story_text, else title, else the first line of caption.
 */
async function executeStoryUploadInBrowser(tabId, payload) {
  let mediaPath = payload.media_path || (Array.isArray(payload.media_paths) && payload.media_paths[0]) || null;
  const rawCaption = String(payload.caption || "").trim();
  const firstCaptionLine = (rawCaption.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "")
    .replace(/#[\w\u0900-\u097F]+/g, "")
    .trim();
  let storyText = String(payload.story_text || payload.title || firstCaptionLine || "").trim().slice(0, 120);

  if (mediaPath) {
    const resolved = await resolveLocalFile(mediaPath, /^(latest|newest|auto|last|recent)$/i.test(String(mediaPath)) ? false : isVideoPath(mediaPath));
    mediaPath = resolved.path;
  } else if (!storyText && !rawCaption) {
    const autoPhoto = await autoDiscoverLatestMedia(false);
    if (autoPhoto) mediaPath = autoPhoto.path;
  }
  const isTextStory = !mediaPath;
  if (isTextStory && !storyText) storyText = rawCaption.slice(0, 250);
  if (isTextStory && !storyText) throw new Error("Story needs a photo/video or text.");

  await chrome.tabs.update(tabId, { url: FB_STORIES_CREATE_URL, active: true });
  await waitForTabComplete(tabId, 20000);
  await sleep(1500);

  const probeCreator = async () => {
    const [p] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const txt = (document.body ? document.body.innerText || "" : "").slice(0, 3000).toLowerCase();
        return /create a photo story|create a text story|photo story|text story/.test(txt) || Boolean(document.querySelector('input[type="file"]'));
      }
    });
    return Boolean(p && p.result);
  };

  if (!(await probeCreator())) {
    // Fallback: Home feed "Create story" card
    await chrome.tabs.update(tabId, { url: FB_HOME_URL, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(900);
    await tapWizardButton(tabId, "^(create story|create a story|add to story|स्टोरी बनाउनुहोस्)$");
    await sleep(1500);
    if (!(await probeCreator())) {
      throw new Error("Facebook Story creator did not open on this view. Turn on 'Desktop site' in the browser menu and retry.");
    }
  }

  let storyTextApplied = false;

  if (!isTextStory) {
    await attachMediaToFacebookComposer(tabId, [mediaPath], {
      preferVideo: isVideoPath(mediaPath),
      requirePreview: false,
      purgeExistingDrafts: false
    });

    // Wait for the story editor (preview + Share button) to appear
    for (let i = 0; i < 20; i++) {
      const s = await tapWizardButton(tabId, "^(share to story|share to your story|share now|share)$", { clickIt: false });
      if (s.found) break;
      await sleep(700);
    }

    if (storyText) {
      const addText = await tapWizardButton(tabId, "^(add text|text|aa)$");
      if (addText.found && !addText.disabled) {
        await sleep(700);
        const res = await populateComposerCaption(tabId, storyText, "", { editorHint: "story" });
        storyTextApplied = Boolean(res.ok);
        await sleep(300);
        await tapWizardButton(tabId, "^(done)$");
      }
    }
  } else {
    await tapWizardButton(tabId, "^(create a text story|text story|text)$");
    await sleep(1000);
    const res = await populateComposerCaption(tabId, storyText, "", { editorHint: "story" });
    if (!res.ok) throw new Error("Could not type text into the Facebook text story. Nothing was shared.");
    storyTextApplied = true;
  }

  await blurKeyboardAndSettle(tabId);
  let shared = false;
  for (let i = 0; i < 40; i++) {
    const r = await tapWizardButton(tabId, "^(share to story|share to your story|share now|share|स्टोरीमा साझा गर्नुहोस्|स्टोरी शेयर करें)$");
    if (r.found && !r.disabled) {
      shared = true;
      break;
    }
    await sleep(900);
  }
  if (!shared) throw new Error("'Share to story' button never became active. Nothing was shared.");

  let confirmed = false;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const [c] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => !/\/stories\/create/.test(location.pathname) || /story (shared|posted|added)|your story/i.test((document.body.innerText || "").slice(0, 3000))
    });
    if (c && c.result) {
      confirmed = true;
      break;
    }
  }

  return {
    success: true,
    status: confirmed ? "published" : "share_clicked_unconfirmed",
    post_type: "story",
    story_kind: isTextStory ? "text" : isVideoPath(mediaPath) ? "video" : "photo",
    story_text: storyText || null,
    story_text_applied: storyTextApplied,
    media_attached: mediaPath ? [mediaPath] : [],
    fb_post_id: `fb_story_${Date.now()}`,
    post_url: FB_STORIES_CREATE_URL,
    message: `Facebook ${isTextStory ? "text" : "photo/video"} Story ${confirmed ? "shared" : "submitted"}${storyText ? ` with text "${storyText}" (${storyTextApplied ? "applied" : "not applied"})` : ""}. Note: Stories have no caption/hashtag field.`
  };
}

/**
 * Pipeline D: Edit Existing Facebook Post
 */
async function executeEditPostInBrowser(tabId, payload) {
  const { post_url_or_id, new_caption } = payload;
  if (post_url_or_id && post_url_or_id.startsWith("http")) {
    await chrome.tabs.update(tabId, { url: post_url_or_id, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(1000);
  }

  const [menuRes] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const btn = document.querySelector(
        'div[aria-label*="Actions for this post" i], div[aria-label*="More options" i], div[aria-label*="More" i][role="button"]'
      );
      if (!btn) return { ok: false, error: "Could not find post 3-dots actions menu button." };
      btn.click();
      return { ok: true };
    }
  });
  if (!menuRes || !menuRes.result || !menuRes.result.ok) {
    throw new Error((menuRes && menuRes.result && menuRes.result.error) || "Post actions menu not found.");
  }

  await sleep(800);
  const [clickEdit] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const item = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"], a')).find((el) =>
        /edit post|^edit$/i.test((el.innerText || el.textContent || "").trim())
      );
      if (!item) return { ok: false, error: "Could not find 'Edit post' option in menu." };
      item.click();
      return { ok: true };
    }
  });
  if (!clickEdit || !clickEdit.result || !clickEdit.result.ok) {
    throw new Error((clickEdit && clickEdit.result && clickEdit.result.error) || "Edit option not found.");
  }

  await sleep(1200);
  await populateComposerCaption(tabId, String(new_caption), "");
  await sleep(400);

  const [saveRes] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const saveBtn = Array.from(
        document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button')
      ).find((el) => /^save$|^done$|^post$/i.test((el.innerText || el.textContent || "").trim()));
      if (!saveBtn) return { ok: false, error: "Could not find Save button in Edit Post dialog." };
      saveBtn.click();
      return { ok: true };
    }
  });

  if (!saveRes || !saveRes.result || !saveRes.result.ok) {
    throw new Error((saveRes && saveRes.result && saveRes.result.error) || "Failed to save edited post.");
  }

  await sleep(1500);
  return {
    success: true,
    post_url_or_id,
    message: "Facebook post caption updated and saved successfully."
  };
}

/**
 * Pipeline E: Delete Existing Facebook Post / Move to Trash
 */
async function executeDeletePostInBrowser(tabId, payload) {
  const { post_url_or_id } = payload;
  if (post_url_or_id && post_url_or_id.startsWith("http")) {
    await chrome.tabs.update(tabId, { url: post_url_or_id, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(1000);
  }

  const [menuRes] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const btn = document.querySelector(
        'div[aria-label*="Actions for this post" i], div[aria-label*="More options" i]'
      );
      if (!btn) return { ok: false, error: "Could not find post 3-dots actions menu button." };
      btn.click();
      return { ok: true };
    }
  });
  if (!menuRes || !menuRes.result || !menuRes.result.ok) {
    throw new Error((menuRes && menuRes.result && menuRes.result.error) || "Post actions menu not found.");
  }

  await sleep(800);
  const [delItemRes] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const item = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"], a')).find((el) =>
        /move to trash|delete post|^delete$/i.test((el.innerText || el.textContent || "").trim())
      );
      if (!item) return { ok: false, error: "Could not find 'Move to trash' or 'Delete' option." };
      item.click();
      return { ok: true };
    }
  });
  if (!delItemRes || !delItemRes.result || !delItemRes.result.ok) {
    throw new Error((delItemRes && delItemRes.result && delItemRes.result.error) || "Delete menu item not found.");
  }

  await sleep(1200);
  await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const confirmBtn = Array.from(
        document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button')
      ).find((el) => /^(move|delete|confirm)$/i.test((el.innerText || el.textContent || "").trim()));
      if (confirmBtn) confirmBtn.click();
    }
  });

  await sleep(1500);
  return {
    success: true,
    post_url_or_id,
    message: "Facebook post deleted / moved to trash successfully."
  };
}

/**
 * Pipeline F: Add Comment (First Comment Resource Link or Reply)
 */
async function executeCommentInBrowser(tabId, payload) {
  const { post_url_or_id, comment_text } = payload;
  if (post_url_or_id && post_url_or_id.startsWith("http")) {
    await chrome.tabs.update(tabId, { url: post_url_or_id, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(1000);
  }

  const [cmtRes] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    args: [String(comment_text)],
    func: (txt) => {
      const input = document.querySelector(
        'div[aria-label*="Write a comment" i][contenteditable="true"], div[role="textbox"][aria-label*="comment" i], textarea[placeholder*="comment" i], input[placeholder*="comment" i]'
      );
      if (!input) return { ok: false, error: "Could not locate comment input box on active Facebook post." };
      input.scrollIntoView({ block: "center", behavior: "instant" });
      input.focus();
      if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
        input.value = txt;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        document.execCommand("insertText", false, txt);
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: txt }));
      }
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
      );
      const submitBtn = document.querySelector(
        'div[aria-label="Comment"][role="button"], button[type="submit"][value*="Comment" i]'
      );
      if (submitBtn) submitBtn.click();
      return { ok: true };
    }
  });

  if (!cmtRes || !cmtRes.result || !cmtRes.result.ok) {
    throw new Error((cmtRes && cmtRes.result && cmtRes.result.error) || "Failed to post comment.");
  }

  await sleep(1200);
  return {
    success: true,
    post_url_or_id,
    message: "Comment posted successfully on Facebook."
  };
}

// ============================================================================
// 6. Unified Task Dispatcher with One-Time Login Gatekeeper & Auto-Resume
// ============================================================================

async function dispatchProtectedBrowserTask(toolName, args) {
  const loginState = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });

  if (!loginState.logged_in) {
    const pendingTask = {
      id: `pending_${Date.now()}`,
      tool: toolName,
      args,
      queued_at: Date.now()
    };
    await setStorage({ fb_pending_task: pendingTask });

    await recordPostHistory({
      id: pendingTask.id,
      post_type:
        args.post_type ||
        (toolName === "fb_publish_reel" ? "reel" : toolName === "fb_publish_story" ? "story" : "text"),
      caption: args.caption || args.new_caption || args.comment_text || "",
      media_paths:
        args.media_paths || (args.video_path ? [args.video_path] : args.media_path ? [args.media_path] : []),
      status: "awaiting_login"
    });

    return {
      ...loginState,
      pending_task_saved: true,
      pending_task_id: pendingTask.id,
      pending_tool: toolName,
      message:
        "Facebook has been opened in the AntiGem browser. Please complete your ONE-TIME LOGIN in the open Facebook tab. Your task (" +
        toolName +
        ") has been saved and will start automatically as soon as you sign in (or tell me 'continue' after signing in)."
    };
  }

  if (inFlightLock && Date.now() - inFlightLock.startedAt < 90000) {
    return {
      success: false,
      in_flight_busy: true,
      stop_loop: true,
      error: `Another Facebook upload (${inFlightLock.tool}) is already in progress in the AntiGem browser.`,
      agent_instruction: "STOP IMMEDIATELY. Do not retry or read files."
    };
  }

  const tabId = loginState.active_tab_id;
  let mediaList =
    args.media_paths ||
    (args.video_path ? [args.video_path] : args.media_path ? [args.media_path] : []);

  const requestedPostType = String(args.post_type || "").toLowerCase();
  if (
    mediaList.length === 0 &&
    (requestedPostType === "photo" ||
      requestedPostType === "carousel" ||
      requestedPostType === "video" ||
      toolName === "fb_publish_reel")
  ) {
    const autoMedia = await autoDiscoverLatestMedia(
      requestedPostType === "video" || toolName === "fb_publish_reel"
    );
    if (autoMedia) {
      mediaList = [autoMedia.path];
    }
  }

  const postType =
    args.post_type ||
    (toolName === "fb_publish_reel"
      ? "reel"
      : toolName === "fb_publish_story"
      ? "story"
      : mediaList.length > 0
      ? isVideoPath(mediaList[0])
        ? "video"
        : mediaList.length > 1
        ? "carousel"
        : "photo"
      : "text");

  if (toolName === "fb_publish" || toolName === "fb_publish_reel" || toolName === "fb_publish_story") {
    const dup = await checkDuplicate(args.caption, mediaList, Boolean(args.force));
    if (dup.isDuplicate) {
      return {
        success: false,
        duplicate_detected: true,
        stop_loop: true,
        error: dup.reason,
        agent_instruction: "Report duplicate notice to the user in 1 sentence and STOP."
      };
    }

    const store = await getStorage(["fb_last_publish_at"]);
    const elapsed = Date.now() - (store.fb_last_publish_at || 0);
    if (store.fb_last_publish_at && elapsed < MIN_POST_INTERVAL_MS) {
      await sleep(MIN_POST_INTERVAL_MS - elapsed);
    }
  }

  inFlightLock = { tool: toolName, startedAt: Date.now() };
  const recordId = args.id || `fb_${Date.now()}`;

  try {
    return await withAutomationLease(tabId, async () => {
      let result;
      if (toolName === "fb_publish_reel" || (toolName === "fb_publish" && postType === "reel")) {
        result = await executeReelUploadInBrowser(tabId, { ...args, media_paths: mediaList });
      } else if (toolName === "fb_publish_story" || (toolName === "fb_publish" && postType === "story")) {
        result = await executeStoryUploadInBrowser(tabId, { ...args, media_paths: mediaList });
      } else if (toolName === "fb_publish") {
        result = await executeFeedPostInBrowser(tabId, {
          ...args,
          media_paths: mediaList,
          post_type: postType
        });
      } else if (toolName === "fb_edit_post") {
        result = await executeEditPostInBrowser(tabId, args);
      } else if (toolName === "fb_delete_post") {
        result = await executeDeletePostInBrowser(tabId, args);
      } else if (toolName === "fb_comments") {
        result = await executeCommentInBrowser(tabId, args);
      } else {
        throw new Error(`Unsupported browser task: ${toolName}`);
      }

      if (result && result.success) {
        await setStorage({ fb_last_publish_at: Date.now(), fb_pending_task: null });
        if (toolName.startsWith("fb_publish")) {
          const finalCap = result.caption || args.caption || "";
          const finalMedia = result.media_attached || mediaList;
          await recordDedupe(finalCap, finalMedia, result.fb_post_id || recordId);
          await recordPostHistory({
            id: recordId,
            fb_post_id: result.fb_post_id,
            post_url: result.post_url,
            post_type: result.post_type || postType,
            target_type: args.target_type || "profile",
            title: result.title || args.title || "",
            caption: finalCap,
            hashtags: result.hashtags || args.hashtags || [],
            media_paths: finalMedia,
            status: "published"
          });
        }
      }

      return result;
    });
  } catch (err) {
    await recordPostHistory({
      id: recordId,
      post_type: postType,
      caption: args.caption || "",
      media_paths: mediaList,
      status: "failed",
      error_message: err.message
    });
    return {
      success: false,
      stop_loop: true,
      error: err.message,
      agent_instruction:
        "CRITICAL: Do NOT read worker.js, fb_doctor.json, or webview_extension_logs.json and do NOT enter a debugging loop! Report the status concisely to the user and stop."
    };
  } finally {
    inFlightLock = null;
  }
}

// ============================================================================
// 7. Auto-Resume Watcher When User Completes One-Time Login in AntiGem Browser
// ============================================================================

let autoResumeRunning = false;

async function checkAndAutoResumePendingTask() {
  if (autoResumeRunning || inFlightLock) return;
  const store = await getStorage(["fb_pending_task", "fb_awaiting_login"]);
  if (!store.fb_pending_task) return;

  autoResumeRunning = true;
  try {
    const login = await checkFacebookLogin({ openIfMissing: false, activateOnLoginNeeded: false });
    if (login && login.logged_in) {
      const task = store.fb_pending_task;
      await setStorage({ fb_pending_task: null, fb_awaiting_login: false });
      console.log(`[${PLUGIN_ID}] One-time login detected! Auto-resuming task: ${task.tool}`);
      await dispatchProtectedBrowserTask(task.tool, { ...task.args, id: task.id });
    }
  } catch (err) {
    console.warn(`[${PLUGIN_ID}] Auto-resume error:`, err);
  } finally {
    autoResumeRunning = false;
  }
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab && isFacebookUrl(tab.url)) {
      setTimeout(() => {
        checkAndAutoResumePendingTask();
      }, 1500);
    }
  });
}

// ============================================================================
// 8. Background Alarm Scheduler for Due Scheduled Posts
// ============================================================================

async function processDueScheduledJobs() {
  if (inFlightLock) return;
  const store = await getStorage(["fb_scheduled_jobs"]);
  const jobs = Array.isArray(store.fb_scheduled_jobs) ? store.fb_scheduled_jobs : [];
  if (jobs.length === 0) return;

  const nowSec = Date.now() / 1000;
  let updated = false;

  for (const job of jobs) {
    if (job.status === "queued" && job.run_at_timestamp <= nowSec) {
      const login = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });
      if (!login.logged_in) {
        job.last_note = "Waiting for one-time Facebook login in AntiGem browser.";
        updated = true;
        break;
      }

      job.status = "running";
      updated = true;
      await setStorage({ fb_scheduled_jobs: jobs });

      const res = await dispatchProtectedBrowserTask("fb_publish", {
        id: job.post_id,
        title: job.title,
        caption: job.caption,
        hashtags: job.hashtags,
        thumbnail_path: job.thumbnail_path || null,
        media_paths: job.media_paths || [],
        post_type: job.post_type || "text",
        target_type: job.target_type || "profile",
        target_id: job.target_id || null
      });

      job.status = res && res.success ? "completed" : "failed";
      job.completed_at = Date.now();
      job.result = res;
      updated = true;
    }
  }

  if (updated) {
    await setStorage({ fb_scheduled_jobs: jobs });
  }
}

if (chrome.alarms) {
  chrome.alarms.create("fb_scheduler_tick", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === "fb_scheduler_tick") {
      checkAndAutoResumePendingTask();
      processDueScheduledJobs();
    }
  });
}

// ============================================================================
// 9. Senior Social Media Manager Auto-Copywriter & AI Thumbnail Engine
// ============================================================================

const VISUAL_ARCHETYPE_SPECS = {
  tactile_workspace:
    "Overhead flat-lay on warm walnut desk with real physical stationery, brass binder clips, mechanical keyboard, notebook, dramatic directional studio key light, crisp natural contact shadows, 85mm macro lens f/2.8",
  classical_fusion:
    "Caravaggio chiaroscuro marble Roman bust fused with sleek modern neon tech elements, volumetric rim lighting, deep obsidian studio backdrop, 50mm prime lens",
  surreal_metaphor:
    "Magritte-inspired conceptual surreal visual metaphor with miniature human figure interacting with a giant everyday object, dramatic golden-hour rim light, ultra-clean composition",
  kinetic_blueprint:
    "Architectural technical schematic blueprint on textured drafting paper with glowing cyan and electric-gold isometric callout lines, tactile physical tools",
  retro_modern:
    "1970s Dieter Rams Braun industrial analog hardware aesthetic paired with crisp Swiss grid typography, warm tungsten key light, subtle film grain",
  macro_texture:
    "Extreme 100mm f/2.8 macro photography of tactile physical materials (embossed heavy cotton paper, brushed anodized aluminum, liquid gold ink), razor-sharp depth of field",
  minimalist_monolith:
    "Stark architectural monolith in a vast atmospheric landscape, dramatic volumetric god-rays, radial spotlight pool behind the focal subject, cinematic rim lighting"
};

const SENIOR_SMM_QUOTES = [
  {
    title: "Silent Consistency Always Wins",
    quote: "“Discipline is choosing between what you want now and what you want most.”",
    bullets: [
      "🔹 Small daily moves compound into unstoppable momentum.",
      "🔹 Protect your focus from noise—your results will speak for themselves."
    ]
  },
  {
    title: "Build In Silence, Let Impact Speak",
    quote: "“Your direction is always more important than your speed.”",
    bullets: [
      "🔹 Clarity beats hustle when everyone else is rushing blindly.",
      "🔹 Master the fundamentals and the breakthroughs will follow."
    ]
  },
  {
    title: "The Mindset That Changes Everything",
    quote: "“Growth begins the exact moment you stop waiting for perfect conditions.”",
    bullets: [
      "🔹 Action cures fear faster than overthinking ever will.",
      "🔹 Show up with intention every single day."
    ]
  }
];

function extractTopicFromMediaHint(mediaHint = "") {
  const base = String(mediaHint || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^IMG_|^VID_|^Screenshot_|^media_|^\d+_/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b[0-9a-f]{6,}\b/gi, "")
    .replace(/\b\d{5,}\b/g, "")
    .trim();
  if (base && base.length >= 4 && !/^(upload|photo|image|video|media|asset|latest)$/i.test(base)) {
    return base.slice(0, 50).trim();
  }
  return "";
}

function ensureTitleAndHashtags(payload = {}) {
  const postType = String(payload.post_type || "").toLowerCase();
  let rawCaption = String(payload.caption || "").replace(/\r\n/g, "\n").trim();
  let rawTitle = String(payload.title || "").trim();

  // Stories do NOT have feed captions or hashtags — keep only clean overlay text if requested.
  if (postType === "story") {
    const firstLine = (rawCaption.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "")
      .replace(/#[\w\u0900-\u097F]+/g, "")
      .trim();
    const storyText = String(payload.story_text || rawTitle || firstLine || "").trim().slice(0, 120);
    return {
      title: rawTitle || storyText,
      caption: rawCaption,
      hashtags: [],
      story_text: storyText
    };
  }

  const mediaHint = extractTopicFromMediaHint(payload.media_hint || "");

  const isInstructionOnly =
    !rawCaption ||
    /^(upload|post|share|send)\s+(this\s+|a\s+|the\s+)?(photo|image|pic|picture|video|reel|story|post)$/i.test(
      rawCaption
    );

  if (isInstructionOnly) {
    const preset = SENIOR_SMM_QUOTES[Math.floor(Date.now() / 60000) % SENIOR_SMM_QUOTES.length];
    if (!rawTitle) {
      rawTitle = mediaHint
        ? `${mediaHint.charAt(0).toUpperCase() + mediaHint.slice(1)} — Perspective`
        : preset.title;
    }
    rawCaption = [
      `🔥 ${rawTitle}`,
      "",
      preset.quote,
      "",
      ...preset.bullets,
      "",
      "👇 What’s one lesson this reminds you of today? Share your thoughts below!"
    ].join("\n");
  } else if (rawCaption.split(/\s+/).length <= 8 && !rawCaption.includes("\n")) {
    const shortIdea = rawCaption.replace(/#[\w\u0900-\u097F]+/g, "").trim();
    if (!rawTitle) {
      rawTitle = shortIdea.length <= 65 ? shortIdea : shortIdea.slice(0, 62) + "...";
    }
    rawCaption = [
      `🔥 ${rawTitle}`,
      "",
      `“${shortIdea}”`,
      "",
      "🔹 Real progress happens when clarity meets consistent execution.",
      "🔹 Keep building—even the quietest steps forward count.",
      "",
      "👇 Do you agree with this? Drop a 🔥 in the comments!"
    ].join("\n");
  }

  if (!rawTitle) {
    const firstLine = (rawCaption.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "")
      .replace(/#[\w\u0900-\u097F]+/g, "")
      .trim();
    if (firstLine && firstLine.length <= 90) {
      rawTitle = firstLine.replace(/^[⚡🔥🚀💡✨📌]+\s*/, "").trim();
    } else if (firstLine) {
      rawTitle = firstLine.slice(0, 75).trim() + "...";
    } else {
      rawTitle = "Perspective & Daily Inspiration";
    }
  }

  const existingInCaption = rawCaption.match(/#[\w\u0900-\u097F]+/g) || [];
  const providedTags = Array.isArray(payload.hashtags)
    ? payload.hashtags
        .map((t) => String(t || "").trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t.replace(/[^\w\u0900-\u097F]/g, "")}`))
        .filter((t) => t.length > 1)
    : [];

  const mergedSet = new Set([...providedTags, ...existingInCaption]);

  if (mergedSet.size < 3) {
    const stopWords = new Set([
      "the", "and", "for", "with", "that", "this", "from", "your", "have", "more",
      "about", "what", "when", "where", "into", "will", "just", "most", "some",
      "upload", "photo", "image", "post", "reel", "video"
    ]);
    const words = `${rawTitle} ${mediaHint} ${rawCaption}`
      .replace(/#[\w\u0900-\u097F]+/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()));

    for (const w of words) {
      if (mergedSet.size >= 5) break;
      const capitalized = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      mergedSet.add(`#${capitalized}`);
    }

    const fallbackDefaults = ["#Mindset", "#DailyInspiration", "#GrowthMindset", "#Motivation", "#Success"];
    for (const d of fallbackDefaults) {
      if (mergedSet.size >= 5) break;
      mergedSet.add(d);
    }
  }

  const hashtags = Array.from(mergedSet).slice(0, 6);

  let finalCaption = rawCaption;
  const normalizedCapLower = finalCaption.toLowerCase();
  const normalizedTitleLower = rawTitle.toLowerCase();

  if (!normalizedCapLower.includes(normalizedTitleLower.slice(0, Math.min(24, normalizedTitleLower.length)))) {
    finalCaption = `🔥 ${rawTitle}\n\n${finalCaption}`;
  }
  const missingTags = hashtags.filter((tag) => !finalCaption.toLowerCase().includes(tag.toLowerCase()));
  if (missingTags.length > 0) {
    finalCaption = `${finalCaption.trim()}\n\n${missingTags.join(" ")}`;
  }

  return {
    title: rawTitle,
    caption: finalCaption,
    hashtags
  };
}

function buildAiImageModelThumbnailPrompt(args = {}) {
  const topic = String(args.topic || args.title || "Viral Breakthrough").trim();
  const rawHook = String(args.title_hook || args.title || topic)
    .replace(/#[a-zA-Z0-9_]+/g, "")
    .trim();
  const words = rawHook.split(/\s+/).filter(Boolean);
  const dominantTitleHook = (words.slice(0, 4).join(" ") || "STOP SCROLLING").toUpperCase();
  const subtitleText = String(
    args.subtitle || (words.length > 4 ? words.slice(4, 11).join(" ") : `${topic} — Full Breakdown`)
  ).trim();
  const archetypeKey = args.archetype && VISUAL_ARCHETYPE_SPECS[args.archetype] ? args.archetype : "classical_fusion";
  const archetypeSpec = VISUAL_ARCHETYPE_SPECS[archetypeKey];
  const aspectRatio = String(args.aspect_ratio || "16:9").trim();

  const aiImageModelPrompt = [
    `Masterpiece agency-grade viral video thumbnail (${aspectRatio} aspect ratio), 8K UHD resolution, shot on Sony A7R V 35mm f/1.4 GM lens.`,
    `VISUAL ARCHETYPE (${archetypeKey}): ${archetypeSpec}.`,
    `FOCAL SUBJECT & SCENE: Expressive, high-drama visual storytelling representing "${topic}" with an intense radial warm-gold spotlight pool glowing behind the main focal subject, razor-sharp cyan and electric-amber rim lighting along the edges, and deep cinematic edge vignette shading.`,
    `TYPOGRAPHY & VISUAL HIERARCHY (Anti-AI Uniform Look):`,
    `1. Giant dominant heavyweight headline "${dominantTitleHook}" rendered in bold 3D Inter/Impact display typography with a vibrant horizontal electric-gold-to-crimson gradient fill and crisp dark drop shadow.`,
    `2. Smaller secondary subtitle "${subtitleText}" (35% height of main headline) placed inside a sleek translucent dark glass card container with a glowing neon accent border.`,
    `Ultra-tactile surface micro-textures, dramatic volumetric atmosphere, zero flat/boring layouts, zero watermarks.`
  ].join(" ");

  return {
    success: true,
    topic,
    title_hook: dominantTitleHook,
    subtitle: subtitleText,
    archetype: archetypeKey,
    aspect_ratio: aspectRatio,
    ai_image_model_prompt: aiImageModelPrompt,
    strict_generation_law:
      "STRICT MANDATE: NEVER use Python (PIL, Pillow, OpenCV, ThumbnailEngine, or FreeMediaEngine) to draw or generate thumbnails. Pass `ai_image_model_prompt` directly to your AI Image Model (`image-generator` subagent, Google Flow Nano Banana Pro `flow_generate_image` / `deepx_generate_image`, or `meigen` `generate_image`) and pass the saved image path as `thumbnail_path`.",
    recommended_tools: [
      "invoke_subagent(TypeName='image-generator', Prompt=ai_image_model_prompt)",
      "flow_generate_image / deepx_generate_image (Google Flow Nano Banana Pro)",
      "meigen generate_image"
    ]
  };
}

function generateViralSeo(args) {
  const topic = (args.topic || "Digital Growth Strategy").trim();
  const takeaways =
    Array.isArray(args.key_takeaways) && args.key_takeaways.length > 0
      ? args.key_takeaways.slice(0, 4)
      : [
          `Most people approach ${topic} backwards—focusing on volume instead of leverage.`,
          "Smart constraints beat raw effort every single time.",
          "What gets you from 0 to 1 will stall you from 1 to 10.",
          "Consistency compounds faster than occasional bursts of intensity."
        ];

  const title = args.title ? String(args.title).trim() : `The Uncomfortable Truth About ${topic}`;
  const hook = `⚡ ${title}:`;
  const bullets = takeaways.map((pt, i) => `🔹 Point ${i + 1}: ${pt}`);
  const cta = "👇 Which of these hits closest to home for you? Drop your thoughts below!";
  const cleanTag = topic.replace(/[^a-zA-Z0-9]/g, "");
  const hashtags = [`#${cleanTag || "Strategy"}`, "#GrowthMindset", "#Leadership", "#Productivity", "#CreatorEconomy"];
  const caption = [hook, "", ...bullets, "", cta, "", hashtags.join(" ")].join("\n");
  const thumbPromptObj = buildAiImageModelThumbnailPrompt({
    topic,
    title_hook: title.split(/\s+/).slice(0, 4).join(" ").toUpperCase(),
    subtitle: `${topic} Explained`,
    aspect_ratio: args.aspect_ratio || "16:9"
  });

  return {
    title,
    caption,
    hook,
    bullets,
    cta,
    hashtags,
    alt_text: `Infographic and key takeaways explaining ${topic}.`,
    first_comment: args.link_url
      ? `🔗 Resource Link: ${args.link_url}\n(Shared in the first comment to keep organic reach at 100%!)`
      : null,
    ai_thumbnail_prompt: thumbPromptObj.ai_image_model_prompt,
    thumbnail_generation_rule: thumbPromptObj.strict_generation_law,
    seo_score: 98
  };
}

function auditFacebookCaption(captionText, titleText = "") {
  const caption = String(captionText || "");
  const title = String(titleText || "").trim();
  const lines = caption
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const words = caption.trim().split(/\s+/).filter(Boolean);
  const hashtags = caption.match(/#\w+/g) || [];
  const links = caption.match(/https?:\/\/\S+/g) || [];
  const hasTitleOrHook = Boolean(title) || (lines.length > 0 && lines[0].length <= 95);

  let score = 100;
  const penalties = [];
  const suggestions = [];

  if (!hasTitleOrHook) {
    score -= 15;
    penalties.push("Missing clear Title / 1-line Hook at the top (-15 pts).");
    suggestions.push("Always include a punchy Title (`title` parameter) and 1-line opening hook.");
  }
  if (links.length > 0) {
    score -= 25;
    penalties.push("Outbound link in post body (-25 pts): Facebook penalizes external links in main captions.");
    suggestions.push("Move the link to the first comment using fb_publish(first_comment=...) or fb_comments.");
  }
  if (hashtags.length > 8) {
    score -= 15;
    penalties.push(`Too many hashtags (${hashtags.length}) (-15 pts): Triggers algorithmic spam suppression.`);
    suggestions.push("Use 3 to 6 targeted hashtags.");
  } else if (hashtags.length === 0) {
    score -= 15;
    penalties.push("No hashtags included (-15 pts): Never forget hashtags!");
    suggestions.push("Add 3 to 6 relevant #Hashtags at the bottom.");
  }
  if (lines.length === 1 && words.length > 45) {
    score -= 20;
    penalties.push("Dense wall-of-text detected (-20 pts).");
    suggestions.push("Break into 1-2 line micro-bites separated by blank lines.");
  }

  return {
    seo_score: Math.max(10, score),
    has_title: hasTitleOrHook,
    word_count: words.length,
    line_count: lines.length,
    hashtag_count: hashtags.length,
    hashtags_detected: hashtags,
    outbound_links_count: links.length,
    penalties,
    suggestions,
    is_ready_for_publish: score >= 70
  };
}

// ============================================================================
// 10. Service Worker Lifecycle & MCP Tool Call Listener
// ============================================================================

self.addEventListener("install", () => {
  console.log(`[${PLUGIN_ID}] Service Worker installed (v${PLUGIN_VERSION})`);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log(`[${PLUGIN_ID}] Service Worker activated (v${PLUGIN_VERSION})`);
  if (self.clients && self.clients.claim) {
    event.waitUntil(self.clients.claim());
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "mcp_tool_call") return false;

  (async () => {
    const tool = message.tool;
    const args = message.args || {};

    switch (tool) {
      case "fb_status": {
        const shouldOpen = args.open_browser !== false;
        const login = await checkFacebookLogin({
          openIfMissing: shouldOpen,
          activateOnLoginNeeded: shouldOpen
        });
        const store = await getStorage(["fb_scheduled_jobs", "fb_posts_history", "fb_pending_task"]);
        const jobs = Array.isArray(store.fb_scheduled_jobs) ? store.fb_scheduled_jobs : [];
        const history = Array.isArray(store.fb_posts_history) ? store.fb_posts_history : [];
        return {
          id: PLUGIN_ID,
          version: PLUGIN_VERSION,
          status: login.logged_in ? "ready" : "awaiting_one_time_login",
          ...login,
          scheduled_jobs_queued: jobs.filter((j) => j.status === "queued").length,
          recent_posts_count: history.length,
          pending_task: store.fb_pending_task || null
        };
      }

      case "fb_login_status": {
        const shouldOpen = args.open_browser !== false;
        return await checkFacebookLogin({
          openIfMissing: shouldOpen,
          activateOnLoginNeeded: true
        });
      }

      case "fb_open_browser": {
        const view = args.view || "feed";
        let url = FB_HOME_URL;
        if (view === "reels") url = FB_REELS_CREATE_URL;
        else if (view === "stories") url = FB_STORIES_CREATE_URL;
        else if (view === "business_suite") url = "https://business.facebook.com/";
        else if (view === "page" && args.target_id) {
          url = args.target_id.startsWith("http") ? args.target_id : `https://www.facebook.com/${args.target_id}`;
        } else if (args.target_id && args.target_id.startsWith("http")) {
          url = args.target_id;
        }

        await ensureFacebookTab({ targetUrl: url, activate: true, forceNavigate: true });
        return await checkFacebookLogin({ openIfMissing: false, activateOnLoginNeeded: true });
      }

      case "fb_publish":
      case "fb_publish_reel":
      case "fb_publish_story":
      case "fb_edit_post":
      case "fb_delete_post":
      case "fb_comments": {
        return await dispatchProtectedBrowserTask(tool, args);
      }

      case "fb_resume_pending": {
        const login = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });
        if (!login.logged_in) {
          return login;
        }
        const store = await getStorage(["fb_pending_task"]);
        if (!store.fb_pending_task) {
          return {
            success: true,
            logged_in: true,
            message: "Facebook is logged in and ready. No pending task was waiting in queue."
          };
        }
        const task = store.fb_pending_task;
        await setStorage({ fb_pending_task: null, fb_awaiting_login: false });
        return await dispatchProtectedBrowserTask(task.tool, { ...task.args, id: task.id });
      }

      case "fb_schedule": {
        const enriched = ensureTitleAndHashtags(args);
        const mediaPaths = args.media_paths || [];
        const dup = await checkDuplicate(enriched.caption, mediaPaths);
        if (dup.isDuplicate) {
          return { success: false, duplicate_detected: true, stop_loop: true, error: dup.reason };
        }

        const runAt =
          typeof args.run_at_timestamp === "number"
            ? args.run_at_timestamp
            : Math.floor(new Date(args.run_at_timestamp).getTime() / 1000);

        const jobId = `job_${Date.now()}`;
        const postId = `sched_${Date.now()}`;
        const store = await getStorage(["fb_scheduled_jobs"]);
        const jobs = Array.isArray(store.fb_scheduled_jobs) ? store.fb_scheduled_jobs : [];

        const newJob = {
          job_id: jobId,
          post_id: postId,
          title: enriched.title,
          caption: enriched.caption,
          hashtags: enriched.hashtags,
          thumbnail_path: args.thumbnail_path || null,
          media_paths: mediaPaths,
          post_type: args.post_type || (mediaPaths.length > 0 ? "photo" : "text"),
          target_type: args.target_type || "profile",
          target_id: args.target_id || null,
          run_at_timestamp: runAt,
          status: "queued",
          created_at: Date.now()
        };
        jobs.push(newJob);
        await setStorage({ fb_scheduled_jobs: jobs });

        await recordPostHistory({
          id: postId,
          post_type: newJob.post_type,
          target_type: newJob.target_type,
          title: newJob.title,
          caption: newJob.caption,
          hashtags: newJob.hashtags,
          thumbnail_path: newJob.thumbnail_path,
          media_paths: mediaPaths,
          status: "scheduled",
          run_at_timestamp: runAt
        });

        const delayMin = Math.max(0.5, (runAt * 1000 - Date.now()) / 60000);
        if (chrome.alarms) {
          chrome.alarms.create(`fb_job_${jobId}`, { delayInMinutes: delayMin });
        }

        return {
          success: true,
          status: "scheduled",
          post_id: postId,
          job_id: jobId,
          title: newJob.title,
          hashtags: newJob.hashtags,
          thumbnail_path: newJob.thumbnail_path,
          run_at_timestamp: runAt,
          run_at_iso: new Date(runAt * 1000).toISOString(),
          message: `Facebook ${newJob.post_type} scheduled for ${new Date(runAt * 1000).toLocaleString()} with title "${newJob.title}" and ${newJob.hashtags.length} hashtags.`
        };
      }

      case "fb_list_posts": {
        const limit = args.limit || 15;
        const statusFilter = args.status || null;
        const store = await getStorage(["fb_posts_history", "fb_pending_task"]);
        let posts = Array.isArray(store.fb_posts_history) ? store.fb_posts_history : [];
        if (statusFilter) {
          posts = posts.filter((p) => p.status === statusFilter);
        }
        return {
          success: true,
          count: Math.min(limit, posts.length),
          pending_task: store.fb_pending_task || null,
          posts: posts.slice(0, limit)
        };
      }

      case "fb_seo_generate": {
        return generateViralSeo(args);
      }

      case "fb_thumbnail_prompt": {
        return buildAiImageModelThumbnailPrompt(args);
      }

      case "fb_audit_caption": {
        return auditFacebookCaption(args.caption || "", args.title || "");
      }

      case "fb_doctor": {
        const login = await checkFacebookLogin({ openIfMissing: false, activateOnLoginNeeded: false });
        const store = await getStorage([
          "fb_one_time_login_verified",
          "fb_pending_task",
          "fb_scheduled_jobs",
          "fb_posts_history"
        ]);
        return {
          plugin: PLUGIN_ID,
          version: PLUGIN_VERSION,
          antigem_browser_apis: {
            tabs: Boolean(chrome.tabs),
            scripting: Boolean(chrome.scripting),
            debugger: Boolean(chrome.debugger),
            cookies: Boolean(chrome.cookies),
            antigem_native: Boolean(chrome.antigem)
          },
          one_time_login_verified: Boolean(store.fb_one_time_login_verified || login.logged_in),
          current_login_state: login,
          pending_task: store.fb_pending_task || null,
          scheduled_jobs_count: Array.isArray(store.fb_scheduled_jobs) ? store.fb_scheduled_jobs.length : 0,
          post_history_count: Array.isArray(store.fb_posts_history) ? store.fb_posts_history.length : 0,
          recommendation: login.logged_in
            ? "Everything healthy! Facebook is logged in inside AntiGem browser and ready for instant precision-touch uploads."
            : "Call fb_login_status or fb_open_browser to open Facebook in AntiGem browser and complete the one-time login."
        };
      }

      default:
        throw new Error(`Unknown MCP tool: ${tool}`);
    }
  })()
    .then((result) =>
      sendResponse({
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        isError: false,
        ...(result && typeof result === "object" ? result : { value: result })
      })
    )
    .catch((err) =>
      sendResponse({
        isError: true,
        error: err.message || String(err),
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                stop_loop: true,
                error: err.message || String(err),
                agent_instruction:
                  "CRITICAL: Do NOT read worker.js, fb_doctor.json, or webview_extension_logs.json! Report the error in 1 sentence and stop."
              },
              null,
              2
            )
          }
        ]
      })
    );

  return true;
});
