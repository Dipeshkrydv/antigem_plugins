/**
 * Meta Business Suite engine (business.facebook.com) for meta-suite-automation.
 * Every Page post, photo carousel, video, Reel and Story is created in the Business Suite composer
 * (never the www.facebook.com composer, never a profile switch, never native screen taps).
 * Loaded by worker.js with importScripts; uses helpers defined there (sleep, getStorage, setStorage,
 * waitForTabComplete, resolveLocalFile, ensureDebuggerAttached, releaseDebugger, normalizeForCompare).
 */
const BS_ORIGIN = "https://business.facebook.com";
const BS_HOME_URL = `${BS_ORIGIN}/latest/home`;

function isBusinessSuiteUrl(u) { return /^https:\/\/business\.facebook\.com\//i.test(String(u || "")); }

/** Finds (or opens) the dedicated Business Suite tab. */
async function bsEnsureTab(url = BS_HOME_URL, { navigate = true } = {}) {
  let tab = null;
  try {
    const tabs = await chrome.tabs.query({});
    tab = tabs.find(t => isBusinessSuiteUrl(t.url || t.pendingUrl));
  } catch (_) {}
  if (!tab) {
    tab = await chrome.tabs.create({ url, active: true });
    await waitForTabComplete(tab.id, 25000).catch(() => {});
    await sleep(1200);
    return await chrome.tabs.get(tab.id).catch(() => tab);
  }
  if (!tab.active) tab = await chrome.tabs.update(tab.id, { active: true });
  if (navigate && url) {
    const live = await bsExec(tab.id, () => location.href).catch(() => tab.url);
    if (live !== url) await bsNavigate(tab.id, url);
  }
  return await chrome.tabs.get(tab.id).catch(() => tab);
}

/** Navigates the Business Suite tab, auto-accepting "Leave page?" prompts (browser beforeunload and in-app modal). */
function bsPathOf(u) { try { const x = new URL(u); return x.pathname.replace(/\/+$/, ""); } catch (_) { return ""; } }
async function bsNavigate(tabId, url) {
  const want = bsPathOf(url);
  const dbg = await ensureDebuggerAttached(tabId);
  const onEv = (src, method) => {
    if (src && src.tabId === tabId && method === "Page.javascriptDialogOpening") {
      chrome.debugger.sendCommand({ tabId }, "Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
    }
  };
  try {
    if (dbg) { chrome.debugger.onEvent.addListener(onEv); await chrome.debugger.sendCommand({ tabId }, "Page.enable", {}).catch(() => {}); }
    // Leave an open composer draft the way a person does: Cancel -> Discard changes.
    const here = await bsExec(tabId, () => location.pathname).catch(() => "");
    if (/composer/.test(here)) {
      await bsExec(tabId, () => { const b = [...document.querySelectorAll('[role="button"]')].filter(x => x.getBoundingClientRect().width > 2 && !x.closest('[aria-hidden="true"]') && (x.innerText || "").trim() === "Cancel").sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]; if (b) b.click(); }).catch(() => {});
      await bsWaitFor(tabId, () => { const d = [...document.querySelectorAll('[role="dialog"] [role="button"]')].find(x => /^(Discard changes|Discard|Leave)$/.test((x.innerText || "").trim()) && !x.closest('[aria-hidden="true"]')); if (d) { d.click(); return { ok: true }; } return !/composer/.test(location.pathname); }, [], 5000, 300);
      await bsWaitFor(tabId, () => !/composer/.test(location.pathname), [], 8000, 400);
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      if (dbg) await chrome.debugger.sendCommand({ tabId }, "Page.navigate", { url }).catch(() => chrome.tabs.update(tabId, { url }));
      else await chrome.tabs.update(tabId, { url });
      await sleep(800);
      await waitForTabComplete(tabId, 25000).catch(() => {});
      await sleep(1200);
      const cur = await bsExec(tabId, () => location.href).catch(() => "");
      if (bsPathOf(cur) === want) break;
      await bsClickByText(tabId, "^(Discard changes|Discard|Leave|Leave page)$").catch(() => null);
      await sleep(1500);
      const cur2 = await bsExec(tabId, () => location.href).catch(() => "");
      if (bsPathOf(cur2) === want) break;
    }
    const fin = await bsExec(tabId, () => location.href).catch(() => "");
    if (bsPathOf(fin) !== want) throw new Error(`Could not open ${url} in Business Suite (stuck on ${fin}).`);
    await sleep(1200);
  } finally {
    if (dbg) { chrome.debugger.onEvent.removeListener(onEv); await releaseDebugger(tabId); }
  }
}

async function bsExec(tabId, func, args = []) {
  const [r] = await chrome.scripting.executeScript({ world: "MAIN", target: { tabId }, func, args });
  return r ? r.result : undefined;
}

/** Diagnostic: compact dump of what is on a Business Suite screen (buttons, inputs, editors, dialogs). */
async function bsInspect(args = {}) {
  const url = args.url ? (String(args.url).startsWith("http") ? args.url : `${BS_ORIGIN}${args.url}`) : null;
  const tab = await bsEnsureTab(url || BS_HOME_URL, { navigate: !!url });
  if (args.wait_ms) await sleep(Math.min(15000, +args.wait_ms));
  if (args.click_text) {
    await bsExec(tab.id, (t) => {
      const re = new RegExp(t, "i");
      const els = [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="menuitem"],[role="radio"],[role="option"],a,label')];
      const el = els.find(e => re.test((e.getAttribute("aria-label") || e.innerText || "").trim()));
      if (el) el.click();
      return !!el;
    }, [args.click_text]);
    await sleep(+args.after_click_ms || 2500);
  }
  const filter = args.filter || "";
  const data = await bsExec(tab.id, (flt, scopeSel, max) => {
    const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 2 && b.height > 2 && s.visibility !== "hidden" && s.display !== "none"; };
    const root = (scopeSel && document.querySelector(scopeSel)) || document.body;
    const re = flt ? new RegExp(flt, "i") : null;
    const items = [];
    const sel = '[role="button"],button,a[href],[role="tab"],[role="menuitem"],[role="radio"],[role="checkbox"],[role="switch"],[role="combobox"],[role="option"],input,textarea,[contenteditable="true"],[role="textbox"],select';
    for (const el of root.querySelectorAll(sel)) {
      const isFile = el.tagName === "INPUT" && el.type === "file";
      if (!isFile && !vis(el)) continue;
      const label = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.innerText || el.value || "").replace(/\s+/g, " ").trim().slice(0, 70);
      if (re && !re.test(label) && !isFile) continue;
      const b = el.getBoundingClientRect();
      items.push({
        tag: el.tagName.toLowerCase(), role: el.getAttribute("role") || undefined, type: el.type || undefined,
        label, accept: isFile ? el.getAttribute("accept") : undefined, multiple: isFile ? el.multiple : undefined,
        checked: el.getAttribute("aria-checked") || el.getAttribute("aria-pressed") || (el.checked ? "true" : undefined),
        disabled: el.getAttribute("aria-disabled") === "true" || el.disabled || undefined,
        dlg: !!el.closest('[role="dialog"]') || undefined,
        xy: [Math.round(b.left), Math.round(b.top)]
      });
      if (items.length >= max) break;
    }
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(vis).map(d => (d.getAttribute("aria-label") || d.innerText || "").replace(/\s+/g, " ").slice(0, 160));
    const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].filter(vis).map(h => h.innerText.trim().slice(0, 60)).filter(Boolean).slice(0, 25);
    return { url: location.href, title: document.title, viewport: [innerWidth, innerHeight], dialogs, headings, items };
  }, [filter, args.scope || "", Math.min(400, +args.max || 150)]);
  return { success: true, tab_id: tab.id, ...data };
}


