# Agent Mode details

## Sequence per job
1. Open/find the Google Flow tab in the AntiGem browser, use the current project (or create one).
2. Turn the **Agent** pill on. Open Agent settings: **Confirm before generating: Never** (100% autopilot), default image/video model, aspect ratio, quality. Save, close.
3. Sync custom instructions (`article_spark` panel). Default: *DeepX Master Autopilot Director* (no questions, every item now, zero style drift, @handle identity lock, faithful prompts). Override with `custom_instructions`.
4. Build parts of **≤24 items** (`max_per_part`, hard cap 24, Google Flow Agent's per-request limit):
   - prompt list → `[Image k/N] <prompt>` lines, 24 per part, with a header like `Generate all 24 images at once using Nano Banana 2.1 in 9:16 ratio (Part 2 of 5, items 25 to 48 of 100)`.
   - bulk text (`100 images of X`, `1 to 1000 …`, `total_count`, `range_start/range_end`) → numbered ranges per part.
5. For each part: paste → trusted Android touch on Send (falls back to a DOM click, then Enter) → confirm the agent started → wait until idle. Meanwhile it auto-clicks "Always approve in project" / "Approve", picks the matching multiple-choice option, and answers text questions such as "I can only generate up to 24…". Then it waits 2.5 s and sends the next part.
6. At the end it lists new media in the project (`media_ids`); `download:true` saves them to `~/flow-media`.

## Polling
`deepx_job_status {job_id, wait_seconds:30}` → `status` (queued/running/done/failed/cancelled), `stage`, `parts_done/total_parts`, `parts[] {part, items, status, method}`, `approvals[]`, `media_ids`.
Per-part wait limit: 480 s for images, 900 s for videos (`part_timeout_sec`). On timeout the part is marked `timeout_continued` and the next part is sent.

## Direct agent tools
- `deepx_flow_agent_dispatch {storyboard_text, media_type, ...}`: same queue engine; for when the user explicitly wants Agent Mode.
- `deepx_flow_agent_batch_queue {prompt_or_storyboard, range_start, range_end | total_count, media_type}`: 1 to 5000 items.
- `deepx_flow_agent_configure`, `deepx_flow_agent_set_instructions`, `deepx_flow_agent_toggle`, `deepx_flow_agent_status`, `deepx_flow_agent_approve_all`. Every tool also has a `flow_agent_*` alias.

## Models in Agent settings
Images: Nano Banana 2.1 (default), Nano Banana Pro, Nano Banana 2 Lite, Imagen 3.
Videos: Omni Flash 1.2 (default, 15 s with audio), Omni 1.1 Flash, Veo 3.1 - Quality, Veo 3.1 - Fast, Veo 3.1 - Lite.
