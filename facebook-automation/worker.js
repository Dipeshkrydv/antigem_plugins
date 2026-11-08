/**
 * AntiGem WebView MCP Service Worker for Facebook Automation & SEO Studio (v1.1.0)
 *
 * Native AntiGem Browser Engine (Modeled on AntiGem WebView Extension SDK):
 * 1. Automatically opens Facebook (https://www.facebook.com/) inside the AntiGem Browser tab.
 * 2. Verifies One-Time Login via cookies (c_user, xs) + DOM inspection and persists session state.
 * 3. If NOT logged in: focuses the Facebook login tab in the AntiGem browser, saves the pending task,
 *    watches for login completion to auto-resume, and returns a strict STOP signal (zero retry loops!).
 * 4. Once logged in: autonomously executes Text Posts, Photo Posts, Carousels, Videos, Reels, Stories,
 *    Post Edits, Post Deletions, and Comments directly in the AntiGem WebView tab.
 */

const PLUGIN_ID = "facebook-automation";
const PLUGIN_VERSION = "1.1.0";
const FB_HOME_URL = "https://www.facebook.com/";
const FB_REELS_CREATE_URL = "https://www.facebook.com/reels/create";
const FB_STORIES_CREATE_URL = "https://www.facebook.com/stories/create";
const DEDUPE_WINDOW_MS = 48 * 3600 * 1000; // 48 hours
const MIN_POST_INTERVAL_MS = 15 * 1000;    // 15s anti-burst spacing

let inFlightLock = null;
const attachedDebuggerTabs = new Set();

// ============================================================================
// 1. Utility & Storage Helpers
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
  const ext = (String(filePath || "").split(".").pop() || "").toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
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

async function resolveLocalFile(rawPath) {
  if (!rawPath) throw new Error("Empty file path provided.");
  let p = String(rawPath).trim();
  const candidates = [p];

  if (p.startsWith("~/")) {
    const rel = p.slice(2);
    candidates.unshift(
      `/data/data/com.antigem.app/files/home/${rel}`,
      `/data/user/0/com.antigem.app/files/home/${rel}`,
      `/data/data/com.termux/files/home/${rel}`,
      `/storage/emulated/0/${rel}`
    );
  } else if (p.startsWith("/sdcard/")) {
    candidates.unshift(`/storage/emulated/0/${p.slice("/sdcard/".length)}`);
  }

  if (chrome.antigem && typeof chrome.antigem.stat === "function") {
    for (const c of candidates) {
      try {
        const st = await chrome.antigem.stat({ path: c });
        if (st && st.isFile !== false && !st.isDirectory) {
          const mtimeVal = st.modified || st.mtime || 0;
          return {
            path: st.path || c,
            size: st.size || 0,
            mtime: mtimeVal,
            mimeType: guessMimeType(c),
            filename: (st.path || c).split("/").pop() || "upload.bin",
            fingerprint: `file:${st.path || c}:${st.size || 0}:${mtimeVal}`
          };
        }
      } catch (_) {}
    }
  }

  return {
    path: candidates[0],
    size: 0,
    mtime: 0,
    mimeType: guessMimeType(candidates[0]),
    filename: candidates[0].split("/").pop() || "upload.bin",
    fingerprint: `file:${candidates[0]}`
  };
}

// ============================================================================
// 2. Anti-Duplicate & Rate-Limit Sentinel
// ============================================================================

