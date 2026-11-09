#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""auto_edit.py: Zero-Loop Senior Video Editor Auto-Choreographer (v3.2).

Automatically builds or heals EDIT.json from SHOTS.json + LINES.tsv/VO.tsv + WORDS.tsv
using style-authentic motion graphic widgets (bento_card, highlight_sweep, speech_bubble,
vinyl sticker cutouts, noir redactions) and smooth quintic transitions (smooth_zoom,
paper_slide, luma_wipe, whip_left).
"""
import csv
import json
import os
import re
import sys

LAYOUT_ROTATION = ["hero", "hero_r", "duo", "focus", "split", "hero", "duo", "focus"]
TRANSITION_ROTATION = {
    "box": ["smooth_zoom", "paper_slide", "luma_wipe", "fade"],
    "documentary": ["paper_slide", "smooth_zoom", "luma_wipe", "fade"],
    "vox": ["paper_slide", "smooth_zoom", "luma_wipe", "fade"],
    "stickman": ["whip_left", "smooth_zoom", "paper_slide", "whip_right"],
    "sticker": ["smooth_zoom", "whip_left", "paper_slide", "luma_wipe"],
    "noir": ["luma_wipe", "dip", "smooth_zoom", "flash"],
    "default": ["smooth_zoom", "paper_slide", "luma_wipe", "fade"],
}
CAMERA_ROTATION = ["push_in", "drift", "pan_right", "pull_out", "pan_left", "rise"]


def _load_lines():
    for fname in ("VO.tsv", "LINES.tsv"):
        if os.path.exists(fname):
            with open(fname, encoding="utf-8") as f:
                return list(csv.DictReader(f, delimiter="\t"))
    return []


def _extract_short_phrase(text, max_words=4):
    clean = re.sub(r"[।॥?!.,;:\"“”‘’—–\-()\[\]]+", " ", str(text or "")).strip()
    words = [w for w in clean.split() if len(w) > 1]
    if not words:
        return "KEY INSIGHT"
    pick = words[:max_words]
    if len(pick) >= 2:
        pick[-1] = f"_{pick[-1]}_"
    return " ".join(pick)


def _mid_word_cue(text):
    clean = re.sub(r"[।॥?!.,;:\"“”‘’—–\-()\[\]]+", " ", str(text or "")).strip()
    words = [w for w in clean.split() if len(w) > 2]
    if len(words) >= 4:
        return words[len(words) // 2]
    return None


def is_edit_stub(edit_path="EDIT.json", shots_path="SHOTS.json"):
    if not os.path.exists(edit_path):
        return True
    try:
        ed = json.load(open(edit_path, encoding="utf-8"))
        scenes = ed.get("scenes", [])
        if not scenes:
            return True
        if os.path.exists(shots_path):
            sh = json.load(open(shots_path, encoding="utf-8"))
            shot_names = {s.get("name") for s in sh.get("shots", [])}
            # Template stub references bg_kot_night when user's SHOTS.json has different shots
            if "bg_kot_night" not in shot_names and any(s.get("bg") == "bg_kot_night" for s in scenes):
                return True
        return False
    except Exception:
        return True


def build_auto_edit(shots_path="SHOTS.json", out_path="EDIT.json"):
    if not os.path.exists(shots_path):
        raise SystemExit(f"missing {shots_path}")
    spec = json.load(open(shots_path, encoding="utf-8"))
    style = spec.get("style", "documentary")
    aspect = spec.get("aspect", "16:9")
    shots = spec.get("shots", [])
    lines = _load_lines()
    if not lines:
        lines = [{"id": f"{i + 1:02d}", "text": s.get("subject", "")} for i, s in enumerate(shots)]

    bg_shots = [s for s in shots if s.get("kind", "scene") == "scene"]
    asset_shots = []
    for s in shots:
        if s.get("kind") == "asset":
            asset_shots.append(s)
        elif s.get("kind") == "sheet":
            for it in s.get("items", []):
                asset_shots.append(dict(it, kind="asset", line=s.get("line")))

    transitions = TRANSITION_ROTATION.get(style, TRANSITION_ROTATION["default"])
    scenes = []

    for idx, ln in enumerate(lines):
        lid = str(ln.get("id", f"{idx + 1:02d}"))
        ltext = ln.get("text", "")
        layout = LAYOUT_ROTATION[idx % len(LAYOUT_ROTATION)]
        cam = CAMERA_ROTATION[idx % len(CAMERA_ROTATION)]
        tr = "cut" if idx == 0 else transitions[idx % len(transitions)]

        # Match background scene for this line or rotate through bg_shots
        line_bgs = [s for s in bg_shots if str(s.get("line", "")) == lid]
        bg_shot = line_bgs[0] if line_bgs else (bg_shots[idx % len(bg_shots)] if bg_shots else None)
        bg_name = bg_shot["name"] if bg_shot else ("grid" if style == "box" else "paper")

        # Match cutout asset for this line or rotate
        line_assets = [a for a in asset_shots if str(a.get("line", "")) == lid]
        asset = line_assets[0] if line_assets else (asset_shots[idx % len(asset_shots)] if asset_shots else None)

        mid_cue = _mid_word_cue(ltext)
        phrase = _extract_short_phrase(ltext, max_words=3 if style in ("stickman", "sticker", "noir") else 5)
        items = []

        # 1. Kicker / Header badge on key scenes
        if idx == 0 or idx % 3 == 0:
            items.append({
                "type": "kicker",
                "text": f"PART {idx + 1:02d} // {style.upper()}",
                "design": ["bar", "chip", "bracket", "rule", "index"][idx % 5],
            })

        # 2. Primary visual or typography element by style
        if style == "box":
            items.append({
                "type": "bento_card",
                "title": f"METRIC #{idx + 1:02d}",
                "value": f"{(idx + 1) * 24}%",
                "sub": phrase.replace("_", ""),
                "delta": f"+{(idx + 1) * 12}%",
                "progress": min(0.92, 0.35 + idx * 0.14),
            })
        elif style in ("documentary", "vox") and idx % 2 == 1:
            items.append({
                "type": "highlight_sweep",
                "source": f"ARCHIVAL RECORD #{idx + 1:02d}",
                "text": ltext[:72] if len(ltext) > 10 else phrase,
                "highlight": ltext.split()[0] if ltext.split() else "",
                **({"at": mid_cue} if mid_cue else {}),
            })
        elif style in ("stickman", "stickman_hybrid", "doodle"):
            items.append({
                "type": "speech_bubble",
                "text": phrase.replace("_", ""),
                "style": "thought" if idx % 3 == 2 else "speech",
                "tail": "left" if layout == "hero" else "right",
                **({"at": mid_cue} if mid_cue else {}),
            })
        else:
            items.append({
                "type": "title" if idx == 0 else "keyword",
                "text": phrase,
                **({"at": mid_cue} if (idx > 0 and mid_cue) else {}),
            })

        # 3. Cutout asset placement
        if asset:
            lbl = " ".join(str(asset.get("subject", asset["name"])).split()[:3]).title()
            asset_item = {
                "type": "asset",
                "name": asset["name"],
                "label": lbl[:22],
            }
            if style == "sticker":
                asset_item["frame"] = "sticker"
            if mid_cue:
                asset_item["at"] = mid_cue
            items.append(asset_item)

        # 4. Smooth intra-scene camera reframe cut on longer lines
        cuts = []
        if mid_cue and bg_shot:
            cuts.append({
                "at": mid_cue,
                "frame": "close" if idx % 2 == 0 else "medium",
                "focus": [0.42 if idx % 2 == 0 else 0.58, 0.48],
            })

        scenes.append({
            "id": lid,
            "at": "@01" if idx == 0 else f"@{lid}",
            "bg": bg_name,
            "layout": layout,
            "camera": cam,
            "transition": tr,
            "items": items,
            **({"cuts": cuts} if cuts else {}),
        })

    edit_doc = {
        "style": style,
        "aspect": aspect,
        "fps": 24,
        "captions": "auto",
        "scenes": scenes,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(edit_doc, f, ensure_ascii=False, indent=2)
    print(f"✓ auto-choreographed {out_path} ({len(scenes)} scenes, style={style!r}, aspect={aspect!r})")
    return edit_doc


if __name__ == "__main__":
    shots_arg = sys.argv[1] if len(sys.argv) > 1 else "SHOTS.json"
    out_arg = sys.argv[2] if len(sys.argv) > 2 else "EDIT.json"
    build_auto_edit(shots_arg, out_arg)
