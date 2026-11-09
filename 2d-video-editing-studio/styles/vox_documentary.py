# -*- coding: utf-8 -*-
"""Vox documentary — paper-collage explainer engine (rebuilt from reference frames).

REFERENCES THIS ENGINE IS BUILT AROUND
  * "1925" / "1927"   a GIANT numeral in spot colour (mustard / navy) sits BEHIND halftone black-and-white
                      cut-outs (a walking woman, Statue of Liberty, a ship, a desk lamp with a light cone)
                      with tiny paper annotation labels left and right of it
  * "Porsche 356"     yellow highlighter STRIP with a bold serif headline, a small serif sub-line
                      ("The price at launch is $3,750") and ONE clean cut-out car on graph paper
  * "Higgs + Claude"  strip headline across the top, a person on a yellow CIRCLE, torn-paper cut-outs
                      (film camera, reel, TV) pinned around, hand-drawn dashed arrows, small icon chips
  * hands collage     B&W hands + ONE yellow object (glove, notebook) on torn paper, black pen LOOPS
                      and scattered ransom-note letters tying everything together
  * bar chart         serif title, thin source line, textured horizontal bars on graph paper
  * Capitol           halftone building with orange colour BLOCKS and a glitch-pixel edge

WHAT MAKES IT PROFESSIONAL (and why the old version looked flat)
  1. Cut-outs are HALFTONE B&W prints with one spot colour -- never a coloured picture in a frame
  2. Depth: giant type and colour blocks sit BEHIND the subject (layer order), soft ground shadow beneath it
  3. Every edge is hand-made: torn paper with a white fibre rim, scissor-cut border, tiny stop-motion "boil"
  4. The surface is real: crumpled white paper / graph paper / kraft, with a vignette -- never a flat fill
  5. Type is editorial: Playfair + Noto Serif Devanagari, ink-texture (pinholes), highlighter strips
  6. Annotations are paper labels and hand-drawn arrows/loops, never vector pills
  7. Colour discipline: ink black + ONE spot colour per scene (mustard OR navy OR orange); the rest is paper

ITEM TYPES TO USE
  bigtext      giant numeral/word behind the subject        {"type":"bigtext","text":"1925","slot":"back","color":"accent2"}
  asset        halftone cut-out, `ground` shadow            {"type":"asset","name":"ct_x","slot":"center","halftone":"bw","spot":"accent2"}
  photo        torn halftone print                          {"type":"photo","src":"sc_x","frame":"torn","slot":"left"}
  block        colour slab / circle / glitch edge           {"type":"block","shape":"circle","color":"accent2","slot":"back"}
  note         thin paper annotation label                  {"type":"note","text":"...","slot":"l1"}
  title        `box:"strip"` highlighter strip + `sub`      {"type":"title","text":"...","sub":"..."}
  arrow/loops  hand-drawn dashed arrow / pen loops          {"type":"arrow","from":"a","to":"b"}
  badge        UI chip (play/star/hash/check/bell/mail...)  {"type":"badge","icon":"play","slot":"l1"}
  ransom       ransom-note letters                          {"type":"ransom","text":"WHY","slot":"l1"}
  chart        textured bar chart                           {"type":"chart","rows":[{"label":"..","value":42}],"slot":"band"}
  counter, list, timeline, callout, stamp, lower_third also work

LAYOUTS (names usable in EDIT.json)
  numeral_collage  giant numeral behind a centre cut-out, notes either side, small cut-outs low-left/right
  strip_hero       strip title + sub-line, ONE big cut-out, notes either side
  desk_collage     title strip, five cut-outs scattered around a circle/block, arrows + loops between them
  chart_grid       serif title with sub-line, bar chart band
  framed_portrait  gilt-framed portrait with a name/role lower-third (use bg "chalk")
  wide_cutout      wide halftone building/panorama with two colour blocks and a title top-left

AVOID  dark cinematic grading, letterbox, neon, sticker outlines, vector pills, more than one spot colour,
       colour photos shown un-halftoned next to halftone ones, centred layout for every scene
"""

NAME = "documentary"
ALIASES = ["vox", "vox_documentary", "paper", "collage"]

_NEG = ("no colour photograph, no 3D render, no cinematic film look, no neon, no cartoon, no watermark, "
        "no text, no letters, no numbers, no UI, no frames, no borders, no drop shadow, no background scenery")

