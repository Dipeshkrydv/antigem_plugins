# -*- coding: utf-8 -*-
"""Style packs: ONE place that defines how a style looks on screen AND how its
images are prompted. The renderer (core/engine/render.py) and the prompt engine
(core/prompt_engine.py) both read from here, so visuals and prompts never drift apart.

Each pack:
  look      colours, fonts, caption style, asset frame, finishing (grade/grain/vignette)
  prompt    defaults the prompt engine uses when a shot leaves a field empty
"""

FONT_FILES = {
    # role -> (latin file, devanagari file)   paths relative to the studio fonts/ folder
    # Multi-font creative typography hierarchy across Latin & Unicode Devanagari
    "display": ("english/Anton-Regular.ttf", "hindi/Khand-Bold.ttf"),
    "headline": ("english/Metropolis-Bold.otf", "hindi/Khand-Bold.ttf"),
    "body": ("english/Montserrat-Bold.ttf", "hindi/NotoSansDevanagari-VF.ttf@600"),
    "caption": ("english/Montserrat-Bold.ttf", "hindi/Baloo2-Bold.ttf"),
    "sub": ("english/Lora-Bold.ttf", "hindi/NotoSerifDevanagari-VF.ttf@600"),
    "mono": ("english/SpaceMono-Bold.ttf", "hindi/Khand-Bold.ttf"),
    "hand": ("Kalam-Bold.ttf", "Kalam-Bold.ttf"),              # handwriting (Latin + Devanagari)
    # serif for magazine / Vox headlines. Hindi uses Noto Serif Devanagari (variable font, @weight)
    "serif": ("english/PlayfairDisplay-Bold.ttf", "hindi/NotoSerifDevanagari-VF.ttf@700"),
    "serif_reg": ("english/NotoSerif-Regular.ttf", "hindi/NotoSerifDevanagari-VF.ttf@500"),
    "round": ("hindi/Baloo2-ExtraBold.ttf", "hindi/Baloo2-ExtraBold.ttf"),
    "vintage": ("english/PlayfairDisplay-Bold.ttf", "hindi/YatraOne-Regular.ttf"),
    "impact": ("english/Anton-Regular.ttf", "hindi/Khand-Bold.ttf"),
    "cinema": ("english/TheGodfather.TTF", "hindi/YatraOne-Regular.ttf"),
    "futuristic": ("english/Aquawax-Black.ttf", "hindi/Khand-Bold.ttf"),
    "sticker_pop": ("hindi/Baloo2-ExtraBold.ttf", "hindi/Baloo2-ExtraBold.ttf"),
}

_NEG = ("no text, no letters, no captions, no watermark, no logo, no signature, no UI, "
        "no borders, no frames, no split screen, no collage")

