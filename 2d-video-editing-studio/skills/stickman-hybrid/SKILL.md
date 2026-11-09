---
name: stickman-hybrid
description: Senior Video Editor Stickman Storytelling & Vinyl Die-Cut Sticker Explainer Engine (v3.2). Produces expressive 2D Stickman storytelling explainers (style="stickman") and pop-art vinyl die-cut sticker collages (style="sticker") via the unified studio.py v3.2 pipeline, 3-Tier Google Flow Parallel Engine (Flow Connector CLI + AntiGem WebView FlowClient + DeepX Bridge), comic speech/thought bubbles (speech_bubble), hand-drawn doodle circles, and creative Baloo2-ExtraBold & Kalam-Bold typography.
---

# Stickman Storytelling & Pop-Art Sticker Explainer — Senior Video Editor Protocol (v3.2)

## ⚡ 0. ZERO-LOOP DIRECT EXECUTION MANDATE
- **NEVER** call legacy v1 scripts (`kokoro_vo.py`, `whisper_align.py`, or manual 1-by-1 `flow-auto --wait` loops).
- **ALWAYS** execute through the unified `studio.py` v3.2 pipeline inside a project directory (`python studio.py new <project_dir>`):
  1. `CARTESIA_API_KEY=... python studio.py voice --voice anuj` -> `VO.wav`, `VO.tsv`, `WORDS.tsv`
  2. `python studio.py plan --style stickman` (or `--style sticker`) -> `PLAN.json`
  3. Write `SHOTS.json` -> `python studio.py prompts` -> `ELEMENTS.tsv`
  4. `python studio.py generate` -> **3-Tier Parallel Flow Engine** (`flow-auto` `--batch 4`, AntiGem WebView `FlowClient` `"Nano Banana 2.1"`, or `DeepX Bridge`)
  5. `python studio.py key` -> keys `#FF00FF` magenta cutouts into `elements/cut/`
  6. Write `EDIT.json` -> `python studio.py check` -> `python studio.py sheet`
  7. `python studio.py render` -> produces `master.mp4` with `-14 LUFS` BGM + Foley SFX.

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
