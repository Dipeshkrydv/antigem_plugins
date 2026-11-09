# -*- coding: utf-8 -*-
"""variety.py -- the Creative Director pass (v3).

Why it exists: v2 let the agent put a red rubber stamp in nearly every scene (CASE CLOSED, VERIFIED, NO STRUGGLE,
MASS CASUALTY, UNSOLVED ... 5-6 identical slams in one video). One motif repeated that often stops being emphasis
and starts looking cheap. This pass runs over the WHOLE edit before anything is drawn and makes design decisions
the way an editor would:

  * MOTIF BUDGET   every emphasis design has a per-video budget. The rubber stamp (the loudest one) is allowed
                   at most twice, and never in scenes closer than 3 apart. Every other "stamp" beat is re-designed
                   as a different emphasis family: seal / tape / scrawl / tab (core/engine/kit.py).
  * NO NEIGHBOURS  two consecutive emphasis beats never share a design; two consecutive kickers never share a
                   design; an entrance animation never repeats three times in a row; scene transitions rotate
                   through the style's own vocabulary instead of one default.
  * STYLE TASTE    each style ranks the families it likes (noir prefers rubber/tab, Vox prefers scrawl/tape ...),
                   so substitutions stay on-genre.
  * RESPECT        anything the edit states explicitly ("design": "rubber", "enter": "pop", "transition": "flash")
                   is kept. It still counts against the budget, and `studio.py check` reports any overrun.

EDIT.json controls (all optional):
  "variety": {"auto": true,                       false = report only, change nothing
              "budget": {"rubber": 2, "seal": 1, "tape": 3, "scrawl": 3, "tab": 3},
              "rubber_gap": 3}                     scenes between two rubber stamps
"""

DEFAULT_BUDGET = {"rubber": 2, "seal": 1, "tape": 3, "scrawl": 3, "tab": 3, "burst": 2, "circle": 2, "underline": 2}
DEFAULT_ACCENT_BUDGET = {"burst": 2, "circle": 2, "underline": 2}

# which emphasis designs a style reaches for first (first = the style's signature hit)
TASTE = {
    "noir": ["rubber", "tab", "tape", "scrawl", "seal"],
    "cinematic": ["tab", "tape", "rubber", "scrawl", "seal"],
    "documentary": ["rubber", "tab", "tape", "scrawl", "seal"],
    "sticker": ["scrawl", "tape", "seal", "rubber", "tab"],
    "box": ["tab", "tape", "scrawl", "rubber", "seal"],
    "kinetic": ["tape", "scrawl", "tab", "rubber", "seal"],
    "toon": ["scrawl", "tape", "seal", "tab", "rubber"],
}
KICKERS = {
    "noir": ["bar", "bracket", "index", "rule"],
    "cinematic": ["rule", "bracket", "index"],
    "documentary": ["rule", "chip", "index", "bar"],
    "sticker": ["chip", "rule", "bracket"],
    "box": ["chip", "index", "rule"],
    "kinetic": ["index", "chip", "rule"],
    "toon": ["chip", "rule", "bracket"],
}
TRANSITIONS = {
    "noir": ["dip", "fade", "smooth_zoom", "luma_wipe", "slide"],
    "cinematic": ["fade", "dip", "smooth_zoom", "luma_wipe", "whip"],
    "documentary": ["paper_slide", "smooth_zoom", "fade", "whip", "luma_wipe"],
    "sticker": ["whip", "smooth_zoom", "paper_slide", "fade", "slide"],
    "box": ["slide", "smooth_zoom", "fade", "luma_wipe"],
    "kinetic": ["whip", "smooth_zoom", "slide", "fade"],
    "toon": ["paper_slide", "smooth_zoom", "whip", "fade"],
}
ENTRANCES = ["rise", "pop", "drop", "slide", "snap", "slide_l", "fade"]


