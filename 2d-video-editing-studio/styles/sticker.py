# -*- coding: utf-8 -*-
"""Sticker Hybrid: pop-art vinyl die-cut stickers on tactile paper.

IDENTITY
  Bold, witty, high-energy explainer. Every idea is a glossy vinyl STICKER (thick white die-cut border, soft two-tier
  shadow) slapped onto crumpled paper or a cutting mat. Satire through visual metaphor: a brain handing out advice,
  a parody product, a burning wallet. Punchy and clean, never cluttered.

CANVAS
  Crumpled off-white paper #F4F1EA (default), graph grid for data beats, green cutting mat for "desk" flat-lays.

PALETTE
  ink #141416 · crimson #E63946 (problem, punchline) · sunflower #FFB703 (idea, money, highlight) ·
  mint #06D6A0 (good, solution). The stickers themselves are vivid; the page stays neutral. One accent leads per scene.

TYPOGRAPHY
  Rounded heavy display (Baloo 2 ExtraBold) for titles, 2 to 5 words. Labels as small pills under stickers.
  Keyword treatments: sticky note, tag, pill, marker, colour block. Speech bubble max 4 words, max 1 per scene.

IMAGE LANGUAGE (what Flow must draw)
  Pop-art vector sticker illustrations: thick dark ink contour, vibrant flat cel shading, glossy highlight.
  Cut-outs are generated on magenta; the ENGINE adds the white die-cut border and the shadow (so prompts must not
  draw a border or a background). Scenes: simple illustrated backdrops in the same vector style.

COMPOSITION
  A hero sticker centre (or 2 to 3 stickers in a row), generous paper around each, labels beneath.
  Slight sticker tilt (2 to 5 degrees) is part of the look; never stack more than 4 stickers.

MOTION
  Slap-on pop with a gentle settle, quick whip transitions, soft drift. No shaking, no vibrating stickers.

SIGNATURE MOVES
  hero sticker · die-cut trio · compare cards · flat-lay desk · speech pop · quote card · big number badge

AVOID
  photographs, dark cinematic grading, letterbox, more than 4 stickers on screen, double borders
  (white border drawn by Flow AND by the engine), paragraphs, neon.
"""

NAME = "sticker"
LABEL = "Sticker Hybrid"
ALIASES = ["pop_art", "cutout", "vinyl", "sticker_hybrid"]

PALETTE = {
    "canvas":  {"hex": "#F4F1EA", "use": "crumpled paper"},
    "ink":     {"hex": "#141416", "use": "text and contours"},
    "muted":   {"hex": "#6C6C72", "use": "secondary text"},
    "accent1": {"hex": "#E63946", "use": "crimson: problem, punchline"},
    "accent2": {"hex": "#FFB703", "use": "sunflower: idea, money, highlight"},
    "accent3": {"hex": "#06D6A0", "use": "mint: good, solution"},
    "stamp":   {"hex": "#E63946", "use": "emphasis marks"},
    "string":  {"hex": "#141416", "use": "arrows"},
    "panel":   {"hex": "#FFFFFF", "alpha": 248, "use": "cards, bubbles"},
    "rule":    "page neutral, stickers vivid; ONE accent leads each scene",
}

TYPE = {
    "title": "round", "label": "round", "number": "display", "caption": "caption",
    "max_words": {"title": 5, "label": 3, "keyword": 3, "speech_bubble": 4},
    "boxes": ["sticky", "tag", "pill", "marker", "block"],
}

MOTION = {
    "entrances": ["pop", "drop", "slide", "snap"],
    "camera": ["drift", "push_in"],
    "transitions": ["whip", "smooth_zoom", "slide"],
    "never": ["shake", "jitter", "vibrate"],
}

_NEG = ("no photograph, no photorealism, no 3D render, no text, no letters, no captions, no watermark, no logo, "
        "no signature, no UI, no split screen, no collage")

STYLE = {
    "look": {
        "bg_kind": "crumple", "crumple_base": (248, 246, 240), "vig": 0.05,
        "caption": "pop",
        "asset_frame": "sticker",
        "photo_frame": "sticker",
        "ground": False, "jitter": False,
        "label_style": "pill",
        "letterbox": 0.0, "grade": "eq=saturation=1.06", "grain": 2, "vignette": False,
        "transition": "whip", "camera": "drift", "paper": True,
        "kicker_prefix": "", "title_font": "round",
        "boxes": ["sticky", "tag", "pill", "marker", "block"],
    },
    "prompt": {
        "lock": ("pop-art vector sticker illustration, thick dark ink contour of even weight, vibrant flat cel shading with one "
                 "glossy highlight, crimson / sunflower / mint accents, identical outline weight and shading style in every image"),
        "clarity": ("ONE bold readable subject or visual metaphor, instantly legible at thumbnail size, simple shapes, "
                    "clean empty area for a headline"),
        "medium": "pop-art vector illustration, bold ink outlines, vibrant flat cel shading",
        "lighting": "clean graphic lighting, crisp cel-shaded highlights, no realistic shadows",
        "palette": "punchy pop-art colours: crimson red, sunflower yellow, mint green, cobalt blue, ink black, on a neutral paper tone",
        "camera": {"shot": "centered hero shot", "lens": "flat 2D illustration framing", "angle": "slight three-quarter view",
                   "movement": "none"},
        "mood": "playful, satirical, high-energy, punchy",
        "quality": "razor-sharp vector contours, high contrast, clean shapes",
        "negative": _NEG + ", no frame, no border around the image",
        "asset_medium": ("isolated pop-art vector sticker illustration of a single subject, thick black ink contour, "
                         "vibrant cel shading, plain edges with nothing around the subject and NO shadow (the engine adds the white die-cut edge)"),
    },
}

