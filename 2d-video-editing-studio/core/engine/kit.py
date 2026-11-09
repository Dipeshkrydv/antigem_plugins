# -*- coding: utf-8 -*-
"""kit.py: drawing toolkit for the engine -- shaped text (Devanagari via raqm),
frames (sticker / polaroid / print / card / paper / clean), stamps, pins,
strings, doodle accents, procedural backgrounds and easing.

Everything returns RGBA sprites sized to their real ink bounds (+ padding), so
the layout engine always knows the true footprint: nothing gets clipped and
nothing silently overlaps.
"""
import math, os, re, unicodedata, zlib
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

try:
    from . import styles
except (ImportError, ValueError):
    import styles

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
FONTS = os.path.join(ROOT, "fonts")
DEV = re.compile("[ऀ-ॿ]")


# ------------------------------------------------------------------ easing
def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v

def ease_out_expo(p):
    return 1.0 if p >= 1 else 1 - 2 ** (-10 * p)

def ease_out_cubic(p):
    return 1 - (1 - p) ** 3

def ease_in_out(p):
    return p * p * (3 - 2 * p)

def ease_out_back(p, s=1.6):
    p -= 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2

def ease_out_quint(p):
    p = clamp(p)
    return 1.0 - (1.0 - p) ** 5

def ease_in_out_quint(p):
    p = clamp(p)
    return 16.0 * p ** 5 if p < 0.5 else 1.0 - ((-2.0 * p + 2.0) ** 5) / 2.0

def spring_smooth(p, damping=0.78, freq=6.2):
    p = clamp(p)
    if p >= 0.999:
        return 1.0
    return 1.0 - math.exp(-damping * 8.0 * p) * math.cos(freq * p)

def feathered_wipe(im, progress, feather_px=28):
    """Smooth left-to-right feathered alpha wipe (never slices cards or shadows with a hard straight razor edge)."""
    p = clamp(progress)
    if p >= 0.999:
        return im
    if p <= 0.001:
        return Image.new("RGBA", im.size, (0, 0, 0, 0))
    W, H = im.size
    feather = max(4.0, float(feather_px))
    edge = p * (W + feather)
    xs = np.arange(W, dtype=np.float32)[None, :]
    mask = np.clip((edge - xs) / feather, 0.0, 1.0)
    a = np.asarray(im.getchannel("A"), dtype=np.float32) * mask
    out = im.copy()
    out.putalpha(Image.fromarray(a.astype(np.uint8)))
    return out


# ------------------------------------------------------------------ fonts & text
@lru_cache(maxsize=128)
def _font(rel, size):
    """rel is a path under fonts/, optionally 'path@700' to pick a weight on a variable font."""
    path, _, wght = rel.partition("@")
    f = ImageFont.truetype(os.path.join(FONTS, path), max(8, int(size)), layout_engine=ImageFont.Layout.RAQM)
    if wght:
        try:
            f.set_variation_by_axes([float(wght)])
        except Exception:
            pass
    return f

def font(role, size, text=""):
    lat, dev = styles.FONT_FILES[role]
    return _font(dev if DEV.search(text or "") else lat, int(size))

MARKS = {"*": "acc", "^": "alt", "_": "hl", "~": "ul"}
TRAIL = "।॥,.!?:;\"'”’"

# symbols the bundled Hindi/display fonts don't contain -> nearest glyph they do (no tofu boxes on screen)
GLYPH_SUBS = {"→": "»", "⟶": "»", "➜": "»", "←": "«", "⟵": "«", "✓": "√", "✔": "√", "✗": "x", "✘": "x",
              "•": "·", "…": "...", "“": '"', "”": '"', "‘": "'", "’": "'", "×": "x"}

SUPERSCRIPTS = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")",
}

TOFU_EMOJI_PATTERN = re.compile(r"[\uFFFD\u25A0-\u25FF\U0001F000-\U0001FAFF\u2600-\u27BF]")
ALLOWED_SYMBOLS = {'*', '^', '_', '~', '[', ']', '$', '%', '+', '=', '<', '>', '/', '\\', '°', '«', '»', '·', '—', '–', '#', '@', '&'}


def sanitize_scene_text(text):
    """Sanitizer function for every scene text string (title, subtitle, caption, label):
    - Normalizes Unicode to NFC so Devanagari matras stay combined with base consonants
    - Replaces superscripts (e.g. ³ -> 3, ² -> 2) so units like m3 don't trigger tofu boxes
    - Replaces common unsupported symbols with their safe substitutes
    - Strips tofu boxes, unrendered symbols and emojis
    - Allows only valid letters (L), numbers (N), combining marks (M), punctuation (P), spaces (Zs),
      plus ZWJ/ZWNJ (\u200C, \u200D) and rich markup characters (*, ^, _, ~, [, ])
    - Collapses consecutive whitespace and trims.
    """
    if not text or not isinstance(text, str):
        return ""
    text = unicodedata.normalize("NFC", text)
    for k, v in SUPERSCRIPTS.items():
        text = text.replace(k, v)
    for k, v in GLYPH_SUBS.items():
        text = text.replace(k, v)
    text = TOFU_EMOJI_PATTERN.sub("", text)
    cleaned = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in ("L", "N", "M", "P") or cat == "Zs" or ch in ALLOWED_SYMBOLS or ch in ("\u200c", "\u200d"):
            cleaned.append(ch)
    text = "".join(cleaned)
    return re.sub(r"\s+", " ", text).strip()


def safe_glyphs(text, f):
    text = sanitize_scene_text(text)
    out = []
    for ch in text:
        if ch in GLYPH_SUBS:
            try:
                if f.getmask(ch).getbbox() and ch not in "→⟶➜←⟵✓✔✗✘":
                    out.append(ch); continue
            except Exception:
                pass
            out.append(GLYPH_SUBS[ch])
        else:
            out.append(ch)
    return "".join(out)


def parse_rich(text):
    """Inline emphasis markup (spans may cover several words):
        *word*   accent colour          ^word^   second accent colour
        _word_   highlighter box        [word]   outlined box
        ~word~   hand-drawn underline
    'राणा _104 साल_ तक' -> [('राणा', {}), ('104', {hl}), ('साल', {hl}), ('तक', {})]"""
    text = sanitize_scene_text(text)
    out, active = [], set()
    for tok in text.split():
        w, flags = tok, set(active)
        while len(w) > 1 and (w[0] in MARKS or w[0] == "["):
            m = "box" if w[0] == "[" else MARKS[w[0]]
            flags.add(m); active.add(m); w = w[1:]
        trail = ""
        while w and w[-1] in TRAIL and len(w) > 1:
            trail, w = w[-1] + trail, w[:-1]
        while len(w) > 1 and ((w[-1] in MARKS and MARKS[w[-1]] in flags) or (w[-1] == "]" and "box" in flags)):
            active.discard("box" if w[-1] == "]" else MARKS[w[-1]]); w = w[:-1]
        out.append((w + trail, frozenset(flags)))
    return out

def serialize(words):
    """Inverse of parse_rich for a list of (word, flags[, width]) -- used to re-render wrapped lines."""
    out = []
    for item in words:
        w, fl = item[0], item[1]
        for f, (a, b) in (("acc", ("*", "*")), ("alt", ("^", "^")), ("hl", ("_", "_")), ("ul", ("~", "~")), ("box", ("[", "]"))):
            if f in fl:
                w = a + w + b
        out.append(w)
    return " ".join(out)

def wrap(words, role, size, max_w, sample):
    f = font(role, size, sample)
    sp = f.getlength(" ")
    lines, cur, cw = [], [], 0.0
    for w, fl in words:
        ww = f.getlength(w)
        if cur and cw + sp + ww > max_w:
            lines.append(cur)
            cur, cw = [], 0.0
        cur.append((w, fl, ww))
        cw += (sp if len(cur) > 1 else 0) + ww
    if cur:
        lines.append(cur)
    return lines, f, sp

def _widest(lines, sp):
    return max(sum(w[2] for w in l) + sp * (len(l) - 1) for l in lines)

def fit_text(text, role, size, max_w, max_lines=2, min_size=18, balance=True):
    """Shrink until it wraps into max_lines within max_w, then BALANCE the lines
    (narrowest width that keeps the same line count) so no single orphan word
    hangs on the last line. Returns (size, lines, font, space)."""
    words = parse_rich(text)
    s = size
    while True:
        lines, f, sp = wrap(words, role, s, max_w, text)
        if (len(lines) <= max_lines and _widest(lines, sp) <= max_w) or s <= min_size:
            break
        s = int(s * 0.92)
    if balance and len(lines) > 1:
        lo, hi = _widest(lines, sp) * 0.4, _widest(lines, sp)
        best = lines
        for _ in range(12):
            mid = (lo + hi) / 2
            trial, _, _ = wrap(words, role, s, mid, text)
            if len(trial) <= len(lines):
                best, hi = trial, mid
            else:
                lo = mid
        lines = best
    return s, lines, f, sp

