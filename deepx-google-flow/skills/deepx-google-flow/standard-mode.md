# Standard mode (without Agent) + automatic fallback

## Engine
AntiGem's native Google Flow engine: it configures image/video mode, model, aspect, output count, duration and resolution. It attaches references or start/end frames, pastes the prompt, taps Send with a trusted touch, verifies the outgoing request with a guard, then collects media IDs and files (`~/flow-media/flow_<id>.jpg|mp4`).

Limits: ≤500 prompts per call; `count` 1–4 outputs per prompt.
- Image models: Nano Banana 2.1, Nano Banana Pro, Nano Banana 2 Lite.
- Video models: Omni 1.1 Flash (4/6/8/10 s, 360p/720p), Veo 3.1 - Lite/Fast/Quality (8 s, 720p).
- Video ratio: 16:9 or 9:16.
- `dry_run:true` prepares everything and blocks the request before it is sent (no credits spent).

## Block detection → Agent Mode
Treated as a Google block: error text or an on-page notice that says *unusual activity / traffic*, *suspicious*, *automated queries*, *extension interfering / not supported*, *disable extensions*, *verify you're human*, *captcha / reCAPTCHA*, `PUBLIC_ERROR_UNUSUAL…`, `PERMISSION_DENIED`, HTTP 403.

When the first block appears:
1. All queued (unsent) prompts are cancelled immediately.
2. Prompts already in flight finish or fail.
3. Every failed or cancelled prompt is re-sent in **one Agent Mode job** (≤24 per part, back-to-back).
4. The parent job shows `fallback_job_id`, and the scenes show `rerouted_to_agent` → `done_in_agent_mode`.
5. For 15 minutes, new `generation_mode:"standard"` requests go straight to Agent Mode (`note` explains why).

Legacy tools (`deepx_generate_image`, `deepx_generate_video`, `deepx_batch_generate`, `deepx_rapid_batch_dispatch`, `flow_generate_*`, `flow_batch_generate`) have the same watchdog: a blocked job gets `fallback: {mode:"agent", job_id}`. Poll that job.

Set `auto_fallback:false` only if the user explicitly refuses Agent Mode.