def _canon(style_name, look):
    s = (look.get("variety_style") or style_name or "noir").lower()
    return {"crime": "noir", "suspense": "noir", "truecrime": "noir", "vox": "documentary", "paper": "documentary",
            "stickman": "sticker", "doodle": "sticker", "cute": "toon", "cartoon": "toon"}.get(s, s)


def direct(spec, style_name, look):
    """Mutates the item dicts of spec['scenes'] in place (private keys: _family, _kv, _kidx, _enter; scene
    'transition' only when the edit left it empty). Returns a report dict for `check`."""
    cfg = spec.get("variety", {}) or {}
    auto = cfg.get("auto", True)
    budget = dict(DEFAULT_BUDGET, **(cfg.get("budget") or {}))
    gap = int(cfg.get("rubber_gap", 3))
    st = _canon(style_name, look)
    taste = look.get("emphasis") or TASTE.get(st, TASTE["noir"])
    kick = look.get("kickers") or KICKERS.get(st, KICKERS["noir"])
    trans = look.get("transitions") or TRANSITIONS.get(st, [look.get("transition", "fade")])
    used = {f: 0 for f in budget}
    accent_budget = dict(DEFAULT_ACCENT_BUDGET, **(cfg.get("accent_budget") or {}))
    burst_gap = int(cfg.get("burst_gap", 3))
    accent_used = {k: 0 for k in accent_budget}
    last_burst_scene = -99
    rep = {"emphasis": [], "redesigned": [], "over": [], "unknown": [], "kickers": [], "transitions": [],
           "entrances_varied": 0, "accents": [], "accents_dropped": [], "accents_redesigned": [],
           "accent_used": accent_used, "accent_budget": accent_budget}
    last_fam, last_rubber_scene = None, -99
    last_kv = None
    enters = []
    chapter = 0
    for si, sc in enumerate(spec.get("scenes", [])):
        if si and not sc.get("transition") and auto:
            sc["transition"] = trans[si % len(trans)]
        if si:
            rep["transitions"].append(sc.get("transition", look.get("transition")))
        for d in sc.get("items", []):
            t = d.get("type")
            if t == "stamp":
                fam = d.get("design") or d.get("family")
                if fam:
                    if fam not in budget:
                        rep["unknown"].append((sc.get("id", f"{si + 1:02d}"), d.get("text", ""), fam))
                        fam = "rubber"
                else:
                    fam = "rubber"
                    if auto:
                        ok = [f for f in taste if used.get(f, 0) < budget.get(f, 0) and f != last_fam
                              and not (f == "rubber" and si - last_rubber_scene < gap)]
                        ok.sort(key=lambda f: (used.get(f, 0), taste.index(f)))     # spread designs, taste breaks ties
                        fam = ok[0] if ok else min(taste, key=lambda f: (f == last_fam, used.get(f, 0)))
                        if fam != "rubber":
                            rep["redesigned"].append((sc.get("id", f"{si + 1:02d}"), d.get("text", ""), fam))
                used[fam] = used.get(fam, 0) + 1
                if used[fam] > budget.get(fam, 0):
                    rep["over"].append((sc.get("id", f"{si + 1:02d}"), d.get("text", ""), fam))
                if fam == "rubber":
                    last_rubber_scene = si
                last_fam = fam
                d["_family"] = fam
                rep["emphasis"].append(fam)
            elif t == "kicker":
                chapter += 1
                kv = d.get("design")
                if not kv:
                    kv = kick[0]
                    if auto:
                        opts = [k for k in kick if k != last_kv]
                        kv = opts[(chapter - 1) % len(opts)] if opts else kick[0]
                d["_kv"], d["_kidx"] = kv, chapter
                last_kv = kv
                rep["kickers"].append(kv)
            elif t in ("asset", "photo"):
                e = d.get("enter")
                if e is None and auto and len(enters) >= 2 and enters[-1] == enters[-2]:
                    alt = [x for x in ENTRANCES if x != enters[-1]]
                    e = alt[(len(enters) + si) % len(alt)]
                    d["_enter"] = e
                    rep["entrances_varied"] += 1
                enters.append(e or d.get("frame") or "default")

                # Accent / doodle motif budget enforcement (burst max 2x per video, >= 3 scenes apart)
                acc = d.get("accent")
                if acc:
                    if acc in accent_budget:
                        is_burst = (acc == "burst")
                        over_budget = accent_used.get(acc, 0) >= accent_budget.get(acc, 2)
                        too_close = is_burst and (si - last_burst_scene < burst_gap)
                        if over_budget or too_close:
                            if auto:
                                alt_acc = None
                                if is_burst and not over_budget:
                                    alt_acc = next((a for a in ("circle", "underline") if accent_used.get(a, 0) < accent_budget.get(a, 2)), None)
                                if alt_acc:
                                    d["accent"] = alt_acc
                                    accent_used[alt_acc] = accent_used.get(alt_acc, 0) + 1
                                    rep["accents"].append(alt_acc)
                                    rep["accents_redesigned"].append((sc.get("id", f"{si + 1:02d}"), d.get("name", ""), acc, alt_acc))
                                else:
                                    d["accent"] = None
                                    rep["accents_dropped"].append((sc.get("id", f"{si + 1:02d}"), d.get("name", ""), acc))
                            else:
                                rep["over"].append((sc.get("id", f"{si + 1:02d}"), d.get("name", ""), acc))
                        else:
                            accent_used[acc] = accent_used.get(acc, 0) + 1
                            if is_burst:
                                last_burst_scene = si
                            rep["accents"].append(acc)
    rep["used"] = used
    rep["budget"] = budget
    return rep