def readable_on(bg):
    """Black or white text, whichever reads better on bg (WCAG-ish luminance)."""
    r, g, b = [c / 255 for c in bg[:3]]
    return (18, 18, 20) if (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.45 else (255, 255, 255)

def text_block(text, role, size, color, max_w, max_lines=2, align="left", accent=None,
               stroke=0, stroke_color=(0, 0, 0), shadow=0, line_gap=1.08, upper=False, tracking=0.0,
               alt=None, hl=None, deco=None):
    """Render rich text (see parse_rich markup) into a tight RGBA sprite. Returns (sprite, info)
    where info has per-word boxes (for karaoke highlights) and the final font size."""
    if upper:
        text = text.upper()
    text = safe_glyphs(text, font(role, size, text))
    s, lines, f, sp = fit_text(text, role, size, max_w, max_lines)
    dev = bool(DEV.search(text))
    lh = s * (1.28 if dev else 1.12) * line_gap
    pad = int(s * 0.32) + stroke + (int(math.ceil(shadow * 3.2)) + 2 if shadow else 0)   # room for the full blur tail
    widths = [sum(w[2] for w in l) + (sp + tracking * s) * (len(l) - 1) for l in lines]
    W = int(max(widths) + pad * 2)
    H = int(lh * len(lines) + pad * 2 - (lh - s * (1.05 if dev else 0.95)))
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    asc = f.getmetrics()[0]
    boxes = []
    hl = hl or accent or (255, 210, 0)
    deco = deco or accent or (230, 60, 50)
    top_k, bot_k = (0.98 if dev else 0.82), (0.30 if dev else 0.22)
    for i, (l, lw) in enumerate(zip(lines, widths)):
        x = pad + (0 if align == "left" else (max(widths) - lw) / (2 if align == "center" else 1))
        base = pad + asc * (0.92 if dev else 1.0) + i * lh
        line_str = " ".join(w for w, _, _ in l) or "A"
        try:
            _, l_top, _, l_bot = f.getbbox(line_str, anchor="ls")
            top_px = max(s * (0.76 if dev else 0.70), -l_top + s * 0.10)
            bot_px = max(s * (0.22 if dev else 0.16), l_bot + s * 0.10)
        except Exception:
            top_px, bot_px = s * top_k, s * bot_k
        for j, (w, fl, ww) in enumerate(l):
            nxt = l[j + 1][1] if j + 1 < len(l) else frozenset()
            col = color
            try:
                bx0, _, bx1, _ = f.getbbox(w, anchor="ls")
                w_left = x + min(0, bx0)
                w_right = x + max(ww, bx1)
            except Exception:
                w_left, w_right = x, x + ww
            if "hl" in fl:   # highlighter: continuous glyph-aligned bar across a highlighted span
                ext = sp + tracking * s if "hl" in nxt else 0
                d.rounded_rectangle([w_left - s * 0.11, base - top_px, w_right + ext + s * 0.11, base + bot_px],
                                    int(s * 0.14), fill=tuple(hl) + (255,))
                col = readable_on(hl)
            elif "acc" in fl and accent:
                col = accent
            elif "alt" in fl and alt:
                col = alt
            if "box" in fl:
                d.rounded_rectangle([w_left - s * 0.14, base - top_px - s * 0.04, w_right + s * 0.14, base + bot_px + s * 0.04],
                                    int(s * 0.14), outline=tuple(deco) + (255,), width=max(3, int(s * 0.07)))
            d.text((x, base), w, font=f, fill=col, anchor="ls", stroke_width=stroke, stroke_fill=stroke_color)
            if "ul" in fl:
                pts = squiggle(w_left, w_right, base + bot_px * 0.75, s * 0.05, seed=len(w))
                d.line(pts, fill=tuple(deco) + (255,), width=max(3, int(s * 0.07)), joint="curve")
            boxes.append((w_left, base - top_px, w_right - w_left, top_px + bot_px, w))
            x += ww + sp + tracking * s
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sh = Image.new("RGBA", im.size, (8, 6, 5, 0))
        sh.putalpha(im.getchannel("A").filter(ImageFilter.GaussianBlur(shadow)).point(lambda v: int(v * 0.62)))
        base_im = Image.new("RGBA", im.size, (0, 0, 0, 0))
        base_im.alpha_composite(sh, (0, max(1, shadow // 2)))
        base_im.alpha_composite(im)
        im = base_im
    return im, {"size": s, "boxes": boxes, "lines": len(lines), "pad": pad}


# ------------------------------------------------------------------ sprite helpers
def fit_into(im, w, h):
    r = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)

def trim(im):
    bb = im.getchannel("A").getbbox() if im.mode == "RGBA" else None
    return im.crop(bb) if bb else im

def with_alpha(im, op):
    if op >= 0.999:
        return im
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * op)))
    return im

SHADOW_TINT = (26, 20, 16)      # warm near-black: real shadows pick up the colour of the surface, never pure #000


def shadow(im, blur=14, dx=0, dy=10, alpha=0.55, color=None):
    """NATURAL two-tier drop shadow (v3). Fixes the v2 'sharp cut' shadow:
      * the canvas is padded by 3.2 x blur (a Gaussian tail reaches ~3 sigma), so the shadow fades to exactly 0
        before the sprite edge -- the old 2 x blur padding clipped it into a hard straight line;
      * a tight CONTACT shadow (where the object touches the surface) + a wide soft AMBIENT shadow, instead of
        one heavy dark blob; the ambient tier is lighter and offset further, like real light;
      * warm-tinted, never pure black, and total opacity is capped so a shadow never reads as a black outline.
    Signature unchanged: blur/dy/alpha describe the ambient (main) shadow."""
    color = tuple(color or SHADOW_TINT)
    blur = max(1, int(blur))
    pad = int(math.ceil(blur * 3.2)) + max(abs(dx), abs(dy)) + 2
    W, H = im.width + pad * 2, im.height + pad * 2
    src = im.getchannel("A")
    alpha = min(alpha, 0.35)                       # subtle, professional natural shadow: never dark, muddy or pasted-on
    cb = max(1, int(blur * 0.28))                 # contact tier
    a_amb = Image.new("L", (W, H), 0)
    a_amb.paste(src, (pad + dx, pad + dy))
    a_amb = np.asarray(a_amb.filter(ImageFilter.GaussianBlur(blur)), np.float32) * (alpha * 0.78)
    a_con = Image.new("L", (W, H), 0)
    a_con.paste(src, (pad + int(dx * 0.3), pad + int(dy * 0.3)))
    a_con = np.asarray(a_con.filter(ImageFilter.GaussianBlur(cb)), np.float32) * (alpha * 0.55)
    a = 255.0 - (255.0 - a_amb) * (255.0 - a_con) / 255.0          # screen-combine: tiers add up without banding
    edge = max(2, pad // 6)                                          # belt and braces: feather the outer border to 0
    ramp = np.minimum(np.arange(W, dtype=np.float32)[None, :], np.arange(W, dtype=np.float32)[::-1][None, :])
    ramp = np.minimum(ramp, np.minimum(np.arange(H, dtype=np.float32)[:, None], np.arange(H, dtype=np.float32)[::-1][:, None]))
    a *= np.clip(ramp / edge, 0, 1)
    out = Image.new("RGBA", (W, H), color + (0,))
    out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    out.alpha_composite(im, (pad, pad))
    return out


def ground_shadow(w, h, alpha=0.28, color=None):
    """Soft elliptical contact shadow for something standing on a surface (characters, props on the ground).
    Subtle, natural, and fully feathered -- never a heavy or hard-edged oval."""
    color = tuple(color or SHADOW_TINT)
    w, h = max(4, int(w)), max(2, int(h))
    pad = int(h * 1.2) + 4
    W, H = w + pad * 2, h + pad * 2
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx - W / 2) / (w / 2), (yy - H / 2) / (h / 2))
    a = np.clip(1.0 - r, 0, 1) ** 1.6 * 255 * alpha
    core = np.clip(1.0 - r / 0.45, 0, 1) ** 2 * 255 * alpha * 0.5      # subtle core right under the feet
    a = np.clip(a + core, 0, 255)
    out = Image.new("RGBA", (W, H), color + (0,))
    out.putalpha(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, h * 0.12))))
    return out

