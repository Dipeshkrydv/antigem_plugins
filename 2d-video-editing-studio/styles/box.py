# -*- coding: utf-8 -*-
"""Box style — premium modern editorial engine.

The visual language of Bloomberg Originals, Vox digital, Morning Brew, The Information,
Nilay Patel's Decoder, Lex Fridman cold opens, 1Blocker ads, Linear launches. Dark
graphite surfaces, massive confident typography, indigo + yellow accent, cards that stack
and slide, numbers used as heroes, generous negative space.

WHAT MAKES IT WORK
  * one idea per card -- never cram two concepts into one layout
  * big type (title ~110px, stats ~160px) with a tiny label beneath
  * accent colour used ONCE per card: a single number, keyword, or button pop
  * depth comes from shadow + translucency, never from colour
  * dot/line grid under the cards (never fully blank) gives a product-launch feel
  * rhythm: a new card every ~3 s; same layout never repeats back-to-back
  * motion: cards SLIDE in from one edge, settle, slide out the other -- consistent axis
  * transitions: `slide` or `fade`; whip/dip kills the premium feel

ESSENTIAL ELEMENTS (use these item types in EDIT.json for a true "box" feel)
  kicker        tiny mono tag at the top ("CHAPTER 03 // MARKET SIZE")
  title         ~2 lines, headline font, one *word* accented
  stat_card     one giant number + label + unit (lives in `title` + `counter`)
  callout       small label pointing to a product/photo detail
  list          numbered or bulleted -- items appear on their own cue
  keyword       uses the pill/label/outline rotation (indigo + yellow)
  photo         always "card" frame (rounded + shadow), never polaroid
  stamp         sparingly; use for "SOURCE: Bloomberg" footer tags
  timeline      bar-chart or quarter-by-quarter progression

LAYOUTS unique to this style (also usable by name in EDIT.json):
  stat_hero     ONE giant number centred; label above/below. The signature move.
  kpi_row       3 stats side-by-side, each small-label + big-number
  compare       two cards A vs B with a divider between them
  product_card  product photo left, bulleted features right
  numbered_list vertical 01 / 02 / 03 column with headlines + micro copy

AVOID
  * polaroids, scribbles, tape, torn paper, chroma stickers, grain, vignette, letterbox
  * red stamps, hand-drawn arrows, speech bubbles, doodle accents
  * mixing accent2 (yellow) with accent3 (green) in the same scene

IMAGE PROMPTS come out as premium editorial product photography:
clean studio key light, graphite + white + a single bright pop, minimal props,
generous negative space on one side for the headline.
"""

NAME = "box"
ALIASES = ["editorial", "card", "premium"]

_NEG = ("no text, no letters, no captions, no watermark, no logo, no signature, no UI, "
        "no borders, no frames, no split screen, no collage, no handwriting, no stickers")

STYLE = {
    "look": {
        # surfaces
        "bg": (14, 16, 22),           # deep graphite, almost black
        "ink": (245, 246, 250),       # near-white body text
        "muted": (148, 152, 165),     # labels, tiny mono text, muted copy
        # accents (ONE per card, not all three)
        "accent": (99, 102, 241),     # electric indigo — primary brand pop
        "accent2": (250, 204, 21),    # safety yellow — numbers, highlights
        "accent3": (34, 197, 94),     # growth green — positive deltas only
        # panels, cards, stamps
        "panel": (28, 31, 39, 250),   # card fill
        "stamp_color": (99, 102, 241),
        "string_color": (99, 102, 241),
        # captions + framing
        "caption": "box",             # boxed caption plate with yellow current-word highlight
        "asset_frame": "card",        # rounded card around every cut-out
        "photo_frame": "card",        # rounded card around every photo
        # finishing (keep CLEAN: no grain, no vignette, no letterbox)
        "letterbox": 0.0, "grade": "", "grain": 0, "vignette": False,
        "transition": "slide",        # premium feel; also "fade"
        "camera": "drift",            # tiny breathing move; "still" also fine
        # background: subtle dot grid under cards
        "grid": True,
        # typography
        "kicker_prefix": "",
        "title_font": "headline",
        # keyword treatment rotation (consecutive keywords vary)
        "boxes": ["pill", "label", "outline", "neon"],
    },
    "prompt": {
        "clarity": (
            "one dominant focal subject, minimal premium composition, deep graphite backdrop, "
            "one bold electric-indigo or safety-yellow accent, generous dark negative space on "
            "one side reserved for a bold Hindi headline, product-launch photography feel"
        ),
        "medium": "premium editorial product photograph, Apple-launch aesthetic, 8K",
        "lighting": "soft directional studio key, controlled rim light, clean gradients, no harsh shadows",
        "palette": "deep graphite backdrop, matte metal highlights, one electric indigo or safety yellow accent",
        "camera": {"shot": "medium shot", "lens": "50mm", "angle": "slight low angle, straight-on",
                   "movement": "slow push-in"},
        "mood": "modern, confident, premium, inevitable",
        "quality": "ultra sharp focus, high micro-contrast, zero clutter, generous negative space, print-ready",
        "negative": _NEG,
        "asset_medium": "premium studio product photograph on deep graphite, soft rim light",
    },
}

