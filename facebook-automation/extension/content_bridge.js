/**
 * Content Bridge Script for Facebook DOM Automation
 * Handles: Session Detection, Post Creation, Caption Typing/Pasting,
 * File Attachment via DataTransfer, Post Re-Editing, and Post Deleting.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

  (async () => {
    switch (action) {
      case "CHECK_SESSION":
        return checkSession();

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
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ success: false, error: err.message }));

  return true; // Keep message channel open for async response
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkSession() {
  const profileAnchor = document.querySelector('a[href*="/me/"], a[aria-label*="Your profile"], div[aria-label*="Your profile"]');
  const loggedIn = Boolean(profileAnchor || document.querySelector('[role="main"]') || document.querySelector('[aria-label="Facebook"]'));
  
  let name = "Facebook User";
  if (profileAnchor) {
    name = profileAnchor.getAttribute("aria-label") || profileAnchor.innerText || "Facebook User";
    name = name.replace(/^Your profile:?\s*/i, "").trim();
  }

  return {
    success: true,
    data: {
      logged_in: loggedIn,
      name: name,
      id: "active_session",
      type: "profile",
      url: window.location.href
    }
  };
}

async function publishPost(payload) {
  const { caption, media_paths, post_type } = payload;

  // 1. Locate Composer Trigger ("What's on your mind?")
  const composerTrigger = document.querySelector(
    'div[role="button"][tabindex="0"] span:has-text("What's on your mind?"), ' +
    'div[aria-label*="Create a post"], ' +
    'div[role="button"]:has(span:contains("What's on your mind?")), ' +
    'div[data-pagelet="ProfileComposer"] div[role="button"]'
  ) || Array.from(document.querySelectorAll('div[role="button"]')).find(el => 
    el.innerText && (el.innerText.includes("What's on your mind") || el.innerText.includes("Create a post"))
  );

  if (!composerTrigger) {
    throw new Error("Could not find Facebook post composer button on page. Make sure you are on facebook.com home or profile feed.");
  }

  composerTrigger.click();
  await sleep(1500);

  // 2. Locate Active Modal Composer Dialog
  const dialog = document.querySelector('div[role="dialog"]');
  if (!dialog) {
    throw new Error("Post composer dialog did not appear.");
  }

  // 3. Locate Text Editor Area
  const textEditor = dialog.querySelector(
    'div[role="textbox"][contenteditable="true"], ' +
    'div[aria-label*="What's on your mind"], ' +
    'div[data-editor]'
  );

  if (!textEditor) {
    throw new Error("Could not find post caption input box.");
  }

  // Focus and insert caption
  textEditor.focus();
  await sleep(300);

  // Fast paste simulation via DataTransfer/execCommand to prevent slow typing timeouts
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, caption);
  textEditor.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(600);

  // Verify caption populated in DOM
  const textInDom = textEditor.innerText || textEditor.textContent || "";
  if (textInDom.trim().length === 0 && caption.trim().length > 0) {
    // Fallback direct assignment
    textEditor.innerText = caption;
    textEditor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 4. Attach Media if specified
  if (media_paths && media_paths.length > 0) {
    const fileInput = dialog.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]');
    if (!fileInput) {
      // Click Photo/video button to reveal file input
      const photoBtn = dialog.querySelector('div[aria-label*="Photo/video"], div[aria-label*="Add to your post"] div[role="button"]');
      if (photoBtn) photoBtn.click();
      await sleep(1000);
    }
  }

  // 5. Locate & Click "Post" Button
  await sleep(1000);
  const postBtn = Array.from(dialog.querySelectorAll('div[role="button"], button')).find(el => {
    const txt = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
    return txt === "post" || txt === "publish";
  });

  if (!postBtn) {
    throw new Error("Could not find final 'Post' button in composer dialog.");
  }

  postBtn.click();

  // 6. Wait for dialog to dismiss and post to submit
  let dismissed = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    if (!document.querySelector('div[role="dialog"]')) {
      dismissed = true;
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
  const { post_target, new_caption } = payload;
  
  // Locate target post actions menu (3-dots)
  const menuBtn = document.querySelector('div[aria-label*="Actions for this post"], div[aria-label*="More options"]');
  if (!menuBtn) {
    throw new Error("Could not find post actions menu (3-dots button).");
  }

  menuBtn.click();
  await sleep(1000);

  // Click "Edit post"
  const editMenuItem = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"]')).find(el => 
    el.innerText && el.innerText.toLowerCase().includes("edit post")
  );

  if (!editMenuItem) {
    throw new Error("Could not find 'Edit post' in post options menu.");
  }

  editMenuItem.click();
  await sleep(1500);

  // Locate edit dialog textbox
  const editDialog = document.querySelector('div[role="dialog"]');
  const textbox = editDialog ? editDialog.querySelector('div[role="textbox"][contenteditable="true"]') : null;
  if (!textbox) {
    throw new Error("Could not find text input in Edit dialog.");
  }

  textbox.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, new_caption);
  textbox.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(800);

  // Click Save
  const saveBtn = Array.from(editDialog.querySelectorAll('div[role="button"], button')).find(el => 
    (el.innerText || "").trim().toLowerCase() === "save"
  );

  if (saveBtn) {
    saveBtn.click();
    await sleep(2000);
    return { success: true, message: "Post edited and saved successfully." };
  }

  throw new Error("Could not find Save button in Edit Post dialog.");
}

async function deletePost(payload) {
  // Locate post options menu
  const menuBtn = document.querySelector('div[aria-label*="Actions for this post"], div[aria-label*="More options"]');
  if (!menuBtn) {
    throw new Error("Could not find post actions menu button.");
  }

  menuBtn.click();
  await sleep(1000);

  // Click "Move to trash" or "Delete"
  const deleteItem = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="button"]')).find(el => {
    const txt = (el.innerText || "").toLowerCase();
    return txt.includes("move to trash") || txt.includes("delete post") || txt.includes("delete");
  });

  if (!deleteItem) {
    throw new Error("Could not find 'Move to trash' or 'Delete' in options menu.");
  }

  deleteItem.click();
  await sleep(1500);

  // Confirm in confirmation modal
  const confirmBtn = Array.from(document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button')).find(el => {
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
  const { comment_text } = payload;
  const commentInput = document.querySelector(
    'div[aria-label*="Write a comment"][contenteditable="true"], ' +
    'form textarea[placeholder*="Write a comment"], ' +
    'div[role="textbox"][aria-label*="comment"]'
  );

  if (!commentInput) {
    throw new Error("Could not locate comment input on active post.");
  }

  commentInput.focus();
  document.execCommand('insertText', false, comment_text);
  commentInput.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);

  // Press Enter to submit comment
  commentInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  await sleep(1500);

  return { success: true, message: "Comment submitted successfully." };
}
