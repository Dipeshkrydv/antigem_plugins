---
name: deepx-rapid-flow
description: >-
  Ultra-fast production engine for DeepX Google Flow automation. Use when the user requests image/video generation, storyboard execution, character creation, multi-scene video ads, or mentions 'DeepX', 'Google Flow', 'veo', 'start task', 'start our task', 'video script', 'full_script_hindi', 'commercial', 'make video', or 'flow bridge'. Enforces zero loading pauses, master creative director script breakdown for ANY raw input, instant protagonist auto-detection (human, animal, car, product), compulsory reference card locking across all scenes (unless explicitly told not to use reference), in-memory HTMLCanvas terminal frame extraction, and rapid autonomous scene-to-scene chaining without repetitive alignment interviews or redundant status polling.
---

# DeepX Rapid Flow Production Engine

This skill governs the high-speed, zero-latency execution pipeline between Antigravity and Google Flow via the DeepX Extension bridge.

## Core Directives

1. **SACROSANCT SOURCE OF TRUTH: User Script & Data Fidelity (CRITICAL MANDATE)**:
   - The user's script, story, characters, dialogue, setting, actions, and data are the **ABSOLUTE SOURCE OF TRUTH**.
   - Antigravity is the **Visualizer & Technical Production Director**, NOT an author who alters the story.
   - **NEVER** rewrite, modify, replace, hallucinate, invent, or discard the user's script, plot points, or data.
   - **Zero Canned Preset Hijacking**: Common nouns (e.g. "car", "phone", "student", "mother", "watch", "shoes") must NEVER be forcibly replaced with canned fictional entities (`@quantum_phone`, `@saraswati_mother`, `@rohan_ca`, etc.). Characters and entities must be derived 100% faithfully from the user's input.
   - When a user pastes ANY raw input (rough prompt, full story, bullet points, Hindi/multilingual script, or commercial brief):
     - Preserve 100% of the user's storyline, character names, dialogues, and plot events.
     - Call `deepx_analyze_and_breakdown_script` to segment the story into a cohesive multi-scene video storyboard (`#scene_01`, `#scene_02`, etc.) anchored strictly to the user's data.
     - Automatically detect all protagonist and recurring entities directly from the user's text and assign clean standardized handles.
     - Seamlessly weave `@mention` tags into each broken-down scene prompt so Google Flow automatically binds the reference cards into `<flow-ingredient-bar>`.
     - Ingest local asset references from `assets/` or generate master reference keyframes/cards via Imagen 3 / 🍌 Nano Banana 2.1 before rendering videos.

2. **Compulsory Protagonist Auto-Detection & Universal Reference Locking (FLAGSHIP CORE)**:
   - Consistent protagonist appearance across all video scenes and reference images is DeepX's primary feature and is **STRICTLY COMPULSORY**.
   - **Universal Protagonist Definition**: Protagonist can be a **Car/Vehicle** (e.g. Tesla Roadster, vintage Mustang), **Animal/Creature** (e.g. golden tiger, dragon), **Human** (e.g. samurai, student, astronaut), or **Hero Product** (e.g. smart ring, luxury chronometer, smartphone).
   - **Automatic Action**:
     - Auto-detect the protagonist entity from the user's script/concept.
     - If local images exist in `assets/` or workspace (`photo_*.jpg`), upload them via `deepx_upload_character` or `deepx_upload_asset` under the protagonist name.
     - If no local images exist, generate the hero portrait/reference first via `deepx_generate_character` or `deepx_generate_image` (with `imagen-3` / `🍌 Nano Banana 2.1` and `wait_for_render: true`), waiting for 100% tile completion before proceeding to video scenes.
     - **Always lock this reference card** into every video and image generation using `deepx_attach_references_batch`, `@protagonist_name` in prompt text, or `hero_references` parameter.
   - **The ONLY Exception**:
     - ONLY omit reference locking if the user explicitly writes: *"do not take reference character"*, *"no reference image"*, *"generate without reference"*, or *"text-only prompt"*.

