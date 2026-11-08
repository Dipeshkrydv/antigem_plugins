# Facebook Automation Studio — Claude Directives (v1.1.0)

- On mobile AntiGem Browser, tools execute natively through `worker.js` (and `mcp_server/server.py` on desktop/Termux).
- When `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`) is returned, Facebook is already open on the login page in the AntiGem browser and the task is saved in `fb_pending_task`. Ask the user once to complete their one-time login and **STOP immediately** (zero tool retry loops).
- After login, use `fb_resume_pending` or `fb_publish` / `fb_publish_reel` / `fb_publish_story` to publish posts, photos, videos, reels, and stories with strict SHA-256 anti-duplicate protection.