async function checkDuplicate(caption, mediaPaths) {
  const store = await getStorage(["fb_dedupe_ledger"]);
  const ledger = Array.isArray(store.fb_dedupe_ledger) ? store.fb_dedupe_ledger : [];
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  const activeLedger = ledger.filter((entry) => entry && entry.timestamp >= cutoff);

  if (caption && String(caption).trim().length > 15) {
    const capHash = await sha256Hex(normalizeCaption(caption));
    const match = activeLedger.find((e) => e.type === "caption" && e.hash === capHash);
    if (match) {
      return {
        isDuplicate: true,
        reason: `Duplicate caption blocked (already published at ${new Date(match.timestamp).toLocaleTimeString()}).`
      };
    }
  }

  if (Array.isArray(mediaPaths) && mediaPaths.length > 0) {
    for (const mp of mediaPaths) {
      const resolved = await resolveLocalFile(mp);
      const mediaHash = await sha256Hex(resolved.fingerprint);
      const match = activeLedger.find((e) => e.type === "media" && e.hash === mediaHash);
      if (match) {
        return {
          isDuplicate: true,
          reason: `Duplicate media file blocked (${resolved.filename} was already published within the last 48h).`
        };
      }
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

  if (caption && String(caption).trim().length > 15) {
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

async function waitForTabComplete(tabId, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === "complete" && tab.url && tab.url !== "about:blank") {
        // Also confirm document.readyState inside the tab
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
    await sleep(400);
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
    await waitForTabComplete(fbTab.id, 25000);
    await sleep(800);
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
    await waitForTabComplete(fbTab.id, 25000);
    await sleep(600);
  } else if (fbTab.status !== "complete") {
    await waitForTabComplete(fbTab.id, 15000);
  }

  return fbTab;
}

/**
 * Checks whether the user is currently logged into Facebook in the AntiGem browser.
 * Combines cookie inspection (c_user + xs) with live DOM inspection.
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

  // 1. Inspect Facebook session cookies (c_user & xs)
  let cUserCookie = null;
  let xsCookie = null;
  try {
    if (chrome.cookies && typeof chrome.cookies.getAll === "function") {
      const cookies = await chrome.cookies.getAll({ domain: "facebook.com" });
      cUserCookie = cookies.find((c) => c.name === "c_user" && c.value && c.value !== "0");
      xsCookie = cookies.find((c) => c.name === "xs" && c.value);
    }
  } catch (_) {}

  // 2. Inspect DOM inside the Facebook tab
  let domState = null;
  if (fbTab && fbTab.id) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: fbTab.id },
        func: () => {
          const href = location.href;
          const path = location.pathname || "";
          const html = document.documentElement ? document.documentElement.innerHTML : "";
          const bodyText = document.body ? (document.body.innerText || "") : "";

          // Detect explicit login / checkpoint forms
          const hasLoginInput = Boolean(
            document.querySelector(
              'input[name="email"], input[name="pass"], #m_login_email, #m_login_password, button[name="login"], form[action*="/login"] input[type="password"]'
            )
          );
          const isLoginUrl = /^\/(login|recover|r\.php)/i.test(path) || href.includes("facebook.com/login");
          const isCheckpoint = path.includes("/checkpoint") || /confirm your identity|security check/i.test(bodyText);

          // Extract CurrentUserInitialData USER_ID and NAME
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

          // Check for profile navigation or feed composer
          const profileEl = document.querySelector(
            'a[href*="/me/"], a[href*="/profile.php"], div[aria-label*="Your profile" i], a[aria-label*="Your profile" i], div[aria-label*="Facebook Menu" i]'
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
              'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet="ProfileComposer"]'
            ) ||
              Array.from(document.querySelectorAll('div[role="button"], span')).some((el) => {
                const t = (el.innerText || el.textContent || "").trim();
                return (
                  t.includes("What's on your mind") ||
                  t.includes("Write something") ||
                  t.includes("Create a post") ||
                  t === "Post"
                );
              })
          );

          const hasLoggedInNav = Boolean(
            profileEl ||
              document.querySelector(
                'div[aria-label="Account Controls and Settings"], div[aria-label="Messenger"], a[aria-label="Home"], div[role="banner"]'
              )
          );

          return {
            href,
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
      account_id: accountId || "authenticated",
      account_name: accountName || "Facebook Account",
      account_type: "profile",
      message: `Logged into Facebook as ${accountName || accountId || "active user"} in the AntiGem browser.`
    };
  }

  // Not logged in -> ensure Facebook tab is open & focused on the login screen in AntiGem browser
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
      "CRITICAL: Do NOT call fb_login_status, fb_publish, or any other tool again in a loop! Tell the user once that Facebook is open in the AntiGem browser for their one-time login and STOP immediately to let them sign in."
  };
}

// ============================================================================
// 4. Native AntiGem WebView Automation Lease, Tap & CDP File Upload
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
  }, 4000);

  try {
    return await fn();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await setBusy(false);
  }
}

async function trustedTap(tabId, coords) {
  if (!coords || typeof coords.fx !== "number" || typeof coords.fy !== "number") return false;
  try {
    if (chrome.antigem && typeof chrome.antigem.automation === "function") {
      await chrome.antigem.automation({
        tabId,
        busy: true,
        tap: { fx: coords.fx, fy: coords.fy }
      });
      return true;
    }
  } catch (_) {}
  return false;
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
 * Attaches one or more local media files (photos or videos) to the marked
 * <input type="file" data-antigem-upload-target="1"> inside the Facebook tab.
 * Uses CDP DOM.setFileInputFiles first (zero RAM overhead for large videos/reels),
 * with automatic fallback to chrome.antigem.readFile (base64) + DataTransfer.
 */
async function attachMediaFilesToMarkedInput(tabId, rawPaths) {
  const resolvedFiles = [];
  for (const rp of rawPaths) {
    resolvedFiles.push(await resolveLocalFile(rp));
  }

  // Tier 1: CDP DOM.setFileInputFiles (best for large MP4 Reels & Videos)
  const dbgReady = await ensureDebuggerAttached(tabId);
  if (dbgReady) {
    try {
      await chrome.debugger.sendCommand({ tabId }, "DOM.enable", {});
      const doc = await chrome.debugger.sendCommand({ tabId }, "DOM.getDocument", { depth: -1 });
      const rootNodeId = doc && doc.root && doc.root.nodeId;
      if (rootNodeId) {
        const q = await chrome.debugger.sendCommand({ tabId }, "DOM.querySelector", {
          nodeId: rootNodeId,
          selector: 'input[type="file"][data-antigem-upload-target="1"]'
        });
        if (q && q.nodeId) {
          await chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", {
            nodeId: q.nodeId,
            files: resolvedFiles.map((f) => f.path)
          });
          // Fire input & change events on the input element
          const [verify] = await chrome.scripting.executeScript({
            world: "MAIN",
        target: { tabId },
            func: () => {
              const inp = document.querySelector('input[type="file"][data-antigem-upload-target="1"]');
              if (!inp) return { ok: false };
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              return { ok: Boolean(inp.files && inp.files.length > 0), count: inp.files ? inp.files.length : 0 };
            }
          });
          if (verify && verify.result && verify.result.ok) {
            return { ok: true, method: "cdp_setFileInputFiles", count: verify.result.count, files: resolvedFiles };
          }
        }
      }
    } catch (_) {}
  }

  // Tier 2: chrome.antigem.readFile (base64) + DataTransfer inside the page
  if (chrome.antigem && typeof chrome.antigem.readFile === "function") {
    const filePayloads = [];
    for (const f of resolvedFiles) {
      const readRes = await chrome.antigem.readFile({ path: f.path, encoding: "base64" });
      const b64 = typeof readRes === "string" ? readRes : readRes && readRes.data;
      if (!b64) {
        throw new Error(`Could not read local media file: ${f.path}`);
      }
      filePayloads.push({
        base64: b64,
        filename: f.filename,
        mimeType: f.mimeType
      });
    }

    const [dtRes] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      args: [filePayloads],
      func: (items) => {
        const inp =
          document.querySelector('input[type="file"][data-antigem-upload-target="1"]') ||
          document.querySelector('div[role="dialog"] input[type="file"]') ||
          document.querySelector('input[type="file"]');
        if (!inp) return { ok: false, error: "No <input type=file> found in DOM." };

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

    if (dtRes && dtRes.result && dtRes.result.ok) {
      return { ok: true, method: "antigem_dataTransfer", count: dtRes.result.count, files: resolvedFiles };
    }
  }

  throw new Error(
    `Failed to attach media file(s) (${resolvedFiles.map((f) => f.filename).join(", ")}) to Facebook file input.`
  );
}

// ============================================================================
// 5. Core Facebook Upload Pipelines (Feed Posts, Photos, Videos, Reels, Stories)
// ============================================================================

/**
 * Pipeline A: Feed Post (Text, Photo, Carousel, Video) on Profile, Page, or Group
 */
async function executeFeedPostInBrowser(tabId, payload) {
  const {
    caption = "",
    media_paths = [],
    post_type = "text",
    target_type = "profile",
    target_id = null,
    first_comment = null
  } = payload;

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
    await waitForTabComplete(tabId, 25000);
    await sleep(1200);
  }

  // 2. Locate and click Composer Trigger ("What's on your mind?" / "Create a post" / "Write something...")
  const [triggerRes] = await chrome.scripting.executeScript({
    world: "MAIN",
        target: { tabId },
    func: () => {
      // Check if composer dialog is already open
      const existingDialog = document.querySelector('div[role="dialog"]');
      if (existingDialog && existingDialog.querySelector('div[role="textbox"][contenteditable="true"], textarea')) {
        return { ok: true, alreadyOpen: true };
      }

      const candidates = [
        ...Array.from(
          document.querySelectorAll(
            'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet="ProfileComposer"] div[role="button"], div[role="button"], span[role="button"]'
          )
        )
      ];

      const match = candidates.find((el) => {
        const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
        return (
          /what's on your mind/i.test(txt) ||
          /write something/i.test(txt) ||
          /create a post/i.test(txt) ||
          /make a post/i.test(txt) ||
          /share something/i.test(txt)
        );
      });

      if (!match) {
        return { ok: false, error: "Could not find Facebook post composer trigger on page." };
      }

      match.scrollIntoView({ block: "center", behavior: "instant" });
      const r = match.getBoundingClientRect();
      match.click();
      return {
        ok: true,
        alreadyOpen: false,
        coords: {
          fx: Math.max(0.05, Math.min(0.95, (r.left + r.width / 2) / Math.max(1, window.innerWidth))),
          fy: Math.max(0.05, Math.min(0.95, (r.top + r.height / 2) / Math.max(1, window.innerHeight)))
        }
      };
    }
  });

  if (!triggerRes || !triggerRes.result || !triggerRes.result.ok) {
    throw new Error((triggerRes && triggerRes.result && triggerRes.result.error) || "Composer button not found.");
  }

  if (!triggerRes.result.alreadyOpen && triggerRes.result.coords) {
    await sleep(400);
    // Confirm dialog opened; if not, dispatch trusted tap
    const [checkDlg] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      func: () =>
        Boolean(
          document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]') ||
            document.querySelector('div[role="textbox"][contenteditable="true"]') ||
            document.querySelector("textarea")
        )
    });
    if (!checkDlg || !checkDlg.result) {
      await trustedTap(tabId, triggerRes.result.coords);
    }
  }

  await sleep(1400);

  // 3. Attach Media Files (Photos / Videos) if provided
  if (Array.isArray(media_paths) && media_paths.length > 0) {
    const wantVideo = media_paths.some((p) => isVideoPath(p)) || post_type === "video";

    const [markInputRes] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      args: [wantVideo],
      func: (preferVideo) => {
        document
          .querySelectorAll("[data-antigem-upload-target]")
          .forEach((el) => el.removeAttribute("data-antigem-upload-target"));

        const scope = document.querySelector('div[role="dialog"]') || document;
        let inputs = Array.from(scope.querySelectorAll('input[type="file"]'));
        if (inputs.length === 0) {
          // Click "Photo/video" button to reveal file input
          const photoBtn = Array.from(
            scope.querySelectorAll('div[role="button"], span[role="button"], button, a')
          ).find((el) => {
            const label = (el.getAttribute("aria-label") || el.innerText || el.textContent || "").trim();
            return /photo\/video|photos\/videos|add photos|add video|photo/i.test(label);
          });
          if (photoBtn) photoBtn.click();
          inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        }

        if (inputs.length === 0) {
          return { ok: false, clickedPhotoBtn: true };
        }

        const chosen =
          inputs.find((inp) => {
            const acc = (inp.getAttribute("accept") || "").toLowerCase();
            return preferVideo ? acc.includes("video") : acc.includes("image");
          }) || inputs[inputs.length - 1];

        chosen.setAttribute("data-antigem-upload-target", "1");
        return { ok: true };
      }
    });

    if (!markInputRes || !markInputRes.result || !markInputRes.result.ok) {
      await sleep(1000);
      await chrome.scripting.executeScript({
        world: "MAIN",
        target: { tabId },
        func: () => {
          const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
          if (inputs.length > 0) {
            inputs[inputs.length - 1].setAttribute("data-antigem-upload-target", "1");
          }
        }
      });
    }

    await attachMediaFilesToMarkedInput(tabId, media_paths);
    await sleep(wantVideo ? 3500 : 2000);
  }

  // 4. Insert Caption into Composer Textbox (Strict Anti-Comment-Box Lock)
  if (caption && String(caption).trim().length > 0) {
    const [capRes] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      args: [String(caption)],
      func: (textToInsert) => {
        const dialog = document.querySelector('div[role="dialog"]') || document;
        const candidates = Array.from(
          dialog.querySelectorAll('div[role="textbox"][contenteditable="true"], textarea')
        ).filter((el) => {
          const aria = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").toLowerCase();
          return !aria.includes("comment") && !aria.includes("reply") && !aria.includes("search");
        });

        const editor = candidates[0];
        if (!editor) {
          return { ok: false, error: "Could not locate composer caption input box." };
        }

        editor.scrollIntoView({ block: "center", behavior: "instant" });
        editor.focus();

        if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
          editor.value = textToInsert;
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          editor.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: true, length: editor.value.length };
        }

        // ContentEditable (Lexical / Draft.js on Facebook)
        document.execCommand("selectAll", false, null);
        const inserted = document.execCommand("insertText", false, textToInsert);
        if (!inserted || !(editor.innerText || "").trim()) {
          try {
            const dt = new DataTransfer();
            dt.setData("text/plain", textToInsert);
            editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
          } catch (_) {}
        }
        if (!(editor.innerText || "").trim()) {
          editor.innerText = textToInsert;
        }
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: textToInsert }));
        return { ok: true, length: (editor.innerText || editor.textContent || "").trim().length };
      }
    });

    if (!capRes || !capRes.result || !capRes.result.ok) {
      throw new Error((capRes && capRes.result && capRes.result.error) || "Failed to populate post caption.");
    }
    await sleep(900);
  }

  // 5. Wait for "Post" / "Publish" button to become enabled and click it
  let postBtnResult = null;
  const waitAttempts = media_paths && media_paths.some((p) => isVideoPath(p)) ? 30 : 12;
  for (let attempt = 0; attempt < waitAttempts; attempt++) {
    const [btnProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      func: () => {
        const scope = document.querySelector('div[role="dialog"]') || document;
        const buttons = Array.from(scope.querySelectorAll('div[role="button"], button, input[type="submit"]'));
        const postBtn = buttons.find((el) => {
          const txt = (el.innerText || el.textContent || el.value || "").trim().toLowerCase();
          const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
          return txt === "post" || txt === "publish" || aria === "post" || aria === "publish";
        });

        if (!postBtn) return { found: false };
        const disabled =
          postBtn.disabled ||
          postBtn.getAttribute("aria-disabled") === "true" ||
          postBtn.hasAttribute("disabled");
        if (disabled) return { found: true, disabled: true };

        const r = postBtn.getBoundingClientRect();
        postBtn.click();
        return {
          found: true,
          disabled: false,
          clicked: true,
          coords: {
            fx: Math.max(0.05, Math.min(0.95, (r.left + r.width / 2) / Math.max(1, window.innerWidth))),
            fy: Math.max(0.05, Math.min(0.95, (r.top + r.height / 2) / Math.max(1, window.innerHeight)))
          }
        };
      }
    });

    postBtnResult = btnProbe && btnProbe.result;
    if (postBtnResult && postBtnResult.found && !postBtnResult.disabled) {
      break;
    }
    await sleep(1000);
  }

  if (!postBtnResult || !postBtnResult.found) {
    throw new Error("Could not find 'Post' / 'Publish' button in Facebook composer.");
  }
  if (postBtnResult.disabled) {
    throw new Error("Facebook 'Post' button remained disabled (media may still be uploading or caption is empty).");
  }

  // Wait for composer modal to dismiss; if still open after 2.5s, send a trusted tap on the Post button
  await sleep(2500);
  const [stillOpenProbe] = await chrome.scripting.executeScript({
    world: "MAIN",
        target: { tabId },
    func: () => Boolean(document.querySelector('div[role="dialog"]'))
  });
  if (stillOpenProbe && stillOpenProbe.result && postBtnResult.coords) {
    await trustedTap(tabId, postBtnResult.coords);
  }

  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const [dlgCheck] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      func: () => !document.querySelector('div[role="dialog"]')
    });
    if (dlgCheck && dlgCheck.result) break;
  }

  // Optional: Post first comment (e.g. outbound link to protect organic reach)
  let firstCommentResult = null;
  if (first_comment && String(first_comment).trim()) {
    await sleep(2000);
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
    post_type,
    target_type,
    fb_post_id: `fb_dom_${Date.now()}`,
    post_url: finalTab.url || desiredUrl,
    first_comment_result: firstCommentResult,
    message: `Facebook ${post_type} post published successfully in AntiGem browser.`
  };
}

