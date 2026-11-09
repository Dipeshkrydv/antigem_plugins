# -*- coding: utf-8 -*-
"""layouts.py: slot-based scene layouts.

Every layout is a set of NAMED, NON-OVERLAPPING rectangles (normalised x, y, w, h).
Items are placed into slots, never at free coordinates, which is what guarantees:
  * a stamp can never land on top of an asset (the old SCIENCE-on-cloud bug)
  * text never runs under a picture or off-screen
  * the caption band is reserved in EVERY layout, so captions are always readable
If two items want the same slot at the same time, the later one REPLACES the
earlier one (the earlier one exits) -- a clean editorial "swap", not a pile-up.

Run `python core/engine/layouts.py` to self-check that no layout has overlapping slots.
"""

# ---------------------------------------------------------------- 16:9 (1920x1080)
L169 = {
    # text column on the left, hero visual on the right
    "hero": {
        "tag": (0.06, 0.085, 0.50, 0.05), "title": (0.06, 0.145, 0.50, 0.24),
        "label": (0.06, 0.405, 0.50, 0.085), "stamp": (0.06, 0.495, 0.36, 0.175),
        "lower": (0.06, 0.685, 0.48, 0.085),
        "right": (0.60, 0.11, 0.34, 0.62),
    },
    # mirror of hero: visual left, text right
    "hero_r": {
        "tag": (0.50, 0.085, 0.44, 0.05), "title": (0.50, 0.145, 0.44, 0.24),
        "label": (0.50, 0.405, 0.44, 0.085), "stamp": (0.50, 0.495, 0.36, 0.165),
        "lower": (0.50, 0.665, 0.44, 0.095),
        "left": (0.06, 0.11, 0.38, 0.62),
    },
    # two visuals facing each other, headline on top
    "duo": {
        "tag": (0.06, 0.07, 0.88, 0.045), "title": (0.06, 0.12, 0.88, 0.12),
        "left": (0.07, 0.27, 0.38, 0.44), "right": (0.55, 0.27, 0.38, 0.44),
        "label": (0.30, 0.715, 0.40, 0.06),
    },
    # three visuals in a row, each with its own label strip
    "trio": {
        "tag": (0.06, 0.07, 0.88, 0.045), "title": (0.06, 0.12, 0.88, 0.11),
        "a": (0.05, 0.26, 0.27, 0.40), "b": (0.365, 0.26, 0.27, 0.40), "c": (0.68, 0.26, 0.27, 0.40),
        "la": (0.05, 0.67, 0.27, 0.06), "lb": (0.365, 0.67, 0.27, 0.06), "lc": (0.68, 0.67, 0.27, 0.06),
    },
    # evidence board: pinned items scattered, connected with string
    "board": {
        "tag": (0.06, 0.06, 0.30, 0.045),
        "a": (0.05, 0.13, 0.25, 0.36), "b": (0.375, 0.10, 0.25, 0.34), "c": (0.70, 0.13, 0.25, 0.36),
        "d": (0.22, 0.51, 0.23, 0.25), "e": (0.55, 0.50, 0.23, 0.26),
        "stamp": (0.80, 0.55, 0.16, 0.16), "label": (0.80, 0.715, 0.16, 0.055),
    },
    # one object centre stage, annotated by callouts on both sides
    "focus": {
        "tag": (0.06, 0.07, 0.88, 0.045),
        "center": (0.34, 0.12, 0.32, 0.62),
        "l1": (0.05, 0.18, 0.26, 0.10), "l2": (0.05, 0.40, 0.26, 0.10),
        "r1": (0.69, 0.18, 0.26, 0.10), "r2": (0.69, 0.40, 0.26, 0.10),
        "stamp": (0.71, 0.56, 0.24, 0.14),
    },
    # big statement / quote card
    "quote": {
        "tag": (0.10, 0.20, 0.80, 0.05), "title": (0.10, 0.27, 0.80, 0.34),
        "label": (0.10, 0.63, 0.80, 0.08),
    },
    # list panel on the right (box style), picture keeps the left side
    "split": {
        "tag": (0.58, 0.10, 0.36, 0.05), "title": (0.58, 0.16, 0.36, 0.16),
        "list": (0.58, 0.34, 0.36, 0.38), "left": (0.06, 0.12, 0.46, 0.60),
    },
    # timeline band
    "timeline": {
        "tag": (0.06, 0.08, 0.88, 0.05), "title": (0.06, 0.14, 0.88, 0.16),
        "band": (0.06, 0.40, 0.88, 0.26),
    },
    # nothing but the picture (and captions)
    "clean": {"tag": (0.06, 0.085, 0.60, 0.05), "stamp": (0.70, 0.08, 0.24, 0.15)},
    # ---- character mode (v3): a documentary beat with the cartoon host beside it
    "presenter": {
        "tag": (0.06, 0.075, 0.50, 0.06), "title": (0.06, 0.145, 0.50, 0.20),
        "left": (0.06, 0.36, 0.50, 0.40), "cast": (0.60, 0.08, 0.37, 0.685),
    },
    "presenter_l": {
        "cast": (0.03, 0.08, 0.37, 0.685), "tag": (0.44, 0.075, 0.50, 0.06),
        "title": (0.44, 0.145, 0.50, 0.20), "right": (0.44, 0.36, 0.50, 0.40),
    },
    # full character scene: parallax world, the character walks / talks / acts across the whole width
    "stage": {
        "tag": (0.06, 0.06, 0.50, 0.055), "label": (0.06, 0.125, 0.60, 0.065),
        "cast": (0.03, 0.20, 0.94, 0.565),
    },
}
CAPTION_169 = (0.10, 0.775, 0.80, 0.135)

