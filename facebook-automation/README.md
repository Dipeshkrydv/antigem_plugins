# Facebook Automation & SEO Studio

> 🚀 Production-grade Facebook automation engine for Mobile (Android / Kiwi Browser / Termux) and Desktop.
> Features verified DOM post publishing, scheduling, post re-editing, deletion, comments, viral SEO generation, and **guaranteed zero duplicate uploads**.

---

## 🌟 Key Features

- **📱 True Mobile-First Architecture**: Seamlessly operates on Android phones via Kiwi Browser (Manifest V3 extension with $\ge 44$px touch targets) and Termux.
- **🛡️ Guaranteed Zero Duplicate Uploads**: Dual-tier deduplication engine combining SHA-256 media checksums and normalized caption hashing within a 48-hour rolling window.
- **🔒 In-Flight Concurrency Lock**: Atomic SQLite locks prevent race conditions and overlapping browser uploads.
- **⚡ Fast DOM Clipboard Ingestion**: Simulates rapid clipboard pasting to eliminate slow character-by-character typing timeouts.
- **📈 Algorithmic Facebook SEO**:
  - High-CTR 1-line retention hooks.
  - Generous vertical whitespace with 3-4 punchy micro-bullets.
  - Engagement CTAs and 3-6 targeted hashtags.
  - **First-Comment Link Strategy**: Automatically advises placing outbound links in the first comment to avoid Facebook's 50% external link reach penalty.
- **🔄 Full Post Lifecycle Control**:
  - Create posts (text, single photo, photo carousel, video, reel).
  - Schedule posts with background SQLite queue runner.
  - Re-edit existing post captions.
  - Delete or trash existing posts.
  - Post first comments or replies.
- **🌐 100% Privacy Clean**: Zero hardcoded personal user names, page names, or account IDs. Dynamically auto-detects active Facebook sessions.

---

## 📁 Repository Structure

```
facebook-automation/
├── manifest.json              # Antigravity plugin manifest
├── plugin.json                # Plugin metadata
├── worker.js                  # WebView service worker
├── icon.png                   # Plugin icon
├── setup_mobile.sh            # 1-Command installer for Android Termux & Linux
├── START_HERE.txt             # Quick-start instructions
├── README.md                  # Comprehensive documentation
├── SKILL.md                   # Plugin skill directives
├── GEMINI.md                  # Operational laws
├── AGENTS.md                  # Agent directives
├── CLAUDE.md                  # Directives for Claude
├── requirements.txt           # Python dependencies
├── mcp_server/                # FastMCP Server & Bridge
│   ├── __init__.py
│   ├── config.py              # Environment configuration & port 8766
│   ├── database.py            # SQLite database with SHA-256 dedupe & locks
│   ├── policy_guardian.py     # Anti-burst pacing & block sentinel
│   ├── fb_seo.py              # Facebook viral copy & SEO engine
│   ├── bridge_server.py       # WebSocket hub (ws://127.0.0.1:8766)
│   ├── facebook_controller.py # Publish, edit, delete, and session orchestration
│   ├── scheduler.py           # Background queue runner
│   └── server.py              # FastMCP server exposing tools
├── extension/                 # Mobile-Responsive Chrome/Kiwi Extension
│   ├── manifest.json          # MV3 extension manifest
│   ├── background.js          # WS client & tab router
│   ├── content_bridge.js      # DOM interaction script
│   ├── anti_detection.js      # Anti-detection stealth helpers
│   ├── popup.html             # Mobile-friendly popup (touch target >= 44px)
│   ├── popup.js               # Popup status & session sync controller
│   ├── styles.css             # Mobile responsive styles
│   └── icons/                 # Extension icons (16, 48, 128)
└── skills/                    # Antigravity Skills
    ├── facebook-automation/
    │   └── SKILL.md
    └── facebook-seo/
        └── SKILL.md
```

---

## ⚡ Quick Start

### 1. Installation
Run the installer script:
```bash
chmod +x setup_mobile.sh
./setup_mobile.sh
```

### 2. Load Extension
1. Open **Kiwi Browser** (Android) or **Google Chrome** (Desktop).
2. Navigate to `chrome://extensions`.
3. Enable **Developer Mode**.
4. Click **Load unpacked** and choose the `extension/` directory.

### 3. Run MCP Server
```bash
python3 mcp_server/server.py
```

---

## 🛠️ MCP Tools Overview

| Tool Name | Description |
| :--- | :--- |
| `fb_status` | Returns bridge connectivity, queue metrics, and sentinel status. |
| `fb_login_status` | Detects current active Facebook session (profile/page name & ID). |
| `fb_publish` | Publishes text, photo, video, or reel with DOM verification. |
| `fb_schedule` | Schedules a post for future execution. |
| `fb_edit_post` | Re-edits an existing Facebook post caption. |
| `fb_delete_post` | Deletes or moves a post to trash via DOM menu. |
| `fb_list_posts` | Lists recent published, scheduled, or failed posts. |
| `fb_seo_generate` | Generates viral hook, micro-bullets, hashtags, and alt-text. |
| `fb_audit_caption` | Audits caption for algorithmic penalties and readability. |
| `fb_comments` | Submits first comment or reply on target post. |
| `fb_doctor` | Self-diagnoses environment, database, and bridge health. |

---

## 📄 License
MIT License. Authored by Dipesh Kr Yadav.