STYLES = {
    # ---------------------------------------------------------------- crime / noir documentary
    "noir": {
        "look": {
            "bg": (12, 13, 17), "ink": (236, 232, 222), "muted": (150, 146, 138),
            "accent": (215, 38, 61), "accent2": (242, 165, 65), "panel": (16, 17, 22, 215),
            "caption": "cinema", "asset_frame": "clean", "photo_frame": "polaroid",
            "stamp_color": (205, 38, 48), "string_color": (196, 30, 45),
            "letterbox": 0.075, "grade": "eq=contrast=1.07:saturation=0.86:gamma=0.97",
            "grain": 4, "vignette": True, "transition": "dip", "camera": "push_in",
            "kicker_prefix": "CASE FILE", "title_font": "display",
            "boxes": ["label", "pill", "torn", "marker", "neon"], "accent3": (120, 170, 210),
        },
        "prompt": {
            "clarity": "one dominant focal subject, minimal uncluttered background, strong silhouette and rim light, one bold blood-red or amber accent against dark tones, clean dark negative space for a Hindi headline",
            "medium": "cinematic photoreal historical film still, matte-painting detail",
            "lighting": "low-key chiaroscuro, hard practical light sources, deep crushed shadows, volumetric haze",
            "palette": "desaturated teal-blue shadows, warm amber practical highlights, touches of blood red",
            "camera": {"shot": "wide establishing shot", "lens": "35mm anamorphic", "angle": "eye level",
                       "movement": "slow dolly push-in"},
            "mood": "tense, ominous, investigative",
            "quality": "35mm film grain, high dynamic range, ultra detailed, sharp focus on subject",
            "negative": _NEG,
            "asset_medium": "photoreal museum-archive product photograph",
        },
    },
    # ---------------------------------------------------------------- general cinematic film look
    "cinematic": {
        "look": {
            "bg": (10, 12, 16), "ink": (245, 243, 238), "muted": (170, 170, 170),
            "accent": (243, 186, 47), "accent2": (90, 170, 255), "panel": (10, 12, 16, 200),
            "caption": "cinema", "asset_frame": "clean", "photo_frame": "print",
            "stamp_color": (243, 186, 47), "string_color": (243, 186, 47),
            "letterbox": 0.10, "grade": "eq=contrast=1.06:saturation=1.05",
            "grain": 3, "vignette": True, "transition": "fade", "camera": "drift",
            "kicker_prefix": "CHAPTER", "title_font": "display",
            "boxes": ["pill", "neon", "outline", "marker"], "accent3": (240, 240, 240),
        },
        "prompt": {
            "clarity": "one dominant focal subject, minimal uncluttered background, strong silhouette, one bold warm accent colour, clean negative space for a Hindi headline",
            "medium": "cinematic photoreal film still, shot on ARRI Alexa",
            "lighting": "motivated natural light, soft key with strong rim light, atmospheric haze",
            "palette": "teal and orange grade, rich contrast, natural skin tones",
            "camera": {"shot": "wide shot", "lens": "35mm anamorphic", "angle": "eye level",
                       "movement": "slow lateral tracking"},
            "mood": "epic, emotional, awe-inspiring",
            "quality": "shallow depth of field, ultra detailed, high dynamic range",
            "negative": _NEG,
            "asset_medium": "photoreal studio product photograph",
        },
    },
    # ---------------------------------------------------------------- Vox-style paper documentary
    "documentary": {
        "look": {
            "bg": (240, 233, 218), "ink": (34, 30, 27), "muted": (120, 110, 98),
            "accent": (217, 69, 43), "accent2": (242, 183, 5), "panel": (250, 246, 236, 240),
            "caption": "box", "asset_frame": "clean", "photo_frame": "print",
            "stamp_color": (217, 69, 43), "string_color": (217, 69, 43),
            "letterbox": 0.0, "grade": "", "grain": 2, "vignette": False,
            "transition": "slide", "camera": "drift", "paper": True,
            "kicker_prefix": "", "title_font": "headline",
            "boxes": ["marker", "torn", "tag", "sticky", "pill"], "accent3": (41, 128, 185),
        },
        "prompt": {
            "clarity": "one dominant focal subject, minimal clean composition, flat readable shapes, one bold red or yellow accent, clean paper-coloured negative space for a Hindi headline",
            "medium": "editorial collage illustration with archival photo textures, Vox explainer style",
            "lighting": "even soft light, gentle paper texture",
            "palette": "warm cream paper, ink black, signal red and mustard yellow accents",
            "camera": {"shot": "medium shot", "lens": "50mm", "angle": "straight-on", "movement": "slow push-in"},
            "mood": "clear, curious, informative",
            "quality": "clean shapes, crisp edges, print texture",
            "negative": _NEG,
            "asset_medium": "archival photograph cut-out with clean edges, muted vintage colours",
        },
    },
    # ---------------------------------------------------------------- sticker collage explainer
    "sticker": {
        "look": {
            "bg": (246, 241, 231), "ink": (22, 22, 26), "muted": (110, 110, 118),
            "accent": (255, 92, 57), "accent2": (40, 120, 255), "panel": (255, 255, 255, 245),
            "caption": "pop", "asset_frame": "sticker", "photo_frame": "sticker",
            "stamp_color": (255, 92, 57), "string_color": (22, 22, 26),
            "letterbox": 0.0, "grade": "eq=saturation=1.08", "grain": 0, "vignette": False,
            "transition": "whip", "camera": "drift", "paper": True, "doodles": True, "dots": True,
            "kicker_prefix": "", "title_font": "display",
            "boxes": ["sticky", "tag", "pill", "outline", "marker"], "accent3": (255, 196, 0),
        },
        "prompt": {
            "clarity": "one bold readable subject, thick outline, minimal shapes, one punchy accent colour, instantly understandable at thumbnail size",
            "medium": "bold vector sticker illustration, thick confident outlines, flat cel shading",
            "lighting": "flat even light, no cast shadows",
            "palette": "punchy primaries: tomato red, cobalt blue, sunflower yellow, ink black",
            "camera": {"shot": "centered hero shot", "lens": "50mm", "angle": "slight three-quarter view",
                       "movement": "none"},
            "mood": "playful, energetic, friendly",
            "quality": "clean vector edges, high contrast, readable at small size",
            "negative": _NEG,
            "asset_medium": "bold vector sticker illustration with thick dark outline",
        },
    },
    # ---------------------------------------------------------------- modern editorial box / card layout
    "box": {
        "look": {
            "bg": (17, 19, 24), "ink": (245, 245, 247), "muted": (150, 154, 165),
            "accent": (99, 102, 241), "accent2": (250, 204, 21), "panel": (28, 31, 39, 250),
            "caption": "box", "asset_frame": "card", "photo_frame": "card",
            "stamp_color": (250, 204, 21), "string_color": (99, 102, 241),
            "letterbox": 0.0, "grade": "", "grain": 0, "vignette": False,
            "transition": "slide", "camera": "drift", "grid": True,
            "kicker_prefix": "", "title_font": "headline",
            "boxes": ["pill", "label", "outline", "neon"], "accent3": (34, 197, 94),
        },
        "prompt": {
            "clarity": "one dominant focal subject, minimal premium composition, strong contrast, one electric accent colour, clean negative space for a Hindi headline",
            "medium": "premium editorial photograph",
            "lighting": "soft studio key light, clean gradients",
            "palette": "graphite, white, electric indigo accent",
            "camera": {"shot": "medium shot", "lens": "50mm", "angle": "eye level", "movement": "slow push-in"},
            "mood": "modern, confident, premium",
            "quality": "ultra sharp, minimal, generous negative space",
            "negative": _NEG,
            "asset_medium": "premium studio product photograph",
        },
    },
}
STYLES["crime"] = STYLES["noir"]


