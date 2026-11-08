# Facebook Automation & SEO Studio (v1.1.0)

> 🚀 Production-grade Facebook automation engine for **AntiGem Mobile Browser**, **Kiwi Browser (Android)**, **Termux**, and **Desktop**.
> Features automatic Facebook tab opening inside the AntiGem browser, **one-time login persistence with zero-loop protection**, autonomous publishing of **Posts, Photos, Carousels, Videos, Reels, and Stories**, scheduling, post re-editing, deletion, comments, viral SEO generation, and **guaranteed zero duplicate uploads**.

---

## 🌟 Key Features & Mobile AntiGem Browser Flow

1. **📱 Native AntiGem Mobile Browser Automation (`worker.js`)**:
   - Directly integrates with AntiGem WebView Extension APIs (`chrome.tabs`, `chrome.scripting`, `chrome.debugger`, `chrome.cookies`, `chrome.storage.local`, `chrome.alarms`, and `chrome.antigem.automation` / `stat` / `readFile`).
   - When you give any task (e.g., *"Upload this Reel to Facebook"* or *"Post this photo"*), the plugin **automatically opens `https://www.facebook.com/` inside the AntiGem browser**.
2. **🔑 One-Time Login Gatekeeper & Zero-Loop Guarantee**:
   - Checks WebView session cookies (`c_user` + `xs`) and live DOM state (`CurrentUserInitialData`, composer, login form inputs).
   - **If Not Logged In**:
     - Focuses the open Facebook login tab in the AntiGem browser.
     - Saves your requested upload in `fb_pending_task`.
     - Returns `action_required: "ONE_TIME_LOGIN_REQUIRED"` with `stop_loop: true` so the AI asks you **once** to sign in and **stops immediately (zero infinite retry loops!)**.
   - **Auto-Resume on Sign-In**:
     - As soon as you complete your one-time login in the AntiGem browser tab, `worker.js` detects the session via `chrome.tabs.onUpdated`, marks `one_time_login_verified: true`, and **automatically starts uploading your queued post/reel/story** (or you can reply *"continue"* to trigger `fb_resume_pending`).
   - **Permanent Persistence**: Your Facebook login persists in the AntiGem WebView across sessions—you never have to log in again.
3. **🎬 Full Content Upload Pipeline (Posts, Photos, Videos, Reels, Stories)**:
   - **Feed Posts (`fb_publish`)**: Text, Single Photo, Multi-Photo Carousel, or Video to Personal Profile, Managed Page, or Group.
   - **Facebook Reels (`fb_publish_reel`)**: Navigates to `https://www.facebook.com/reels/create`, attaches `.mp4`/`.mov` via CDP `DOM.setFileInputFiles` (zero base64 RAM bloat for large videos), steps through `Next` $\to$ `Next` $\to$ `Describe your reel`, pastes caption & hashtags, and clicks `Publish`.
   - **Facebook Stories (`fb_publish_story`)**: Navigates to `https://www.facebook.com/stories/create`, attaches photo/video or text card, and taps `Share to story`.
4. **🛡️ Guaranteed Zero Duplicate Uploads**:
   - Dual-tier deduplication engine combining SHA-256 caption hashing and file fingerprints within a 48-hour rolling window.
   - Only published and scheduled posts lock hashes—tasks paused for one-time login are never falsely blocked as duplicates when resumed.
5. **📈 Algorithmic Facebook SEO**:
   - High-CTR 1-line retention hooks, 3-4 punchy micro-bullets, engagement CTAs, and 3-6 targeted hashtags.
   - **First-Comment Link Strategy**: Automatically places outbound links in the first comment (`first_comment` parameter or `fb_comments`) to avoid Facebook's 50% external-link reach penalty.

---

## 🛠️ MCP Tools Overview

| Tool Name | Description |
| :--- | :--- |
| `fb_status` | Opens Facebook in AntiGem browser if needed, checks one-time login state, and returns queue metrics. |
| `fb_login_status` | Opens `https://www.facebook.com/` in AntiGem browser, verifies session cookies + DOM, and persists one-time login. |
| `fb_open_browser` | Explicitly opens Facebook (`feed`, `reels`, `stories`, `page`, `business_suite`) in the AntiGem browser. |
| `fb_publish` | Publishes text, photo, carousel, video, reel, or story (with optional `first_comment`). |
| `fb_publish_reel` | Uploads and publishes a vertical `.mp4` video as a Facebook Reel (`/reels/create`). |
| `fb_publish_story` | Uploads and publishes a photo, video, or text Story (`/stories/create`). |
| `fb_resume_pending` | Resumes and executes any pending upload task after completing the one-time login. |
| `fb_schedule` | Schedules a post, reel, or story for future execution. |
| `fb_edit_post` | Re-edits an existing Facebook post caption via 3-dots DOM menu. |
| `fb_delete_post` | Deletes or moves a post to trash via 3-dots DOM menu. |
| `fb_list_posts` | Lists recent published, scheduled, awaiting-login, or failed posts. |
| `fb_seo_generate` | Generates viral hook, micro-bullets, hashtags, alt-text, and first-comment link. |
| `fb_audit_caption` | Audits caption for algorithmic penalties and readability. |
| `fb_comments` | Submits first comment or reply on target post. |
| `fb_doctor` | Self-diagnoses AntiGem browser APIs, login persistence, debugger, and guardrails. |

---

## 📄 License
MIT License. Authored by Dipesh Kr Yadav.