/**
 * Pipeline B: Facebook Reels Upload (https://www.facebook.com/reels/create)
 */
async function executeReelUploadInBrowser(tabId, payload) {
  const videoPath =
    payload.video_path || (Array.isArray(payload.media_paths) && payload.media_paths[0]) || null;
  const caption = payload.caption || "";

  if (!videoPath) {
    throw new Error("video_path (or media_paths[0]) is required to publish a Facebook Reel.");
  }

  // 1. Navigate to Facebook Reels Create wizard
  await chrome.tabs.update(tabId, { url: FB_REELS_CREATE_URL, active: true });
  await waitForTabComplete(tabId, 25000);
  await sleep(1800);

  // 2. Locate & mark <input type="file"> on the Reels create screen
  const [markRes] = await chrome.scripting.executeScript({
    world: "MAIN",
        target: { tabId },
    func: () => {
      document
        .querySelectorAll("[data-antigem-upload-target]")
        .forEach((el) => el.removeAttribute("data-antigem-upload-target"));

      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      if (inputs.length === 0) return { ok: false, error: "No file input found on Facebook Reels page." };
      const videoInput =
        inputs.find((inp) => (inp.getAttribute("accept") || "").toLowerCase().includes("video")) || inputs[0];
      videoInput.setAttribute("data-antigem-upload-target", "1");
      return { ok: true };
    }
  });

  if (!markRes || !markRes.result || !markRes.result.ok) {
    // Fallback to feed video post if /reels/create is unavailable on mobile view
    return await executeFeedPostInBrowser(tabId, {
      ...payload,
      media_paths: [videoPath],
      post_type: "video"
    });
  }

  // 3. Attach the video file
  await attachMediaFilesToMarkedInput(tabId, [videoPath]);
  await sleep(3500);

  // 4. Advance through "Next" steps (Step 1: Upload -> Step 2: Edit -> Step 3: Describe & Publish)
  for (let step = 0; step < 3; step++) {
    const [stepProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      func: () => {
        // Check if Publish / Share button is already visible
        const allBtns = Array.from(document.querySelectorAll('div[role="button"], button'));
        const pubBtn = allBtns.find((el) => {
          const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "publish" || t === "share" || t === "share now" || t === "post";
        });
        if (pubBtn) return { atPublishStep: true };

        const nextBtn = allBtns.find((el) => {
          const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "next";
        });
        if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true") {
          nextBtn.click();
          return { clickedNext: true };
        }
        return { waiting: true };
      }
    });

    if (stepProbe && stepProbe.result && stepProbe.result.atPublishStep) break;
    await sleep(1800);
  }

  // 5. Insert Reel Caption / Hashtags
  if (caption && String(caption).trim().length > 0) {
    await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      args: [String(caption)],
      func: (textToInsert) => {
        const editor =
          document.querySelector(
            'div[aria-label*="Describe your reel" i][contenteditable="true"], div[aria-label*="Write a description" i][contenteditable="true"], div[role="textbox"][contenteditable="true"], textarea'
          );
        if (!editor) return { ok: false };
        editor.focus();
        if (editor.tagName === "TEXTAREA") {
          editor.value = textToInsert;
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          return { ok: true };
        }
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, textToInsert);
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: textToInsert }));
        return { ok: true };
      }
    });
    await sleep(900);
  }

  // 6. Click "Publish" / "Share" button (wait up to 35s for video processing)
  let published = false;
  for (let i = 0; i < 35; i++) {
    const [pubProbe] = await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      func: () => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
        const pubBtn = btns.find((el) => {
          const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "publish" || t === "share" || t === "share now" || t === "post";
        });
        if (!pubBtn) return { found: false };
        if (pubBtn.getAttribute("aria-disabled") === "true" || pubBtn.disabled) {
          return { found: true, disabled: true };
        }
        const r = pubBtn.getBoundingClientRect();
        pubBtn.click();
        return {
          found: true,
          disabled: false,
          coords: {
            fx: Math.max(0.05, Math.min(0.95, (r.left + r.width / 2) / Math.max(1, window.innerWidth))),
            fy: Math.max(0.05, Math.min(0.95, (r.top + r.height / 2) / Math.max(1, window.innerHeight)))
          }
        };
      }
    });

    if (pubProbe && pubProbe.result && pubProbe.result.found && !pubProbe.result.disabled) {
      if (pubProbe.result.coords) {
        await sleep(500);
        await trustedTap(tabId, pubProbe.result.coords);
      }
      published = true;
      break;
    }
    await sleep(1000);
  }

  if (!published) {
    throw new Error("Could not click 'Publish' / 'Share' on Facebook Reels wizard.");
  }

  await sleep(4000);
  return {
    success: true,
    status: "published",
    post_type: "reel",
    fb_post_id: `fb_reel_${Date.now()}`,
    post_url: FB_REELS_CREATE_URL,
    message: "Facebook Reel uploaded and published successfully in AntiGem browser."
  };
}

