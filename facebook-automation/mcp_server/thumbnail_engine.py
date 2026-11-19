"""
Clickbait Thumbnail & Social Post Design Engine
Implements psychological, high-CTR visual mechanics:
1. Anti-AI look: Hierarchical sizing (Crazy Bold Title + Small Subtitle).
2. Single fixed heavyweight font with horizontal/diagonal gradient text fills.
3. Box-type highlighting (styled card/badge containers, NOT flat marker lines).
4. Dramatic lighting: Radial spotlight pools, edge vignettes, and accent glow.
5. Strict aspect ratios: 16:9 (YouTube Long), 9:16 (Shorts/TikTok/Reels), 4:5 (IG Feed), 1:1 (Square).
6. Media ingestion: Ingests reference video (extracts keyframe via FFmpeg) or reference image.
7. Bottom-right safe zone preserved for video timestamps.
8. Interactive / Visual Tech Automation Feature Element (Flow Cards, Circuit Nodes).
9. Unicode emoji sanitizer: zero missing glyph rectangles.
"""

import os
import re
import math
import subprocess
from typing import Optional, Tuple, List, Dict, Any
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
os.makedirs(ASSETS_DIR, exist_ok=True)

# Aspect ratio definitions
ASPECT_RATIO_SPECS = {
    "16:9": (1920, 1080),  # YouTube Long-Form (Widescreen)
    "9:16": (1080, 1920),  # YouTube Shorts, TikTok, Instagram Reels / Stories
    "4:5": (1080, 1350),   # Instagram Feed Portrait
    "1:1": (1080, 1080)    # Facebook / Instagram Square Feed
}

# Curated High-Impact Color Themes (Gradient Start, Gradient End, Accent Border, Glow)
COLOR_THEMES = {
    "canary_crimson": {
        "grad_start": (255, 234, 0),    # Canary Yellow
        "grad_end": (255, 30, 39),      # Crimson
        "box_border": (255, 234, 0, 220),
        "glow": (255, 200, 0, 70),
        "badge_bg": (255, 30, 39, 230),
        "badge_text": (255, 255, 255)
    },
    "cyan_violet": {
        "grad_start": (0, 245, 255),    # Electric Cyan
        "grad_end": (168, 85, 247),     # Bright Violet
        "box_border": (0, 245, 255, 220),
        "glow": (0, 245, 255, 60),
        "badge_bg": (147, 51, 234, 230),
        "badge_text": (255, 255, 255)
    },
    "gold_amber": {
        "grad_start": (255, 255, 255),  # Pure White
        "grad_end": (255, 193, 7),      # Amber Gold
        "box_border": (255, 215, 0, 220),
        "glow": (255, 215, 0, 65),
        "badge_bg": (217, 119, 6, 230),
        "badge_text": (255, 255, 255)
    },
    "lime_emerald": {
        "grad_start": (118, 255, 3),    # Bright Lime
        "grad_end": (0, 230, 118),      # Emerald
        "box_border": (118, 255, 3, 220),
        "glow": (0, 230, 118, 60),
        "badge_bg": (16, 185, 129, 230),
        "badge_text": (10, 15, 25)
    },
    "fire_orange": {
        "grad_start": (255, 255, 255),  # Pure White
        "grad_end": (255, 109, 0),      # High-Voltage Orange
        "box_border": (255, 109, 0, 220),
        "glow": (255, 109, 0, 70),
        "badge_bg": (239, 68, 68, 230),
        "badge_text": (255, 255, 255)
    }
}