STYLE = {
    "look": {
        # surfaces: crumpled white paper by default; scenes can ask for grid / kraft / chalk / mat
        "bg": (244, 240, 230), "bg_kind": "crumple", "crumple_base": (247, 246, 242), "vig": 0.06,
        "ink": (24, 22, 20), "muted": (112, 106, 98),
        # ONE spot colour per scene: orange = action, mustard = fact, navy = number
        "accent": (236, 102, 36), "accent2": (247, 196, 36), "accent3": (27, 56, 128),
        "panel": (250, 247, 238, 240), "stamp_color": (236, 102, 36), "string_color": (24, 22, 20),
        # captions: mustard plate, dark ink (matches the Hindi explainer reference)
        "caption": "plate",
        # cut-outs: archival prints with clean photographic edges + 2-tier natural depth shadows
        "asset_frame": "clean", "photo_frame": "torn",
        "halftone": "bw", "photo_halftone": "bw", "dot": 7, "print_paper": (250, 247, 238),
        "ground": False, "jitter": False,                # stably positioned cut-outs
        "label_style": "note",                          # asset labels are thin paper notes
        "title_box": "strip", "title_font": "serif", "big_font": "serif",
        "letterbox": 0.0, "grade": "", "grain": 2, "vignette": False,
        "transition": "slide", "camera": "drift", "paper": True,
        "kicker_prefix": "",
        "boxes": ["highlighter", "strip", "note", "marker", "torn", "tag"],
    },
    "prompt": {
        "clarity": (
            "ONE dominant subject with a clean, crisp silhouette that can be cut out, high-contrast black-and-white "
            "photograph with deep blacks and bright highlights, simple even studio lighting, no background clutter, "
            "no cast shadow, newsprint-ready tonal range"
        ),
        "medium": "high-contrast black-and-white archival photograph, editorial paper-collage source image",
        "lighting": "flat even documentary light, soft fill, no dramatic shadows",
        "palette": "pure black-and-white tonal range with rich greys (the engine adds ONE spot colour later)",
        "camera": {"shot": "medium shot", "lens": "50mm", "angle": "straight-on",
                   "movement": "none"},
        "mood": "clear, curious, informative, editorial",
        "quality": "crisp edges, high micro-contrast, fine film grain, archive-grade clarity",
        "negative": _NEG,
        "asset_medium": ("isolated high-contrast black-and-white archival photograph, crisp clean silhouette, "
                         "even studio-flat lighting, no shadow, ready to be cut out and halftoned"),
    },
}

CENTERED = {"numeral_collage", "strip_hero", "desk_collage", "chart_grid", "framed_portrait", "doc_highlight", "split_compare"}

