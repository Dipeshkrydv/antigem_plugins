/**
 * AntiGem WebView MCP Service Worker for Meta Suite Page Management (v2.9.1)
 * Built on the Facebook Automation precision engine + Meta Suite layer (managed Page routing,
 * queue manager, viral SEO, algorithm audit, trend radar, DeepX Google Flow media).
 *
 * Facebook engine notes (v1.5.0):
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

// ---- Built-in DeepX Google Flow engine (AI thumbnails / post designs / videos) ----
// deepx-bundle.js is generated from deepx-google-flow (tools/build_classic_bundle.py).
importScripts("deepx-bundle.js");
importScripts("meta-bs.js");
const DEEPX = self.DeepXFlow;
DEEPX.configureDeepX({ pluginId: "meta-suite-automation", version: "2.7.1" });
const DEEPX_TOOLS = new Set(["deepx_generate", "deepx_job_status", "deepx_check_login", "deepx_status", "deepx_cancel_job", "deepx_get_options", "deepx_flow_agent_status", "deepx_flow_agent_toggle", "deepx_flow_agent_configure", "deepx_flow_agent_set_instructions", "deepx_flow_agent_approve_all", "deepx_flow_agent_batch_queue", "deepx_upscale_media", "deepx_download_media", "deepx_upload_asset", "flow_get_last_media", "flow_get_media", "flow_list_media"]);

const PLUGIN_ID = "meta-suite-automation";
const PLUGIN_VERSION = "2.9.3";
const FB_HOME_URL = "https://www.facebook.com/";
const FB_REELS_CREATE_URL = "https://www.facebook.com/reels/create";
const FB_STORIES_CREATE_URL = "https://www.facebook.com/stories/create";
const DEDUPE_WINDOW_MS = 24 * 3600 * 1000; // 24 hours
const MIN_POST_INTERVAL_MS = 8 * 1000;     // 8s anti-burst spacing

const bsJobs = new Map();
// v292_name_cleanup: fix Page names saved by older versions ("Profile picture for ...", "Create post").
(async () => { try {
  const st = await chrome.storage.local.get(["meta_pages", "meta_default_page"]);
  const fix = p => p && ({ ...p, name: String(p.name || "").replace(/^profile picture for\s+/i, "").trim() });
  const pages = (st.meta_pages || []).map(fix).filter(p => p && !/^create( post| page)?$/i.test(p.name));
  await chrome.storage.local.set({ meta_pages: pages, meta_default_page: fix(st.meta_default_page) || pages[0] || null });
} catch (_) {} })();

// ---- Instant permission check: everything the user must decide, asked in ONE go before any upload ----
const BS_TIMING_Q = { id: "timing", question: "When should this go live?", options: ["Publish now", "Exact date & time", "Start time + gap between posts"] };
const BS_THUMB_Q = (n) => ({ id: "thumbnail", question: n > 1 ? `Thumbnail for the ${n} videos/reels?` : "Thumbnail for the video/reel?", options: ["Generate with Google Flow (DeepX)", "I'll provide the image", "No custom thumbnail"] });
function bsIsVideoItem(it, toolName) {
  if (toolName === "fb_publish_reel" || /^(reel|video)$/i.test(it.post_type || "")) return true;
  const m = it.media_paths || (it.video_path ? [it.video_path] : it.media_path ? [it.media_path] : []);
  return m.some(p => /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(String(p)));
}
function bsPreflight({ toolName, items, timingGiven, multi }) {
  const ask = [];
  if (!timingGiven) ask.push(multi ? { ...BS_TIMING_Q, follow_up: "If gap: ask start time and the gap (minutes/hours). If exact: one time per post." } : { ...BS_TIMING_Q, options: ["Publish now", "Exact date & time"] });
  const vids = items.filter(it => bsIsVideoItem(it, toolName));
  const noThumb = vids.filter(it => !it.thumbnail_path && it.thumbnail_choice !== "none");
  const needChoice = noThumb.filter(it => !it.thumbnail_choice);
  if (needChoice.length) ask.push(BS_THUMB_Q(needChoice.length));
  const todo = [];
  for (const it of noThumb) {
    if (it.thumbnail_choice === "flow") todo.push("Generate the thumbnail now with deepx_meta_generate_thumbnail (aspect_ratio 9:16 for a reel, 16:9 for a long video), poll deepx_job_status, then pass files[0].path as thumbnail_path.");
    if (it.thumbnail_choice === "manual") ask.push({ id: "thumbnail_file", question: "Send/attach the thumbnail image (or its path) for the video.", options: [] });
  }
  // Caption permission: show the exact final caption(s) and get the user's OK before anything is posted.
  const caps = items.map((it, i) => ({ i: i + 1, text: bsCaptionOf(it).trim() })).filter(c => c.text);
  const unapproved = items.some(it => !it.caption_approved && bsCaptionOf(it).trim());
  if (unapproved) ask.push({
    id: "caption",
    question: caps.length > 1 ? `Use these ${caps.length} captions as they are?` : "Use this caption for the post?",
    show_user: caps.map(c => (caps.length > 1 ? `Post ${c.i}:\n` : "") + c.text).join("\n\n———\n\n"),
    options: ["Yes, use it", "Edit it (I'll tell you the changes)", "Write a new one", "Post without caption"]
  });
  if (!ask.length && !todo.length) return null;
  return {
    success: false, needs_user_input: ask.length > 0, ask_user: ask, todo_before_upload: [...new Set(todo)],
    agent_instruction: ask.length
      ? "ASK THE USER NOW, all questions together in ONE AskUserQuestion call, using these options. For the caption question, put the exact show_user text in the question so the user sees the full caption. No long thinking, no extra text. Then call the same tool again with publish_now/schedule_time_iso (or timing), thumbnail_choice ('flow' | 'manual' | 'none') / thumbnail_path, and caption_approved:true (after edits, send the edited caption with caption_approved:true; 'without caption' = empty caption, title and hashtags)."
      : "Do the todo_before_upload steps immediately, then call the same tool again."
  };
}

function bsCaptionOf(it) { return [it.title, it.caption, (it.hashtags || []).join(" ")].filter(Boolean).join("\n\n"); }
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

// The tab debugger is exclusive per extension in AntiGem/Chrome. Holding it forever blocked every other
// plugin on the same tab ("Another extension is attached to this tab"), so it is leased per operation and released.
const debuggerLeases = new Map();
async function ensureDebuggerAttached(tabId) {
  if (!chrome.debugger || typeof chrome.debugger.attach !== "function") return false;
  if (attachedDebuggerTabs.has(tabId)) { debuggerLeases.set(tabId, (debuggerLeases.get(tabId) || 0) + 1); return true; }
  const deadline = Date.now() + 10000;
  let selfReset = false;
  for (;;) {
    try {
      await chrome.debugger.attach({ tabId }, "1.3");
      attachedDebuggerTabs.add(tabId);
      debuggerLeases.set(tabId, (debuggerLeases.get(tabId) || 0) + 1);
      return true;
    } catch (err) {
      const msg = String((err && err.message) || err || "");
      if (/already attached/i.test(msg) && !/another/i.test(msg) && !selfReset) {
        selfReset = true;
        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
        continue;
      }
      // Another plugin is mid-operation on this tab: wait briefly, then fall back to the non-debugger paths.
      if (!/another/i.test(msg) || Date.now() >= deadline) return false;
      await sleep(400);
    }
  }
}

async function releaseDebugger(tabId) {
  const left = Math.max(0, (debuggerLeases.get(tabId) || 0) - 1);
  if (left) { debuggerLeases.set(tabId, left); return; }
  debuggerLeases.delete(tabId);
  if (!attachedDebuggerTabs.delete(tabId)) return;
  try { await chrome.debugger.detach({ tabId }); } catch (_) {}
}

if (chrome.debugger && chrome.debugger.onDetach) {
  chrome.debugger.onDetach.addListener((source) => {
    if (source && source.tabId) { attachedDebuggerTabs.delete(source.tabId); debuggerLeases.delete(source.tabId); }
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
          // 1. Ancestor container check: strictly exclude all feed articles, comments, replies, searches, and sidebars
          if (
            el.closest(
              'div[role="article"], div[data-pagelet*="FeedUnit"], form[action*="comment"], div[aria-label*="comment" i], div[aria-label*="टिप्पणी" i], div[role="search"], [role="banner"], [role="navigation"], [data-testid*="comment" i], [data-testid*="UFI" i], [data-pagelet*="comment" i], [data-pagelet*="UFI" i], div[role="complementary"], [data-sigil*="comment" i], [data-sigil*="ufi" i], ul[role="list"], div[aria-label*="replies" i], div[aria-label*="reply" i], div[aria-label*="जवाब" i]'
            )
          ) {
            return true;
          }
          // 2. Element metadata check: aria-label, placeholder, type, title
          const aria = (el.getAttribute("aria-label") || "").toLowerCase();
          const ph = (el.getAttribute("placeholder") || "").toLowerCase();
          const aph = (el.getAttribute("aria-placeholder") || "").toLowerCase();
          const dph = (el.getAttribute("data-placeholder") || "").toLowerCase();
          const meta = `${aria} ${ph} ${aph} ${dph} ${el.getAttribute("type") || ""}`.toLowerCase();
          if (/comment|reply|replies|टिप्पणी|कमेंट|जवाब|राय|search|खोज/.test(meta) && !/describe your reel|what['’]?s on your mind|write a description/i.test(meta)) {
            return true;
          }
          // 3. Surrounding/sibling placeholder text check
          const parentTxt = (el.parentElement ? el.parentElement.innerText || "" : "").slice(0, 200).toLowerCase();
          if (/write a (public )?comment|leave a comment|comment as|write a reply|टिप्पणी लिखें|कमेंट करें|जवाब दें/i.test(parentTxt)) {
            return true;
          }
          return false;
        };

        if (!canReuseLocked) {
          document.querySelectorAll('[data-ag-caption-target="1"]').forEach((e) => e.removeAttribute("data-ag-caption-target"));
        }
        // Re-use editor locked on a previous attempt within this publish pass
        let editor = canReuseLocked ? document.querySelector('[data-ag-caption-target="1"]') : null;
        if (editor && (!document.contains(editor) || !isNotHidden(editor) || isCommentOrSearch(editor))) editor = null;

        if (!editor) {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter(
            (d) => isNotHidden(d) && d.getBoundingClientRect().height > 80
          );
          let bestDialog = null;
          let bestScore = 0;
          for (const d of dialogs) {
            if (d.querySelector('div[role="article"]')) continue;
            const aria = (d.getAttribute("aria-label") || "").toLowerCase();
            if (/notifications|messenger|chats|account controls|menu|media viewer|photo viewer|video viewer|comments/i.test(aria)) continue;
            const txt = (d.innerText || "").slice(0, 1200).toLowerCase();
            let s = 0;
            if (/create post|create a post|make a post|edit post|create reel|create story|पोस्ट बनाउनुहोस्|पोस्ट करें/i.test(txt) || /create post/i.test(aria)) s += 100;
            if (/add to your post|what['’]?s on your mind|describe your reel|start typing|के सोचिरहनुभएको|कुछ लिखें/i.test(txt)) s += 80;
            if (d.querySelector('div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"]') && s > 0) s += 40;
            if (/comment|reply|टिप्पणी|reply to/i.test(aria) || /write a comment|write a reply/i.test(txt.slice(0, 100))) s -= 300;
            if (s > bestScore && s > 50) {
              bestScore = s;
              bestDialog = d;
            }
          }
          // Never fall back to arbitrary document if posting to feed — only search inside bestDialog or mobile #MComposer
          const mobileComposer = document.querySelector('#MComposer, div[data-pagelet="Composer"], div[data-pagelet="ProfileComposer"]');
          const roots = bestDialog ? [bestDialog] : (hint === "reel" ? [document] : (mobileComposer ? [mobileComposer] : []));
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
              : /on your mind|write something|say something|create post|make a post|post|caption|कुछ लिखें|पोस्ट/i;
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
                  (ae && (ae.isContentEditable || ae.tagName === "TEXTAREA") && !isCommentOrSearch(ae) ? ae : null);
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
    } catch (_) {} finally { await releaseDebugger(tabId); }
  } else if (dbgReady) {
    await releaseDebugger(tabId);
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

    // Fire synthetic input and change events so React updates the thumbnail state
    await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const inp = window.__agThumbInput || document.querySelector('input[data-ag-thumb-target="1"]');
        if (inp) {
          try {
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (_) {}
        }
      }
    });

    await sleep(1500);

    // Confirm inside the thumbnail / video options panel (Save / Done / Apply) — never Post / Publish / Share
    let confirmed = false;
    for (let i = 0; i < 8; i++) {
      const [conf] = await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const panels = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter((d) =>
            /thumbnail|cover|video options|options/i.test((d.innerText || "").slice(0, 2500))
          );
          const scope = panels[panels.length - 1] || document;
          const btn = Array.from(scope.querySelectorAll('div[role="button"], button')).find((b) => {
            const t = `${b.getAttribute("aria-label") || ""} ${b.innerText || ""}`.replace(/\s+/g, " ").trim();
            return /^(save|done|apply|set thumbnail|use as thumbnail|use as cover|set cover|save changes)$/i.test(t) && b.getAttribute("aria-disabled") !== "true";
          });
          if (!btn) return { waiting: true };
          try {
            btn.click();
          } catch (_) {}
          return { clicked: true };
        }
      });
      const c = (conf && conf.result) || {};
      if (c.clicked) {
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
    if (dbgReady) await releaseDebugger(tabId);
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
              /photo\/video|photos\/videos|add photos|create a photo story|add to your post.*photo|add video|upload video/i.test(combined)
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

    // For videos and reels, dispatch input and change events so React starts upload and processing
    if (bound && preferVideo) {
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const inp =
            window.__agFbUploadInput ||
            document.querySelector('input[type="file"][accept*="video"]') ||
            document.querySelector('input[type="file"][data-antigem-upload-target="1"]') ||
            document.querySelector('input[type="file"]');
          if (inp) {
            try {
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
            } catch (_) {}
          }
        }
      });
      await sleep(1000);
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
    if (dbgReady) await releaseDebugger(tabId);
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
        const aria = (d.getAttribute("aria-label") || "").toLowerCase();
        if (/notifications|messenger|chats|account controls|menu|media viewer|photo viewer|video viewer|comments/i.test(aria)) continue;
        const txt = (d.innerText || d.textContent || "").slice(0, 800).toLowerCase();
        if (
          /create post|create a post|make a post|add to your post|what['’]?s on your mind|पोस्ट बनाउनुहोस्|पोस्ट करें/i.test(txt) ||
          /create post|make a post/i.test(aria)
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
        if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"], [data-testid*="comment" i], form[action*="comment" i]')) return false;
        const txt = `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.trim();
        return (
          /what['’]?s on your mind/i.test(txt) ||
          /make a post/i.test(txt) ||
          /write something/i.test(txt) ||
          /create a post/i.test(txt) ||
          /share something/i.test(txt) ||
          /के सोचिरहनुभएको|तपाईंको दिमाग|पोस्ट बनाउनुहोस्|कुछ लिखें|पोस्ट करें/i.test(txt)
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
          const aria = (dlg.getAttribute("aria-label") || "").toLowerCase();
          if (/notifications|messenger|chats|account controls|menu|media viewer|photo viewer|video viewer|comments/i.test(aria)) continue;
          const txt = (dlg.innerText || "").slice(0, 600).toLowerCase();
          if (
            /create post|create a post|make a post|add to your post|what['’]?s on your mind|पोस्ट बनाउनुहोस्|पोस्ट करें/i.test(txt) ||
            /create post|make a post/i.test(aria)
          ) {
            return true;
          }
        }
        const mobileBox = document.querySelector('#MComposer, div[data-pagelet="Composer"], div[data-pagelet="ProfileComposer"]');
        return Boolean(mobileBox);
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

        const isCommentContainer = (el) => {
          if (!el) return false;
          if (
            el.closest(
              'div[role="article"], div[data-pagelet*="FeedUnit"], [data-testid*="comment" i], [data-testid*="UFI" i], form[action*="comment" i], [data-pagelet*="comment" i], [data-pagelet*="UFI" i], div[role="complementary"], [data-sigil*="comment" i], [data-sigil*="ufi" i], ul[role="list"]'
            )
          ) {
            return true;
          }
          const a = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.toLowerCase();
          return /comment|reply|टिप्पणी|जवाब/i.test(a);
        };

        // Locate active Create Post dialog first to guarantee we never click outside into feed comments
        const createPostDialog = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).find((d) => {
          if (!isVisible(d)) return false;
          const txt = (d.innerText || "").slice(0, 800).toLowerCase();
          const aria = (d.getAttribute("aria-label") || "").toLowerCase();
          return (
            /create post|create a post|make a post|add to your post|what['’]?s on your mind|पोस्ट बनाउनुहोस्|पोस्ट करें/i.test(txt) ||
            /create post|make a post/i.test(aria)
          );
        });

        const mobileScope = document.querySelector('#MComposer, div[data-pagelet="Composer"], div[data-pagelet="ProfileComposer"]');
        const scope = createPostDialog || mobileScope || document;

        // Search strictly inside the Create Post scope and reject any comment buttons
        const buttons = Array.from(
          scope.querySelectorAll('div[role="button"], button, span[role="button"], input[type="submit"]')
        ).filter((el) => isVisible(el) && !isCommentContainer(el));

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
  for (let p = 0; p < 8; p++) {
    const [surfaceProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
      target: { tabId },
      func: () => {
        const txt = (document.body ? document.body.innerText || "" : "").slice(0, 3000).toLowerCase();
        const hasVideoInput = Array.from(document.querySelectorAll('input[type="file"]')).some((i) =>
          /video/.test((i.getAttribute("accept") || "").toLowerCase())
        );
        const onReelsPath = location.pathname.includes("/reels/create") || location.href.includes("/reels/create");
        return {
          isReelCreator: onReelsPath || hasVideoInput || /create reel|add video|upload video|drag and drop|भिडियो|रील|वीडियो/.test(txt),
          href: location.href
        };
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
  // v2.8: every Page upload goes through Meta Business Suite (business.facebook.com), never the facebook.com composer.
  const useBS = toolName.startsWith("fb_publish") && String(args.target_type || "page").toLowerCase() !== "profile";
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

  const publishKind = String(args.target_type || "").toLowerCase() === "profile" ? "profile" : (toolName === "fb_publish_story" || postType === "story") ? "story" : (toolName === "fb_publish_reel" || postType === "reel") ? "reel" : "feed";
  if (toolName.startsWith("fb_publish")) {
    const guard = await manualPublishGuard(publishKind, Boolean(args.from_scheduler));
    if (guard) return guard;
  }

  inFlightLock = { tool: toolName, startedAt: Date.now() };
  const recordId = args.id || `fb_${Date.now()}`;

  if (useBS && !args.from_scheduler && !args.dry_run) {
    const pf = bsPreflight({ toolName, items: [{ ...args, media_paths: mediaList, post_type: postType }], timingGiven: !!(args.publish_now || args.schedule_time_iso || args.schedule_ms || args.save_draft), multi: false });
    if (pf) { inFlightLock = null; return pf; }
  }
  if (useBS) {
    // Business Suite job runs in the background; the call returns within ~40 s with a job_id when it needs longer.
    const jobId = `bs_${Date.now().toString(36)}`;
    const startedAt = Date.now();
    bsJobs.set(jobId, { job_id: jobId, tool: toolName, status: "running", started_at: startedAt });
    const p = (async () => {
      try {
        const result = await self.MetaBS.bsPublishTool(toolName, { ...args, media_paths: mediaList, post_type: postType });
        if (result && result.success && !result.dry_run) {
          await setStorage({ fb_last_publish_at: Date.now(), fb_pending_task: null });
          if (result.status === "published") await recordPublishLog(publishKind);
          await recordDedupe(result.caption || args.caption || "", mediaList, recordId);
          await recordPostHistory({ id: recordId, post_type: result.kind || postType, target_type: "page", title: args.title || "", caption: result.caption || args.caption || "", hashtags: args.hashtags || [], media_paths: mediaList, status: result.status, via: "meta_business_suite", scheduled_for: result.scheduled_for });
        }
        bsJobs.set(jobId, { job_id: jobId, tool: toolName, status: "done", started_at: startedAt, finished_at: Date.now(), result });
        return result;
      } catch (err) {
        await recordPostHistory({ id: recordId, post_type: postType, caption: args.caption || "", media_paths: mediaList, status: "failed", error_message: err.message, via: "meta_business_suite" });
        const result = { success: false, stop_loop: true, error: err.message, via: "meta_business_suite", may_have_posted: !!err.submitted || undefined, agent_instruction: err.submitted ? "The final button WAS pressed: tell the user to check Business Suite > Content/Planner. NEVER retry (it could double-post)." : "Report this to the user in one sentence. Do not retry automatically." };
        bsJobs.set(jobId, { job_id: jobId, tool: toolName, status: "failed", started_at: startedAt, finished_at: Date.now(), result });
        return result;
      } finally { inFlightLock = null; }
    })();
    if (args.from_scheduler) return await p;
    const quick = await Promise.race([p, sleep(40000).then(() => null)]);
    if (quick) return { job_id: jobId, ...quick };
    return { success: true, status: "running", job_id: jobId, via: "meta_business_suite", message: "Uploading in Meta Business Suite (screen locked). Poll fb_publish_status with this job_id.", agent_instruction: "Call fb_publish_status {job_id, wait_seconds: 45} until finished is true. Do not start another upload meanwhile." };
  }

  try {
    const runner = useBS ? (fn) => fn() : (fn) => withAutomationLease(tabId, fn);
    return await runner(async () => {
      let result;
      if (useBS) {
        result = await self.MetaBS.bsPublishTool(toolName, { ...args, media_paths: mediaList, post_type: postType });
      } else if (toolName === "fb_publish_reel" || (toolName === "fb_publish" && postType === "reel")) {
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

      if (result && result.success && !result.dry_run) {
        await setStorage({ fb_last_publish_at: Date.now(), fb_pending_task: null });
        if (toolName.startsWith("fb_publish")) {
          await recordPublishLog(publishKind);
          const finalCap = result.caption || args.caption || "";
          const finalMedia = result.media_attached || mediaList;
          await recordDedupe(finalCap, finalMedia, result.fb_post_id || recordId);
          await recordPostHistory({
            id: recordId,
            fb_post_id: result.fb_post_id,
            post_url: result.post_url,
            post_type: result.post_type || postType,
            target_type: args.target_type || "page",
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
// 8. Page Safety Governor + Background Scheduler (bulk 100+ posts, ban-safe pacing)
// ============================================================================
// Meta does not publish posting quotas; restrictions come from spam *patterns*: bursts, many posts per day,
// identical/duplicate content, robotic exact timing, and continuing after a warning. The governor prevents
// each of these. Users can make it stricter, but never looser than SAFETY_HARD.
const SAFETY_DEFAULTS = {
  max_posts_per_day: 3,       // feed posts + reels combined, per day
  max_reels_per_day: 2,
  max_stories_per_day: 3,
  min_gap_minutes: 120,       // between two feed posts/reels
  story_gap_minutes: 60,      // between two stories
  jitter_minutes: 10,         // random +/- offset so times are never robotic
  active_start: "08:00",      // never post at night (local device time)
  active_end: "22:00",
  catchup_grace_minutes: 90,  // a job later than this (AntiGem was offline) is moved, never burst-posted
  max_horizon_days: 90,
  warmup: true                // above 6 posts/day, volume rises week by week (6 -> 9 -> 12 -> 15) instead of jumping overnight
};
const WARMUP_STEPS = [6];   // week 1 cap; later weeks rise evenly to the target over 4 weeks (e.g. 6 -> 14 -> 22 -> 30)
const PROFILE_LIMITS = { per_day: 3, gap_minutes: 120 };  // personal profiles get restricted far faster than Pages
const SAFETY_HARD = { max_posts_per_day: 30, max_reels_per_day: 4, max_stories_per_day: 10, min_gap_minutes: 25, story_gap_minutes: 20, jitter_minutes: 20, max_horizon_days: 180 };
const RESTRICTION_RE = /temporarily blocked|we limit how often|limit how often you can|you can'?t (post|use this feature) right now|action blocked|account (has been |is )?(restricted|suspended|disabled|locked)|page (has been |is )?(restricted|unpublished)|you'?re restricted|checkpoint|confirm (it'?s you|your identity)|security check|suspicious activity|unusual activity|community standards|goes against our|marked as spam|looks like spam|try again later/i;
const BULK_MAX = 500;
let schedulerBusy = false;

function hhmmToMin(v, fallback) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || "").trim()); if (!m) return fallback; const n = (+m[1]) * 60 + (+m[2]); return n >= 0 && n <= 1440 ? n : fallback; }
function minToHHMM(n) { return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; }
function localDayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function minuteOfDay(ms) { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
function jobKind(postType, targetType) { if (String(targetType || "").toLowerCase() === "profile") return "profile"; const t = String(postType || "").toLowerCase(); return t === "story" ? "story" : t === "reel" ? "reel" : "feed"; }
const isPageKind = k => k === "feed" || k === "reel";
function warmupSteps(target, from = WARMUP_STEPS[0]) { const f = Math.min(target, Math.max(WARMUP_STEPS[0], from || 0)); return [0, 1, 2, 3].map(w => Math.min(target, Math.round(f + (target - f) * w / 3))); }
function newJobId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

async function getSafety() {
  const st = await getStorage(["fb_safety_settings", "fb_publish_log"]);
  const s = clampSafety({ ...SAFETY_DEFAULTS, ...(st.fb_safety_settings || {}) });
  // A Page that already published 8+ posts/day on 5 of the last 14 days is past the warm-up.
  const perDay = {};
  for (const e of Array.isArray(st.fb_publish_log) ? st.fb_publish_log : []) if (e && isPageKind(e.kind || "feed") && e.at >= Date.now() - 14 * 86400000) perDay[localDayKey(e.at)] = (perDay[localDayKey(e.at)] || 0) + 1;
  s.established_high_volume = Object.values(perDay).filter(n => n >= 8).length >= 5;
  return s;
}

function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
// Daily post cap for the day of `ms`, including the warm-up ramp.
function dailyCapFor(ms, s) {
  const target = s.max_posts_per_day;
  if (!s.warmup || target <= WARMUP_STEPS[0] || s.established_high_volume) return target;
  const start = s.ramp_start || Date.now();
  const weeks = Math.max(0, Math.floor((startOfDay(ms) - startOfDay(start)) / (7 * 86400000)));
  return warmupSteps(target, s.ramp_from)[Math.min(weeks, 3)];
}
async function saveSafetyPatch(patch) {
  const cur = (await getStorage(["fb_safety_settings"])).fb_safety_settings || {};
  const next = { ...cur, ...patch };
  const prev = await getSafety();
  if (patch.ramp_start) next.ramp_from = WARMUP_STEPS[0];
  else if (Number(next.max_posts_per_day) > Math.max(WARMUP_STEPS[0], prev.max_posts_per_day)) {
    // Raising the volume warms up again from what the Page posts today, not from zero and not in one jump.
    next.ramp_from = prev.max_posts_per_day > WARMUP_STEPS[0] ? dailyCapFor(Date.now(), prev) : WARMUP_STEPS[0];
    next.ramp_start = Date.now();
  }
  const clamped = clampSafety(next);
  delete clamped.gap_auto_fitted; delete clamped.established_high_volume;
  await setStorage({ fb_safety_settings: clamped });
  return getSafety();
}
function clampSafety(s) {
  const out = { ...SAFETY_DEFAULTS, ...s };
  const num = (k, lo, hi) => { const v = Number(out[k]); out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : SAFETY_DEFAULTS[k]; };
  num("max_posts_per_day", 1, SAFETY_HARD.max_posts_per_day);
  num("max_reels_per_day", 0, SAFETY_HARD.max_reels_per_day);
  num("max_stories_per_day", 0, SAFETY_HARD.max_stories_per_day);
  num("min_gap_minutes", SAFETY_HARD.min_gap_minutes, 24 * 60);
  num("story_gap_minutes", SAFETY_HARD.story_gap_minutes, 24 * 60);
  num("jitter_minutes", 0, SAFETY_HARD.jitter_minutes);
  num("catchup_grace_minutes", 15, 6 * 60);
  num("max_horizon_days", 1, SAFETY_HARD.max_horizon_days);
  const a = hhmmToMin(out.active_start, 480), b = hhmmToMin(out.active_end, 1320);
  if (b - a < 4 * 60) { out.active_start = SAFETY_DEFAULTS.active_start; out.active_end = SAFETY_DEFAULTS.active_end; }
  else { out.active_start = minToHHMM(a); out.active_end = minToHHMM(b); }
  // Above 20 posts/day the default posting hours widen to 07:00-23:00 so posts stay ~30 min apart.
  if (out.max_posts_per_day > 20 && out.active_start === SAFETY_DEFAULTS.active_start && out.active_end === SAFETY_DEFAULTS.active_end) { out.active_start = "07:00"; out.active_end = "23:00"; }
  // High volume: shrink the gap so the day's posts fit evenly in posting hours, but never below the hard minimum.
  const windowMin = hhmmToMin(out.active_end, 1320) - hhmmToMin(out.active_start, 480) - 60;
  const fit = Math.floor(windowMin / out.max_posts_per_day);
  if (out.max_posts_per_day * out.min_gap_minutes > windowMin) { out.min_gap_minutes = Math.max(SAFETY_HARD.min_gap_minutes, fit); out.gap_auto_fitted = true; }
  if (out.max_posts_per_day * out.min_gap_minutes > windowMin + 30) out.max_posts_per_day = Math.max(1, Math.floor((windowMin + 30) / out.min_gap_minutes));
  out.warmup = out.warmup !== false;
  out.ramp_start = Number.isFinite(Number(s.ramp_start)) && s.ramp_start ? Number(s.ramp_start) : null;
  out.ramp_from = Number.isFinite(Number(s.ramp_from)) && s.ramp_from ? Number(s.ramp_from) : null;
  return out;
}

async function getPublishLog() {
  const st = await getStorage(["fb_publish_log"]);
  const cutoff = Date.now() - 14 * 86400000;
  return (Array.isArray(st.fb_publish_log) ? st.fb_publish_log : []).filter(e => e && e.at >= cutoff);
}
async function recordPublishLog(kind, at = Date.now()) {
  const log = await getPublishLog();
  log.push({ at, kind });
  await setStorage({ fb_publish_log: log.slice(-500) });
}

// Every post that is already published or still planned occupies a slot.
function buildOccupancy(jobs, log, excludeJobId) {
  const occ = log.map(e => ({ at: e.at, kind: e.kind || "feed" }));
  for (const j of jobs) if (j && j.job_id !== excludeJobId && ["queued", "running", "handing_off", "scheduled_on_meta"].includes(j.status) && Number.isFinite(j.run_at_timestamp)) occ.push({ at: j.run_at_timestamp * 1000, kind: jobKind(j.post_type, j.target_type) });
  return occ;
}

function slotProblem(ms, kind, occ, s) {
  const mod = minuteOfDay(ms), a = hhmmToMin(s.active_start, 480), b = hhmmToMin(s.active_end, 1320);
  if (mod < a || mod >= b) return `outside posting hours ${s.active_start}-${s.active_end}`;
  if (ms > Date.now() + s.max_horizon_days * 86400000) return `more than ${s.max_horizon_days} days ahead`;
  const day = localDayKey(ms), isStory = kind === "story";
  const sameDay = occ.filter(o => localDayKey(o.at) === day);
  if (kind === "profile") {
    if (sameDay.filter(o => o.kind === "profile").length >= PROFILE_LIMITS.per_day) return `profile limit (${PROFILE_LIMITS.per_day}/day): high volume is for Pages only`;
    if (occ.some(o => o.kind === "profile" && Math.abs(o.at - ms) < PROFILE_LIMITS.gap_minutes * 60000)) return `less than ${PROFILE_LIMITS.gap_minutes} min from another profile post`;
    return null;
  }
  if (isStory) {
    if (sameDay.filter(o => o.kind === "story").length >= s.max_stories_per_day) return `daily story limit (${s.max_stories_per_day}) reached`;
    if (occ.some(o => o.kind === "story" && Math.abs(o.at - ms) < s.story_gap_minutes * 60000)) return `less than ${s.story_gap_minutes} min after another story`;
    return null;
  }
  const cap = dailyCapFor(ms, s);
  if (sameDay.filter(o => isPageKind(o.kind)).length >= cap) return cap < s.max_posts_per_day ? `warm-up limit for that day (${cap}/day, rising to ${s.max_posts_per_day})` : `daily post limit (${cap}) reached`;
  if (kind === "reel" && sameDay.filter(o => o.kind === "reel").length >= s.max_reels_per_day) return `daily reel limit (${s.max_reels_per_day}) reached`;
  if (occ.some(o => isPageKind(o.kind) && Math.abs(o.at - ms) < s.min_gap_minutes * 60000)) return `less than ${s.min_gap_minutes} min from another post`;
  return null;
}

function defaultTimes(perDay, s) {
  const pad = perDay > 6 ? 15 : 60;
  const a = hhmmToMin(s.active_start, 480) + pad, b = hhmmToMin(s.active_end, 1320) - pad;
  if (perDay <= 1) return [minToHHMM(Math.round(a + (b - a) * 0.55))];
  return Array.from({ length: perDay }, (_, i) => minToHHMM(Math.round(a + (b - a) * i / (perDay - 1))));
}

// Next slot >= fromMs that respects every rule. Preferred times first (with jitter), then a 15-minute scan of the day.
function nextSafeSlot(fromMs, kind, occ, s, preferredTimes) {
  const times = (preferredTimes && preferredTimes.length ? preferredTimes : defaultTimes(s.max_posts_per_day, s)).map(t => hhmmToMin(t, null)).filter(n => n != null).sort((x, y) => x - y);
  const start = new Date(fromMs); start.setHours(0, 0, 0, 0);
  const spacing = times.length > 1 ? Math.min(...times.slice(1).map((t, i) => t - times[i])) : 24 * 60;
  const jitter = Math.max(0, Math.min(s.jitter_minutes, Math.floor((spacing - s.min_gap_minutes) / 2)));
  for (let d = 0; d <= s.max_horizon_days + 1; d++) {
    const day = new Date(start); day.setDate(start.getDate() + d);
    const base = day.getTime();
    const candidates = times.map(m => base + m * 60000 + Math.round((Math.random() * 2 - 1) * jitter) * 60000);
    for (let m = hhmmToMin(s.active_start, 480); m < hhmmToMin(s.active_end, 1320); m += 15) candidates.push(base + m * 60000 + Math.round(Math.random() * Math.min(s.jitter_minutes, 7)) * 60000);
    for (const c of candidates) {
      const ms = Math.floor(c / 60000) * 60000;
      if (ms < fromMs) continue;
      if (!slotProblem(ms, kind, occ, s)) return ms;
    }
  }
  return null;
}

function parseWhen(args) {
  const v = args.schedule_time_iso ?? args.run_at_iso ?? args.run_at_timestamp ?? args.time;
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : NaN;
}

// Same photo posted twice (even renamed) is a spam signal: hash file contents (falls back to path+size+date for huge files).
async function mediaHashes(paths, preferVideo) {
  const out = [];
  for (const mp of paths) {
    const r = await resolveLocalFile(mp, preferVideo);
    let h = null;
    try {
      const st = chrome.antigem && chrome.antigem.stat ? await chrome.antigem.stat({ path: r.path }) : null;
      if (st && st.size <= 20 * 1024 * 1024 && chrome.antigem.readFile) h = "c:" + await sha256Hex(await chrome.antigem.readFile({ path: r.path, encoding: "base64" }));
    } catch (_) {}
    out.push(h || "f:" + await sha256Hex(r.fingerprint || r.path));
  }
  return out;
}

async function captionHash(caption) { const c = normalizeCaption(caption || ""); return c.length > 20 ? sha256Hex(c) : null; }

async function prepareJob(args, s) {
  const enriched = ensureTitleAndHashtags(args);
  const mediaPaths = Array.isArray(args.media_paths) ? args.media_paths.filter(Boolean) : [];
  const postType = String(args.post_type || (mediaPaths.length ? "photo" : "text")).toLowerCase();
  if ((postType === "reel" || postType === "video") && !mediaPaths.length) throw new Error(`${postType} needs a video in media_paths`);
  if (["photo", "carousel"].includes(postType) && !mediaPaths.length) throw new Error(`${postType} needs media_paths`);
  if (!mediaPaths.length && !String(enriched.caption || "").trim()) throw new Error("caption or media_paths is required");
  // Check files now, so a post never fails (and retries) on the day it is due.
  const media_hashes = await mediaHashes(mediaPaths, postType === "reel" || postType === "video");
  if (args.thumbnail_path) await resolveLocalFile(args.thumbnail_path);
  if ((enriched.hashtags || []).length > 6) enriched.hashtags = enriched.hashtags.slice(0, 6);
  return {
    job_id: newJobId("job"), post_id: newJobId("sched"),
    title: enriched.title, caption: enriched.caption, hashtags: enriched.hashtags,
    thumbnail_path: args.thumbnail_path || null, media_paths: mediaPaths, post_type: postType,
    target_type: args.target_type || "page", target_id: args.target_id || null,
    status: "queued", attempts: 0, created_at: Date.now(),
    caption_hash: await captionHash(enriched.caption), media_hashes
  };
}

async function knownCaptionHashes(jobs) {
  const st = await getStorage(["fb_dedupe_ledger"]);
  const set = new Set((Array.isArray(st.fb_dedupe_ledger) ? st.fb_dedupe_ledger : []).filter(e => e.type === "caption").map(e => e.hash));
  for (const j of jobs) if (j.caption_hash && ["queued", "running", "handing_off", "scheduled_on_meta", "completed"].includes(j.status)) set.add(j.caption_hash);
  return set;
}
function knownMediaHashes(jobs) {
  const set = new Set();
  for (const j of jobs) if (["queued", "running", "handing_off", "scheduled_on_meta", "completed"].includes(j.status)) for (const h of j.media_hashes || []) set.add(h);
  return set;
}

function pruneJobs(jobs) {
  const cutoff = Date.now() - 30 * 86400000;
  return jobs.filter(j => ["queued", "running", "needs_review", "handing_off", "scheduled_on_meta"].includes(j.status) || (j.completed_at || j.created_at || 0) >= cutoff);
}

async function scheduleOne(args) {
  const s = await getSafety();
  const st = await getStorage(["fb_scheduled_jobs"]);
  const jobs = Array.isArray(st.fb_scheduled_jobs) ? st.fb_scheduled_jobs : [];
  let job;
  try { job = await prepareJob(args, s); } catch (e) { return { success: false, error: e.message }; }
  if ((job.media_hashes || []).some(h => knownMediaHashes(jobs).has(h))) return { success: false, duplicate_detected: true, error: "This photo/video is already queued or was posted in the last 30 days. Posting the same image again looks like spam to Meta; use a different one." };
  if (job.caption_hash && (await knownCaptionHashes(jobs)).has(job.caption_hash)) return { success: false, duplicate_detected: true, error: "This caption is already queued or was published recently. Meta treats repeated posts as spam; change the text." };
  const asked = parseWhen(args);
  if (Number.isNaN(asked)) return { success: false, error: "schedule_time_iso must be an ISO date/time, e.g. 2026-11-22T09:00:00+05:30" };
  job.delivery = chooseDelivery(await getMetaConn(), job, args.delivery);
  if (args.delivery !== "device" && job.delivery !== "meta" && asked && asked >= Date.now() + 15 * 60000 && asked <= Date.now() + 29 * 86400000 && String(job.target_type || "page") !== "profile") {
    // Hand it straight to Business Suite's own scheduler (shows in Planner; AntiGem need not stay open).
    const bsId = `bs_${Date.now().toString(36)}`; const startedAt = Date.now();
    bsJobs.set(bsId, { job_id: bsId, tool: "fb_schedule", status: "running", started_at: startedAt });
    const p = (async () => {
      try {
        const r = await self.MetaBS.bsPublishWithProof(job.post_type === "story" ? "story" : (job.post_type === "reel" || job.post_type === "video") ? "reel" : "post", { ...args, title: job.title, caption: job.caption, hashtags: job.hashtags, media_paths: job.media_paths, thumbnail_path: job.thumbnail_path, schedule_ms: asked });
        if (r && r.dry_run) { bsJobs.set(bsId, { job_id: bsId, tool: "fb_schedule", status: "done", started_at: startedAt, finished_at: Date.now(), result: r }); return r; }
        job.delivery = "business_suite"; job.status = "scheduled_on_meta"; job.run_at_timestamp = Math.floor(asked / 1000); job.result = r;
        const st2 = await getStorage(["fb_scheduled_jobs"]); const list = Array.isArray(st2.fb_scheduled_jobs) ? st2.fb_scheduled_jobs : [];
        list.push(job); await setStorage({ fb_scheduled_jobs: pruneJobs(list) });
        await recordDedupe(job.caption, job.media_paths, job.post_id);
        const out = { ...r, schedule_job_id: job.job_id, delivery: "business_suite", run_at_local: new Date(asked).toLocaleString(), message: `Scheduled in Meta Business Suite for ${new Date(asked).toLocaleString()} (see Business Suite > Planner).` };
        bsJobs.set(bsId, { job_id: bsId, tool: "fb_schedule", status: "done", started_at: startedAt, finished_at: Date.now(), result: out });
        return out;
      } catch (e) {
        const out = { success: false, stop_loop: true, error: e.message, may_have_posted: !!e.submitted || undefined, agent_instruction: "Tell the user this in one sentence. Do not retry automatically." };
        bsJobs.set(bsId, { job_id: bsId, tool: "fb_schedule", status: "failed", started_at: startedAt, finished_at: Date.now(), result: out });
        return out;
      }
    })();
    const quick = await Promise.race([p, sleep(40000).then(() => null)]);
    return quick ? { job_id: bsId, ...quick } : { success: true, status: "running", job_id: bsId, agent_instruction: "Poll fb_publish_status {job_id, wait_seconds: 50} until finished is true. Do not stop before that." };
  }
  const occ = buildOccupancy(jobs, await getPublishLog());
  const from = Math.max(asked || 0, Date.now() + (job.delivery === "meta" ? META_MIN_LEAD_MIN + 5 : 10) * 60000);
  const problem = asked ? slotProblem(from, jobKind(job.post_type, job.target_type), occ, s) : "no time given";
  const at = problem ? nextSafeSlot(from, jobKind(job.post_type, job.target_type), occ, s, args.preferred_times) : from;
  if (!at) return { success: false, error: `No safe slot in the next ${s.max_horizon_days} days. The queue is full under the safety limits.` };
  job.run_at_timestamp = Math.floor(at / 1000);
  jobs.push(job);
  await setStorage({ fb_scheduled_jobs: pruneJobs(jobs) });
  if (job.delivery === "meta") metaTick().catch(() => {});
  const adjusted = Boolean(asked) && problem && Math.abs(at - asked) > 60000;
  return {
    success: true, status: "scheduled", job_id: job.job_id, post_id: job.post_id, title: job.title, hashtags: job.hashtags,
    run_at_timestamp: job.run_at_timestamp, run_at_iso: new Date(at).toISOString(), run_at_local: new Date(at).toLocaleString(),
    adjusted_for_safety: adjusted, adjustment_reason: adjusted ? problem : undefined,
    delivery: job.delivery,
    message: `Facebook ${job.post_type} scheduled for ${new Date(at).toLocaleString()}${adjusted ? ` (moved for account safety: ${problem})` : ""}. ${job.delivery === "meta" ? "Meta's own scheduler will publish it (it appears in Business Suite > Planner)." : "It posts from this device, so AntiGem must be open at that time."}`
  };
}

async function scheduleBulk(args) {
  let s = await getSafety();
  const posts = Array.isArray(args.posts) ? args.posts : [];
  let settingsChanged = null;
  const askedPerDay = Math.round(Number(args.posts_per_day) || 0);
  if (askedPerDay > s.max_posts_per_day) {
    s = await saveSafetyPatch({ max_posts_per_day: Math.min(askedPerDay, SAFETY_HARD.max_posts_per_day) });
    settingsChanged = { max_posts_per_day: s.max_posts_per_day, min_gap_minutes: s.min_gap_minutes, warmup: s.warmup && !s.established_high_volume };
  }
  if (!posts.length) return { success: false, error: "posts is required: an array of {title, caption, hashtags, media_paths, post_type}" };
  if (posts.length > BULK_MAX) return { success: false, error: `At most ${BULK_MAX} posts per call.` };
  const perDay = Math.min(Number(args.posts_per_day) || s.max_posts_per_day, s.max_posts_per_day);
  const plan = { ...s, max_posts_per_day: perDay };
  const times = Array.isArray(args.preferred_times) && args.preferred_times.length ? args.preferred_times : defaultTimes(perDay, s);
  const startAsked = parseWhen({ schedule_time_iso: args.start_date_iso || args.start_iso });
  if (Number.isNaN(startAsked)) return { success: false, error: "start_date_iso must be an ISO date, e.g. 2026-11-22 or 2026-11-22T09:00:00+05:30" };
  let startMs = Math.max(startAsked || 0, Date.now() + (META_MIN_LEAD_MIN + 5) * 60000);
  const conn = await getMetaConn();
  const st = await getStorage(["fb_scheduled_jobs"]);
  const jobs = Array.isArray(st.fb_scheduled_jobs) ? st.fb_scheduled_jobs : [];
  const seen = await knownCaptionHashes(jobs), seenMedia = knownMediaHashes(jobs);
  const occ = buildOccupancy(jobs, await getPublishLog());
  const added = [], rejected = [];
  let cursor = startMs, startIndex = 0, firstNow = null;
  // Optional: publish post #1 right away (still inside today's limit and the 10-minute rule), schedule the rest.
  if (args.publish_first_now) {
    let job0 = null;
    try { job0 = await prepareJob(posts[0] || {}, s); } catch (e) { firstNow = { published: false, reason: e.message }; }
    if (job0 && ((job0.caption_hash && seen.has(job0.caption_hash)) || (job0.media_hashes || []).some(h => seenMedia.has(h)))) { firstNow = { published: false, reason: "post #1 is a duplicate" }; job0 = null; startIndex = 1; rejected.push({ index: 0, title: posts[0] && posts[0].title, reason: "duplicate caption or image" }); }
    if (job0) {
      const kind0 = jobKind(job0.post_type, job0.target_type);
      const guard = await manualPublishGuard(kind0, false);
      if (guard) firstNow = { published: false, reason: guard.error };
      else {
        job0.delivery = chooseDelivery(conn, job0, (posts[0] && posts[0].delivery) || args.delivery);
        try {
          if (job0.delivery === "meta") {
            const r = await metaCreatePost(resolveMetaPage(conn, job0), job0, null);
            await recordPublishLog(kind0);
            job0.result = { meta_id: r.id };
          } else {
            const r = await dispatchProtectedBrowserTask("fb_publish", { id: job0.post_id, title: job0.title, caption: job0.caption, hashtags: job0.hashtags, thumbnail_path: job0.thumbnail_path, media_paths: job0.media_paths, post_type: job0.post_type, target_type: job0.target_type, target_id: job0.target_id, from_scheduler: true });
            if (!r || !r.success) throw new Error((r && r.error) || "Publishing failed");
            job0.result = { fb_post_id: r.fb_post_id, post_url: r.post_url };
          }
          job0.status = "completed"; job0.completed_at = Date.now(); job0.run_at_timestamp = Math.floor(Date.now() / 1000);
          jobs.push(job0); startIndex = 1;
          if (job0.caption_hash) seen.add(job0.caption_hash);
          for (const h of job0.media_hashes || []) seenMedia.add(h);
          occ.push({ at: Date.now(), kind: kind0 });
          firstNow = { published: true, title: job0.title, delivery: job0.delivery };
        } catch (e) {
          if (e.kind) { const action = await handleMetaError(e, job0); if (action === "stop" && e.kind === "RESTRICTED") return { success: false, stop_loop: true, error: e.message, agent_instruction: "Tell the user Meta refused the post and the queue is paused for account safety. Do not retry." }; }
          firstNow = { published: false, reason: e.message };
        }
      }
    }
  }
  for (let i = startIndex; i < posts.length; i++) {
    const p = posts[i] || {};
    let job;
    try { job = await prepareJob(p, s); } catch (e) { rejected.push({ index: i, title: p.title || null, reason: e.message }); continue; }
    if ((job.media_hashes || []).some(h => seenMedia.has(h))) { rejected.push({ index: i, title: job.title, reason: "same photo/video as another post (in this batch, the queue, or the last 30 days)" }); continue; }
    if (job.caption_hash && seen.has(job.caption_hash)) { rejected.push({ index: i, title: job.title, reason: "duplicate caption (already in this batch, the queue, or published in the last 24h)" }); continue; }
    const kind = jobKind(job.post_type, job.target_type), asked = parseWhen(p);
    let at = null;
    if (asked && !Number.isNaN(asked) && asked >= Date.now() + 10 * 60000 && !slotProblem(asked, kind, occ, plan)) at = asked;
    if (!at) at = nextSafeSlot(asked && !Number.isNaN(asked) ? Math.max(asked, startMs) : (kind === "story" ? startMs : cursor), kind, occ, plan, times);
    if (!at) { rejected.push({ index: i, title: job.title, reason: `no safe slot within ${s.max_horizon_days} days` }); continue; }
    job.run_at_timestamp = Math.floor(at / 1000);
    job.delivery = chooseDelivery(conn, job, p.delivery || args.delivery);
    if (job.caption_hash) seen.add(job.caption_hash);
    for (const h of job.media_hashes || []) seenMedia.add(h);
    occ.push({ at, kind });
    if (kind !== "story" && !asked) cursor = at;
    jobs.push(job); added.push(job);
  }
  await setStorage({ fb_scheduled_jobs: pruneJobs(jobs) });
  if (added.some(j => j.delivery === "meta")) metaTick().catch(() => {});
  const perDayCount = {};
  for (const j of added) { const k = localDayKey(j.run_at_timestamp * 1000); perDayCount[k] = (perDayCount[k] || 0) + 1; }
  const sorted = added.map(j => j.run_at_timestamp).sort((a, b) => a - b);
  const days = Object.keys(perDayCount).length;
  return {
    success: added.length > 0,
    scheduled: added.length, rejected_count: rejected.length, rejected: rejected.slice(0, 50),
    first_post_local: sorted.length ? new Date(sorted[0] * 1000).toLocaleString() : null,
    last_post_local: sorted.length ? new Date(sorted.at(-1) * 1000).toLocaleString() : null,
    days_covered: days, posts_per_day_target: perDay, preferred_times: times,
    warmup: s.warmup && !s.established_high_volume && perDay > WARMUP_STEPS[0] ? `Warm-up: ${[...new Set(warmupSteps(perDay, s.ramp_from))].join(" -> ")} posts/day, one step per week, so the Page's volume rises gradually.` : null,
    settings_changed: settingsChanged,
    first_post_now: firstNow,
    delivery: { meta: added.filter(j => j.delivery === "meta").length, device: added.filter(j => j.delivery !== "meta").length, meta_connected: conn.pages.length > 0 && !conn.token_error },
    per_day: perDayCount,
    preview: added.slice(0, 10).map(j => ({ job_id: j.job_id, title: j.title, post_type: j.post_type, run_at_local: new Date(j.run_at_timestamp * 1000).toLocaleString() })),
    safety: plan,
    note: added.some(j => j.delivery === "meta")
      ? `Meta's own scheduler publishes the "meta" posts (they appear in Business Suite > Planner as they are handed over, about 3 per minute). Posts more than ${META_MAX_DAYS} days ahead are handed over automatically when AntiGem is next open within ${META_MAX_DAYS} days of them. "device" posts (reels, stories, profiles) need AntiGem open. Any Meta warning pauses everything and pulls future posts back from Meta.`
      : "Posts publish one at a time from this device, so AntiGem must stay open. Connect Meta's own scheduler with fb_meta_connect so posts publish even when this device is off. Any Meta warning pauses the whole queue.",
    agent_instruction: "Tell the user in 2-3 short sentences: how many posts were scheduled, the date range and posts per day (mention the warm-up if present), and how many were rejected and why. Do not call fb_schedule_bulk again for the same posts."
  };
}

async function detectRestriction(res) {
  const text = (() => { try { return JSON.stringify(res || {}); } catch (_) { return String(res); } })();
  if (res && (res.checkpoint_required || res.restricted)) return "Facebook asked for a security check";
  const m = RESTRICTION_RE.exec(text);
  if (m) return `Facebook said: "${m[0]}"`;
  try {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => isFacebookUrl(t.url));
    if (tab) {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", func: () => (document.body && document.body.innerText || "").slice(0, 20000) + " " + location.pathname });
      const m2 = RESTRICTION_RE.exec(String(r && r.result || ""));
      if (m2) return `Facebook shows: "${m2[0]}"`;
    }
  } catch (_) {}
  return null;
}

async function updateJobs(mutator) {
  const st = await getStorage(["fb_scheduled_jobs"]);
  const jobs = Array.isArray(st.fb_scheduled_jobs) ? st.fb_scheduled_jobs : [];
  const out = await mutator(jobs);
  await setStorage({ fb_scheduled_jobs: pruneJobs(jobs) });
  return out;
}

async function pauseQueue(reason, untilMs = null, kind = "manual") {
  await setStorage({ fb_queue_paused: { reason, at: Date.now(), until: untilMs, kind } });
  // Posts already scheduled on Meta would still publish during a warning or a user pause: pull them back.
  if (kind === "restriction" || kind === "manual") { try { await metaPullBack(kind === "restriction" ? "Meta warning" : "queue paused"); } catch (_) {} }
}

async function processDueScheduledJobs() {
  if (inFlightLock || schedulerBusy) return;
  schedulerBusy = true;
  try {
    const st = await getStorage(["fb_scheduled_jobs", "fb_queue_paused", "fb_sched_failures"]);
    const paused = st.fb_queue_paused;
    if (paused) {
      if (paused.until && paused.until <= Date.now()) await setStorage({ fb_queue_paused: null });
      else return;
    }
    const s = await getSafety();
    const now = Date.now();
    const log = await getPublishLog();
    // 1) Housekeeping: stale "running" jobs (worker died mid-post) are never re-posted blindly: a double post is a spam signal.
    // 2) Overdue jobs (AntiGem was closed) are re-slotted instead of being fired back-to-back.
    const pick = await updateJobs(async jobs => {
      for (const j of jobs) if (j.status === "running" && (j.started_at || 0) < now - 30 * 60000) { j.status = "needs_review"; j.last_note = "Posting was interrupted. Check the Page; if it is not there, use fb_manage_queue reschedule."; }
      const due = jobs.filter(j => j.status === "queued" && j.delivery !== "meta" && Number.isFinite(j.run_at_timestamp) && j.run_at_timestamp * 1000 <= now).sort((a, b) => a.run_at_timestamp - b.run_at_timestamp);
      let chosen = null;
      for (const j of due) {
        const kind = jobKind(j.post_type, j.target_type);
        const occ = buildOccupancy(jobs, log, j.job_id);
        const late = now - j.run_at_timestamp * 1000 > s.catchup_grace_minutes * 60000;
        // Gap / daily cap check against what was really published (so manual posts count too).
        const pubOcc = log.map(e => ({ at: e.at, kind: e.kind || "feed" }));
        const blocked = late ? "missed while AntiGem was closed" : (chosen ? "one post per minute tick" : slotProblem(now, kind, pubOcc, { ...s, max_horizon_days: SAFETY_HARD.max_horizon_days }));
        if (!blocked && !chosen) { chosen = j; continue; }
        if (blocked === "one post per minute tick") continue;
        const at = nextSafeSlot(now + 5 * 60000, kind, occ, s);
        if (at) { j.run_at_timestamp = Math.floor(at / 1000); j.last_note = `Moved to ${new Date(at).toLocaleString()} (${blocked}).`; j.moved = (j.moved || 0) + 1; }
        else { j.status = "needs_review"; j.last_note = `No safe slot left (${blocked}).`; }
      }
      if (chosen) { chosen.status = "running"; chosen.started_at = now; chosen.attempts = (chosen.attempts || 0) + 1; }
      return chosen ? { ...chosen } : null;
    });
    if (!pick) return;

    const login = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });
    if (!login.logged_in || login.checkpoint_required) {
      const reason = login.checkpoint_required ? "Facebook asked for a security check" : null;
      await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === pick.job_id); if (j) { j.status = "queued"; j.attempts = Math.max(0, (j.attempts || 1) - 1); j.last_note = reason || "Waiting for Facebook login in the AntiGem browser."; } });
      if (reason) await pauseQueue(`${reason}. Solve it yourself in the AntiGem browser, then resume the queue.`, null, "restriction");
      return;
    }

    let res;
    try {
      res = await dispatchProtectedBrowserTask("fb_publish", {
        id: pick.post_id, title: pick.title, caption: pick.caption, hashtags: pick.hashtags,
        thumbnail_path: pick.thumbnail_path || null, media_paths: pick.media_paths || [],
        post_type: pick.post_type || "text", target_type: pick.target_type || "page", target_id: pick.target_id || null,
        from_scheduler: true
      });
    } catch (e) { res = { success: false, error: e.message }; }

    if (res && (res.in_flight_busy || res.safety_block)) {
      await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === pick.job_id); if (j) { j.status = "queued"; j.attempts = Math.max(0, (j.attempts || 1) - 1); j.run_at_timestamp = Math.floor((Date.now() + 10 * 60000) / 1000); j.last_note = res.error; } });
      return;
    }
    if (res && res.success) {
      await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === pick.job_id); if (j) { j.status = "completed"; j.completed_at = Date.now(); j.result = { fb_post_id: res.fb_post_id, post_url: res.post_url }; } });
      await setStorage({ fb_sched_failures: 0 });
      return;
    }
    const restriction = await detectRestriction(res);
    const failures = (st.fb_sched_failures || 0) + 1;
    await updateJobs(async jobs => {
      const j = jobs.find(x => x.job_id === pick.job_id); if (!j) return;
      j.result = { error: res && res.error };
      if (restriction) { j.status = "queued"; j.last_note = `Paused: ${restriction}`; j.run_at_timestamp = Math.floor((Date.now() + 24 * 3600000) / 1000); return; }
      if (j.attempts < 2) { const at = nextSafeSlot(Date.now() + 45 * 60000, jobKind(j.post_type, j.target_type), buildOccupancy(jobs, log, j.job_id), s); if (at) { j.status = "queued"; j.run_at_timestamp = Math.floor(at / 1000); j.last_note = `Retry at ${new Date(at).toLocaleString()} after: ${res && res.error}`; return; } }
      j.status = "failed"; j.completed_at = Date.now();
    });
    await setStorage({ fb_sched_failures: restriction ? 0 : failures });
    if (restriction) await pauseQueue(`${restriction}. The queue stopped so the Page is not pushed further. Wait at least 24-48 hours, check Page Quality / Account Status in Meta Business Suite, then resume.`, null, "restriction");
    else if (failures >= 3) await pauseQueue("3 posts failed in a row, so the queue paused for 6 hours.", Date.now() + 6 * 3600000, "failures");
  } finally {
    schedulerBusy = false;
  }
}

if (chrome.alarms) {
  chrome.alarms.create("fb_scheduler_tick", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === "fb_scheduler_tick") {
      checkAndAutoResumePendingTask();
      processDueScheduledJobs();
      metaTick().catch(() => {});
    }
  });
}

// Manual posts (fb_publish now) also count toward the Page's day, with hard ceilings nobody can raise.
async function manualPublishGuard(kind, fromScheduler) {
  if (fromScheduler) return null;
  const st = await getStorage(["fb_queue_paused"]);
  if (st.fb_queue_paused && st.fb_queue_paused.kind === "restriction") {
    return { success: false, stop_loop: true, safety_block: true, error: `Posting is paused for account safety: ${st.fb_queue_paused.reason}`, agent_instruction: "Tell the user this in one sentence. Do not retry. Only the user can resume with fb_manage_queue action=resume after checking their Page." };
  }
  const log = await getPublishLog(), today = localDayKey(Date.now());
  const todays = log.filter(e => localDayKey(e.at) === today);
  const hardGapMin = 10;
  if (kind === "profile") {
    if (todays.filter(e => e.kind === "profile").length >= PROFILE_LIMITS.per_day) return { success: false, stop_loop: true, safety_block: true, error: `Safety limit: ${PROFILE_LIMITS.per_day} posts already on your personal profile today. High volume is only for Pages; profiles get restricted much faster.` };
    return null;
  }
  if (kind === "story") {
    if (todays.filter(e => e.kind === "story").length >= SAFETY_HARD.max_stories_per_day) return { success: false, stop_loop: true, safety_block: true, error: `Safety limit: ${SAFETY_HARD.max_stories_per_day} stories already posted today. Schedule it for tomorrow with fb_schedule.` };
    return null;
  }
  const s = await getSafety(), manualCap = Math.min(SAFETY_HARD.max_posts_per_day, Math.max(5, dailyCapFor(Date.now(), s)));
  if (todays.filter(e => isPageKind(e.kind || "feed")).length >= manualCap) return { success: false, stop_loop: true, safety_block: true, error: `Safety limit: ${manualCap} Page posts already published today (today's limit). More can look like spam to Meta, so schedule it with fb_schedule.` };
  const last = log.filter(e => isPageKind(e.kind || "feed")).map(e => e.at).sort((a, b) => b - a)[0];
  if (last && Date.now() - last < hardGapMin * 60000) return { success: false, stop_loop: true, safety_block: true, error: `Safety pause: the last post went out ${Math.round((Date.now() - last) / 60000)} min ago. Posting again within ${hardGapMin} min looks like a burst to Meta; schedule it instead.` };
  return null;
}

async function safetySettingsTool(args = {}) {
  const action = String(args.action || "get").toLowerCase();
  if (action === "reset") await setStorage({ fb_safety_settings: null });
  else if (action === "set") {
    const patch = {};
    for (const k of Object.keys(SAFETY_DEFAULTS)) if (args[k] != null) patch[k] = args[k];
    await saveSafetyPatch(patch);
  }
  const s = await getSafety();
  return { success: true, settings: s, today_cap: dailyCapFor(Date.now(), s), hard_limits: SAFETY_HARD, note: "Values beyond the hard limits are clamped: they cannot be loosened further, only made stricter." };
}

function scheduleList(jobs, limit = 20, statuses = ["queued", "awaiting_login", "running", "needs_review", "handing_off", "scheduled_on_meta"]) {
  return jobs
    .filter(j => statuses.includes(j.status))
    .sort((a, b) => (a.run_at_timestamp || 0) - (b.run_at_timestamp || 0))
    .slice(0, limit)
    .map(j => ({ job_id: j.job_id, post_type: j.post_type, title: j.title, run_at_local: new Date((j.run_at_timestamp || 0) * 1000).toLocaleString(), run_at_iso: new Date((j.run_at_timestamp || 0) * 1000).toISOString(), status: j.status, delivery: j.delivery || "device", note: j.last_note || undefined, target_type: j.target_type, target_id: j.target_id }));
}

async function manageQueue(args = {}) {
  const action = String(args.action || "list").toLowerCase();
  const s = await getSafety();
  const st = await getStorage(["fb_scheduled_jobs", "fb_queue_paused"]);
  const jobs = Array.isArray(st.fb_scheduled_jobs) ? st.fb_scheduled_jobs : [];
  const summary = () => {
    const by = {}; for (const j of jobs) by[j.status] = (by[j.status] || 0) + 1;
    const q = jobs.filter(j => j.status === "queued").map(j => j.run_at_timestamp).sort((a, b) => a - b);
    return { counts: by, next_post_local: q.length ? new Date(q[0] * 1000).toLocaleString() : null, last_post_local: q.length ? new Date(q.at(-1) * 1000).toLocaleString() : null, paused: st.fb_queue_paused || null };
  };
  if (action === "list" || action === "status") return { success: true, ...summary(), upcoming: scheduleList(jobs, args.limit || 20), safety: s };
  if (action === "pause") { await pauseQueue(args.reason || "Paused by the user.", null, "manual"); return { success: true, paused: true }; }
  if (action === "resume") {
    let stepDown = null;
    // After a Meta warning, come back at half the volume and warm up again: pushing the same volume is how blocks become bans.
    if (st.fb_queue_paused && st.fb_queue_paused.kind === "restriction") {
      const lower = Math.max(3, Math.floor(s.max_posts_per_day / 2));
      await saveSafetyPatch({ max_posts_per_day: lower, ramp_start: Date.now() });
      stepDown = { max_posts_per_day: lower, warmup_restarted: lower > WARMUP_STEPS[0] };
    }
    await setStorage({ fb_queue_paused: null, fb_sched_failures: 0 });
    return { success: true, paused: false, step_down: stepDown, message: `Queue resumed${stepDown ? ` at a safer ${stepDown.max_posts_per_day} posts/day (halved after the Meta warning)` : ""}. Overdue posts are spread out to the next safe slots, not posted at once.` };
  }
  if (action === "cancel_all") {
    let n = 0; const errors = [];
    for (const j of jobs) {
      if (j.status === "scheduled_on_meta") { const u = await metaUnschedule(j); if (!u.ok) { errors.push(u.error); continue; } await sleep(500); }
      if (["queued", "scheduled_on_meta"].includes(j.status)) { j.status = "cancelled"; n++; }
    }
    await setStorage({ fb_scheduled_jobs: pruneJobs(jobs) });
    return { success: errors.length === 0, cancelled: n, errors: errors.slice(0, 5) };
  }
  const job = jobs.find(j => String(j.job_id) === String(args.job_id) || String(j.post_id) === String(args.job_id));
  if (!job) return { success: false, error: `Scheduled job not found: ${args.job_id}`, upcoming: scheduleList(jobs, 10) };
  if (["cancel", "reschedule", "run_now"].includes(action) && job.status === "scheduled_on_meta") {
    const u = await metaUnschedule(job);
    if (!u.ok) return { success: false, error: u.error };
    job.status = "queued";
  }
  if (action === "cancel") job.status = "cancelled";
  else if (action === "reschedule" || action === "run_now") {
    const asked = action === "run_now" ? Date.now() + 60000 : parseWhen({ schedule_time_iso: args.new_schedule_time_iso });
    if (!asked || Number.isNaN(asked)) return { success: false, error: "new_schedule_time_iso must be an ISO date/time, e.g. 2026-11-22T09:00:00+05:30" };
    const occ = buildOccupancy(jobs, await getPublishLog(), job.job_id), kind = jobKind(job.post_type, job.target_type);
    const problem = slotProblem(Math.max(asked, Date.now() + 60000), kind, occ, s);
    const at = problem ? nextSafeSlot(Math.max(asked, Date.now() + 60000), kind, occ, s) : Math.max(asked, Date.now() + 60000);
    if (!at) return { success: false, error: "No safe slot available under the safety limits." };
    job.run_at_timestamp = Math.floor(at / 1000); job.status = "queued"; job.attempts = 0; job.last_note = problem ? `Moved for safety: ${problem}` : undefined;
  } else return { success: false, error: "action must be list, status, cancel, cancel_all, reschedule, run_now, pause or resume" };
  await setStorage({ fb_scheduled_jobs: pruneJobs(jobs) });
  return { success: true, action, job: scheduleList([job], 1, [job.status])[0], upcoming: scheduleList(jobs, 10) };
}

// ============================================================================
// 8b. Meta Native Scheduling (official Graph API = the scheduler behind Meta Business Suite Planner)
// ============================================================================
// Posts are created on Meta's servers as scheduled posts (published=false + scheduled_publish_time). Meta publishes
// them itself, they appear in Business Suite > Planner, and no browser automation runs at posting time.
// Timing still comes from the Page Safety Governor. Personal profiles, groups, reels and stories stay on "device".
const GRAPH_URL = "https://graph.facebook.com";
const GRAPH_VIDEO_URL = "https://graph-video.facebook.com";
const META_MAX_DAYS = 28;            // Meta accepts scheduled posts 10 min to ~30 days ahead; later posts are handed over when they get close
const META_MIN_LEAD_MIN = 15;
const META_HANDOFF_PER_TICK = 3;     // gentle API pace: about 3 posts per minute
const META_PHOTO_MAX = 10 * 1024 * 1024;
const META_VIDEO_MAX = 150 * 1024 * 1024;
let metaBusy = false;

function graphErrorKind(err = {}) {
  const c = Number(err.code), sub = Number(err.error_subcode), msg = String(err.message || "");
  if (c === 190 || c === 102 || [458, 459, 460, 463, 464, 467, 492].includes(sub)) return "TOKEN";
  if (c === 368 || RESTRICTION_RE.test(msg)) return "RESTRICTED";
  if ([4, 17, 32, 613, 80001].includes(c) || /rate limit|too many calls|request limit/i.test(msg)) return "RATE_LIMIT";
  if (c === 10 || (c >= 200 && c < 300)) return "PERMISSION";
  return "OTHER";
}

async function graphCall(method, path, token, params = {}, opts = {}) {
  const url = new URL(`${opts.video ? GRAPH_VIDEO_URL : GRAPH_URL}/${String(path).replace(/^\/+/, "")}`);
  const init = { method };
  if (method === "GET" || method === "DELETE") {
    for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
    url.searchParams.set("access_token", token);
  } else {
    const fd = new FormData();
    for (const [k, v] of Object.entries(params)) if (v != null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    if (opts.file) fd.append("source", opts.file.blob, opts.file.name);
    fd.append("access_token", token);
    init.body = fd;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.video ? 15 * 60000 : 120000);
  try {
    const r = await fetch(url.toString(), { ...init, signal: ac.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) {
      const e = new Error((data.error && data.error.message) || `Meta API HTTP ${r.status}`);
      e.graph = data.error || { code: r.status }; e.kind = graphErrorKind(e.graph);
      throw e;
    }
    return data;
  } catch (e) {
    if (!e.kind) { e.kind = "NETWORK"; }
    throw e;
  } finally { clearTimeout(timer); }
}

async function getMetaConn() {
  const st = await getStorage(["fb_meta_conn"]);
  const c = st.fb_meta_conn || {};
  return { pages: Array.isArray(c.pages) ? c.pages : [], default_page_id: c.default_page_id || null, token_error: c.token_error || null, long_lived: Boolean(c.long_lived), connected_at: c.connected_at || null, backoff_until: c.backoff_until || 0 };
}
async function saveMetaConn(patch) { const cur = await getMetaConn(); await setStorage({ fb_meta_conn: { ...cur, ...patch } }); }
function maskPages(pages) { return pages.map(p => ({ id: p.id, name: p.name })); }

// Map a job's target to a connected Page. Unknown targets never fall back to another Page (no posting to the wrong Page).
function resolveMetaPage(conn, job) {
  if (String(job.target_type || "page").toLowerCase() !== "page" || !conn.pages.length || conn.token_error) return null;
  const t = String(job.target_id || "").trim().toLowerCase();
  if (!t || t === "me") return conn.pages.find(p => p.id === conn.default_page_id) || (conn.pages.length === 1 ? conn.pages[0] : null);
  return conn.pages.find(p => t === p.id || t === String(p.name).toLowerCase() || t.includes(`/${p.id}`) || t.includes(`id=${p.id}`) || (p.username && t.includes(String(p.username).toLowerCase()))) || null;
}
function metaSupports(job) {
  const t = String(job.post_type || "text").toLowerCase();
  return ["text", "photo", "carousel", "video", "link"].includes(t);
}
function chooseDelivery(conn, job, asked) {
  const want = String(asked || "auto").toLowerCase();
  if (want === "device") return "device";
  const ok = resolveMetaPage(conn, job) && metaSupports(job);
  if (want === "meta" && !ok) return "device";
  return ok ? "meta" : "device";
}

async function loadMediaFile(path) {
  const r = await resolveLocalFile(path);
  const name = String(r.path).split("/").pop();
  const ext = name.split(".").pop().toLowerCase();
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4", webm: "video/webm" }[ext] || "application/octet-stream";
  const video = mime.startsWith("video/");
  const st = await chrome.antigem.stat({ path: r.path });
  if (st.size > (video ? META_VIDEO_MAX : META_PHOTO_MAX)) throw Object.assign(new Error(`${name} is too large for Meta scheduling (${Math.round(st.size / 1048576)} MB)`), { kind: "MEDIA" });
  const b64 = await chrome.antigem.readFile({ path: r.path, encoding: "base64" });
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { name, mime, video, blob: new Blob([bytes], { type: mime }) };
}

// whenMs = null publishes now; otherwise schedules on Meta.
async function metaCreatePost(page, job, whenMs) {
  const sched = whenMs ? { published: "false", scheduled_publish_time: String(Math.floor(whenMs / 1000)) } : { published: "true" };
  const message = String(job.caption || "");
  const media = job.media_paths || [];
  if (!media.length) {
    const r = await graphCall("POST", `${page.id}/feed`, page.token, { message, link: job.link || null, ...sched });
    return { id: r.id, post_id: r.id };
  }
  const files = [];
  for (const p of media) files.push(await loadMediaFile(p));
  if (files.some(f => f.video)) {
    if (files.length > 1) throw Object.assign(new Error("Meta scheduling takes one video per post"), { kind: "MEDIA" });
    const r = await graphCall("POST", `${page.id}/videos`, page.token, { description: message, title: job.title || null, ...sched }, { video: true, file: files[0] });
    return { id: r.id, post_id: r.post_id || null };
  }
  if (files.length === 1) {
    const r = await graphCall("POST", `${page.id}/photos`, page.token, { caption: message, ...sched }, { file: files[0] });
    return { id: r.id, post_id: r.post_id || null };
  }
  const ids = [];
  for (const f of files) { const r = await graphCall("POST", `${page.id}/photos`, page.token, { published: "false", temporary: whenMs ? "true" : null }, { file: f }); ids.push(r.id); await sleep(600); }
  const params = { message, ...sched };
  ids.forEach((id, i) => { params[`attached_media[${i}]`] = { media_fbid: id }; });
  const r = await graphCall("POST", `${page.id}/feed`, page.token, params);
  return { id: r.id, post_id: r.id };
}

async function handleMetaError(e, job) {
  if (e.kind === "TOKEN" || e.kind === "PERMISSION") {
    await saveMetaConn({ token_error: `${e.message} Reconnect with fb_meta_connect.` });
    return "stop";
  }
  if (e.kind === "RESTRICTED") {
    await pauseQueue(`Meta refused a post: "${e.message}". The queue stopped and future posts were pulled back from Meta. Wait 24-48 hours, check Page Quality in Meta Business Suite, then resume.`, null, "restriction");
    return "stop";
  }
  if (e.kind === "RATE_LIMIT" || e.kind === "NETWORK") { await saveMetaConn({ backoff_until: Date.now() + (e.kind === "RATE_LIMIT" ? 60 : 10) * 60000 }); return "stop"; }
  return "fail";
}

// Hand queued "meta" jobs to Meta once they are inside Meta's scheduling window; verify ones whose time has passed.
async function metaTick() {
  if (metaBusy) return;
  metaBusy = true;
  try {
    const conn = await getMetaConn();
    if (!conn.pages.length || conn.token_error || conn.backoff_until > Date.now()) return;
    const st = await getStorage(["fb_queue_paused", "fb_scheduled_jobs"]);
    const s = await getSafety(), now = Date.now();
    if (!st.fb_queue_paused) {
      const jobs0 = Array.isArray(st.fb_scheduled_jobs) ? st.fb_scheduled_jobs : [];
      const ids = jobs0.filter(j => j.status === "queued" && j.delivery === "meta" && j.run_at_timestamp * 1000 <= now + META_MAX_DAYS * 86400000)
        .sort((a, b) => a.run_at_timestamp - b.run_at_timestamp).slice(0, META_HANDOFF_PER_TICK).map(j => j.job_id);
      for (const id of ids) {
        const log = await getPublishLog();
        const job = await updateJobs(async jobs => {
          const j = jobs.find(x => x.job_id === id); if (!j || j.status !== "queued") return null;
          const kind = jobKind(j.post_type, j.target_type), occ = buildOccupancy(jobs, log, j.job_id);
          let at = j.run_at_timestamp * 1000;
          // Re-check the slot at hand-off time (limits may have been lowered, or AntiGem was closed past the slot).
          const problem = at < now + META_MIN_LEAD_MIN * 60000 ? "too close to schedule on Meta" : slotProblem(at, kind, occ, s);
          if (problem) {
            at = nextSafeSlot(Math.max(at, now + (META_MIN_LEAD_MIN + 5) * 60000), kind, occ, s);
            if (!at) { j.status = "needs_review"; j.last_note = `No safe slot (${problem}).`; return null; }
            j.run_at_timestamp = Math.floor(at / 1000); j.last_note = `Moved to ${new Date(at).toLocaleString()} (${problem}).`;
            if (at > now + META_MAX_DAYS * 86400000) return null;
          }
          j.status = "handing_off"; j.handoff_started = now;
          return { ...j };
        });
        if (!job) continue;
        const page = resolveMetaPage(conn, job);
        if (!page) { await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === id); if (j) { j.status = "queued"; j.delivery = "device"; j.last_note = "No connected Page matches this target; it will post from this device."; } }); continue; }
        try {
          const r = await metaCreatePost(page, job, job.run_at_timestamp * 1000);
          await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === id); if (j) { j.status = "scheduled_on_meta"; j.meta_id = r.id; j.meta_post_id = r.post_id; j.meta_page_id = page.id; j.handed_off_at = Date.now(); j.last_note = `Scheduled on Meta (visible in Business Suite Planner) for ${new Date(j.run_at_timestamp * 1000).toLocaleString()}.`; } });
        } catch (e) {
          const action = await handleMetaError(e, job);
          await updateJobs(async jobs => {
            const j = jobs.find(x => x.job_id === id); if (!j) return;
            j.status = "queued"; j.result = { error: e.message, code: e.graph && e.graph.code };
            if (action === "fail") { j.meta_attempts = (j.meta_attempts || 0) + 1; if (j.meta_attempts >= 2 || e.kind === "MEDIA") { j.status = "failed"; j.completed_at = Date.now(); } j.last_note = `Meta rejected it: ${e.message}`; }
          });
          if (action === "stop") return;
        }
        await sleep(2500);
      }
    }
    // Verify posts whose time has passed (Meta published them on its own).
    const due = ((await getStorage(["fb_scheduled_jobs"])).fb_scheduled_jobs || []).filter(j => j.status === "scheduled_on_meta" && j.run_at_timestamp * 1000 < now - 20 * 60000).slice(0, 5);
    for (const d of due) {
      const page = conn.pages.find(p => p.id === d.meta_page_id);
      if (!page) continue;
      let ok = null, url = null;
      try { const r = await graphCall("GET", d.meta_post_id || d.meta_id, page.token, { fields: "id,permalink_url" }); ok = true; url = r.permalink_url || null; }
      catch (e) { if (e.kind === "TOKEN" || e.kind === "PERMISSION") { await handleMetaError(e, d); return; } if (e.kind === "RATE_LIMIT" || e.kind === "NETWORK") return; ok = false; }
      await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === d.job_id); if (!j) return; if (ok) { j.status = "completed"; j.completed_at = Date.now(); j.result = { meta_id: d.meta_id, post_url: url }; } else { j.status = "needs_review"; j.last_note = "Not found on Meta after its time. Check Business Suite > Planner / Published."; } });
      if (ok) await recordPublishLog(jobKind(d.post_type, d.target_type), d.run_at_timestamp * 1000);
    }
    // A hand-off interrupted mid-upload: check Meta's list is impossible without the id, so ask for a manual look instead of re-posting.
    await updateJobs(async jobs => { for (const j of jobs) if (j.status === "handing_off" && (j.handoff_started || 0) < now - 20 * 60000) { j.status = "needs_review"; j.last_note = "Hand-off to Meta was interrupted. Check Business Suite > Planner; if the post is not there, reschedule it."; } });
  } finally { metaBusy = false; }
}

async function metaUnschedule(job) {
  if (job.status !== "scheduled_on_meta" || !job.meta_id) return { ok: true };
  const conn = await getMetaConn(), page = conn.pages.find(p => p.id === job.meta_page_id);
  if (!page) return { ok: false, error: "The Page this post was scheduled on is no longer connected. Remove it in Business Suite > Planner." };
  try { await graphCall("DELETE", job.meta_id, page.token); }
  catch (e) { if (!(e.graph && Number(e.graph.code) === 100)) return { ok: false, error: `Meta did not remove it: ${e.message}` }; }
  job.meta_id = null; job.meta_post_id = null;
  return { ok: true };
}

// Pull future posts back from Meta (pause / warning): Meta would otherwise keep publishing while the Page is under a warning.
async function metaPullBack(reason) {
  const conn = await getMetaConn();
  if (!conn.pages.length) return 0;
  const jobs0 = ((await getStorage(["fb_scheduled_jobs"])).fb_scheduled_jobs || []).filter(j => j.status === "scheduled_on_meta" && j.run_at_timestamp * 1000 > Date.now() + 5 * 60000);
  let n = 0;
  for (const j0 of jobs0) {
    const page = conn.pages.find(p => p.id === j0.meta_page_id); if (!page) continue;
    try { await graphCall("DELETE", j0.meta_id, page.token); }
    catch (e) { if (e.kind === "TOKEN" || e.kind === "PERMISSION" || e.kind === "RATE_LIMIT") break; if (e.kind === "NETWORK") break; }
    await updateJobs(async jobs => { const j = jobs.find(x => x.job_id === j0.job_id); if (j) { j.status = "queued"; j.meta_id = null; j.meta_post_id = null; j.last_note = `Pulled back from Meta: ${reason}`; } });
    n++; await sleep(700);
  }
  return n;
}

async function readCredentialFile(path) {
  if (!path) return {};
  const text = String(await chrome.antigem.readFile({ path, encoding: "utf8" })).trim();
  try { return JSON.parse(text); } catch (_) { return { access_token: text }; }
}

async function metaConnect(args = {}) {
  const file = await readCredentialFile(args.credentials_file);
  const pageToken = args.page_access_token || file.page_access_token || null;
  let userToken = args.user_access_token || file.user_access_token || (pageToken ? null : file.access_token) || null;
  const appId = args.app_id || file.app_id, appSecret = args.app_secret || file.app_secret;
  if (!pageToken && !userToken) return { success: false, error: "Give user_access_token (+ app_id and app_secret for a token that does not expire) or page_access_token, or a credentials_file path.", setup: META_SETUP_GUIDE };
  let pages = [], longLived = false;
  try {
    if (userToken) {
      if (appId && appSecret) {
        const ex = await graphCall("GET", "oauth/access_token", userToken, { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: userToken });
        if (ex.access_token) { userToken = ex.access_token; longLived = true; }
      }
      const res = await graphCall("GET", "me/accounts", userToken, { fields: "id,name,username,access_token,tasks", limit: 100 });
      pages = (res.data || []).filter(p => p.access_token && (!p.tasks || p.tasks.includes("CREATE_CONTENT") || p.tasks.includes("MANAGE"))).map(p => ({ id: p.id, name: p.name, username: p.username || null, token: p.access_token }));
    } else {
      const me = await graphCall("GET", "me", pageToken, { fields: "id,name,username" });
      pages = [{ id: me.id, name: me.name, username: me.username || null, token: pageToken }];
      longLived = Boolean(args.long_lived);
    }
    if (!pages.length) return { success: false, error: "No Pages with posting rights were found for this token. When generating the token, tick pages_show_list, pages_read_engagement and pages_manage_posts and select your Page.", setup: META_SETUP_GUIDE };
    // Permission check without posting anything.
    await graphCall("GET", `${pages[0].id}/scheduled_posts`, pages[0].token, { limit: 1 });
  } catch (e) {
    return { success: false, error: `Meta did not accept the token: ${e.message}`, setup: META_SETUP_GUIDE };
  }
  const conn = await getMetaConn();
  const def = args.default_page || conn.default_page_id;
  const defPage = pages.find(p => p.id === def || String(p.name).toLowerCase() === String(def || "").toLowerCase()) || pages[0];
  await setStorage({ fb_meta_conn: { pages, default_page_id: defPage.id, long_lived: longLived, connected_at: Date.now(), token_error: null, backoff_until: 0 } });
  // Only Page tokens are kept (no user token, no app secret). Wipe the credentials file so the secret does not stay on disk.
  let wiped = false;
  if (args.credentials_file && args.wipe_credentials_file !== false) { try { await chrome.antigem.writeFile({ path: args.credentials_file, data: "" }); wiped = true; } catch (_) {} }
  return {
    credentials_file_wiped: wiped,
    stored: "Only Page access tokens for the listed Pages (no user token, no app secret).",
    success: true, pages: maskPages(pages), default_page: { id: defPage.id, name: defPage.name }, long_lived: longLived,
    note: longLived || pageToken ? "Connected. Scheduled posts now go to Meta's own scheduler (Business Suite > Planner)." : "Connected with a short-lived token (about 1 hour). Posts already handed to Meta still publish, but add app_id + app_secret for a token that does not expire.",
    agent_instruction: "Tell the user it is connected and which Page is the default, in one or two sentences. Never repeat any token."
  };
}

async function metaStatus() {
  const conn = await getMetaConn();
  const jobs = (await getStorage(["fb_scheduled_jobs"])).fb_scheduled_jobs || [];
  let live = null;
  const page = conn.pages.find(p => p.id === conn.default_page_id);
  if (page && !conn.token_error) { try { await graphCall("GET", "me", page.token, { fields: "id" }); live = true; } catch (e) { live = false; if (e.kind === "TOKEN") await saveMetaConn({ token_error: `${e.message} Reconnect with fb_meta_connect.` }); } }
  return {
    success: true, connected: conn.pages.length > 0 && !conn.token_error && live !== false, pages: maskPages(conn.pages), default_page_id: conn.default_page_id,
    long_lived: conn.long_lived, token_error: conn.token_error, backoff_until: conn.backoff_until > Date.now() ? new Date(conn.backoff_until).toLocaleString() : null,
    on_meta: jobs.filter(j => j.status === "scheduled_on_meta").length, waiting_for_meta_window: jobs.filter(j => j.status === "queued" && j.delivery === "meta").length,
    setup: conn.pages.length ? undefined : META_SETUP_GUIDE,
    note: "OPTIONAL and not needed: posting and scheduling (up to 29 days) already run through Meta Business Suite. Do not bring this up unless the user asks for the Graph API."
  };
}

async function metaDisconnect(args = {}) {
  let pulled = 0;
  if (args.pull_back !== false) pulled = await metaPullBack("Meta connection removed");
  await setStorage({ fb_meta_conn: null });
  const n = await updateJobs(async jobs => { let c = 0; for (const j of jobs) if (j.status === "queued" && j.delivery === "meta") { j.delivery = "device"; c++; } return c; });
  return { success: true, pulled_back: pulled, moved_to_device: n };
}

const META_SETUP_GUIDE = [
  "One-time setup (about 10 minutes, free, no App Review needed for your own Pages):",
  "1. Open developers.facebook.com > My Apps > Create App > choose 'Business'. Any name.",
  "2. Tools > Graph API Explorer > pick your app > 'Get Token' > 'Get User Access Token'. Tick pages_show_list, pages_read_engagement, pages_manage_posts (and business_management if the Page is in a Business portfolio). Generate and allow it for your Page.",
  "3. App settings > Basic: copy the App ID and App Secret.",
  "4. Save them in a file such as ~/meta-credentials.json as {\"user_access_token\":\"...\",\"app_id\":\"...\",\"app_secret\":\"...\"} and give only the file path to fb_meta_connect {credentials_file}. The app secret is used once, the file is wiped after connecting, and only Page tokens are kept.",
  "No app secret option: in Graph API Explorer run GET me/accounts with your user token after extending it in the Access Token Debugger (developers.facebook.com/tools/debug/accesstoken > Extend Access Token), copy your Page's access_token, and save just {\"page_access_token\":\"...\"} in the file.",
  "Tokens can be revoked any time in Facebook Settings > Business integrations."
].join("\n");

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
// META SUITE LAYER (v2.4.1): managed Page routing, queue manager, viral SEO,
// algorithm audit, live trend radar and DeepX Google Flow media tools.
// ============================================================================

const META_PAGES_URL = "https://www.facebook.com/pages/?category=your_pages";
const PAGE_EXCLUDE = /^\/(pages|groups|watch|marketplace|gaming|events|bookmarks|friends|help|settings|business|ads|latest|reel|reels|stories|notifications|messages|search|photo|photos|videos|hashtag|privacy|policies|login|recover|me|profile\.php\?id=$)/i;

async function tabUrl(tabId) { try { return (await chrome.tabs.get(tabId)).url || ""; } catch (_) { return ""; } }

async function discoverManagedPages(tabId, { refresh = false } = {}) {
  const store = await getStorage(["meta_pages", "meta_pages_at"]);
  if (!refresh && Array.isArray(store.meta_pages) && store.meta_pages.length && Date.now() - (store.meta_pages_at || 0) < 6 * 3600 * 1000) {
    return store.meta_pages;
  }
  const back = await tabUrl(tabId);
  await chrome.tabs.update(tabId, { url: META_PAGES_URL, active: true });
  await waitForTabComplete(tabId, 20000);
  let pages = [];
  for (let attempt = 0; attempt < 8 && !pages.length; attempt++) {
    await sleep(900);
    const [res] = await chrome.scripting.executeScript({
      world: "MAIN", target: { tabId }, args: [PAGE_EXCLUDE.source],
      func: (excludeSrc) => {
        const exclude = new RegExp(excludeSrc, "i");
        const main = document.querySelector('[role="main"]') || document.body;
        const out = new Map();
        for (const a of main.querySelectorAll('a[href]')) {
          let u; try { u = new URL(a.href, location.href); } catch (_) { continue; }
          if (!/(^|\.)facebook\.com$/.test(u.hostname)) continue;
          const path = u.pathname.replace(/\/+$/, "") + (u.pathname.startsWith("/profile.php") ? `?id=${u.searchParams.get("id")}` : "");
          if (!path || path === "" || exclude.test(path + "/") || path.split("/").length > 2) continue;
          const name = (a.innerText || a.getAttribute("aria-label") || "").split("\n")[0].replace(/^profile picture for\s+/i, "").trim();
          if (!name || name.length < 2 || name.length > 90 || /^(see all|create|create post|create page|more|home|pages?|settings|manage|invite|boost|promote)$/i.test(name)) continue;
          const url = `https://www.facebook.com${path}`;
          if (!out.has(url)) out.set(url, { name, url, id: u.searchParams.get("id") || path.slice(1) });
        }
        return [...out.values()].slice(0, 25);
      }
    }).catch(() => [{ result: [] }]);
    pages = res?.result || [];
  }
  await setStorage({ meta_pages: pages, meta_pages_at: Date.now() });
  if (back && isFacebookUrl(back) && back !== META_PAGES_URL) {
    await chrome.tabs.update(tabId, { url: back }).catch(() => {});
    await waitForTabComplete(tabId, 15000).catch(() => {});
  }
  return pages;
}

function cleanStoredPage(p) { return p ? { ...p, name: String(p.name || "").replace(/^profile picture for\s+/i, "").trim() } : p; }
async function resolveTargetPage(tabId, targetId) {
  const raw = String(targetId || "").trim();
  if (raw && raw !== "me" && raw !== "default") {
    const url = raw.startsWith("http") ? raw : /^\d+$/.test(raw) ? `https://www.facebook.com/profile.php?id=${raw}` : `https://www.facebook.com/${raw.replace(/^@/, "")}`;
    const known = ((await getStorage(["meta_pages"])).meta_pages || []).find(p => p.url === url || p.id === raw || p.name.toLowerCase() === raw.toLowerCase());
    return known || { name: raw, url, id: raw };
  }
  const store = await getStorage(["meta_default_page"]);
  if (store.meta_default_page?.url) return store.meta_default_page;
  const pages = await discoverManagedPages(tabId);
  if (!pages.length) return null;
  await setStorage({ meta_default_page: pages[0] });
  return pages[0];
}

/** New Pages Experience: switch the whole Facebook session into the Page so every composer posts AS the Page. */
async function ensureActingAsPage(tabId, targetId) {
  const page = await resolveTargetPage(tabId, targetId);
  if (!page) {
    const err = new Error("No managed Facebook Page was found for this account. Create a Page or pass target_id (Page URL / ID), or call meta_set_default_page.");
    err.code = "NO_MANAGED_PAGE";
    throw err;
  }
  const cur = await tabUrl(tabId);
  if (!cur.startsWith(page.url)) {
    await chrome.tabs.update(tabId, { url: page.url, active: true });
    await waitForTabComplete(tabId, 20000);
    await sleep(1200);
  }
  const findSwitch = async () => {
    const [r] = await chrome.scripting.executeScript({
      world: "MAIN", target: { tabId },
      func: () => {
        const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 6 && b.height > 6 && s.visibility !== "hidden" && s.display !== "none"; };
        const els = [...document.querySelectorAll('div[role="button"], button, a[role="link"], span[role="button"]')].filter(vis);
        const hit = els.find(el => /^(switch now|switch|switch profiles?|switch into .{1,60}|switch to .{1,60}|use (facebook )?as .{1,60})$/i.test((el.innerText || el.getAttribute("aria-label") || "").trim()));
        if (!hit) return { found: false };
        const b = hit.getBoundingClientRect(), v = window.visualViewport;
        return { found: true, label: (hit.innerText || hit.getAttribute("aria-label") || "").trim(), fx: (b.left + b.width / 2 - (v?.offsetLeft || 0)) / (v?.width || innerWidth), fy: (b.top + b.height / 2 - (v?.offsetTop || 0)) / (v?.height || innerHeight) };
      }
    }).catch(() => [{ result: { found: false } }]);
    return r?.result || { found: false };
  };
  let switched = false, last = await findSwitch();
  for (let i = 0; i < 4 && last.found; i++) {
    const tapped = await trustedTap(tabId, last);
    if (!tapped) {
      await chrome.scripting.executeScript({ world: "MAIN", target: { tabId }, args: [last.label], func: (label) => { const el = [...document.querySelectorAll('div[role="button"], button')].find(e => (e.innerText || e.getAttribute("aria-label") || "").trim() === label); el?.click(); } }).catch(() => {});
    }
    switched = true;
    await sleep(1800);
    await waitForTabComplete(tabId, 15000).catch(() => {});
    await sleep(1200);
    last = await findSwitch();
  }
  if (last.found) {
    const err = new Error(`Could not switch into the Page "${page.name}". Open ${page.url} in the AntiGem browser, tap "Switch" once, then retry.`);
    err.code = "PAGE_SWITCH_FAILED";
    throw err;
  }
  await setStorage({ meta_acting_page: { ...page, at: Date.now() } });
  return { page, switched };
}


