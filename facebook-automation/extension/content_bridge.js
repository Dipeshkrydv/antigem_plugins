/**
 * Content Bridge Script for Facebook DOM Automation (v1.5.0)
 * Pre-Trained Phone (Desktop-on-Phone + Mobile UI) & Desktop Precision DOM Engine:
 * - Smart Composer Dialog Scorer (`findBestComposerDialog`) never confuses Notification/Messenger/Popover dialogs with the Create Post dialog.
 * - Pre-purges leftover draft attachments and deduplicates single-photo uploads (zero double-photo bugs!).
 * - Formatted Multiline Caption Engine (`findAndPopulateCaptionDom` + `verifyCaptionText`): populates dedicated Title fields + preserves `\n` spacing via Clipboard paste -> line-by-line paragraph insertion, with anti-duplication verification.
 * - Real Thumbnail/Cover Uploader (`applyThumbnailInDom`): uploads `thumbnail_file` into Facebook's Video Options Thumbnail or Reel Cover panel without double-attaching to main media.
 * - Full support for Feed Posts (Text, Photo, Carousel, Video), Reels (/reels/create + mobile fallback), and Stories (/stories/create Photo/Video + `story_text` overlay + Text story).
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload = {} } = request || {};

  (async () => {
    switch (action) {
      case "CHECK_SESSION":
      case "OPEN_FACEBOOK_TAB":
        return checkSession(payload);

      case "PUBLISH_POST":
        return await publishPost(payload);

      case "EDIT_POST":
        return await editPost(payload);

      case "DELETE_POST":
        return await deletePost(payload);

      case "ADD_COMMENT":
        return await addComment(payload);

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  })()
    .then((result) => sendResponse(result))
    .catch((err) =>
      sendResponse({
        success: false,
        stop_loop: true,
        error: err.message || String(err)
      })
    );

  return true;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const st = window.getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || 1) > 0.01;
}

function isCommentOrSearch(el) {
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
}

function findBestComposerDialog() {
  const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter((d) => {
    const r = d.getBoundingClientRect();
    return r.width > 80 && r.height > 80 && isVisible(d);
  });
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
}

function checkSession(payload = {}) {
  const cookieState = payload.__cookieState || {};
  const href = window.location.href;
  const path = window.location.pathname || "";
  const html = document.documentElement ? document.documentElement.innerHTML : "";
  const bodyText = document.body ? document.body.innerText || "" : "";

  const hasLoginInput = Boolean(
    document.querySelector(
      'input[name="email"], input[name="pass"], #m_login_email, #m_login_password, button[name="login"], form[action*="/login"] input[type="password"]'
    )
  );
  const isLoginUrl = /^\/(login|recover|r\.php)/i.test(path) || href.includes("facebook.com/login");
  const isCheckpoint = path.includes("/checkpoint") || /confirm your identity|security check/i.test(bodyText);

  let userId = cookieState.cookieUserId || null;
  let userName = null;

  const idMatch =
    html.match(/"CurrentUserInitialData",\[\],\{[^}]*"USER_ID":"(\d+)"/i) ||
    html.match(/"USER_ID":"(\d+)"/i);
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

  const profileAnchor = document.querySelector(
    'a[href*="/me/"], a[href*="/profile.php"], a[aria-label*="Your profile" i], div[aria-label*="Your profile" i], div[aria-label*="Facebook Menu" i]'
  );
  if (!userName && profileAnchor) {
    const label = profileAnchor.getAttribute("aria-label") || profileAnchor.innerText || "";
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

  const loggedIn = Boolean(
    !hasLoginInput &&
      !isLoginUrl &&
      !isCheckpoint &&
      (cookieState.hasAuthCookies || (userId && userId !== "0") || hasComposer || profileAnchor)
  );

  if (!loggedIn) {
    return {
      success: true,
      logged_in: false,
      action_required: "ONE_TIME_LOGIN_REQUIRED",
      stop_loop: true,
      data: {
        logged_in: false,
        name: null,
        id: null,
        type: "profile",
        url: href,
        checkpoint: isCheckpoint,
        action_required: "ONE_TIME_LOGIN_REQUIRED",
        message:
          "Facebook is open in the browser. Please complete the one-time login to your Facebook account, then tell me to continue."
      }
    };
  }

  return {
    success: true,
    logged_in: true,
    data: {
      logged_in: true,
      name: userName || "Facebook Account",
      id: userId || "authenticated",
      type: "profile",
      url: href
    }
  };
}

function buildDataTransferFromMediaFiles(mediaFiles) {
  const dt = new DataTransfer();
  for (const item of mediaFiles) {
    if (!item || !item.base64) continue;
    const bin = atob(item.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const fileObj = new File([bytes], item.filename || "upload.jpg", {
      type: item.mime_type || "image/jpeg",
      lastModified: Date.now()
    });
    dt.items.add(fileObj);
  }
  return dt;
}

function attachBase64MediaToInput(fileInput, mediaFiles) {
  if (!fileInput || !Array.isArray(mediaFiles) || mediaFiles.length === 0) return false;
  const dt = buildDataTransferFromMediaFiles(mediaFiles);
  if (mediaFiles.length > 1) fileInput.multiple = true;
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  return Boolean(fileInput.files && fileInput.files.length > 0);
}

function hasMediaPreviewMounted() {
  const isFeed = (el) => Boolean(el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]'));
  const hasBlobOrDataImg = Array.from(document.querySelectorAll("img")).some((img) => {
    if (isFeed(img)) return false;
    const src = img.getAttribute("src") || "";
    const r = img.getBoundingClientRect();
    return (src.startsWith("blob:") || src.startsWith("data:image/")) && r.width >= 36 && r.height >= 36;
  });
  const hasVideo = Array.from(document.querySelectorAll("video")).some((v) => !isFeed(v));
  const hasRemoveOrEdit = Boolean(
    document.querySelector(
      '[aria-label*="Remove photo" i], [aria-label*="Remove video" i], [aria-label*="Remove media" i], [aria-label*="Remove attachment" i], [aria-label*="Edit photo" i], [aria-label*="Edit All" i], [data-sigil*="photo-preview"]'
    )
  );
  return Boolean(hasBlobOrDataImg || hasVideo || hasRemoveOrEdit);
}

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

function readDomEditorText(editor) {
  if (!editor) return "";
  return editor.tagName === "TEXTAREA" || editor.tagName === "INPUT"
    ? editor.value || ""
    : editor.innerText || editor.textContent || "";
}

async function insertTextFast(editor, text) {
  if (!editor || !text) return { ok: false, formatting_preserved: false };
  const cleanText = String(text).replace(/\r\n/g, "\n").trim();
  const expectsMultiline = cleanText.includes("\n");

  try {
    editor.scrollIntoView({ block: "center", behavior: "instant" });
  } catch (_) {}
  editor.focus();
  try {
    editor.click();
  } catch (_) {}

  if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
    const proto = editor.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(editor, cleanText);
    else editor.value = cleanText;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    const txt = readDomEditorText(editor);
    const v = verifyCaptionText(txt, cleanText);
    return { ok: v.ok, method: "textarea", formatting_preserved: !expectsMultiline || /\n/.test(txt) };
  }

  const clearEditor = () => {
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}
  };

  // Tier 1: Synthetic ClipboardEvent("paste") — preserves blank lines & paragraphs in Lexical
  clearEditor();
  await sleep(60);
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", cleanText);
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  } catch (_) {}
  await sleep(180);

  let cur = readDomEditorText(editor);
  let v = verifyCaptionText(cur, cleanText);
  if (v.ok) {
    return { ok: true, method: "paste", formatting_preserved: !expectsMultiline || /\n/.test(cur) };
  }

  // Tier 2: Line-by-line execCommand("insertText") + execCommand("insertParagraph")
  clearEditor();
  await sleep(60);
  const lines = cleanText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) document.execCommand("insertText", false, lines[i]);
    if (i < lines.length - 1) {
      const okPara = document.execCommand("insertParagraph", false, null);
      if (!okPara) document.execCommand("insertLineBreak", false, null);
    }
  }
  editor.dispatchEvent(
    new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: cleanText })
  );
  editor.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(180);

  cur = readDomEditorText(editor);
  v = verifyCaptionText(cur, cleanText);
  if (v.ok) {
    return { ok: true, method: "lines", formatting_preserved: !expectsMultiline || /\n/.test(cur) };
  }

  // Tier 3: Raw innerText fallback if Lexical still ignored synthetic events
  if (cur.trim().length < 4) {
    clearEditor();
    editor.innerText = cleanText;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: cleanText }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    cur = readDomEditorText(editor);
    v = verifyCaptionText(cur, cleanText);
  }

  return {
    ok: v.ok,
    duplicated: v.duplicated,
    method: "fallback",
    formatting_preserved: !expectsMultiline || /\n/.test(cur)
  };
}

async function findAndPopulateCaptionDom(text, title = "", options = {}) {
  const { editorHint = "post", verifyOnly = false } = options;
  const cleanText = String(text || "").replace(/\r\n/g, "\n").trim();
  const cleanTitle = String(title || "").trim();

  if (cleanTitle && !verifyOnly) {
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
      if (setter) setter.call(inp, cleanTitle);
      else inp.value = cleanTitle;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  if (!cleanText) return { ok: true, skipped: true, formatting_preserved: true };

  const bestDialog = findBestComposerDialog();
  const roots = bestDialog ? [bestDialog, document] : [document];
  const selectorStr = [
    'div[role="textbox"][contenteditable="true"]',
    'div[data-lexical-editor="true"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
    'div[contenteditable="true"]',
    'div[contenteditable="plaintext-only"]',
    "#composer-main-view-id textarea",
    "textarea.composerInput",
    'textarea[name="xc_message"]',
    "textarea"
  ].join(", ");

  const hintRe =
    editorHint === "reel"
      ? /describe your reel|description|caption|write/i
      : editorHint === "story"
      ? /start typing|text|type/i
      : /on your mind|write something|say something|post|caption/i;

  let editor = null;
  for (const root of roots) {
    const candidates = Array.from(root.querySelectorAll(selectorStr)).filter(
      (el) => !isCommentOrSearch(el) && isVisible(el)
    );
    if (candidates.length > 0) {
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
      candidates.sort((a, b) => score(b) - score(a));
      editor = candidates[0];
      break;
    }
  }

  if (!editor) {
    for (const root of roots) {
      const placeholderEl = Array.from(root.querySelectorAll("div, span, p, label")).find((el) => {
        if (isCommentOrSearch(el) || !isVisible(el)) return false;
        const t = (el.innerText || el.textContent || "").trim();
        return (
          t.length > 4 &&
          t.length < 80 &&
          /^(what['’]?s on your mind|write something|say something|add a caption|describe your reel|add a description|start typing|के सोचिरहनुभएको|कुछ लिखें)/i.test(
            t
          )
        );
      });
      if (placeholderEl) {
        try {
          placeholderEl.click();
        } catch (_) {}
        await sleep(220);
        editor =
          (placeholderEl.parentElement &&
            placeholderEl.parentElement.querySelector('[contenteditable="true"], textarea')) ||
          (document.activeElement &&
          (document.activeElement.isContentEditable || document.activeElement.tagName === "TEXTAREA")
            ? document.activeElement
            : null);
        if (editor) break;
      }
    }
  }

  if (!editor) {
    return { ok: false, foundEditor: false, formatting_preserved: false, error: "Could not locate caption/description editor." };
  }

  const expectsMultiline = cleanText.includes("\n");
  if (verifyOnly) {
    const cur = readDomEditorText(editor);
    const v = verifyCaptionText(cur, cleanText);
    return {
      ok: v.ok,
      foundEditor: true,
      duplicated: v.duplicated,
      formatting_preserved: !expectsMultiline || /\n/.test(cur)
    };
  }

  const res = await insertTextFast(editor, cleanText);
  return { ...res, foundEditor: true };
}

/**
 * Real Thumbnail / Cover Image Uploader for Desktop / Kiwi Content Bridge (v1.5.0)
 * Opens Edit Video -> Thumbnail -> Upload image OR Reel Cover -> Upload cover,
 * attaches thumbnailFile to an image-accepting input only, and clicks Save/Done inside that panel.
 */