LAYOUTS_16_9 = {
    # 1925 / 1927: giant numeral (back) behind the centre cut-out; notes either side; small cut-outs low
    "numeral_collage": {
        "tag": (0.06, 0.06, 0.40, 0.04),
        "back": (0.12, 0.10, 0.76, 0.60),
        "center": (0.32, 0.10, 0.36, 0.66),
        "left": (0.05, 0.46, 0.24, 0.30), "right": (0.71, 0.46, 0.24, 0.30),
        "l1": (0.04, 0.30, 0.25, 0.10), "r1": (0.71, 0.30, 0.25, 0.10),
    },
    # Document Zoom / Headline with yellow highlighter zone
    "doc_highlight": {
        "tag": (0.06, 0.05, 0.40, 0.04),
        "title": (0.15, 0.09, 0.70, 0.16),
        "center": (0.18, 0.27, 0.64, 0.48),
        "l1": (0.04, 0.42, 0.12, 0.10),
    },
    # Giant Stat numeral with source note on left, archival cutout right
    "stat_hero": {
        "tag": (0.06, 0.07, 0.45, 0.04),
        "back": (0.06, 0.13, 0.45, 0.38),
        "l1": (0.06, 0.53, 0.45, 0.12),
        "right": (0.54, 0.11, 0.40, 0.62),
    },
    # Side-by-side archival split comparison
    "split_compare": {
        "tag": (0.06, 0.06, 0.88, 0.04),
        "title": (0.06, 0.11, 0.88, 0.12),
        "left": (0.06, 0.25, 0.42, 0.44),
        "right": (0.52, 0.25, 0.42, 0.44),
        "l1": (0.06, 0.70, 0.42, 0.055),
        "r1": (0.52, 0.70, 0.42, 0.055),
    },
    # Porsche 356: strip title with sub-line, one big cut-out
    "strip_hero": {
        "tag": (0.06, 0.035, 0.30, 0.03),
        "title": (0.14, 0.07, 0.72, 0.17),
        "center": (0.22, 0.27, 0.56, 0.49),
        "l1": (0.03, 0.34, 0.18, 0.10), "r1": (0.79, 0.34, 0.18, 0.10),
        "l2": (0.03, 0.52, 0.18, 0.10), "r2": (0.79, 0.52, 0.18, 0.10),
    },
    # Higgs + Claude / hands collage: strip title, five cut-outs round a circle/block, arrows + loops
    "desk_collage": {
        "title": (0.20, 0.05, 0.60, 0.12),
        "back": (0.30, 0.17, 0.40, 0.60),
        "a": (0.03, 0.20, 0.26, 0.34), "d": (0.05, 0.56, 0.24, 0.20),
        "b": (0.34, 0.20, 0.32, 0.56),
        "c": (0.71, 0.20, 0.26, 0.34), "e": (0.71, 0.56, 0.26, 0.20),
    },
    # bar chart on graph paper
    "chart_grid": {
        "tag": (0.07, 0.06, 0.40, 0.04),
        "title": (0.07, 0.11, 0.86, 0.17),
        "band": (0.07, 0.31, 0.86, 0.44),
    },
    # Einstein: gilt-framed portrait on a chalkboard, name + role beneath
    "framed_portrait": {
        "tag": (0.06, 0.06, 0.26, 0.04),
        "center": (0.34, 0.07, 0.32, 0.58),
        "lower": (0.28, 0.66, 0.44, 0.09),
        "l1": (0.04, 0.12, 0.26, 0.10), "r1": (0.70, 0.12, 0.26, 0.10),
    },
    # Capitol: wide halftone panorama with two colour blocks, small title top-left
    "wide_cutout": {
        "title": (0.06, 0.05, 0.52, 0.08),
        "back": (0.34, 0.12, 0.60, 0.40),
        "back2": (0.05, 0.58, 0.38, 0.14),
        "center": (0.08, 0.15, 0.84, 0.50),
        "l1": (0.62, 0.67, 0.30, 0.07),
    },
}
LAYOUTS_9_16 = {
    "doc_highlight": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "title": (0.07, 0.105, 0.86, 0.13),
        "center": (0.08, 0.25, 0.84, 0.42),
    },
    "stat_hero": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "back": (0.08, 0.11, 0.84, 0.22),
        "l1": (0.08, 0.34, 0.84, 0.08),
        "center": (0.12, 0.44, 0.76, 0.24),
    },
    "split_compare": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "title": (0.07, 0.105, 0.86, 0.10),
        "left": (0.10, 0.22, 0.80, 0.22),
        "right": (0.10, 0.46, 0.80, 0.22),
    },
    "numeral_collage": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "back": (0.04, 0.12, 0.92, 0.32),
        "center": (0.18, 0.12, 0.64, 0.46),
        "l1": (0.04, 0.60, 0.44, 0.07), "r1": (0.52, 0.60, 0.44, 0.07),
    },
    "strip_hero": {
        "tag": (0.07, 0.045, 0.86, 0.03),
        "title": (0.05, 0.085, 0.90, 0.15),
        "center": (0.10, 0.25, 0.80, 0.38),
        "l1": (0.04, 0.64, 0.44, 0.05), "r1": (0.52, 0.64, 0.44, 0.05),
    },
    "desk_collage": {
        "title": (0.05, 0.07, 0.90, 0.12),
        "back": (0.20, 0.20, 0.60, 0.44),
        "a": (0.04, 0.21, 0.44, 0.20), "b": (0.52, 0.21, 0.44, 0.20),
        "c": (0.04, 0.43, 0.44, 0.20), "d": (0.52, 0.43, 0.44, 0.20),
    },
    "chart_grid": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "title": (0.07, 0.11, 0.86, 0.14),
        "band": (0.07, 0.28, 0.86, 0.40),
    },
    "framed_portrait": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "center": (0.14, 0.11, 0.72, 0.46),
        "lower": (0.10, 0.59, 0.80, 0.07),
    },
    "wide_cutout": {
        "title": (0.06, 0.06, 0.88, 0.09),
        "back": (0.26, 0.17, 0.70, 0.26),
        "back2": (0.04, 0.44, 0.50, 0.08),
        "center": (0.04, 0.22, 0.92, 0.36),
    },
}