def dilate_alpha(a, px):
    """Fast alpha dilation (for sticker outlines): work at 1/4 scale."""
    k = 4
    small = a.resize((max(1, a.width // k), max(1, a.height // k)), Image.BILINEAR)
    r = max(1, int(round(px / k)))
    small = small.filter(ImageFilter.MaxFilter(2 * r + 1))
    big = small.resize(a.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
    return big.point(lambda v: 255 if v > 90 else int(v * 2.8))

def rounded(w, h, r, fill, outline=None, width=0):
    im = Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, int(w) - 1, int(h) - 1], r, fill=fill, outline=outline, width=width)
    return im


# ------------------------------------------------------------------ frames for assets & photos
def frame_clean(im, S, shadow_a=0.18, dy=6, blur=14):
    """Senior editor clean cutout: pristine anti-aliased edge (NO cartoon white border)
    with a two-tier natural physical shadow (contact + soft ambient depth shadow)."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    pad = int(24 * S)
    base = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    base.paste(im, (pad, pad), im)
    # Tier 1: Tight contact shadow (darker, crisp physical grounding)
    sh_contact = shadow(base, blur=max(2, int(4 * S)), dy=max(1, int(2 * S)), alpha=0.28)
    # Tier 2: Soft ambient shadow (warm, deep physical depth)
    sh_ambient = shadow(base, blur=int(blur * S), dy=int(dy * S), alpha=shadow_a)
    
    res = Image.new("RGBA", sh_ambient.size, (0, 0, 0, 0))
    res.alpha_composite(sh_ambient)
    cx = (res.width - sh_contact.width) // 2
    cy = (res.height - sh_contact.height) // 2
    res.alpha_composite(sh_contact, (cx, cy))
    
    ox = (res.width - base.width) // 2
    oy = (res.height - base.height) // 2
    res.alpha_composite(base, (ox, oy))
    return trim(res)

def frame_sticker(im, S, color=(255, 255, 255)):
    """Contour sticker: crisp die-cut outline + subtle natural drop-shadow."""
    px = int(max(4, 0.028 * max(im.size)))
    pad = px + 4
    base = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    base.paste(im, (pad, pad))
    edge = dilate_alpha(base.getchannel("A"), px)
    out = Image.new("RGBA", base.size, color + (0,))
    out.putalpha(edge)
    out.alpha_composite(base)
    return shadow(out, blur=int(14 * S), dy=int(6 * S), alpha=0.12)

def frame_paper(im, S):
    return frame_sticker(im, S, color=(252, 249, 240))

def _tape(w, h, rot):
    t = Image.new("RGBA", (int(w), int(h)), (236, 226, 196, 175))
    n = (np.random.default_rng(3).random((int(h), int(w))) * 30).astype(np.uint8)
    t.putalpha(Image.fromarray((175 - n).astype(np.uint8)))
    return t.rotate(rot, expand=True, resample=Image.BICUBIC)

def photo_crop(src, aspect):
    """Center-crop an image to aspect (w/h)."""
    w, h = src.size
    if w / h > aspect:
        nw = int(h * aspect); x = (w - nw) // 2
        return src.crop((x, 0, x + nw, h))
    nh = int(w / aspect); y = (h - nh) // 2
    return src.crop((0, y, w, y + nh))

def frame_polaroid(img, S, caption="", ink=(30, 28, 26), tilt=0.0, pin=None):
    """img must already be cropped/sized. White instant-photo card + handwritten caption + tape."""
    b = int(img.width * 0.06)
    bottom = int(img.width * (0.24 if caption else 0.10))
    card = Image.new("RGBA", (img.width + 2 * b, img.height + b + bottom), (246, 243, 236, 255))
    card.paste(img.convert("RGB"), (b, b))
    if caption:
        t, _ = text_block(caption, "hand", bottom * 0.42, ink, card.width - 2 * b, max_lines=1, align="center")
        card.alpha_composite(t, ((card.width - t.width) // 2, img.height + b + (bottom - t.height) // 2))
    if pin:
        p = pushpin(int(26 * S), pin)
        card.alpha_composite(p, ((card.width - p.width) // 2, 2))
    else:
        tp = _tape(card.width * 0.34, max(18, card.width * 0.07), -3)
        big = Image.new("RGBA", (card.width, card.height + tp.height // 2), (0, 0, 0, 0))
        big.alpha_composite(card, (0, tp.height // 2))
        big.alpha_composite(tp, ((card.width - tp.width) // 2, 0))
        card = big
    if tilt:
        card = card.rotate(tilt, expand=True, resample=Image.BICUBIC)
    return shadow(card, blur=int(14 * S), dy=int(6 * S), alpha=0.14)

def frame_print(img, S, caption="", ink=(30, 28, 26), tilt=0.0):
    b = max(6, int(img.width * 0.025))
    card = Image.new("RGBA", (img.width + 2 * b, img.height + 2 * b), (240, 236, 226, 255))
    card.paste(img.convert("RGB"), (b, b))
    if tilt:
        card = card.rotate(tilt, expand=True, resample=Image.BICUBIC)
    return shadow(card, blur=int(14 * S), dy=int(6 * S), alpha=0.12)

def frame_card(img, S, look, caption=""):
    """Framed rectangular card: soft box-shadow (0px 6px 14px rgba(0, 0, 0, 0.12))."""
    r = int(22 * S)
    pad = int(14 * S)
    head = 0
    cap = None
    if caption:
        cap, _ = text_block(caption, "body", 30 * S, look["ink"], img.width, max_lines=1)
        head = cap.height
    W, H = img.width + 2 * pad, img.height + 2 * pad + head
    panel = rounded(W, H, r, tuple(look["panel"][:3]) + (250,), outline=tuple(min(255, c + 40) for c in look["panel"][:3]), width=max(1, int(2 * S)))
    mask = rounded(img.width, img.height, int(r * 0.7), (255, 255, 255, 255)).getchannel("A")
    im = img.convert("RGBA")
    im.putalpha(Image.fromarray(np.minimum(np.array(im.getchannel("A")), np.array(mask))))
    panel.alpha_composite(im, (pad, pad))
    if cap:
        panel.alpha_composite(cap, (pad - int(cap.width * 0) , pad + img.height))
    return shadow(panel, blur=int(14 * S), dy=int(6 * S), alpha=0.12)

def pushpin(d, color):
    im = Image.new("RGBA", (d * 2, d * 2), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    g.ellipse([d * 0.35, d * 0.45, d * 1.65, d * 1.75], fill=(0, 0, 0, 90))
    g.ellipse([d * 0.25, d * 0.25, d * 1.55, d * 1.55], fill=tuple(color) + (255,))
    g.ellipse([d * 0.55, d * 0.45, d * 0.95, d * 0.85], fill=(255, 255, 255, 150))
    return im.resize((d, d), Image.LANCZOS)


# ------------------------------------------------------------------ stamps, pills, bars
def _ink_wear(im, seed, floor=0.38, coarse=3, fine=True):
    """Uneven rubber-stamp ink: pressure falls off across the face, pores and specks drop out. Soft, never binary."""
    W, H = im.size
    rng = np.random.default_rng(seed)
    n1 = np.asarray(Image.fromarray((rng.random((H // (coarse * 6) + 2, W // (coarse * 6) + 2)) * 255).astype(np.uint8))
                    .resize((W, H), Image.BICUBIC), np.float32) / 255
    press = np.clip(0.55 + 0.6 * n1, floor, 1.0)
    if fine:
        n2 = np.asarray(Image.fromarray((rng.random((H // coarse + 1, W // coarse + 1)) * 255).astype(np.uint8))
                        .resize((W, H), Image.BILINEAR), np.float32) / 255
        press *= np.where(n2 > 0.16, 1.0, 0.25)
    a = np.asarray(im.getchannel("A"), np.float32) * press
    im = im.copy()
    im.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))  # ink bleed
    return im


def stamp(text, color, h, seed=None, sub=None, on_image=False):
    """Classic double-ruled rubber stamp (family 'rubber'). Follows color wheel contrast
    and bold/small typography rules with distress ink wear and realistic physical shadow."""
    text = text.upper()
    sd = zlib.crc32(text.encode("utf-8")) if seed is None else int(seed)
    col = tuple(color[:3])
    
    f_main = font("display", h * 0.46, text)
    tw = f_main.getlength(text)
    
    sub_tag = sub or ("CASUALTY // 1814" if "FALL" in text else None)
    t_sub = None
    sub_h = 0
    if sub_tag:
        t_sub, _ = text_block(sub_tag, "headline", h * 0.18, (255, 215, 60) if on_image else col,
                              max_w=tw + h * 1.5, max_lines=1, upper=True, tracking=0.14)
        t_sub = trim(t_sub)
        sub_h = t_sub.height + int(h * 0.08)
        
    W = int(max(tw, t_sub.width if t_sub else 0) + h * 0.85)
    H = int(h * 0.95 + (sub_h if sub_tag else 0))
    
    S2 = 2
    im = Image.new("RGBA", (W * S2, H * S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    lw = max(3, int(h * 0.055)) * S2
    if on_image:
        # Broadcast crimson / accent distress container with double white border and pure white typography
        d.rounded_rectangle([lw, lw, W * S2 - lw, H * S2 - lw], int(h * 0.12) * S2,
                            fill=col + (248,), outline=(255, 255, 255, 200), width=lw)
        d.rounded_rectangle([lw * 2.8, lw * 2.8, W * S2 - lw * 2.8, H * S2 - lw * 2.8], int(h * 0.08) * S2,
                            outline=(255, 255, 255, 140), width=max(2, lw // 2))
    else:
        # Classic paper rubber stamp
        d.rounded_rectangle([lw * 2, lw * 2, W * S2 - lw * 2, H * S2 - lw * 2], int(h * 0.10) * S2,
                            outline=col + (255,), width=lw)
        d.rounded_rectangle([lw * 3.6, lw * 3.6, W * S2 - lw * 3.6, H * S2 - lw * 3.6], int(h * 0.07) * S2,
                            outline=col + (255,), width=max(2, lw // 2))
    
    cur_y = int(h * 0.22 * S2)
    if t_sub:
        t_sub_s2 = t_sub.resize((t_sub.width * S2, t_sub.height * S2), Image.LANCZOS)
        im.alpha_composite(t_sub_s2, ((W * S2 - t_sub_s2.width) // 2, cur_y))
        cur_y += t_sub_s2.height + int(h * 0.05 * S2)
        sep_col = (255, 255, 255, 120) if on_image else col + (160,)
        d.line([(W * S2 * 0.22, cur_y), (W * S2 * 0.78, cur_y)], fill=sep_col, width=max(1, lw // 2))
        cur_y += int(h * 0.06 * S2)
        
    f_main_s2 = font("display", h * 0.48 * S2, text)
    stamp_ink = (255, 255, 255) if on_image else col
    d.text((W * S2 / 2, cur_y + int(h * 0.22 * S2)), text, font=f_main_s2, fill=stamp_ink + (255,), anchor="mm")
    
    worn = _ink_wear(im.resize((W, H), Image.LANCZOS), sd)
    out = shadow(worn, blur=10, dy=6, alpha=0.50)
    ang = (-4.5, 4.0, -3.5, 5.0, -4.0, 3.5)[sd % 6]
    return out.rotate(ang, expand=True, resample=Image.BICUBIC)


# ------------------------------------------------------------------ emphasis families (v3 variety engine)
def seal(text, color, h, seed=None, on_image=False):
    """Oval notary seal: double ring, dotted inner track, the word knocked out of a solid band. Family 'seal'.
    Oval (not round) so even a long word stays large and readable inside a short stamp slot."""
    text = text.upper()
    sd = zlib.crc32(text.encode("utf-8")) if seed is None else int(seed)
    S2 = 2
    Hh = int(h * 1.12)
    f0 = font("display", Hh * 0.36, text)
    Ww = int(max(Hh * 1.45, f0.getlength(text) + Hh * 0.95))
    W2, H2 = Ww * S2, Hh * S2
    im = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    if on_image:
        g.ellipse([0, 0, W2 - 1, H2 - 1], fill=(14, 16, 22, 225))
    c = tuple(color) + (255,)
    lw = max(3, int(Hh * 0.045)) * S2
    g.ellipse([lw, lw, W2 - lw, H2 - lw], outline=c, width=lw)
    ins = Hh * 0.13 * S2
    g.ellipse([ins, ins, W2 - ins, H2 - ins], outline=c, width=max(2, lw // 2))
    cx, cy = W2 / 2, H2 / 2
    rx, ry = W2 / 2 - ins * 0.55, H2 / 2 - ins * 0.55
    for k in range(34):                                  # dotted track between the rings
        a = 2 * math.pi * k / 34
        x, y = cx + math.cos(a) * rx, cy + math.sin(a) * ry
        rr = Hh * 0.014 * S2
        g.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c)
    band_h = H2 * 0.44
    g.rectangle([W2 * 0.035, cy - band_h / 2, W2 * 0.965, cy + band_h / 2], fill=c)
    fs = band_h * 0.80
    f2 = font("display", fs, text)
    while f2.getlength(text) > W2 * 0.86 and fs > 10:
        fs *= 0.93
        f2 = font("display", fs, text)
    knock = Image.new("L", im.size, 0)
    ImageDraw.Draw(knock).text((cx, cy), text, font=f2, fill=255, anchor="mm")
    a = np.asarray(im.getchannel("A"), np.int16) - np.asarray(knock, np.int16)
    im.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    im = _ink_wear(im.resize((Ww, Hh), Image.LANCZOS), sd, floor=0.5)
    return im.rotate((5, -6, 4, -4)[sd % 4], expand=True, resample=Image.BICUBIC)


def tape(text, color, h, max_w, seed=None):
    """Strip of printed label tape slapped across the frame at an angle (family 'tape'): torn ends, slight sheen."""
    text = text.upper()
    sd = zlib.crc32(text.encode("utf-8")) if seed is None else int(seed)
    col = tuple(color[:3])
    fg = readable_on(col)
    t, _ = text_block(text, "display", h * 0.56, fg, max_w * 0.9, max_lines=1, tracking=0.04)
    t = trim(t)
    W, H = int(t.width + h * 1.1), int(h * 0.92)
    strip = Image.new("RGBA", (W, H), col + (255,))
    rng = np.random.default_rng(sd)
    m = np.ones((H, W), np.float32)
    for side in (0, 1):                                  # torn zig-zag ends
        for y in range(H):
            d = int(abs(rng.normal(0, h * 0.05)) + h * 0.02)
            if side == 0:
                m[y, :d] = 0
            else:
                m[y, W - d:] = 0
    sheen = np.linspace(1.08, 0.94, H, dtype=np.float32)[:, None]
    rgb = np.clip(np.asarray(strip, np.float32)[..., :3] * sheen[..., None], 0, 255)
    strip = Image.fromarray(np.dstack([rgb, m * 255]).astype(np.uint8), "RGBA")
    strip.alpha_composite(t, ((W - t.width) // 2, (H - t.height) // 2))
    return strip.rotate((-4.5, 3.5, -2.5, 5.0)[sd % 4], expand=True, resample=Image.BICUBIC)


def scrawl(text, color, ink, h, max_w, seed=None, sub=None, on_image=False):
    """Handwritten / marker callout with an organic hand-drawn loop around it (family 'scrawl').
    Follows color wheel contrast and bold/small typography rules."""
    sd = zlib.crc32(text.encode("utf-8")) if seed is None else int(seed)
    col = tuple(color[:3])
    
    # Color wheel & contrast: on dark image backgrounds, text MUST NEVER be black!
    if on_image or (ink and sum(ink[:3]) < 384):
        txt_col = (255, 255, 255)
    else:
        txt_col = tuple(ink[:3]) if ink else (24, 22, 20)
        
    # Typography rule: Bold display headline + small tracked category tag
    t_main, _ = text_block(text, "headline", h * 0.52, txt_col, max_w * 0.78, max_lines=1, upper=True, tracking=0.08)
    t_main = trim(t_main)
    
    sub_tag = sub or ("CASUALTY // 1814" if "FALL" in text.upper() else None)
    t_sub = None
    sub_h = 0
    if sub_tag:
        t_sub, _ = text_block(sub_tag, "headline", h * 0.20, col, max_w * 0.78, max_lines=1, upper=True, tracking=0.14)
        t_sub = trim(t_sub)
        sub_h = t_sub.height + int(h * 0.08)
        
    pw, ph = int(h * 0.60), int(h * 0.45)
    W = max(t_main.width, t_sub.width if t_sub else 0) + pw * 2
    H = t_main.height + sub_h + ph * 2
    
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    # Frosted dark backing vignette on image backgrounds for 100% legibility
    if on_image:
        d.ellipse([pw * 0.35, ph * 0.35, W - pw * 0.35, H - ph * 0.35], fill=(12, 14, 18, 205))
        
    cur_y = ph
    if t_sub:
        im.alpha_composite(t_sub, ((W - t_sub.width) // 2, cur_y))
        cur_y += t_sub.height + int(h * 0.06)
        
    im.alpha_composite(t_main, ((W - t_main.width) // 2, cur_y))
    
    # Hand-drawn marker circle around the block
    pts = scribble_circle(W / 2, H / 2, W * 0.47, H * 0.44, n=120, wob=0.05, seed=sd % 97 + 1)
    pts = pts + pts[: len(pts) // 6]
    d.line(pts, fill=col + (245,), width=max(3, int(h * 0.07)), joint="curve")
    
    out = shadow(im, blur=int(h * 0.08), dy=int(h * 0.04), alpha=0.45)
    return out.rotate((-3, 2.5, -1.5, 3.5)[sd % 4], expand=True, resample=Image.BICUBIC)


def tab(text, look, h, max_w, seed=None):
    """Manila file-folder index tab with a typed label (family 'tab') -- archival, quiet, premium."""
    text = text.upper()
    sd = zlib.crc32(text.encode("utf-8")) if seed is None else int(seed)
    paper = (236, 222, 186)
    t, _ = text_block(text, "mono", h * 0.42, (40, 34, 28), max_w * 0.85, max_lines=1, tracking=0.06)
    t = trim(t)
    W, H = int(t.width + h * 1.0), int(h * 0.95)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    sl = H * 0.32
    g.polygon([(sl, 0), (W - sl, 0), (W, H), (0, H)], fill=paper + (255,))
    g.line([(sl, 0), (W - sl, 0)], fill=(255, 250, 232, 255), width=max(2, int(h * 0.03)))
    acc = tuple(look.get("accent", (200, 40, 40))[:3])
    g.rectangle([W * 0.5 - t.width / 2 - h * 0.12, H - h * 0.14, W * 0.5 + t.width / 2 + h * 0.12, H - h * 0.08], fill=acc + (255,))
    im.alpha_composite(t, ((W - t.width) // 2, int((H - t.height) / 2 - h * 0.05)))
    im = _grain(im, sd, amp=7)
    return shadow(im, blur=int(h * 0.10), dy=int(h * 0.06), alpha=0.35)


EMPHASIS_FAMILIES = ("rubber", "seal", "tape", "scrawl", "tab")


def emphasis(family, text, look, h, max_w, S, seed=None, sub=None, on_image=False, ink=None):
    """One entry point for every emphasis design. Returns (sprite, entrance)."""
    col = tuple(look.get("stamp_color", look["accent"]))[:3]
    if family == "seal":
        return seal(text, col, h * 0.95, seed, on_image=on_image), "drop"
    if family == "tape":
        return tape(text, look.get("accent2", col), h * 0.8, max_w, seed), "wipe"
    if family == "scrawl":
        return scrawl(text, col, ink, h, max_w, seed, sub=sub, on_image=on_image), "wipe"
    if family == "tab":
        return tab(text, look, h * 0.8, max_w, seed), "rise"
    return stamp(text, col, h, seed, sub=sub, on_image=on_image), "slam"


# ------------------------------------------------------------------ kicker (case-file tag) designs
KICKER_VARIANTS = ("bar", "chip", "bracket", "rule", "index")


def _tag_text(text, size, color, max_w, sh=0):
    """Mono tag text that never shrinks below ~80% of its size: a long tag wraps onto 2 lines instead
    (v2 shrank a long 'CASE FILE ... // ...' to an unreadable 18 px)."""
    im, inf = text_block(text, "mono", size, color, max_w, max_lines=1, upper=True, tracking=0.08, shadow=sh)
    if inf["size"] < size * 0.8:
        im, inf = text_block(text, "mono", size * 0.9, color, max_w, max_lines=2, upper=True, tracking=0.06, shadow=sh,
                             align="left")
    return trim(im)


def kicker(text, variant, look, size, max_w, on_image=False, S=1.0, index=None):
    """Senior editor broadcast kicker tags: 5 sophisticated graphic designs with high-contrast
    Swiss typography, accent chapter badges, and frosted backing plates."""
    acc = tuple(look["accent"][:3])
    acc2 = tuple(look.get("accent2", (247, 196, 36))[:3])
    ink = (244, 240, 232) if on_image or sum(look["ink"][:3]) > 384 else tuple(look["ink"][:3])
    idx_str = f"{index:02d}" if isinstance(index, int) else "01"
    
    parts = [p.strip() for p in text.split("//")]
    cat = parts[0]
    sub = parts[1] if len(parts) > 1 else ""
    
    if variant in ("chip", "capsule"):
        t_cat = trim(text_block(cat, "headline", size * 0.70, (245, 245, 247), max_w, max_lines=1, upper=True, tracking=0.09)[0])
        t_idx = trim(text_block(idx_str, "headline", size * 0.65, (255, 255, 255), 100, max_lines=1, upper=True)[0])
        
        badge_w = t_idx.width + int(size * 0.48)
        badge_h = t_idx.height + int(size * 0.26)
        badge = rounded(badge_w, badge_h, int(size * 0.16), acc + (255,))
        badge.alpha_composite(t_idx, ((badge_w - t_idx.width)//2, (badge_h - t_idx.height)//2))
        
        t_sub = None
        if sub:
            t_sub = trim(text_block(sub, "headline", size * 0.68, acc2, max_w, max_lines=1, upper=True, tracking=0.06)[0])
            
        gap = int(size * 0.32)
        inner_w = badge_w + gap + t_cat.width + (gap + int(size * 0.35) + gap + t_sub.width if t_sub else 0)
        inner_h = max(badge_h, t_cat.height, t_sub.height if t_sub else 0)
        
        pad_x, pad_y = int(size * 0.52), int(size * 0.28)
        W, H = inner_w + pad_x * 2, inner_h + pad_y * 2
        
        pill_bg = rounded(W, H, int(size * 0.24), (18, 20, 26, 235), outline=(255, 255, 255, 45), width=1)
        cur_x = pad_x
        pill_bg.alpha_composite(badge, (cur_x, (H - badge_h)//2))
        cur_x += badge_w + gap
        pill_bg.alpha_composite(t_cat, (cur_x, (H - t_cat.height)//2))
        cur_x += t_cat.width + gap
        if t_sub:
            d = ImageDraw.Draw(pill_bg)
            sep_x = cur_x + int(size * 0.12)
            d.line([(sep_x, (H - inner_h)//2 + 3), (sep_x, (H + inner_h)//2 - 3)], fill=(255, 255, 255, 60), width=1)
            cur_x += int(size * 0.28) + gap
            pill_bg.alpha_composite(t_sub, (cur_x, (H - t_sub.height)//2))
        return shadow(pill_bg, blur=int(10*S), dy=int(5*S), alpha=0.35)

    if variant == "bar":
        t_cat = trim(text_block(cat, "headline", size * 0.74, (245, 245, 247), max_w, max_lines=1, upper=True, tracking=0.09)[0])
        t_idx = trim(text_block(idx_str, "headline", size * 0.65, (255, 255, 255), 100, max_lines=1, upper=True)[0])
        
        badge_w = t_idx.width + int(size * 0.44)
        badge_h = t_idx.height + int(size * 0.24)
        badge = rounded(badge_w, badge_h, max(2, int(size * 0.12)), acc + (255,))
        badge.alpha_composite(t_idx, ((badge_w - t_idx.width)//2, (badge_h - t_idx.height)//2))
        
        t_sub = None
        if sub:
            t_sub = trim(text_block(sub, "headline", size * 0.72, acc2, max_w, max_lines=1, upper=True, tracking=0.06)[0])
            
        gap = int(size * 0.32)
        inner_w = badge_w + gap + t_cat.width + (gap + int(size * 0.35) + gap + t_sub.width if t_sub else 0)
        inner_h = max(badge_h, t_cat.height, t_sub.height if t_sub else 0)
        
        pad_x, pad_y = int(size * 0.45), int(size * 0.25)
        W, H = inner_w + pad_x * 2, inner_h + pad_y * 2
        
        plate = rounded(W, H, max(2, int(size * 0.12)), (16, 18, 22, 225), outline=acc + (120,), width=1)
        cur_x = pad_x
        plate.alpha_composite(badge, (cur_x, (H - badge_h)//2))
        cur_x += badge_w + gap
        plate.alpha_composite(t_cat, (cur_x, (H - t_cat.height)//2))
        cur_x += t_cat.width + gap
        if t_sub:
            d = ImageDraw.Draw(plate)
            sep_x = cur_x + int(size * 0.12)
            d.line([(sep_x, (H - inner_h)//2 + 2), (sep_x, (H + inner_h)//2 - 2)], fill=(255, 255, 255, 60), width=1)
            cur_x += int(size * 0.28) + gap
            plate.alpha_composite(t_sub, (cur_x, (H - t_sub.height)//2))
        return shadow(plate, blur=int(9*S), dy=int(4*S), alpha=0.30)
        
    if variant == "rule":
        t_cat = trim(text_block(cat, "headline", size * 0.72, ink if not on_image else (245, 245, 247), max_w, max_lines=1, upper=True, tracking=0.10)[0])
        t_sub = trim(text_block(sub, "headline", size * 0.70, acc, max_w, max_lines=1, upper=True, tracking=0.08)[0]) if sub else None
        
        gap = int(size * 0.35)
        W = t_cat.width + (gap + t_sub.width if t_sub else 0) + int(size * 0.8)
        H = max(t_cat.height, t_sub.height if t_sub else 0) + int(size * 0.40)
        
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        dot_r = max(3, int(size * 0.10))
        dot_y = (H - int(size * 0.35)) // 2
        d.ellipse([0, dot_y - dot_r, dot_r * 2, dot_y + dot_r], fill=acc + (255,))
        
        cur_x = dot_r * 2 + int(size * 0.25)
        im.alpha_composite(t_cat, (cur_x, 0))
        cur_x += t_cat.width + gap
        if t_sub:
            d.text((cur_x - gap//2, 0), "//", font=font("headline", size * 0.70), fill=acc + (140,))
            cur_x += int(size * 0.40)
            im.alpha_composite(t_sub, (cur_x, 0))
            
        rule_y = H - 2
        d.line([(0, rule_y), (int(W * 0.45), rule_y)], fill=acc + (255,), width=2)
        d.line([(int(W * 0.45), rule_y), (W, rule_y)], fill=acc + (60,), width=1)
        return im
        
    if variant == "bracket":
        t_cat = trim(text_block(cat, "headline", size * 0.70, (245, 245, 247), max_w, max_lines=1, upper=True, tracking=0.10)[0])
        t_sub = trim(text_block(sub, "headline", size * 0.68, acc2, max_w, max_lines=1, upper=True, tracking=0.08)[0]) if sub else None
        
        gap = int(size * 0.32)
        inner_w = t_cat.width + (gap + int(size * 0.35) + gap + t_sub.width if t_sub else 0)
        inner_h = max(t_cat.height, t_sub.height if t_sub else 0)
        
        pad_x, pad_y = int(size * 0.60), int(size * 0.34)
        W, H = inner_w + pad_x * 2, inner_h + pad_y * 2
        
        plate = rounded(W, H, max(2, int(size * 0.10)), (18, 20, 26, 220))
        d = ImageDraw.Draw(plate)
        L = int(size * 0.45)
        lw = max(2, int(size * 0.07))
        for (x, y, sx, sy) in ((3, 3, 1, 1), (W - 4, 3, -1, 1), (3, H - 4, 1, -1), (W - 4, H - 4, -1, -1)):
            d.line([(x, y + sy * L), (x, y), (x + sx * L, y)], fill=acc + (255,), width=lw)
            
        cur_x = pad_x
        plate.alpha_composite(t_cat, (cur_x, (H - t_cat.height)//2))
        cur_x += t_cat.width + gap
        if t_sub:
            sep_x = cur_x + int(size * 0.12)
            d.line([(sep_x, (H - inner_h)//2 + 2), (sep_x, (H + inner_h)//2 - 2)], fill=(255, 255, 255, 60), width=1)
            cur_x += int(size * 0.28) + gap
            plate.alpha_composite(t_sub, (cur_x, (H - t_sub.height)//2))
        return shadow(plate, blur=int(9*S), dy=int(4*S), alpha=0.30)
        
    if variant == "index":
        n = trim(text_block(idx_str, "display", size * 1.6, acc, 200, max_lines=1)[0])
        t_cat = trim(text_block(cat, "headline", size * 0.68, ink if not on_image else (245, 245, 247), max_w, max_lines=1, upper=True, tracking=0.08)[0])
        t_sub = trim(text_block(sub, "headline", size * 0.60, acc2 if on_image else acc, max_w, max_lines=1, upper=True, tracking=0.06)[0]) if sub else None
        
        stack_h = t_cat.height + (t_sub.height + 4 if t_sub else 0)
        H = max(n.height, stack_h)
        gap = int(size * 0.40)
        lw = max(2, int(size * 0.06))
        
        stack_w = max(t_cat.width, t_sub.width if t_sub else 0)
        W = n.width + gap + lw + gap + stack_w
        
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        im.alpha_composite(n, (0, (H - n.height)//2))
        d = ImageDraw.Draw(im)
        div_x = n.width + gap
        d.line([(div_x, 4), (div_x, H - 4)], fill=acc + (180,), width=lw)
        
        text_x = div_x + lw + gap
        text_y = (H - stack_h) // 2
        im.alpha_composite(t_cat, (text_x, text_y))
        if t_sub:
            im.alpha_composite(t_sub, (text_x, text_y + t_cat.height + 4))
        return im

def pill(text, role, size, fg, bg, max_w, pad=(0.45, 0.22), radius=None):
    t, info = text_block(text, role, size, fg, max_w - size, max_lines=1)
    pw, ph = int(size * pad[0]), int(size * pad[1])
    W, H = t.width + pw * 2 - info["pad"], t.height + ph * 2 - info["pad"]
    box = rounded(W, H, radius if radius is not None else H // 2, bg)
    box.alpha_composite(t, ((W - t.width) // 2, (H - t.height) // 2))
    return box


# ------------------------------------------------------------------ strings, doodles
def bezier(a, b, sag, n=40):
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag
    return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0],
             (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]) for t in (i / n for i in range(n + 1))]

def draw_path(cv, pts, p, color, width):
    """Draw the first fraction p of a polyline onto an RGB canvas, anti-aliased-ish (2 passes)."""
    k = max(2, int(len(pts) * clamp(p)))
    seg = pts[:k]
    if len(seg) < 2:
        return
    g = ImageDraw.Draw(cv, "RGBA")
    g.line(seg, fill=tuple(color) + (90,), width=width + 2, joint="curve")
    g.line(seg, fill=tuple(color) + (255,), width=width, joint="curve")

def burst_points(cx, cy, r, n=7, a0=-150, a1=-30):
    out = []
    for i in range(n):
        ang = math.radians(a0 + (a1 - a0) * i / max(1, n - 1))
        out.append(((cx + math.cos(ang) * r, cy + math.sin(ang) * r),
                    (cx + math.cos(ang) * r * 1.35, cy + math.sin(ang) * r * 1.35)))
    return out

def scribble_circle(cx, cy, rx, ry, n=90, wob=0.04, seed=1):
    rng = np.random.default_rng(seed)
    ph = rng.random() * 6.28
    pts = []
    for i in range(int(n * 1.12)):
        t = ph + 2 * math.pi * i / n
        k = 1 + wob * math.sin(t * 3 + seed) + 0.03 * (i / n)
        pts.append((cx + math.cos(t) * rx * k, cy + math.sin(t) * ry * k))
    return pts

def squiggle(x0, x1, y, amp, seed=2):
    n = 30
    return [(x0 + (x1 - x0) * i / n, y + amp * math.sin(i * 1.3 + seed)) for i in range(n + 1)]


# ------------------------------------------------------------------ backgrounds
PROC_BG = {"auto", "paper", "dark", "grid", "white", "crumple", "kraft", "mat", "chalk"}

def is_proc_bg(name):
    return name in PROC_BG

def procedural_bg(kind, W, H, look):
    """Procedural surface. `auto` follows the style's `bg_kind`; the collage surfaces (cream fibre paper,
    graph paper, crumpled white, kraft, cutting mat, chalkboard) live in collage.py."""
    import collage
    if kind == "auto" and look.get("bg_kind"):
        kind = look["bg_kind"]
    if kind in collage.KINDS:
        return collage.background(kind, W, H, look)
    return _legacy_bg(kind, W, H, look)

def _legacy_bg(kind, W, H, look):
    rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    base = np.array(look["bg"], np.float32)
    if kind in ("paper", "auto") and look.get("paper"):
        shade = 1 - 0.08 * np.clip(r - 0.35, 0, None)
        fib = rng.normal(0, 3.2, (H // 3 + 1, W // 3 + 1)).repeat(3, 0).repeat(3, 1)[:H, :W]
        img = base * shade[..., None] + fib[..., None]
        if look.get("dots"):   # subtle dot grid: gives sticker layouts a designed surface instead of blank paper
            step = int(min(W, H) / 18)
            r = max(2, step // 16)
            m = (((xx.astype(int) + step // 2) % step) < r) & (((yy.astype(int) + step // 2) % step) < r)
            img = img - m[..., None] * 26
    elif kind in ("grid", "auto") and look.get("grid"):
        img = base * (1 - 0.15 * np.clip(r - 0.2, 0, None))[..., None]
        step = int(W / 32)
        dots = ((xx.astype(int) % step < 2) & (yy.astype(int) % step < 2))
        img = img + dots[..., None] * 22
    else:  # dark / noir
        shade = 1.25 - 0.55 * np.clip(r, 0, 1.3)
        img = base * shade[..., None] + rng.normal(0, 2.0, (H, W))[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


# ------------------------------------------------------------------ creative text boxes
def gradient_fill(im, c1, c2):
    """Re-colour every opaque pixel of a text sprite with a vertical gradient c1 -> c2."""
    a = im.getchannel("A")
    g = np.linspace(0, 1, im.height, dtype=np.float32)[:, None, None]
    grad = (np.array(c1, np.float32) * (1 - g) + np.array(c2, np.float32) * g)
    grad = np.repeat(grad, im.width, axis=1).astype(np.uint8)
    out = Image.fromarray(grad, "RGB").convert("RGBA")
    out.putalpha(a)
    return out

def _jagged(w, h, amp, seed):
    rng = np.random.default_rng(seed)
    top = [(x, amp * rng.random()) for x in np.linspace(0, w, 28)]
    bot = [(x, h - amp * rng.random()) for x in np.linspace(w, 0, 28)]
    return top + bot

BLOCK_PALETTE = [((94, 58, 36), (255, 255, 255)), ((255, 228, 0), (94, 58, 36)), ((255, 255, 255), (94, 58, 36)),
                 ((24, 22, 20), (255, 228, 0))]

def _grain(im, seed, amp=5):
    """Faint print grain on a flat sprite (keeps flat colour from looking like a vector fill)."""
    rng = np.random.default_rng(zlib.crc32(f"g{seed}{im.size}".encode()))
    n = rng.normal(0, amp, (im.height, im.width, 1)).astype(np.float32)
    a = np.asarray(im).astype(np.float32)
    a[..., :3] = np.clip(a[..., :3] + n, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")

def text_box(text, style, look, size, max_w, S, ink=None, variant=0):
    """One keyword/label in one of 13 designed treatments. Returns an RGBA sprite."""
    text = sanitize_scene_text(text)
    ink = ink or look["ink"]
    a1, a2 = tuple(look["accent"]), tuple(look["accent2"])
    if style == "strip":      # Editorial title strip card (Vox / magazine standard)
        t, _ = text_block(text, "serif", size * 1.1, (22, 20, 18), max_w - size * 1.2, max_lines=2, align="center",
                          accent=tuple(look.get("accent3", (27, 56, 128))), alt=a1)
        t = trim(t)
        pad_x = int(size * 0.65)
        pad_y = int(size * 0.32)
        w, h = int(t.width + pad_x * 2), int(t.height + pad_y * 2)
        card = rounded(w, h, int(size * 0.10), a2 + (248,), outline=(0, 0, 0, 25), width=1)
        card.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
        card = _grain(card, text, 3)
        return shadow(card, blur=int(6 * S), dy=int(4 * S), alpha=0.25)
    if style == "plate":      # flat caption-style plate (mustard block, dark text)
        t, _ = text_block(text, "headline", size, readable_on(a2), max_w - size, max_lines=2, align="center")
        t = trim(t)
        im = Image.new("RGBA", (int(t.width + size * 0.9), int(t.height + size * 0.4)), a2 + (255,))
        im.alpha_composite(t, ((im.width - t.width) // 2, (im.height - t.height) // 2))
        return _grain(im, text, 3)
    if style == "note":       # thin paper annotation label (white translucent, serif)
        t, _ = text_block(text, "serif_reg", size * 0.92, (40, 38, 36), max_w - size, max_lines=2, align="center")
        t = trim(t)
        w, h = int(t.width + size * 0.9), int(t.height + size * 0.5)
        im = Image.new("RGBA", (w, h), (255, 255, 255, 226))
        ImageDraw.Draw(im).rectangle([0, 0, w - 1, h - 1], outline=(206, 200, 188, 255), width=max(1, int(S)))
        im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
        return shadow(im, blur=int(5 * S), dy=int(3 * S), alpha=0.22)
    if style == "block":      # big rounded-bold type on a colour block (flat-lay desk titles)
        bgc, fgc = (look.get("blocks") or BLOCK_PALETTE)[variant % len(look.get("blocks") or BLOCK_PALETTE)]
        t, _ = text_block(text, "round", size * 1.45, fgc, max_w - size * 1.4, max_lines=2, align="center")
        t = trim(t)
        im = Image.new("RGBA", (int(t.width + size * 1.1), int(t.height + size * 0.7)), tuple(bgc) + (255,))
        im.alpha_composite(t, ((im.width - t.width) // 2, (im.height - t.height) // 2))
        im = _grain(im, text, 4)
        tilt = (-3.0, 2.0, -1.5, 3.0)[variant % 4]
        return shadow(im.rotate(tilt, expand=True, resample=Image.BICUBIC), blur=int(9 * S), dy=int(7 * S), alpha=0.38)
    if style == "ransom":
        import collage
        return collage.ransom(text, size, look, S, seed=variant)
    if style == "tag":
        t, inf = text_block(text, "headline", size, readable_on(a1), max_w - size * 1.6, max_lines=2)
        t = trim(t)
        h, w = int(t.height + size * 0.55), int(t.width + size * 1.4)
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        g = ImageDraw.Draw(im)
        g.polygon([(0, 0), (w - h * 0.42, 0), (w, h / 2), (w - h * 0.42, h), (0, h)], fill=a1 + (255,))
        r = h * 0.11
        g.ellipse([w - h * 0.42 - r, h / 2 - r, w - h * 0.42 + r, h / 2 + r], fill=(0, 0, 0, 0))
        im.alpha_composite(t, (int(size * 0.4), (h - t.height) // 2))
        return shadow(im.rotate(-2, expand=True, resample=Image.BICUBIC), blur=int(8 * S), dy=int(6 * S), alpha=0.45)
    if style == "sticky":
        t, _ = text_block(text, "hand", size * 1.05, (40, 36, 30), min(max_w, size * 9) - size, max_lines=3, align="center")
        t = trim(t)
        side = int(max(t.width, t.height) + size * 1.2)
        im = Image.new("RGBA", (side, int(side * 0.86)), (255, 232, 120, 255))
        sh = np.linspace(0, 22, im.height, dtype=np.float32)[:, None]
        arr = np.array(im).astype(np.float32); arr[..., :3] -= sh[..., None]
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        im.alpha_composite(t, ((im.width - t.width) // 2, (im.height - t.height) // 2))
        tp = _tape(im.width * 0.4, max(16, im.width * 0.09), 2)
        big = Image.new("RGBA", (im.width, im.height + tp.height // 2), (0, 0, 0, 0))
        big.alpha_composite(im, (0, tp.height // 2)); big.alpha_composite(tp, ((im.width - tp.width) // 2, 0))
        return shadow(big.rotate(-3, expand=True, resample=Image.BICUBIC), blur=int(12 * S), dy=int(10 * S), alpha=0.4)
    if style == "torn":
        t, _ = text_block(text, "headline", size, (30, 27, 24), max_w - size, max_lines=2)
        t = trim(t)
        w, h = int(t.width + size * 1.0), int(t.height + size * 0.8)
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(im).polygon(_jagged(w, h, size * 0.14, len(text)), fill=(244, 238, 222, 255))
        im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
        return shadow(im.rotate(1.5, expand=True, resample=Image.BICUBIC), blur=int(9 * S), dy=int(7 * S), alpha=0.5)
    if style == "neon":
        t, _ = text_block(text, "headline", size, (255, 255, 255), max_w - size, max_lines=2)
        t = trim(t)
        pad = int(size * 0.7)
        w, h = t.width + pad * 2, t.height + int(pad * 1.2)
        im = rounded(w, h, int(size * 0.3), (8, 8, 12, 205), outline=a2 + (255,), width=max(2, int(3 * S)))
        glow = Image.new("RGBA", t.size, a2 + (0,)); glow.putalpha(t.getchannel("A").filter(ImageFilter.GaussianBlur(size * 0.18)))
        for _ in range(2):
            im.alpha_composite(glow, ((w - t.width) // 2, (h - t.height) // 2))
        im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
        return im
    if style == "label":
        role = "headline" if DEV.search(text) else "mono"
        t, _ = text_block(text, role, size * (1.0 if role == "headline" else 0.9), (245, 245, 245), max_w - size,
                          max_lines=1, upper=True, tracking=0.04)
        t = trim(t)
        w, h = int(t.width + size * 1.0), int(t.height + size * 0.6)
        im = rounded(w, h, int(size * 0.08), (22, 22, 24, 255))
        g = ImageDraw.Draw(im)
        g.line([(0, 3), (w, 3)], fill=(60, 60, 64, 255), width=2)
        im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
        return shadow(im.rotate(-1, expand=True, resample=Image.BICUBIC), blur=int(6 * S), dy=int(5 * S), alpha=0.5)
    if style == "marker":
        t, _ = text_block(text, "headline", size, readable_on(a2), max_w - size, max_lines=2)
        t = trim(t)
        w, h = int(t.width + size * 0.7), int(t.height + size * 0.5)
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        g = ImageDraw.Draw(im)
        g.polygon([(size * 0.1, h * 0.12), (w, 0), (w - size * 0.12, h * 0.9), (0, h)], fill=a2 + (235,))
        im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
        return im
    if style == "outline":
        t, _ = text_block(text, "impact", size * 1.25, (255, 255, 255), max_w, max_lines=2,
                          stroke=max(3, int(size * 0.09)), stroke_color=a1)
        return shadow(trim(t), blur=int(8 * S), dy=int(5 * S), alpha=0.6)
    if style == "highlighter":
        # Swiss editorial highlighter: authentic chisel-tip marker stroke over serif/headline text
        hl_col = tuple(look.get("highlighter_color", (255, 220, 20)))[:3]
        t_font = look.get("title_font", "serif")
        t, _ = text_block(text, t_font, size * 1.05, (22, 20, 18), max_w - size, max_lines=2, align="center")
        t = trim(t)
        pad_x, pad_y = int(size * 0.50), int(size * 0.22)
        w, h = t.width + pad_x * 2, t.height + pad_y * 2
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        # Chisel-tip geometry with 12-degree marker slant
        slant = int(size * 0.22)
        stroke_top = int(h * 0.12)
        stroke_bot = int(h * 0.90)
        pts = [
            (pad_x * 0.4 + slant, stroke_top),
            (w - pad_x * 0.4, stroke_top - 2),
            (w - pad_x * 0.4 - slant, stroke_bot + 2),
            (pad_x * 0.4, stroke_bot)
        ]
        d.polygon(pts, fill=hl_col + (228,))
        im = _grain(im, text, 4)
        im.alpha_composite(t, (pad_x, pad_y))
        return im
    if style == "doodle_circle" or style == "doodle":
        # Hand-drawn ink doodle: Kalam hand font with a sketchy circled loop around it
        t, _ = text_block(text, "hand", size * 1.05, ink or (28, 26, 24), max_w - size * 1.2, max_lines=2, align="center")
        t = trim(t)
        pw, ph = int(size * 0.6), int(size * 0.45)
        w, h = t.width + pw * 2, t.height + ph * 2
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        im.alpha_composite(t, (pw, ph))
        accent_col = tuple(look.get("accent", (214, 60, 40)))[:3]
        pts = scribble_circle(w / 2, h / 2, w * 0.48, h * 0.46, n=90, wob=0.06, seed=variant % 43 + 3)
        pts = pts + pts[:len(pts) // 6]  # overshoot loop
        ImageDraw.Draw(im).line(pts, fill=accent_col + (235,), width=max(3, int(size * 0.08)), joint="curve")
        return im.rotate((-2.5, 2.0, -1.5, 3.0)[variant % 4], expand=True, resample=Image.BICUBIC)
    if style == "rpg" or style == "rpg_box":
        # 16-Bit retro RPG dialogue window
        t, _ = text_block(text, "mono", size * 0.9, (250, 250, 255), max_w - size * 1.6, max_lines=2)
        t = trim(t)
        pad = int(size * 0.5)
        w, h = t.width + pad * 2 + int(size * 0.8), t.height + pad * 2
        im = Image.new("RGBA", (w, h), (16, 14, 28, 240))
        g = ImageDraw.Draw(im)
        # Double pixel borders (outer gold/cyan, inner dark)
        border_col = tuple(look.get("accent", (255, 215, 0)))[:3]
        lw = max(2, int(size * 0.08))
        g.rectangle([0, 0, w - 1, h - 1], outline=border_col + (255,), width=lw)
        g.rectangle([lw * 2, lw * 2, w - 1 - lw * 2, h - 1 - lw * 2], outline=(60, 50, 90, 255), width=max(1, lw // 2))
        im.alpha_composite(t, (pad, pad))
        # Add RPG prompt cursor "▶" on the right
        cursor_f = font("mono", size * 0.8, "▶")
        g.text((w - pad - int(size * 0.2), h // 2), "▶", font=cursor_f, fill=border_col + (255,), anchor="mm")
        return im
    if style == "cctv" or style == "timestamp":
        # CCTV / Crime dossier timestamp tag
        t, _ = text_block(text, "mono", size * 0.85, (235, 235, 240), max_w - size, max_lines=1, upper=True, tracking=0.08)
        t = trim(t)
        pad_x, pad_y = int(size * 0.4), int(size * 0.2)
        w, h = t.width + pad_x * 2, t.height + pad_y * 2
        im = Image.new("RGBA", (w, h), (10, 12, 16, 210))
        g = ImageDraw.Draw(im)
        acc_red = tuple(look.get("accent", (215, 38, 61)))[:3]
        # Red recording dot
        rd = max(3, int(size * 0.16))
        g.ellipse([pad_x // 2 - rd, h // 2 - rd, pad_x // 2 + rd, h // 2 + rd], fill=acc_red + (255,))
        im.alpha_composite(t, (pad_x + rd, pad_y))
        return im
    if style == "redact_bar":
        # Black censor redaction bar
        t, _ = text_block(text, "headline", size * 0.9, (255, 255, 255), max_w - size, max_lines=1)
        t = trim(t)
        w, h = int(t.width + size * 0.6), int(t.height + size * 0.3)
        im = Image.new("RGBA", (w, h), (12, 12, 14, 255))
        return im
    # pill (default)
    return pill(text, "headline", size, readable_on(a2), a2 + (255,), max_w, radius=int(size * 0.22))


def strip_title(text, sub, look, size, max_w, S, ink=None):
    """Highlighter-strip headline with an optional serif sub-line beneath it (Porsche 356 / $3,750)."""
    strip = text_box(text, "strip", look, size, max_w, S, ink=ink)
    if not sub:
        return strip
    st, _ = text_block(sub, "serif_reg", size * 0.46, ink or look["ink"], max_w, max_lines=2, align="center")
    st = trim(st)
    gap = int(size * 0.22)
    out = Image.new("RGBA", (max(strip.width, st.width), strip.height + gap + st.height), (0, 0, 0, 0))
    out.alpha_composite(strip, ((out.width - strip.width) // 2, 0))
    out.alpha_composite(st, ((out.width - st.width) // 2, strip.height + gap))
    return out


def bento_card(title, value, delta, progress, sub, look, S, max_w):
    """Structured Bento Data Card for Box & Vox styles:
    Header tag + giant hero stat + delta badge (+38% / -12%) + animated progress bar + subtitle."""
    panel = tuple(look.get("panel", (24, 28, 36, 245)))
    ink = readable_on(panel[:3])
    muted = tuple(look.get("muted", (150, 155, 165)))[:3]
    acc = tuple(look.get("accent", (255, 59, 48)))[:3]
    acc2 = tuple(look.get("accent2", (255, 196, 0)))[:3]
    card_w = int(min(max_w, 680 * S))
    pad = int(32 * S)
    inner_w = max(120, card_w - pad * 2)

    layers = []
    cur_y = pad
    if title:
        t_sp, _ = text_block(title, "mono", 28 * S, muted, inner_w, max_lines=1, upper=True, tracking=0.06)
        t_sp = trim(t_sp)
        layers.append((t_sp, pad, cur_y))
        cur_y += t_sp.height + int(14 * S)

    val_sp, _ = text_block(str(value or "100%"), look.get("number_font", "display"), 96 * S, ink, inner_w, max_lines=1)
    val_sp = trim(val_sp)
    layers.append((val_sp, pad, cur_y))

    if delta:
        is_neg = str(delta).strip().startswith("-")
        d_col = (239, 68, 68) if is_neg else (34, 197, 94)
        d_pill = pill(str(delta), "mono", int(26 * S), (255, 255, 255), d_col + (255,), int(inner_w * 0.5), radius=int(12 * S))
        dx = min(card_w - pad - d_pill.width, pad + val_sp.width + int(18 * S))
        dy = cur_y + max(0, (val_sp.height - d_pill.height) // 2)
        layers.append((d_pill, dx, dy))

    cur_y += val_sp.height + int(20 * S)

    if progress is not None:
        bar_h = max(8, int(14 * S))
        bar_im = Image.new("RGBA", (inner_w, bar_h), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bar_im)
        track_col = (45, 50, 62, 220) if ink == (255, 255, 255) else (215, 210, 200, 220)
        bd.rounded_rectangle([0, 0, inner_w - 1, bar_h - 1], bar_h // 2, fill=track_col)
        fill_w = int(inner_w * clamp(float(progress), 0.0, 1.0))
        if fill_w > bar_h:
            bd.rounded_rectangle([0, 0, fill_w - 1, bar_h - 1], bar_h // 2, fill=acc2 + (255,))
        layers.append((bar_im, pad, cur_y))
        cur_y += bar_h + int(16 * S)

    if sub:
        s_sp, _ = text_block(sub, "sub", 30 * S, muted, inner_w, max_lines=2)
        s_sp = trim(s_sp)
        layers.append((s_sp, pad, cur_y))
        cur_y += s_sp.height + int(8 * S)

    card_h = cur_y + pad - int(8 * S)
    im = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    r = int(24 * S)
    border_col = acc + (180,) if look.get("grid") else (120, 125, 135, 90)
    g.rounded_rectangle([0, 0, card_w - 1, card_h - 1], r, fill=panel[:3] + (242,), outline=border_col, width=max(2, int(2.5 * S)))
    # Top accent highlight bar
    g.rounded_rectangle([int(24 * S), 0, int(130 * S), max(4, int(6 * S))], int(3 * S), fill=acc + (255,))
    for sp, lx, ly in layers:
        im.alpha_composite(sp, (int(lx), int(ly)))
    return shadow(im, blur=int(18 * S), dy=int(10 * S), alpha=0.30)


def speech_bubble(text, tail="bottom_left", look=None, S=1.0, max_w=600, thought=False):
    """Expressive comic speech/thought bubble with directional pointer tail for Stickman & Sticker storytelling."""
    look = look or {}
    role = "round" if "round" in styles.FONT_FILES else "hand"
    t_sp, _ = text_block(text, role, int(42 * S), (20, 20, 24), int(max_w - 64 * S), max_lines=3, align="center",
                         accent=look.get("accent", (230, 57, 70)))
    t_sp = trim(t_sp)
    padx, pady = int(34 * S), int(24 * S)
    bw, bh = t_sp.width + padx * 2, t_sp.height + pady * 2
    tail_h = int(28 * S)
    W, H = bw + int(16 * S), bh + tail_h + int(12 * S)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    bx, by = int(8 * S), int(6 * S)
    r = int(min(bw, bh) * 0.34)
    outline_w = max(3, int(4.5 * S))
    g.rounded_rectangle([bx, by, bx + bw, by + bh], r, fill=(255, 255, 255, 252), outline=(20, 20, 24, 255), width=outline_w)
    tx = bx + int(bw * (0.72 if "right" in str(tail) else 0.28))
    ty = by + bh
    if thought:
        g.ellipse([tx - int(10 * S), ty + int(2 * S), tx + int(10 * S), ty + int(16 * S)],
                  fill=(255, 255, 255, 252), outline=(20, 20, 24, 255), width=outline_w)
        g.ellipse([tx - int(18 * S), ty + int(16 * S), tx - int(6 * S), ty + int(26 * S)],
                  fill=(255, 255, 255, 252), outline=(20, 20, 24, 255), width=outline_w)
    else:
        tip_x = tx + (int(18 * S) if "right" in str(tail) else -int(18 * S))
        pts = [(tx - int(14 * S), ty - outline_w), (tip_x, ty + tail_h), (tx + int(14 * S), ty - outline_w)]
        g.polygon(pts, fill=(255, 255, 255, 252))
        g.line([pts[0], pts[1], pts[2]], fill=(20, 20, 24, 255), width=outline_w, joint="curve")
    im.alpha_composite(t_sp, (bx + padx, by + pady))
    return shadow(im, blur=int(12 * S), dy=int(6 * S), alpha=0.25)


def highlight_sweep_sprite(text, progress, look, S, max_w):
    """Vox Documentary signature archival quote with a live left-to-right yellow chisel-tip marker sweep."""
    hl_col = tuple(look.get("accent2", (255, 214, 10)))[:3]
    ink = (24, 22, 20)
    # Render base un-highlighted text card and fully-highlighted text card, then sweep the highlight bar
    clean_text = re.sub(r"[_*~^\[\]]", "", text or "")
    t_base, info = text_block(clean_text, "serif", int(52 * S), ink, int(max_w - 64 * S), max_lines=3, align="left")
    padx, pady = int(32 * S), int(26 * S)
    W, H = t_base.width + padx * 2, t_base.height + pady * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    g.rounded_rectangle([0, 0, W - 1, H - 1], int(14 * S), fill=(250, 246, 236, 246), outline=(210, 200, 184, 220), width=max(2, int(2 * S)))
    # Draw animated chisel marker sweep across the text lines
    p = ease_out_quint(clamp(progress))
    if p > 0.01 and info.get("boxes"):
        hl_layer = Image.new("RGBA", t_base.size, (0, 0, 0, 0))
        hd = ImageDraw.Draw(hl_layer)
        xs = [b[0] for b in info["boxes"]]
        xe = [b[0] + b[2] for b in info["boxes"]]
        ys = [b[1] for b in info["boxes"]]
        hs = [b[3] for b in info["boxes"]]
        min_x, max_x = min(xs), max(xe)
        sweep_x = min_x + (max_x - min_x) * p
        for bx, by, bw, bh, _ in info["boxes"]:
            if bx < sweep_x:
                rx = min(bx + bw + 6 * S, sweep_x)
                slant = 5 * S
                pts = [(bx - 4 * S + slant, by + 2 * S), (rx + slant, by + 2 * S), (rx, by + bh - 2 * S), (bx - 4 * S, by + bh - 2 * S)]
                hd.polygon(pts, fill=hl_col + (215,))
        im.alpha_composite(hl_layer, (padx, pady))
    im.alpha_composite(t_base, (padx, pady))
    return shadow(im, blur=int(16 * S), dy=int(8 * S), alpha=0.28)