const META_HOOKS = [
  t => `Nobody tells you this about ${t}.`,
  t => `Stop scrolling: ${t} is not what you think.`,
  t => `I wish I knew this about ${t} 5 years ago.`,
  t => `The ${t} mistake 90% of people make.`,
  t => `${t} in 30 seconds (save this).`
];
function metaViralSeo(args = {}) {
  const topic = String(args.topic || "Growth").trim();
  const type = String(args.video_type || args.format || "reel").toLowerCase();
  const base = generateViralSeo({ ...args, topic, post_type: type === "long_video" ? "video" : type });
  const hooks = META_HOOKS.map(f => f(topic));
  const platform = String(args.target_platform || "business_suite");
  const hashtagCap = type === "reel" || type === "story" ? 5 : 6;
  return {
    ...base,
    hashtags: (base.hashtags || []).slice(0, hashtagCap),
    format: type, target_platform: platform,
    retention_hook_line_1: hooks[0],
    alternative_hooks: hooks.slice(1),
    comment_trigger_cta: `Comment "${topic.split(/\s+/)[0].toUpperCase()}" and I'll send you the full breakdown.`,
    first_3_seconds_script: type === "reel" || type === "video" || type === "long_video" ? `[0-1s] Bold on-screen text: "${hooks[0]}"\n[1-3s] Show the result first, then the problem.` : null,
    posting_window_tip: "Best organic windows: 7-9 AM, 12-1 PM and 7-10 PM in your audience's local time; reply to every comment in the first 60 minutes.",
    audience_persona: args.audience_persona || "ambitious_practitioner",
    algorithm_notes: ["No outbound links in the caption (use first comment)", "Line 1 must work before 'See more'", "3-6 targeted hashtags", "Native upload, no watermarks from other apps"]
  };
}