def _sanitize_glyphs(text: str) -> str:
    """Removes or converts unrenderable unicode emojis that cause missing glyph box rectangles."""
    if not text:
        return ""
    replacements = {
        "⚡": "//",
        "🔥": "*",
        "🚀": ">>",
        "⚠️": "[!]",
        "💡": "*",
        "🍌": "[AI]",
        "🤖": "[AI]",
        "🎬": "[VIDEO]",
        "🎥": "[VIDEO]",
        "💰": "[$]",
        "💵": "[$]",
        "💎": "[PRO]",
        "✨": "*",
        "🎯": "[TARGET]",
        "📈": "[+]",
        "✅": "[OK]",
        "❌": "[X]",
        "🛑": "[STOP]",
        "💥": "!",
        "🚨": "[!]",
        "👑": "[TOP]",
        "⭐": "*",
        "🌟": "*",
        "🔒": "[LOCKED]",
        "🔓": "[UNLOCKED]",
    }
    for emoji_char, clean_str in replacements.items():
        text = text.replace(emoji_char, clean_str)

    # Filter out non-ASCII/high unicode that cause TTF missing glyphs
    cleaned = []
    for ch in text:
        code = ord(ch)
        if 32 <= code <= 126 or code in (169, 174, 8220, 8221, 8216, 8217, 8211, 8212):
            cleaned.append(ch)
        elif code > 127:
            cleaned.append(" ")
        else:
            cleaned.append(" ")
    # Collapse multiple spaces
    return re.sub(r"\s+", " ", "".join(cleaned)).strip()


