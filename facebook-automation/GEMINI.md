# Facebook Automation & SEO Studio — Operational Rules (v1.1.0)

## 1. Mobile AntiGem Browser Auto-Open & One-Time Login Law (CRITICAL)
- **Automatic Facebook Launch in AntiGem Browser**:
  - Whenever a user assigns any Facebook task (post, photo, video, reel, story, edit, delete, comment), call `fb_publish`, `fb_publish_reel`, `fb_publish_story`, or `fb_login_status` directly.
  - `worker.js` natively opens `https://www.facebook.com/` inside the AntiGem WebView browser (`chrome.tabs.create`) if no Facebook tab is open.
- **One-Time Login Gatekeeper & Zero-Loop Mandate**:
  - `worker.js` checks Facebook session cookies (`c_user` + `xs`) and DOM state.
  - **If `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`)**:
    1. Facebook is now open and focused on the login screen in the AntiGem browser.
    2. The user's task is automatically saved in `fb_pending_task` (`chrome.storage.local`).
    3. **STOP IMMEDIATELY**: Never call `fb_login_status`, `fb_publish`, or `fb_status` again in a loop!
    4. Ask the user **once**: *"I've opened Facebook in your AntiGem browser. Please complete the one-time login there—your task is saved and will start automatically as soon as you sign in (or reply 'continue' once logged in)."*
  - **After One-Time Login**:
    - As soon as the user signs in, `worker.js` detects the session via `chrome.tabs.onUpdated` / `chrome.alarms`, persists `fb_one_time_login_verified: true`, and **auto-executes the saved task** (or executes immediately on `fb_resume_pending` / `fb_publish`).
    - All subsequent tasks run immediately without asking for login again.

## 2. Full Upload & Lifecycle Capabilities
- **Posts (`fb_publish`)**: Text, Single Photo, Multi-Photo Carousel, Video, Reel, or Story on Personal Profile, Managed Page, or Group.
- **Reels (`fb_publish_reel`)**: Uploads vertical `.mp4`/`.mov` videos via `https://www.facebook.com/reels/create` using CDP `DOM.setFileInputFiles` (zero base64 RAM overhead) + `DataTransfer` fallback, stepping through `Next` $\to$ `Next` $\to$ Caption $\to$ `Publish`.
- **Stories (`fb_publish_story`)**: Uploads photo, video, or text stories via `https://www.facebook.com/stories/create`.
- **Scheduling (`fb_schedule`)**: Queues posts via `chrome.alarms` + `chrome.storage.local` (and SQLite) with login-aware hold protection.
- **Post Management**: Re-edit captions (`fb_edit_post`), delete/trash posts (`fb_delete_post`), and post first-comment links (`fb_comments`).

## 3. Anti-Duplicate, Anti-Comment-Box & Reach Protection Laws
- **Zero Duplicate Posts**: SHA-256 caption hashing and file fingerprinting prevent duplicate posts within 48 hours. Only published/scheduled posts lock hashes, so tasks paused for one-time login can always resume cleanly.
- **Strict Anti-Comment-Box Lock**: Never paste post captions into feed comment inputs.
- **First-Comment Outbound Links**: Keep external URLs out of main captions; pass them via `first_comment` in `fb_publish` or `fb_comments` to avoid Facebook's 50% external-link reach penalty.