3. **Continuous Unbroken Execution & Anti-Over-Speed Mandate ('Never Stop After Character Upload')**:
   - Antigravity MUST NEVER pause, wait, or end turn after uploading or generating character references.
   - Ingesting references/characters is merely Step 0. The actual goal is producing the video scenes.
   - **Anti-Over-Speed Rule**: When generating character reference images, Antigravity and the bridge MUST wait for the image tile to reach 100% completion in Google Flow before dispatching video scenes. Never dispatch video generation while a character image is still rendering (e.g. 2% or 15%), as premature reference binding causes reference loss and visual inconsistency in generated videos.
   - In the EXACT SAME CONTINUOUS TURN:
     1. Analyze script and detect all character/entity profiles upfront.
     2. Ingest or generate reference image (`deepx_upload_asset` preferred <500ms, or `deepx_generate_image` / `deepx_generate_character` with 100% render wait).
     3. Immediately and without stopping to ask questions, dispatch the scene storyboard via `deepx_rapid_storyboard_autopilot` or `deepx_rapid_batch_dispatch`.
     4. Stream real-time render progress (`2%` -> `15%` -> `100%`) back to the user until generation is complete.
   - NEVER pause to ask the user 'Character uploaded, shall I proceed?' or stop after reference upload.

4. **Zero Redundant Alignment Interviews**:
   - When the user provides a script, prompt collection, or story concept, NEVER stop to ask repetitive alignment questions regarding aspect ratio, models, or duration.
   - Default intelligently to:
     - **Aspect Ratio**: `16:9` (commercial / cinematic) or `9:16` (shorts / reels if specified).
     - **Quality**: `1080p` (cinematic full HD default), `720p` (fast preview), `2k`, or `4k` (ultra HD).
     - **Video Model**: `veo-omni` (10s) or `veo-quality` (8s).
     - **Image Model**: `imagen-3` or `🍌 Nano Banana 2.1`.
   - Immediately execute reference generation or scene production.

5. **Zero Connection / Status Latency**:
   - The WebSocket bridge at `ws://127.0.0.1:8792/ws` maintains persistent real-time heartbeat.
   - NEVER inspect `server.js` or `ws-bridge.js`.
   - NEVER run `node -e` test scripts.
   - Call `deepx_status` once to check status (<10ms).

6. **Universal Antigravity Connect & Disconnect Protocol**:
   - **Connect Prompt**: `"Connect to DeepX Flow Bridge MCP server (deepx-flow) at ws://127.0.0.1:8792/ws. Call deepx_status to verify that Google Flow is attached and ready. Once connected, confirm that you are ready to generate images and videos on Google Flow with 100% user script fidelity."`
     - Action: Call `deepx_status` once (<10ms). If `ready: true`, acknowledge connection immediately and confirm readiness to generate with 100% adherence to user script and data.
   - **Disconnect Prompt**: `"Disconnect from DeepX Flow Bridge MCP. Pause all automated generation, stop sending jobs to Google Flow, and stand by in offline mode until I ask you to reconnect."`
     - Action: Acknowledge disconnection immediately, halt all generation dispatching, and enter standby mode without calling any `deepx_*` tools until instructed to reconnect.

7. **Universal Multi-Reference Stacking (<300ms)**:
   - When generating video scenes, ALWAYS attach ALL relevant reference assets into Google Flow's prompt box: the protagonist card (`@character_name` or `hero_references`), PLUS ALL newly generated scene cutout images / master keyframes (via `:recent_images` or by name), filling up to 4–5 ingredient chips into `<flow-ingredient-bar>`.
   - Antigravity MUST NEVER submit a video prompt with only 1 reference when multiple scene reference assets exist. ALL generated scene images and protagonist cards MUST be attached.
   - Use `deepx_attach_references_batch` with `asset_names: ["character_name", ":recent_images"]`.
   - The extension keeps the drawer open and attaches all target ingredient chips in a single rapid event-driven sweep.

