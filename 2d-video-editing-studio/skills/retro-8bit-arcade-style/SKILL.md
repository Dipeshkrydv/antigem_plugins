---
name: retro-8bit-arcade-style
description: >-
  Generates nostalgic 8-bit and 16-bit retro arcade video game intro cinematics and pixel art animations on Google Flow (Veo 3.1 & Imagen 3). Inspired by mughaldev0/8-bit-retro-intro-video-prompt. Use when the user requests 8-bit, 16-bit, pixel art, arcade game intro, chiptune aesthetics, or retro gaming visuals.
---

# 8-Bit & 16-Bit Retro Arcade Video Prompt Engine

Based on the prompt engineering methodologies from `mughaldev0/8-bit-retro-intro-video-prompt`.

## Core Aesthetic Directives

1. **Pixel Art Style Keywords**:
   - `8-bit pixel art animation`, `16-bit retro arcade game opening cinematic`, `nostalgic CRT monitor scanlines`, `vibrant pixelated sprites`, `isometric 16-bit video game cutscene`, `dithering shadows`, `retro chiptune title screen aesthetic`.

2. **Cinematography & Camera Movement**:
   - Smooth 2D side-scrolling camera (`smooth horizontal 2D parallax side-scroll`).
   - Dynamic 16-bit isometric camera angles (`isometric top-down arcade perspective`).
   - Dramatic retro title zoom (`dramatic pixelated camera zoom into retro glowing logo`).

3. **Color Palettes & Lighting**:
   - Neon synthwave cyber-palette (magenta, cyan, deep indigo).
   - Warm 8-bit NES/SNES color palette (rich primary reds, golden yellows, cobalt blues).
   - CRT glow with subtle chromatic aberration and phosphor bloom.

4. **Integration with DeepX Protagonist Locking**:
   - Bind `@protagonist_name` as a pixelated hero sprite (e.g. `@tesla_roadster in 16-bit pixel art style speeding down neon cyber-highway with pixel tire smoke`).

5. **Universal Orderly Scene Tagging & Auto-Download Protocol (Agent Mode & Standard Mode)**:
   - **Orderly Scene Indexing**: Multi-scene retro arcade sequences must include zero-padded tags: `#01_arcade_intro`, `#02_stage_select`, `#03_boss_fight`, `#04_victory_screen`.
   - **Orderly Auto-Download Mandate**: Enforce `auto_download: true` in BOTH Agent Mode and Standard Mode. Clips automatically save as `01_arcade_intro.mp4`, `02_stage_select.mp4` for flawless chronological sorting in video editing timelines.
