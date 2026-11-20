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
AUTO_MARK = "auto_edit"          # EDIT.json files we generated carry "generator": AUTO_MARK
# names used only by the bundled sample project (templates/v2) -- never valid in a user's video
TEMPLATE_NAMES = {"bg_kot_night", "ct_khukuri", "ct_musket", "ct_royal_seal", "ct_oil_lamp", "ct_scroll",
                  "vid_kot_dawn", "sheet_evidence_1"}
PROC_BGS = {"paper", "grid", "mat", "chalk", "auto", "stage", "board", "dark", "noir", "plain", "cream",
            "white", "crumple", "kraft"}


def norm_line(v):
    """Normalise a voice-line id so 1, "1", "01", "L01", "line_01" all compare equal."""
    if v is None:
        return None
    t = str(v).strip()
    m = re.search(r"(\d+)$", t)
    return str(int(m.group(1))) if m else t.lower()


def _image_on_disk(name):
    for base in ("elements/cut", "elements/raw", "elements", "backgrounds"):
        for ext in ("", ".png", ".jpg", ".jpeg", ".webp"):
            if os.path.isfile(os.path.join(base, f"{name}{ext}")):
                return True
    return False


def _final_names():
    """prompt_engine renames duplicate shot names; BEATS.json/ELEMENTS.tsv hold the names on disk."""
    names = set()
    if os.path.exists("ELEMENTS.tsv"):
        with open("ELEMENTS.tsv", encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                names.add(r.get("name") or r.get("id"))
                parts = (r.get("parts") or "").split("|")[0]
                names.update(x for x in parts.split(",") if x)
    return names


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
    """A word near the middle of the line that is spoken only ONCE in it (a repeated word resolves to its
    first occurrence, i.e. the scene start)."""
    clean = re.sub(r"[।॥?!.,;:\"“”‘’—–\-()\[\]]+", " ", str(text or "")).strip()
    allw = clean.split()
    words = [w for w in allw if len(w) > 2]
    if len(words) < 4:
        return None
    once = [i for i, w in enumerate(words) if allw.count(w) == 1 and i > 0]
    if not once:
        return None
    mid = len(words) // 2
    w = words[min(once, key=lambda i: abs(i - mid))]
    return f"w:{w}" if re.fullmatch(r"[\d,.]+", w) else w


def _edit_refs(ed):
    refs = []
    for sc in ed.get("scenes", []):
        if sc.get("bg") and str(sc["bg"]).lower() not in PROC_BGS:
            refs.append(str(sc["bg"]))
        for it in sc.get("items", []):
            if it.get("type") in ("asset", "photo"):
                n = it.get("name") or it.get("src")
                if n:
                    refs.append(str(n))
    return refs


def is_edit_stub(edit_path="EDIT.json", shots_path="SHOTS.json"):
    """True when EDIT.json must be (re)built: missing, empty, the bundled sample, pointing at images
    that are not part of THIS video's shot list, or an auto-built edit older than the voice / shots."""
    if not os.path.exists(edit_path):
        return True
    try:
        ed = json.load(open(edit_path, encoding="utf-8"))
        scenes = ed.get("scenes", [])
        if not scenes:
            return True
        refs = _edit_refs(ed)
        shot_names = set()
        if os.path.exists(shots_path):
            sh = json.load(open(shots_path, encoding="utf-8"))
            for s in sh.get("shots", []):
                shot_names.add(s.get("name"))
                shot_names.update(it.get("name") for it in s.get("items", []))
            shot_names |= _final_names()
            # sample-project images in a user's edit = template stub leaking dummy assets
            if any(r in TEMPLATE_NAMES and r not in shot_names for r in refs):
                return True
            # most referenced images belong to some other shot list -> stale edit
            foreign = [r for r in refs if r not in shot_names and not _image_on_disk(r)]
            if refs and len(foreign) * 2 > len(refs):
                return True
        # an edit WE generated is rebuilt whenever the voice or the shot list changed after it
        if ed.get("generator") == AUTO_MARK:
            et = os.path.getmtime(edit_path)
            for src in (shots_path, "VO.tsv", "WORDS.tsv"):
                if os.path.exists(src) and os.path.getmtime(src) > et + 1:
                    return True
        return False
    except Exception:
        return True


# ====================================================================== recipe-driven choreography
# Every official style ships RECIPES (styles/<name>.py): scene templates in that style's own layouts.
# The auto editor picks a recipe per voice line from what the line SAYS (hook / number / compare / list /
# person / place / object / quote / outro) and what images were made FOR that line, then fills the template
# with the line's own images, words, numbers and cue words. Nothing is invented: a template element that
# cannot be filled from the script or the shot list is dropped.

_ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine")
_PUNCT = re.compile(r"[।॥?!.,;:\"“”‘’—–\-()\[\]…*_~^]+")
_NUM = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(%|प्रतिशत|percent)?")
_COMPARE = re.compile(r"\b(vs\.?|versus|compared?|than|unlike|whereas|but|instead|rather)\b|बनाम|बजाय|तुलना|जबकि|लेकिन|मुकाबले|से ज़्यादा|से कम",
                      re.IGNORECASE)
_STOP = set("""a an the of to in on at for and or is are was were be been it its this that these those with as by from
he she they we you i his her their our your not no do does did so if then than there here what which who whom
का के की को में से पर और या है हैं था थी थे यह वह ये वो एक भी तो ही न नहीं कि जो जब तक लिए साथ बाद अपने अपनी अपना
हम आप तुम उस उन इस इन कर करना किया गया गई हुआ हुई रहा रही रहे होता होती होते""".split())
PERSON_HINTS = re.compile(r"\b(person|man|woman|boy|girl|king|queen|general|soldier|officer|leader|scientist|doctor|"
                          r"portrait|face|character|stickman|sprite|suspect|witness|hero|figure|people|crowd)\b", re.I)
PLACE_HINTS = re.compile(r"\b(city|street|room|palace|courtyard|village|map|landscape|mountain|river|forest|building|"
                         r"temple|fort|harbour|office|lab|desert|sea|ocean|stage|level|arena|road)\b", re.I)
TEXT_TYPES = ["counter", "bigtext", "redact", "highlight_sweep", "title", "quote", "speech_bubble", "lower_third",
              "keyword", "note", "ransom", "kicker"]           # priority order for the 2-text-elements rule
SAFE_STAMPS = {"CLASSIFIED", "CONFIDENTIAL", "EVIDENCE"}          # atmosphere words, never claims


def _engine():
    if _ENGINE not in sys.path:
        sys.path.insert(0, _ENGINE)
    import layouts            # noqa: F401  (must load before styles so style layouts register)
    import styles
    return layouts, styles


def _words(text):
    return [w for w in _PUNCT.sub(" ", str(text or "")).split() if w]


def _content_words(text):
    return [w for w in _words(text) if w.lower() not in _STOP and (len(w) > 2 or w.isdigit())]


def _numbers(text):
    out = []
    for m in _NUM.finditer(str(text or "")):
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
        except ValueError:
            continue
        out.append({"value": int(val) if val.is_integer() else val, "raw": m.group(1),
                    "pct": bool(m.group(2)), "start": m.start()})
    return out


_CLAUSE = re.compile(r"[,;:—–।॥?!.…]+")


def _phrase(text, max_words, accent=True):
    """Headline from the line: a CONTIGUOUS clause of the spoken words (grammar intact), the clause that holds
    the line's strongest word, trimmed to max_words; that strongest word is *accented*."""
    clauses = [c.split() for c in _CLAUSE.split(str(text or "")) if len(c.split()) >= 1]
    clauses = [[w for w in (_PUNCT.sub(" ", x).strip() for x in c) if w] for c in clauses]
    clauses = [c for c in clauses if c]
    if not clauses:
        return None

    def strength(w):
        return (any(ch.isdigit() for ch in w), w.lower() not in _STOP, len(w))
    best = max(clauses, key=lambda c: (min(len(c), max_words) >= 2, max(strength(w) for w in c), -abs(len(c) - max_words)))
    if len(best) > max_words:                       # keep the window around the strongest word
        k = max(range(len(best)), key=lambda i: strength(best[i]))
        a = max(0, min(k - max_words // 2, len(best) - max_words))
        best = best[a:a + max_words]
    while len(best) > 1 and best[-1].lower() in _STOP:  # never end a headline on "का" / "the"
        best = best[:-1]
    while len(best) > 1 and best[0].lower() in _STOP:   # ... nor start one on "में" / "of"
        best = best[1:]
    if accent and len(best) >= 2:
        k = max(range(len(best)), key=lambda i: strength(best[i]))
        best = best[:k] + [f"*{best[k]}*"] + best[k + 1:]
    return " ".join(best)


def _cue_word(w):
    """A spoken number must be cued as w:<number>; a bare number is read as SECONDS by the timeline."""
    if w is None:
        return None
    w = str(w)
    return f"w:{w}" if re.fullmatch(r"[\d,.]+", w) else w


def _short_label(shot):
    """Label for an image IN THE SCRIPT'S LANGUAGE: the shot's own label, else its cue word (a spoken word).
    The English prompt subject is never shown on screen."""
    lab = shot.get("label") or shot.get("cue")
    if not lab:
        return None
    lab = _PUNCT.sub(" ", str(lab)).strip()
    return " ".join(lab.split()[:3]) or None


def classify(idx, n, text, line_assets, line_scenes):
    """Ordered candidate tags for a line: what kind of beat it is."""
    tags = []
    if idx == 0:
        tags.append("hook")
    if idx == n - 1 and n > 1:
        tags.append("outro")
    if _numbers(text):
        tags.append("number")
    if _COMPARE.search(str(text or "")) or len(line_assets) == 2:
        tags.append("compare")
    if len(line_assets) >= 3:
        tags.append("list")
    blob = " ".join(str(s.get("subject", "")) + " " + str(s.get("archetype", "")) for s in line_assets + line_scenes)
    if PERSON_HINTS.search(blob):
        tags.append("person")
    if PLACE_HINTS.search(blob) or (line_scenes and not line_assets):
        tags.append("place")
    if line_assets:
        tags.append("object")
    if re.search(r"[\"“”]", str(text or "")):
        tags.append("quote")
    tags.append("reveal")
    seen = []
    return [t for t in tags if not (t in seen or seen.append(t))]


class _Fill:
    """Fills ONE recipe for ONE line. `ok` False when the recipe cannot honestly carry this line."""

    def __init__(self, styles, layouts, style, aspect, recipe, ctx):
        self.styles, self.layouts, self.style, self.aspect = styles, layouts, style, aspect
        self.r, self.c = recipe, ctx
        self.spec = styles.SPECS.get(style, {})
        self.maxw = (self.spec.get("TYPE") or {}).get("max_words", {})
        self.upper = (self.spec.get("TYPE") or {}).get("case") == "upper"
        self.placed, self.ok, self.scene = 0, True, None
        self._build()

    # -- helpers ---------------------------------------------------------------------------------
    def _slots(self, layout):
        tab, _ = self.layouts.table(self.aspect)
        own = f"{self.styles.canonical(self.style)}.{layout}"
        return tab.get(layout if "." in layout else (own if own in tab else layout))

    def _case(self, t):
        return t.upper() if (t and self.upper) else t

    def _next_cue(self):
        cues = self.c["cues"]
        return cues.pop(0) if cues else None

    def _kw(self):
        while self.c["keywords"]:
            w = self.c["keywords"].pop(0)
            if w not in self.c["used_words"]:
                self.c["used_words"].add(w)
                return w
        return None

    # -- build -----------------------------------------------------------------------------------
    def _build(self):
        r, c = self.r, self.c
        slots = self._slots(r["layout"])
        if slots is None:
            self.ok = False
            return
        cut_pool, scene_pool = list(c["assets"]), list(c["scenes"])
        items, texts = [], []
        visual_slots = 0
        for d0 in r.get("items", []):
            d = json.loads(json.dumps(d0, ensure_ascii=False))
            t = d.get("type")
            if d.get("slot") and d["slot"] not in slots:
                d.pop("slot")                          # slot missing in this aspect: let the engine choose
            if t in ("asset", "photo"):
                visual_slots += 1
                prefer = (cut_pool, scene_pool) if t == "asset" else (scene_pool, cut_pool)
                shot = prefer[0].pop(0) if prefer[0] else (prefer[1].pop(0) if prefer[1] else None)
                if shot is None:
                    continue
                is_scene = shot.get("kind", "scene") == "scene"
                if t == "asset" and is_scene:              # a full-frame image goes in as a framed photo
                    d = {k: v for k, v in d.items() if k not in ("name", "halftone", "ground", "frame")}
                    d["type"], t = "photo", "photo"
                elif t == "photo" and not is_scene:        # a keyed cut-out stays a cut-out (never a see-through print)
                    d = {k: v for k, v in d.items() if k not in ("src", "caption", "frame", "crop")}
                    d["type"], t = "asset", "asset"
                if t == "photo":
                    d.pop("name", None)
                    d["src"] = shot["name"]
                    lab = _short_label(shot)
                    if "caption" in d or d.get("frame") == "polaroid":
                        if lab:
                            d["caption"] = self._case(lab)
                        else:
                            d.pop("caption", None)
                else:
                    d["name"] = shot["name"]
                    lab = _short_label(shot)
                    if "label" in d or self.style in ("stickman", "sticker", "doodle"):
                        if lab:
                            d["label"] = self._case(lab)
                        else:
                            d.pop("label", None)
                d.pop("crop", None)
                d["at"] = _cue_word(shot.get("cue") or self._next_cue() or d.get("at"))
                if d["at"] and str(d["at"]).startswith("WORD"):
                    d.pop("at")
                self.placed += 1
                items.append(d)
                continue
            if t in ("arrow", "string", "loops", "block", "badge"):
                items.append(d)                            # checked after placement (endpoints must exist)
                continue
            filled = self._text(d)
            if filled is not None:
                texts.append(filled)
        need = visual_slots if visual_slots <= 2 else visual_slots - 1
        if visual_slots and self.placed < need:            # a 4-panel grid with one picture looks broken: skip it
            self.ok = False
            return
        # 2-text-elements law: keep the strongest two
        texts.sort(key=lambda d: TEXT_TYPES.index(d["type"]) if d["type"] in TEXT_TYPES else 99)
        if r.get("_needs_number") and not any(d["type"] in ("counter", "bigtext", "chart", "timeline") for d in texts + items):
            self.ok = False
            return
        texts = [d for d in texts if d["type"] not in TEXT_TYPES][:2] + [d for d in texts if d["type"] in TEXT_TYPES][:2]
        items = items + texts
        occupied = {d.get("slot") for d in items if d.get("slot")}
        visual_idx = {d.get("slot") for d in items if d.get("type") in ("asset", "photo") and d.get("slot")}
        keep = []
        for d in items:
            if d.get("type") in ("arrow", "string", "loops") and not ({d.get("from"), d.get("to")} <= visual_idx):
                continue
            keep.append(d)
        for d in keep:
            if isinstance(d.get("at"), str) and d["at"].startswith("WORD"):
                cue = self._next_cue()
                if cue:
                    d["at"] = cue
                else:
                    d.pop("at")
        self.items = spoken_order(keep, c["text"])
        self.leftover = cut_pool + scene_pool
        self.occupied = occupied

    def _text(self, d):
        t, c = d.get("type"), self.c
        if t in ("title", "quote"):
            txt = _phrase(c["text"], self.maxw.get("title", 5))
            if not txt:
                return None
            d["text"] = self._case(txt)
            d.pop("sub", None)
            words = _words(txt)
            c["used_words"].update(words)
            d["at"] = _cue_word(words[0]) if words else d.get("at")
            return d
        if t == "redact":
            txt = _phrase(c["text"], self.maxw.get("title", 6), accent=False)
            if not txt:
                return None
            d["text"] = txt.upper()
            words = _words(txt)
            c["used_words"].update(words)
            d["at"] = _cue_word(words[0])                    # the bar lands as the phrase starts ...
            if len(words) > 1:
                d["reveal"] = _cue_word(words[-1])           # ... and slides away on its last spoken word
            else:
                d.pop("reveal", None)
            return d
        if t == "highlight_sweep":
            words = _words(c["text"])
            if len(words) < 3:
                return None
            d["text"] = " ".join(words[:12])
            d["highlight"] = (_content_words(c["text"]) or words)[0]
            d.pop("source", None)
            return d
        if t in ("counter", "bigtext"):
            if not c["numbers"]:
                return None
            num = c["numbers"].pop(0)
            if t == "counter":
                year = isinstance(num["value"], int) and 1000 <= num["value"] <= 2100 and not num["pct"]
                d["to"] = num["value"]
                if year:
                    d["from"] = num["value"]                  # a year is shown, never counted up from 0
                d.pop("value", None)
                d["suffix"] = "%" if num["pct"] else ""
                if self.style == "arcade" or self.styles.canonical(self.style) == "arcade":
                    d["prefix"] = "YEAR " if year else d.get("prefix", "")
                else:
                    d.pop("prefix", None)
                d["plain"] = True
            else:
                d["text"] = num["raw"] + ("%" if num["pct"] else "")
            d["at"] = _cue_word(num.get("word")) or d.get("at")
            return d
        if t == "chart":
            nums = c["numbers"]
            if len(nums) < 2:
                return None
            d["rows"] = [{"label": n.get("label") or n["raw"], "value": n["value"], **({"at": _cue_word(n["word"])} if n.get("word") else {})}
                         for n in nums[:4]]
            if not all(n["pct"] for n in nums[:4]):
                d.pop("suffix", None)
            c["numbers"] = []
            return d
        if t == "timeline":
            nums = c["numbers"]
            if len(nums) < 2:
                return None
            d["points"] = [{"label": n["raw"], "text": n.get("label", ""), **({"at": _cue_word(n["word"])} if n.get("word") else {})}
                           for n in nums[:5]]
            c["numbers"] = []
            return d
        if t in ("keyword", "note", "ransom", "speech_bubble", "callout"):
            if t == "callout":
                return None                                  # needs a point on a real image: author it by hand
            w = self._kw()
            if not w:
                return None
            if t == "speech_bubble":
                more = [x for x in _content_words(c["text"]) if x != w][:max(0, self.maxw.get("speech_bubble", 4) - 1)]
                w = " ".join([w] + more[:2])
            d["text"] = self._case(w.upper() if t == "ransom" else w)
            d["at"] = _cue_word(w.split()[0])             # the keyword appears ON the word that says it
            return d
        if t == "lower_third":
            person = next((s for s in c["assets"] + c["scenes"] if PERSON_HINTS.search(str(s.get("subject", "")))), None)
            lab = _short_label(person) if person else None
            if not lab:
                return None
            d["text"] = self._case(lab)
            d.pop("sub", None)
            return d
        if t == "kicker":
            k = c.get("kicker")
            if not k:
                return None
            d["text"] = k
            return d
        if t == "stamp":
            txt = str(d.get("text", "")).upper()
            return d if (txt in SAFE_STAMPS and "hook" in c["tags"]) else None
        return None


def spoken_order(items, text):
    """The engine resolves word cues FORWARD from the previous one, so items must be listed in the order their
    words are spoken (else a later word sends an earlier one back to a previous line). Backdrops stay first."""
    words = [PUNCT_CLEAN(w) for w in _words(text)]

    def pos(d, fallback):
        cue = str(d.get("at") or "")
        cue = PUNCT_CLEAN(cue[2:] if cue.startswith("w:") else cue)
        if not cue:
            return fallback
        for i, w in enumerate(words):
            if w == cue or (len(cue) >= 3 and cue in w):
                return i
        return fallback
    keyed, last = [], -1.0
    for n, d in enumerate(items):
        if d.get("type") in ("block", "bigtext") and not d.get("at"):
            keyed.append(((-1, n), d))
            continue
        p = pos(d, last + 0.01)
        last = p
        keyed.append(((p, n), d))
    return [d for _, d in sorted(keyed, key=lambda x: x[0])]


def PUNCT_CLEAN(w):
    return _PUNCT.sub("", str(w or "")).strip().lower()


def _line_ctx(text, line_assets, line_scenes, tags, kicker):
    nums = _numbers(text)
    words = _words(text)
    for n in nums:                       # the spoken word carrying the number = its cue; the word before = its label
        pos = len(_words(text[:n["start"]]))
        n["word"] = words[pos] if pos < len(words) else None
        prev = [w for w in words[max(0, pos - 2):pos] if w.lower() not in _STOP]
        n["label"] = prev[-1] if prev else None
    image_cues = {s.get("cue") for s in line_assets + line_scenes if s.get("cue")}
    kw = [w for w in _content_words(text) if w not in image_cues and not w.replace(",", "").replace(".", "").isdigit()]
    kw.sort(key=len, reverse=True)
    cues = [w for w in _content_words(text) if w not in image_cues]
    return {"text": text, "assets": line_assets, "scenes": line_scenes, "numbers": nums, "keywords": kw,
            "cues": cues, "used_words": set(), "tags": tags, "kicker": kicker}


def _recipe_needs_number(r):
    return any(d.get("type") in ("counter", "bigtext", "chart") for d in r.get("items", []))


def choose_scene(styles, layouts, style, aspect, recipes, tags, ctx_args, history):
    """Best recipe for this line: tag priority first, then how many of the line's images it shows,
    then variety (never the same recipe / layout as the previous scene, least-used first)."""
    best = None
    for rank, (name, r) in enumerate(recipes):
        r_tags = r.get("use_for") or []
        tag_rank = min((tags.index(t) for t in r_tags if t in tags), default=len(tags) + 1)
        r2 = dict(r, _needs_number=_recipe_needs_number(r))
        if r2["_needs_number"] and "number" not in tags:
            continue
        f = _Fill(styles, layouts, style, aspect, r2, _line_ctx(*ctx_args))
        if not f.ok:
            continue
        n_imgs = len(ctx_args[1]) + len(ctx_args[2])
        unshown = n_imgs - f.placed
        same_prev = history and (history[-1][0] == name or history[-1][1] == r["layout"])
        used = sum(1 for h in history if h[0] == name)
        # 1st: every image made for this line is on screen; 2nd: the beat type; then variety
        score = (unshown > 0, tag_rank, unshown, bool(same_prev), used, rank)
        if best is None or score < best[0]:
            best = (score, name, r, f)
    return best


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
    layouts, styles = _engine()
    if style not in styles.STYLES:
        raise SystemExit(f"unknown style {style!r} in {shots_path}")
    look = styles.get(style)["look"]
    motion = styles.SPECS.get(style, {}).get("MOTION", {})
    recipes = styles.recipes_for(style)

    final = _final_names()
    bg_shots, asset_shots = [], []
    for s in shots:
        kind = s.get("kind", "scene")
        if kind == "scene":
            bg_shots.append(s)
        elif kind == "asset":
            asset_shots.append(s)
        elif kind == "sheet":
            for it in s.get("items", []):
                asset_shots.append(dict(it, kind="asset", line=it.get("line", s.get("line")),
                                        cue=it.get("cue", s.get("cue"))))
    if final:   # only use shots that really became images (prompt_engine may have renamed / rejected some)
        bg_shots = [s for s in bg_shots if s.get("name") in final] or bg_shots
        asset_shots = [a for a in asset_shots if a.get("name") in final] or asset_shots

    line_order = [norm_line(ln.get("id", f"{i + 1:02d}")) for i, ln in enumerate(lines)]
    pos = {lid: i for i, lid in enumerate(line_order)}

    def by_line(items):
        """Group shots by the voice line they were written for. Shots without a (valid) line are spread
        in shot-list order over the lines that got nothing, never over lines that have their own."""
        got, loose = {}, []
        for it in items:
            k = norm_line(it.get("line"))
            (got.setdefault(k, []).append(it) if k in pos else loose.append(it))
        empty = [l for l in line_order if l not in got]
        if loose and empty:
            for j, it in enumerate(loose):
                got.setdefault(empty[min(len(empty) - 1, j * len(empty) // len(loose))], []).append(it)
        return got

    bg_by_line, assets_by_line = by_line(bg_shots), by_line(asset_shots)
    if not any(norm_line(s.get("line")) in pos for s in bg_shots + asset_shots) and (bg_shots or asset_shots):
        print("⚠ auto_edit: no shot in SHOTS.json has a \"line\" matching VO.tsv/LINES.tsv ids "
              f"({', '.join(line_order[:5])}...). Assets were spread in shot order; add \"line\" + \"cue\" "
              "to every shot so each image lands on the words it illustrates.")

    world = spec.get("world", {})
    topic = spec.get("title") or spec.get("topic") or world.get("location") or ""
    kicker_prefix = look.get("kicker_prefix", "")
    cams = motion.get("camera") or CAMERA_ROTATION
    trans = motion.get("transitions") or TRANSITION_ROTATION.get(style, TRANSITION_ROTATION["default"])
    scene_led = look.get("letterbox", 0) > 0 or style in ("noir", "crime", "suspense", "arcade", "cinematic") \
        or styles.canonical(style) in ("noir", "arcade", "cinematic")

    scenes, history, chapter = [], [], 0
    n = len(lines)
    for idx, ln in enumerate(lines):
        lid = str(ln.get("id", f"{idx + 1:02d}"))
        ltext = ln.get("text", "")
        nl = norm_line(lid)
        line_scenes = list(bg_by_line.get(nl, []))
        line_assets = list(assets_by_line.get(nl, []))
        prev_bg = next((bg_by_line[l][-1] for l in reversed(line_order[:idx]) if bg_by_line.get(l)), None)
        next_bg = next((bg_by_line[l][0] for l in line_order[idx + 1:] if bg_by_line.get(l)), None)
        tags = classify(idx, n, ltext, line_assets, line_scenes)
        if "hook" in tags or idx % 6 == 0:
            chapter += 1
        kicker = None
        if kicker_prefix:
            kicker = f"{kicker_prefix} {chapter}" if style == "arcade" or styles.canonical(style) == "arcade" else \
                (f"{kicker_prefix} // {str(topic).upper()[:28]}" if topic else None)

        # backdrop: scene-led styles show this line's own scene full-frame; paper styles keep paper and show
        # scene images inside the composition (photos), so nothing generated for the line goes unseen
        bg_shot = None
        if scene_led:
            bg_shot = line_scenes.pop(0) if line_scenes else (prev_bg or next_bg)
        picked = choose_scene(styles, layouts, style, aspect, recipes, tags,
                              (ltext, line_assets, line_scenes, tags, kicker), history) if recipes else None
        if picked:
            _, rname, recipe, fill = picked
            items = fill.items
            leftovers = fill.leftover
            layout = recipe["layout"]
            bg = recipe.get("bg", "auto")
            history.append((rname, layout))
        else:
            rname, recipe, layout, leftovers = None, {}, LAYOUT_ROTATION[idx % len(LAYOUT_ROTATION)], line_assets + line_scenes
            items = []
            phrase = _phrase(ltext, 5)
            if phrase:
                items.append({"type": "title", "text": phrase})
            bg = "auto"
            history.append((None, layout))
        if bg == "SCENE_BG" or scene_led:
            if not bg_shot and line_scenes and not scene_led:
                bg_shot = line_scenes.pop(0)
            bg = bg_shot["name"] if bg_shot else ("dark" if scene_led else "auto")
        # images of this line the recipe had no slot for: still shown, each on its own cue word
        tab, _ = layouts.table(aspect)
        lay_slots = tab.get(layout) or tab.get(f"{styles.canonical(style)}.{layout}") or {}
        free_visual = [s for s in layouts.PREFER["asset"] if s in lay_slots]
        for s in leftovers:
            if s is bg_shot or not free_visual:
                continue
            it = {"type": "photo" if s.get("kind", "scene") == "scene" else "asset",
                  ("src" if s.get("kind", "scene") == "scene" else "name"): s["name"]}
            if s.get("cue"):
                it["at"] = s["cue"]
            items.append(it)
        items = spoken_order(items, ltext)
        cuts = []
        mid = _mid_word_cue(ltext)
        if bg_shot and mid and not any(d.get("at") == mid for d in items):
            cuts.append({"at": mid, "frame": "close" if idx % 2 == 0 else "medium",
                         "focus": [0.42 if idx % 2 == 0 else 0.58, 0.48]})
        scene = {
            "id": lid,
            "at": "@01" if idx == 0 else f"@{lid}",
            "bg": bg,
            "layout": layout,
            "camera": recipe.get("camera") or cams[idx % len(cams)],
            "transition": "cut" if idx == 0 else (recipe.get("transition") or trans[idx % len(trans)]),
            "items": items,
            **({"recipe": rname} if rname else {}),
            **({"cuts": cuts} if cuts else {}),
        }
        scenes.append(scene)

    edit_doc = {
        "style": style,
        "aspect": aspect,
        "fps": 24,
        "captions": "auto",
        "generator": AUTO_MARK,
        "scenes": scenes,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(edit_doc, f, ensure_ascii=False, indent=2)
    used = {}
    for h in history:
        used[h[0]] = used.get(h[0], 0) + 1
    print(f"✓ auto-choreographed {out_path} ({len(scenes)} scenes, style={style!r}, aspect={aspect!r}, "
          f"recipes: {', '.join(f'{k}×{v}' for k, v in used.items() if k)})")
    return edit_doc


if __name__ == "__main__":
    shots_arg = sys.argv[1] if len(sys.argv) > 1 else "SHOTS.json"
    out_arg = sys.argv[2] if len(sys.argv) > 2 else "EDIT.json"
    build_auto_edit(shots_arg, out_arg)
