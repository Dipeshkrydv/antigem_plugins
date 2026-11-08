/**
 * Content Bridge Script for Facebook DOM Automation (v1.1.0)
 * Handles: Accurate One-Time Login Detection, Feed Post Creation (Text/Photo/Carousel/Video),
 * Reels Upload (/reels/create), Stories Upload (/stories/create), Caption Pasting,
 * File Attachment via DataTransfer, Post Re-Editing, Post Deleting, and Comments.
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
      'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet="ProfileComposer"]'
    ) ||
      Array.from(document.querySelectorAll('div[role="button"], span')).some((el) => {
        const t = (el.innerText || el.textContent || "").trim();
        return t.includes("What's on your mind") || t.includes("Write something") || t.includes("Create a post");
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

function attachBase64MediaToInput(fileInput, mediaFiles) {
  if (!fileInput || !Array.isArray(mediaFiles) || mediaFiles.length === 0) return false;
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
  if (mediaFiles.length > 1) fileInput.multiple = true;
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  return Boolean(fileInput.files && fileInput.files.length > 0);
}

function insertTextFast(editor, text) {
  if (!editor || !text) return;
  editor.scrollIntoView({ block: "center", behavior: "instant" });
  editor.focus();
  if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
    editor.value = text;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  document.execCommand("selectAll", false, null);
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
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
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

  // Advance through Next -> Next
  for (let step = 0; step < 3; step++) {
    const allBtns = Array.from(document.querySelectorAll('div[role="button"], button'));
    const pubBtn = allBtns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "publish" || t === "share" || t === "share now";
    });
    if (pubBtn) break;

    const nextBtn = allBtns.find((el) => {
      const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "next";
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
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
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
      /create a text story/i.test(el.innerText || el.textContent || "")
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

  const shareBtn = Array.from(document.querySelectorAll('div[role="button"], button')).find((el) =>
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
  // 0. Pre-flight One-Time Login Check
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

  // 1. Locate Composer Trigger ("What's on your mind?" / "Create a post") using standard valid DOM queries
  let dialog = document.querySelector('div[role="dialog"]');
  if (!dialog || !dialog.querySelector('div[role="textbox"][contenteditable="true"], textarea')) {
    const composerTrigger =
      document.querySelector(
        'div[aria-label*="Create a post" i], div[aria-label*="Make a post" i], div[data-pagelet="ProfileComposer"] div[role="button"]'
      ) ||
      Array.from(document.querySelectorAll('div[role="button"], span[role="button"]')).find((el) => {
        const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
        return (
          /what's on your mind/i.test(txt) ||
          /write something/i.test(txt) ||
          /create a post/i.test(txt) ||
          /make a post/i.test(txt)
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
  }

  // 2. Attach Media if provided
  if (Array.isArray(media_files) && media_files.length > 0) {
    let fileInput = dialog.querySelector(
      'input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]'
    );
    if (!fileInput) {
      const photoBtn = Array.from(dialog.querySelectorAll('div[role="button"], span[role="button"], button')).find(
        (el) => {
          const label = (el.getAttribute("aria-label") || el.innerText || el.textContent || "").trim();
          return /photo\/video|photos\/videos|add photos|photo/i.test(label);
        }
      );
      if (photoBtn) {
        photoBtn.click();
        await sleep(1000);
      }
      fileInput = document.querySelector('div[role="dialog"] input[type="file"], input[type="file"]');
    }

    if (fileInput) {
      attachBase64MediaToInput(fileInput, media_files);
      await sleep(2200);
    }
  }

  // 3. Locate Text Editor Area (Strictly excluding comment inputs)
  if (caption && String(caption).trim().length > 0) {
    const editors = Array.from(
      dialog.querySelectorAll('div[role="textbox"][contenteditable="true"], textarea')
    ).filter((el) => {
      const aria = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").toLowerCase();
      return !aria.includes("comment") && !aria.includes("reply") && !aria.includes("search");
    });

    const textEditor = editors[0];
    if (!textEditor) {
      throw new Error("Could not find post caption input box inside composer.");
    }

    insertTextFast(textEditor, caption);
    await sleep(800);
  }

  // 4. Locate & Click "Post" / "Publish" Button
  let postBtn = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = Array.from(dialog.querySelectorAll('div[role="button"], button, input[type="submit"]')).find(
      (el) => {
        const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || el.value || "")
          .trim()
          .toLowerCase();
        return txt === "post" || txt === "publish";
      }
    );
    if (candidate && candidate.getAttribute("aria-disabled") !== "true" && !candidate.disabled) {
      postBtn = candidate;
      break;
    }
    await sleep(800);
  }

  if (!postBtn) {
    throw new Error("Could not find enabled 'Post' button in composer dialog.");
  }

  postBtn.click();

  // 5. Wait for dialog to dismiss
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
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