# ---- Creative style modules ------------------------------------------------
# The built-in STYLES above is a minimal safety net. The authoritative definitions
# live in styles/<name>.py -- each is a comprehensive "creative engine" for one
# style (visual language, prompt defaults, extra layouts, scene recipes).
# A style file wins over the built-in with the same name, so dropping a new
# styles/*.py into a project adds / replaces a style without touching the engine.
RECIPES = {}      # style name -> dict of named scene templates
DESIGN = {}       # style name -> free-text design/engagement notes
EXAMPLES = {}     # style name -> list of example scene JSONs
_CANON = {}       # alias -> canonical name (what list_styles() reports)
PLANS = {}        # style name -> asset plan (beat length, image mix, shot/asset menus, accents)

# How many images a video needs depends on the STYLE: a Vox collage or noir doc changes picture every ~2.5 s and
# needs a dedicated image for most beats; a kinetic-type or box/stat video is mostly typography and needs few.
#   beat_s   seconds per visual beat
#   mix      share of beats realised as: scene (full-frame image) / asset (isolated cut-out) /
#            reuse (re-framing of an existing image: camera cut, crop) / text (title, number, chart, keyword: no image)
#   menu     the shot types and asset archetypes the planner rotates through, so no two neighbours repeat
DEFAULT_MENU = {
    "scene": ["wide establishing", "medium action", "close-up", "detail insert", "over-the-shoulder", "high angle",
              "low-angle hero", "silhouette", "symbolic metaphor", "through a doorway / frame"],
    "asset": ["portrait", "document / letter / newspaper", "tool / weapon / prop", "map / diagram", "symbol / emblem / flag",
              "building / model", "book / ledger / scroll", "coin / medal / jewel", "costume / uniform piece",
              "vehicle / ship / plane", "hands holding an object", "clock / calendar / date"],
}
# Style-aware asset plans (High-density Zero-Gap Standard):
DEFAULT_PLAN = {"beat_s": 1.4, "mix": {"scene": 0.40, "asset": 0.48, "reuse": 0.04, "text": 0.08},
                "menu": DEFAULT_MENU, "accents": []}
