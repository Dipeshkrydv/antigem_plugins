# -*- coding: utf-8 -*-
"""Sticker explainer — flat illustrations, retro cut-outs and desk flat-lays (rebuilt from reference frames).

REFERENCES THIS ENGINE IS BUILT AROUND
  * Hindi explainer   China map | pile of coins | England map, each a FLAT vector illustration with a
                      plain dark label underneath ("चीन", "करोड़ों रुपये", "इंग्लैंड"), generous space around
                      them, a warm vignetted paper background and a solid MUSTARD caption plate at the bottom
  * officer + plant   two flat illustrations side by side, labels beneath, the date in the caption plate
  * retro cut-out     a colour halftone portrait with a thick WHITE sticker border on flat green, small
                      sans label top-left ("SMART OBJECTS" / "Retro CutOut Effect")
  * flat-lay desk     green cutting mat, scattered desk objects (keyboard, earbuds, mouse, watch, polaroid
                      camera), BIG colour-block titles in rounded bold type (brown / yellow / white), little
                      stars, an app icon, a cursor, tiny UI toggles

WHAT MAKES IT PROFESSIONAL (and why the old stickman version looked toy-like)
  1. Illustrations are FLAT and unframed; they breathe. Never outline + shadow + tilt + burst on one asset
  2. Every illustration carries a PLAIN label beneath it -- the label is the explanation
  3. The surface is warm paper with a real vignette (or a cutting mat), never a blank fill
  4. Captions are a solid mustard plate with dark ink: legible on anything, no per-word fireworks
  5. Where it pops, it pops with ONE device: a thick white sticker border + colour halftone (retro),
     OR a colour-block title -- not both on the same element
  6. Colour is a small family (terracotta, mustard, brown, cream, one green) used repeatedly
  7. Motion is gentle: rise / pop / snap, with a hand-moved stop-motion boil on cut-outs

ITEM TYPES TO USE
  asset        flat illustration + `label` (plain)         {"type":"asset","name":"map_china","slot":"a","label":"चीन"}
               frame "retro" + halftone "retro" for the white-border sticker pop
  keyword      `box:"block"` rotates brown / yellow / white colour blocks; also sticky, tag, note, plate
  badge        UI chip: play / star / hash / check / bell / mail / search / bolt   {"type":"badge","icon":"play"}
  note, counter, list, callout, stamp, arrow, ransom also work

LAYOUTS (names usable in EDIT.json)
  row2 / row3 / row4   2-4 illustrations side by side, labels beneath (the Hindi explainer)
  retro_hero           title block + label left, large retro sticker right
  flatlay              colour-block titles in the middle, four desk objects in the corners (use bg "mat")
  pop_title            one big colour-block title with a second block beneath

AVOID  crayon scribbles, speech-bubble clutter, red bursts, polaroids, dark backgrounds, per-word karaoke
       captions, mixing a white sticker border with a flat illustration in the same scene
"""

NAME = "stickman"
ALIASES = ["stickman_hybrid", "doodle", "whiteboard", "explainer"]

_NEG = ("no photorealism, no realistic live-action photo, no 3D cgi render, no photographic human skin, "
        "no text, no letters, no captions, no watermark, no logo, no UI, no frames, no borders, "
        "no messy scribble, no blur")