# ---------------------------------------------------------------- 9:16 (1080x1920)
L916 = {
    "hero": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.13),
        "right": (0.06, 0.245, 0.88, 0.30), "label": (0.07, 0.55, 0.86, 0.045),
        "stamp": (0.50, 0.60, 0.43, 0.095), "lower": (0.07, 0.60, 0.40, 0.095),
    },
    "duo": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.12),
        "left": (0.03, 0.245, 0.46, 0.34), "right": (0.51, 0.245, 0.46, 0.34),
        "label": (0.07, 0.60, 0.86, 0.05),
    },
    "trio": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.10),
        "a": (0.03, 0.215, 0.46, 0.225), "b": (0.51, 0.215, 0.46, 0.225), "c": (0.27, 0.445, 0.46, 0.215),
        "la": (0.03, 0.665, 0.30, 0.03), "lb": (0.35, 0.665, 0.30, 0.03), "lc": (0.67, 0.665, 0.30, 0.03),
    },
    "board": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "a": (0.04, 0.11, 0.45, 0.23), "b": (0.51, 0.14, 0.45, 0.23), "c": (0.04, 0.37, 0.45, 0.23),
        "d": (0.51, 0.40, 0.45, 0.21), "stamp": (0.30, 0.625, 0.40, 0.065), "e": (0.0, 0.0, 0.0, 0.0),
        "label": (0.03, 0.625, 0.25, 0.065),
    },
    "focus": {
        "tag": (0.07, 0.07, 0.86, 0.03), "center": (0.12, 0.17, 0.76, 0.37),
        "l1": (0.04, 0.105, 0.44, 0.055), "r1": (0.52, 0.105, 0.44, 0.055),
        "l2": (0.04, 0.55, 0.44, 0.055), "r2": (0.52, 0.55, 0.44, 0.055), "stamp": (0.30, 0.615, 0.40, 0.075),
    },
    "quote": {"tag": (0.08, 0.26, 0.84, 0.03), "title": (0.08, 0.30, 0.84, 0.24), "label": (0.08, 0.56, 0.84, 0.07)},
    "split": {"tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.10),
              "left": (0.05, 0.215, 0.90, 0.25), "list": (0.07, 0.48, 0.86, 0.21)},
    "timeline": {"tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.12), "band": (0.05, 0.28, 0.90, 0.34)},
    "clean": {"tag": (0.07, 0.07, 0.86, 0.03), "stamp": (0.30, 0.62, 0.40, 0.07)},
}
L916["presenter"] = {
    "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.11),
    "left": (0.06, 0.225, 0.88, 0.22), "cast": (0.08, 0.455, 0.84, 0.235),
}
L916["presenter_l"] = {
    "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.11),
    "right": (0.06, 0.225, 0.88, 0.22), "cast": (0.08, 0.455, 0.84, 0.235),
}
L916["stage"] = {"tag": (0.07, 0.07, 0.86, 0.03), "label": (0.07, 0.105, 0.86, 0.05), "cast": (0.03, 0.165, 0.94, 0.525)}
L916["hero_r"] = L916["hero"]
CAPTION_916 = (0.07, 0.70, 0.86, 0.10)   # stays above the Reels/TikTok bottom UI

