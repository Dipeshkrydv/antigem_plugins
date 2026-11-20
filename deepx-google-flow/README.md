# DeepX Google Flow Studio (AntiGem plugin) — v1.1.0

The DeepX Google Flow Chrome extension, rebuilt as an AntiGem MCP plugin. There is no side panel, popup, WebSocket bridge or setup script. Every feature is an MCP tool plus a skill, so any AntiGem user can install it and generate straight from chat.

## What's new compared to the Chrome extension

| Feature | How it works |
| --- | --- |
| **Mode question before every generation** | `deepx_generate` refuses to generate until the user picks **Agent Mode** or **Standard (without Agent)**. It returns `ASK_GENERATION_MODE`, and the model shows it as one multiple-choice card. |
| **Agent Mode 24-per-part queue** | Any number of prompts (or "100 images of X", "1 to 1000 …") is split into parts of **≤24** and pasted into Google Flow Agent **back-to-back**. Each part is sent with a trusted touch, credit cards are auto-approved and Agent questions are auto-answered. |
| **Automatic block fallback** | If standard generation hits Google's **"unusual activity" / extension / captcha** block, unsent prompts are cancelled and every blocked prompt is re-sent through Agent Mode. For the next 15 minutes, standard requests route straight to Agent Mode. This also covers the legacy `deepx_generate_*` and `flow_generate_*` tools. |
| **Google login check** | Before any generation the engine checks that a Google account is signed in to Flow in the AntiGem browser. If not, it returns `LOGIN_REQUIRED` with one message for the user and generates nothing. |
| **Shared engine** | The same engine (`deepx-core.js`) is built into the 2D Video Editing Studio and Facebook Automation plugins (Facebook uses the classic `deepx-bundle.js` from `tools/build_classic_bundle.py`). |
| **Background jobs** | Each AntiGem MCP call has a 180-second limit, so long work runs as jobs. Poll them with `deepx_job_status` and cancel with `deepx_cancel_job`. |

## Everything from DeepX, kept
- Models: Nano Banana 2.1 / Pro / 2 Lite / Imagen 3, Omni Flash 1.2 / Omni 1.1 Flash / Veo 3.1 Quality / Fast / Lite.
- Agent Mode tools: status, toggle, 100% autopilot settings ("Confirm before generating: Never"), persistent custom instructions (DeepX Master Autopilot Director), approve-all, dispatch, 1–5000-item batch queue.
- Storyboard analyzer: newest DeepX version, with Hindi 2D documentary preset and Devanagari scene markers. Also entity/@handle detection and master reference prompts.
- Characters (generate / upload / rename / list / pipeline), references (upload / attach / batch attach), scene chaining via last frame, combine videos, GIF, upscale, edit / extend, downloads, project management.
- All 23 original `deepx_*` tool names, plus the native `flow_*` engine tools (90 tools in total).
- Skills: `deepx-google-flow` (main playbook with detail files), `hindi-2d-spy-documentary`, `retro-8bit-arcade-style`, `gemini-storyboard-director`, `matanyone-video-matting`.

## Architecture

```
worker.js              thin MCP listener
deepx-core.js          DeepX layer: login check, mode question, standard runner, block watchdog, fallback, tools
tools/build_classic_bundle.py  builds deepx-bundle.js for classic workers
deepx-agent.js         Agent Mode engine (prepare, ≤24 part builder, paste+tap, idle wait, approvals, jobs)
deepx-agent-page.js    MAIN-world Flow page helper (agent pill, settings, instructions, approvals, block detector)
flow-client.js         AntiGem native Flow engine (tab, project, RPC, submit with request guard, collect)
flow-workflows.js      Batch / storyboard / characters / references / chaining workflows
page-helpers.js        Native Flow page helper (composer, settings, picker, capture guard)
storyboard-analyzer.js DeepX storyboard architect (browser port)
deepx-knowledge.js     DeepX options knowledge base
```

Standard mode runs on AntiGem's native Flow engine, the same one used by the bundled `google_flow_mcp` and the 2D Video Editing Studio. Agent Mode is the DeepX engine, ported to AntiGem APIs: `chrome.scripting` MAIN world plus `chrome.antigem.automation` trusted touch.

## Install
1. AntiGem → Settings → Custom AntiGem Plugins → Repositories → add `Dipeshkrydv/antigem_plugins` → install **DeepX Google Flow Studio**. Alternatively, ZIP this folder and use Install ZIP.
2. MCP settings → Custom AntiGem Plugin MCP → choose **DeepX Google Flow Studio**.
3. Sign in to Google once in the Flow tab that opens in the AntiGem browser.

## Example
> **User:** Generate these 60 poster prompts in 9:16 …
> **Assistant:** *(card)* Agent Mode or Standard mode (without Agent)? → **Agent Mode**
> → `deepx_generate {prompts:[…60], generation_mode:"agent", media_type:"image", aspect_ratio:"9:16"}` → job `a1b2c3d4`, 3 parts (24 + 24 + 12) → poll → done.