STYLE = {
    "look": {
        # warm paper / sketchbook canvas with subtle natural vignette
        "bg": (245, 241, 230), "bg_kind": "paper", "vig": 0.18, "vig_tint": (1.0, 0.94, 0.86),
        "ink": (24, 22, 20), "muted": (110, 102, 92),
        "accent": (214, 60, 40),           # vibrant red marker
        "accent2": (240, 175, 15),         # warm yellow highlighter
        "accent3": (42, 115, 205),         # cobalt blue ink
        "panel": (255, 252, 244, 240),
        "stamp_color": (214, 60, 40), "string_color": (24, 22, 20),
        "caption": "pill",
        "asset_frame": "clean", "photo_frame": "flat",
        "label_style": "plain",
        "halftone": False, "photo_halftone": False, "dot": 7,
        "title_font": "hand", "big_font": "hand",   # Authentic hand-drawn Kalam typography
        "doodles": True, "jitter": False, "ground": False,
        "letterbox": 0.0, "grade": "eq=saturation=1.05", "grain": 0, "vignette": False,
        "transition": "slide", "camera": "drift", "paper": True,
        "kicker_prefix": "",
        # colour-block palette: rich modern saturated contrast (vibrant blue/white, amber/dark, coral/white, white/cobalt)
        "blocks": [((35, 95, 225), (255, 255, 255)), ((255, 210, 20), (24, 22, 20)),
                   ((235, 75, 45), (255, 255, 255)), ((255, 255, 255), (35, 80, 200))],
        "boxes": ["pill", "marker", "doodle_circle", "note", "tag"],
    },
    "prompt": {
        "clarity": (
            "ONE expressive modern 2D storytelling illustration, Casually Explained and Alan Becker animation style, "
            "clean white circular head, bold black ink contour lines, highly expressive eyebrows and smirk, "
            "wearing modern casual attire (oversized hoodie, rolled denim shorts, sneakers) or thematic explorer outfit, "
            "clean 2D cel shading, vibrant colorful contrast where characters and environments pop with high saturation, crisp vector clarity"
        ),
        "medium": "modern 2D digital animation illustration, expressive comic stickman character, clean 2D vector art",
        "lighting": "cinematic directional light with soft cel shadows, warm sunlit pools or crisp flat studio light",
        "palette": "bold black ink contours, clean white head, rich saturated attire (cobalt blue, fiery orange, emerald green, denim), warm vibrant colorful 2D cel-shaded environment with lively background tones and golden lighting",
        "camera": {"shot": "centred hero shot", "lens": "2D animation camera", "angle": "straight-on",
                   "movement": "none"},
        "mood": "funny, curious, satirical, storytelling, educational",
        "quality": "crisp organic hand-drawn ink lines, bold silhouette, clean vector edges, instant readability",
        "negative": _NEG,
        "asset_medium": "isolated modern 2D stickman character or pop-art prop with crisp black ink outlines on solid flat pure magenta background hex 0xFF00FF",
    },
}

CENTERED = {"row2", "row3", "row4", "flatlay", "pop_title"}