8. **Autonomous Video Analysis & Chaining**:
   - The moment Scene $N$ finishes rendering on Google Flow:
     - Automatically analyze the video tile directly on canvas.
     - Extract its exact terminal end frame in memory via `HTMLCanvasElement` (zero-copy, zero-disk I/O, ~30ms).
     - Upload the frame via `DataTransfer` into Flow's media library (~150ms).
     - Stack the terminal frame + planned reference images for Scene $N+1$ into `<flow-ingredient-bar>` (<300ms).
     - Submit Scene $N+1$ prompt immediately.
     - Total transition time: **< 1.5 seconds**.

9. **Tool Reference**:
   - `deepx_analyze_and_breakdown_script`: Master Creative Director & Storyboard Architect. Analyzes raw prompts, Hindi/multilingual scripts, stories, or bullet points, isolates protagonist entities, assigns @handles, and formats execution-ready multi-scene storyboards.
   - `deepx_rapid_storyboard_autopilot`: Single-command complete autonomous multi-scene video production with automatic script analysis, in-memory terminal frame extraction, protagonist reference stacking, and auto-download.
   - `deepx_rapid_batch_dispatch`: Rapidly paste batch prompts with blank-line gaps at 400ms pacing (supports auto-segmentation of raw text).
   - `deepx_auto_character_pipeline`: Automated master character and universal entity pipeline; auto-extracts entities from script if not explicitly provided.
   - `deepx_attach_references_batch`: Attach up to 5 reference photo cards in one atomic call (<300ms).
   - `deepx_auto_chain_scene`: Autonomous video analysis, terminal frame grab, reference binding, and next scene submission.
   - `deepx_generate_character`: Native Google Flow Character Studio generator.
   - `flow_agent_dispatch` / `deepx_flow_agent_dispatch`: 1-Click Multi-Scene Storyboard Dispatch directly to Google Flow's native Agent Mode (<1s) for autonomous scene clustering, continuity, and orchestration on 100% autopilot.
   - `flow_agent_status` / `deepx_flow_agent_status`: Inspect whether Google Flow Agent Mode pill is detected and active on canvas.
   - `flow_agent_toggle` / `deepx_flow_agent_toggle`: 1-Click Toggle Google Flow Agent Mode pill on or off on canvas (select vs disconnect Agent Mode).
   - `flow_agent_configure` / `deepx_flow_agent_configure`: Sets confirmation policy ('Confirm before generating: Never' for zero-interruption autonomous generation), default video model (Omni Flash 1.2, Veo 3.1 Quality, etc.), default image model (🍌 Nano Banana 2.1, etc.), and canvas aspect ratio directly inside Google Flow Agent settings.
   - `flow_agent_set_instructions` / `deepx_flow_agent_set_instructions`: Injects persistent directorial rules, style guidelines, and character directives directly into Flow Agent ('article_spark' panel) so the agent maintains visual consistency across all autonomous scenes.
   - `flow_agent_approve_all` / `deepx_flow_agent_approve_all`: Instantly approves any pending credit confirmation card in Google Flow Agent ('Always approve in project' or 'Approve') for zero-interruption execution.
   - `flow_agent_batch_queue` / `deepx_flow_agent_batch_queue`: Autonomously shards large bulk generation requests (e.g. 1 to 1000 items, or multi-scene storyboards >24 scenes) into sequential batches of up to 24 items, dispatches them back-to-back, and auto-approves all credit prompts on 100% Autopilot.

10. **Google Flow Agent Mode 100% Autopilot & Zero-Approval Mandate**:
   - **Autopilot Policy**: Google Flow Agent Mode must NEVER halt or pause for credit approval cards (*"Would you like me to kick off this 1 video generation, costing X credits?"*). DeepX automatically sets 'Confirm before generating: Never' in Flow Agent settings, and maintains an active 400ms background watcher to immediately click 'Always approve in project' or 'Approve' on any stray confirmation card.
   - **Model & Media Type Freedom**: In Agent Mode, users can select between Video and Image modes, and pick any model (Omni Flash 1.2 with 15s audio, Veo 3.1 Quality, Veo 3.1 Lite, 🍌 Nano Banana 2.1, 🍌 Nano Banana Pro, Imagen 3).
   - **Persistent Custom Instructions**: Directorial rules (e.g. 2D Documentary Realism, Chiaroscuro Lighting, Zero AI Morphing, Die-Cut Contours) are injected into the Agent's persistent instructions panel via `article_spark` and remain active throughout the entire project session.
   - **Lifecycle Management**: Cleanly toggle between Flow Agent Mode and Standard prompt mode using `flow_agent_toggle` without page reloads.