function metaAlgorithmAudit(args = {}) {
  const a = auditFacebookCaption(args.caption || "", args.title || "");
  const lines = String(args.caption || "").split("\n");
  const firstLine = (lines.find(l => l.trim()) || "").trim();
  const penalties = [...a.penalties], suggestions = [...a.suggestions];
  let score = a.seo_score;
  if (firstLine.length > 125) { score -= 10; penalties.push("Line 1 longer than 125 characters: the hook is cut by 'See more' (-10)."); suggestions.push("Put a ≤ 90-character hook on line 1."); }
  if (/\b(like|share|tag|comment)\b.*\b(win|giveaway|if you agree)\b/i.test(args.caption || "")) { score -= 15; penalties.push("Engagement-bait phrasing detected (-15): Meta demotes 'like/share/tag if…' prompts."); suggestions.push("Ask a genuine open question instead."); }
  if (!/\?/.test(args.caption || "")) { score -= 5; suggestions.push("End with a real question to trigger comments (+reach)."); }
  score = Math.max(5, Math.min(100, score));
  const tier = score >= 90 ? "2M-20M viral potential" : score >= 75 ? "100K-2M strong reach" : score >= 55 ? "10K-100K average" : "below 10K (fix penalties first)";
  return { ...a, seo_score: score, viral_reach_tier: tier, retention_hook: firstLine.slice(0, 140), penalties, suggestions, is_ready_for_publish: score >= 70 };
}

