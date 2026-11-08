---
name: Facebook Automation
description: Autonomous Facebook post publishing, scheduling, re-editing, deletion, and comments with zero duplicate uploads.
version: 1.0.0
---

# Facebook Automation Skill

Autonomous production-grade Facebook automation engine for mobile (Kiwi Browser / Android / Termux) and desktop.

## Directives
- **Zero Duplicate Post Mandate**: Always check SHA-256 media checksums and normalized caption text hashes before publishing.
- **In-Flight Lock**: Ensure no two posts upload simultaneously.
- **Anti-Burst Pacing**: Maintain minimum 45s between automated actions to safeguard account reputation.
- **Full Post Lifecycle Control**:
  - `fb_publish`: Text, photo, video, or reel with verified DOM modal completion.
  - `fb_schedule`: Queues posts in local SQLite for automated execution.
  - `fb_edit_post`: Re-edits existing post caption via 3-dots action menu.
  - `fb_delete_post`: Deletes or moves post to trash via 3-dots action menu.
  - `fb_comments`: Posts comment (e.g. first comment link) or replies.
- **Zero Personal Data Leak**: Never hardcode personal IDs or account names. Session identity is detected dynamically from the active browser tab.
