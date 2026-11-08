---
name: facebook-automation
description: "Autonomous production-grade Facebook automation engine for Mobile AntiGem Browser, Kiwi Browser, Android/Termux, and Desktop. Automatically opens Facebook inside the AntiGem browser, checks for one-time login (with zero-loop stop protection), and autonomously executes Text Posts, Photos, Carousels, Videos, Reels, Stories, Scheduling, Post Re-Editing, Deletion, and Comments with guaranteed zero duplicate uploads."
---

# Facebook Automation Skill — Mobile AntiGem Browser & Desktop

## 1. Mobile AntiGem Browser Auto-Open & One-Time Login Protocol (CRITICAL)
1. **Auto-Open Facebook in AntiGem Browser**:
   - When given any Facebook task, call `fb_publish`, `fb_publish_reel`, `fb_publish_story`, or `fb_login_status` directly.
   - The worker automatically opens `https://www.facebook.com/` in the AntiGem WebView browser if no Facebook tab is open.
2. **One-Time Login Gatekeeper (Zero Loop Error)**:
   - If the response contains `logged_in: false` or `action_required: "ONE_TIME_LOGIN_REQUIRED"` (`stop_loop: true`):
     - Facebook is now open and focused on the login screen inside the AntiGem browser, and the user's task is saved in `fb_pending_task`.
     - **STOP IMMEDIATELY**. Never retry or poll `fb_login_status` / `fb_publish` in a loop!
     - Ask the user **once** to log in to Facebook inside the open AntiGem browser tab.
     - As soon as they log in, `worker.js` auto-resumes the pending upload (or call `fb_resume_pending` when they reply `"continue"`).
3. **One-Time Persistence**:
   - Once logged in, WebView cookies (`c_user`, `xs`) and `chrome.storage.local` persist the session permanently so all future posts, reels, and stories upload immediately with zero login prompts.

## 2. Full Upload & Lifecycle Tools
- `fb_publish`: Publish text, single photo, multi-photo carousel, video, reel (`post_type="reel"`), or story (`post_type="story"`), plus optional `first_comment`.
- `fb_publish_reel`: Dedicated Facebook Reels uploader (`https://www.facebook.com/reels/create` $\to$ attach MP4 $\to$ Next $\to$ Next $\to$ Caption $\to$ Publish).
- `fb_publish_story`: Dedicated Facebook Story uploader (`https://www.facebook.com/stories/create`).
- `fb_resume_pending`: Immediately executes any task saved while awaiting the one-time login.
- `fb_schedule`: Schedules posts/reels via `chrome.alarms` + local queue.
- `fb_edit_post` / `fb_delete_post` / `fb_comments`: Full post lifecycle control.
- `fb_seo_generate` / `fb_audit_caption`: High-retention hooks, micro-bullets, 3-6 hashtags, and first-comment link strategy.