RECIPES = {
    # 1925-style: giant numeral behind a halftone figure, notes either side
    "numeral_collage": {
        "layout": "numeral_collage", "bg": "white", "accent2": "#F5BC3B",
        "items": [
            {"type": "bigtext", "text": "1925", "slot": "back", "color": "accent2", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_FIGURE", "slot": "center", "at": "WORD", "halftone": "bw", "ground": True},
            {"type": "note", "text": "वो अकेली न्यूयॉर्क पहुँची", "slot": "l1", "at": "WORD"},
            {"type": "note", "text": "तीन हफ़्ते का सफ़र", "slot": "r1", "at": "WORD"},
        ],
    },
    # Porsche-style: strip headline + serif sub-line + one cut-out
    "strip_card": {
        "layout": "strip_hero", "bg": "grid",
        "items": [
            {"type": "title", "text": "पोर्श *356*", "sub": "लॉन्च के वक़्त क़ीमत थी $3,750", "box": "strip", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_CAR", "slot": "center", "at": "WORD", "halftone": "spot", "spot": "accent3"},
            {"type": "note", "text": "1948", "slot": "l1", "at": "WORD"},
        ],
    },
    # Higgs-style desk: circle block behind the hero, cut-outs around, arrows between
    "desk_collage": {
        "layout": "desk_collage", "bg": "paper",
        "items": [
            {"type": "title", "text": "एक *नया* तरीक़ा", "box": "strip", "at": "WORD"},
            {"type": "block", "shape": "circle", "color": "accent2", "slot": "back", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_HERO", "slot": "b", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_A", "slot": "a", "at": "WORD", "frame": "torn"},
            {"type": "asset", "name": "CUTOUT_C", "slot": "c", "at": "WORD", "frame": "torn"},
            {"type": "arrow", "from": "a", "to": "b", "at": "WORD", "color": "ink"},
            {"type": "arrow", "from": "c", "to": "b", "at": "WORD", "color": "accent", "bend": -0.25},
        ],
    },
    # hands-collage: B&W cut-outs, pen loops between them
    "pen_loops": {
        "layout": "desk_collage", "bg": "white",
        "items": [
            {"type": "asset", "name": "CUTOUT_A", "slot": "a", "frame": "torn", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_B", "slot": "b", "frame": "torn", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_C", "slot": "c", "frame": "torn", "at": "WORD"},
            {"type": "loops", "from": "a", "to": "c", "loops": 3, "color": "ink", "at": "WORD"},
            {"type": "ransom", "text": "WHY?", "slot": "d", "at": "WORD"},
        ],
    },
    # bar chart on graph paper
    "bar_chart": {
        "layout": "chart_grid", "bg": "grid",
        "items": [
            {"type": "kicker", "text": "DATA // 1930s"},
            {"type": "title", "text": "तीस के दशक में अर्थव्यवस्था *कैसे* बदली", "box": "plain",
             "sub": "स्रोत: ऐतिहासिक आँकड़े", "lines": 2},
            {"type": "chart", "slot": "band", "color": "accent3", "suffix": "%", "rows": [
                {"label": "बेरोज़गारी", "value": 25, "at": "WORD_1"},
                {"label": "बंद हुए बैंक", "value": 15, "at": "WORD_2"},
                {"label": "बैंकों की बढ़त", "value": 19, "at": "WORD_3"}]},
        ],
    },
    # gilt-framed portrait on chalkboard
    "framed_portrait": {
        "layout": "framed_portrait", "bg": "chalk",
        "items": [
            {"type": "photo", "src": "PORTRAIT", "frame": "gilt", "slot": "center", "at": "WORD", "halftone": False},
            {"type": "lower_third", "text": "अल्बर्ट आइंस्टीन", "sub": "दार्शनिक · भौतिक विज्ञानी", "slot": "lower", "at": "WORD"},
            {"type": "note", "text": "E = mc²", "slot": "l1", "at": "WORD"},
        ],
    },
    # Capitol-style: wide halftone building + orange blocks (glitch edge)
    "wide_blocks": {
        "layout": "wide_cutout", "bg": "paper", "accent": "#F26B1D",
        "items": [
            {"type": "block", "shape": "rect", "color": "accent", "slot": "back", "glitch": True, "at": "WORD"},
            {"type": "block", "shape": "rect", "color": "accent", "slot": "back2", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_BUILDING", "slot": "center", "at": "WORD", "frame": "cutout", "ground": False},
            {"type": "title", "text": "सत्ता का *केंद्र*", "box": "strip", "at": "WORD"},
        ],
    },
    # Pinned Polaroid with 3D pushpin on antique map/grid
    "polaroid_pin": {
        "layout": "stat_hero", "bg": "grid",
        "items": [
            {"type": "kicker", "text": "ARCHIVE // EVIDENCE"},
            {"type": "photo", "src": "POLAROID_DOC", "frame": "torn", "slot": "right", "at": "WORD"},
            {"type": "keyword", "text": "फ़ाइल #402", "box": "tag", "slot": "l1", "at": "WORD"},
            {"type": "note", "text": "खुफ़िया दस्तावेज़", "slot": "tag", "at": "WORD"},
        ],
    },
    # Architecture cutout layered over giant burnt-orange / red background orb
    "arch_orb": {
        "layout": "strip_hero", "bg": "paper", "accent": "#E65100",
        "items": [
            {"type": "block", "shape": "circle", "color": "accent", "slot": "center", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_MONUMENT", "slot": "center", "frame": "clean", "at": "WORD"},
            {"type": "title", "text": "इतिहास का *गवाह*", "box": "highlighter", "at": "WORD"},
        ],
    },
    # Tilted seesaw comparing two entities/metrics
    "seesaw_compare": {
        "layout": "split_compare", "bg": "paper",
        "items": [
            {"type": "title", "text": "बड़ा *असंतुलन*", "box": "strip", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_LEFT", "slot": "left", "label": "1.8x", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_RIGHT", "slot": "right", "label": "3.1x", "at": "WORD"},
        ],
    },
    # Halftone projection light cone from TV / screen across subject
    "light_cone": {
        "layout": "strip_hero", "bg": "paper", "accent2": "#FFB300",
        "items": [
            {"type": "title", "text": "टेलीविज़न: *प्रचार का साधन*", "box": "highlighter", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_TV_SCENE", "slot": "center", "at": "WORD"},
            {"type": "note", "text": "1960s BROADCAST", "slot": "l1", "at": "WORD"},
        ],
    },
    # Archival document quote with live left-to-right yellow chisel-tip marker sweep
    "highlight_sweep": {
        "layout": "stat_hero", "bg": "paper",
        "items": [
            {"type": "kicker", "text": "DECLASSIFIED // QUOTE"},
            {"type": "highlight_sweep", "text": "सत्ता केवल बंदूक से नहीं, सूचना के नियंत्रण से चलती है।", "slot": "title", "at": "WORD"},
            {"type": "asset", "name": "CUTOUT_DOCUMENT", "slot": "right", "at": "WORD"},
        ],
    },
}

EXAMPLES = [
    "giant numeral behind a figure: RECIPES['numeral_collage']",
    "strip headline + sub-line + cut-out: RECIPES['strip_card']",
    "circle + cut-outs + arrows: RECIPES['desk_collage']",
    "pen loops between cut-outs: RECIPES['pen_loops']",
    "textured bar chart: RECIPES['bar_chart']",
    "gilt-framed portrait: RECIPES['framed_portrait']",
    "colour blocks + panorama: RECIPES['wide_blocks']",
    "pinned polaroid on archival grid: RECIPES['polaroid_pin']",
    "architecture with giant background color orb: RECIPES['arch_orb']",
    "seesaw comparison balance: RECIPES['seesaw_compare']",
    "light cone projection sweep: RECIPES['light_cone']",
]

# ---- asset plan: what a Vox collage needs --------------------------------------------------------------
# ~45% of beats are isolated cut-outs (halftoned by the engine), ~25% are archival photos shown as torn prints,
# ~20% are text/graphic beats (giant numeral, note, chart, strip title) that need NO generated image.
BEAT_S = 1.1
MIX = {"scene": 0.35, "asset": 0.50, "reuse": 0.05, "text": 0.10}
MENU = {
    "scene": ["archival street / crowd photograph", "interior room photograph", "landscape / place photograph",
              "group portrait", "action moment (hands, working, marching)", "wide panorama (skyline, harbour, fort)",
              "antique archival map with highlighted neon boundaries", "retro TV projection room with light cone"],
    "asset": ["person portrait, torso, facing camera", "person full-length, walking", "object on its own (tool, vehicle, machine)",
              "map of a place", "newspaper clipping / document / letter", "building or monument", "hands holding something (camera, magnifying glass)",
              "giant open palm holding city architecture", "businessman tightrope walker with briefcase", "server rack with snaking power cables",
              "animal / plant", "coin / medal / jewel", "flag / emblem / seal", "clock / calendar / date page", "crowd cut-out"],
}
ACCENTS = ["one mustard-yellow object", "one navy-blue object", "one orange object", "no colour: pure black and white"]

DESIGN = __doc__