CENTERED = {"row3", "sticker_cluster", "quote_card", "flatlay", "speech_sticker", "compare_cards"}

LAYOUTS_16_9 = {
    "row3": {
        "tag": (0.06, 0.06, 0.88, 0.045),
        "a": (0.04, 0.14, 0.29, 0.56), "b": (0.355, 0.14, 0.29, 0.56), "c": (0.67, 0.14, 0.29, 0.56),
    },
    "flatlay": {
        "title": (0.08, 0.07, 0.84, 0.11),
        "a": (0.28, 0.20, 0.44, 0.50),
        "b": (0.04, 0.18, 0.22, 0.26), "c": (0.74, 0.18, 0.22, 0.26),
        "d": (0.04, 0.46, 0.22, 0.24), "e": (0.74, 0.46, 0.22, 0.24),
    },
    "speech_sticker": {
        "bubble": (0.18, 0.06, 0.64, 0.18),
        "center": (0.26, 0.26, 0.48, 0.48),
        "l1": (0.04, 0.34, 0.20, 0.14), "r1": (0.76, 0.34, 0.20, 0.14),
    },
    "sticker_cluster": {
        "tag": (0.06, 0.06, 0.88, 0.045), "title": (0.06, 0.11, 0.88, 0.10),
        "center": (0.33, 0.23, 0.34, 0.44),
        "a": (0.05, 0.25, 0.25, 0.22), "b": (0.70, 0.25, 0.25, 0.22),
        "c": (0.05, 0.50, 0.25, 0.22), "d": (0.70, 0.50, 0.25, 0.22),
        "label": (0.33, 0.69, 0.34, 0.065),
    },
    "compare_cards": {
        "tag": (0.06, 0.06, 0.88, 0.045), "title": (0.06, 0.11, 0.88, 0.10),
        "left": (0.06, 0.24, 0.41, 0.44), "right": (0.53, 0.24, 0.41, 0.44),
        "la": (0.06, 0.70, 0.41, 0.065), "lb": (0.53, 0.70, 0.41, 0.065),
    },
    "quote_card": {
        "tag": (0.14, 0.10, 0.72, 0.05), "title": (0.10, 0.18, 0.80, 0.34),
        "a": (0.18, 0.54, 0.26, 0.20), "b": (0.56, 0.54, 0.26, 0.20),
    },
}

LAYOUTS_9_16 = {
    "row3": {
        "tag": (0.07, 0.06, 0.86, 0.03),
        "a": (0.06, 0.10, 0.42, 0.26), "b": (0.52, 0.10, 0.42, 0.26),
        "c": (0.20, 0.38, 0.60, 0.28),
    },
    "flatlay": {
        "title": (0.07, 0.07, 0.86, 0.08),
        "a": (0.14, 0.17, 0.72, 0.32),
        "b": (0.06, 0.51, 0.42, 0.16), "c": (0.52, 0.51, 0.42, 0.16),
    },
    "speech_sticker": {
        "bubble": (0.08, 0.08, 0.84, 0.14),
        "center": (0.12, 0.24, 0.76, 0.42),
    },
    "sticker_cluster": {
        "tag": (0.07, 0.06, 0.86, 0.03), "title": (0.07, 0.095, 0.86, 0.08),
        "center": (0.16, 0.19, 0.68, 0.26),
        "a": (0.06, 0.47, 0.42, 0.14), "b": (0.52, 0.47, 0.42, 0.14),
        "label": (0.12, 0.625, 0.76, 0.055),
    },
    "compare_cards": {
        "tag": (0.07, 0.06, 0.86, 0.03), "title": (0.07, 0.095, 0.86, 0.075),
        "left": (0.08, 0.18, 0.84, 0.20), "la": (0.14, 0.385, 0.72, 0.045),
        "right": (0.08, 0.44, 0.84, 0.20), "lb": (0.14, 0.645, 0.72, 0.04),
    },
    "quote_card": {
        "tag": (0.10, 0.14, 0.80, 0.03), "title": (0.08, 0.18, 0.84, 0.22),
        "a": (0.08, 0.43, 0.40, 0.20), "b": (0.52, 0.43, 0.40, 0.20),
    },
}