# ---- Box-only layouts (available as "box.stat_hero" or just "stat_hero") ----
LAYOUTS_16_9 = {
    # ONE giant number centred, tiny label above, unit beneath. The signature.
    "stat_hero": {
        "tag": (0.10, 0.14, 0.80, 0.05),
        "label": (0.10, 0.21, 0.80, 0.06),
        "title": (0.10, 0.29, 0.80, 0.36),     # the big number lands here (counter item)
        "lower": (0.10, 0.67, 0.80, 0.06),     # unit / sublabel
    },
    # 3 stats side by side (small label + big number per card)
    "kpi_row": {
        "tag": (0.06, 0.09, 0.88, 0.045),
        "title": (0.06, 0.14, 0.88, 0.09),
        "a": (0.06, 0.26, 0.27, 0.42),
        "b": (0.365, 0.26, 0.27, 0.42),
        "c": (0.68, 0.26, 0.27, 0.42),
        "la": (0.06, 0.69, 0.27, 0.055),
        "lb": (0.365, 0.69, 0.27, 0.055),
        "lc": (0.68, 0.69, 0.27, 0.055),
    },
    # A vs B comparison
    "compare": {
        "tag": (0.06, 0.08, 0.88, 0.045),
        "title": (0.06, 0.13, 0.88, 0.10),
        "left": (0.05, 0.26, 0.42, 0.44),
        "right": (0.53, 0.26, 0.42, 0.44),
        "la": (0.05, 0.71, 0.42, 0.05),
        "lb": (0.53, 0.71, 0.42, 0.05),
    },
    # product photo + feature bullets
    "product_card": {
        "tag": (0.56, 0.11, 0.38, 0.045),
        "title": (0.56, 0.16, 0.38, 0.13),
        "list": (0.56, 0.32, 0.38, 0.40),
        "left": (0.05, 0.10, 0.46, 0.65),
    },
    # vertical numbered list (01 / 02 / 03)
    "numbered_list": {
        "tag": (0.06, 0.09, 0.88, 0.045),
        "title": (0.06, 0.14, 0.88, 0.11),
        "list": (0.06, 0.28, 0.88, 0.48),
    },
}
LAYOUTS_9_16 = {
    "stat_hero": {
        "tag": (0.08, 0.14, 0.84, 0.03),
        "label": (0.08, 0.19, 0.84, 0.04),
        "title": (0.08, 0.26, 0.84, 0.30),
        "lower": (0.08, 0.58, 0.84, 0.04),
    },
    "kpi_row": {
        "tag": (0.07, 0.09, 0.86, 0.03),
        "title": (0.07, 0.125, 0.86, 0.08),
        "a": (0.06, 0.22, 0.88, 0.14),
        "b": (0.06, 0.38, 0.88, 0.14),
        "c": (0.06, 0.54, 0.88, 0.14),
    },
    "compare": {
        "tag": (0.07, 0.08, 0.86, 0.03),
        "title": (0.07, 0.115, 0.86, 0.08),
        "left": (0.05, 0.22, 0.90, 0.22),
        "right": (0.05, 0.46, 0.90, 0.22),
    },
    "numbered_list": {
        "tag": (0.07, 0.08, 0.86, 0.03),
        "title": (0.07, 0.115, 0.86, 0.08),
        "list": (0.07, 0.22, 0.86, 0.48),
    },
}