/** CDP Runtime.evaluate in the Business Suite tab (diagnostics + robust file binding). */
async function bsCdpEval(tabId, expression, { returnByValue = true, awaitPromise = true } = {}) {
  const ok = await ensureDebuggerAttached(tabId);
  if (!ok) throw new Error("Could not attach the debugger to the Business Suite tab.");
  try {
    const r = await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", { expression, returnByValue, awaitPromise, userGesture: true });
    if (r && r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || "evaluate failed");
    return r && r.result;
  } finally { await releaseDebugger(tabId); }
}

async function bsEvalTool(args = {}) {
  const tab = await bsEnsureTab(args.url || BS_HOME_URL, { navigate: !!args.url });
  const r = await bsCdpEval(tab.id, String(args.expression || "location.href"));
  return { success: true, tab_id: tab.id, value: r ? (r.value !== undefined ? r.value : r.description) : null };
}

// ---------------------------------------------------------------------------
// File binding: catch the composer's (often detached) <input type=file> when its
// button is clicked, then hand it real File objects built in the page. No native taps.
// ---------------------------------------------------------------------------
const BS_CHUNK = 3 * 1024 * 1024; // base64 chars per transfer (multiple of 4)

async function bsClickByText(tabId, regexSrc, { scopeSel = "", exact = false } = {}) {
  return await bsExec(tabId, (src, scope, ex) => {
    const re = new RegExp(src, "i");
    const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 2 && b.height > 2 && s.visibility !== "hidden" && s.display !== "none"; };
    const root = (scope && document.querySelector(scope)) || document;
    const els = [...root.querySelectorAll('[role="button"],button,[role="tab"],[role="menuitem"],[role="radio"],[role="option"],[role="link"],a,label,[role="switch"],input[type="checkbox"],input[type="radio"]')].filter(vis);
    const txt = el => (el.getAttribute("aria-label") || el.innerText || "").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
    const hits = els.filter(e => re.test(txt(e)) && !e.closest('[aria-hidden="true"]'));
    const el = hits.find(e => e.getAttribute("aria-disabled") !== "true" && !e.disabled) || hits[0];
    if (!el) return { clicked: false };
    if (el.getAttribute("aria-disabled") === "true" || el.disabled) return { clicked: false, disabled: true, label: txt(el) };
    el.scrollIntoView({ block: "center" });
    el.click();
    return { clicked: true, label: txt(el) };
  }, [regexSrc, scopeSel, exact]);
}

async function bsInstallFileCapture(tabId) {
  await bsExec(tabId, () => {
    window.__agBsCap = null;
    if (!window.__agBsOrigClick) window.__agBsOrigClick = HTMLInputElement.prototype.click;
    if (!window.__agBsOrigPicker) window.__agBsOrigPicker = HTMLInputElement.prototype.showPicker || null;
    HTMLInputElement.prototype.click = function (...a) { if (this.type === "file") { window.__agBsCap = this; return; } return window.__agBsOrigClick.apply(this, a); };
    HTMLInputElement.prototype.showPicker = function (...a) { if (this.type === "file") { window.__agBsCap = this; return; } return window.__agBsOrigPicker && window.__agBsOrigPicker.apply(this, a); };
  });
}

