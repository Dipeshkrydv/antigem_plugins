#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deepesh Studio Engine v2 -- EDIT.json + WORDS.tsv + images + audio -> master.mp4

    python core/engine/render.py check                 validate the edit (cues, slots, assets, text fit)
    python core/engine/render.py still 3.5 41 120      render single frames  -> _stills/*.png
    python core/engine/render.py sheet --every 8       contact sheet of the whole video -> _stills/sheet.jpg
    python core/engine/render.py preview               fast 960x540 draft -> preview.mp4
    python core/engine/render.py video                 full quality -> master.mp4
    options: --edit EDIT.json  --workers N  --from 30 --to 60 (partial)  --out FILE

Design rules this engine enforces (the v1 problems it fixes):
  * every element sits in a layout SLOT (core/engine/layouts.py); slots never overlap,
    so stamps can't cover stickers and text can't run under pictures
  * the caption band is reserved in every layout and captions are rendered with real
    Devanagari shaping + measured bounds -> never clipped, always on a readable plate
  * scenes are compositions (title + visuals + labels + stamps + strings), not one sticker
  * colour grade / vignette / grain run inside ffmpeg (C speed); frames render in
    parallel chunks and are joined without re-encoding -> several times faster than v1
"""
import argparse, json, math, os, subprocess, sys, time, zlib

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)

import numpy as np
from PIL import Image, ImageDraw

import kit, layouts, styles
import collage
import variety
import character
from timeline import Timeline

try:                      # optional: `pip install opencv-python-headless` makes the camera move ~5x faster
    import cv2
except Exception:
    cv2 = None

TRANS_D = 0.45     # scene transition length (s)
ENTER_D = 0.55     # element entrance length (s)
EXIT_D = 0.28      # element exit length (s)
CENTER_LAYOUTS = layouts.CENTERED          # style files extend this set (CENTERED = {...})
CAM_FPS = float(os.environ.get("DEEPESH_CAM_FPS", "12"))   # camera-move update rate (frames are reused in between)
OVERLAYS = {"string", "arrow", "loops"}     # lines drawn over everything else
Z_DEFAULT = {"block": -2, "bigtext": -1}    # layers behind the cut-outs unless the item says "z"
HEX = lambda v: tuple(int(v.lstrip("#")[j:j + 2], 16) for j in (0, 2, 4))


def find_image(name):
    for base in ("elements/cut", "elements/raw", "elements", "backgrounds", "."):
        for ext in ("", ".png", ".jpg", ".jpeg", ".webp"):
            p = os.path.join(base, name + ext)
            if os.path.isfile(p):
                return p
    return None


def probe_duration(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                             capture_output=True, text=True).stdout.strip()
        return float(out)
    except Exception:
        return 0.0


def clean_caption_word(w):
    w = w.replace("।", "").replace("॥", "").strip()
    if w in ("—", "–", "-", "…", ","):
        return ""
    return w.rstrip(",.")


# ====================================================================== items
class Item:
    def __init__(self, d, scene, eng):
        if d["type"] == "note":        # a thin paper annotation label is a keyword with the "note" treatment
            d = dict(d, type="keyword", box="note")
        self.d, self.sc, self.e = d, scene, eng
        self.look = scene.get("look", eng.look)
        self.type = d["type"]
        self.slot = None
        self.rect = None           # px rect of slot
        self.t_in = self.t_out = 0.0
        self.exit = False
        self.cache = {}
        self.built = None

    def col(self, spec, default="accent2"):
        """Colour from a name (accent/accent2/accent3/ink/muted/bg/white/black), '#rrggbb' or [r,g,b]."""
        spec = spec if spec is not None else default
        if isinstance(spec, (list, tuple)):
            return tuple(int(c) for c in spec[:3])
        if isinstance(spec, str) and spec.startswith("#"):
            return HEX(spec)
        named = {"white": (255, 255, 255), "black": (18, 18, 20), "red": (198, 40, 40), "crimson": (176, 28, 46),
                 "orange": (239, 108, 0), "yellow": (250, 196, 30), "gold": (212, 160, 23), "green": (46, 125, 50),
                 "blue": (30, 100, 200), "navy": (24, 44, 92), "purple": (106, 27, 154), "pink": (216, 27, 96),
                 "grey": (120, 120, 124), "gray": (120, 120, 124), "brown": (109, 76, 65)}
        return named.get(spec) or tuple(self.look.get(spec, self.look[default]))[:3]

    def z(self):
        return self.d.get("z", Z_DEFAULT.get(self.type, 0))

    def jitter(self, t):
        """Subtle sub-pixel organic micro-variation (never an aggressive shaking loop)."""
        if not self.look.get("jitter") or self.type not in ("asset", "photo"):
            return 0.0, 0.0
        r = collage.rng_for(self.slot, int(t * 4))
        amp = 0.4 * self.e.S
        return (r.random() - 0.5) * amp, (r.random() - 0.5) * amp

    # ---------------------------------------------------------------- build (once per worker)
    def build(self):
        if self.built is not None:
            return self.built
        e, look = self.e, self.look
        S = e.S * (1.22 if e.aspect == "9:16" else 1.0)   # vertical video is watched on phones: bigger type
        x, y, w, h = self.rect
        ink = e.ink(self.sc)
        d, t = self.d, self.type
        align = "center" if (self.sc["layout"] in CENTER_LAYOUTS or e.aspect == "9:16") else "left"
        on_image = self.sc["bg_is_image"]
        b = {"anchor": "center", "align": align}
        if t == "kicker":
            # v3: 46 px at 1080p (was 30 px = unreadable on a phone); design chosen by the variety pass
            if d.get("design") and d["design"] not in kit.KICKER_VARIANTS:
                e.warnings.append(f"kicker design {d['design']!r} unknown (use {', '.join(kit.KICKER_VARIANTS)}) -> 'bar'")
            size = float(d.get("size", look.get("kicker_size", 46))) * S
            sp = kit.kicker(d["text"], d.get("design") or d.get("_kv", "bar"), look, size, w, on_image=on_image,
                            S=S, index=d.get("number", d.get("_kidx")))
            if sp.width > w:
                sp = kit.fit_into(sp, w, sp.height * w / sp.width)
            b.update(sprite=sp, anchor="left" if align == "left" else "center",
                     enter=d.get("enter", "wipe" if d.get("_kv") in ("chip", "rule") else "type"))
        elif t in ("title", "quote") and (d.get("box") or (look.get("title_box") if t == "title" else None)) == "strip":
            sp = kit.strip_title(d["text"], d.get("sub"), look, 74 * S, w, S, ink=ink)
            if sp.width > w or sp.height > h:
                sp = kit.fit_into(sp, w, h)
            b.update(sprite=sp, anchor="left" if align == "left" else "center", enter=d.get("enter", "wipe"))
        elif t in ("title", "quote"):
            role = d.get("font") or ("serif" if t == "quote" and look.get("paper") else look["title_font"])
            size = (100 if t == "title" else 110) * S
            max_lines = d.get("lines", 2 if t == "title" else 3)
            while True:
                s, lines, f, sp_ = kit.fit_text(d["text"], role, size, w, max_lines)
                rows = []
                for ln in lines:
                    row_txt = kit.serialize(ln)
                    im, inf = kit.text_block(row_txt, role, s, ink, w * 1.2, max_lines=1, accent=look["accent2"],
                                             alt=look.get("accent3"), hl=look["accent2"], deco=look["accent"],
                                             shadow=int(7 * S) if on_image else 0, align=align)
                    if d.get("fill") == "gradient":
                        im = kit.gradient_fill(im, d.get("from", look["accent2"]), d.get("to", look["accent"]))
                    elif d.get("fill") == "print":
                        im = collage.print_texture(im, seed=d["text"])
                    rows.append(im)
                    b["pad"] = inf["pad"]
                total = sum(r.height for r in rows) * 0.86
                if total <= h * 1.08 or size < 30 * S:
                    break
                size *= 0.9
            if d.get("sub"):
                b["sub"] = kit.trim(kit.text_block(d["sub"], "serif_reg" if look.get("paper") else "body", 38 * S,
                                                   look["muted"] if not on_image else (210, 206, 198), w,
                                                   max_lines=2, align=align)[0])
            b.update(rows=rows, anchor="left" if align == "left" else "center", enter="mask")
        elif t == "bigtext":     # giant numeral / word BEHIND the cut-outs (the 1925 / 1927 collages)
            role = d.get("font") or look.get("big_font", "serif")
            im, _ = kit.text_block(d["text"], role, min(h * 1.5, 1300 * S), self.col(d.get("color"), "accent2"),
                                   w * 4, max_lines=1, align="center")
            im = kit.trim(im)
            if d.get("fill", "print") == "print":
                im = collage.print_texture(im, seed=d["text"], speck=0.05, mottle=0.16)
            b.update(sprite=kit.fit_into(im, w, h), anchor="center", enter=d.get("enter", "grow"))
        elif t == "block":       # solid colour block / circle / stripe (orange slabs, the yellow circle behind a subject)
            shape = d.get("shape", "rect")
            if shape == "circle":
                bw = bh = int(min(w, h) * d.get("scale", 1.0))
            else:
                bw, bh = int(w * d.get("scale", 1.0)), int(h * d.get("scale", 1.0))
            b.update(sprite=collage.block(shape, bw, bh, self.col(d.get("color"), "accent2"), seed=d.get("color", "c"),
                                          glitch=bool(d.get("glitch")), S=S),
                     anchor="center", enter=d.get("enter", "wipe"))
        elif t == "badge":       # tiny UI chip: play / star / hash / check / bell / mail / search / bolt / arrow / plus / heart
            side = max(24, int(min(w, h) * d.get("scale", 0.85)))
            sp = collage.badge(d.get("icon", "dot"), side, self.col(d.get("color"), "accent3"),
                               self.col(d.get("fg"), "white"), d.get("shape", "circle"))
            b.update(sprite=kit.shadow(sp, blur=int(6 * S), dy=int(4 * S), alpha=0.28), anchor="center",
                     enter=d.get("enter", "pop"))
        elif t == "ransom":      # ransom-note letter tiles
            sp = kit.text_box(d["text"], "ransom", look, 54 * S, w, S, variant=int(d.get("seed", 1)))
            b.update(sprite=kit.fit_into(sp, w, h) if sp.width > w or sp.height > h else sp,
                     anchor="left" if align == "left" else "center", enter=d.get("enter", "pop"))
        elif t == "chart":
            self._build_chart(b, w, h, S, ink)
        elif t == "keyword":
            style_ = d.get("box") or d.get("_auto_box", "pill")
            sp = kit.text_box(d["text"], style_, look, 46 * S, w, S, ink=ink, variant=d.get("_variant", 0))
            if min(w / sp.width, h / sp.height) < 0.75 and style_ not in ("pill", "marker", "strip", "note", "plate", "block", "ransom"):
                sp = kit.text_box(d["text"], "marker" if style_ != "label" else "pill", look, 46 * S, w, S, ink=ink)
            if sp.width > w or sp.height > h:
                sp = kit.fit_into(sp, w, h)
            b.update(sprite=sp, anchor="left" if align == "left" else "center", enter=d.get("enter", "wipe"))
        elif t == "stamp":
            fam = d.get("_family") or d.get("design") or "rubber"
            lk = dict(look, stamp_color=self.col(d["color"]) if d.get("color") else look["stamp_color"])
            sp, ent = kit.emphasis(fam, d["text"], lk, min(h * 0.92, 180 * S), w, S,
                                   seed=zlib.crc32(f"{d['text']}{self.sc['i']}".encode()),
                                   sub=d.get("sub"), on_image=on_image, ink=ink)
            if sp.width > w or sp.height > h:
                sp = kit.fit_into(sp, w, h)
            b.update(sprite=sp, enter=d.get("enter", ent))
        elif t == "lower_third":
            name, _ = kit.text_block(d["text"], "headline", 44 * S, ink, w, max_lines=1)
            role_ = kit.text_block(d.get("sub", ""), "body", 28 * S, look["muted"], w, max_lines=1)[0] if d.get("sub") else None
            hh = name.height + (role_.height if role_ else 0) - int(10 * S)
            sp = kit.Image.new("RGBA", (int(max(name.width, role_.width if role_ else 0) + 22 * S), hh), (0, 0, 0, 0))
            sp.alpha_composite(kit.rounded(int(8 * S), hh - int(16 * S), int(3 * S), tuple(look["accent"]) + (255,)), (0, int(8 * S)))
            sp.alpha_composite(name, (int(14 * S), 0))
            if role_:
                sp.alpha_composite(role_, (int(14 * S), name.height - int(18 * S)))
            b.update(sprite=kit.fit_into(sp, w, h) if sp.width > w else sp, anchor="left", enter="wipe")
        elif t == "counter":
            b.update(anchor="left" if align == "left" else "center", enter="fade")
        elif t in ("asset", "photo"):
            b.update(self._build_visual(w, h))
        elif t == "callout":
            sp = kit.pill(d["text"], "headline", 38 * S, look["ink"], tuple(look["panel"][:3]) + (235,), w, radius=int(10 * S))
            b.update(sprite=kit.fit_into(sp, w, h) if sp.width > w else sp, enter="pop")
        elif t == "list":
            rows = []
            for it in d["items"]:
                txt, _ = kit.text_block(it["text"], "body", 40 * S, ink, w - 60 * S, max_lines=2)
                row = kit.Image.new("RGBA", (int(txt.width + 56 * S), txt.height), (0, 0, 0, 0))
                dot = kit.rounded(int(20 * S), int(20 * S), int(5 * S), tuple(look["accent"]) + (255,))
                row.alpha_composite(dot, (int(6 * S), (txt.height - dot.height) // 2))
                row.alpha_composite(txt, (int(40 * S), 0))
                rows.append(row)
            b.update(rows=rows, anchor="left", enter="rise")
        elif t == "redact":
            sp, _ = kit.text_block(d["text"], "headline", 52 * S, ink, w, max_lines=1, shadow=int(5 * S) if on_image else 0)
            b.update(sprite=sp, anchor="left" if align == "left" else "center", enter="fade")
        elif t == "timeline":
            b.update(anchor="left", enter="none")
        elif t in ("bento_card", "stat_card"):
            sp = kit.bento_card(d.get("title", d.get("kicker", "")), d.get("value", d.get("text", "100%")),
                                d.get("delta"), d.get("progress"), d.get("sub", ""), look, S, w)
            b.update(sprite=kit.fit_into(sp, w, h) if sp.width > w or sp.height > h else sp,
                     anchor="center", enter=d.get("enter", "rise"))
        elif t in ("speech_bubble", "thought_bubble"):
            sp = kit.speech_bubble(d["text"], d.get("tail", "bottom_left"), look, S, w,
                                   thought=(t == "thought_bubble" or bool(d.get("thought"))))
            b.update(sprite=kit.fit_into(sp, w, h) if sp.width > w or sp.height > h else sp,
                     anchor="center", enter=d.get("enter", "pop"))
        elif t == "highlight_sweep":
            sp = kit.highlight_sweep_sprite(d["text"], 1.0, look, S, w)
            b.update(sprite=kit.fit_into(sp, w, h) if sp.width > w or sp.height > h else sp,
                     anchor="center", enter=d.get("enter", "rise"))
        self.built = b
        return b

    def _build_visual(self, w, h):
        e, look, S, d = self.e, self.look, self.e.S, self.d
        src_name = d.get("name") or d.get("src")
        p = find_image(src_name)
        if not p:
            ph = kit.rounded(int(w * 0.8), int(h * 0.8), int(16 * S), (90, 30, 30, 200))
            t, _ = kit.text_block("MISSING: " + src_name, "mono", 26 * S, (255, 255, 255), w * 0.7, max_lines=2)
            ph.alpha_composite(t, ((ph.width - t.width) // 2, (ph.height - t.height) // 2))
            return {"sprite": ph, "enter": "fade"}
        im = Image.open(p)
        ink = e.ink(self.sc)
        label = d.get("label")
        lab = None
        if label and self.type == "asset":
            ls = d.get("label_style") or look.get("label_style", "pill")
            if ls == "plain":        # plain dark text under the illustration (the Hindi explainer look)
                lab = kit.trim(kit.text_block(label, "body", 40 * S, ink, w, max_lines=2, align="center")[0])
            elif ls == "note":
                lab = kit.text_box(label, "note", look, 40 * S, w, S)
            else:
                lab = kit.pill(label, "headline", 46 * S, kit.readable_on(look["accent2"]) if look.get("paper") else look["ink"],
                               tuple(look["accent2"]) + (255,) if look.get("paper") else tuple(look["panel"][:3]) + (230,),
                               w, radius=int(8 * S))
        avail_h = h - (lab.height + 10 * S if lab else 0)
        frame = d.get("frame") or (look["asset_frame"] if self.type == "asset" else look["photo_frame"])
        seed = zlib.crc32(str(src_name).encode())
        tilt = d.get("tilt", 0.0)
        if frame in ("sticker", "polaroid", "retro", "torn") and "tilt" not in d:
            tilt = (-2.6, 2.2, -1.6, 2.8)[zlib.crc32(str(self.slot or src_name).encode()) % 4]
        ht = d.get("halftone", look.get("halftone" if self.type == "asset" else "photo_halftone"))
        if ht is True:
            ht = "bw"

        def dot(img):                # dot-screen print at a fixed on-screen dot pitch (~7 px at 1080p)
            return collage.halftone(img.convert("RGBA"), cell=max(5, int(round(look.get("dot", 7) * S))), mode=ht,
                                    spot=self.col(d.get("spot"), "accent2"),
                                    paper=tuple(look.get("print_paper", (250, 247, 238))))

        if self.type == "asset":
            im = kit.trim(im.convert("RGBA"))
            im = kit.fit_into(im, w * 0.84, avail_h * 0.84)
            if ht:
                im = dot(im)
            ground = d.get("ground", look.get("ground", False))
            framed = {"sticker": lambda: kit.frame_sticker(im, S), "paper": lambda: kit.frame_paper(im, S),
                      "card": lambda: kit.frame_card(im.convert("RGBA"), S, look),
                      "polaroid": lambda: kit.frame_polaroid(im, S, tilt=tilt),
                      "flat": lambda: collage.frame_flat(im, S),
                      "cutout": lambda: collage.frame_cutout(im, S, ground=ground, tilt=tilt),
                      "retro": lambda: collage.frame_cutout(im, S, border=0.032, tilt=tilt),
                      "torn": lambda: collage.frame_torn(im, S, seed=seed, tilt=tilt),
                      "gilt": lambda: collage.frame_gilt(im, S),
                      }.get(frame, lambda: kit.frame_clean(im, S))()
            if tilt and frame == "sticker":
                framed = framed.rotate(tilt, expand=True, resample=Image.BICUBIC)
        else:
            im = im.convert("RGB")
            if d.get("crop"):
                cx0, cy0, cx1, cy1 = d["crop"]
                im = im.crop((int(cx0 * im.width), int(cy0 * im.height), int(cx1 * im.width), int(cy1 * im.height)))
            aspect = d.get("aspect", 0.82 if frame == "polaroid" else w / max(1, avail_h))
            im = kit.photo_crop(im, aspect)
            im = kit.fit_into(im, w * 0.80, avail_h * 0.74 if frame == "polaroid" else avail_h * 0.86)
            if ht:
                im = dot(im)
            if frame == "polaroid":
                framed = kit.frame_polaroid(im, S, caption=d.get("caption", ""), tilt=tilt,
                                            pin=look["string_color"] if self.sc["layout"] == "board" else None)
            elif frame == "card":
                framed = kit.frame_card(im.convert("RGBA"), S, look, caption=d.get("caption", ""))
            elif frame == "sticker":
                framed = kit.frame_sticker(im.convert("RGBA"), S).rotate(tilt, expand=True, resample=Image.BICUBIC)
            elif frame == "torn":
                framed = collage.frame_torn(im.convert("RGBA"), S, seed=seed, tilt=tilt)
            elif frame in ("cutout", "retro"):
                framed = collage.frame_cutout(im.convert("RGBA"), S, border=0.012 if frame == "cutout" else 0.032, tilt=tilt)
            elif frame == "flat":
                framed = collage.frame_flat(im.convert("RGBA"), S)
            elif frame == "gilt":
                framed = collage.frame_gilt(im, S)
            else:
                framed = kit.frame_print(im, S, tilt=tilt)
        framed = kit.fit_into(framed, w, avail_h) if (framed.width > w or framed.height > avail_h) else framed
        default_enter = {"sticker": "pop", "polaroid": "drop", "paper": "slide", "card": "rise", "torn": "snap",
                         "cutout": "snap", "retro": "pop", "flat": "rise", "gilt": "drop"}.get(frame, "rise")
        return {"sprite": framed, "label": lab, "enter": d.get("enter", d.get("_enter", default_enter))}

    # ---------------------------------------------------------------- animation state
    def state(self, t, kind):
        S = self.e.S
        dt = t - self.t_in
        sx = dy = dx = rot = 0.0
        op, scale, reveal = 1.0, 1.0, 1.0
        p = kit.clamp(dt / ENTER_D)
        ee = kit.ease_out_expo(p)
        if kind == "rise":
            dy, op, scale = (1 - ee) * 32 * S, kit.clamp(dt / 0.26), 0.98 + 0.02 * ee
        elif kind == "pop":
            scale, op = 0.88 + 0.12 * kit.ease_out_back(kit.clamp(dt / 0.35), 1.15), kit.clamp(dt / 0.15)
        elif kind in ("zoom", "push_in"):
            scale, op = 0.94 + 0.06 * ee, kit.clamp(dt / 0.25)
        elif kind == "drop":
            dy, op, rot = -(1 - kit.ease_out_back(kit.clamp(dt / 0.45), 1.15)) * 90 * S, kit.clamp(dt / 0.18), (1 - ee) * 3
        elif kind == "slide":
            dx, op = (1 - ee) * 80 * S, kit.clamp(dt / 0.25)
        elif kind == "slide_l":
            dx, op = -(1 - ee) * 80 * S, kit.clamp(dt / 0.25)
        elif kind == "fade":
            op = kit.ease_out_cubic(kit.clamp(dt / 0.35))
        elif kind in ("wipe", "draw"):
            reveal = kit.ease_out_expo(kit.clamp(dt / 0.45))
        elif kind == "type":
            reveal = kit.clamp(dt / 0.6)
        elif kind == "slam":
            q = kit.ease_out_cubic(kit.clamp(dt / 0.16))
            scale, op = 1.35 - 0.35 * q, kit.clamp(dt / 0.08)
        elif kind == "grow":      # giant backdrop type swells in slowly
            scale, op = 0.92 + 0.08 * ee, kit.clamp(dt / 0.35)
        elif kind == "snap":      # paper settles with a subtle, gentle tactile bounce
            q = kit.ease_out_back(kit.clamp(dt / 0.30), 1.15)
            scale, op, rot = 1.08 - 0.08 * q, kit.clamp(dt / 0.10), (1 - q) * -2.0
        if self.exit and t > self.t_out - EXIT_D:
            q = kit.clamp((self.t_out - t) / EXIT_D)
            op *= q
            dy += (1 - q) * 22 * S
        return dx, dy, scale, op, rot, reveal

    def alive(self, t):
        return self.t_in <= t < self.t_out

    def settled_at(self):
        """Time after which this item no longer changes between frames (its entrance, draw-on, count-up and sub-cues
        are finished). Used by the frame cache: a scene whose items are all settled is composed once, not per frame."""
        if "_settled" not in self.__dict__:
            t0, d, k = self.t_in, self.d, self.type
            tail = 1.2
            if k == "counter":
                tail = d.get("dur", 1.4) + 0.3
            elif k in ("title", "quote"):
                tail = 1.5
            elif k == "highlight_sweep":
                tail = 1.35
            elif k in OVERLAYS:
                tail = 1.7
            subs = [x.get("_t", t0) for x in (d.get("items") or d.get("points") or d.get("rows") or [])]
            self._settled = max(t0 + tail, (max(subs) + 1.6) if subs else 0.0)
            if k == "redact":
                self._settled = max(self._settled, d.get("_reveal", t0 + 0.8) + 0.7)
        return self._settled

    # ---------------------------------------------------------------- draw
    def draw(self, cv, t, ox=0, oy=0):
        if not self.alive(t):
            return
        b = self.build()
        x, y, w, h = self.rect
        x += ox; y += oy
        dx, dy, scale, op, rot, reveal = self.state(t, b.get("enter", "rise"))
        t_ = self.type
        if t_ == "highlight_sweep" and 0 <= t - self.t_in < 1.2:
            S = self.e.S * (1.22 if self.e.aspect == "9:16" else 1.0)
            sweep_p = kit.clamp((t - self.t_in - 0.18) / 0.95)
            q_step = int(round(sweep_p * 24))
            if q_step not in self.cache:
                sp_sw = kit.highlight_sweep_sprite(self.d["text"], q_step / 24.0, self.look, S, w)
                self.cache[q_step] = kit.fit_into(sp_sw, w, h) if sp_sw.width > w or sp_sw.height > h else sp_sw
            sp = kit.with_alpha(self.cache[q_step], op)
            px = x + (w - sp.width) / 2 + dx
            py = y + (h - sp.height) / 2 + dy
            cv.paste(sp, (int(px), int(py)), sp)
            self.bbox = (px, py, sp.width, sp.height)
            return
        if t_ in ("title", "quote") and "rows" in b:
            yy = y
            total_h = sum(r.height for r in b["rows"]) * 0.86
            if b["anchor"] == "center" or self.sc["layout"] in ("quote",):
                yy = y + max(0, (h - total_h) / 2)
            for i, row in enumerate(b["rows"]):
                ldt = t - self.t_in - i * 0.09
                pp = kit.ease_out_expo(kit.clamp(ldt / 0.6))
                if pp <= 0:
                    yy += row.height * 0.86
                    continue
                off = int((1 - pp) * row.height * 0.75)
                vis = row.crop((0, 0, row.width, max(1, row.height - off)))
                vis = kit.with_alpha(vis, op)
                xx = x - b.get("pad", 0) if b["anchor"] == "left" else x + (w - row.width) / 2
                cv.paste(vis, (int(xx), int(yy + off + dy - b.get("pad", 0) * 0.5)), vis)
                yy += row.height * 0.86
            # accent underline
            uw = kit.ease_out_expo(kit.clamp((t - self.t_in - 0.35) / 0.5))
            if uw > 0 and t_ == "title" and self.d.get("underline", self.look.get("title_underline", False)):
                bw = int(w * 0.16 * uw)
                bx = x + (0 if b["anchor"] == "left" else (w - w * 0.16) / 2)
                ImageDraw.Draw(cv).rectangle([bx, yy + 6 * self.e.S, bx + bw, yy + 13 * self.e.S], fill=tuple(self.look["accent"]))
            if b.get("sub") is not None:
                sub = kit.with_alpha(b["sub"], op * kit.clamp((t - self.t_in - 0.3) / 0.35))
                sx = x if b["anchor"] == "left" else x + (w - sub.width) / 2
                cv.paste(sub, (int(sx), int(yy + 26 * self.e.S + dy)), sub)
            return
        if t_ == "counter":
            d = self.d
            p = kit.ease_out_expo(kit.clamp((t - self.t_in) / d.get("dur", 1.4)))
            c_from = d.get("from", d.get("start", 0))
            c_to = d.get("to", d.get("end", 100))
            val = c_from + (c_to - c_from) * p
            txt = f"{d.get('prefix', '')}{int(round(val)):,}{d.get('suffix', '')}".replace(",", "" if d.get("plain", True) else ",")
            if txt not in self.cache:
                sp, _ = kit.text_block(txt, "display", 150 * self.e.S, self.look["accent2"], w, max_lines=1,
                                       shadow=int(6 * self.e.S) if self.sc["bg_is_image"] else 0)
                self.cache = {txt: kit.fit_into(sp, w, h) if sp.height > h or sp.width > w else sp}
            sp = kit.with_alpha(self.cache[txt], op)
            xx = x if b["anchor"] == "left" else x + (w - sp.width) / 2
            cv.paste(sp, (int(xx), int(y + (h - sp.height) / 2 + dy)), sp)
            return
        if t_ == "list":
            yy = y
            for i, (row, it) in enumerate(zip(b["rows"], self.d["items"])):
                ti = it.get("_t", self.t_in + i * 0.6)
                ldt = t - ti
                if ldt < 0:
                    break
                pp = kit.ease_out_expo(kit.clamp(ldt / 0.5))
                vis = kit.with_alpha(row, kit.clamp(ldt / 0.25) * op)
                cv.paste(vis, (int(x + (1 - pp) * 60 * self.e.S), int(yy)), vis)
                yy += row.height + 14 * self.e.S
            return
        if t_ == "timeline":
            self._draw_timeline(cv, t, x, y, w, h, op)
            return
        if t_ == "chart":
            self._draw_chart(cv, t, x, y, w, h, op)
            return
        if t_ == "redact":
            sp = kit.with_alpha(b["sprite"], op)
            xx = x if b["anchor"] == "left" else x + (w - sp.width) / 2
            yy = y + (h - sp.height) / 2
            cv.paste(sp, (int(xx), int(yy)), sp)
            rv = self.d.get("_reveal", self.t_in + 0.8)
            q = kit.ease_in_out(kit.clamp((t - rv) / 0.45))
            pad = sp.height * 0.18
            bx0 = xx + pad + (sp.width - 2 * pad) * q
            if q < 1:
                ImageDraw.Draw(cv).rectangle([bx0, yy + pad, xx + sp.width - pad, yy + sp.height - pad], fill=(8, 8, 10))
            return
        if t_ == "callout":
            self._draw_callout(cv, t, b, x, y, w, h, scale, op)
            return
        # generic sprite (kicker, keyword, stamp, lower_third, asset, photo, bento_card, speech_bubble)
        sp = b["sprite"]
        if reveal < 1:
            if b.get("enter") == "type":
                sp = kit.feathered_wipe(sp, round(reveal * 24) / 24, feather_px=max(2, int(4 * self.e.S)))
            else:
                sp = kit.feathered_wipe(sp, reveal, feather_px=max(6, int(24 * self.e.S)))
        if scale != 1.0 or rot:
            sp = sp.resize((max(1, int(sp.width * scale)), max(1, int(sp.height * scale))), Image.BILINEAR)
            if rot:
                sp = sp.rotate(rot, expand=True, resample=Image.BILINEAR)
        sp = kit.with_alpha(sp, op)
        lab = b.get("label")
        lab_h = lab.height + 10 * self.e.S if lab is not None else 0
        if b["anchor"] == "left":
            px, py = x + dx, y + (h - b["sprite"].height) / 2 + dy
            if self.type == "kicker":      # sit on the slot's bottom edge: a taller v3 tag grows into the top margin
                py = y + h - b["sprite"].height + dy
        else:
            full_h = b["sprite"].height
            px = x + (w - sp.width) / 2 + dx
            py = y + (h - lab_h - full_h) / 2 + dy - (sp.height - full_h) / 2
        jx, jy = self.jitter(t)
        px, py = px + jx, py + jy
        cv.paste(sp, (int(px), int(py)), sp)
        if lab is not None:
            lt = t - self.t_in - 0.25
            if lt > 0:
                lp = kit.ease_out_expo(kit.clamp(lt / 0.4))
                l2 = kit.with_alpha(lab.crop((0, 0, max(1, int(lab.width * lp)), lab.height)), op)
                cv.paste(l2, (int(x + (w - lab.width) / 2), int(y + h - lab.height)), l2)
        self.bbox = (px, py, sp.width, sp.height)
        acc = self.d.get("accent")
        if acc and t - self.t_in > 0.4:
            self._draw_accent(cv, t, acc, (x + (w - b["sprite"].width) / 2, y + (h - lab_h - b["sprite"].height) / 2,
                                           b["sprite"].width, b["sprite"].height))

    def _draw_accent(self, cv, t, kind, box):
        S, col = self.e.S, self.look["ink"] if self.look.get("paper") else self.look["accent2"]
        p = kit.ease_out_expo(kit.clamp((t - self.t_in - 0.4) / 0.45))
        bx, by, bw, bh = box
        if kind == "burst":   # emphasis ticks OUTSIDE the top-right corner, never over the asset
            if not hasattr(self.e, "_burst_assets"):
                self.e._burst_assets = set()
            asset_key = (self.sc.get("id"), self.d.get("name", ""))
            if asset_key not in self.e._burst_assets:
                if len(self.e._burst_assets) >= 2:
                    return   # Strict budget cap: max 2 burst accents across the entire video
                self.e._burst_assets.add(asset_key)
            cx, cy = bx + bw * 1.0, by + bh * 0.02
            col = self.look["accent"]
            for a, b_ in kit.burst_points(cx, cy, 30 * S, n=5, a0=-140, a1=20):
                a2 = (a[0] + (b_[0] - a[0]) * 1.9, a[1] + (b_[1] - a[1]) * 1.9)
                ImageDraw.Draw(cv).line([a, (a[0] + (a2[0] - a[0]) * p, a[1] + (a2[1] - a[1]) * p)],
                                        fill=tuple(col), width=max(4, int(8 * S)))
        elif kind == "circle":
            pts = kit.scribble_circle(bx + bw / 2, by + bh / 2, bw * 0.56, bh * 0.56, seed=len(self.d.get("name", "")))
            kit.draw_path(cv, pts, p, self.look["accent"], max(3, int(6 * S)))
        elif kind == "underline":
            kit.draw_path(cv, kit.squiggle(bx + bw * 0.1, bx + bw * 0.9, by + bh + 8 * S, 5 * S), p, self.look["accent"], max(3, int(5 * S)))

    def _draw_callout(self, cv, t, b, x, y, w, h, scale, op):
        S = self.e.S
        tx, ty = self.d.get("point", (0.5, 0.4))
        tx, ty = tx * self.e.W, ty * self.e.H
        sp = b["sprite"]
        px = x + (w - sp.width) / 2
        py = y + (h - sp.height) / 2
        ax = px + sp.width if tx > px + sp.width else px
        ay = py + sp.height / 2
        lp = kit.ease_out_expo(kit.clamp((t - self.t_in) / 0.35))
        g = ImageDraw.Draw(cv)
        ex, ey = tx + (ax - tx) * lp, ty + (ay - ty) * lp
        g.line([tx, ty, ex, ey], fill=tuple(self.look["accent2"]), width=max(2, int(4 * S)))
        r = 9 * S
        g.ellipse([tx - r, ty - r, tx + r, ty + r], outline=tuple(self.look["accent2"]), width=max(2, int(4 * S)))
        if t - self.t_in > 0.25:
            pp = kit.ease_out_back(kit.clamp((t - self.t_in - 0.25) / 0.35))
            s2 = sp.resize((max(1, int(sp.width * (0.7 + 0.3 * pp))), max(1, int(sp.height * (0.7 + 0.3 * pp)))), Image.BILINEAR)
            s2 = kit.with_alpha(s2, op * kit.clamp((t - self.t_in - 0.25) / 0.12))
            cv.paste(s2, (int(px + (sp.width - s2.width) / 2), int(py + (sp.height - s2.height) / 2)), s2)

    def _build_chart(self, b, w, h, S, ink):
        """Horizontal bar chart: label above each bar, textured (screen-printed) bars, value after the bar."""
        d = self.d
        rows = d["rows"]
        rowh = h / len(rows)
        lab_size = min(44 * S, rowh * 0.30)
        bar_h = int(min(rowh * 0.40, 58 * S))
        vmax = d.get("max") or max(r["value"] for r in rows) * 1.08
        bar_w = int(w * 0.78)
        built = []
        for i, r in enumerate(rows):
            lab = kit.trim(kit.text_block(r["label"], "body", lab_size, ink, w, max_lines=1)[0])
            col = self.col(r.get("color"), d.get("color", "accent3"))
            length = max(2, int(bar_w * r["value"] / vmax))
            rng = collage.rng_for("bar", i, r["label"])
            tex = (collage.noise(length, bar_h, 11, rng, 15) + collage.noise(length, bar_h, 2.4, rng, 8))[..., None]
            arr = np.clip(np.array(col, np.float32) + tex, 0, 255).astype(np.uint8)
            bar = Image.fromarray(np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]), "RGBA")
            val = kit.trim(kit.text_block(f"{r['value']:g}{r.get('suffix', d.get('suffix', ''))}", "headline",
                                          lab_size * 1.1, ink, w * 0.2, max_lines=1)[0])
            built.append((lab, bar, val, length))
        b.update(rows=built, anchor="left", enter="none", rowh=rowh, bar_h=bar_h)

    def _draw_chart(self, cv, t, x, y, w, h, op):
        b, S = self.build(), self.e.S
        rowh, bar_h = b["rowh"], b["bar_h"]
        for i, (lab, bar, val, length) in enumerate(b["rows"]):
            dt = t - self.d["rows"][i].get("_t", self.t_in + 0.35 * i)
            if dt < 0:
                continue
            y0 = y + i * rowh + (rowh - (lab.height + bar_h + 8 * S)) / 2
            a = kit.clamp(dt / 0.25) * op
            lab2 = kit.with_alpha(lab, a)
            cv.paste(lab2, (int(x), int(y0)), lab2)
            cl = max(1, int(length * kit.ease_out_expo(kit.clamp(dt / 0.9))))
            by = int(y0 + lab.height + 8 * S)
            seg = kit.with_alpha(bar.crop((0, 0, cl, bar_h)), a)
            cv.paste(seg, (int(x), by), seg)
            if dt > 0.9:
                v2 = kit.with_alpha(val, kit.clamp((dt - 0.9) / 0.3) * op)
                cv.paste(v2, (int(x + length + 14 * S), int(by + (bar_h - val.height) / 2)), v2)

    def _draw_timeline(self, cv, t, x, y, w, h, op):
        S, look = self.e.S, self.look
        pts = self.d["points"]
        n = len(pts)
        g = ImageDraw.Draw(cv)
        ly = y + h * 0.5
        times = [pt.get("_t", self.t_in + i * 0.8) for i, pt in enumerate(pts)]
        xs = [x + w * (0.06 + 0.88 * i / max(1, n - 1)) for i in range(n)]
        cur = max([i for i, ti in enumerate(times) if ti <= t] or [0])
        p_line = kit.ease_out_expo(kit.clamp((t - self.t_in) / 0.8))
        g.line([x + w * 0.02, ly, x + w * 0.02 + (w * 0.96) * p_line, ly], fill=tuple(look["muted"]), width=max(2, int(4 * S)))
        prog_x = xs[cur] if t >= times[0] else x
        g.line([x + w * 0.02, ly, prog_x, ly], fill=tuple(look["accent"]), width=max(3, int(7 * S)))
        for i, (px, ti, pt) in enumerate(zip(xs, times, pts)):
            if t < ti:
                continue
            q = kit.ease_out_back(kit.clamp((t - ti) / 0.35))
            r = (13 if i == cur else 9) * S * q
            g.ellipse([px - r, ly - r, px + r, ly + r], fill=tuple(look["accent"] if i == cur else self.e.ink(self.sc)))
            key = ("tl", i)
            if key not in self.cache:
                yr, _ = kit.text_block(pt["label"], "display", 56 * S, look["accent2"] if i == cur else self.e.ink(self.sc), w / n * 1.1, max_lines=1, align="center")
                tx, _ = kit.text_block(pt.get("text", ""), "body", 30 * S, self.e.ink(self.sc), w / n * 1.05, max_lines=2, align="center") if pt.get("text") else (None, None)
                self.cache[key] = (yr, tx)
            yr, tx = self.cache[key]
            a = kit.clamp((t - ti) / 0.3) * op
            yr2 = kit.with_alpha(yr, a)
            cv.paste(yr2, (int(px - yr.width / 2), int(ly - 20 * S - yr.height)), yr2)
            if tx is not None:
                tx2 = kit.with_alpha(tx, a)
                cv.paste(tx2, (int(px - tx.width / 2), int(ly + 16 * S)), tx2)


# ====================================================================== engine
class Engine:
    def __init__(self, edit="EDIT.json", scale=1.0):
        self.spec = json.load(open(edit, encoding="utf-8"))
        self.style_name = self.spec.get("style", "noir")
        self.look = styles.get(self.style_name)["look"]
        self.aspect = self.spec.get("aspect", "16:9")
        bw, bh = (1080, 1920) if self.aspect == "9:16" else (1920, 1080)
        self.W, self.H = int(bw * scale) // 2 * 2, int(bh * scale) // 2 * 2
        self.S = min(self.W, self.H) / 1080
        self.fps = int(self.spec.get("fps", 24))
        self.tl = Timeline(self.spec.get("words", "WORDS.tsv"), lead=float(self.spec.get("cue_lead", 0.08)))
        self.audio = self.spec.get("audio") or next((a for a in ("mix.wav", "VO.wav") if os.path.exists(a)), None)
        self.dur = probe_duration(self.audio) if self.audio else 0.0
        self.dur = self.dur or (self.tl.end() + 1.5)
        self.slots, self.cap_rect = layouts.table(self.aspect)
        self.warnings = []
        self.variety = variety.direct(self.spec, self.style_name, self.look)   # creative-director pass (v3)
        self.warnings += variety.warnings(self.variety)
        self.cast = character.load_cast(self.spec, find_image, self.warnings)
        self.scenes = self._plan()
        self._init_captions()
        self._bg_cache = {}

    def sub_time(self, cue, default, from_t):
        if not cue:
            return default
        keep = self.tl.ptr
        self.tl.ptr = next((k for k, w in enumerate(self.tl.words) if w[1] >= from_t - 0.01), keep)
        t = self.tl.resolve(cue, default, advance=False)
        self.tl.ptr = keep
        return t

    def ink(self, sc):
        """Text colour for things drawn straight on the background: paper styles use dark ink,
        but over a photo every style needs light text (the scrim darkens behind it)."""
        ink = tuple(self.look["ink"])
        if (sc["bg_is_image"] or sc["bg"] in ("mat", "chalk")) and sum(ink) < 384:
            return (246, 242, 234)
        return ink

    def px(self, r):
        lb = self.look.get("letterbox", 0) if self.aspect == "16:9" else 0
        if lb:  # squeeze slots into the picture area between the cinema bars
            r = (r[0], lb + r[1] * (1 - 2 * lb), r[2], r[3] * (1 - 2 * lb))
        return (r[0] * self.W, r[1] * self.H, r[2] * self.W, r[3] * self.H)

    # ------------------------------------------------------------------ plan
    def _plan(self):
        scenes = []
        for i, sd in enumerate(self.spec["scenes"]):
            t0 = 0.0 if i == 0 else self.tl.resolve(sd["at"])
            layout = sd.get("layout", "hero")
            if layout not in self.slots:
                raise SystemExit(f"scene {i + 1}: unknown layout {layout!r} (have {', '.join(self.slots)})")
            stage = sd.get("stage", {} if layout == "stage" else None)
            bg = sd.get("bg", "stage" if stage is not None else "auto")
            bg_is_image = bool(find_image(bg)) if not kit.is_proc_bg(bg) and stage is None else False
            if stage is None and not kit.is_proc_bg(bg) and not bg_is_image:
                self.warnings.append(f"scene {i + 1}: background image {bg!r} missing -> procedural")
            look = dict(self.look)
            for k in ("accent", "accent2", "accent3"):
                if sd.get(k):
                    v = sd[k]
                    look[k] = tuple(int(v.lstrip("#")[j:j + 2], 16) for j in (0, 2, 4)) if isinstance(v, str) else tuple(v)
            scenes.append({"look": look, "i": i, "id": sd.get("id", f"{i + 1:02d}"), "t0": t0, "bg": bg, "bg_is_image": bg_is_image,
                           "layout": layout, "camera": sd.get("camera", self.look["camera"] if bg_is_image else "still"),
                           "transition": sd.get("transition", self.look["transition"]) if i else "cut",
                           "captions": sd.get("captions", True), "raw_items": sd.get("items", []), "items": [],
                           "raw_cuts": sd.get("cuts", []), "stage": stage})
        for a, b in zip(scenes, scenes[1:]):
            if b["t0"] <= a["t0"]:
                raise SystemExit(f"scene {b['id']} starts at {b['t0']:.2f}s, not after scene {a['id']} ({a['t0']:.2f}s): check its 'at' cue")
            a["t1"] = b["t0"]
        scenes[-1]["t1"] = self.dur
        # items (resolve after all scene starts, searching forward from each scene's own start)
        for sc in scenes:   # virtual camera cuts: several framings of one image, cut on spoken words
            sc["cuts"] = [(sc["t0"], (0.0, 0.0, 1.0, 1.0))]
            for c in sc["raw_cuts"]:
                tc = self.sub_time(c.get("at"), None, sc["t0"])
                if tc is None or not (sc["t0"] < tc < sc["t1"]):
                    self.warnings.append(f"scene {sc['id']}: cut at {c.get('at')!r} is outside the scene")
                    continue
                sc["cuts"].append((tc, self._cut_rect(c)))
            sc["cuts"].sort()
        boxes, nbox = self.look.get("boxes", ["pill"]), 0
        for sc in scenes:
            for d in sc["raw_items"]:          # rotate keyword treatments so consecutive keywords never look alike
                if d.get("type") == "keyword":
                    d["_variant"] = nbox            # colour-block / ransom variants rotate too
                    if not d.get("box"):
                        d["_auto_box"] = boxes[nbox % len(boxes)]
                    nbox += 1
            self.tl.ptr = next((k for k, w in enumerate(self.tl.words) if w[1] >= sc["t0"] - 1e-3), 0)
            slots = self.slots[sc["layout"]]
            occupied = {}
            n_actors = sum(1 for d in sc["raw_items"] if d.get("type") == "character")
            if n_actors > 1:                              # several actors: smaller so they fit side by side
                for d in sc["raw_items"]:
                    if d.get("type") == "character":
                        d["_height"] = (0.62 if self.aspect == "9:16" else 0.86)
            for n, d in enumerate(sc["raw_items"]):
                it = character.CharacterItem(d, sc, self) if d.get("type") == "character" else Item(d, sc, self)
                it.t_in = self.tl.resolve(d.get("at"), sc["t0"] + 0.15 + 0.12 * n)
                if not (sc["t0"] - 0.01 <= it.t_in < sc["t1"]):
                    self.warnings.append(f"scene {sc['id']}: {it.type} {d.get('text', d.get('name', ''))!r} cue at {it.t_in:.2f}s is outside the scene ({sc['t0']:.2f}-{sc['t1']:.2f}s)")
                    it.t_in = min(max(it.t_in, sc["t0"]), sc["t1"] - 0.3)
                # sub-cues (list rows, timeline points, redact reveal) resolve NOW, searching forward from this item
                for k, sub in enumerate(d.get("items", []) if it.type == "list" else d.get("points", []) if it.type == "timeline"
                                        else d.get("rows", []) if it.type == "chart" else []):
                    sub["_t"] = self.sub_time(sub.get("at"), it.t_in + k * 0.6, it.t_in)
                if it.type == "redact":
                    d["_reveal"] = self.sub_time(d.get("reveal"), it.t_in + 0.8, it.t_in)
                until = self.tl.resolve(d.get("until"), None, advance=False) if d.get("until") else None
                it.t_out = until if until else sc["t1"] + TRANS_D
                it.exit = bool(until)
                if it.type in OVERLAYS:      # lines between two slots / points: no slot of their own
                    it.t_out = sc["t1"] + TRANS_D
                    sc["items"].append(it)
                    continue
                cands = [d["slot"]] if d.get("slot") else [s for s in layouts.PREFER.get(it.type, []) if s in slots and slots[s][2] > 0]
                if not cands and it.type == "character":     # layout without a cast slot: default host zone
                    self.warnings.append(f"scene {sc['id']}: layout {sc['layout']!r} has no 'cast' slot -- character placed "
                                         f"in the default zone (use presenter / presenter_l / stage)")
                    it.rect = self.px((0.66, 0.14, 0.31, 0.625) if self.aspect == "16:9" else (0.10, 0.45, 0.80, 0.24))
                    it.resolve()
                    sc["items"].append(it)
                    continue
                if not cands:
                    self.warnings.append(f"scene {sc['id']}: no slot for {it.type} in layout {sc['layout']!r}")
                    continue
                if cands[0] not in slots:
                    self.warnings.append(f"scene {sc['id']}: slot {cands[0]!r} not in layout {sc['layout']!r} (has {', '.join(slots)})")
                    continue
                chosen = next((s for s in cands if not any(o.alive(it.t_in) for o in occupied.get(s, []))), cands[0])
                if it.type == "character":    # several actors share one stage: characters never evict each other
                    pass
                elif it.type != "block":      # colour blocks are a backdrop layer: they neither evict nor get evicted
                    for o in occupied.get(chosen, []):
                        if o.alive(it.t_in):      # replace: previous occupant exits as this one enters
                            o.t_out, o.exit = it.t_in + 0.05, True
                    occupied.setdefault(chosen, []).append(it)
                it.slot, it.rect = chosen, self.px(slots[chosen])
                if it.type == "character":
                    it.resolve()
                sc["items"].append(it)
            if sc["stage"] is not None:                 # parallax world + camera that tracks the walking character
                sc["_stage"] = character.Stage(self, sc, find_image)
                chars = [i for i in sc["items"] if i.type == "character"]
                want = sc["stage"].get("track", chars[0].d.get("cast") if chars else None)
                tr = next((i for i in chars if i.d.get("cast") == want), None)
                if tr is not None and want is not False:
                    sc["_stage"].track(tr)
                    for o in chars:                     # everyone on the stage lives in the same moving world
                        o.camx = sc["_stage"].cam_at
        return scenes

    def _init_captions(self):
        self.cap_keys = [w for w in self.spec.get("highlight_words", []) if w]
        mode = self.spec.get("captions", "auto")
        self.cap_style = self.look["caption"] if mode in ("auto", True, "on") else mode
        if mode in ("off", False):
            self.phrases = []
            return
        if self.cap_style == "pop":
            self.phrases = self.tl.phrases(max_chars=18, max_words=3)
        else:
            self.phrases = self.tl.phrases(max_chars=40 if self.aspect == "16:9" else 26, max_words=7)
        for ph in self.phrases:
            ph["words"] = [(clean_caption_word(w), s, e) for w, s, e in ph["words"]]
            ph["words"] = [x for x in ph["words"] if x[0]]
        self.phrases = [p for p in self.phrases if p["words"]]
        off = [s for s in self.scenes if not s["captions"]]
        if off:
            self.phrases = [p for p in self.phrases if not any(s["t0"] <= p["start"] < s["t1"] for s in off)]
        self._cap_cache = {}

    # ------------------------------------------------------------------ backgrounds & camera
    @staticmethod
    def _cut_rect(c):
        fr = c.get("frame", "close")
        if isinstance(fr, (list, tuple)):
            x0, y0, x1, y1 = fr
            return (x0, y0, x1, y1)
        size = {"wide": 1.0, "medium": 0.78, "close": 0.6, "extreme": 0.45}.get(fr, 0.6)
        fx, fy = c.get("focus", [0.5, 0.5])
        x0 = min(max(0.0, fx - size / 2), 1 - size)
        y0 = min(max(0.0, fy - size / 2), 1 - size)
        return (x0, y0, x0 + size, y0 + size)

    def _bg_base(self, sc, rect=(0.0, 0.0, 1.0, 1.0)):
        key = (sc["bg"], sc["layout"], rect)
        if key in self._bg_cache:
            return self._bg_cache[key]
        if len(self._bg_cache) > 5:
            self._bg_cache.pop(next(iter(self._bg_cache)))
        if sc["bg_is_image"]:
            im = Image.open(find_image(sc["bg"])).convert("RGB")
            # cover-crop the source to the frame aspect, then take the cut's sub-rectangle
            ar = self.W / self.H
            if im.width / im.height > ar:
                cw, ch = im.height * ar, im.height
            else:
                cw, ch = im.width, im.width / ar
            cx0, cy0 = (im.width - cw) / 2, (im.height - ch) / 2
            x0, y0, x1, y1 = rect
            im = im.resize((self.W, self.H), Image.LANCZOS,
                           box=(cx0 + x0 * cw, cy0 + y0 * ch, cx0 + x1 * cw, cy0 + y1 * ch))
            im = Image.alpha_composite(im.convert("RGBA"), self._scrim(sc["layout"])).convert("RGB")
        else:
            im = kit.procedural_bg(sc["bg"], self.W, self.H, sc["look"])
        self._bg_cache[key] = im
        return im

    def _scrim(self, layout):
        """Darkening gradients that keep text legible over busy photos."""
        W, H = self.W, self.H
        a = np.zeros((H, W), np.float32)
        xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
        yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
        if self.aspect == "16:9":
            if layout in ("hero",):
                a = np.maximum(a, 0.78 * np.clip(1 - xx / 0.62, 0, 1) ** 1.4)
            elif layout == "hero_r":
                a = np.maximum(a, 0.78 * np.clip((xx - 0.38) / 0.62, 0, 1) ** 1.4)
            elif layout in ("duo", "trio", "board", "focus", "quote", "split", "timeline"):
                a = np.maximum(a, np.full_like(a, 0.45))
                a = np.maximum(a, 0.7 * np.clip(1 - yy / 0.3, 0, 1))
            a = np.maximum(a, 0.62 * np.clip((yy - 0.62) / 0.38, 0, 1) ** 1.2)       # caption band
        else:
            a = np.maximum(a, 0.7 * np.clip(1 - yy / 0.28, 0, 1))
            a = np.maximum(a, 0.75 * np.clip((yy - 0.55) / 0.45, 0, 1))
            if layout != "clean":
                a = np.maximum(a, np.full_like(a, 0.25))
        out = np.zeros((H, W, 4), np.uint8)
        out[..., 3] = (a * 255).astype(np.uint8)
        return Image.fromarray(out, "RGBA")

    def _bg_frame(self, sc, t):
        if sc.get("_stage") is not None:
            return sc["_stage"].background(t, self.W)
        base = self._bg_base(sc, (0.0, 0.0, 1.0, 1.0))
        cam = sc["camera"]
        if not sc["bg_is_image"] or (cam == "still" and len(sc["cuts"]) <= 1):
            return base.copy()
        tq = math.floor(t * CAM_FPS) / CAM_FPS
        ckey = (sc["i"], round(tq * CAM_FPS))
        wc = self.__dict__.setdefault("_warp_cache", {})
        if not self.NO_CACHE and ckey in wc:
            return wc[ckey].copy()
        k = max(i for i, (tc, _) in enumerate(sc["cuts"]) if tc <= tq or i == 0)
        c0, rect = sc["cuts"][k]
        # Smooth quintic camera reframing across intra-scene cuts (no jarring jump cuts)
        if k > 0 and tq - c0 < 0.55:
            prev_rect = sc["cuts"][k - 1][1]
            u = kit.ease_in_out_quint(kit.clamp((tq - c0) / 0.55))
            rect = tuple(prev_rect[j] + (rect[j] - prev_rect[j]) * u for j in range(4))
        p = kit.ease_in_out(kit.clamp((tq - sc["t0"]) / max(0.5, sc["t1"] - sc["t0"])))
        W, H = self.W, self.H
        z, px_, py_ = 1.0, 0.0, 0.0
        if cam == "push_in":
            z = 1.0 + 0.042 * p
        elif cam == "pull_out":
            z = 1.042 - 0.042 * p
        elif cam == "pan_left":
            z, px_ = 1.04, (0.5 - p) * 0.42
        elif cam == "pan_right":
            z, px_ = 1.04, (p - 0.5) * 0.42
        elif cam == "rise":
            z, py_ = 1.04, (0.5 - p) * 0.42
        elif cam != "still":  # drift
            z, px_ = 1.018 + 0.024 * p, (p - 0.5) * 0.34
        rx0, ry0, rx1, ry1 = rect
        rw, rh = max(1.0, (rx1 - rx0) * W), max(1.0, (ry1 - ry0) * H)
        cw, ch = rw / z, rh / z
        x0 = rx0 * W + (rw - cw) / 2 + (rw - cw) / 2 * px_
        y0 = ry0 * H + (rh - ch) / 2 + (rh - ch) / 2 * py_
        if cv2 is not None:
            cache = self.__dict__.setdefault("_np_cache", {})
            arr = cache.get((sc["bg"], sc["layout"]))
            if arr is None:
                if len(cache) > 3:
                    cache.clear()
                arr = cache[(sc["bg"], sc["layout"])] = np.asarray(base)
            sx, sy = W / cw, H / ch
            m = np.float32([[sx, 0, -x0 * sx], [0, sy, -y0 * sy]])
            out = Image.fromarray(cv2.warpAffine(arr, m, (W, H), flags=cv2.INTER_LINEAR))
        else:
            out = base.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
        if not self.NO_CACHE:
            if len(wc) >= 4:
                wc.pop(next(iter(wc)))
            wc[ckey] = out.copy()
        return out

    # ------------------------------------------------------------------ captions
    def _caption_sprite(self, pi, active):
        key = (pi, active)
        if key in self._cap_cache:
            return self._cap_cache[key]
        if len(self._cap_cache) > 60:
            self._cap_cache.clear()
        S, look = self.S, self.look
        ph = self.phrases[pi]
        words = [w for w, _, _ in ph["words"]]
        text = " ".join(words)
        cx, cy, cw, chh = self.px(self.cap_rect)
        style = self.cap_style
        role = "display" if style == "pop" else "caption"
        base = (82 if style == "pop" else 50) * S * (1.18 if self.aspect == "9:16" else 1)
        size, lines, f, sp = kit.fit_text(text, role, base, cw * 0.92, max_lines=2)
        dev = bool(kit.DEV.search(text))
        lh = size * (1.32 if dev else 1.15)
        widths = [sum(x[2] for x in l) + sp * (len(l) - 1) for l in lines]
        padx, pady = int(size * 0.55), int(size * 0.32)
        Wc = int(max(widths) + padx * 2)
        Hc = int(lh * len(lines) + pady * 2)
        im = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        g = ImageDraw.Draw(im)
        if style == "box":
            g.rounded_rectangle([0, 0, Wc - 1, Hc - 1], int(size * 0.3), fill=tuple(look["panel"][:3]) + (226,))
        elif style == "plate":      # solid mustard block, dark text (the Hindi explainer caption)
            g.rectangle([0, 0, Wc - 1, Hc - 1], fill=tuple(look["accent2"]) + (255,))
        elif style == "cinema" and not self.scenes[0]["bg_is_image"] and look.get("paper"):
            g.rounded_rectangle([0, 0, Wc - 1, Hc - 1], int(size * 0.3), fill=(250, 246, 236, 220))
        asc = f.getmetrics()[0]
        k = 0
        hi = tuple(look["accent2"])
        ink = (255, 255, 255) if style not in ("box", "plate") else tuple(look["ink"])
        if style == "plate":
            ink = kit.readable_on(hi)
        for li, (l, lw) in enumerate(zip(lines, widths)):
            x = (Wc - lw) / 2
            yb = pady + asc * (0.92 if dev else 1.0) + li * lh
            line_str = " ".join(w for w, _, _ in l) or "A"
            try:
                _, l_top, _, l_bot = f.getbbox(line_str, anchor="ls")
                top_px = max(size * (0.76 if dev else 0.70), -l_top + size * 0.10)
                bot_px = max(size * (0.22 if dev else 0.16), l_bot + size * 0.10)
            except Exception:
                top_px, bot_px = size * 0.88, size * 0.28
            for w, _, ww in l:
                state = "past" if k < active else ("now" if k == active else "future")
                key_word = any(h in w for h in self.cap_keys)
                if style == "plate":
                    col = ink + (255,)
                elif style == "box" and state == "now":
                    try:
                        bx0, _, bx1, _ = f.getbbox(w, anchor="ls")
                        wl, wr = x + min(0, bx0), x + max(ww, bx1)
                    except Exception:
                        wl, wr = x, x + ww
                    g.rounded_rectangle([wl - size * 0.14, yb - top_px, wr + size * 0.14, yb + bot_px],
                                        int(size * 0.18), fill=hi + (255,))
                    col = kit.readable_on(hi) + (255,)
                elif state == "now":
                    col = hi + (255,)
                elif key_word and state == "past":   # spec "highlight_words": key terms stay coloured
                    col = tuple(look["accent"]) + (255,)
                elif state == "past":
                    col = ink + (255,)
                else:
                    col = ink + (int(255 * (0.5 if style == "cinema" else 1.0)),)
                if style == "pop":
                    g.text((x, yb), w, font=f, fill=col, anchor="ls", stroke_width=max(3, int(size * 0.09)), stroke_fill=(0, 0, 0, 255))
                elif style == "cinema":
                    g.text((x, yb), w, font=f, fill=col, anchor="ls", stroke_width=max(2, int(size * 0.05)), stroke_fill=(0, 0, 0, 170))
                else:
                    g.text((x, yb), w, font=f, fill=col, anchor="ls")
                x += ww + sp
                k += 1
        if style in ("cinema", "pop"):
            im = kit.shadow(im, blur=int(8 * S), dy=int(3 * S), alpha=0.7)
        elif style == "plate":
            im = kit.shadow(im, blur=int(6 * S), dy=int(3 * S), alpha=0.22)
        self._cap_cache[key] = im
        return im

    def _draw_captions(self, cv, t):
        cx, cy, cw, chh = self.px(self.cap_rect)
        for pi, ph in enumerate(self.phrases):
            if ph["start"] - 0.06 <= t < ph["hold"]:
                active = max([k for k, (_, s, _) in enumerate(ph["words"]) if s <= t] or [0])
                if t > ph["end"]:
                    active = len(ph["words"])
                sp = self._caption_sprite(pi, active)
                dt = t - ph["start"] + 0.06
                e = kit.ease_out_expo(kit.clamp(dt / 0.22))
                sp2 = kit.with_alpha(sp, kit.clamp(dt / 0.12))
                x = cx + (cw - sp.width) / 2
                y = cy + chh - sp.height + (1 - e) * 14 * self.S
                cv.paste(sp2, (int(x), int(y)), sp2)
                break

    # ------------------------------------------------------------------ frames
    def scene_at(self, t):
        for sc in self.scenes:
            if sc["t0"] <= t < sc["t1"]:
                return sc
        return self.scenes[-1]

    NO_CACHE = os.environ.get("DEEPESH_NOCACHE") == "1"       # A/B switch for benchmarking

    def _static_key(self, sc, t):
        """Key under which the composed scene body is IDENTICAL for this frame, or None while anything moves."""
        if self.NO_CACHE or sc.get("_stage") is not None:
            return None
        if self._shake(sc, t) != (0, 0):
            return None
        alive = []
        for it in sc["items"]:
            if it.t_in > t or t >= it.t_out:
                continue
            if t < it.settled_at() or (it.exit and t > it.t_out - EXIT_D):
                return None
            alive.append(id(it))
        cam_step = round(math.floor(t * CAM_FPS)) if (sc["bg_is_image"] and (sc["camera"] != "still" or len(sc["cuts"]) > 1)) else -1
        return (sc["i"], cam_step, tuple(alive), int(t * 8) if sc["look"].get("jitter") else 0)

    def _compose(self, sc, t):
        key = self._static_key(sc, t)
        if key is None:
            return self._compose_layered(sc, t) or self._compose_raw(sc, t)
        cache = self.__dict__.setdefault("_body_cache", {})
        hit = cache.get(key)
        if hit is None:
            if len(cache) >= 4:
                cache.pop(next(iter(cache)))
            hit = cache[key] = self._compose_raw(sc, t)
        return hit.copy()

    def _caption_key(self, t):
        for pi, ph in enumerate(self.phrases):
            if ph["start"] - 0.06 <= t < ph["hold"]:
                active = max([k for k, (_, s, _) in enumerate(ph["words"]) if s <= t] or [0])
                if t > ph["end"]:
                    active = len(ph["words"])
                dt = t - ph["start"] + 0.06
                return (pi, active, int(dt * self.fps) if dt < 0.3 else -1)
        return None

    def frame_key(self, t):
        """Equal keys => identical frames (so the renderer can reuse the previous frame's pixels), None = always render."""
        sc = self.scene_at(t)
        if sc["i"] > 0 and t - sc["t0"] < TRANS_D and sc["transition"] != "cut":
            return None
        body = self._static_key(sc, t)
        return None if body is None else (body, self._caption_key(t))

    def _shake(self, sc, t):
        """Screen shake offset while a stamp slams (first 0.12 s) -- subtle haptic micro-pulse."""
        ox = oy = 0
        for it in sc["items"]:
            if it.type == "stamp" and it.d.get("_family", "rubber") == "rubber" and 0 <= t - it.t_in < 0.12:
                amp = 3.0 * self.S * math.exp(-(t - it.t_in) * 26)
                ox, oy = int(math.sin(t * 70) * amp), int(math.cos(t * 60) * amp)
        return ox, oy

    @staticmethod
    def _draw_bubbles(cv, sc, t):
        for it in sc["items"]:
            if it.type == "character":
                it.draw_bubbles(cv, t)

    def _draw_overlays(self, cv, sc, t):
        for it in (i for i in sc["items"] if i.type in OVERLAYS):
            if it.type == "string":
                self._draw_string(cv, sc, it, t)
            else:
                self._draw_hand_line(cv, sc, it, t)

    def _compose_raw(self, sc, t):
        cv = self._bg_frame(sc, t)
        ox, oy = self._shake(sc, t)
        body = sorted((it for it in sc["items"] if it.type not in OVERLAYS), key=lambda it: it.z())   # stable: list order within a layer
        for it in body:
            it.draw(cv, t, ox, oy)
        if sc.get("_stage") is not None:
            sc["_stage"].foreground(cv, t, self.W)      # foreground plants / particles in front of the character
        self._draw_bubbles(cv, sc, t)                   # speech bubbles above every actor and the foreground
        self._draw_overlays(cv, sc, t)
        return cv

    def _compose_layered(self, sc, t):
        """Background (quantized at CAM_FPS) + items that have finished animating are composed ONCE and cached;
        each frame only redraws the items that are still animating (and the overlay lines)."""
        if self.NO_CACHE or sc.get("_stage") is not None:
            return None
        if self._shake(sc, t) != (0, 0):
            return None
        body = sorted((it for it in sc["items"] if it.type not in OVERLAYS), key=lambda it: it.z())
        alive = [(n, it) for n, it in enumerate(body) if it.alive(t)]
        settled = [(n, it) for n, it in alive if t >= it.settled_at() and not (it.exit and t > it.t_out - EXIT_D)]
        if not settled:
            return None
        moving = [(n, it) for n, it in alive if (n, it) not in settled]
        last_settled = max(n for n, _ in settled)
        if any(n < last_settled for n, _ in moving):          # drawing order would change: do it the slow, exact way
            return None
        cam_step = round(math.floor(t * CAM_FPS)) if (sc["bg_is_image"] and (sc["camera"] != "still" or len(sc["cuts"]) > 1)) else -1
        key = (sc["i"], cam_step, tuple(id(it) for _, it in settled), int(t * 8) if sc["look"].get("jitter") else 0)
        cache = self.__dict__.setdefault("_layer_cache", {})
        base = cache.get(key)
        if base is None:
            if len(cache) >= 6:
                cache.pop(next(iter(cache)))
            base = cache[key] = self._bg_frame(sc, t)
            for _, it in settled:
                it.draw(base, t)
        cv = base.copy()
        for _, it in moving:
            it.draw(cv, t)
        self._draw_bubbles(cv, sc, t)
        self._draw_overlays(cv, sc, t)
        return cv

    def _centre(self, sc, spec, t):
        """Centre + half-extent of a slot (its visible occupant if there is one) or a normalised [x, y] point."""
        if isinstance(spec, (list, tuple)):
            return (spec[0] * self.W, spec[1] * self.H), (0.0, 0.0)
        occ = [o for o in sc["items"] if o.slot == spec and o.alive(t) and getattr(o, "bbox", None)]
        if occ:
            x, y, w, h = occ[-1].bbox
        else:
            x, y, w, h = self.px(self.slots[sc["layout"]][spec])
        return (x + w / 2, y + h / 2), (w / 2, h / 2)

    def _edge(self, c, half, toward):
        """Point on the border of the box (c, half) facing `toward`, pushed out a little."""
        dx, dy = toward[0] - c[0], toward[1] - c[1]
        if (dx == 0 and dy == 0) or half == (0.0, 0.0):
            return c
        pad = 10 * self.S
        k = min((half[0] + pad) / abs(dx) if dx else 1e9, (half[1] + pad) / abs(dy) if dy else 1e9)
        return (c[0] + dx * k, c[1] + dy * k)

    def _draw_hand_line(self, cv, sc, it, t):
        """Hand-drawn dashed arrow or looping thread between two slots (or [x, y] points)."""
        if not it.alive(t):
            return
        d, S = it.d, self.S
        ca, ha = self._centre(sc, d["from"], t)
        cb, hb = self._centre(sc, d["to"], t)
        pa, pb = self._edge(ca, ha, cb), self._edge(cb, hb, ca)
        p = kit.ease_out_expo(kit.clamp((t - it.t_in) / (0.9 if it.type == "arrow" else 1.2)))
        col = it.col(d.get("color"), "accent")
        seed = zlib.crc32(f"{d['from']}{d['to']}".encode())
        width = max(3, int(d.get("width", 5) * S))
        if it.type == "loops":
            pts = collage.loops_path(pa, pb, loops=int(d.get("loops", 3)), seed=seed, size=float(d.get("size", 1.0)))
            kit.draw_path(cv, pts, p, col, width)
            return
        pts = collage.hand_path(pa, pb, bend=float(d.get("bend", 0.22)), seed=seed)
        if d.get("dashed", True):
            collage.draw_dashed(cv, pts, p, col, width, dash=20 * S, gap=14 * S)
        else:
            kit.draw_path(cv, pts, p, col, width)
        if d.get("head", True) and p > 0.96:
            collage.draw_arrowhead(cv, pts, col, width, 30 * S)

    def _draw_string(self, cv, sc, it, t):
        if not it.alive(t):
            return
        ends = []
        for slot in (it.d["from"], it.d["to"]):
            occ = [o for o in sc["items"] if o.slot == slot and o.alive(t)]
            if not occ:
                return
            x, y, w, h = occ[0].rect
            ends.append((x + w / 2, y + h * 0.12))
        p = kit.ease_out_expo(kit.clamp((t - it.t_in) / 0.7))
        pts = kit.bezier(ends[0], ends[1], sag=abs(ends[1][0] - ends[0][0]) * 0.12 + 20 * self.S)
        kit.draw_path(cv, pts, p, sc["look"]["string_color"], max(3, int(5 * self.S)))

    def frame(self, t):
        sc = self.scene_at(t)
        cv = self._compose(sc, t)
        i = sc["i"]
        if i > 0 and t - sc["t0"] < TRANS_D and sc["transition"] != "cut":
            p_tr = kit.clamp((t - sc["t0"]) / TRANS_D)
            e = kit.ease_in_out_quint(p_tr)
            a = self._compose(self.scenes[i - 1], t)
            tr = sc["transition"]
            W, H = self.W, self.H
            if tr in ("fade", "dissolve", "film_dissolve"):
                cv = Image.blend(a, cv, e)
            elif tr == "dip":
                dark = Image.new("RGB", cv.size, (10, 11, 14))
                cv = Image.blend(a, dark, e * 2) if e < 0.5 else Image.blend(dark, cv, (e - 0.5) * 2)
            elif tr == "flash":
                cv = Image.blend(Image.blend(a, cv, e), Image.new("RGB", cv.size, (248, 246, 240)), 0.55 * (1 - abs(2 * e - 1)))
            elif tr in ("smooth_zoom", "scale_in", "zoom"):
                # Senior-editor smooth cross-zoom: outgoing zooms in 1.0->1.08, incoming settles 1.07->1.0
                za = 1.0 + 0.08 * e
                zb = 1.07 - 0.07 * e
                cwa, cha = W / za, H / za
                a_z = a.resize((W, H), Image.BILINEAR, box=((W - cwa) / 2, (H - cha) / 2, (W + cwa) / 2, (H + cha) / 2))
                cwb, chb = W / zb, H / zb
                b_z = cv.resize((W, H), Image.BILINEAR, box=((W - cwb) / 2, (H - chb) / 2, (W + cwb) / 2, (H + chb) / 2))
                cv = Image.blend(a_z, b_z, e)
            elif tr in ("luma_wipe", "wipe"):
                feather = max(24.0, W * 0.14)
                edge = e * (W + feather)
                xs = np.arange(W, dtype=np.float32)[None, :, None]
                mask = np.clip((edge - xs) / feather, 0.0, 1.0)
                arr = np.asarray(a, np.float32) * (1.0 - mask) + np.asarray(cv, np.float32) * mask
                cv = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
            elif tr in ("slide", "paper_slide", "whip", "whip_left", "whip_right"):
                dir_sign = -1 if tr == "whip_right" else 1
                off = int((1.0 - e) * W) * dir_sign
                out = Image.new("RGB", cv.size)
                if dir_sign > 0:
                    out.paste(a, (off - W, 0))
                    out.paste(cv, (off, 0))
                else:
                    out.paste(a, (W + off, 0))
                    out.paste(cv, (off, 0))
                if tr in ("whip", "whip_left", "whip_right") and 0.06 < p_tr < 0.94:
                    # Directional horizontal motion blur (never blocky downscaling)
                    strength = math.sin(math.pi * p_tr)
                    ksize = int(max(3, round(strength * 38 * self.S)) // 2 * 2 + 1)
                    if cv2 is not None and ksize >= 3:
                        out = Image.fromarray(cv2.GaussianBlur(np.asarray(out), (ksize, 1), 0))
                cv = out
            else:
                cv = Image.blend(a, cv, e)
        lb = self.look.get("letterbox", 0) if sc["bg_is_image"] and self.aspect == "16:9" else 0
        if lb:
            g = ImageDraw.Draw(cv)
            bh = int(self.H * lb)
            g.rectangle([0, 0, self.W, bh], fill=(0, 0, 0))
            g.rectangle([0, self.H - bh, self.W, self.H], fill=(0, 0, 0))
        self._draw_captions(cv, t)
        return cv

    # ------------------------------------------------------------------ encode
    def vf(self, preview):
        if preview:
            return []
        f = [x for x in (self.look.get("grade"),) if x]
        if self.look.get("vignette"):
            f.append("vignette=angle=PI/5")
        if self.look.get("grain"):
            f.append(f"noise=alls={self.look['grain']}:allf=t")
        return f


_ENG = None


def _render_chunk(job):
    edit, scale, f0, f1, out, preview = job
    global _ENG
    if _ENG is None:
        _ENG = Engine(edit, scale)
    e = _ENG
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{e.W}x{e.H}",
           "-r", str(e.fps), "-i", "-"]
    vf = e.vf(preview)
    if vf:
        cmd += ["-vf", ",".join(vf)]
    # grain is temporal noise: it must be light (<=4) and paired with a slightly higher CRF, or files
    # balloon (alls=9 @ crf18 = 600 MB/min) and encoding becomes the bottleneck
    crf = "26" if preview else ("22" if e.look.get("grain") else "19")
    cmd += ["-c:v", "libx264", "-preset", "ultrafast" if preview else "veryfast", "-crf", crf,
            "-pix_fmt", "yuv420p", "-threads", "2", "-g", str(e.fps * 2), out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    prev_key, prev = None, None
    for fr in range(f0, f1):
        t = fr / e.fps
        k = e.frame_key(t)
        if k is None or k != prev_key:           # something changed (or is moving): render; otherwise reuse the last pixels
            prev, prev_key = e.frame(t).tobytes(), k
        pr.stdin.write(prev)
    pr.stdin.close()
    if pr.wait() != 0:
        raise RuntimeError(f"ffmpeg failed on chunk {out}")
    return out


def default_workers():
    cpus = os.cpu_count() or 2
    try:
        avail = int(open("/proc/meminfo").read().split("MemAvailable:")[1].split()[0]) / 1024
    except Exception:
        avail = 2048
    return max(1, min(cpus - 2, int(avail // 420), 6))


def _ensure_audio_mix():
    """Runs once in the parent process before spawning render workers (eliminates multi-worker race conditions)."""
    cues_is_stub = not os.path.exists("cues.tsv") or (
        os.path.exists("cues.tsv") and len([l for l in open("cues.tsv", encoding="utf-8") if l.strip()]) <= 5
    )
    if os.path.exists("VO.wav") and (not os.path.exists("mix.wav") or cues_is_stub):
        try:
            mix_script = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mix.py")
            if cues_is_stub:
                subprocess.run([sys.executable, mix_script, "--autocues",
                                *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else [])], check=False)
            if os.path.exists("cues.tsv"):
                subprocess.run([sys.executable, mix_script, "cues.tsv", "--vo", "VO.wav",
                                *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []),
                                *(["--words", "WORDS.tsv"] if os.path.exists("WORDS.tsv") else []),
                                "--out", "mix.wav"], check=False)
        except Exception:
            pass


def render_video(edit, scale, out, preview, workers, t_from=0.0, t_to=None):
    _ensure_audio_mix()
    e = Engine(edit, scale)
    for w in e.warnings:
        print("⚠", w)
    t_to = min(t_to or e.dur, e.dur)
    f_start, f_end = int(t_from * e.fps), int(math.ceil(t_to * e.fps))
    workers = workers or default_workers()
    n_chunks = max(1, min(workers * 3, (f_end - f_start) // 48))
    edges = [f_start + (f_end - f_start) * k // n_chunks for k in range(n_chunks + 1)]
    os.makedirs("_chunks", exist_ok=True)
    jobs = [(edit, scale, a, b, f"_chunks/c{k:03d}.mp4", preview) for k, (a, b) in enumerate(zip(edges, edges[1:]))]
    t0 = time.time()
    print(f"rendering {f_end - f_start} frames ({(f_end - f_start) / e.fps:.1f}s) at {e.W}x{e.H} "
          f"in {len(jobs)} chunks on {workers} workers ...", flush=True)
    import multiprocessing as mp
    with mp.get_context("fork" if hasattr(os, "fork") else "spawn").Pool(workers) as pool:   # Windows has no fork
        for k, _ in enumerate(pool.imap_unordered(_render_chunk, jobs), 1):
            print(f"  chunk {k}/{len(jobs)}  ({time.time() - t0:.0f}s)", flush=True)
    with open("_chunks/list.txt", "w") as f:
        for j in jobs:
            f.write(f"file '{os.path.abspath(j[4])}'\n")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "_chunks/list.txt"]
    if e.audio:
        cmd += ["-ss", f"{t_from:.3f}", "-t", f"{t_to - t_from:.3f}", "-i", e.audio, "-map", "0:v", "-map", "1:a",
                "-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-c:v", "copy", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    for j in jobs:
        os.remove(j[4])
    dt = time.time() - t0
    print(f"✓ {out}  {probe_duration(out):.1f}s video in {dt:.0f}s ({(f_end - f_start) / max(1, dt):.1f} fps)")


def check(edit):
    e = Engine(edit)
    print(f"style {e.style_name} · {e.aspect} · {e.W}x{e.H} · {e.dur:.1f}s · {len(e.scenes)} scenes · captions: {e.cap_style if e.phrases else 'off'}")
    gaps = 0
    for sc in e.scenes:
        its = sorted(sc["items"], key=lambda x: x.t_in)
        print(f"\n[{sc['id']}] {sc['t0']:6.2f}-{sc['t1']:6.2f}s  {sc['layout']:8} bg={sc['bg']}{'' if sc['bg_is_image'] or kit.is_proc_bg(sc['bg']) or sc.get('_stage') is not None else ' (MISSING)'}  cam={sc['camera']}  tr={sc['transition']}")
        prev = sc["t0"]
        for tc, rect in sc["cuts"][1:]:
            print(f"   {tc:6.2f}          cut         {'':7} framing {tuple(round(v, 2) for v in rect)}")
        for it in its:
            what = it.d.get("text") or it.d.get("name") or it.d.get("src") or (f"🙂 {it.d.get('cast')} ({len(it.d.get('actions', []))} actions)" if it.type == "character" else "") or (f"{it.d.get('from')}→{it.d.get('to')}" if it.type == "string" else "")
            miss = ""
            if it.type in ("asset", "photo") and not find_image(it.d.get("name") or it.d.get("src")):
                miss = "  ✗ MISSING IMAGE"
                e.warnings.append(f"scene {sc['id']}: image {what!r} missing")
            print(f"   {it.t_in:6.2f}-{min(it.t_out, sc['t1']):6.2f}  {it.type:11} {str(it.slot or ''):7} {str(what)[:48]}{miss}")
            if it.t_in - prev > 3.2:
                gaps += 1
                print(f"   ⚠ {it.t_in - prev:.1f}s gap before this item -- add a beat (asset/keyword)")
            prev = max(prev, it.t_in)
        if sc["t1"] - prev > 3.5 and sc["t1"] - sc["t0"] > 3.5:
            gaps += 1
            print(f"   ⚠ {sc['t1'] - prev:.1f}s with no new visual -- add a beat (keyword, asset, stamp, callout)")
    # ---- sync & coverage: every spoken line must have a visual event while it is being said
    events = sorted([sc["t0"] for sc in e.scenes] + [tc for sc in e.scenes for tc, _ in sc["cuts"][1:]] +
                    [it.t_in for sc in e.scenes for it in sc["items"]] +
                    [sub["_t"] for sc in e.scenes for it in sc["items"]
                     for sub in (it.d.get("items", []) + it.d.get("points", [])) if "_t" in sub])
    bare = []
    for lid, (ls, le) in sorted(e.tl.lines().items()):
        if le - ls > 2.0 and not any(ls - 0.3 <= ev <= le for ev in events):
            bare.append(lid)
    ev_gaps = [b - a for a, b in zip(events, events[1:])]
    print(f"\nsync: {len(e.tl.words)} words, " + ("ALL exact (Cartesia timestamps)" if not e.tl.estimated_lines
          else f"⚠ ESTIMATED timing on lines {', '.join(sorted(e.tl.estimated_lines))} -- re-run `studio.py voice` for exact sync"))
    if e.tl.estimated_lines:
        e.warnings.append("word timings are estimated for some lines (visuals may land up to ~0.4 s off)")
    print(f"density: {len(events)} visual events over {e.dur:.0f}s = one every {e.dur / max(1, len(events)):.1f}s "
          f"(target ≤ 2.0s); longest gap {max(ev_gaps or [0]):.1f}s")
    if bare:
        e.warnings.append(f"lines with NO visual while spoken: {', '.join(bare)} -- add a beat cued to a word in each")
    same = [b["id"] for a, b in zip(e.scenes, e.scenes[1:]) if a["layout"] == b["layout"] and a["layout"] != "clean"]
    if same:
        e.warnings.append(f"scenes {', '.join(same)} repeat the previous scene's layout -- vary layouts for rhythm")
    # ---- anti-clutter check: no scene should pile > 2 competing text elements at once
    text_types = {"title", "keyword", "stamp", "callout", "lower_third", "quote"}
    is_visual_style = e.style_name in ("sticker", "stickman", "stickman_hybrid", "doodle", "noir", "crime", "suspense")
    for sc in e.scenes:
        n_text = sum(1 for it in sc["items"] if it.type in text_types)
        if n_text > 2:
            e.warnings.append(f"scene {sc['id']}: text clutter ({n_text} competing text items) -- obey Rule of One Main Idea per beat!")
        if is_visual_style:
            for it in sc["items"]:
                txt = it.d.get("text") or ""
                words = txt.split()
                if it.type in ("title", "keyword", "quote", "callout") and len(words) > 6:
                    e.warnings.append(
                        f"scene {sc['id']}: book-style typography ('{txt[:32]}...' has {len(words)} words) "
                        f"-- in {e.style_name} style, typography is only for NAMING (labels) or HIGHLIGHTING (1-4 words). "
                        f"Heavy typography belongs exclusively in box style!"
                    )
    if e.dur / max(1, len(events)) > 2.0:
        e.warnings.append(f"visual density too low ({e.dur / max(1, len(events)):.1f}s per beat, target ≤ 2.0s): "
                          f"add cuts, keywords, cut-outs, callouts -- see PLAN.md (`studio.py plan`)")
    for line in variety.summary(e.variety):
        print(line)
    print()
    for w in e.warnings:
        print("⚠", w)
    print(f"{'✓ edit OK' if not e.warnings else f'{len(e.warnings)} warning(s)'}; {gaps} long static stretch(es)")
    return e


def stills(edit, times, scale=1.0):
    e = Engine(edit, scale)
    os.makedirs("_stills", exist_ok=True)
    paths = []
    for t in times:
        p = f"_stills/t{t:07.2f}.png"
        e.frame(t).save(p)
        paths.append(p)
        print(p)
    return paths


def sheet(edit, every=6.0, cols=4, scale=0.5):
    e = Engine(edit, scale)
    ts = [x * every + every / 2 for x in range(int(e.dur // every))]
    tw = 480 if e.aspect == "16:9" else 270
    th = int(tw * e.H / e.W)
    rows = math.ceil(len(ts) / cols)
    out = Image.new("RGB", (cols * tw, rows * (th + 24)), (30, 30, 30))
    g = ImageDraw.Draw(out)
    for k, t in enumerate(ts):
        fr = e.frame(t).resize((tw, th), Image.BILINEAR)
        x, y = (k % cols) * tw, (k // cols) * (th + 24)
        out.paste(fr, (x, y + 24))
        g.text((x + 6, y + 4), f"{int(t // 60)}:{t % 60:04.1f}  scene {e.scene_at(t)['id']}", fill=(230, 230, 230))
    os.makedirs("_stills", exist_ok=True)
    out.save("_stills/sheet.jpg", quality=88)
    print("_stills/sheet.jpg")


def main():
    ap = argparse.ArgumentParser(description="Deepesh Studio Engine v2")
    ap.add_argument("cmd", choices=["check", "still", "sheet", "preview", "video"])
    ap.add_argument("times", nargs="*", type=float)
    ap.add_argument("--edit", default="EDIT.json")
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--from", dest="t_from", type=float, default=0.0)
    ap.add_argument("--to", dest="t_to", type=float, default=None)
    ap.add_argument("--every", type=float, default=6.0)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    if a.cmd == "check":
        check(a.edit)
    elif a.cmd == "still":
        stills(a.edit, a.times or [1.0])
    elif a.cmd == "sheet":
        sheet(a.edit, a.every)
    elif a.cmd == "preview":
        render_video(a.edit, 0.5, a.out or "preview.mp4", True, a.workers, a.t_from, a.t_to)
    else:
        render_video(a.edit, 1.0, a.out or "master.mp4", False, a.workers, a.t_from, a.t_to)


if __name__ == "__main__":
    main()
