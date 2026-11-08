---
name: facebook-automation
description: "Autonomous production-grade Facebook automation engine for Mobile AntiGem Browser, Kiwi Browser, Android/Termux, and Desktop. Automatically opens Facebook inside the AntiGem browser, checks for one-time login (with zero-loop stop protection), and autonomously executes Text Posts, Photos, Carousels, Videos, Reels, Stories, Scheduling, Post Re-Editing, Deletion, and Comments with guaranteed zero duplicate uploads."
---

# Facebook Automation & SEO Studio — Master MCP Bridge Training

## 1. Mobile AntiGem Browser Auto-Open & One-Time Login Protocol (CRITICAL MANDATE)

When the user gives **any** Facebook task on mobile or desktop (uploading a post, photo, carousel, video, reel, story, editing/deleting a post, or commenting):

### Step 1: Automatic Browser Launch & Session Check
- Every tool (`fb_publish`, `fb_publish_reel`, `fb_publish_story`, `fb_login_status`, `fb_status`, `fb_open_browser`) **automatically opens `https://www.facebook.com/` inside the AntiGem WebView browser** if no Facebook tab is currently open.
- It inspects both WebView session cookies (`c_user` + `xs`) and the live DOM (`CurrentUserInitialData`, composer box, login inputs).

### Step 2: One-Time Login Gatekeeper (STRICT ZERO-LOOP LAW)
- **If `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`)**:
  1. `worker.js` focuses the open `https://www.facebook.com/` tab in the AntiGem browser so the Facebook login screen is immediately visible to the user.
  2. `worker.js` saves the requested upload in `fb_pending_task` (`chrome.storage.local`) and starts a background tab listener (`chrome.tabs.onUpdated` + `chrome.alarms`).
  3. **AGENT MANDATE — STOP IMMEDIATELY (ZERO RETRY LOOPS)**:
     - **NEVER** call `fb_login_status`, `fb_publish`, or `fb_status` repeatedly in a loop when `logged_in: false` or `stop_loop: true` is returned!
     - Tell the user **ONCE**:
       > *"I have opened Facebook in your AntiGem browser. Please complete the **one-time login** to your Facebook account in the open browser tab. As soon as you sign in, your session is permanently saved and your upload will start automatically (or reply **'continue'** once logged in)!"*
     - End your turn and wait.

### Step 3: Post-Login Autonomous Execution (Zero Friction Forever)
- **Auto-Resume on Sign-In**: As soon as the user finishes their one-time login in the AntiGem browser tab, `worker.js` detects the authenticated `c_user`/`xs` session cookies, marks `fb_one_time_login_verified: true`, and **automatically executes the saved `fb_pending_task`** (or runs it immediately when `fb_resume_pending` / `fb_publish` is called).
- **Permanent Session Persistence**: Because WebView cookies and `chrome.storage.local` persist across app restarts, the login is strictly **ONE-TIME**. All future tasks execute immediately with zero login prompts.

---

## 2. Complete Upload Capabilities (Posts, Photos, Videos, Reels, Stories)

| Task Type | MCP Tool to Call | How AntiGem Browser Executes It |
| :--- | :--- | :--- |
| **Text Post** | `fb_publish(caption=..., post_type="text")` | Opens composer modal (`What's on your mind?`), fast-pastes caption via `execCommand`, verifies DOM text, and taps **Post**. |
| **Photo / Carousel Post** | `fb_publish(caption=..., media_paths=[...], post_type="photo")` | Opens composer, attaches local image(s) via CDP `DOM.setFileInputFiles` (or `chrome.antigem.readFile` + `DataTransfer`), pastes caption, and taps **Post**. |
| **Video Post** | `fb_publish(caption=..., media_paths=[video], post_type="video")` | Attaches local `.mp4`/`.mov` directly via CDP `DOM.setFileInputFiles` (zero base64 RAM bloat), waits for upload readiness, pastes caption, and taps **Post**. |
| **Facebook Reel** | `fb_publish_reel(video_path=..., caption=...)` or `fb_publish(..., post_type="reel")` | Navigates to `https://www.facebook.com/reels/create`, attaches vertical `.mp4`, steps through **Next $\to$ Next $\to$ Describe your reel**, inserts caption & hashtags, and taps **Publish / Share**. |
| **Facebook Story** | `fb_publish_story(media_path=..., caption=...)` or `fb_publish(..., post_type="story")` | Navigates to `https://www.facebook.com/stories/create`, attaches photo/video or opens text story card, inserts text, and taps **Share to story**. |
| **Resume After Login** | `fb_resume_pending()` | Executes the queued task immediately after the user finishes their one-time login. |
| **Schedule Post/Reel** | `fb_schedule(caption=..., run_at_timestamp=..., media_paths=..., post_type=...)` | Queues post in `chrome.storage.local` + `chrome.alarms` (and SQLite) for automatic background execution. |
| **Edit Post** | `fb_edit_post(post_url_or_id=..., new_caption=...)` | Opens 3-dots post menu $\to$ **Edit post**, replaces caption, and clicks **Save**. |
| **Delete Post** | `fb_delete_post(post_url_or_id=...)` | Opens 3-dots post menu $\to$ **Move to trash / Delete** and confirms modal. |
| **First-Comment Link** | `fb_comments(post_url_or_id="latest", comment_text=...)` or `fb_publish(..., first_comment=...)` | Posts outbound links in the first comment to avoid Facebook's 50% external-link reach penalty. |

---

## 3. Anti-Duplicate, Anti-Comment-Box & Safety Guardrails

1. **Zero Duplicate Post Law**:
   - Every publish call checks SHA-256 normalized caption hashes and file fingerprints (`path:size:mtime` / SHA-256) over a 48-hour rolling window.
   - Deduplication only locks **published** and **scheduled** posts—if a task paused for one-time login, it is never falsely flagged as a duplicate when resumed!
2. **In-Flight Concurrency Lock**:
   - Prevents overlapping uploads from running simultaneously in the same browser tab.
3. **Strict Anti-Comment-Box Lock**:
   - Caption insertion strictly targets the composer modal (`div[role="dialog"] div[role="textbox"]`) and explicitly filters out comment/reply inputs (`aria-label*="comment"`).
4. **Anti-Loop Guarantee (`stop_loop: true`)**:
   - Whenever any tool returns `stop_loop: true` (such as `ONE_TIME_LOGIN_REQUIRED`, `duplicate_detected`, or `in_flight_busy`), the agent MUST report the status clearly to the user and **stop calling tools in a loop**.