async function bsRestoreFileCapture(tabId) {
  await bsExec(tabId, () => {
    if (window.__agBsOrigClick) HTMLInputElement.prototype.click = window.__agBsOrigClick;
    if (window.__agBsOrigPicker) HTMLInputElement.prototype.showPicker = window.__agBsOrigPicker;
  }).catch(() => {});
}

/** Streams local files into the page and assigns them to the captured input. */
async function bsPushFilesToCapturedInput(tabId, files) {
  await bsExec(tabId, () => { window.__agBsBuf = []; });
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const raw = await chrome.antigem.readFile({ path: f.path, encoding: "base64" });
    const b64 = typeof raw === "string" ? raw : raw && raw.data;
    if (!b64) throw new Error(`Could not read ${f.path}`);
    for (let off = 0; off < b64.length; off += BS_CHUNK) {
      const part = b64.slice(off, off + BS_CHUNK);
      await bsExec(tabId, (idx, p) => {
        const bin = atob(p); const u = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
        (window.__agBsBuf[idx] = window.__agBsBuf[idx] || []).push(u);
      }, [i, part]);
    }
  }
  return await bsExec(tabId, (meta) => {
    const inp = window.__agBsCap;
    if (!inp) return { ok: false, error: "no file input captured" };
    const dt = new DataTransfer();
    meta.forEach((m, i) => dt.items.add(new File(window.__agBsBuf[i] || [], m.filename, { type: m.mimeType, lastModified: Date.now() })));
    window.__agBsBuf = [];
    const pick = inp.multiple ? dt.files : (() => { const d = new DataTransfer(); d.items.add(dt.files[0]); return d.files; })();
    inp.files = pick;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, count: inp.files.length, accept: inp.accept, multiple: inp.multiple, detached: !document.contains(inp) };
  }, [files.map(f => ({ filename: f.filename, mimeType: f.mimeType }))]);
}

/** Click an upload trigger (regex on its label) and attach the given local files. */
async function bsAttachFiles(tabId, triggerRegex, rawPaths, { preferVideo = false, scopeSel = "" } = {}) {
  const files = [];
  for (const p of rawPaths) files.push(await resolveLocalFile(p, preferVideo));
  await bsInstallFileCapture(tabId);
  try {
    const before = await bsExec(tabId, () => [...document.querySelectorAll('input[type="file"]')].length);
    const c = triggerRegex.startsWith("css:")
      ? await bsExec(tabId, (sel) => { const el = document.querySelector(sel); if (!el) return { clicked: false }; el.scrollIntoView({ block: "center" }); el.click(); return { clicked: true, label: (el.innerText || "").trim() }; }, [triggerRegex.slice(4)])
      : await bsClickByText(tabId, triggerRegex, { scopeSel });
    if (!c || !c.clicked) throw new Error(`Business Suite upload button not available (${triggerRegex}${c && c.disabled ? ", disabled" : ""}).`);
    let res = null;
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const has = await bsExec(tabId, (n) => { if (window.__agBsCap) return true; const all = [...document.querySelectorAll('input[type="file"]')]; if (all.length > n) { window.__agBsCap = all[all.length - 1]; return true; } return false; }, [before]);
      if (has) { res = await bsPushFilesToCapturedInput(tabId, files); break; }
    }
    if (!res || !res.ok) {
      // Last resort: AntiGem's own uploader in "drop/assign" mode (builds the files in the page, no tap).
      if (chrome.antigem && typeof chrome.antigem.uploadFiles === "function") {
        const up = await chrome.antigem.uploadFiles({ tabId, files: files.map(f => f.path), method: "drop", selector: 'input[type="file"]' }).catch(e => ({ error: e.message }));
        if (up && !up.error) return { ok: true, method: "antigem_drop", files: files.map(f => f.filename), trigger: c };
      }
      throw new Error(`Business Suite did not open a file input after clicking "${(c && c.label) || triggerRegex}".`);
    }
    return { ...res, method: "captured_input", files: files.map(f => f.filename), trigger: c };
  } finally {
    await bsRestoreFileCapture(tabId);
  }
}

async function bsAttachTestTool(args = {}) {
  const tab = await bsEnsureTab(args.url || BS_HOME_URL, { navigate: !!args.url });
  if (args.url) await sleep(2500);
  const r = await bsAttachFiles(tab.id, args.trigger || "^Add photo/video$", args.files || [], { preferVideo: !!args.prefer_video });
  await sleep(+args.wait_ms || 4000);
  return { success: true, attach: r, screen: await bsInspect({ max: +args.max || 80, filter: args.filter || "" }) };
}

self.MetaBS = { bsAttachFiles, bsAttachTestTool, bsClickByText,  bsCdpEval, bsEvalTool,  bsInspect, bsEnsureTab, bsExec, isBusinessSuiteUrl, BS_ORIGIN, BS_HOME_URL };

// ===========================================================================
// Business Suite publisher: Post (text/photo/carousel), Reel + long video (all
// videos are Reels in Business Suite), Story. Native scheduling. Screen locked.
// ===========================================================================
const BS_W = ms => new Promise(r => setTimeout(r, ms));