def summary(rep):
    """Human-readable lines for `studio.py check`."""
    out = []
    used = {k: v for k, v in rep["used"].items() if v}
    out.append("design variety: emphasis " + (", ".join(f"{k} {v}/{rep['budget'].get(k, 0)}" for k, v in used.items()) or "none")
               + f" · kickers {len(set(rep['kickers']))} designs · transitions {len(set(rep['transitions']))} kinds"
               + (f" · {rep['entrances_varied']} repeated entrances varied" if rep["entrances_varied"] else ""))
    acc_used = {k: v for k, v in rep.get("accent_used", {}).items() if v}
    if acc_used:
        out.append("   ✦ accents: " + ", ".join(f"{k} {v}/{rep['accent_budget'].get(k, 2)}" for k, v in acc_used.items())
                   + " (strict budget: max 2x per video, no repeats)")
    for sid, txt, fam in rep["redesigned"]:
        out.append(f"   ↻ scene {sid}: stamp {txt!r} re-designed as {fam} (rubber-stamp budget / no repeats)")
    for sid, name, acc in rep.get("accents_dropped", []):
        out.append(f"   ✂ scene {sid}: asset {name!r} accent {acc!r} removed (exceeded max 2 per video limit)")
    for sid, name, acc, alt in rep.get("accents_redesigned", []):
        out.append(f"   ↻ scene {sid}: asset {name!r} accent {acc!r} re-designed as {alt} (spacing / variety)")
    return out


def warnings(rep):
    w = [f"scene {sid}: stamp {txt!r} has unknown design {fam!r} (use rubber / seal / tape / scrawl / tab) -> rubber"
         for sid, txt, fam in rep.get("unknown", [])]
    for sid, txt, fam in rep["over"]:
        w.append(f"scene {sid}: {fam} {txt!r} exceeds the per-video budget ({rep['budget'].get(fam, 0)}) -- "
                 f"the same emphasis design repeated this often looks cheap; drop it or use another beat type")
    em = rep["emphasis"]
    if any(a == b for a, b in zip(em, em[1:])):
        w.append("two consecutive emphasis beats use the same design -- vary them (or let variety.auto decide)")
    return w