11. **Google Flow Agent 24-Item Hard Ceiling & 1-to-1000 Auto-Chunking Architecture**:
   - **Platform Guard**: Google Flow Agent enforces a strict server-side ceiling: *"I can only generate up to 24 items per request. Please specify a smaller count (up to 24) or let me know which specific numbers you'd like to create first."*
   - **DeepX Auto-Partitioning**: When a user requests bulk generations (e.g. `1 to 1000 numbers`, `100 images`, or 60 scenes):
     - DeepX calculates $\lceil N / 24 \rceil$ batches (e.g. 1000 items = 41 batches of 24 + 1 batch of 16 = 42 batches).
     - Feeds Batch 1 (1–24) to Flow Agent.
     - Autopilot watcher auto-approves credits.
     - DeepX detects when Flow Agent finishes starting/processing Batch 1 (wait until idle).
     - DeepX automatically submits Batch 2 (25–48), Batch 3 (49–72), ..., up to Batch 42 on complete Autopilot with zero user intervention!

12. **Interactive Question Auto-Handling & The 5 Pillars of Scene Consistency**:
   - **Autonomous Question Handling**: During bulk generation or concept exploration, Google Flow Agent occasionally asks clarifying multiple-choice questions (e.g. *"What subject or topic would you like the 24 images to feature? (o) Numbers 1 to 24 ( ) Stickman Adventures ( ) Abstract Art Styles"* rendered in `div.choice-container .option-row[role='radio']`).
     - DeepX automatically evaluates the pending question cards.
     - Matches the options against active context keywords (e.g. topic/range).
     - Automatically clicks the matching option row via trusted MDC pointer and mouse events, or defaults to Option 0 (Flow Agent's primary intended choice).
     - Guarantees 100% Autopilot progress with zero pauses or manual clicking!
   - **The 5 Pillars of Multi-Scene Consistency**:
     1. **World & Environment Anchoring**: Every generated scene locks the primary environment (e.g. tactile paper canvas `#F8F6EF`, consistent architectural motifs, horizon line).
     2. **Atmospheric Lighting Physics**: Unified key light direction, high-contrast chiaroscuro shadows, and identical color temperature across all sequential shots.
     3. **Protagonist & Entity Stability**: Hero characters and entities are anchored with persistent `@handle` tags (e.g. `@sam_detective`, `@boy`) ensuring fixed facial proportions, signature clothing, and zero AI morphing distortion.
     4. **Die-Cut Contour & Contact Shadow Law**: Visual assets receive continuous white outer die-cut borders (4-8px) and soft 2-tier ambient drop shadows, preventing flat or ungrounded sticker looks.
     5. **In-Memory Terminal Frame Chaining**: For continuous motion, previous clip terminal frames are grabbed in-memory and stacked into the prompt bar to guarantee absolute frame-to-frame continuity.

13. **Universal Pre-Loaded Master Directives (Zero-Interruption & Anti-Drift Guarantee)**:
   - **Pre-Loaded for Everyone**: Google Flow Agent Mode automatically pre-loads and enforces the Master Autopilot & Consistency Directive on session start without requiring manual configuration.
   - **Autopilot Mandate**: Google Flow Agent operates in 100% Autopilot Mode: no clarifying questions, no multiple-choice radio option stops, and no credit approval pauses.
   - **Anti-Drift Collection Formula**: Bulk batches (e.g. numbers 1 to 1000, multi-scene storyboards) are locked into a single cohesive artistic collection with identical tactile canvas (`#F8F6EF`), matching architectural typography, uniform lighting angles, and zero style drift.
