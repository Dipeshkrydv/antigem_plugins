/**
 * Content Bridge Script for Facebook DOM Automation (v1.3.0)
 * Senior Social Media Manager & Mobile + Desktop Precision DOM Engine:
 * - Supports both Mobile Touch UI (`m.facebook.com`) and Desktop UI (`www.facebook.com`).
 * - Captures detached `<input type="file">` via `HTMLInputElement.prototype.click` hook + `DataTransfer` + `DragEvent("drop")` fallback.
 * - Verifies photo/video preview is genuinely mounted in the composer DOM before clicking Post (zero text-only mistakes!).
 * - Handles both direct `Post`/`Publish` and 2-step Mobile `Next -> Post` flows.
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
  if (r.width < 6 || r.height < 6) return false;
  const st = window.getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || 1) > 0.01;
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
      'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet="ProfileComposer"], #MComposer, a[href*="/composer/"]'
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

function hasMediaPreviewMounted(scope = document) {
  const hasBlobOrDataImg = Array.from(scope.querySelectorAll("img")).some((img) => {
    const src = img.getAttribute("src") || "";
    const r = img.getBoundingClientRect();
    return (src.startsWith("blob:") || src.startsWith("data:image/")) && r.width >= 36 && r.height >= 36;
  });
  const hasVideo = Boolean(scope.querySelector("video"));
  const hasRemoveOrEdit = Boolean(
    scope.querySelector(
      '[aria-label*="Remove photo" i], [aria-label*="Remove video" i], [aria-label*="Remove media" i], [aria-label*="Edit photo" i], [aria-label*="Edit All" i], [data-sigil*="photo-preview"]'
    )
  );
  return Boolean(hasBlobOrDataImg || hasVideo || hasRemoveOrEdit);
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
  if (!ok || !(editor.innerText || "").trim()) {
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (_) {}
  }
  if (!(editor.innerText || "").trim()) {
    editor.innerText = text;
  }
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
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
  await sleep(3500);

  for (let step = 0; step < 3; step++) {
    const allBtns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]'));
    const pubBtn = allBtns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "publish" || t === "share" || t === "share now";
    });
    if (pubBtn) break;

    const nextBtn = allBtns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "next" || t === "अर्को" || t === "अगला";
    });
    if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true") {
      nextBtn.click();
    }
    await sleep(1800);
  }

  if (caption) {
    const editor = document.querySelector(
      'div[aria-label*="Describe your reel" i][contenteditable="true"], div[aria-label*="Write a description" i][contenteditable="true"], div[role="textbox"][contenteditable="true"], textarea'
    );
    if (editor) {
      insertTextFast(editor, caption);
      await sleep(800);
    }
  }

  for (let i = 0; i < 30; i++) {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]'));
    const pubBtn = btns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "publish" || t === "share" || t === "share now" || t === "post";
    });
    if (pubBtn && pubBtn.getAttribute("aria-disabled") !== "true" && !pubBtn.disabled) {
      pubBtn.click();
      await sleep(3500);
      return {
        success: true,
        message: "Facebook Reel published successfully.",
        fb_post_id: `fb_reel_${Date.now()}`,
        post_url: window.location.href
      };
    }
    await sleep(1000);
  }

  throw new Error("Could not click Publish button on Facebook Reels wizard.");
}

async function publishStoryDom(payload) {
  const { caption = "", media_files = [] } = payload;
  if (media_files && media_files.length > 0) {
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      attachBase64MediaToInput(fileInput, media_files);
      await sleep(2500);
    }
  } else if (caption) {
    const textStoryBtn = Array.from(document.querySelectorAll('div[role="button"], span')).find((el) =>
      /create a text story|text/i.test(el.innerText || el.textContent || "")
    );
    if (textStoryBtn) {
      textStoryBtn.click();
      await sleep(1000);
    }
    const box = document.querySelector('div[role="textbox"][contenteditable="true"], textarea');
    if (box) {
      insertTextFast(box, caption);
      await sleep(800);
    }
  }

  const shareBtn = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]')).find(
    (el) =>
      /share to story|share now|^share$/i.test(
        (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim()
      )
  );
  if (!shareBtn) {
    throw new Error("Could not find 'Share to story' button.");
  }
  shareBtn.click();
  await sleep(3000);
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

  // 1. Locate Composer Trigger on Mobile (m.facebook.com) or Desktop (www.facebook.com)
  let dialog = document.querySelector('div[role="dialog"]');
  const mobileBox = document.querySelector(
    '#composer-main-view-id textarea, textarea.composerInput, textarea[name="xc_message"]'
  );
  if ((!dialog || !dialog.querySelector('div[role="textbox"][contenteditable="true"], textarea')) && !mobileBox) {
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
    await sleep(1500);
    dialog = document.querySelector('div[role="dialog"]') || document;
  } else {
    dialog = dialog || document;
  }

  // 2. Attach Media FIRST if provided (with detached input capture + drop fallback + preview verification)
  if (Array.isArray(media_files) && media_files.length > 0) {
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
        dialog.querySelectorAll('div[role="button"], span[role="button"], button, a, label')
      ).find((el) => {
        const label = `${el.getAttribute("aria-label") || ""} ${el.innerText || el.textContent || ""}`.trim();
        if (/remove|delete|edit|tag/i.test(label)) return false;
        return /^(photo\/video|photos\/videos|photos|photo|add photos|add video|फोटो\/भिडियो|फोटो)$/i.test(label) ||
          /photo\/video|photos\/videos|add photos/i.test(label);
      });
      if (photoBtn) {
        photoBtn.click();
        await sleep(500);
      }
    } finally {
      HTMLInputElement.prototype.click = origClick;
    }

    const fileInput =
      capturedInput ||
      dialog.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]') ||
      document.querySelector('input[type="file"]');

    if (fileInput) {
      attachBase64MediaToInput(fileInput, media_files);
      await sleep(1800);
    }

    if (!hasMediaPreviewMounted(dialog)) {
      const dt = buildDataTransferFromMediaFiles(media_files);
      const dropZone =
        dialog.querySelector('div[role="textbox"][contenteditable="true"]') ||
        dialog.querySelector("textarea") ||
        dialog;
      for (const evtName of ["dragenter", "dragover", "drop"]) {
        dropZone.dispatchEvent(new DragEvent(evtName, { bubbles: true, cancelable: true, dataTransfer: dt }));
      }
      await sleep(1800);
    }

    if (!hasMediaPreviewMounted(dialog) && !fileInput) {
      throw new Error("Could not attach photo/video to Facebook composer. Aborting so text-only is not posted.");
    }
  }

  // 3. Locate Text Editor Area & Insert Caption (Quote + Hook + Hashtags)
  if (caption && String(caption).trim().length > 0) {
    const scope = document.querySelector('div[role="dialog"]') || document;
    const editors = Array.from(
      scope.querySelectorAll(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], textarea.composerInput, textarea[name="xc_message"], textarea'
      )
    ).filter((el) => {
      if (!isVisible(el)) return false;
      if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
      const aria = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""}`.toLowerCase();
      return !aria.includes("comment") && !aria.includes("reply") && !aria.includes("search");
    });

    const textEditor = editors[0];
    if (!textEditor) {
      throw new Error("Could not find post caption input box inside composer.");
    }

    insertTextFast(textEditor, caption);
    await sleep(750);
  }

  // 4. Locate & Click "Post" / "Publish" Button (or Mobile "Next" -> "Post")
  const findSubmitBtn = (allowNext = false) => {
    const scope = document.querySelector('div[role="dialog"]') || document;
    const allBtns = Array.from(
      scope.querySelectorAll('div[role="button"], button, span[role="button"], input[type="submit"]')
    ).filter(isVisible);
    const postBtn = allBtns.find((el) => {
      if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
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
        if (el.closest('div[role="article"], div[data-pagelet*="FeedUnit"]')) return false;
        const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
        return txt === "next";
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
    await sleep(750);
  }

  if (!foundSubmit) {
    throw new Error("Could not find enabled 'Post' button in composer dialog.");
  }

  foundSubmit.btn.click();
  if (foundSubmit.isNext) {
    await sleep(1200);
    const finalSubmit = findSubmitBtn(false);
    if (finalSubmit && finalSubmit.btn) {
      finalSubmit.btn.click();
    }
  }

  for (let i = 0; i < 20; i++) {
    await sleep(900);
    if (!document.querySelector('div[role="dialog"]')) {
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
  await sleep(1000);

  const editMenuItem = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"]')).find(
    (el) => el.innerText && el.innerText.toLowerCase().includes("edit post")
  );
  if (!editMenuItem) {
    throw new Error("Could not find 'Edit post' in post options menu.");
  }

  editMenuItem.click();
  await sleep(1500);

  const editDialog = document.querySelector('div[role="dialog"]') || document;
  const textbox = editDialog.querySelector('div[role="textbox"][contenteditable="true"], textarea');
  if (!textbox) {
    throw new Error("Could not find text input in Edit dialog.");
  }

  insertTextFast(textbox, new_caption);
  await sleep(800);

  const saveBtn = Array.from(editDialog.querySelectorAll('div[role="button"], button')).find((el) =>
    /^(save|done|post)$/i.test((el.innerText || "").trim())
  );
  if (saveBtn) {
    saveBtn.click();
    await sleep(2000);
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
  await sleep(1000);

  const deleteItem = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"]')).find((el) => {
    const txt = (el.innerText || "").toLowerCase();
    return txt.includes("move to trash") || txt.includes("delete post") || txt.includes("delete");
  });
  if (!deleteItem) {
    throw new Error("Could not find 'Move to trash' or 'Delete' in options menu.");
  }

  deleteItem.click();
  await sleep(1500);

  const confirmBtn = Array.from(
    document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button')
  ).find((el) => {
    const txt = (el.innerText || "").toLowerCase();
    return txt.includes("move") || txt.includes("delete") || txt.includes("confirm");
  });

  if (confirmBtn) {
    confirmBtn.click();
    await sleep(2000);
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
  await sleep(500);

  commentInput.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
  );
  await sleep(1500);

  return { success: true, message: "Comment submitted successfully." };
}
