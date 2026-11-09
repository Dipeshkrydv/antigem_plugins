# -*- coding: utf-8 -*-
"""Pop-Art Vinyl Die-Cut Sticker Style — thick white die-cut contours, tactile surfaces, and pop-art collage.

Every cutout prop, character, and badge receives a crisp continuous white vinyl die-cut border (`asset_frame: "sticker"`)
and a two-tier soft contact + ambient drop shadow over warm textured paper or dark cutting-mat surfaces.
"""

NAME = "sticker"
ALIASES = ["pop_art", "cutout", "vinyl"]

_NEG = ("no text, no letters, no captions, no watermark, no logo, no signature, no UI, "
        "no borders, no frames, no split screen, no collage")

STYLE = {
    "look": {
        "bg": (244, 241, 234), "bg_kind": "crumple", "crumple_base": (248, 246, 240), "vig": 0.05,
        "ink": (20, 20, 22), "muted": (108, 108, 114),
        "accent": (230, 57, 70), "accent2": (255, 183, 3), "accent3": (6, 214, 160),
        "panel": (255, 255, 255, 248), "stamp_color": (230, 57, 70), "string_color": (20, 20, 22),
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
        "clarity": (
            "ONE bold readable subject, pop-art vinyl sticker illustration, thick dark ink contours (4-5px), "
            "vibrant saturated cel-shaded colours, immediately legible at thumbnail size"
        ),
        "medium": "pop-art vector vinyl sticker illustration, bold ink outlines, vibrant flat cel shading",
        "lighting": "clean studio graphic lighting, crisp cel-shaded highlights",
        "palette": "punchy pop-art primaries: crimson red, sunflower yellow, emerald mint, cobalt blue, ink black",
        "camera": {"shot": "centered hero shot", "lens": "35mm", "angle": "slight three-quarter view", "movement": "none"},
        "mood": "playful, satirical, high-energy, punchy",
        "quality": "razor-sharp vector ink contours, high contrast, die-cut sticker clarity",
        "negative": _NEG,
        "asset_medium": (
            "isolated pop-art sticker cutout illustration on a flat solid #FF00FF magenta background, "
            "thick black ink contour, vibrant cel shading, no shadow on background"
        ),
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
}

BEAT_S = 1.3
MIX = {"scene": 0.25, "asset": 0.65, "reuse": 0.02, "text": 0.08}

RECIPES = {
    "diecut_trio": {
        "layout": "row3", "bg": "paper",
        "items": [
            {"type": "asset", "name": "STICKER_1", "slot": "a", "label": "विकल्प 1", "at": "WORD"},
            {"type": "asset", "name": "STICKER_2", "slot": "b", "label": "विकल्प 2", "at": "WORD"},
            {"type": "asset", "name": "STICKER_3", "slot": "c", "label": "विकल्प 3", "at": "WORD"},
        ],
    },
    "flatlay_board": {
        "layout": "flatlay", "bg": "mat",
        "items": [
            {"type": "keyword", "text": "क्रिएटिव", "box": "block", "slot": "title"},
            {"type": "asset", "name": "HERO_STICKER", "slot": "a", "frame": "sticker", "at": "WORD"},
            {"type": "badge", "icon": "play", "slot": "b", "at": "WORD"},
            {"type": "badge", "icon": "star", "slot": "c", "at": "WORD"},
        ],
    },
    "speech_pop": {
        "layout": "speech_sticker", "bg": "grid",
        "items": [
            {"type": "speech_bubble", "text": "दिमाग का इस्तेमाल करो!", "slot": "bubble", "at": "WORD"},
            {"type": "asset", "name": "BRAIN_STICKER", "slot": "center", "frame": "sticker", "at": "WORD"},
        ],
    },
}