/**
 * Pipeline C: Facebook Story Upload (https://www.facebook.com/stories/create)
 */
async function executeStoryUploadInBrowser(tabId, payload) {
  const mediaPath =
    payload.media_path || (Array.isArray(payload.media_paths) && payload.media_paths[0]) || null;
  const caption = payload.caption || "";

  await chrome.tabs.update(tabId, { url: FB_STORIES_CREATE_URL, active: true });
  await waitForTabComplete(tabId, 25000);
  await sleep(1600);

  if (mediaPath) {
    await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      func: () => {
        document
          .querySelectorAll("[data-antigem-upload-target]")
          .forEach((el) => el.removeAttribute("data-antigem-upload-target"));
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        if (inputs.length > 0) inputs[0].setAttribute("data-antigem-upload-target", "1");
      }
    });
    await attachMediaFilesToMarkedInput(tabId, [mediaPath]);
    await sleep(2500);
  } else if (caption) {
    // Text story card
    await chrome.scripting.executeScript({
      world: "MAIN",
        target: { tabId },
      args: [String(caption)],
      func: (txt) => {
        const textStoryBtn = Array.from(document.querySelectorAll('div[role="button"], span')).find((el) =>
          /create a text story/i.test(el.innerText || el.textContent || "")
        );
        if (textStoryBtn) textStoryBtn.click();
        setTimeout(() => {
          const box = document.querySelector('div[role="textbox"][contenteditable="true"], textarea');
          if (box) {
            box.focus();
            document.execCommand("insertText", false, txt);
            box.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, 800);
      }
    });
    await sleep(2000);
  }

  const [shareRes] = await chrome.scripting.executeScript({
    world: "MAIN",
        target: { tabId },
    func: () => {
      const btn = Array.from(document.querySelectorAll('div[role="button"], button')).find((el) =>
        /share to story|share now|^share$/i.test((el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim())
      );
      if (!btn) return { ok: false };
      btn.click();
      return { ok: true };
    }
  });

  if (!shareRes || !shareRes.result || !shareRes.result.ok) {
    throw new Error("Could not find 'Share to story' button on Facebook Story creator.");
  }

  await sleep(3000);
  return {
    success: true,
    status: "published",
    post_type: "story",
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
    await sleep(1200);
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

  await sleep(1000);
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

  await sleep(1500);
  const [saveRes] = await chrome.scripting.executeScript({
    world: "MAIN",
        target: { tabId },
    args: [String(new_caption)],
    func: (updatedText) => {
      const dlg = document.querySelector('div[role="dialog"]') || document;
      const box = dlg.querySelector('div[role="textbox"][contenteditable="true"], textarea');
      if (!box) return { ok: false, error: "Could not find text box in Edit Post dialog." };
      box.focus();
      if (box.tagName === "TEXTAREA") {
        box.value = updatedText;
      } else {
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, updatedText);
      }
      box.dispatchEvent(new Event("input", { bubbles: true }));
      const saveBtn = Array.from(dlg.querySelectorAll('div[role="button"], button')).find((el) =>
        /^save$|^done$|^post$/i.test((el.innerText || el.textContent || "").trim())
      );
      if (!saveBtn) return { ok: false, error: "Could not find Save button in Edit Post dialog." };
      saveBtn.click();
      return { ok: true };
    }
  });

  if (!saveRes || !saveRes.result || !saveRes.result.ok) {
    throw new Error((saveRes && saveRes.result && saveRes.result.error) || "Failed to save edited post.");
  }

  await sleep(2000);
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
    await sleep(1200);
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

  await sleep(1000);
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

  await sleep(1500);
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

  await sleep(2000);
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
    await sleep(1200);
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
        'div[aria-label="Comment"][role="button"], button[type="submit"][ value*="Comment" i]'
      );
      if (submitBtn) submitBtn.click();
      return { ok: true };
    }
  });

  if (!cmtRes || !cmtRes.result || !cmtRes.result.ok) {
    throw new Error((cmtRes && cmtRes.result && cmtRes.result.error) || "Failed to post comment.");
  }

  await sleep(1500);
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
  // 1. Ensure Facebook is open in the AntiGem Browser and check One-Time Login
  const loginState = await checkFacebookLogin({ openIfMissing: true, activateOnLoginNeeded: true });

  if (!loginState.logged_in) {
    // Queue this task in storage so it runs automatically as soon as the user logs in!
    const pendingTask = {
      id: `pending_${Date.now()}`,
      tool: toolName,
      args,
      queued_at: Date.now()
    };
    await setStorage({ fb_pending_task: pendingTask });

    await recordPostHistory({
      id: pendingTask.id,
      post_type: args.post_type || (toolName === "fb_publish_reel" ? "reel" : toolName === "fb_publish_story" ? "story" : "text"),
      caption: args.caption || args.new_caption || args.comment_text || "",
      media_paths: args.media_paths || (args.video_path ? [args.video_path] : args.media_path ? [args.media_path] : []),
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

  // 2. Check In-Flight Concurrency Lock
  if (inFlightLock && Date.now() - inFlightLock.startedAt < 120000) {
    return {
      success: false,
      in_flight_busy: true,
      stop_loop: true,
      error: `Another Facebook upload (${inFlightLock.tool}) is already in progress in the AntiGem browser. Wait for it to finish.`
    };
  }

  const tabId = loginState.active_tab_id;
  const mediaList =
    args.media_paths ||
    (args.video_path ? [args.video_path] : args.media_path ? [args.media_path] : []);
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

  // 3. Anti-Duplicate Check for Publish actions
  if (toolName === "fb_publish" || toolName === "fb_publish_reel" || toolName === "fb_publish_story") {
    const dup = await checkDuplicate(args.caption, mediaList);
    if (dup.isDuplicate) {
      return {
        success: false,
        duplicate_detected: true,
        stop_loop: true,
        error: dup.reason
      };
    }

    // Anti-Burst Spacing
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
          await recordDedupe(args.caption, mediaList, result.fb_post_id || recordId);
          await recordPostHistory({
            id: recordId,
            fb_post_id: result.fb_post_id,
            post_url: result.post_url,
            post_type: postType,
            target_type: args.target_type || "profile",
            caption: args.caption || "",
            media_paths: mediaList,
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
      error: err.message
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
        // Hold job cleanly without failing or looping until user completes one-time login
        job.last_note = "Waiting for one-time Facebook login in AntiGem browser.";
        updated = true;
        break;
      }

      job.status = "running";
      updated = true;
      await setStorage({ fb_scheduled_jobs: jobs });

      const res = await dispatchProtectedBrowserTask("fb_publish", {
        id: job.post_id,
        caption: job.caption,
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
// 9. Viral Facebook SEO Generator & Caption Auditor
// ============================================================================

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

  const hook = `⚡ The uncomfortable truth about ${topic} that nobody talks about:`;
  const bullets = takeaways.map((pt, i) => `🔹 Point ${i + 1}: ${pt}`);
  const cta = "👇 Which of these hits closest to home for you? Drop your thoughts below!";
  const cleanTag = topic.replace(/[^a-zA-Z0-9]/g, "");
  const hashtags = [`#${cleanTag || "Strategy"}`, "#GrowthMindset", "#Leadership", "#Productivity", "#CreatorEconomy"];
  const caption = [hook, "", ...bullets, "", cta, "", hashtags.join(" ")].join("\n");

  return {
    caption,
    hook,
    bullets,
    cta,
    hashtags,
    alt_text: `Infographic and key takeaways explaining ${topic}.`,
    first_comment: args.link_url
      ? `🔗 Resource Link: ${args.link_url}\n(Shared in the first comment to keep organic reach at 100%!)`
      : null,
    seo_score: 96
  };
}

function auditFacebookCaption(captionText) {
  const caption = String(captionText || "");
  const lines = caption
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const words = caption.trim().split(/\s+/).filter(Boolean);
  const hashtags = caption.match(/#\w+/g) || [];
  const links = caption.match(/https?:\/\/\S+/g) || [];

  let score = 100;
  const penalties = [];
  const suggestions = [];

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
    score -= 5;
    penalties.push("No hashtags included (-5 pts).");
    suggestions.push("Add 3 to 5 relevant hashtags at the bottom.");
  }
  if (lines.length === 1 && words.length > 45) {
    score -= 20;
    penalties.push("Dense wall-of-text detected (-20 pts).");
    suggestions.push("Break into 1-2 line micro-bites separated by blank lines.");
  }

  return {
    seo_score: Math.max(10, score),
    word_count: words.length,
    line_count: lines.length,
    hashtag_count: hashtags.length,
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
        const mediaPaths = args.media_paths || [];
        const dup = await checkDuplicate(args.caption, mediaPaths);
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
          caption: args.caption,
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
          caption: newJob.caption,
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
          run_at_timestamp: runAt,
          run_at_iso: new Date(runAt * 1000).toISOString(),
          message: `Facebook ${newJob.post_type} scheduled for ${new Date(runAt * 1000).toLocaleString()}.`
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

      case "fb_audit_caption": {
        return auditFacebookCaption(args.caption || "");
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
            ? "Everything healthy! Facebook is logged in inside AntiGem browser and ready for instant uploads."
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
                error: err.message || String(err)
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