# Recipes are TEMPLATES: core/auto_edit.py fills every name / text / cue from the voice line it is used for.
RECIPES = {
    "hero_sticker": {
        "use_for": ["hook", "object", "reveal"], "layout": "sticker_cluster", "bg": "paper",
        "items": [
            {"type": "title", "text": "सबसे *बड़ा* झूठ", "at": "WORD"},
            {"type": "asset", "name": "HERO_STICKER", "slot": "center", "at": "WORD", "enter": "pop"},
            {"type": "keyword", "text": "सच?", "box": "sticky", "slot": "label", "at": "WORD"},
        ],
    },
    "diecut_trio": {
        "use_for": ["list", "object"], "layout": "sticker.row3", "bg": "paper",
        "items": [
            {"type": "asset", "name": "STICKER_1", "slot": "a", "label": "विकल्प 1", "at": "WORD"},
            {"type": "asset", "name": "STICKER_2", "slot": "b", "label": "विकल्प 2", "at": "WORD"},
            {"type": "asset", "name": "STICKER_3", "slot": "c", "label": "विकल्प 3", "at": "WORD"},
        ],
    },
    "compare_cards": {
        "use_for": ["compare"], "layout": "compare_cards", "bg": "grid",
        "items": [
            {"type": "title", "text": "यह *बनाम* वह", "at": "WORD"},
            {"type": "asset", "name": "STICKER_LEFT", "slot": "left", "at": "WORD"},
            {"type": "keyword", "text": "पहला", "box": "tag", "slot": "la", "at": "WORD"},
            {"type": "asset", "name": "STICKER_RIGHT", "slot": "right", "at": "WORD"},
            {"type": "keyword", "text": "दूसरा", "box": "tag", "slot": "lb", "at": "WORD"},
        ],
    },
    "flatlay_board": {
        "use_for": ["place", "list"], "layout": "sticker.flatlay", "bg": "mat",
        "items": [
            {"type": "keyword", "text": "क्रिएटिव", "box": "block", "slot": "title", "at": "WORD"},
            {"type": "asset", "name": "HERO_STICKER", "slot": "a", "frame": "sticker", "at": "WORD"},
            {"type": "asset", "name": "SIDE_STICKER", "slot": "b", "frame": "sticker", "at": "WORD"},
            {"type": "badge", "icon": "star", "slot": "c", "at": "WORD"},
        ],
    },
    "speech_pop": {
        "use_for": ["quote", "person"], "layout": "speech_sticker", "bg": "paper",
        "items": [
            {"type": "speech_bubble", "text": "दिमाग का इस्तेमाल करो!", "slot": "bubble", "at": "WORD"},
            {"type": "asset", "name": "BRAIN_STICKER", "slot": "center", "frame": "sticker", "at": "WORD", "enter": "pop"},
        ],
    },
    "quote_card": {
        "use_for": ["quote", "outro"], "layout": "quote_card", "bg": "paper", "camera": "still",
        "items": [
            {"type": "title", "text": "\"सोचो *फिर* करो\"", "at": "WORD"},
            {"type": "asset", "name": "STICKER_A", "slot": "a", "at": "WORD"},
        ],
    },
    "number_badge": {
        "use_for": ["number"], "layout": "sticker_cluster", "bg": "paper",
        "items": [
            {"type": "counter", "to": 46, "suffix": "%", "slot": "title", "at": "WORD"},
            {"type": "asset", "name": "HERO_STICKER", "slot": "center", "at": "WORD", "enter": "pop"},
            {"type": "keyword", "text": "हर साल", "box": "pill", "slot": "label", "at": "WORD"},
        ],
    },
    "person_sticker": {
        "use_for": ["person"], "layout": "sticker_cluster", "bg": "crumple",
        "items": [
            {"type": "asset", "name": "PERSON_STICKER", "slot": "center", "at": "WORD", "enter": "drop"},
            {"type": "keyword", "text": "नाम", "box": "tag", "slot": "label", "at": "WORD"},
        ],
    },
    "outro_pop": {
        "use_for": ["outro", "reveal"], "layout": "quote_card", "bg": "paper", "camera": "push_in",
        "items": [
            {"type": "keyword", "text": "अब आप जानते हो", "box": "block", "slot": "title", "at": "WORD"},
            {"type": "asset", "name": "HERO_STICKER", "slot": "b", "at": "WORD", "enter": "pop"},
        ],
    },
}

EXAMPLES = [f"{k}: RECIPES['{k}'] ({', '.join(v['use_for'])})" for k, v in RECIPES.items()]

BEAT_S = 1.3
MIX = {"scene": 0.25, "asset": 0.65, "reuse": 0.02, "text": 0.08}
MENU = {
    "scene": ["simple illustrated backdrop of the place in the same vector style", "visual-metaphor scene (giant object, tiny people)",
              "desk flat-lay seen from above", "split scene: good side vs bad side", "pop-art city / office / kitchen backdrop"],
    "asset": ["person or character sticker with a clear expression", "single object sticker (product, tool, food, money)",
              "satirical parody object (no real brand marks)", "anatomical / symbolic metaphor sticker (brain, heart, wallet)",
              "icon sticker (star, check, warning, lightbulb)", "badge sticker with a big shape (no text)", "animal / plant sticker"],
}
ACCENTS = ["crimson accent", "sunflower-yellow accent", "mint-green accent"]

DESIGN = __doc__
