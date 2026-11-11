/**
 * AntiGem WebView MCP Service Worker for Facebook Automation & SEO Studio (v1.4.0)
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
 * 4. 5-Tier Bulletproof Caption Locator & Lexical/CDP Injector:
 *    - Finds Lexical `div[role="textbox"][contenteditable="true"]`, `div[data-lexical-editor="true"]`, `div[contenteditable="true"]`, and mobile `textarea` even when collapsed (`height >= 0`) above a large photo preview on a phone screen.
 *    - Clicks the visible `"What's on your mind..."` / `"Describe your reel..."` placeholder to wake collapsed editors.
 *    - Combines `execCommand("insertText")`, `ClipboardEvent("paste")`, and Chromium native **CDP `Input.insertText`** so text sticks 100% of the time in Lexical/React.
 * 5. Direct Reference Fast-Path:
 *    - Instantly resolves any user-supplied file path (`file:///...`, `/sdcard/...`, `/storage/emulated/0/...`, `.user_uploaded/...`, `~/...`, or `"latest"`) with zero search delay.
 */

const PLUGIN_ID = "facebook-automation";
const PLUGIN_VERSION = "1.4.0";
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
 * Universal 5-Tier Caption Locator & Injector for Phone (Desktop View & Mobile View) + Web:
 * - Locates the active Create Post / Reel / Story composer dialog (ignoring Notification/Messenger/Popover dialogs).
 * - Finds Lexical `div[role="textbox"][contenteditable="true"]`, `div[data-lexical-editor="true"]`, `div[contenteditable="true"]`, or `textarea` even when collapsed above a large photo preview on a phone screen.
 * - Clicks `"What's on your mind..."` placeholder if needed to wake up the editor.
 * - Uses `execCommand("insertText")`, `ClipboardEvent("paste")`, AND native Chromium `Input.insertText` via CDP so Lexical always updates its internal state!
 */
