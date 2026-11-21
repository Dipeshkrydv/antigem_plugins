---
name: gemini-storyboard-director
description: >-
  Advanced multimodal storyboard director and cinematic choreography engine on Google Flow. Inspired by philschmid/gemini-samples. Use when the user requests cinematic prompt expansion, multimodal narrative breakdown, complex camera moves (crane, drone, orbit), lighting design, or narrative emotional beats.
---

# Gemini Multimodal Storyboard Director Skill

> **DeepX Google Flow Studio plugin:** write prompts with this skill, then generate with `deepx_generate`. Ask the user *Agent Mode or Standard mode (without Agent)?* first. Agent Mode auto-splits >24 prompts into parts of ≤24; Standard mode auto-switches to Agent Mode on Google 'unusual activity' blocks.

Based on Google DeepMind & Gemini multimodal storytelling samples from `philschmid/gemini-samples`.

## Directorial Architecture

1. **Multimodal Narrative Beat Formulation**:
   - Converts raw script or story concepts into three distinct cinematic layers:
     - **Visual Action**: What the protagonist and environment are physically doing.
     - **Camera Choreography**: Specific focal length, angle, and dynamic camera movement (`35mm anamorphic wide lens`, `rapid orbiting crane tracking shot`, `low-angle dynamic Dutch tilt`).
     - **Lighting & Atmosphere**: Volumetric lighting, environmental depth (`atmospheric mist`, `golden hour rim lighting`, `moody neon reflections on wet asphalt`).

2. **Shot Type Progression**:
   - **Scene 1 (Establishing Shot)**: Extreme wide aerial or drone establishing master view.
   - **Scene 2 (Character Introduction)**: Medium tracking shot anchoring `@protagonist_name`.
   - **Scene 3 (Dramatic Climax)**: Dynamic orbiting low-angle shot with high volumetric contrast.
   - **Scene 4 (Hero Resolution)**: Slow push-in close-up with shallow depth of field (bokeh).

3. **Seamless Chaining**:
   - Matches the ending visual state of Scene $N$ to the opening visual state of Scene $N+1$ using in-memory HTML5 Canvas continuity.

4. **Universal Orderly Scene Tagging & Auto-Download Protocol (Agent Mode & Standard Mode)**:
   - **Orderly Scene Tagging**: Every formulated scene prompt MUST include a strict zero-padded tag (e.g. `#01_scene_01`, `#02_scene_02`, ..., or `#001_scene_001` for ≥100 scenes) at the beginning of the prompt.
   - **Orderly Auto-Download Law**: In BOTH Google Flow Agent Mode (`flow_agent_dispatch`, `flow_agent_batch_queue`) and Standard Mode (`deepx_generate`, `flow_batch_generate`), all rendered clips auto-download with strict chronological filenames (`01_scene_01.mp4`, `02_scene_02.mp4`).
   - **Zero Video Editor Order Mismatch**: Alphabetical sorting in any video editor (Premiere, CapCut, DaVinci Resolve, 2D Video Editing Studio) guarantees 100% exact chronological narrative order with zero manual file renaming or dragging.