# ---- Idiomatic scene templates (paste into EDIT.json and change cues/text) --
RECIPES = {
    "stat_moment": {
        "layout": "stat_hero", "bg": "dark", "camera": "still",
        "items": [
            {"type": "kicker", "text": "CHAPTER 03 // THE NUMBER"},
            {"type": "lower_third", "text": "GLOBAL MARKET SIZE", "sub": "2024, USD billions"},
            {"type": "counter", "from": 0, "to": 142, "suffix": "B", "at": "WORD", "dur": 1.6, "slot": "title"},
            {"type": "lower_third", "text": "↑ 38% YoY", "sub": "source: Statista"},
        ],
    },
    "bento_card": {
        "layout": "hero", "bg": "grid", "camera": "drift",
        "items": [
            {"type": "kicker", "text": "DATA INSIGHT // BENTO"},
            {"type": "title", "text": "डेटा का *असली* सच"},
            {"type": "bento_card", "title": "ANNUAL GROWTH", "value": "$142B", "delta": "+38.4%", "progress": 0.78,
             "sub": "वैश्विक बाज़ार में रिकॉर्ड उछाल", "slot": "right", "at": "WORD"},
        ],
    },
    "kpi_row": {
        "layout": "kpi_row", "bg": "grid", "camera": "drift",
        "items": [
            {"type": "kicker", "text": "AT A GLANCE"},
            {"type": "title", "text": "तीन *आँकड़े*"},
            {"type": "counter", "from": 0, "to": 104, "suffix": "", "at": "WORD", "slot": "a"},
            {"type": "counter", "from": 0, "to": 7, "suffix": "", "at": "WORD", "slot": "b"},
            {"type": "counter", "from": 0, "to": 1951, "suffix": "", "at": "WORD", "slot": "c"},
            {"type": "lower_third", "text": "YEARS OF RULE", "slot": "la"},
            {"type": "lower_third", "text": "FEBRUARY", "slot": "lb"},
            {"type": "lower_third", "text": "YEAR", "slot": "lc"},
        ],
    },
    "compare_card": {
        "layout": "compare", "bg": "dark", "camera": "still",
        "items": [
            {"type": "kicker", "text": "BEFORE // AFTER"},
            {"type": "title", "text": "*पहले* vs *बाद में*"},
            {"type": "photo", "src": "SRC_LEFT", "slot": "left", "frame": "card"},
            {"type": "photo", "src": "SRC_RIGHT", "slot": "right", "frame": "card"},
            {"type": "lower_third", "text": "1846", "sub": "Kot Massacre", "slot": "la"},
            {"type": "lower_third", "text": "1951", "sub": "Democracy", "slot": "lb"},
        ],
    },
    "numbered_list": {
        "layout": "numbered_list", "bg": "grid",
        "items": [
            {"type": "kicker", "text": "THREE SHIFTS"},
            {"type": "title", "text": "*तीन* बदलाव"},
            {"type": "list", "items": [
                {"text": "01   सत्ता एक खानदान में", "at": "WORD_1"},
                {"text": "02   राजा नाम का रह गया", "at": "WORD_2"},
                {"text": "03   जनता आवाज़हीन", "at": "WORD_3"},
            ]},
        ],
    },
}

EXAMPLES = [
    "see RECIPES['stat_moment'] for the signature stat card",
    "see RECIPES['kpi_row'] for a 3-up at-a-glance row",
    "see RECIPES['compare_card'] for a before/after",
    "see RECIPES['numbered_list'] for a vertical list",
]

# ---- asset plan: stat/text-led; images are sparse, premium and product-like --------------------------------
BEAT_S = 1.2
MIX = {"scene": 0.35, "asset": 0.50, "reuse": 0.05, "text": 0.10}
MENU = {
    "scene": ["premium environment photograph", "close-up of a material / texture", "workspace overhead", "skyline / location",
              "abstract light-and-shadow still life"],
    "asset": ["product on graphite", "device / gadget", "document / report", "portrait on dark backdrop", "icon-like object",
              "chart-friendly symbol", "tool / instrument", "packaging / package"],
}
ACCENTS = ["one indigo accent", "one safety-yellow accent", "one green accent (positive)"]

DESIGN = __doc__