async function bsLock(tabId, on) {
  try { if (chrome.antigem && chrome.antigem.automation) await chrome.antigem.automation(on ? { tabId, busy: true, locked: true } : { tabId, locked: false, busy: false }); } catch (_) {}
}
async function bsSession(tabId, fn) {
  await bsLock(tabId, true);
  const hb = setInterval(() => { chrome.antigem && chrome.antigem.automation && chrome.antigem.automation({ tabId, busy: true }).catch(() => {}); }, 12000);
  const dbg = await ensureDebuggerAttached(tabId);
  try { return await fn(dbg); } finally { clearInterval(hb); if (dbg) await releaseDebugger(tabId); await bsLock(tabId, false); }
}
const bsCdp = (tabId, m, p = {}) => chrome.debugger.sendCommand({ tabId }, m, p);
async function bsKey(tabId, key) {
  const map = { Enter: [13, "\r"], Tab: [9, ""], Escape: [27, ""], Backspace: [8, ""] };
  const [code, text] = map[key] || [0, ""];
  await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, text: text || undefined });
  await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
}
const bsType = (tabId, text) => bsCdp(tabId, "Input.insertText", { text });

async function bsWaitFor(tabId, func, args = [], timeoutMs = 15000, every = 400) {
  const end = Date.now() + timeoutMs; let last;
  while (Date.now() < end) { last = await bsExec(tabId, func, args).catch(() => null); if (last && (last === true || last.ok)) return last; await BS_W(every); }
  return last || null;
}

/** Business Suite asset id of the Page (differs from the facebook.com profile id). */
async function bsAssetId(tabId, targetId) {
  const raw = String(targetId || "").trim();
  const st = await getStorage(["meta_bs_assets", "meta_bs_default_asset"]);
  const map = st.meta_bs_assets || {};
  if (raw && map[raw]) return map[raw];
  if (/^\d{15,17}$/.test(raw) && raw.startsWith("1")) return raw;
  if ((!raw || raw === "me" || raw === "default") && st.meta_bs_default_asset) return st.meta_bs_default_asset;
  await bsNavigate(tabId, BS_HOME_URL);
  const u = await bsExec(tabId, () => location.href);
  const id = (/[?&]asset_id=(\d+)/.exec(u) || [])[1];
  if (!id) throw new Error("Business Suite did not report a Page (asset_id). Open business.facebook.com once and pick your Page.");
  const patch = { meta_bs_default_asset: st.meta_bs_default_asset || id };
  if (raw && raw !== "me" && raw !== "default") patch.meta_bs_assets = { ...map, [raw]: id };
  await setStorage(patch);
  return id;
}

/** Opens Business Suite Home for the Page and starts the right composer. */
async function bsOpenComposer(tabId, assetId, kind) {
  const label = { post: "Create post", reel: "Create reel", story: "Create story" }[kind];
  const marker = { post: "^Add photo/video$", reel: "^Add Video$", story: "^(Add photo/video|Add photos?|Add videos?|Add media|Upload)$" }[kind];
  await bsNavigate(tabId, `${BS_HOME_URL}?asset_id=${assetId}`);
  const pathWant = { post: "/latest/composer", reel: "/latest/reels_composer", story: "/latest/story_composer" }[kind];
  let ready = null;
  for (let attempt = 0; attempt < 6 && !ready; attempt++) {
    await bsExec(tabId, (l) => {
      const b = [...document.querySelectorAll('[role="button"],a')].find(x => (x.innerText || x.getAttribute("aria-label") || "").trim() === l && x.getBoundingClientRect().width > 2 && !x.closest('[aria-hidden="true"]'));
      if (b) b.click(); return !!b;
    }, [label]).catch(() => false);
    ready = await bsWaitFor(tabId, (m, pw) => {
      const re = new RegExp(m, "i");
      const inComposer = location.pathname.startsWith(pw) || /composer/.test(location.pathname);
      return inComposer && [...document.querySelectorAll('[role="button"],button')].some(b => re.test((b.innerText || b.getAttribute("aria-label") || "").trim()) && b.getBoundingClientRect().width > 2 && !b.closest('[aria-hidden="true"]'));
    }, [marker, pathWant], 4000, 400);
  }
  if (!ready) throw new Error(`Business Suite ${kind} composer did not open ("${label}").`);
  await bsDismissBanners(tabId);
}

async function bsDismissBanners(tabId) {
  await bsExec(tabId, () => {
    // Close info banners only (never dialogs that ask for confirmation).
    for (const h of ["All videos you post on Facebook are now reels", "Test which title draws more attention", "Publish your video as a reel", "Earn with reels that use licensed music", "Connect your WhatsApp"]) {
      const t = [...document.querySelectorAll("span,div")].find(e => e.childElementCount === 0 && e.textContent.trim().startsWith(h));
      let box = t; for (let i = 0; i < 6 && box; i++) { box = box.parentElement; const x = box && [...box.querySelectorAll('[role="button"]')].find(b => /^Close/.test((b.getAttribute("aria-label") || b.innerText || "").trim())); if (x) { x.click(); break; } }
    }
  }).catch(() => {});
}

