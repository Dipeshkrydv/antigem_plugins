---
name: vox-doc
description: Senior Video Editor Vox Documentary & Bento Box Explainer Engine (v3.2). Produces broadcast-grade Vox paper-collage documentaries and structured Bento Box data explainers using the unified studio.py v3.2 pipeline, 3-Tier Google Flow Rapid Parallel Engine (Flow Connector CLI + AntiGem WebView FlowClient + DeepX Bridge), live chisel-tip highlighter sweeps (highlight_sweep), Bento Data Cards (bento_card), quintic smooth camera/transition physics, and creative multi-font typography (PlayfairDisplay, NotoSerifDevanagari, Khand-Bold, SpaceMono).
---

# Vox Documentary & Bento Box Explainer — Senior Video Editor Protocol (v3.2)

## ⚡ 0. ZERO-LOOP 1-COMMAND AUTOPILOT MANDATE
- **NEVER** call legacy v1 scripts (`kokoro_vo.py`, `whisper_align.py`, or manual 1-by-1 `flow-auto --wait` loops), and **NEVER** read engine `.py` files before producing a video.
- **INSTANT 2-STEP PRODUCTION TRACK (ZERO DELIBERATION LOOP)**:
  1. Create project & write `LINES.tsv` + `SHOTS.json` (and optionally `EDIT.json`; if omitted, `auto_edit.py` choreographs `EDIT.json` automatically with `bento_card` / `highlight_sweep`!).
  2. Run **ONE SINGLE COMMAND** to execute voiceover, prompt auto-healing, 3-Tier parallel Flow generation (`flow-auto` `--batch 4` / AntiGem `FlowClient` / `DeepX Bridge`), cutout keying, audio mixing (`-14 LUFS`), and 1080p rendering:
     ```bash
     CARTESIA_API_KEY=... python3 studio.py autopilot --voice anuj --lang hi --parallel 2
     ```

---

## 🎨 1. VOX DOCUMENTARY (`"style": "documentary"`) vs. BENTO BOX (`"style": "box"`)

### A. Vox Documentary (`"style": "documentary"`)
- **Visual Identity**: Tactile cream paper (`#F4ECE1`), graph grids, halftone B&W archival photography (`"halftone": "bw"`), torn paper edges (`"frame": "torn"`), and one intentional spot colour (`#EC6624` burnt orange or `#F7C424` mustard).
- **Creative Typography**:
  - Headlines: `PlayfairDisplay-Bold` (Latin) / `NotoSerifDevanagari-VF@700` (Hindi)
  - Numbers & Kickers: `SpaceMono-Bold` / `Khand-Bold`
- **Signature Motion Graphics (`EDIT.json` items)**:
  - `{"type": "highlight_sweep", "text": "...", "slot": "title", "at": "WORD"}`: Live left-to-right yellow chisel-tip marker sweep across archival quotes!
  - `{"type": "title", "text": "सत्ता का *केंद्र*", "box": "strip"}`: Highlighter strip title.
  - `{"type": "chart", "slot": "band", "rows": [...]}`: Screen-printed horizontal bar chart.
  - `{"type": "block", "shape": "circle", "color": "accent", "slot": "back"}`: Giant solid color orb behind an archival cutout.
- **Smooth Transitions**: `"paper_slide"`, `"smooth_zoom"`, `"luma_wipe"`, `"fade"`, `"whip"` (directional Gaussian blur, zero blocky downscaling).

### B. Bento Box Style (`"style": "box"`)
- **Visual Identity**: Deep graphite grid (`#101216`), structured Bento Data Cards, KPI rows, and side-by-side comparison splits.
- **Creative Typography**:
  - Headlines: `Metropolis-Bold` (Latin) / `Khand-Bold` (Hindi)
  - Hero Numbers: `Anton-Regular` / `Khand-Bold`
- **Signature Motion Graphics (`EDIT.json` items)**:
  - `{"type": "bento_card", "title": "ANNUAL GROWTH", "value": "$142B", "delta": "+38.4%", "progress": 0.78, "sub": "...", "slot": "right", "at": "WORD"}`: Full glass/graphite Bento card with header tag, hero metric, green/red delta pill, and animated horizontal progress bar!
  - `{"type": "counter", "from": 0, "to": 104, "suffix": "%", "slot": "a", "at": "WORD"}`: Smooth exponential count-up.
