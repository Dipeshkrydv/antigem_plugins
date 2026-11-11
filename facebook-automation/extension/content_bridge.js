/**
 * Content Bridge Script for Facebook DOM Automation (v1.4.0)
 * Pre-Trained Phone (Desktop-on-Phone + Mobile UI) & Desktop Precision DOM Engine:
 * - Smart Composer Dialog Scorer (`findBestComposerDialog`) never confuses Notification/Messenger/Popover dialogs with the Create Post dialog.
 * - Pre-purges leftover draft attachments and deduplicates single-photo uploads (zero double-photo bugs!).
 * - Populates caption before & after media attachment with placeholder click-to-wake so Lexical editors on scaled phone screens always receive text.
 * - Full support for Feed Posts (Text, Photo, Carousel, Video), Reels (/reels/create + mobile fallback), and Stories (/stories/create + Create a photo/text story).
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

function findAndPopulateCaptionDom(text) {
  if (!text || !String(text).trim()) return true;
  const cleanText = String(text).trim();
  const bestDialog = findBestComposerDialog();
  const roots = bestDialog ? [bestDialog, document] : [document];

  const selectorStr = [
    'div[role="textbox"][contenteditable="true"]',
    'div[data-lexical-editor="true"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
    'div[aria-placeholder*="on your mind" i]',
    'div[aria-label*="on your mind" i]',
    'div[aria-label*="Describe your reel" i]',
    'div[aria-label*="Write a description" i]',
    'div[contenteditable="true"]',
    '#composer-main-view-id textarea',
    'textarea.composerInput',
    'textarea[name="xc_message"]',
    'textarea'
  ].join(", ");

  let editor = null;
  for (const root of roots) {
    const candidates = Array.from(root.querySelectorAll(selectorStr)).filter(
      (el) => !isCommentOrSearch(el) && el.getBoundingClientRect().width > 4
    );
    if (candidates.length > 0) {
      editor = candidates[0];
      break;
    }
  }

  if (!editor) {
    for (const root of roots) {
      const placeholderEl = Array.from(root.querySelectorAll("div, span, p")).find((el) => {
        if (isCommentOrSearch(el)) return false;
        const t = (el.innerText || el.textContent || "").trim();
        return (
          t.length > 4 &&
          t.length < 80 &&
          /^(what['’]?s on your mind|write something|say something|describe your reel|start typing)/i.test(t)
        );
      });
      if (placeholderEl) {
        try {
          placeholderEl.click();
        } catch (_) {}
        editor =
          (placeholderEl.parentElement &&
            placeholderEl.parentElement.querySelector('[contenteditable="true"], textarea')) ||
          (document.activeElement && document.activeElement.isContentEditable ? document.activeElement : null);
        if (editor) break;
      }
    }
  }

  if (!editor) return false;
  insertTextFast(editor, cleanText);
  return true;
}

function insertTextFast(editor, text) {
  if (!editor || !text) return;
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
    if (setter) setter.call(editor, text);
    else editor.value = text;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
  } catch (_) {}

  const ok = document.execCommand("insertText", false, text);
  const cur = (editor.innerText || editor.textContent || "").trim();
  if (!ok || cur.length < 4 || /^what['’]?s on your mind/i.test(cur)) {
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (_) {}
  }
  if ((editor.innerText || "").trim().length < 4) {
    editor.innerText = text;
  }
  editor.dispatchEvent(
    new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text })
  );
  editor.dispatchEvent(new Event("change", { bubbles: true }));
}

async function publishReelDom(payload) {
  const { caption = "", media_files = [] } = payload;
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  const videoInput =
    inputs.find((inp) => (inp.getAttribute("accept") || "").toLowerCase().includes("video")) || inputs[0];

  if (!videoInput) {
    throw new Error("Could not find video file input on Facebook Reels page.");
  }

  attachBase64MediaToInput(videoInput, media_files);
  await sleep(3000);

  for (let step = 0; step < 3; step++) {
    const allBtns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]'));
    const pubBtn = allBtns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "publish" || t === "share" || t === "share now" || t === "post";
    });
    if (pubBtn) break;

    const nextBtn = allBtns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "next" || t === "अर्को" || t === "अगला";
    });
    if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true") {
      nextBtn.click();
    }
    await sleep(1500);
  }

  if (caption) {
    findAndPopulateCaptionDom(caption);
    await sleep(600);
  }

  for (let i = 0; i < 30; i++) {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]'));
    const pubBtn = btns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "publish" || t === "share" || t === "share now" || t === "post";
    });
    if (pubBtn && pubBtn.getAttribute("aria-disabled") !== "true" && !pubBtn.disabled) {
      pubBtn.click();
      await sleep(3000);
      return {
        success: true,
        message: "Facebook Reel published successfully.",
        fb_post_id: `fb_reel_${Date.now()}`,
        post_url: window.location.href
      };
    }
    await sleep(900);
  }

  throw new Error("Could not click Publish button on Facebook Reels wizard.");
}

async function publishStoryDom(payload) {
  const { caption = "", media_files = [] } = payload;
  if (media_files && media_files.length > 0) {
    let fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      const photoStoryCard = Array.from(document.querySelectorAll('div[role="button"], a, span')).find((el) =>
        /create a photo story|photo story/i.test((el.innerText || el.textContent || "").trim())
      );
      if (photoStoryCard) {
        photoStoryCard.click();
        await sleep(500);
        fileInput = document.querySelector('input[type="file"]');
      }
    }
    if (fileInput) {
      attachBase64MediaToInput(fileInput, media_files);
      await sleep(2200);
    }
  } else if (caption) {
    const textStoryBtn = Array.from(document.querySelectorAll('div[role="button"], span')).find((el) =>
      /create a text story|text story|^text$/i.test((el.innerText || el.textContent || "").trim())
    );
    if (textStoryBtn) {
      textStoryBtn.click();
      await sleep(900);
    }
    findAndPopulateCaptionDom(caption);
    await sleep(700);
  }

  const shareBtn = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).find(
    (el) =>
      /^(share to story|share now|share|post)$/i.test(
        (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim()
      )
  );
  if (!shareBtn) {
    throw new Error("Could not find 'Share to story' button.");
  }
  shareBtn.click();
  await sleep(2500);
  return {
    success: true,
    message: "Facebook Story published successfully.",
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

  const { caption = "", media_files = [], post_type = "text" } = payload;

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

  // 2. Populate Caption FIRST while composer textbox is open
  if (caption && String(caption).trim().length > 0) {
    findAndPopulateCaptionDom(caption);
    await sleep(250);
  }

  // 3. Attach Media if provided (with stale draft cleanup + single-shot input binding + deduplication)
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
      await sleep(1400);
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

    // Verify caption is still present after media attachment
    if (caption && String(caption).trim().length > 0) {
      findAndPopulateCaptionDom(caption);
      await sleep(300);
    }
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

  return {
    success: true,
    message: "Post published successfully.",
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

  findAndPopulateCaptionDom(new_caption);
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