/** Lowest visible enabled button matching the regex (footer actions sit below the step tabs). */
async function bsClickLowest(tabId, regexSrc) {
  return await bsExec(tabId, (src) => {
    const re = new RegExp(src, "i");
    const els = [...document.querySelectorAll('[role="button"],button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 2 && !b.closest('[aria-hidden="true"]') && re.test((b.innerText || b.getAttribute("aria-label") || "").replace(/[​-‍﻿]/g, "").trim()); });
    els.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    const el = els.find(b => b.getAttribute("aria-disabled") !== "true" && !b.disabled);
    if (!el) return { clicked: false, found: els.length };
    el.scrollIntoView({ block: "center" }); el.click();
    return { clicked: true, label: el.innerText.trim() };
  }, [regexSrc]);
}
async function bsWaitEnabled(tabId, regexSrc, timeoutMs) {
  return await bsWaitFor(tabId, (src) => {
    const re = new RegExp(src, "i");
    const busy = /\b\d{1,2}%|Processing media|Uploading/i.test((document.querySelector('[role="main"]') || document.body).innerText);
    const ok = [...document.querySelectorAll('[role="button"],button')].some(b => b.getBoundingClientRect().width > 2 && !b.closest('[aria-hidden="true"]') && re.test((b.innerText || "").trim()) && b.getAttribute("aria-disabled") !== "true" && !b.disabled);
    return ok && !busy ? { ok: true } : { ok: false, busy };
  }, [regexSrc], timeoutMs, 700);
}

/** Writes the caption. Business Suite's editor keeps its real text in app state (shown in the preview), so we paste once
 *  into the fresh, empty composer and verify through the live preview, never through the editor's DOM. */
async function bsReadPreview(tabId) {
  return await bsExec(tabId, () => {
    const t = document.body.innerText;
    const k = Math.max(t.lastIndexOf("Facebook Feed preview"), t.lastIndexOf("Facebook reel preview"), t.lastIndexOf("Story preview"));
    return k >= 0 ? t.slice(k, k + 4000) : "";
  }).catch(() => "");
}
async function bsSetCaption(tabId, text, dbg) {
  if (!text) return { ok: true, skipped: true };
  const norm = s => String(s || "").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const first = norm(lines[0]).slice(0, 60);
  const before = norm(await bsReadPreview(tabId));
  const ok = await bsExec(tabId, (t) => {
    const eds = [...document.querySelectorAll('[contenteditable="true"]')].filter(e => e.getBoundingClientRect().width > 50 && !e.closest('[role="dialog"]') && !e.closest('[aria-hidden="true"]'));
    const ed = eds.find(e => /dialogue box|text with your post|describe|description|what your reel/i.test(e.getAttribute("aria-label") || e.getAttribute("aria-placeholder") || "")) || eds[0];
    if (!ed) return false;
    document.querySelectorAll("[data-ag-cap]").forEach(e => e.removeAttribute("data-ag-cap"));
    ed.setAttribute("data-ag-cap", "1"); ed.scrollIntoView({ block: "center" }); ed.click(); ed.focus();
    const dt = new DataTransfer(); dt.setData("text/plain", t);
    ed.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    return true;
  }, [/#[^\s#]+$/.test(text) ? text + " " : text]);
  if (!ok) throw new Error("Business Suite text box not found.");
  // Close the #hashtag / @mention suggestion list that opens after the last hashtag (it can swallow the text).
  const closeTypeahead = async () => {
    for (let i = 0; i < 3; i++) {
      const open = await bsExec(tabId, () => !![...document.querySelectorAll('[role="listbox"],[role="option"]')].find(e => e.getBoundingClientRect().width > 2 && /posts|#/i.test(e.innerText || ""))).catch(() => false);
      if (!open) break;
      if (dbg) await bsKey(tabId, "Escape"); else await bsExec(tabId, () => document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      await BS_W(200);
    }
  };
  await BS_W(400); await closeTypeahead();
  let prev = "", edTxt = "";
  const readEd = async () => norm(await bsExec(tabId, () => (document.querySelector("[data-ag-cap]") || {}).innerText || "").catch(() => ""));
  for (let i = 0; i < 12; i++) {
    await BS_W(500);
    prev = norm(await bsReadPreview(tabId)); edTxt = await readEd();
    if (prev.includes(first) || edTxt.includes(first)) break;
  }
  await closeTypeahead();
  if (prev.includes(first)) return { ok: true, method: "paste", verified: "preview" };
  if (edTxt.includes(first)) return { ok: true, method: "paste", verified: "editor" };
  if (!dbg) throw new Error("Caption was not accepted by Business Suite.");
  // Fallback: real keyboard input through CDP (focus already in the editor).
  const all = text.split("\n");
  for (let i = 0; i < all.length; i++) {
    if (all[i]) await bsType(tabId, all[i]);
    if (/#\S+$/.test(all[i])) await bsKey(tabId, "Escape");
    if (i < all.length - 1) { await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 }); await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 }); }
  }
  for (let i = 0; i < 8; i++) { await BS_W(500); prev = norm(await bsReadPreview(tabId)); edTxt = await readEd(); if (prev.includes(first) || edTxt.includes(first)) return { ok: true, method: "keyboard" }; }
  throw new Error("Caption could not be written into the Business Suite text box.");
}

function bsSchedParts(ms) {
  const d = new Date(ms); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  const p = n => String(n).padStart(2, "0");
  return { date: `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`, day: d.getDate(), mon: d.toLocaleString("en-US", { month: "short" }), hh: p(h), mm: p(d.getMinutes()), ap };
}

/** Sets Business Suite's native schedule (date + time fields). kind: post|reel|story. */
async function bsSetSchedule(tabId, ms, kind, dbg) {
  if (!dbg) throw new Error("Scheduling needs keyboard input (debugger) on the Business Suite tab.");
  if (kind === "post") {
    await bsExec(tabId, () => { const s = [...document.querySelectorAll('input[role="switch"]')].find(i => /Set date and time/i.test(i.getAttribute("aria-label") || "")); if (s && !s.checked) s.click(); });
  } else {
    await bsClickByText(tabId, "^Schedule$");
  }
  const has = await bsWaitFor(tabId, () => !!document.querySelector('input[placeholder="mm/dd/yyyy"]'), [], 8000);
  if (!has) throw new Error("Business Suite schedule fields did not appear.");
  const P = bsSchedParts(ms);
  const focus = async (sel) => bsExec(tabId, (s) => { const el = [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 2).pop(); if (!el) return false; el.scrollIntoView({ block: "center" }); el.focus(); el.click(); if (el.select) el.select(); return true; }, [sel]);
  await focus('input[placeholder="mm/dd/yyyy"]');
  await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
  await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
  await bsType(tabId, P.date); await bsKey(tabId, "Enter"); await BS_W(300); await bsKey(tabId, "Escape");
  const keyPress = async (key, code, vk) => {
    await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    if (key.length === 1) await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "char", key, text: key });
    await bsCdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  };
  const readSpin = (lab) => bsExec(tabId, (l) => { const e = [...document.querySelectorAll(`[role="spinbutton"][aria-label="${l}"]`)].filter(x => x.getBoundingClientRect().width > 2).pop(); return e ? +e.getAttribute("aria-valuenow") : NaN; }, [lab]);
  const target = { hours: +P.hh, minutes: +P.mm, meridiem: P.ap === "PM" ? 1 : 0 };
  for (const lab of ["hours", "minutes", "meridiem"]) {
    const ok = await focus(`[role="spinbutton"][aria-label="${lab}"]`);
    if (!ok) throw new Error(`Business Suite time field "${lab}" not found.`);
    if (lab === "meridiem") await keyPress(P.ap[0], `Key${P.ap[0]}`, P.ap.charCodeAt(0));
    else for (const ch of (lab === "hours" ? P.hh : P.mm)) await keyPress(ch, `Digit${ch}`, 48 + +ch);
    await BS_W(150);
    // Fallback: step with arrow keys until aria-valuenow matches.
    for (let i = 0; i < 70; i++) {
      const cur = await readSpin(lab);
      if (cur === target[lab]) break;
      await focus(`[role="spinbutton"][aria-label="${lab}"]`);
      const max = lab === "hours" ? 12 : lab === "minutes" ? 60 : 2;
      const up = ((target[lab] - cur) % max + max) % max <= max / 2;
      await keyPress(up ? "ArrowUp" : "ArrowDown", up ? "ArrowUp" : "ArrowDown", up ? 38 : 40);
      await BS_W(60);
    }
  }
  await bsKey(tabId, "Tab"); await BS_W(400);
  const got = await bsExec(tabId, () => ({
    date: ([...document.querySelectorAll('input[placeholder="mm/dd/yyyy"]')].filter(e => e.getBoundingClientRect().width > 2).pop() || {}).value,
    time: ["hours", "minutes", "meridiem"].map(l => { const e = [...document.querySelectorAll(`[role="spinbutton"][aria-label="${l}"]`)].filter(x => x.getBoundingClientRect().width > 2).pop(); return e ? +e.getAttribute("aria-valuenow") : NaN; })
  }));
  const dateOk = got.date && (got.date.includes(P.date) || (new RegExp(`\\b${P.day}\\b`).test(got.date) && got.date.includes(P.mon)));
  const timeOk = got.time[0] === target.hours && got.time[1] === target.minutes && got.time[2] === target.meridiem;
  if (!dateOk || !timeOk) throw new Error(`Schedule fields did not take the time (wanted ${P.date} ${P.hh}:${P.mm} ${P.ap}, got ${got.date} ${got.time.join(":")} [h:m:pm]).`);
  return { date: got.date, time: `${P.hh}:${P.mm} ${P.ap}` };
}

/** Upload a custom thumbnail in the Reel composer's Thumbnail section (waits for it to load). */
async function bsSetReelThumbnail(tabId, path) {
  const state = await bsWaitFor(tabId, () => {
    const h = [...document.querySelectorAll("span,div")].find(e => e.childElementCount === 0 && e.textContent.trim() === "Thumbnail");
    if (!h) return { ok: false, why: "no section" };
    let box = h; for (let i = 0; i < 8 && box; i++) { box = box.parentElement; if (box.getBoundingClientRect().height > 150) break; }
    if (box.querySelector('[data-is-placeholder="true"],[role="progressbar"]')) return { ok: false, why: "loading" };
    document.querySelectorAll("[data-ag-thumb]").forEach(e => e.removeAttribute("data-ag-thumb"));
    box.setAttribute("data-ag-thumb", "1");
    return { ok: true, labels: [...box.querySelectorAll('[role="button"],button,[role="radio"],[role="tab"]')].map(b => (b.getAttribute("aria-label") || b.innerText || "").trim()).filter(Boolean).slice(0, 20) };
  }, [], 90000, 1500);
  if (!state || !state.ok) return { ok: false, status: "thumbnail_panel_not_ready", detail: state && state.why };
  // Thumbnail -> "Upload image" tab -> "Upload image" link opens the file chooser.
  const mark = async () => bsExec(tabId, () => {
    const h = [...document.querySelectorAll("span,div")].find(e => e.childElementCount === 0 && e.textContent.trim() === "Thumbnail");
    let box = h; for (let i = 0; i < 8 && box; i++) { box = box.parentElement; if (box.getBoundingClientRect().height > 150) break; }
    if (!box) return false;
    const tabBtn = [...box.querySelectorAll('[role="button"]')].find(b => (b.innerText || "").trim() === "Upload image");
    if (tabBtn && !box.querySelector('a[role="link"]')) tabBtn.click();
    document.querySelectorAll("[data-ag-thumb-link]").forEach(e => e.removeAttribute("data-ag-thumb-link"));
    const link = [...box.querySelectorAll('a,[role="link"]')].find(a => /Upload image/i.test(a.innerText || a.getAttribute("aria-label") || ""));
    if (!link) return false;
    link.setAttribute("data-ag-thumb-link", "1");
    return true;
  });
  let marked = false;
  for (let i = 0; i < 6 && !marked; i++) { marked = await mark(); if (!marked) await BS_W(500); }
  const r = marked
    ? await bsAttachFiles(tabId, "css:[data-ag-thumb-link]", [path]).catch(e => ({ ok: false, error: e.message }))
    : { ok: false, error: "Upload image link not found" };
  if (!r.ok) return { ok: false, status: "thumbnail_upload_control_not_found", labels: state.labels, error: r.error };
  const applied = await bsWaitFor(tabId, () => {
    const d = [...document.querySelectorAll('[role="dialog"]')].pop();
    if (d) { const b = [...d.querySelectorAll('[role="button"]')].find(x => /^(Save|Apply|Done|Use|Upload)$/.test((x.innerText || "").trim()) && x.getAttribute("aria-disabled") !== "true"); if (b) { b.click(); return null; } }
    const h = [...document.querySelectorAll("span,div")].find(e => e.childElementCount === 0 && e.textContent.trim() === "Thumbnail");
    let box = h; for (let i = 0; i < 8 && box; i++) { box = box.parentElement; if (box.getBoundingClientRect().height > 150) break; }
    const img = box && [...box.querySelectorAll("img")].find(i => /^(blob:|data:|https:)/.test(i.src) && i.getBoundingClientRect().width > 30);
    return img && !/can['’]t|couldn['’]t|error/i.test(box.innerText) ? { ok: true } : null;
  }, [], 30000, 800);
  return applied ? { ok: true, status: "uploaded" } : { ok: false, status: "uploaded_unconfirmed" };
}

async function bsSetToggle(tabId, labelRe, want) {
  return await bsExec(tabId, (src, w) => {
    const s = [...document.querySelectorAll('input[role="switch"],input[type="checkbox"]')].find(i => new RegExp(src, "i").test(i.getAttribute("aria-label") || ""));
    if (!s) return null; if (!!s.checked !== !!w) s.click(); return s.checked;
  }, [labelRe, !!want]).catch(() => null);
}

async function bsWaitDone(tabId, startPath, timeoutMs = 90000) {
  return await bsWaitFor(tabId, (p) => {
    const txt = document.body.innerText;
    const err = /(couldn['’]t|could not|can['’]t|unable to) (be )?(publish|share|schedule|post)|something went wrong|try again/i.exec(txt);
    if (err && document.querySelector('[role="dialog"],[role="alert"]')) return { ok: true, error: err[0] };
    const left = !location.pathname.startsWith(p);
    const toast = /(post|reel|story|video)[^.\n]{0,40}(published|scheduled|shared|is being published|will be published)/i.exec(txt);
    return left || toast ? { ok: true, left, toast: toast && toast[0] } : null;
  }, [startPath], timeoutMs, 1000);
}

function bsBuildCaption(args) {
  const tags = (args.hashtags || []).map(h => String(h).trim()).filter(Boolean).map(h => h.startsWith("#") ? h : `#${h}`);
  let cap = String(args.caption || "").trim();
  const title = String(args.title || "").trim();
  if (title && !cap.startsWith(title)) cap = cap ? `${title}\n\n${cap}` : title;
  const missing = tags.filter(t => !cap.includes(t));
  if (missing.length) cap = `${cap}\n\n${missing.join(" ")}`.trim();
  return cap;
}

/**
 * Main entry. args: media_paths, caption, title, hashtags, thumbnail_path, schedule_time_iso|schedule_ms,
 * share_to_story, target_id, dry_run. kind: post|reel|story (videos always go to reel).
 */
async function bsPublish(kind, args = {}) {
  const t0 = Date.now();
  const media = (args.media_paths || []).filter(Boolean);
  const files = [];
  for (const p of media) files.push(await resolveLocalFile(p, kind !== "post"));
  const hasVideo = files.some(f => /^video\//.test(f.mimeType || "") || isVideoPath(f.path));
  if (kind === "post" && hasVideo) kind = "reel";
  if (kind === "reel" && !hasVideo) throw new Error("A Reel/video post needs a video file.");
  let when = args.schedule_ms || (args.schedule_time_iso ? Date.parse(args.schedule_time_iso) : null);
  if (when && !Number.isFinite(when)) throw new Error("schedule_time_iso is not a valid date/time.");
  if (when && when < Date.now() + 12 * 60000) throw new Error("Business Suite needs the scheduled time at least ~15 minutes ahead.");
  if (when && when > Date.now() + 29 * 86400000) throw new Error("Business Suite schedules up to 29 days ahead.");
  const caption = bsBuildCaption(args);
  const tab = await bsEnsureTab(BS_HOME_URL, { navigate: false });
  const tabId = tab.id;
  return await bsSession(tabId, async (dbg) => {
    const steps = [];
    const assetId = await bsAssetId(tabId, args.target_id);
    await bsOpenComposer(tabId, assetId, kind); steps.push("composer");
    const startPath = await bsExec(tabId, () => location.pathname);
    let thumb = null, sched = null;
    if (kind === "post") {
      await bsSetToggle(tabId, "Make this an ad post", false);
      if (files.length) {
        await bsAttachFiles(tabId, "^Add photo/video$", files.map(f => f.path)); steps.push("media");
        const ok = await bsWaitFor(tabId, (n) => [...document.querySelectorAll('[role="button"]')].filter(b => /^Remove (photo|video)/.test((b.getAttribute("aria-label") || b.innerText || "").trim())).length >= n && !/Processing media|\b\d{1,2}%/.test(document.body.innerText) ? { ok: true } : null, [files.length], 120000, 800);
        if (!ok) throw new Error("Business Suite did not finish processing the photos.");
      }
      await bsSetCaption(tabId, caption, dbg); steps.push("caption");
      await bsSetToggle(tabId, "Share to Facebook Story", !!args.share_to_story);
      if (when) { sched = await bsSetSchedule(tabId, when, "post", dbg); steps.push("schedule"); }
      if (args.dry_run) return { success: true, dry_run: true, kind, steps, schedule: sched, ms: Date.now() - t0 };
      const btn = when ? "^Schedule$" : "^Publish$";
      if (!await bsWaitEnabled(tabId, btn, 30000)) throw new Error(`"${btn.replace(/[\^$]/g, "")}" button stayed disabled.`);
      const c = await bsClickLowest(tabId, btn); if (!c.clicked) throw new Error("Could not press Publish/Schedule.");
    } else if (kind === "reel") {
      await bsAttachFiles(tabId, "^Add Video$", [files[0].path], { preferVideo: true }); steps.push("video");
      await bsDismissBanners(tabId);
      await bsSetCaption(tabId, caption, dbg); steps.push("caption");
      if (args.thumbnail_path) { thumb = await bsSetReelThumbnail(tabId, args.thumbnail_path); steps.push("thumbnail:" + thumb.status); }
      if (!await bsWaitEnabled(tabId, "^Next$", 15 * 60000)) throw new Error("Video upload did not finish in Business Suite.");
      if (caption) {
        const first = caption.split("\n").find(l => l.trim()).trim().slice(0, 40);
        const still = await bsExec(tabId, (f) => ((document.querySelector("[data-ag-cap]") || {}).innerText || "").includes(f), [first]).catch(() => false);
        if (!still) { await bsSetCaption(tabId, caption, dbg); steps.push("caption_retry"); }
      }
      await bsClickLowest(tabId, "^Next$"); await BS_W(1200);            // -> Edit
      if (!await bsWaitEnabled(tabId, "^Next$", 60000)) throw new Error("Reel Edit step did not load.");
      await bsClickLowest(tabId, "^Next$"); await BS_W(1200);            // -> Share
      await bsWaitFor(tabId, () => /Scheduling options/.test(document.body.innerText), [], 20000);
      await bsSetToggle(tabId, "Share to Facebook Story", !!args.share_to_story);
      if (when) { sched = await bsSetSchedule(tabId, when, "reel", dbg); steps.push("schedule"); }
      else await bsClickByText(tabId, "^Share now$");
      if (args.dry_run) return { success: true, dry_run: true, kind, steps, thumbnail: thumb, schedule: sched, ms: Date.now() - t0 };
      const btn = when ? "^(Schedule|Share)$" : "^(Share|Publish)$";
      if (!await bsWaitEnabled(tabId, btn, 60000)) throw new Error("Final Share/Schedule button stayed disabled.");
      const c = await bsClickLowest(tabId, btn); if (!c.clicked) throw new Error("Could not press Share/Schedule.");
    } else { // story
      if (!files.length) throw new Error("A Story needs a photo or video.");
      await bsAttachFiles(tabId, "^(Add photo/video|Add photos?|Add videos?|Add media|Upload)$", [files[0].path], { preferVideo: hasVideo }); steps.push("media");
      if (when) { sched = await bsSetSchedule(tabId, when, "story", dbg).catch(e => { throw new Error("Story scheduling: " + e.message); }); steps.push("schedule"); }
      if (args.dry_run) return { success: true, dry_run: true, kind, steps, schedule: sched, ms: Date.now() - t0 };
      const btn = when ? "^(Schedule|Schedule story)$" : "^(Share story|Publish|Share|Post)$";
      if (!await bsWaitEnabled(tabId, btn, 10 * 60000)) throw new Error("Story Share button stayed disabled.");
      const c = await bsClickLowest(tabId, btn); if (!c.clicked) throw new Error("Could not press Share.");
    }
    steps.push("submitted");
    const done = await bsWaitDone(tabId, startPath, kind === "post" ? 90000 : 180000);
    if (done && done.error) throw new Error(`Business Suite reported: ${done.error}`);
    if (!done) throw new Error("Pressed the final button but Business Suite did not confirm. Check Business Suite > Content/Planner before retrying.");
    return {
      success: true, via: "meta_business_suite", kind, status: when ? "scheduled" : "published",
      scheduled_for: when ? new Date(when).toLocaleString() : undefined, schedule_fields: sched || undefined,
      thumbnail: thumb || undefined, caption, steps, asset_id: assetId, confirmation: done.toast || "composer closed", ms: Date.now() - t0
    };
  });
}

async function bsPublishTool(toolName, args) {
  const kind = toolName === "fb_publish_reel" ? "reel" : toolName === "fb_publish_story" ? "story" : (/^(reel|video)$/i.test(args.post_type || "") ? "reel" : /^story$/i.test(args.post_type || "") ? "story" : "post");
  const media = args.media_paths || (args.video_path ? [args.video_path] : args.media_path ? [args.media_path] : []);
  return await bsPublish(kind, { ...args, media_paths: media });
}

self.MetaBS.bsPublish = bsPublish;
self.MetaBS.bsPublishTool = bsPublishTool;
self.MetaBS.bsAssetId = bsAssetId;