# which slots an item type tries, in order, when it doesn't name one
PREFER = {
    "kicker": ["tag"], "title": ["title"], "quote": ["title"], "keyword": ["label", "l1", "r1", "l2", "r2", "la", "lb", "lc"],
    "counter": ["stamp", "label", "title", "r2", "l2"], "stamp": ["stamp", "lower"], "lower_third": ["lower", "label"],
    "asset": ["right", "left", "center", "a", "b", "c", "d", "e"], "photo": ["right", "left", "center", "a", "b", "c", "d", "e"],
    "callout": ["l1", "r1", "l2", "r2"], "list": ["list"], "timeline": ["band"], "redact": ["label", "title"],
    # collage items (Vox / sticker styles)
    "bigtext": ["back"], "block": ["back"], "chart": ["band", "center"], "badge": ["l1", "r1"],
    "ransom": ["l1", "label", "r1"], "note": ["l1", "r1", "l2", "r2"],
    "character": ["cast"],
    "bento_card": ["right", "left", "center", "main", "a", "b", "c"],
    "stat_card": ["right", "left", "center", "main", "a", "b", "c"],
    "speech_bubble": ["bubble", "l1", "r1", "label", "title", "right", "left"],
    "thought_bubble": ["bubble", "l1", "r1", "label", "title", "right", "left"],
    "highlight_sweep": ["title", "center", "main", "right", "left"],
}

# layouts whose text is centred rather than left-aligned (style files add theirs via CENTERED = {...})
CENTERED = {"duo", "trio", "quote", "timeline"}

# Slots named back / back2 / ... are BACKDROP layers (giant numerals, colour blocks, circles): they sit
# behind the cut-outs on purpose, so they are allowed to overlap other slots.
def is_backdrop(slot_name):
    return slot_name.startswith("back")


def table(aspect):
    return (L916, CAPTION_916) if aspect == "9:16" else (L169, CAPTION_169)


def overlaps(a, b, eps=0.002):
    return (a[0] < b[0] + b[2] - eps and b[0] < a[0] + a[2] - eps and
            a[1] < b[1] + b[3] - eps and b[1] < a[1] + a[3] - eps)


def selfcheck():
    bad = 0
    for aspect in ("16:9", "9:16"):
        tab, cap = table(aspect)
        for name, slots in tab.items():
            items = [(k, v) for k, v in slots.items() if v[2] > 0] + [("caption", cap)]
            for i in range(len(items)):
                for j in range(i + 1, len(items)):
                    if is_backdrop(items[i][0]) or is_backdrop(items[j][0]):
                        continue
                    if overlaps(items[i][1], items[j][1]):
                        bad += 1
                        print(f"✗ {aspect} {name}: {items[i][0]} overlaps {items[j][0]}")
    print("layouts ok" if not bad else f"{bad} overlaps")
    return bad == 0


if __name__ == "__main__":
    import sys
    sys.modules["layouts"] = sys.modules["__main__"]     # so style files register into THIS module, then check them too
    sys.path.insert(0, __file__.rsplit("/", 1)[0])
    import styles  # noqa: F401  (registers the style-specific layouts)
    raise SystemExit(0 if selfcheck() else 1)