const VIRAL_TRIGGERS = ["why", "how", "secret", "truth", "hidden", "mystery", "shock", "forbidden", "banned", "myth", "real reason", "history", "ancient", "future", "brain", "money", "death", "disaster", "first", "million", "billion", "solved", "paradox"];
function scoreTrend(title, weight = 1) {
  const t = String(title).toLowerCase();
  let s = 50 * weight;
  for (const k of VIRAL_TRIGGERS) if (new RegExp(`\\b${k.replace(/ /g, "\\s")}\\b`).test(t)) s += 7.5;
  if (title.length >= 35 && title.length <= 120) s += 10; else if (title.length < 20) s -= 10;
  if (title.includes("?")) s += 6;
  if (/ vs\.? |: | - /.test(title)) s += 5;
  return Math.round(Math.min(99, Math.max(20, s)) * 10) / 10;
}
const decodeXml = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
async function fetchText(url, ms = 8000) {
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal, headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36", "Accept": "*/*" } }); return r.ok ? await r.text() : null; } catch (_) { return null; } finally { clearTimeout(timer); }
}
async function scanGoogleTrends(geos, limit) {
  const out = [];
  await Promise.all(geos.map(async geo => {
    const xml = await fetchText(`https://trends.google.com/trending/rss?geo=${geo}`);
    if (!xml) return;
    for (const item of xml.split("<item>").slice(1, limit + 1)) {
      const title = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const traffic = decodeXml((item.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1]);
      if (title) out.push({ platform: "google_youtube", source: `Google/YouTube Trends (${geo})`, title, traffic, link: `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`, score: scoreTrend(title, 1) });
    }
  }));
  return out;
}
async function scanReddit(subs, limit) {
  const out = [];
  await Promise.all(subs.map(async sub => {
    const txt = await fetchText(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`);
    try {
      for (const c of JSON.parse(txt).data.children.slice(0, limit)) {
        const raw = c.data.title || "", title = raw.replace(/^(TIL (that|about|how)|ELI5:?|YSK:?)\s*/i, "").trim();
        if (title && !c.data.stickied) out.push({ platform: "reddit", source: `r/${sub}`, title, upvotes: c.data.ups, link: `https://www.reddit.com${c.data.permalink}`, score: scoreTrend(title, 1.1) });
      }
    } catch (_) {}
  }));
  return out;
}
async function scanTwitter(regions, limit) {
  const out = [];
  await Promise.all(regions.map(async reg => {
    const html = await fetchText(`https://trends24.in/${reg}/`);
    if (!html) return;
    const seen = new Set();
    for (const m of html.matchAll(/<a[^>]*class="trend-link"[^>]*>([^<]+)<\/a>|>([^<]{3,80})<\/a><\/li>/g)) {
      const t = decodeXml(m[1] || m[2]);
      if (!t || seen.has(t) || t.startsWith("&")) continue; seen.add(t);
      out.push({ platform: "twitter_x", source: `X trends (${reg})`, title: t, link: `https://x.com/search?q=${encodeURIComponent(t)}`, score: scoreTrend(t, 0.95) });
      if (seen.size >= limit) break;
    }
  }));
  return out;
}
function blueprintFor(title) {
  return [
    `[Stage 1: Golden Hook 0-5s] Why does "${title.slice(0, 60)}" contradict what everyone believes?`,
    "[Stage 2: Disrupt Assumptions 5-20s] Break the common myth with one striking fact or visual.",
    "[Stage 3: Unveil Insider Secrets 20-45s] Reveal the hidden mechanism, data or story behind it.",
    "[Stage 4: Ultimate Truth 45-65s] The epiphany: what really happened / what it means for the viewer.",
    "[Stage 5: Elevation & Discussion 65-75s] Ask a genuine question that invites comments."
  ];
}
async function trendSearch(args = {}) {
  const limit = Math.max(1, Math.min(15, Number(args.limit) || 5));
  const src = String(args.sources || "all").toLowerCase();
  const want = k => src === "all" || src.includes(k);
  const [g, r, x] = await Promise.all([
    want("youtube") || want("google") ? scanGoogleTrends(["IN", "US", "GB"], limit * 2) : [],
    want("reddit") ? scanReddit(["todayilearned", "Damnthatsinteresting", "science", "technology", "history", "explainlikeimfive"], limit) : [],
    want("twitter") || want("x") ? scanTwitter(["india", "united-states"], limit * 2) : []
  ]);
  let all = [...g, ...r, ...x];
  const kw = String(args.keywords || "").toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
  if (kw.length) all = all.map(t => ({ ...t, score: t.score + (kw.some(k => t.title.toLowerCase().includes(k)) ? 15 : 0) }));
  const seen = new Set();
  const ranked = all.sort((a, b) => b.score - a.score).filter(t => { const k = t.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit * 3);
  if (!ranked.length) return { success: false, error: "No trend sources were reachable right now (network). Try again in a minute.", trends: [] };
  const top = ranked.slice(0, limit).map(t => ({ ...t, virality_score: Math.min(99, t.score), blueprint: blueprintFor(t.title), seo_hint: metaViralSeo({ topic: t.title, video_type: "reel" }).title }));
  return { success: true, scanned: { google_youtube: g.length, reddit: r.length, twitter_x: x.length }, keywords: args.keywords || null, trends: top };
}

// ---- Google Flow media through the built-in DeepX engine
const META_IMAGE_MODEL = v => { const s = String(v || "").toLowerCase(); return s.includes("pro") ? "Nano Banana Pro" : s.includes("lite") ? "Nano Banana 2 Lite" : "Nano Banana 2.1"; };
const META_VIDEO_MODEL = v => { const s = String(v || "").toLowerCase(); return s.includes("quality") ? "Veo 3.1 - Quality" : s.includes("fast") ? "Veo 3.1 - Fast" : s.includes("lite") ? "Veo 3.1 - Lite" : s.includes("1.2") ? "Omni Flash 1.2" : "Omni 1.1 Flash"; };
const META_IMAGE_ASPECT = v => ({ "4:5": "3:4", "2:3": "3:4", "1.91:1": "16:9", "16:9": "16:9", "9:16": "9:16", "1:1": "1:1", "3:4": "3:4", "4:3": "4:3" }[String(v || "").trim()] || "1:1");
function deepxNext(res) {
  if (res && res.job_id && !res.action_required) res.next_step = "Poll deepx_job_status {job_id, wait_seconds:30} until done, then pass files[0].path to fb_publish media_paths / thumbnail_path or fb_publish_reel video_path.";
  return res;
}
async function metaGenerate(kind, args = {}) {
  const common = { generation_mode: args.generation_mode, download: true, wait_seconds: args.wait_seconds ?? 20 };
  if (kind === "design") return deepxNext(await DEEPX.deepxGenerate({ ...common, prompt: args.prompt, media_type: "image", aspect_ratio: META_IMAGE_ASPECT(args.aspect_ratio || "4:5"), image_model: META_IMAGE_MODEL(args.model), count: 1 }));
  if (kind === "thumbnail") {
    const spec = buildAiImageModelThumbnailPrompt({ topic: args.topic || args.prompt, title_hook: args.title_hook, subtitle: args.subtitle, archetype: args.archetype, aspect_ratio: args.aspect_ratio || "16:9" });
    const res = await DEEPX.deepxGenerate({ ...common, prompt: spec.ai_image_model_prompt || String(args.topic || args.prompt), media_type: "image", aspect_ratio: META_IMAGE_ASPECT(args.aspect_ratio || "16:9"), image_model: "Nano Banana 2.1" });
    return deepxNext({ ...res, thumbnail_prompt: spec.ai_image_model_prompt });
  }
  return deepxNext(await DEEPX.deepxGenerate({ ...common, prompt: args.prompt, media_type: "video", aspect_ratio: args.aspect_ratio === "16:9" ? "16:9" : "9:16", video_model: META_VIDEO_MODEL(args.model), duration: Number(args.duration) || 8 }));
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
    if (DEEPX_TOOLS.has(tool)) return await DEEPX.deepxExecute(tool, args);

    switch (tool) {
      case "fb_publish_batch": {
        { const pf = bsPreflight({ toolName: "fb_publish_batch", items: args.items || [], timingGiven: !!(args.timing && args.timing.mode), multi: (args.items || []).length > 1 }); if (pf && !(args.items || []).every(i => i.dry_run)) return pf; if (!args.timing || !args.timing.mode) return pf || { success: false, needs_user_input: true, ask_user: [BS_TIMING_Q] }; }
        try { self.MetaBS.bsPlanTimes((args.items || []).length, args.timing); } catch (e) { return { success: false, needs_user_input: true, error: e.message, agent_instruction: "Ask the user for the missing timing detail, then call again." }; }
        const jobId = `batch_${Date.now().toString(36)}`; const startedAt = Date.now(); const total = (args.items || []).length;
        bsJobs.set(jobId, { job_id: jobId, tool: "fb_publish_batch", status: "running", started_at: startedAt, total, done: 0, results: [] });
        const p = self.MetaBS.bsRunBatch(args.items, args.timing, async (results) => {
          bsJobs.set(jobId, { job_id: jobId, tool: "fb_publish_batch", status: "running", started_at: startedAt, total, done: results.length, results: [...results] });
          const last = results[results.length - 1]; const it = args.items[results.length - 1];
          if (last.ok) {
            await recordDedupe(bsCaptionOf(it), it.media_paths || [], `${jobId}_${last.index}`);
            await recordPostHistory({ id: `${jobId}_${last.index}`, post_type: last.kind, target_type: "page", title: it.title || "", caption: it.caption || "", hashtags: it.hashtags || [], media_paths: it.media_paths || [], status: last.status, via: "meta_business_suite", scheduled_for: last.scheduled_for });
            if (last.status === "published") await recordPublishLog(last.kind === "reel" ? "reel" : last.kind === "story" ? "story" : "feed");
          }
        }).then(results => {
          const failed = results.filter(r => !r.ok).length;
          const proofs = results.proofs || [];
          bsJobs.set(jobId, { job_id: jobId, tool: "fb_publish_batch", status: failed ? "done_with_errors" : "done", started_at: startedAt, finished_at: Date.now(), total, done: results.length, failed, results: [...results], proofs, show_user: proofs.filter(p => p.screenshot).map(p => `![${p.status} proof](${p.screenshot})`).join("\n") });
        }).catch(e => bsJobs.set(jobId, { job_id: jobId, tool: "fb_publish_batch", status: "failed", error: e.message, started_at: startedAt, finished_at: Date.now(), total, results: (bsJobs.get(jobId) || {}).results || [] }));
        await Promise.race([p, sleep(40000)]);
        const j = bsJobs.get(jobId);
        return { success: true, ...j, agent_instruction: j.status === "running" ? `PROJECT IN PROGRESS (${j.done}/${total}). Keep calling fb_publish_status {job_id: "${jobId}", wait_seconds: 50} until finished is true. NEVER end your turn or stop before that.` : "Project finished. Report each post's result to the user." };
      }
      case "meta_proof_test": return await self.MetaBS.bsProof(args.status || "published", args.caption || "", {});
      case "fb_publish_status": {
        const id = args.job_id; const wait = Math.min(50, Math.max(0, +args.wait_seconds || 0)) * 1000; const end = Date.now() + wait;
        if (!id) return { jobs: [...bsJobs.values()].slice(-10) };
        while (Date.now() < end && bsJobs.get(id) && bsJobs.get(id).status === "running") await sleep(1000);
        const j = bsJobs.get(id); if (!j) return { success: false, error: "Unknown job_id (the plugin may have been reloaded). Check Business Suite > Content/Planner." };
        return j.status === "running" ? { ...j, finished: false, elapsed_s: Math.round((Date.now() - j.started_at) / 1000), agent_instruction: "Still working. Call fb_publish_status again with wait_seconds 50. Do NOT stop or end your turn until finished is true." } : { ...(j.result || {}), ...j, post_status: j.result && j.result.status, finished: true, agent_instruction: "Finished. Report the result to the user and SHOW the proof screenshot(s): put show_user (markdown image lines) in your reply." };
      }
      case "meta_bs_eval": return await self.MetaBS.bsEvalTool(args);
      case "meta_bs_inspect": return await self.MetaBS.bsInspect(args);
      case "fb_manage_queue": return await manageQueue(args);
      case "meta_viral_seo_generate": return metaViralSeo(args);
      case "meta_viral_algorithm_audit": return metaAlgorithmAudit(args);
      case "fb_trend_search": return await trendSearch(args);
      case "deepx_meta_status": {
        const login = await DEEPX.deepxExecute("deepx_check_login", {});
        return { engine: "built-in DeepX Google Flow engine", google_flow_logged_in: !!login.logged_in, ...login, modes: ["agent", "standard"], tools: ["deepx_meta_generate_design", "deepx_meta_generate_thumbnail", "deepx_meta_generate_video", "deepx_generate", "deepx_job_status"] };
      }
      case "deepx_meta_generate_design": return await metaGenerate("design", args);
      case "deepx_meta_generate_thumbnail": return await metaGenerate("thumbnail", args);
      case "deepx_meta_generate_video": return await metaGenerate("video", args);
      case "meta_list_pages": {
        const login = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });
        if (!login.logged_in) return login;
        const pages = await discoverManagedPages(login.active_tab_id, { refresh: !!args.refresh });
        const store = await getStorage(["meta_default_page", "meta_acting_page"]);
        const clean = pages.map(cleanStoredPage).filter(p => !/^create( post| page)?$/i.test(p.name));
        if (clean.length !== pages.length || clean.some((p, i) => p.name !== pages[i].name)) await setStorage({ meta_pages: clean });
        const bsPage = (await getStorage(["meta_bs_page"])).meta_bs_page || null;
        return { pages: clean, default_page: cleanStoredPage(store.meta_default_page) || clean[0] || null, business_suite_page: bsPage };
      }
      case "meta_set_default_page": {
        const login = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });
        if (!login.logged_in) return login;
        const page = await resolveTargetPage(login.active_tab_id, args.page || args.page_url || args.page_id || args.name);
        if (!page) return { success: false, error: "Page not found" };
        await setStorage({ meta_default_page: page });
        return { success: true, default_page: page };
      }
      case "fb_status": {
        // v2.9.2: open META BUSINESS SUITE first and report the Page from Business Suite itself.
        let bs = null;
        if (args.open_browser !== false) { try { bs = await self.MetaBS.bsStatus(); } catch (e) { bs = { opened: false, error: e.message }; } }
        const login = await checkFacebookLogin({ openIfMissing: false, activateOnLoginNeeded: false });
        const store = await getStorage(["fb_scheduled_jobs", "fb_posts_history", "fb_pending_task", "meta_bs_page"]);
        const jobs = Array.isArray(store.fb_scheduled_jobs) ? store.fb_scheduled_jobs : [];
        const history = Array.isArray(store.fb_posts_history) ? store.fb_posts_history : [];
        const loggedIn = bs && bs.logged_in != null ? bs.logged_in : !!login.logged_in;
        return {
          id: PLUGIN_ID, version: PLUGIN_VERSION,
          status: loggedIn ? "ready" : "awaiting_one_time_login",
          logged_in: loggedIn,
          business_suite: bs ? { opened: !!bs.opened, page_name: bs.page_name || (store.meta_bs_page || {}).name || null, page_asset_id: bs.asset_id || (store.meta_bs_page || {}).asset_id || null, url: bs.url || null, error: bs.error } : null,
          page: store.meta_bs_page || null,
          scheduled_jobs_queued: jobs.filter((j) => j.status === "queued").length,
          recent_posts_count: history.length,
          pending_task: store.fb_pending_task || null,
          agent_instruction: loggedIn
            ? "Meta Business Suite is open for the Page. Reply in ONE short line (Page name + ready) and ask what to post. Do not list IDs or tables, and do not mention the Graph API / fb_meta_connect (not needed)."
            : "Tell the user once to sign in to Meta Business Suite in the open AntiGem tab, then stop."
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

      case "fb_schedule": return await scheduleOne(args);
      case "fb_schedule_bulk": return await scheduleBulk(args);
      case "fb_safety_settings": return await safetySettingsTool(args);
      case "fb_meta_connect": return await metaConnect(args);
      case "fb_meta_status": return await metaStatus();
      case "fb_meta_disconnect": return await metaDisconnect(args);

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
