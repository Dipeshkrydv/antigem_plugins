---
name: stickman-hybrid
description: Senior Video Editor Stickman Storytelling & Vinyl Die-Cut Sticker Explainer Engine (v3.2). Produces expressive 2D Stickman storytelling explainers (style="stickman") and pop-art vinyl die-cut sticker collages (style="sticker") via the unified studio.py v3.2 pipeline, 3-Tier Google Flow Parallel Engine (Flow Connector CLI + AntiGem WebView FlowClient + DeepX Bridge), comic speech/thought bubbles (speech_bubble), hand-drawn doodle circles, and creative Baloo2-ExtraBold & Kalam-Bold typography.
---

# Stickman Storytelling & Pop-Art Sticker Explainer — Senior Video Editor Protocol (v3.2)

## ⚡ 0. ZERO-LOOP 1-COMMAND AUTOPILOT MANDATE
- **NEVER** call legacy v1 scripts (`kokoro_vo.py`, `whisper_align.py`, or manual 1-by-1 `flow-auto --wait` loops), and **NEVER** read engine `.py` files before producing a video.
- **INSTANT 2-STEP PRODUCTION TRACK (ZERO DELIBERATION LOOP)**:
  1. Create project & write `LINES.tsv` + `SHOTS.json` (and optionally `EDIT.json`; if omitted, `auto_edit.py` choreographs `EDIT.json` automatically with `speech_bubble` / vinyl sticker cutouts!).
  2. Run **ONE SINGLE COMMAND** to execute voiceover, prompt auto-healing, 3-Tier parallel Flow generation (`flow-auto` `--batch 4` / AntiGem `FlowClient` / `DeepX Bridge`), cutout keying, audio mixing (`-14 LUFS`), and 1080p rendering:
     ```bash
     CARTESIA_API_KEY=... python3 studio.py autopilot --voice anuj --lang hi --parallel 2
     ```

---

## 🎨 1. STICKMAN (`"style": "stickman"`) vs. STICKER (`"style": "sticker"`)

### A. Stickman Storytelling (`"style": "stickman"`)
- **Character & World**: Clean white circular head, thick black ink contours (3–5px), expressive eyebrows, modern casual hoodie/shorts or thematic explorer outfit over warm paper (`#F5F1E6`) or 2D hand-drawn scenic environments.
- **Creative Typography**: `Kalam-Bold` (handwritten marker) & `Baloo2-ExtraBold` (rounded display).
- **Signature Motion Graphics (`EDIT.json` items)**:
  - `{"type": "speech_bubble", "text": "दिमाग का इस्तेमाल करो!", "tail": "bottom_left", "slot": "title", "at": "WORD"}`: Comic speech bubble with directional pointer tail!
  - `{"type": "thought_bubble", "text": "अब क्या करूँ?", "slot": "l1", "at": "WORD"}`: Cloud thought bubble.
  - `{"type": "keyword", "text": "डोपामिन लूप", "box": "doodle_circle", "slot": "label", "at": "WORD"}`: Hand-drawn red marker loop around the key phrase.

### B. Pop-Art Vinyl Die-Cut Sticker (`"style": "sticker"`)
- **Visual Identity**: Every cutout automatically receives a thick continuous white vinyl die-cut border (`asset_frame: "sticker"`) + 2-tier contact & ambient drop shadow over crumpled paper or dark cutting-mat (`"bg": "mat"`) surfaces.
- **Creative Typography**: `Baloo2-ExtraBold` & `Baloo2-Bold` with pixel-aligned highlight boxes.
- **Layouts**: `row3`, `flatlay`, `speech_sticker`, `sticker_cluster`, `compare_cards`, `quote_card`.