PLANS["documentary"] = dict(DEFAULT_PLAN, beat_s=1.4, mix={"scene": 0.35, "asset": 0.50, "reuse": 0.05, "text": 0.10})
PLANS["vox"] = PLANS["documentary"]
PLANS["noir"] = dict(DEFAULT_PLAN, beat_s=1.6, mix={"scene": 0.65, "asset": 0.25, "reuse": 0.05, "text": 0.05})
PLANS["crime"] = PLANS["noir"]
PLANS["suspense"] = PLANS["noir"]
PLANS["box"] = dict(DEFAULT_PLAN, beat_s=1.5, mix={"scene": 0.30, "asset": 0.45, "reuse": 0.05, "text": 0.20})
PLANS["sticker"] = dict(DEFAULT_PLAN, beat_s=1.3, mix={"scene": 0.35, "asset": 0.55, "reuse": 0.02, "text": 0.08})
PLANS["stickman"] = PLANS["sticker"]
PLANS["stickman_hybrid"] = PLANS["sticker"]
PLANS["doodle"] = PLANS["sticker"]
PLANS["arcade"] = dict(DEFAULT_PLAN, beat_s=1.4, mix={"scene": 0.55, "asset": 0.35, "reuse": 0.05, "text": 0.05})
PLANS["cinematic"] = dict(DEFAULT_PLAN, beat_s=1.8, mix={"scene": 0.70, "asset": 0.20, "reuse": 0.05, "text": 0.05})
PLANS["cute_toon"] = dict(DEFAULT_PLAN, beat_s=1.4, mix={"scene": 0.25, "asset": 0.55, "reuse": 0.05, "text": 0.15})
PLANS["kinetic_typography"] = dict(DEFAULT_PLAN, beat_s=1.2, mix={"scene": 0.08, "asset": 0.12, "reuse": 0.0, "text": 0.80})



def plan_for(name):
    return PLANS.get(name) or DEFAULT_PLAN


def _load_style_modules():
    import importlib.util, os, traceback
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
    sdir = os.path.join(root, "styles")
    if not os.path.isdir(sdir):
        return
    import sys
    lay = sys.modules.get("layouts")           # loaded as a sibling by render.py
    if lay is None:
        try:
            from . import layouts as lay       # loaded as a package by test imports
        except Exception:
            try:
                import layouts as lay          # engine dir on sys.path
            except Exception:
                lay = None
    # Load each file BY PATH (bypassing sys.path) so the top-level name "styles"
    # cannot collide with this engine module, which is also called styles.py.
    for fn in sorted(os.listdir(sdir)):
        if not fn.endswith(".py") or fn.startswith("_"):
            continue
        mod_name = fn[:-3]
        path = os.path.join(sdir, fn)
        try:
            spec = importlib.util.spec_from_file_location(f"deepesh_style_{mod_name}", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
        except Exception:
            print(f"⚠ styles/{fn}: failed to load\n{traceback.format_exc()}")
            continue
        if not hasattr(mod, "STYLE"):
            continue
        canonical = getattr(mod, "NAME", mod_name)
        STYLES[canonical] = mod.STYLE
        _CANON[canonical] = canonical
        for alias in getattr(mod, "ALIASES", ()):
            STYLES[alias] = mod.STYLE
            _CANON[alias] = canonical
        if lay is not None:
            for lname, slots in getattr(mod, "LAYOUTS_16_9", {}).items():
                lay.L169[f"{canonical}.{lname}"] = slots
                lay.L169.setdefault(lname, slots)       # bare name also works unless taken
            for lname, slots in getattr(mod, "LAYOUTS_9_16", {}).items():
                lay.L916[f"{canonical}.{lname}"] = slots
                lay.L916.setdefault(lname, slots)
            for lname in getattr(mod, "CENTERED", ()):      # layouts whose text is centred, not left-aligned
                lay.CENTERED.update({lname, f"{canonical}.{lname}"})
        plan = dict(DEFAULT_PLAN)
        for attr, key in (("BEAT_S", "beat_s"), ("MIX", "mix"), ("MENU", "menu"), ("ACCENTS", "accents")):
            if hasattr(mod, attr):
                plan[key] = getattr(mod, attr)
        # recipes / docs are stored under canonical AND every alias so lookup works both ways
        for k in [canonical, *getattr(mod, "ALIASES", ())]:
            PLANS[k] = plan
            if hasattr(mod, "RECIPES"):
                RECIPES[k] = mod.RECIPES
            if hasattr(mod, "DESIGN"):
                DESIGN[k] = mod.DESIGN
            if hasattr(mod, "EXAMPLES"):
                EXAMPLES[k] = mod.EXAMPLES


_load_style_modules()


def get(name):
    if name not in STYLES:
        raise SystemExit(f"unknown style {name!r}; choose one of: {', '.join(sorted(set(STYLES)))}")
    return STYLES[name]


def list_styles():
    """Returns [(canonical_name, aliases_list), ...] in a stable order.
    Canonical is the module's declared NAME when known, else the shortest alias."""
    canon = {}
    for n, s in STYLES.items():
        canon.setdefault(id(s), []).append(n)
    out = []
    for names in canon.values():
        head = next((n for n in names if _CANON.get(n) == n), min(names, key=len))
        out.append((head, sorted(x for x in names if x != head)))
    return sorted(out)