LAYOUTS_16_9 = {
    # the Hindi explainer: illustrations in a row, label beneath each (asset `label`)
    "row2": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.11, 0.88, 0.12),
        "a": (0.12, 0.26, 0.34, 0.49), "b": (0.54, 0.26, 0.34, 0.49),
    },
    "row3": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.11, 0.88, 0.12),
        "a": (0.05, 0.26, 0.28, 0.49), "b": (0.36, 0.26, 0.28, 0.49), "c": (0.67, 0.26, 0.28, 0.49),
    },
    "row4": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.11, 0.88, 0.12),
        "a": (0.03, 0.26, 0.21, 0.49), "b": (0.27, 0.26, 0.21, 0.49),
        "c": (0.51, 0.26, 0.21, 0.49), "d": (0.75, 0.26, 0.21, 0.49),
    },
    # retro cut-out: text block left, big sticker right
    "retro_hero": {
        "tag": (0.06, 0.09, 0.30, 0.04), "title": (0.06, 0.15, 0.36, 0.30),
        "label": (0.06, 0.48, 0.36, 0.08),
        "center": (0.46, 0.06, 0.50, 0.70),
    },
    # desk flat-lay (bg "mat"): colour-block titles centre, objects in the corners, tiny badges
    "flatlay": {
        "a": (0.03, 0.05, 0.19, 0.31), "b": (0.78, 0.05, 0.19, 0.31),
        "c": (0.03, 0.42, 0.19, 0.31), "d": (0.78, 0.42, 0.19, 0.31),
        "title": (0.25, 0.10, 0.50, 0.20), "l1": (0.25, 0.34, 0.50, 0.12), "r1": (0.25, 0.49, 0.50, 0.12),
        "e": (0.24, 0.64, 0.09, 0.10), "f": (0.67, 0.64, 0.09, 0.10),
    },
    "pop_title": {
        "tag": (0.12, 0.20, 0.76, 0.04), "title": (0.12, 0.26, 0.76, 0.26), "l1": (0.12, 0.56, 0.76, 0.14),
    },
    # Whiteboard Hero: Stickman character on one side, clean doodle annotation/arrow on the other
    "whiteboard_hero": {
        "tag": (0.06, 0.07, 0.45, 0.04), "title": (0.06, 0.12, 0.45, 0.22),
        "center": (0.08, 0.36, 0.42, 0.40), "r1": (0.55, 0.22, 0.38, 0.46),
    },
    "napkin_math": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.12, 0.88, 0.12),
        "left": (0.08, 0.28, 0.40, 0.48), "right": (0.52, 0.28, 0.40, 0.48),
    },
}
LAYOUTS_9_16 = {
    "whiteboard_hero": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.12),
        "center": (0.12, 0.24, 0.76, 0.26), "r1": (0.12, 0.52, 0.76, 0.16),
    },
    "napkin_math": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.12),
        "left": (0.10, 0.24, 0.80, 0.22), "right": (0.10, 0.48, 0.80, 0.22),
    },
    "row2": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.10),
        "a": (0.10, 0.23, 0.80, 0.21), "b": (0.10, 0.46, 0.80, 0.21),
    },
    "row3": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.10),
        "a": (0.18, 0.21, 0.64, 0.145), "b": (0.18, 0.37, 0.64, 0.145), "c": (0.18, 0.53, 0.64, 0.145),
    },
    "row4": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.09),
        "a": (0.04, 0.22, 0.44, 0.20), "b": (0.52, 0.22, 0.44, 0.20),
        "c": (0.04, 0.44, 0.44, 0.20), "d": (0.52, 0.44, 0.44, 0.20),
    },
    "retro_hero": {
        "tag": (0.07, 0.08, 0.86, 0.03), "title": (0.07, 0.12, 0.86, 0.12),
        "label": (0.07, 0.25, 0.86, 0.04), "center": (0.10, 0.31, 0.80, 0.37),
    },
    "flatlay": {
        "a": (0.03, 0.07, 0.34, 0.17), "b": (0.63, 0.07, 0.34, 0.17),
        "title": (0.08, 0.28, 0.84, 0.13), "l1": (0.08, 0.43, 0.84, 0.10),
        "c": (0.03, 0.56, 0.30, 0.12), "d": (0.67, 0.56, 0.30, 0.12),
    },
    "pop_title": {
        "tag": (0.08, 0.22, 0.84, 0.03), "title": (0.08, 0.27, 0.84, 0.20), "l1": (0.08, 0.50, 0.84, 0.10),
    },
}