def _get_heavy_font(size: int) -> ImageFont.ImageFont:
    """Retrieves a single fixed heavyweight font."""
    candidates = [
        os.path.join(ASSETS_DIR, "fonts", "Inter.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _wrap_text_to_width(text: str, font: ImageFont.ImageFont, max_w: int) -> List[str]:
    """Wraps text so no line exceeds max_w in pixels."""
    words = text.split()
    if not words:
        return []
    lines = []
    cur_line = []
    for word in words:
        test_line = " ".join(cur_line + [word])
        bbox = font.getbbox(test_line)
        w = bbox[2] - bbox[0]
        if w <= max_w:
            cur_line.append(word)
        else:
            if cur_line:
                lines.append(" ".join(cur_line))
                cur_line = [word]
            else:
                lines.append(word)
                cur_line = []
    if cur_line:
        lines.append(" ".join(cur_line))
    return lines


class ClickbaitThumbnailEngine:
    """Industrial engine for psychologically tuned, clickbait social thumbnails & post cards."""

    @classmethod
    def extract_video_frame(cls, video_path: str, timestamp_sec: float = 1.0) -> Optional[Image.Image]:
        """Extracts a pristine representative video keyframe via FFmpeg."""
        if not os.path.exists(video_path):
            return None
        out_temp = os.path.join(ASSETS_DIR, f"temp_frame_{os.getpid()}.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(timestamp_sec),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            out_temp
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            if os.path.exists(out_temp):
                img = Image.open(out_temp).convert("RGB")
                os.remove(out_temp)
                return img
        except Exception:
            if os.path.exists(out_temp):
                try:
                    os.remove(out_temp)
                except Exception:
                    pass
        return None

    @classmethod
    def create_dramatic_background(cls, width: int, height: int, theme_glow: Tuple[int, int, int, int]) -> Image.Image:
        """Synthesizes a rich, dark cinematic background with radial lighting and edge vignette."""
        base = Image.new("RGBA", (width, height), (13, 17, 23, 255))
        draw = ImageDraw.Draw(base)

        # Subtle dark gradient
        for y in range(height):
            ratio = y / height
            shade = int(14 * (1 - ratio) + 8 * ratio)
            draw.line([(0, y), (width, y)], fill=(shade, shade + 3, shade + 8, 255))

        # Radial dramatic spotlight pools
        # Pool 1: Behind left/workflow card
        spot1 = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        s1_draw = ImageDraw.Draw(spot1)
        cx1, cy1 = int(width * 0.25), int(height * 0.48)
        radius1 = int(min(width, height) * 0.50)
        s1_draw.ellipse([(cx1 - radius1, cy1 - radius1), (cx1 + radius1, cy1 + radius1)], fill=theme_glow)
        spot1 = spot1.filter(ImageFilter.GaussianBlur(radius=int(min(width, height) * 0.16)))
        base = Image.alpha_composite(base, spot1)

        # Pool 2: Subtle accent behind right title
        spot2 = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        s2_draw = ImageDraw.Draw(spot2)
        cx2, cy2 = int(width * 0.72), int(height * 0.38)
        radius2 = int(min(width, height) * 0.38)
        s2_draw.ellipse([(cx2 - radius2, cy2 - radius2), (cx2 + radius2, cy2 + radius2)], fill=(theme_glow[0], theme_glow[1], theme_glow[2], int(theme_glow[3] * 0.6)))
        spot2 = spot2.filter(ImageFilter.GaussianBlur(radius=int(min(width, height) * 0.14)))
        base = Image.alpha_composite(base, spot2)

        # Edge vignette shading
        vignette = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        v_draw = ImageDraw.Draw(vignette)
        margin = int(min(width, height) * 0.10)
        v_draw.rectangle([0, 0, width, height], fill=(0, 0, 0, 150))
        v_draw.ellipse([margin, margin, width - margin, height - margin], fill=(0, 0, 0, 0))
        vignette = vignette.filter(ImageFilter.GaussianBlur(radius=int(margin * 0.8)))
        base = Image.alpha_composite(base, vignette)

        return base.convert("RGB")

    @classmethod
    def render_gradient_text_mask(
        cls,
        text: str,
        font: ImageFont.ImageFont,
        start_color: Tuple[int, int, int],
        end_color: Tuple[int, int, int]
    ) -> Image.Image:
        """Renders high-impact gradient text using an alpha stencil."""
        bbox = font.getbbox(text)
        tw = max(1, bbox[2] - bbox[0])
        th = max(1, bbox[3] - bbox[1])
        pad = 20

        # Alpha mask of text
        mask = Image.new("L", (tw + pad * 2, th + pad * 2), 0)
        m_draw = ImageDraw.Draw(mask)
        m_draw.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=255)

        # Linear horizontal gradient
        grad = Image.new("RGBA", (tw + pad * 2, th + pad * 2))
        total_w = tw + pad * 2
        for x in range(total_w):
            t = x / float(total_w)
            r = int(start_color[0] * (1 - t) + end_color[0] * t)
            g = int(start_color[1] * (1 - t) + end_color[1] * t)
            b = int(start_color[2] * (1 - t) + end_color[2] * t)
            for y in range(th + pad * 2):
                grad.putpixel((x, y), (r, g, b, 255))

        grad.putalpha(mask)
        return grad

    @classmethod
    def draw_workflow_feature_card(
        cls,
        draw: ImageDraw.ImageDraw,
        img: Image.Image,
        left: int,
        top: int,
        card_w: int,
        card_h: int,
        theme: Dict[str, Any]
    ):
        """
        Renders a stunning modern UI workflow card showcasing:
        Google Flow [AI] -> Antigravity Engine -> $0.00 Total Cost
        """
        # 1. Main Glass Card Container
        card_rect = [left, top, left + card_w, top + card_h]
        draw.rounded_rectangle(card_rect, radius=24, fill=(16, 22, 34, 235), outline=theme["box_border"], width=3)

        # 2. Window Title Bar
        header_y = top + 22
        # Traffic light dots
        draw.ellipse([left + 24, header_y + 4, left + 40, header_y + 20], fill=(255, 95, 86))
        draw.ellipse([left + 48, header_y + 4, left + 64, header_y + 20], fill=(255, 189, 46))
        draw.ellipse([left + 72, header_y + 4, left + 88, header_y + 20], fill=(39, 201, 63))

        font_header = _get_heavy_font(20)
        draw.text((left + 104, header_y), "WORKFLOW ENGINE // v3.2", font=font_header, fill=(160, 180, 205))

        # Status badge top right
        status_txt = "[ ONLINE ]"
        s_bbox = font_header.getbbox(status_txt)
        sb_w = s_bbox[2] - s_bbox[0] + 20
        sb_x = left + card_w - sb_w - 24
        draw.rounded_rectangle([sb_x, header_y - 2, sb_x + sb_w, header_y + 24], radius=6, fill=(16, 185, 129, 220))
        draw.text((sb_x + 10, header_y), status_txt, font=font_header, fill=(10, 15, 25))

        # Horizontal separator
        draw.line([(left + 16, header_y + 36), (left + card_w - 16, header_y + 36)], fill=(40, 52, 75, 200), width=1)

        # 3. Node 1: Google Flow
        node1_top = header_y + 54
        node_h = int(card_h * 0.22)
        n_pad = 24
        node_w = card_w - n_pad * 2
        node1_rect = [left + n_pad, node1_top, left + n_pad + node_w, node1_top + node_h]
        draw.rounded_rectangle(node1_rect, radius=14, fill=(24, 33, 49, 240), outline=(0, 245, 255, 180), width=2)

        font_node_title = _get_heavy_font(25)
        font_node_sub = _get_heavy_font(18)
        font_pill = _get_heavy_font(16)

        # Node 1 Icon & Title
        draw.ellipse([left + n_pad + 16, node1_top + 16, left + n_pad + 32, node1_top + 32], fill=(0, 245, 255))
        draw.text((left + n_pad + 42, node1_top + 12), "1. GOOGLE FLOW  [AI]", font=font_node_title, fill=(255, 234, 0))
        draw.text((left + n_pad + 42, node1_top + 44), "Nano Banana Pro / 2.1 Engine  Scene Synthesis", font=font_node_sub, fill=(210, 225, 245))

        # Node 1 Pill
        p1_rect = [left + n_pad + 42, node1_top + 76, left + n_pad + 240, node1_top + 106]
        draw.rounded_rectangle(p1_rect, radius=6, fill=(0, 245, 255, 40), outline=(0, 245, 255, 160), width=1)
        draw.text((left + n_pad + 52, node1_top + 80), "FREE TIER  $0.00 COST", font=font_pill, fill=(0, 245, 255))

        # 4. Connector Wire 1 -> 2
        wire1_top = node1_top + node_h
        wire1_bottom = wire1_top + int(card_h * 0.08)
        mid_x = left + card_w // 2
        draw.line([(mid_x, wire1_top), (mid_x, wire1_bottom)], fill=(0, 245, 255, 220), width=3)
        # Pulse dot & down arrow
        draw.ellipse([mid_x - 6, (wire1_top + wire1_bottom) // 2 - 6, mid_x + 6, (wire1_top + wire1_bottom) // 2 + 6], fill=(0, 245, 255))
        draw.polygon([(mid_x - 7, wire1_bottom - 8), (mid_x + 7, wire1_bottom - 8), (mid_x, wire1_bottom)], fill=(0, 245, 255))

        # 5. Node 2: Antigravity Suite
        node2_top = wire1_bottom
        node2_rect = [left + n_pad, node2_top, left + n_pad + node_w, node2_top + node_h]
        draw.rounded_rectangle(node2_rect, radius=14, fill=(24, 33, 49, 240), outline=(168, 85, 247, 180), width=2)

        # Node 2 Icon & Title
        draw.ellipse([left + n_pad + 16, node2_top + 16, left + n_pad + 32, node2_top + 32], fill=(168, 85, 247))
        draw.text((left + n_pad + 42, node2_top + 12), "2. ANTIGRAVITY ENGINE", font=font_node_title, fill=(255, 255, 255))
        draw.text((left + n_pad + 42, node2_top + 44), "Autonomous Video Director & Beat-Sync Editor", font=font_node_sub, fill=(210, 225, 245))

        # Node 2 Pill
        p2_rect = [left + n_pad + 42, node2_top + 76, left + n_pad + 250, node2_top + 106]
        draw.rounded_rectangle(p2_rect, radius=6, fill=(168, 85, 247, 40), outline=(168, 85, 247, 160), width=1)
        draw.text((left + n_pad + 52, node2_top + 80), "100% AUTOPILOT ACTIVE", font=font_pill, fill=(216, 180, 254))

        # 6. Connector Wire 2 -> 3
        wire2_top = node2_top + node_h
        wire2_bottom = wire2_top + int(card_h * 0.08)
        draw.line([(mid_x, wire2_top), (mid_x, wire2_bottom)], fill=(118, 255, 3, 220), width=3)
        draw.ellipse([mid_x - 6, (wire2_top + wire2_bottom) // 2 - 6, mid_x + 6, (wire2_top + wire2_bottom) // 2 + 6], fill=(118, 255, 3))
        draw.polygon([(mid_x - 7, wire2_bottom - 8), (mid_x + 7, wire2_bottom - 8), (mid_x, wire2_bottom)], fill=(118, 255, 3))

        # 7. Node 3: Result / Zero Cost Banner
        node3_top = wire2_bottom
        node3_h = card_h - (node3_top - top) - 22
        node3_rect = [left + n_pad, node3_top, left + n_pad + node_w, node3_top + node3_h]
        draw.rounded_rectangle(node3_rect, radius=14, fill=(35, 45, 28, 240), outline=(118, 255, 3, 220), width=3)

        font_cost = _get_heavy_font(28)
        font_cost_sub = _get_heavy_font(18)
        draw.text((left + n_pad + 32, node3_top + 16), "TOTAL COST: $0.00 / FREE", font=font_cost, fill=(118, 255, 3))
        draw.text((left + n_pad + 32, node3_top + 54), "Zero Credit Card • Instant Export • Lifetime Free", font=font_cost_sub, fill=(240, 253, 244))

    @classmethod
    def generate_clickbait_thumbnail(
        cls,
        crazy_title: str,
        subtitle: str,
        reference_media: Optional[str] = None,
        aspect_ratio: str = "16:9",
        color_theme: str = "canary_crimson",
        badge_text: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> str:
        """
        Creates a complete clickbait thumbnail / social card adhering to all directorial laws:
        - Crazy Bold Title (Gradient Text in single fixed font).
        - Small Subtitle ("What it is about") with box-type highlighting.
        - High-contrast visual focal point and dramatic spotlight lighting.
        - Bottom-right safe zone preserved for timestamps.
        - Dynamic auto-wrap & font auto-fit (zero text truncation).
        - Glyph sanitizer (zero missing glyph boxes).
        - Interactive tech workflow feature card.
        """
        width, height = ASPECT_RATIO_SPECS.get(aspect_ratio, (1920, 1080))
        theme = COLOR_THEMES.get(color_theme, COLOR_THEMES["canary_crimson"])
        is_vertical = height > width

        # Sanitize text
        clean_crazy = _sanitize_glyphs(crazy_title).upper().strip()
        clean_sub = _sanitize_glyphs(subtitle).strip()
        clean_badge = _sanitize_glyphs(badge_text or "100% FREE AUTOMATION").upper().strip()

        # 1. Base Canvas Preparation
        canvas: Optional[Image.Image] = None
        if reference_media and os.path.exists(reference_media):
            ext = os.path.splitext(reference_media)[1].lower()
            if ext in [".mp4", ".mov", ".mkv", ".webm", ".avi"]:
                canvas = cls.extract_video_frame(reference_media, timestamp_sec=1.5)
            elif ext in [".jpg", ".jpeg", ".png", ".webp"]:
                try:
                    canvas = Image.open(reference_media).convert("RGB")
                except Exception:
                    canvas = None

        if canvas:
            # Smart center-crop to target aspect ratio
            src_w, src_h = canvas.size
            target_ratio = width / height
            src_ratio = src_w / src_h

            if src_ratio > target_ratio:
                new_w = int(src_h * target_ratio)
                left = (src_w - new_w) // 2
                canvas = canvas.crop((left, 0, left + new_w, src_h))
            else:
                new_h = int(src_w / target_ratio)
                top = (src_h - new_h) // 2
                canvas = canvas.crop((0, top, src_w, top + new_h))

            canvas = canvas.resize((width, height), Image.Resampling.LANCZOS)
            if is_vertical:
                scrim = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                scrim_draw = ImageDraw.Draw(scrim)
                for y in range(height):
                    if y < int(height * 0.45):
                        alpha = int(170 * (1 - y / (height * 0.45)))
                        scrim_draw.line([(0, y), (width, y)], fill=(10, 15, 25, alpha))
                canvas = Image.alpha_composite(canvas.convert("RGBA"), scrim).convert("RGB")
            else:
                scrim = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                scrim_draw = ImageDraw.Draw(scrim)
                split_x = int(width * 0.42)
                for x in range(split_x, width):
                    t = (x - split_x) / float(width - split_x)
                    alpha = int(210 * (t ** 1.3))
                    scrim_draw.line([(x, 0), (x, height)], fill=(10, 15, 25, alpha))
                canvas = Image.alpha_composite(canvas.convert("RGBA"), scrim).convert("RGB")
        else:
            canvas = cls.create_dramatic_background(width, height, theme["glow"])

        img = canvas.convert("RGBA")
        draw = ImageDraw.Draw(img)

        # 2. Layout & Composition Metrics
        if is_vertical:
            # 9:16 Vertical Composition
            anchor_x = int(width * 0.07)
            max_text_w = int(width * 0.86)
            cur_y = int(height * 0.10)

            # Top Badge
            font_badge = _get_heavy_font(max(20, int(width * 0.026)))
            b_box = font_badge.getbbox(clean_badge)
            bw = b_box[2] - b_box[0] + 32
            bh = b_box[3] - b_box[1] + 16
            draw.rounded_rectangle([anchor_x, cur_y, anchor_x + bw, cur_y + bh], radius=8, fill=theme["badge_bg"])
            draw.text((anchor_x + 16 - b_box[0], cur_y + 8 - b_box[1]), clean_badge, font=font_badge, fill=theme["badge_text"])
            cur_y += bh + 24

            # Crazy Title Auto-Fit
            words = clean_crazy.split()
            if len(words) >= 3:
                mid = len(words) // 2
                crazy_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                crazy_lines = [clean_crazy]

            font_size_crazy = max(64, int(width * 0.092))
            font_crazy = _get_heavy_font(font_size_crazy)
            while font_size_crazy > 42:
                max_w = max(font_crazy.getbbox(line)[2] - font_crazy.getbbox(line)[0] for line in crazy_lines)
                if max_w + 48 <= max_text_w:
                    break
                font_size_crazy -= 4
                font_crazy = _get_heavy_font(font_size_crazy)

            for line in crazy_lines:
                grad_img = cls.render_gradient_text_mask(line, font_crazy, theme["grad_start"], theme["grad_end"])
                gw, gh = grad_img.size
                card_rect = [anchor_x - 16, cur_y - 8, anchor_x + gw + 16, cur_y + gh + 8]
                draw.rounded_rectangle(card_rect, radius=14, fill=(10, 15, 25, 230), outline=theme["box_border"], width=3)
                img.paste(grad_img, (anchor_x, cur_y), grad_img)
                cur_y += gh + 18

            # Subtitle Box
            cur_y += 8
            font_sub = _get_heavy_font(max(24, int(width * 0.034)))
            sub_lines = _wrap_text_to_width(clean_sub, font_sub, max_text_w - 40)
            line_h = font_sub.getbbox("Ag")[3] - font_sub.getbbox("Ag")[1] + 8
            sub_h = line_h * len(sub_lines) + 24
            sub_w = min(max_text_w, max(font_sub.getbbox(l)[2] - font_sub.getbbox(l)[0] for l in sub_lines) + 40)
            draw.rounded_rectangle([anchor_x, cur_y, anchor_x + sub_w, cur_y + sub_h], radius=12, fill=(22, 30, 46, 235), outline=(255, 255, 255, 110), width=2)
            sy = cur_y + 12
            for sl in sub_lines:
                draw.text((anchor_x + 20, sy), sl, font=font_sub, fill=(240, 246, 252))
                sy += line_h
            cur_y += sub_h + 30

            # Workflow Card in Middle (Only if NO reference media is supplied)
            if not reference_media:
                card_top = cur_y
                card_h = int(height * 0.42)
                cls.draw_workflow_feature_card(draw, img, anchor_x, card_top, max_text_w, card_h, theme)

                # Bottom CTA Callout
                cta_y = card_top + card_h + 36
                cta_rect = [anchor_x, cta_y, anchor_x + max_text_w, cta_y + 70]
                draw.rounded_rectangle(cta_rect, radius=14, fill=(255, 234, 0, 240), outline=(255, 255, 255), width=2)
                font_cta = _get_heavy_font(26)
                cta_txt = "NO CREDIT CARD  100% FREE FOREVER"
                c_bbox = font_cta.getbbox(cta_txt)
                cw = c_bbox[2] - c_bbox[0]
                cx = anchor_x + (max_text_w - cw) // 2
                draw.text((cx, cta_y + 18), cta_txt, font=font_cta, fill=(10, 15, 25))

        else:
            # 16:9 Landscape Composition (The 60/40 Directorial Standard)
            # Left side: Workflow Feature Card (Only if NO reference media is supplied)
            if not reference_media:
                card_left = int(width * 0.05)
                card_top = int(height * 0.13)
                card_w = int(width * 0.41)
                card_h = int(height * 0.74)
                cls.draw_workflow_feature_card(draw, img, card_left, card_top, card_w, card_h, theme)

            # Right side: Title & Psychological Hook
            anchor_x = int(width * 0.50)
            max_text_w = int(width * 0.45)
            cur_y = int(height * 0.16)

            # Top Badge
            font_badge = _get_heavy_font(max(24, int(height * 0.032)))
            b_box = font_badge.getbbox(clean_badge)
            bw = b_box[2] - b_box[0] + 32
            bh = b_box[3] - b_box[1] + 16
            draw.rounded_rectangle([anchor_x, cur_y, anchor_x + bw, cur_y + bh], radius=8, fill=theme["badge_bg"])
            draw.text((anchor_x + 16 - b_box[0], cur_y + 8 - b_box[1]), clean_badge, font=font_badge, fill=theme["badge_text"])
            cur_y += bh + 24

            # Crazy Title Auto-Fit & Wrapping
            words = clean_crazy.split()
            if len(words) >= 3:
                mid = len(words) // 2
                crazy_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                crazy_lines = [clean_crazy]

            font_size_crazy = max(80, int(height * 0.125))
            font_crazy = _get_heavy_font(font_size_crazy)
            while font_size_crazy > 48:
                max_w = max(font_crazy.getbbox(line)[2] - font_crazy.getbbox(line)[0] for line in crazy_lines)
                if max_w + 50 <= max_text_w:
                    break
                font_size_crazy -= 4
                font_crazy = _get_heavy_font(font_size_crazy)

            for line in crazy_lines:
                grad_img = cls.render_gradient_text_mask(line, font_crazy, theme["grad_start"], theme["grad_end"])
                gw, gh = grad_img.size
                card_rect = [anchor_x - 18, cur_y - 8, anchor_x + gw + 18, cur_y + gh + 8]
                draw.rounded_rectangle(card_rect, radius=16, fill=(10, 15, 25, 230), outline=theme["box_border"], width=3)
                img.paste(grad_img, (anchor_x, cur_y), grad_img)
                cur_y += gh + 22

            # Subtitle Card
            cur_y += 6
            font_sub = _get_heavy_font(max(30, int(height * 0.040)))
            sub_lines = _wrap_text_to_width(clean_sub, font_sub, max_text_w - 40)
            line_h = font_sub.getbbox("Ag")[3] - font_sub.getbbox("Ag")[1] + 10
            sub_h = line_h * len(sub_lines) + 26
            sub_w = min(max_text_w, max(font_sub.getbbox(l)[2] - font_sub.getbbox(l)[0] for l in sub_lines) + 44)
            draw.rounded_rectangle([anchor_x, cur_y, anchor_x + sub_w, cur_y + sub_h], radius=14, fill=(24, 32, 48, 235), outline=(255, 255, 255, 110), width=2)
            sy = cur_y + 14
            for sl in sub_lines:
                draw.text((anchor_x + 22, sy), sl, font=font_sub, fill=(240, 246, 252))
                sy += line_h
            cur_y += sub_h + 24

            # Feature Benefit Pills (Horizontal)
            pill_font = _get_heavy_font(20)
            pills = [
                ("[ ZERO API COST ]", (16, 185, 129, 220), (10, 15, 25)),
                ("[ 1-CLICK AUTOPILOT ]", (147, 51, 234, 220), (255, 255, 255)),
                ("[ 4K EXPORT ]", (217, 119, 6, 220), (255, 255, 255))
            ]
            px = anchor_x
            for p_txt, p_bg, p_fg in pills:
                p_box = pill_font.getbbox(p_txt)
                pw = p_box[2] - p_box[0] + 20
                ph = p_box[3] - p_box[1] + 12
                draw.rounded_rectangle([px, cur_y, px + pw, cur_y + ph], radius=8, fill=p_bg)
                draw.text((px + 10 - p_box[0], cur_y + 6 - p_box[1]), p_txt, font=pill_font, fill=p_fg)
                px += pw + 14

            # Bottom-right safe zone (Preserve 00:00 timestamp)
            # Coordinates (1650, 940) to (1920, 1080) are kept free.

        # 8. Save output
        if not output_path:
            clean_name = re.sub(r"[^a-zA-Z0-9]", "_", crazy_title.lower())[:25]
            output_path = os.path.join(ASSETS_DIR, f"thumb_{clean_name}_{aspect_ratio.replace(':', 'x')}.jpg")

        final_img = img.convert("RGB")
        final_img.save(output_path, "JPEG", quality=95, optimize=True)
        return output_path


thumbnail_engine = ClickbaitThumbnailEngine()