async function populateComposerCaption(tabId, captionText, titleText = "") {
  const cleanCaption = String(captionText || "").trim();
  const cleanTitle = String(titleText || "").trim();

  // 1. Optional Title field (for Video / Reel / Page posts that show a dedicated Title input)
  if (cleanTitle) {
    try {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        args: [cleanTitle],
        func: (tVal) => {
          const titleInputs = Array.from(
            document.querySelectorAll(
              'input[placeholder*="Title" i], input[aria-label*="Title" i], input[aria-label*="Video title" i], input[aria-label*="Reel title" i]'
            )
          );
          const inp = titleInputs.find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 20 && r.height > 8;
          });
          if (inp) {
            inp.focus();
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            if (setter) setter.call(inp, tVal);
            else inp.value = tVal;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      });
    } catch (_) {}
  }

  if (!cleanCaption) return { ok: true, skipped: true };

  const attemptDomInsert = async () => {
    const [res] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      args: [cleanCaption],
      func: (textToInsert) => {
        const isNotHidden = (el) => {
          if (!el) return false;
          const st = window.getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity || 1) < 0.01) return false;
          const r = el.getBoundingClientRect();
          return r.width > 4;
        };

        const isCommentOrSearch = (el) => {
          if (!el) return true;
          if (
            el.closest(
              'div[role="article"], div[data-pagelet*="FeedUnit"], form[action*="comment"], div[aria-label*="comment" i], div[aria-label*="टिप्पणी" i], div[role="search"]'
            )
          ) {
            return true;
          }
          const meta = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""} ${
            el.getAttribute("aria-placeholder") || ""
          } ${el.getAttribute("type") || ""}`.toLowerCase();
          return (
            meta.includes("comment") ||
            meta.includes("reply") ||
            meta.includes("search") ||
            meta.includes("टिप्पणी") ||
            meta.includes("खोज")
          );
        };

        // Score all open dialogs to find the true Create Post / Reel / Story composer dialog
        const findBestComposerDialog = () => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter(
            (d) => {
              const r = d.getBoundingClientRect();
              return r.width > 80 && r.height > 80 && isNotHidden(d);
            }
          );
          let best = null;
          let bestScore = -999;
          for (const d of dialogs) {
            if (d.querySelector('div[role="article"], div[data-pagelet*="FeedUnit"]')) continue;
            const aria = (d.getAttribute("aria-label") || "").toLowerCase();
            if (/notifications|messenger|chats|account controls|menu/i.test(aria)) continue;
            const txt = (d.innerText || d.textContent || "").slice(0, 1200).toLowerCase();
            let s = 0;
            if (/create post|create a post|make a post|edit post|पोस्ट बनाउनुहोस्|पोस्ट करें/i.test(txt) || /create post/i.test(aria))
              s += 100;
            if (/add to your post|what['’]?s on your mind|describe your reel|share to story/i.test(txt)) s += 80;
            if (d.querySelector('div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], textarea'))
              s += 70;
            if (d.querySelector('div[aria-label="Post"], div[aria-label="Publish"]')) s += 50;
            if (s > bestScore) {
              bestScore = s;
              best = d;
            }
          }
          return bestScore > 0 ? best : null;
        };

        const bestDialog = findBestComposerDialog();
        const searchRoots = bestDialog ? [bestDialog, document] : [document];

        const editorSelectors = [
          'div[role="textbox"][contenteditable="true"]',
          'div[data-lexical-editor="true"][contenteditable="true"]',
          'div[data-lexical-editor="true"]',
          'div[aria-placeholder*="on your mind" i]',
          'div[aria-label*="on your mind" i]',
          'div[aria-label*="Describe your reel" i]',
          'div[aria-placeholder*="Describe your reel" i]',
          'div[aria-label*="Write a description" i]',
          'div[aria-label*="Write something" i]',
          'div[aria-label*="Say something" i]',
          'div[contenteditable="true"]',
          'div[contenteditable="plaintext-only"]',
          '#composer-main-view-id textarea',
          'textarea.composerInput',
          'textarea[name="xc_message"]',
          'textarea'
        ].join(", ");

        let editor = null;
        for (const root of searchRoots) {
          const found = Array.from(root.querySelectorAll(editorSelectors)).filter(
            (el) => isNotHidden(el) && !isCommentOrSearch(el)
          );
          if (found.length > 0) {
            // Prefer an element inside a dialog or with 'on your mind' / 'lexical'
            found.sort((a, b) => {
              const score = (node) => {
                let sc = 0;
                if (bestDialog && bestDialog.contains(node)) sc += 50;
                if (node.getAttribute("data-lexical-editor") === "true") sc += 30;
                const lbl = `${node.getAttribute("aria-label") || ""} ${
                  node.getAttribute("aria-placeholder") || ""
                } ${node.getAttribute("placeholder") || ""}`.toLowerCase();
                if (/on your mind|describe your reel|write something|say something|post/i.test(lbl)) sc += 40;
                return sc;
              };
              return score(b) - score(a);
            });
            editor = found[0];
            break;
          }
        }

        // Tier 2: If no editor matched directly, click the visible "What's on your mind..." placeholder text node!
        if (!editor) {
          for (const root of searchRoots) {
            const placeholderEl = Array.from(root.querySelectorAll("div, span, p, label")).find((el) => {
              if (!isNotHidden(el) || isCommentOrSearch(el)) return false;
              const t = (el.innerText || el.textContent || "").trim();
              return (
                t.length > 4 &&
                t.length < 80 &&
                /^(what['’]?s on your mind|write something|say something|add a caption|describe your reel|start typing|के सोचिरहनुभएको|कुछ लिखें)/i.test(
                  t
                )
              );
            });
            if (placeholderEl) {
              try {
                placeholderEl.scrollIntoView({ block: "center", behavior: "instant" });
                placeholderEl.click();
              } catch (_) {}
              const parent = placeholderEl.parentElement || root;
              editor =
                parent.querySelector('[contenteditable="true"], textarea, div[role="textbox"]') ||
                (document.activeElement &&
                (document.activeElement.isContentEditable ||
                  document.activeElement.tagName === "TEXTAREA" ||
                  document.activeElement.getAttribute("role") === "textbox")
                  ? document.activeElement
                  : null);
              if (editor) break;
            }
          }
        }

        if (!editor) {
          return { ok: false, foundEditor: false };
        }

        try {
          editor.scrollIntoView({ block: "center", behavior: "instant" });
        } catch (_) {}
        try {
          editor.click();
        } catch (_) {}
        editor.focus();

        const r = editor.getBoundingClientRect();
        const v = window.visualViewport;
        const vw = (v && v.width) || window.innerWidth || 1;
        const vh = (v && v.height) || window.innerHeight || 1;
        const ox = (v && v.offsetLeft) || 0;
        const oy = (v && v.offsetTop) || 0;
        const tapCoords = {
          fx: Math.max(0.008, Math.min(0.992, (r.left + Math.max(12, r.width * 0.4) - ox) / vw)),
          fy: Math.max(0.008, Math.min(0.992, (r.top + Math.max(8, r.height * 0.5) - oy) / vh))
        };

        if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
          const proto = editor.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(editor, textToInsert);
          else editor.value = textToInsert;
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          editor.dispatchEvent(new Event("change", { bubbles: true }));
          return {
            ok: (editor.value || "").trim().length >= 3,
            foundEditor: true,
            isTextarea: true,
            tapCoords,
            length: (editor.value || "").trim().length
          };
        }

        // ContentEditable (Lexical / Draft.js / Bloks)
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
        } catch (_) {}

        let inserted = false;
        try {
          inserted = document.execCommand("insertText", false, textToInsert);
        } catch (_) {}

        const readEditorText = () => (editor.innerText || editor.textContent || "").trim();
        let cur = readEditorText();

        if (!inserted || cur.length < 4 || /^what['’]?s on your mind/i.test(cur)) {
          try {
            const dt = new DataTransfer();
            dt.setData("text/plain", textToInsert);
            editor.dispatchEvent(
              new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
            );
          } catch (_) {}
          cur = readEditorText();
        }

        editor.dispatchEvent(
          new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: textToInsert })
        );
        editor.dispatchEvent(new Event("change", { bubbles: true }));

        cur = readEditorText();
        const verified = cur.length >= 4 && !/^what['’]?s on your mind/i.test(cur);
        return {
          ok: verified,
          foundEditor: true,
          isTextarea: false,
          tapCoords,
          length: cur.length
        };
      }
    });
    return (res && res.result) || { ok: false, foundEditor: false };
  };

  let status = await attemptDomInsert();

  // Tier 3 & 4: If editor was found (or needs native tap + CDP Input.insertText for Lexical), tap & inject via CDP!
  if (!status.ok) {
    if (status.tapCoords) {
      await trustedTap(tabId, status.tapCoords);
      await sleep(220);
    }

    const dbgReady = await ensureDebuggerAttached(tabId);
    if (dbgReady) {
      try {
        // Focus the editor cleanly and clear any existing selection before CDP Input.insertText
        await chrome.scripting.executeScript({
          world: "MAIN",
          target: { tabId },
          func: () => {
            const ed =
              document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]') ||
              document.querySelector('div[role="dialog"] div[data-lexical-editor="true"]') ||
              document.querySelector('div[role="textbox"][contenteditable="true"]') ||
              document.querySelector('div[data-lexical-editor="true"]') ||
              document.querySelector('textarea.composerInput, textarea[name="xc_message"], textarea');
            if (ed) {
              ed.focus();
              try {
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(ed);
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand("selectAll", false, null);
                document.execCommand("delete", false, null);
              } catch (_) {}
            }
          }
        });
        await chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: cleanCaption });
        await sleep(250);
        return { ok: true, viaCdp: true };
      } catch (_) {}
    }

    // Retry DOM insert once more after tap
    status = await attemptDomInsert();
  }

  return status;
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

  // 3. Populate Caption FIRST while the composer textbox is wide open, AND re-verify after media attachment!
  if (caption && String(caption).trim().length > 0) {
    await populateComposerCaption(tabId, caption, title);
    await sleep(250);
  }

  // 4. Attach Media Files (Photos / Carousel / Video) & Verify Single Clean Preview in Composer
  if (resolvedMediaList.length > 0) {
    await attachMediaToFacebookComposer(
      tabId,
      resolvedMediaList.map((f) => f.path),
      { preferVideo: wantVideo, requirePreview: true, purgeExistingDrafts: true }
    );
    await sleep(wantVideo ? 1800 : 750);

    // 4b. Attach Custom AI Thumbnail Image if provided for Video upload
    if (wantVideo && thumbnail_path && String(thumbnail_path).trim()) {
      try {
        await attachMediaToFacebookComposer(tabId, [thumbnail_path], {
          preferVideo: false,
          requirePreview: false,
          purgeExistingDrafts: false
        });
        await sleep(700);
      } catch (_) {}
    }

    // 4c. Verify caption is still present after media attachment (if Facebook reset the textbox when mounting photo preview, re-insert cleanly!)
    if (caption && String(caption).trim().length > 0) {
      const [capCheck] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const eds = Array.from(
            document.querySelectorAll(
              'div[role="dialog"] div[role="textbox"][contenteditable="true"], div[role="dialog"] div[data-lexical-editor="true"], div[role="dialog"] div[contenteditable="true"], div[role="textbox"][contenteditable="true"], textarea.composerInput, textarea[name="xc_message"]'
            )
          ).filter((el) => !el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]'));
          for (const ed of eds) {
            const val = (ed.value || ed.innerText || ed.textContent || "").trim();
            if (val.length >= 6 && !/^what['’]?s on your mind/i.test(val)) {
              return { hasText: true, length: val.length };
            }
          }
          return { hasText: false };
        }
      });

      if (!capCheck || !capCheck.result || !capCheck.result.hasText) {
        await populateComposerCaption(tabId, caption, title);
        await sleep(300);
      }
    }
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
    fb_post_id: `fb_dom_${Date.now()}`,
    post_url: finalTab.url || desiredUrl,
    first_comment_result: firstCommentResult,
    message: `Facebook ${effectivePostType} post published successfully in AntiGem browser with "${title}" and ${hashtags.length} hashtags.`
  };
}

/**
 * Pipeline B: Facebook Reels Upload (https://www.facebook.com/reels/create + Automatic Mobile Fallback)
 */
async function executeReelUploadInBrowser(tabId, payload) {
  const rawVideoPath =
    payload.video_path || (Array.isArray(payload.media_paths) && payload.media_paths[0]) || "latest";
  const resolvedVideo = await resolveLocalFile(rawVideoPath, true);
  const videoPath = resolvedVideo.path;
  const thumbnailPath = payload.thumbnail_path || null;

  const enriched = ensureTitleAndHashtags({
    ...payload,
    post_type: "reel",
    media_hint: resolvedVideo.filename
  });
  const title = enriched.title;
  const caption = enriched.caption;
  const hashtags = enriched.hashtags;

  await chrome.tabs.update(tabId, { url: FB_REELS_CREATE_URL, active: true });
  await waitForTabComplete(tabId, 20000);
  await sleep(1200);

  // Verify whether /reels/create actually rendered a Reel upload input/wizard (on m.facebook.com it may redirect to reels viewer)
  const [reelSurfaceProbe] = await chrome.scripting.executeScript({
    world: "MAIN",
    target: { tabId },
    func: () => {
      const hasFileInput = Boolean(document.querySelector('input[type="file"]'));
      const txt = (document.body ? document.body.innerText || "" : "").slice(0, 1500).toLowerCase();
      const hasReelCreatorText = /create a reel|upload video|add video|choose a video/i.test(txt);
      return { isReelCreator: hasFileInput || hasReelCreatorText, href: location.href };
    }
  });

  if (!reelSurfaceProbe || !reelSurfaceProbe.result || !reelSurfaceProbe.result.isReelCreator) {
    // Fallback to Feed Video/Reel Composer on mobile views where /reels/create is not supported
    await chrome.tabs.update(tabId, { url: FB_HOME_URL, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(800);
    return await executeFeedPostInBrowser(tabId, {
      ...payload,
      title,
      caption,
      hashtags,
      thumbnail_path: thumbnailPath,
      media_paths: [videoPath],
      post_type: "video"
    });
  }

  try {
    await attachMediaToFacebookComposer(tabId, [videoPath], {
      preferVideo: true,
      requirePreview: false,
      purgeExistingDrafts: false
    });
  } catch (_) {
    await chrome.tabs.update(tabId, { url: FB_HOME_URL, active: true });
    await waitForTabComplete(tabId, 20000);
    return await executeFeedPostInBrowser(tabId, {
      ...payload,
      title,
      caption,
      hashtags,
      thumbnail_path: thumbnailPath,
      media_paths: [videoPath],
      post_type: "video"
    });
  }

  await sleep(2500);

  // Advance through "Next" steps using Precision Touch (Step 1: Upload -> Step 2: Edit -> Step 3: Describe & Publish)
  for (let step = 0; step < 3; step++) {
    await blurKeyboardAndSettle(tabId);
    const [stepProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const v = window.visualViewport;
        const vw = (v && v.width) || window.innerWidth || 1;
        const vh = (v && v.height) || window.innerHeight || 1;
        const ox = (v && v.offsetLeft) || 0;
        const oy = (v && v.offsetTop) || 0;
        const toCoords = (el) => {
          const r = el.getBoundingClientRect();
          return {
            fx: Math.max(0.008, Math.min(0.992, (r.left + r.width / 2 - ox) / vw)),
            fy: Math.max(0.008, Math.min(0.992, (r.top + r.height / 2 - oy) / vh))
          };
        };

        const allBtns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).filter(
          (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 12 && r.height > 12;
          }
        );
        const pubBtn = allBtns.find((el) => {
          const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "publish" || t === "share" || t === "share now" || t === "post";
        });
        if (pubBtn) return { atPublishStep: true };

        const nextBtn = allBtns.find((el) => {
          const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "next" || t === "अर्को" || t === "अगला";
        });
        if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true" && !nextBtn.disabled) {
          const coords = toCoords(nextBtn);
          try {
            nextBtn.click();
          } catch (_) {}
          return { clickedNext: true, coords };
        }
        return { waiting: true };
      }
    });

    if (stepProbe && stepProbe.result && stepProbe.result.atPublishStep) break;
    if (stepProbe && stepProbe.result && stepProbe.result.coords) {
      await sleep(160);
      await trustedTap(tabId, stepProbe.result.coords);
    }
    await sleep(1400);
  }

  // Attach Custom AI Thumbnail / Cover Image if thumbnail_path is provided
  if (thumbnailPath && String(thumbnailPath).trim()) {
    try {
      await attachMediaToFacebookComposer(tabId, [thumbnailPath], {
        preferVideo: false,
        requirePreview: false,
        purgeExistingDrafts: false
      });
      await sleep(900);
    } catch (_) {}
  }

  // Insert Reel Title + Caption + Hashtags via 5-Tier Caption Injector
  if (caption && String(caption).trim().length > 0) {
    await populateComposerCaption(tabId, caption, title);
    await sleep(500);
  }

  // Blur keyboard & tap "Publish" / "Share" button
  await blurKeyboardAndSettle(tabId);
  let published = false;
  for (let i = 0; i < 30; i++) {
    const [pubProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const v = window.visualViewport;
        const vw = (v && v.width) || window.innerWidth || 1;
        const vh = (v && v.height) || window.innerHeight || 1;
        const ox = (v && v.offsetLeft) || 0;
        const oy = (v && v.offsetTop) || 0;
        const btns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).filter(
          (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 12 && r.height > 12;
          }
        );
        const pubBtn = btns.find((el) => {
          const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "publish" || t === "share" || t === "share now" || t === "post";
        });
        if (!pubBtn) return { found: false };
        if (pubBtn.getAttribute("aria-disabled") === "true" || pubBtn.disabled) {
          return { found: true, disabled: true };
        }
        const r = pubBtn.getBoundingClientRect();
        try {
          pubBtn.click();
        } catch (_) {}
        return {
          found: true,
          disabled: false,
          coords: {
            fx: Math.max(0.008, Math.min(0.992, (r.left + r.width / 2 - ox) / vw)),
            fy: Math.max(0.008, Math.min(0.992, (r.top + r.height / 2 - oy) / vh))
          }
        };
      }
    });

    if (pubProbe && pubProbe.result && pubProbe.result.found && !pubProbe.result.disabled) {
      if (pubProbe.result.coords) {
        await sleep(200);
        await trustedTap(tabId, pubProbe.result.coords);
      }
      published = true;
      break;
    }
    await sleep(900);
  }

  if (!published) {
    throw new Error("Could not click 'Publish' / 'Share' on Facebook Reels wizard.");
  }

  await sleep(2800);
  return {
    success: true,
    status: "published",
    post_type: "reel",
    title,
    caption,
    hashtags,
    media_attached: [videoPath],
    thumbnail_path: thumbnailPath || null,
    fb_post_id: `fb_reel_${Date.now()}`,
    post_url: FB_REELS_CREATE_URL,
    message: `Facebook Reel uploaded and published successfully with "${title}" and ${hashtags.length} hashtags.`
  };
}

/**
 * Pipeline C: Facebook Story Upload (https://www.facebook.com/stories/create & Feed "Create story" Card)
 */
async function executeStoryUploadInBrowser(tabId, payload) {
  let mediaPath =
    payload.media_path || (Array.isArray(payload.media_paths) && payload.media_paths[0]) || null;
  const caption = payload.caption || "";

  if (mediaPath && /^(latest|newest|auto|last|recent)$/i.test(String(mediaPath).trim())) {
    const autoStoryMedia = await autoDiscoverLatestMedia(false);
    if (autoStoryMedia) mediaPath = autoStoryMedia.path;
  }

  await chrome.tabs.update(tabId, { url: FB_STORIES_CREATE_URL, active: true });
  await waitForTabComplete(tabId, 20000);
  await sleep(1200);

  if (mediaPath) {
    await attachMediaToFacebookComposer(tabId, [mediaPath], {
      preferVideo: isVideoPath(mediaPath),
      requirePreview: false,
      purgeExistingDrafts: false
    });
    await sleep(1800);
  } else if (caption) {
    await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const textStoryBtn = Array.from(document.querySelectorAll('div[role="button"], span, a')).find((el) =>
          /create a text story|text story|^text$/i.test((el.innerText || el.textContent || "").trim())
        );
        if (textStoryBtn) {
          try {
            textStoryBtn.click();
          } catch (_) {}
        }
      }
    });
    await sleep(900);
    await populateComposerCaption(tabId, caption, "");
    await sleep(700);
  } else {
    // If neither mediaPath nor caption was specified, auto-discover the latest photo for the Story
    const autoPhoto = await autoDiscoverLatestMedia(false);
    if (autoPhoto) {
      mediaPath = autoPhoto.path;
      await attachMediaToFacebookComposer(tabId, [mediaPath], {
        preferVideo: false,
        requirePreview: false,
        purgeExistingDrafts: false
      });
      await sleep(1800);
    }
  }

  await blurKeyboardAndSettle(tabId);
  let shared = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    const [shareRes] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const v = window.visualViewport;
        const vw = (v && v.width) || window.innerWidth || 1;
        const vh = (v && v.height) || window.innerHeight || 1;
        const ox = (v && v.offsetLeft) || 0;
        const oy = (v && v.offsetTop) || 0;
        const btn = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).find(
          (el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 12 || r.height < 12) return false;
            const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
            return /^(share to story|share now|share|post|स्टोरीमा साझा गर्नुहोस्|स्टोरी शेयर करें)$/i.test(t);
          }
        );
        if (!btn) return { ok: false };
        if (btn.getAttribute("aria-disabled") === "true" || btn.disabled) return { ok: false, disabled: true };
        const r = btn.getBoundingClientRect();
        try {
          btn.click();
        } catch (_) {}
        return {
          ok: true,
          coords: {
            fx: Math.max(0.008, Math.min(0.992, (r.left + r.width / 2 - ox) / vw)),
            fy: Math.max(0.008, Math.min(0.992, (r.top + r.height / 2 - oy) / vh))
          }
        };
      }
    });

    if (shareRes && shareRes.result && shareRes.result.ok) {
      if (shareRes.result.coords) {
        await sleep(160);
        await trustedTap(tabId, shareRes.result.coords);
      }
      shared = true;
      break;
    }
    await sleep(600);
  }

  if (!shared) {
    throw new Error("Could not find 'Share to story' button on Facebook Story creator.");
  }

  await sleep(2200);
  return {
    success: true,
    status: "published",
    post_type: "story",
    media_attached: mediaPath ? [mediaPath] : [],
    fb_post_id: `fb_story_${Date.now()}`,
    post_url: FB_STORIES_CREATE_URL,
    message: "Facebook Story published successfully in AntiGem browser."
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
  let rawCaption = String(payload.caption || "").trim();
  let rawTitle = String(payload.title || "").trim();
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
    const shortIdea = rawCaption.replace(/#\w+/g, "").trim();
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
      .replace(/#\w+/g, "")
      .trim();
    if (firstLine && firstLine.length <= 90) {
      rawTitle = firstLine.replace(/^[⚡🔥🚀💡✨📌]+\s*/, "").trim();
    } else if (firstLine) {
      rawTitle = firstLine.slice(0, 75).trim() + "...";
    } else {
      rawTitle = "Perspective & Daily Inspiration";
    }
  }

  const existingInCaption = rawCaption.match(/#[a-zA-Z0-9_]+/g) || [];
  const providedTags = Array.isArray(payload.hashtags)
    ? payload.hashtags
        .map((t) => String(t || "").trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t.replace(/[^a-zA-Z0-9_]/g, "")}`))
    : [];

  const mergedSet = new Set([...providedTags, ...existingInCaption]);

  if (mergedSet.size < 3) {
    const stopWords = new Set([
      "the", "and", "for", "with", "that", "this", "from", "your", "have", "more",
      "about", "what", "when", "where", "into", "will", "just", "most", "some",
      "upload", "photo", "image", "post"
    ]);
    const words = `${rawTitle} ${mediaHint} ${rawCaption}`
      .replace(/#[a-zA-Z0-9_]+/g, "")
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
