---
name: Google Flow Asset Engine (DeepX)
description: Built-in DeepX Google Flow engine for every 2D Studio asset. Login check, one Agent/Standard question, then autopilot; Agent Mode ≤24 prompts per part back-to-back; automatic Agent fallback on unusual-activity blocks.
version: 3.5.3
---

# Google Flow Asset Engine (built-in DeepX)

- **Only path for assets:** `studio_generate_assets {project_dir, generation_mode}` (or `deepx_generate` for one-off images or videos). No other Flow extension, no `flow-auto`, no 8792 bridge, no manual pasting or downloading.
- **Order:** `deepx_check_login` (on `LOGIN_REQUIRED`, give the user the one sign-in message and stop) → last question "with Agent Mode or without Agent Mode?" → generate on autopilot → poll `deepx_job_status` (30 s) → `python studio.py key`.
- **Agent Mode:** switches Flow to Agent with "Confirm before generating: Never", syncs the DeepX consistency instructions, and pastes prompts in parts of ≤24 back-to-back. Flow Agent questions and credit cards are answered automatically. New media are matched to asset names with strict zero-padded chronological numbering and auto-downloaded to `elements/raw/` (or `deepx_renders/<project_name>`) with zero order mismatch.
- **Without Agent:** AntiGem native composer with a request guard, orderly sequential naming, and exact settings. If Google shows "unusual activity" / an extension / a captcha, the remaining and blocked assets are re-sent through Agent Mode automatically. For 15 minutes after a block, new requests go straight to Agent Mode. All rendered clips auto-download in strict chronological sequence.
- **v1.2.4 engine (Nov 22 2026):** Settings/Instructions panels auto-close before paste; prompts are pasted instantly and verified; Send is confirmed in ~1.5 s; each Agent part downloads in parallel (8 at a time) while the next part generates. Never paste or download manually.
- **Zero duplicates:** existing `elements/cut|raw/<name>` files are skipped, identical prompts are generated once and copied, and referenced assets are generated after their reference.
- **$0 cost:** uses the user's signed-in Google Flow account in the AntiGem browser.