RECIPES = {
    "whiteboard_hero": {
        "layout": "whiteboard_hero", "bg": "paper",
        "items": [
            {"type": "title", "text": "तनाव का *असर*", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_stressed", "slot": "center", "at": "WORD"},
            {"type": "keyword", "text": "दबाव", "box": "doodle_circle", "slot": "r1", "at": "WORD"},
        ],
    },
    "story_scene": {
        "layout": "retro_hero", "bg": "paper",
        "items": [
            {"type": "kicker", "text": "THE JOURNEY"},
            {"type": "title", "text": "मंज़िल की *तलाश*", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_explorer", "slot": "center", "at": "WORD"},
            {"type": "keyword", "text": "सही रास्ता", "box": "sticky", "slot": "label", "at": "WORD"},
        ],
    },
    "speech_sticker": {
        "layout": "whiteboard_hero", "bg": "paper",
        "items": [
            {"type": "asset", "name": "st_stickman_brain_offer", "slot": "center", "at": "WORD"},
            {"type": "speech_bubble", "text": "PLEASE USE IT!", "slot": "title", "at": "WORD"},
            {"type": "keyword", "text": "सोच समझकर", "box": "tag", "slot": "r1", "at": "WORD"},
        ],
    },
    "story_desk": {
        "layout": "whiteboard_hero", "bg": "paper",
        "items": [
            {"type": "kicker", "text": "DEEP WORK"},
            {"type": "title", "text": "रात भर *पढ़ाई*", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_desk_study", "slot": "center", "at": "WORD"},
        ],
    },
    "row3_labels": {
        "layout": "row3", "bg": "paper",
        "items": [
            {"type": "asset", "name": "map_china", "slot": "a", "label": "चीन", "at": "WORD"},
            {"type": "asset", "name": "coins", "slot": "b", "label": "करोड़ों रुपये", "at": "WORD"},
            {"type": "asset", "name": "map_england", "slot": "c", "label": "इंग्लैंड", "at": "WORD"},
        ],
    },
    "row2_labels": {
        "layout": "row2", "bg": "paper",
        "items": [
            {"type": "asset", "name": "officer", "slot": "a", "label": "ब्रिटिश अफ़सर", "at": "WORD"},
            {"type": "asset", "name": "tea_plant", "slot": "b", "label": "जंगली चाय का पौधा", "at": "WORD"},
        ],
    },
    "pop_title": {
        "layout": "pop_title", "bg": "paper",
        "items": [
            {"type": "kicker", "text": "सवाल"},
            {"type": "keyword", "text": "चाय का रहस्य", "box": "doodle_circle", "slot": "title", "at": "WORD"},
            {"type": "keyword", "text": "चीन से इंग्लैंड तक", "box": "sticky", "slot": "l1", "at": "WORD"},
        ],
    },
}

EXAMPLES = [
    "whiteboard stickman with doodle circled note: RECIPES['whiteboard_hero']",
    "storytelling stickman explorer: RECIPES['story_scene']",
    "stick figure with prop & speech bubble: RECIPES['speech_sticker']",
    "stickman studying at sunlit desk: RECIPES['story_desk']",
    "clean flat illustrations in a row: RECIPES['row3_labels'] / ['row2_labels']",
    "doodle circled question title: RECIPES['pop_title']",
]

# ---- asset plan: modern stickman explainer (35% stylized 2D scenes, 55% expressive stick assets) ---
BEAT_S = 1.1
MIX = {"scene": 0.35, "asset": 0.55, "reuse": 0.02, "text": 0.08}

MENU = {
    "scene": ["hand-drawn 2D landscape (cliff overlooking mountains, canyon rapids, desert path)",
              "stylized warm indoor room (wooden desk with notebooks, sunlit window, library)",
              "fork in the road crossroad with wooden directional signpost",
              "storybook settlement / ancient village in cross-hatched ink"],
    "asset": ["stickman expressing emotion (confused, stressed, tired, triumphant, shocked, smirking)",
              "stickman performing an action (working at desk, rowing raft, holding map, running, pointing)",
              "stickman in casual modern outfit (hoodie, rolled denim shorts, sneakers, backward cap)",
              "stickman with thematic prop (explorer fedora + satchel, flash cowl, caveman tunic)",
              "pop-art sticker prop (satirical brand parody, detailed anatomical brain, speech bubble)",
              "hand-drawn doodle object (clock, coffee cup, laptop, money stack, lightbulb, book)",
              "doodle diagram (flowchart arrow, circled highlight, graph trend, Venn diagram)",
              "symbol / icon doodle (caution sign, question mark, lightning bolt, cross mark X)"],
}
ACCENTS = ["red marker accent", "cobalt blue ink accent", "mustard highlighter accent", "selective saturated color"]

DESIGN = __doc__