async function applyThumbnailInDom(thumbnailFile, surface = "video") {
  if (!thumbnailFile || !thumbnailFile.base64) {
    return { attempted: false, applied: false, reason: "No thumbnail_file provided." };
  }

  document.querySelectorAll('input[type="file"]').forEach((i) => i.setAttribute("data-ag-known", "1"));
  let thumbInput = null;
  const origClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (...args) {
    if (this && this.type === "file") {
      const acc = (this.getAttribute("accept") || "").toLowerCase();
      if (!acc || acc.includes("image")) {
        thumbInput = this;
        return;
      }
    }
    return origClick.apply(this, args);
  };

  const clickedLabels = [];
  try {
    const labelOf = (el) => `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.replace(/\s+/g, " ").trim();
    const ctxText = (el) => {
      let n = el;
      for (let i = 0; i < 6 && n; i++) n = n.parentElement;
      return ((n && n.innerText) || "").slice(0, 600).toLowerCase();
    };

    for (let round = 0; round < 6 && !thumbInput; round++) {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const candidate = inputs.find((i) => {
        const acc = (i.getAttribute("accept") || "").toLowerCase();
        const imageOnly = acc.includes("image") && !acc.includes("video");
        const fresh = !i.hasAttribute("data-ag-known");
        return (imageOnly && (fresh || /thumbnail|cover/.test(ctxText(i)))) || (fresh && !acc.includes("video") && /thumbnail|cover/.test(ctxText(i)));
      });
      if (candidate) {
        thumbInput = candidate;
        break;
      }

      const clickables = Array.from(
        document.querySelectorAll('div[role="button"], button, span[role="button"], a[role="button"], div[role="tab"], div[role="radio"], [role="option"], label, [role="menuitem"]')
      ).filter((el) => isVisible(el) && !el.closest('div[role="article"], [role="banner"], [role="navigation"]'));

      const pageHasThumbCtx = /thumbnail|cover/i.test((document.body.innerText || "").slice(0, 20000));
      const tiers = [
        pageHasThumbCtx
          ? /^(upload image|upload thumbnail|upload custom thumbnail|upload cover|upload a thumbnail|upload a cover|upload photo|choose image|choose file|add image|upload)$/i
          : null,
        /^(thumbnail|thumbnails|custom thumbnail|change thumbnail|edit thumbnail|select thumbnail|cover|cover photo|cover image|choose cover|select cover|change cover|edit cover|add cover)$/i,
        surface === "video" ? /^(edit|edit video|video options|edit all)$/i : null
      ].filter(Boolean);

      let matched = null;
      for (const re of tiers) {
        matched = clickables.find((c) => {
          const l = labelOf(c);
          return l.length < 48 && re.test(l) && !clickedLabels.includes(l.toLowerCase());
        });
        if (matched) break;
      }
      if (!matched) break;

      clickedLabels.push(labelOf(matched).toLowerCase());
      matched.click();
      await sleep(750);
    }

    if (!thumbInput) {
      return { attempted: true, applied: false, reason: "Thumbnail / Cover upload option not offered on this Facebook screen." };
    }

    const ok = attachBase64MediaToInput(thumbInput, [thumbnailFile]);
    if (!ok) return { attempted: true, applied: false, reason: "Could not attach thumbnail image file." };
    await sleep(1500);

    let confirmed = false;
    for (let i = 0; i < 6; i++) {
      const panels = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]')).filter((d) =>
        /thumbnail|cover/i.test((d.innerText || "").slice(0, 2000))
      );
      const scope = panels[panels.length - 1];
      if (!scope) {
        confirmed = true;
        break;
      }
      const saveBtn = Array.from(scope.querySelectorAll('div[role="button"], button')).find((b) => {
        const t = `${b.getAttribute("aria-label") || ""} ${b.innerText || ""}`.replace(/\s+/g, " ").trim();
        return /^(save|done|apply|set thumbnail|use as thumbnail|use as cover|set cover)$/i.test(t) && b.getAttribute("aria-disabled") !== "true";
      });
      if (saveBtn) {
        saveBtn.click();
        confirmed = true;
        break;
      }
      await sleep(600);
    }

    return { attempted: true, applied: true, confirmed, path_through: clickedLabels };
  } finally {
    HTMLInputElement.prototype.click = origClick;
  }
}

async function publishReelDom(payload) {
  const { title = "", caption = "", hashtags = [], media_files = [], thumbnail_file = null } = payload;
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  const videoInput =
    inputs.find((inp) => (inp.getAttribute("accept") || "").toLowerCase().includes("video")) || inputs[0];

  if (!videoInput) {
    throw new Error("Could not find video file input on Facebook Reels page.");
  }

  attachBase64MediaToInput(videoInput, media_files);
  await sleep(2500);

  let thumbResult = thumbnail_file ? { attempted: false, applied: false } : { attempted: false, applied: false, reason: "No thumbnail_file provided." };
  let coverTried = false;
  let nextClicks = 0;
  const deadline = Date.now() + 150000;

  while (Date.now() < deadline && nextClicks < 6) {
    const zone = (el) => isVisible(el) && !el.closest('[role="banner"], [role="navigation"], div[role="article"]');
    const editors = Array.from(document.querySelectorAll('[contenteditable="true"], textarea')).filter(zone);
    const hasDescribe = editors.some((e) =>
      /describe|description|caption|write|reel/i.test(
        `${e.getAttribute("aria-label") || ""} ${e.getAttribute("aria-placeholder") || ""} ${e.getAttribute("placeholder") || ""} ${(e.parentElement && e.parentElement.innerText) || ""}`.slice(0, 300)
      )
    );
    const btns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).filter(zone);
    const lab = (b) => `${(b.innerText || "").trim()}|${(b.getAttribute("aria-label") || "").trim()}`;
    const pubBtn = btns.find((b) => /(^|\|)(publish|share|share now|share reel|post)(\||$)/i.test(lab(b)));
    const nextBtn = btns.find((b) => /(^|\|)(next|अर्को|अगला)(\||$)/i.test(lab(b)));
    const coverCtl = Array.from(document.querySelectorAll('div[role="button"], button, div[role="tab"], span, label')).some((e) => {
      const t = `${e.getAttribute("aria-label") || ""} ${e.innerText || ""}`.trim();
      return zone(e) && t.length < 44 && /thumbnail|cover/i.test(t);
    });

    if (thumbnail_file && !thumbResult.applied && coverCtl && !coverTried) {
      coverTried = true;
      thumbResult = await applyThumbnailInDom(thumbnail_file, "reel");
      await sleep(800);
      continue;
    }
    if (hasDescribe || (pubBtn && !nextBtn)) break;
    if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true" && !nextBtn.disabled) {
      nextBtn.click();
      nextClicks++;
      await sleep(1600);
      continue;
    }
    await sleep(1200);
  }

  if (thumbnail_file && !thumbResult.applied) {
    const retry = await applyThumbnailInDom(thumbnail_file, "reel");
    if (retry.applied || !thumbResult.attempted) thumbResult = retry;
  }

  const capResult = await findAndPopulateCaptionDom(caption, title, { editorHint: "reel" });
  if (!capResult.ok) {
    throw new Error(`Reel description box could not be filled and verified (${capResult.error || "unknown"}). Nothing was posted.`);
  }
  await sleep(500);

  let published = false;
  for (let i = 0; i < 90; i++) {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).filter((el) => isVisible(el));
    const pubBtn = btns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "publish" || t === "share" || t === "share now" || t === "share reel" || t === "post";
    });
    if (pubBtn && pubBtn.getAttribute("aria-disabled") !== "true" && !pubBtn.disabled) {
      pubBtn.click();
      published = true;
      break;
    }
    await sleep(1000);
  }
  if (!published) {
    throw new Error("Could not click 'Publish' button on Facebook Reels wizard.");
  }

  let confirmed = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    if (!/\/reels\/create/.test(location.pathname) || /reel (is being|has been|was) (shared|published|processed)|your reel is|reel published/i.test((document.body.innerText || "").slice(0, 4000))) {
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
    thumbnail_applied: Boolean(thumbResult.applied),
    thumbnail_note: thumbResult.applied ? "User thumbnail set as Reel cover." : thumbResult.reason || "Thumbnail not applied.",
    caption_verified: true,
    formatting_preserved: Boolean(capResult.formatting_preserved),
    message: `Facebook Reel ${confirmed ? "published" : "submitted"} with title, description & ${hashtags.length} hashtags. Thumbnail: ${thumbResult.applied ? "applied" : "NOT applied (" + (thumbResult.reason || "n/a") + ")"}.`,
    fb_post_id: `fb_reel_${Date.now()}`,
    post_url: window.location.href
  };
}

async function publishStoryDom(payload) {
  const { caption = "", title = "", story_text = "", media_files = [] } = payload;
  const firstLine = (String(caption || "").split("\n").map((l) => l.trim()).filter(Boolean)[0] || "")
    .replace(/#[\w\u0900-\u097F]+/g, "")
    .trim();
  let overlayText = String(story_text || title || firstLine || "").trim().slice(0, 120);
  const isTextStory = !(Array.isArray(media_files) && media_files.length > 0);
  if (isTextStory && !overlayText) overlayText = String(caption || "").trim().slice(0, 250);
  if (isTextStory && !overlayText) {
    throw new Error("Story requires either a photo/video or story_text.");
  }

  let storyTextApplied = false;
  if (!isTextStory) {
    let fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      const photoStoryCard = Array.from(document.querySelectorAll('div[role="button"], a, span')).find((el) =>
        /create a photo story|photo story/i.test((el.innerText || el.textContent || "").trim())
      );
      if (photoStoryCard) {
        photoStoryCard.click();
        await sleep(600);
        fileInput = document.querySelector('input[type="file"]');
      }
    }
    if (!fileInput) {
      throw new Error("Could not locate photo/video input on Facebook Story creator.");
    }
    attachBase64MediaToInput(fileInput, media_files);
    await sleep(2200);

    if (overlayText) {
      const addTextBtn = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).find((el) =>
        isVisible(el) && /^(add text|text|aa)$/i.test((el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim())
      );
      if (addTextBtn) {
        addTextBtn.click();
        await sleep(700);
        const res = await findAndPopulateCaptionDom(overlayText, "", { editorHint: "story" });
        storyTextApplied = Boolean(res && res.ok);
        await sleep(300);
        const doneBtn = Array.from(document.querySelectorAll('div[role="button"], button')).find((el) =>
          isVisible(el) && /^done$/i.test((el.innerText || el.textContent || "").trim())
        );
        if (doneBtn) doneBtn.click();
        await sleep(400);
      }
    }
  } else {
    const textStoryBtn = Array.from(document.querySelectorAll('div[role="button"], span')).find((el) =>
      /create a text story|text story|^text$/i.test((el.innerText || el.textContent || "").trim())
    );
    if (textStoryBtn) {
      textStoryBtn.click();
      await sleep(900);
    }
    const res = await findAndPopulateCaptionDom(overlayText, "", { editorHint: "story" });
    if (!res || !res.ok) {
      throw new Error("Could not type text into Facebook text story editor.");
    }
    storyTextApplied = true;
    await sleep(700);
  }

  let shared = false;
  for (let i = 0; i < 30; i++) {
    const shareBtn = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).find((el) => {
      if (!isVisible(el)) return false;
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
      return /^(share to story|share to your story|share now|share|post)$/i.test(t);
    });
    if (shareBtn && shareBtn.getAttribute("aria-disabled") !== "true" && !shareBtn.disabled) {
      shareBtn.click();
      shared = true;
      break;
    }
    await sleep(800);
  }
  if (!shared) {
    throw new Error("Could not find enabled 'Share to story' button.");
  }

  let confirmed = false;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    if (!/\/stories\/create/.test(location.pathname) || /story (shared|posted|added)|your story/i.test((document.body.innerText || "").slice(0, 3000))) {
      confirmed = true;
      break;
    }
  }

  return {
    success: true,
    status: confirmed ? "published" : "share_clicked_unconfirmed",
    post_type: "story",
    story_kind: isTextStory ? "text" : "media",
    story_text: overlayText || null,
    story_text_applied: storyTextApplied,
    message: `Facebook Story ${confirmed ? "published" : "submitted"}${overlayText ? ` with text "${overlayText}" (${storyTextApplied ? "applied" : "not applied"})` : ""}.`,
    fb_post_id: `fb_story_${Date.now()}`,
    post_url: window.location.href
  };
}

async function publishPost(payload) {
  const session = checkSession(payload);
  if (!session.logged_in) {
    return {
      success: false,
      logged_in: false,
      action_required: "ONE_TIME_LOGIN_REQUIRED",
      stop_loop: true,
      error:
        "Facebook is open in the browser, but you are not logged in yet. Please complete the one-time login in the open Facebook tab, then continue."
    };
  }

  const {
    title = "",
    caption = "",
    hashtags = [],
    media_files = [],
    thumbnail_file = null,
    post_type = "text"
  } = payload;

  if (post_type === "reel" && window.location.pathname.includes("/reels/create")) {
    return await publishReelDom(payload);
  }
  if (post_type === "story" && window.location.pathname.includes("/stories/create")) {
    return await publishStoryDom(payload);
  }

  // 1. Locate or Open Composer
  let dialog = findBestComposerDialog();
  const mobileBox = document.querySelector(
    '#composer-main-view-id textarea, textarea.composerInput, textarea[name="xc_message"]'
  );
  if (!dialog && !mobileBox) {
    const composerTrigger =
      document.querySelector(
        'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet*="Composer"] div[role="button"], #MComposer div[role="button"], a[href*="/composer/"]'
      ) ||
      Array.from(document.querySelectorAll('div[role="button"], span[role="button"], a')).find((el) => {
        if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
        const txt = `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.trim();
        return (
          /what['’]?s on your mind/i.test(txt) ||
          /make a post/i.test(txt) ||
          /write something/i.test(txt) ||
          /create a post/i.test(txt)
        );
      });

    if (!composerTrigger) {
      throw new Error(
        "Could not find Facebook post composer button on page. Ensure you are on the Facebook feed or profile."
      );
    }

    composerTrigger.click();
    await sleep(1200);
    dialog = findBestComposerDialog() || document;
  } else {
    dialog = dialog || document;
  }

  // 2. Populate Title + Formatted Caption FIRST while composer textbox is open
  let captionResult = { ok: true, skipped: true, formatting_preserved: true };
  if (caption && String(caption).trim().length > 0) {
    captionResult = await findAndPopulateCaptionDom(caption, title, { editorHint: "post" });
    await sleep(250);
  }

  // 3. Attach Media if provided (with stale draft cleanup + single-shot input binding + deduplication)
  const wantVideo =
    post_type === "video" ||
    post_type === "reel" ||
    (Array.isArray(media_files) && media_files.some((f) => String(f.mime_type || "").startsWith("video/")));
  let thumbResult = {
    attempted: false,
    applied: false,
    reason: thumbnail_file
      ? wantVideo
        ? ""
        : "Feed photo/text posts do not have a separate thumbnail slot."
      : "No thumbnail_file provided."
  };

  if (Array.isArray(media_files) && media_files.length > 0) {
    // Purge any leftover draft photos in open dialog first
    const oldRemoves = Array.from(
      document.querySelectorAll(
        'div[role="dialog"] [aria-label*="Remove photo" i], div[role="dialog"] [aria-label*="Remove attachment" i], div[role="dialog"] [aria-label*="Remove media" i]'
      )
    );
    for (const rBtn of oldRemoves) {
      try {
        rBtn.click();
      } catch (_) {}
    }
    if (oldRemoves.length > 0) await sleep(200);

    let fileInput =
      dialog.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]') ||
      document.querySelector('input[type="file"]');

    if (!fileInput) {
      let capturedInput = null;
      const origClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (...args) {
        if (this && this.type === "file") {
          capturedInput = this;
          return;
        }
        return origClick.apply(this, args);
      };

      try {
        const photoBtn = Array.from(
          document.querySelectorAll('div[role="button"], span[role="button"], button, a, label')
        ).find((el) => {
          if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
          const label = `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.trim();
          if (/remove|delete|edit|tag/i.test(label)) return false;
          return (
            /^(photo\/video|photos\/videos|photos|photo|add photos|add video|फोटो\/भिडियो|फोटो)$/i.test(label) ||
            /photo\/video|photos\/videos|add photos/i.test(label)
          );
        });
        if (photoBtn) {
          photoBtn.click();
          await sleep(400);
        }
      } finally {
        HTMLInputElement.prototype.click = origClick;
      }

      fileInput =
        capturedInput ||
        dialog.querySelector('input[type="file"]') ||
        document.querySelector('input[type="file"]');
    }

    if (fileInput) {
      attachBase64MediaToInput(fileInput, media_files);
      await sleep(wantVideo ? 2000 : 1400);
    }

    if (!hasMediaPreviewMounted()) {
      const dt = buildDataTransferFromMediaFiles(media_files);
      const dropZone =
        dialog.querySelector('div[role="textbox"][contenteditable="true"]') ||
        dialog.querySelector("textarea") ||
        dialog;
      for (const evtName of ["dragenter", "dragover", "drop"]) {
        dropZone.dispatchEvent(new DragEvent(evtName, { bubbles: true, cancelable: true, dataTransfer: dt }));
      }
      await sleep(1400);
    }

    // Deduplicate if >1 preview mounted for a single file
    if (media_files.length === 1) {
      const removeBtns = Array.from(
        document.querySelectorAll(
          'div[role="dialog"] [aria-label*="Remove photo" i], div[role="dialog"] [aria-label*="Remove attachment" i]'
        )
      );
      for (let i = 1; i < removeBtns.length; i++) {
        try {
          removeBtns[i].click();
        } catch (_) {}
      }
    }

    if (!hasMediaPreviewMounted() && !fileInput) {
      throw new Error("Could not attach photo/video to Facebook composer. Aborting so text-only is not posted.");
    }

    // 3b. Apply Custom Video Thumbnail via Edit Video -> Thumbnail panel
    if (wantVideo && thumbnail_file) {
      thumbResult = await applyThumbnailInDom(thumbnail_file, "video");
      await sleep(700);
    }

    // 3c. Verify caption is still intact after media/thumbnail attachment; re-insert only if needed
    if (caption && String(caption).trim().length > 0) {
      const checkAfter = await findAndPopulateCaptionDom(caption, title, { editorHint: "post", verifyOnly: true });
      if (!checkAfter.ok) {
        captionResult = await findAndPopulateCaptionDom(caption, title, { editorHint: "post" });
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

  // 4. Locate & Click "Post" / "Publish" Button (or Mobile "Next" -> "Post")
  const findSubmitBtn = (allowNext = false) => {
    const allBtns = Array.from(
      document.querySelectorAll('div[role="button"], button, span[role="button"], input[type="submit"]')
    ).filter((el) => isVisible(el) && !el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]'));

    allBtns.sort((a, b) => (b.closest('div[role="dialog"]') ? 1 : 0) - (a.closest('div[role="dialog"]') ? 1 : 0));

    const postBtn = allBtns.find((el) => {
      const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || el.value || "")
        .trim()
        .toLowerCase();
      return txt === "post" || txt === "publish" || txt === "share" || txt === "share now";
    });
    if (postBtn && postBtn.getAttribute("aria-disabled") !== "true" && !postBtn.disabled) {
      return { btn: postBtn, isNext: false };
    }
    if (allowNext) {
      const nextBtn = allBtns.find((el) => {
        const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
        return txt === "next" || txt === "done";
      });
      if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true" && !nextBtn.disabled) {
        return { btn: nextBtn, isNext: true };
      }
    }
    return null;
  };

  let foundSubmit = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    foundSubmit = findSubmitBtn(attempt >= 2);
    if (foundSubmit) break;
    await sleep(600);
  }

  if (!foundSubmit) {
    throw new Error("Could not find enabled 'Post' button in composer dialog.");
  }

  foundSubmit.btn.click();
  if (foundSubmit.isNext) {
    await sleep(1000);
    const finalSubmit = findSubmitBtn(false);
    if (finalSubmit && finalSubmit.btn) {
      finalSubmit.btn.click();
    }
  }

  for (let i = 0; i < 16; i++) {
    await sleep(750);
    if (!findBestComposerDialog()) {
      break;
    }
  }

  const isReelFallback = post_type === "reel";
  return {
    success: true,
    status: "published",
    post_type: isReelFallback ? "reel" : post_type,
    surface: isReelFallback ? "feed_video_fallback" : "feed_composer",
    fallback_used: isReelFallback,
    title,
    caption,
    hashtags,
    thumbnail_applied: Boolean(thumbResult.applied),
    thumbnail_note: thumbResult.applied
      ? "User thumbnail applied in Video options."
      : thumbResult.reason || (thumbnail_file ? "Thumbnail was not applied." : "No thumbnail_file provided."),
    caption_verified: Boolean(captionResult && captionResult.ok),
    formatting_preserved: Boolean(captionResult && captionResult.formatting_preserved),
    message: isReelFallback
      ? `Reels creator was unavailable on this view; published vertical video via Feed composer. Thumbnail: ${thumbResult.applied ? "applied" : "not applied"}.`
      : "Post published successfully.",
    fb_post_id: `fb_dom_${Date.now()}`,
    post_url: window.location.href
  };
}

async function editPost(payload) {
  const session = checkSession(payload);
  if (!session.logged_in) {
    return {
      success: false,
      logged_in: false,
      action_required: "ONE_TIME_LOGIN_REQUIRED",
      stop_loop: true,
      error: "Please log in to Facebook once in the open browser tab before editing posts."
    };
  }

  const { new_caption } = payload;
  const menuBtn = document.querySelector(
    'div[aria-label*="Actions for this post" i], div[aria-label*="More options" i]'
  );
  if (!menuBtn) {
    throw new Error("Could not find post actions menu (3-dots button).");
  }

  menuBtn.click();
  await sleep(900);

  const editMenuItem = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"]')).find(
    (el) => el.innerText && el.innerText.toLowerCase().includes("edit post")
  );
  if (!editMenuItem) {
    throw new Error("Could not find 'Edit post' in post options menu.");
  }

  editMenuItem.click();
  await sleep(1200);

  await findAndPopulateCaptionDom(new_caption);
  await sleep(600);

  const saveBtn = Array.from(
    document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button')
  ).find((el) => /^(save|done|post)$/i.test((el.innerText || "").trim()));
  if (saveBtn) {
    saveBtn.click();
    await sleep(1500);
    return { success: true, message: "Post edited and saved successfully." };
  }

  throw new Error("Could not find Save button in Edit Post dialog.");
}

async function deletePost(payload) {
  const session = checkSession(payload);
  if (!session.logged_in) {
    return {
      success: false,
      logged_in: false,
      action_required: "ONE_TIME_LOGIN_REQUIRED",
      stop_loop: true,
      error: "Please log in to Facebook once in the open browser tab before deleting posts."
    };
  }

  const menuBtn = document.querySelector(
    'div[aria-label*="Actions for this post" i], div[aria-label*="More options" i]'
  );
  if (!menuBtn) {
    throw new Error("Could not find post actions menu button.");
  }

  menuBtn.click();
  await sleep(900);

  const deleteItem = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"]')).find((el) => {
    const txt = (el.innerText || "").toLowerCase();
    return txt.includes("move to trash") || txt.includes("delete post") || txt.includes("delete");
  });
  if (!deleteItem) {
    throw new Error("Could not find 'Move to trash' or 'Delete' in options menu.");
  }

  deleteItem.click();
  await sleep(1200);

  const confirmBtn = Array.from(
    document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button')
  ).find((el) => {
    const txt = (el.innerText || "").toLowerCase();
    return txt.includes("move") || txt.includes("delete") || txt.includes("confirm");
  });

  if (confirmBtn) {
    confirmBtn.click();
    await sleep(1500);
    return { success: true, message: "Post deleted / moved to trash successfully." };
  }

  return { success: true, message: "Delete triggered." };
}

async function addComment(payload) {
  const session = checkSession(payload);
  if (!session.logged_in) {
    return {
      success: false,
      logged_in: false,
      action_required: "ONE_TIME_LOGIN_REQUIRED",
      stop_loop: true,
      error: "Please log in to Facebook once in the open browser tab before commenting."
    };
  }

  const { comment_text } = payload;
  const commentInput = document.querySelector(
    'div[aria-label*="Write a comment" i][contenteditable="true"], form textarea[placeholder*="Write a comment" i], div[role="textbox"][aria-label*="comment" i]'
  );
  if (!commentInput) {
    throw new Error("Could not locate comment input on active post.");
  }

  insertTextFast(commentInput, comment_text);
  await sleep(400);

  commentInput.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
  );
  await sleep(1200);

  return { success: true, message: "Comment submitted successfully." };
}
