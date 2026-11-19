"""
Antigravity Meta Suite - Zero-Cost Media Creation & Social SEO Engine
100% Free - No Paid APIs, No Credit Cards, No Cloud Schedulers.
Pollinations AI / Pillow typography + edge-tts voiceover & synced .srt + FFmpeg faststart encoding.
"""

import os
import re
import uuid
import asyncio
import logging
import urllib.parse
import subprocess
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import httpx
import edge_tts

logger = logging.getLogger("meta_suite.free_media_seo")

ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
os.makedirs(ASSETS_DIR, exist_ok=True)

# Dimension mapping for standard Meta aspect ratios
ASPECT_RATIOS = {
    "4:5": (1080, 1350),   # Instagram Feed Portrait (Recommended)
    "1:1": (1080, 1080),   # Instagram / Facebook Square Feed
    "9:16": (1080, 1920),  # Instagram Reels / Stories & Facebook Reels
    "16:9": (1920, 1080),  # Facebook Feed Landscape Video
}

DEFAULT_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
]


def _get_font(size: int) -> ImageFont.ImageFont:
    """Finds an available system TrueType font or falls back to default."""
    for font_path in DEFAULT_FONTS:
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, size)
            except Exception:
                continue
    return ImageFont.load_default()


class FreeMediaEngine:
    """Zero-budget engine for AI image generation, typography, voiceovers, and Reels."""

    @staticmethod
    def get_dimensions(aspect_ratio: str) -> Tuple[int, int]:
        return ASPECT_RATIOS.get(aspect_ratio, (1080, 1350))

    # -------------------------------------------------------------
    # 1. Image Generation (Pollinations HTTP or Local Pillow)
    # -------------------------------------------------------------
    @classmethod
    def generate_image(
        cls,
        prompt: Optional[str] = None,
        aspect_ratio: str = "4:5",
        title_overlay: Optional[str] = None,
        subtitle_overlay: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> str:
        """
        Fetches an AI image from Pollinations ($0.00 HTTP) or creates a sleek local gradient,
        applies typography hook overlay, and outputs a compliant JPEG (<8MB).
        """
        width, height = cls.get_dimensions(aspect_ratio)
        if not output_path:
            output_path = os.path.join(ASSETS_DIR, f"media_{uuid.uuid4().hex[:8]}.jpg")

        img: Optional[Image.Image] = None

        # 1. Try Pollinations if prompt is supplied
        if prompt:
            try:
                encoded = urllib.parse.quote(prompt.strip())
                pollinations_url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&nologo=true"
                logger.info("Fetching zero-cost AI image from Pollinations: %s", pollinations_url)
                with httpx.Client(timeout=20.0, follow_redirects=True) as client:
                    resp = client.get(pollinations_url)
                    if resp.status_code == 200 and len(resp.content) > 1024:
                        import io
                        raw_img = Image.open(io.BytesIO(resp.content))
                        img = raw_img.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
                        logger.info("Successfully received Pollinations image (%s bytes).", len(resp.content))
            except Exception as e:
                logger.warning("Pollinations fetch failed or timed out (%s). Falling back to local Pillow studio engine.", e)

        # 2. Local Fallback: Aesthetic Modern Dark Studio Gradient
        if img is None:
            img = cls._create_studio_gradient(width, height)

        # 3. Add High-Contrast Typography Hook Overlay if requested
        if title_overlay or subtitle_overlay:
            img = cls._apply_typography_overlay(img, title_overlay, subtitle_overlay)

        # 4. Save as strictly compliant JPEG for Instagram / Facebook
        img.save(output_path, "JPEG", quality=95, optimize=True)
        logger.info("Saved final compliant JPEG asset: %s (%dx%d)", output_path, width, height)
        return output_path

    @classmethod
    def _create_studio_gradient(cls, width: int, height: int) -> Image.Image:
        """Creates a vibrant, modern dark-mode gradient background (Deep Slate to Indigo/Violet)."""
        base = Image.new("RGB", (width, height), (15, 23, 42))  # Slate 900
        draw = ImageDraw.Draw(base)

        # Vertical gradient interpolation
        top_color = (15, 23, 42)     # Deep Slate #0f172a
        bottom_color = (67, 56, 202)  # Indigo #4338ca

        for y in range(height):
            ratio = y / height
            r = int(top_color[0] * (1 - ratio) + bottom_color[0] * ratio)
            g = int(top_color[1] * (1 - ratio) + bottom_color[1] * ratio)
            b = int(top_color[2] * (1 - ratio) + bottom_color[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))

        # Add decorative modern ambient circle
        circle_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        c_draw = ImageDraw.Draw(circle_img)
        c_center = (width // 2, int(height * 0.45))
        c_radius = int(width * 0.40)
        c_draw.ellipse(
            [(c_center[0] - c_radius, c_center[1] - c_radius),
             (c_center[0] + c_radius, c_center[1] + c_radius)],
            fill=(236, 72, 153, 50)  # Ambient pink glow
        )
        circle_img = circle_img.filter(ImageFilter.GaussianBlur(radius=80))

        base = Image.alpha_composite(base.convert("RGBA"), circle_img).convert("RGB")
        return base

    @classmethod
    def _apply_typography_overlay(
        cls,
        img: Image.Image,
        title: Optional[str],
        subtitle: Optional[str]
    ) -> Image.Image:
        """Renders high-visibility viral hooks, badges, and subtitles."""
        overlay = img.convert("RGBA")
        width, height = img.size
        draw = ImageDraw.Draw(overlay)

        font_size_title = max(42, int(width * 0.055))
        font_title = _get_font(font_size_title)

        font_size_sub = max(24, int(width * 0.035))
        font_sub = _get_font(font_size_sub)

        # Wrap title text
        title_lines = []
        if title:
            words = title.split()
            current_line = []
            for w in words:
                test_line = " ".join(current_line + [w])
                bbox = font_title.getbbox(test_line)
                text_w = bbox[2] - bbox[0]
                if text_w < width * 0.82:
                    current_line.append(w)
                else:
                    title_lines.append(" ".join(current_line))
                    current_line = [w]
            if current_line:
                title_lines.append(" ".join(current_line))

        # Calculate heights
        line_height = font_size_title * 1.3
        total_title_h = len(title_lines) * line_height
        box_padding = 40
        box_top = int(height * 0.40) - int(total_title_h / 2)
        box_bottom = int(box_top + total_title_h + (font_size_sub * 2 if subtitle else 0) + box_padding * 2)

        # Draw semi-transparent dark backdrop badge for 100% legibility
        badge_box = [int(width * 0.06), box_top - box_padding, int(width * 0.94), box_bottom]
        draw.rounded_rectangle(badge_box, radius=24, fill=(10, 15, 30, 210))

        # Render Title Lines
        cur_y = box_top
        for line in title_lines:
            bbox = font_title.getbbox(line)
            tw = bbox[2] - bbox[0]
            tx = (width - tw) // 2
            # Drop shadow
            draw.text((tx + 2, cur_y + 2), line, fill=(0, 0, 0, 220), font=font_title)
            # Main high-contrast text
            draw.text((tx, cur_y), line, fill=(255, 255, 255, 255), font=font_title)
            cur_y += line_height

        # Render Subtitle if present
        if subtitle:
            cur_y += 15
            s_bbox = font_sub.getbbox(subtitle)
            sw = s_bbox[2] - s_bbox[0]
            sx = (width - sw) // 2
            draw.text((sx, cur_y), subtitle, fill=(244, 114, 182, 255), font=font_sub)  # Light pink highlight

        return overlay.convert("RGB")

    # -------------------------------------------------------------
    # 2. Free Neural Voiceover & Synced Subtitles (edge-tts)
    # -------------------------------------------------------------
    @classmethod
    async def generate_voiceover_and_srt_async(
        cls,
        text: str,
        voice: str = "en-US-ChristopherNeural",
        output_audio_path: Optional[str] = None,
        output_srt_path: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Synthesizes 100% free neural voiceover and auto-generates matching .srt subtitle file.
        Voices supported: en-US-ChristopherNeural, en-US-JennyNeural, hi-IN-MadhurNeural, hi-IN-SwaraNeural, etc.
        """
        if not output_audio_path:
            uid = uuid.uuid4().hex[:8]
            output_audio_path = os.path.join(ASSETS_DIR, f"voice_{uid}.mp3")
            output_srt_path = os.path.join(ASSETS_DIR, f"subs_{uid}.srt")
        elif not output_srt_path:
            base, _ = os.path.splitext(output_audio_path)
            output_srt_path = f"{base}.srt"

        try:
            comm = edge_tts.Communicate(text.strip(), voice=voice)
            submaker = edge_tts.SubMaker()

            with open(output_audio_path, "wb") as f_audio:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        f_audio.write(chunk["data"])
                    elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                        submaker.feed(chunk)

            srt_content = submaker.get_srt()
            if not srt_content:
                srt_content = f"1\n00:00:00,000 --> 00:00:05,000\n{text.strip()}\n"

            with open(output_srt_path, "w", encoding="utf-8") as f_srt:
                f_srt.write(srt_content)
        except Exception as e:
            logger.warning("edge-tts live synthesis unavailable (%s). Using local synthesized audio & srt fallback.", e)
            words = len(text.strip().split())
            duration = max(3.0, round(words / 2.5, 1))

            import subprocess
            cmd = [
                "ffmpeg", "-y", "-f", "lavfi",
                "-i", f"sine=frequency=520:duration={duration}",
                "-acodec", "libmp3lame", "-ar", "44100", "-ac", "2",
                output_audio_path
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            secs = int(duration)
            millis = int((duration - secs) * 1000)
            srt_content = f"1\n00:00:00,000 --> 00:00:{secs:02d},{millis:03d}\n{text.strip()}\n"
            with open(output_srt_path, "w", encoding="utf-8") as f_srt:
                f_srt.write(srt_content)

        logger.info("Generated voiceover (%s) and subtitles (%s)", output_audio_path, output_srt_path)
        return output_audio_path, output_srt_path

    @classmethod
    def generate_voiceover_and_srt(
        cls,
        text: str,
        voice: str = "en-US-ChristopherNeural",
        output_audio_path: Optional[str] = None,
        output_srt_path: Optional[str] = None
    ) -> Tuple[str, str]:
        return asyncio.run(cls.generate_voiceover_and_srt_async(text, voice, output_audio_path, output_srt_path))

    # -------------------------------------------------------------
    # 3. FFmpeg Video Stitcher (-movflags +faststart)
    # -------------------------------------------------------------
    @classmethod
    def render_reel_video(
        cls,
        image_or_video_path: str,
        audio_path: str,
        srt_path: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> str:
        """
        Combines still keyframe image or video clip with neural audio voiceover into Meta-compliant MP4:
        H.264 video, AAC audio (44.1 kHz, 128 kbps), and -movflags +faststart (moov atom at front).
        """
        if not output_path:
            output_path = os.path.join(ASSETS_DIR, f"reel_{uuid.uuid4().hex[:8]}.mp4")

        is_image = image_or_video_path.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))

        if is_image:
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", image_or_video_path,
                "-i", audio_path,
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-c:a", "aac",
                "-b:a", "128k",
                "-ar", "44100",
                "-pix_fmt", "yuv420p",
                "-shortest",
                "-movflags", "+faststart",
                output_path
            ]
        else:
            # Video clip input: replace audio and re-encode container
            cmd = [
                "ffmpeg", "-y",
                "-i", image_or_video_path,
                "-i", audio_path,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-b:a", "128k",
                "-ar", "44100",
                "-pix_fmt", "yuv420p",
                "-shortest",
                "-movflags", "+faststart",
                output_path
            ]

        logger.info("Executing FFmpeg rendering command: %s", " ".join(cmd))
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg render failed (code {result.returncode}): {result.stderr}")

        logger.info("Successfully rendered Meta-compliant Reel video: %s", output_path)
        return output_path


# -------------------------------------------------------------
# 4. Social SEO & Viral Tag Validator
# -------------------------------------------------------------
class SocialSEOEngine:
    """Keyword-rich caption structuring, hashtag distribution, and alt-text optimization."""

    @staticmethod
    def format_instagram_seo(
        hook_title: str,
        caption_body: str,
        hashtags: Optional[List[str]] = None,
        call_to_action: Optional[str] = "Save this for later & share your thoughts below! 👇"
    ) -> Dict[str, Any]:
        """
        Structures viral Instagram caption:
        1. Strong hook with engaging emoji within first 125 chars
        2. Clean readable spacing & 1-2 line micro-takeaways
        3. Authentic Call to Action (CTA)
        4. Clean targeted hashtags (no spam dot blocks)
        """
        clean_hook = hook_title.strip()
        if not clean_hook.startswith(("🔥", "⚡", "🚀", "💡", "✨", "📌")):
            clean_hook = f"🔥 {clean_hook}"
        if len(clean_hook) > 125:
            clean_hook = clean_hook[:122] + "..."

        cta_str = f"\n\n👉 {call_to_action}" if call_to_action else ""
        body_str = f"{clean_hook}\n\n{caption_body.strip()}{cta_str}"

        # Clean and deduplicate hashtags
        valid_tags = []
        if hashtags:
            for tag in hashtags:
                t = re.sub(r"[^\w\u0900-\u097F]", "", str(tag or "")).strip()
                if t and t.lower() not in [x.lower() for x in valid_tags]:
                    valid_tags.append(t)
            valid_tags = valid_tags[:15]

        tag_string = " ".join([f"#{t}" for t in valid_tags])
        full_caption = f"{body_str}\n\n{tag_string}".strip()

        # Instagram max length guarantee
        if len(full_caption) > 2200:
            excess = len(full_caption) - 2200 + 3
            body_str = body_str[:-excess].rstrip() + "..."
            full_caption = f"{body_str}\n\n{tag_string}".strip()

        return {
            "seo_hook": clean_hook,
            "full_caption": full_caption,
            "hashtags": valid_tags,
            "hashtag_count": len(valid_tags),
            "total_chars": len(full_caption)
        }

    @staticmethod
    def format_facebook_seo(
        title: str,
        description: str,
        hashtags: Optional[List[str]] = None,
        link_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Structures Facebook & Meta Business Suite post for maximum organic feed reach and viral engagement."""
        clean_title = title.strip()
        clean_title = re.sub(r"^[【\[]\s*|\s*[】\]]$", "", clean_title).strip()
        hook_line = f"🔥 {clean_title}" if not clean_title.startswith(("🔥", "⚡", "🚀", "💡", "✨", "📌")) else clean_title

        clean_desc = description.strip()
        link_str = f"\n\n🔗 Resource link: {link_url}" if link_url else ""

        valid_tags = []
        if hashtags:
            for tag in hashtags:
                t = re.sub(r"[^\w\u0900-\u097F]", "", str(tag or "")).strip()
                if t and t.lower() not in [x.lower() for x in valid_tags]:
                    valid_tags.append(t)
        valid_tags = valid_tags[:6]

        tag_string = " ".join([f"#{t}" for t in valid_tags])

        cta_str = ""
        if "comment" not in clean_desc.lower() and "?" not in clean_desc[-80:]:
            cta_str = "\n\n👇 What's your take on this? Drop a thought below!"

        full_post = f"{hook_line}\n\n{clean_desc}{cta_str}{link_str}\n\n{tag_string}".strip()

        return {
            "title": clean_title,
            "full_post_text": full_post,
            "hashtags": valid_tags,
            "total_chars": len(full_post)
        }

    @staticmethod
    def generate_seo_alt_text(topic_or_hook: str, details: Optional[str] = None) -> str:
        """Generates an accessibility-compliant, keyword-optimized alt-text string."""
        base = f"High-contrast visual detailing: {topic_or_hook.strip()}."
        if details:
            base += f" Includes {details.strip()}."
        return base[:1000]

    # -------------------------------------------------------------
    # 5. Viral Hook Library & Retention Scorer (Reelhook-Ai Engine)
    # -------------------------------------------------------------
    VIRAL_HOOK_LIBRARY: Dict[str, List[str]] = {
        "fitness": [
            "Stop doing squats like this if you want to grow your glutes.",
            "How I lost 10kg in 3 months without giving up pizza.",
            "The exact 15-minute workout that fixed my back pain.",
            "Why your morning routine might be killing your weight loss.",
            "3 gym mistakes every beginner makes (and how to fix them).",
            "If you're still doing hours of cardio for fat loss, watch this."
        ],
        "business": [
            "The secret tool 7-figure startups use to automate everything.",
            "How to get 10 hours of work done in just 2 hours.",
            "The brutal truth about being a solopreneur no one tells you.",
            "3 networking hacks that helped me land high-ticket clients.",
            "Stop trading your time for money. Do this instead.",
            "The #1 mistake holding back your business growth."
        ],
        "finance": [
            "How the wealthy legally pay $0 in income taxes.",
            "3 money rules I wish I knew in my early 20s.",
            "The compound interest secret that turns $100 into financial freedom.",
            "Why holding your savings in cash is quietly making you poorer.",
            "5 automated micro-investing habits that build real wealth."
        ],
        "productivity": [
            "Delete these 3 apps if you actually want to stay focused today.",
            "The 2-minute rule that will cure your procrastination forever.",
            "How top performers organize their entire week in 15 minutes.",
            "Why your to-do list is actually making you less productive."
        ],
        "tech": [
            "This free AI tool feels completely illegal to know about.",
            "Stop writing code from scratch: use this automation workflow.",
            "3 AI browser extensions that will save you 20 hours this week.",
            "The massive tech shift happening right now that no one is talking about."
        ],
        "creator": [
            "How this 1 reel hook generated over 1,000,000 views.",
            "The algorithm secret Instagram doesn't want creators to know.",
            "3 caption tweaks that 10x your saves and shares instantly.",
            "Why your reels are stuck at 200 views (and the 60-second fix)."
        ],
        "motivation": [
            "You are not lazy. You are just exhausted from pretending.",
            "The harsh truth you need to hear before this year ends.",
            "Nobody is coming to save you. Build your own momentum.",
            "One year of relentless focus can completely change your life."
        ],
        "quick_hacks": [
            "Here is a genius life hack you probably never learned in school.",
            "Do this one simple trick before you sleep tonight.",
            "Save this video right now because you will need it later."
        ]
    }

    @classmethod
    def get_viral_hooks(cls, category: str = "creator", count: int = 5) -> List[str]:
        """Returns high-converting 3-second viral hook templates for Reels and Videos."""
        cat = category.lower().strip()
        hooks = cls.VIRAL_HOOK_LIBRARY.get(cat, cls.VIRAL_HOOK_LIBRARY["creator"])
        return hooks[:count]

    @classmethod
    def score_retention_hook(cls, hook: str, caption: str = "") -> Dict[str, Any]:
        """
        Evaluates 3-second hook retention power & viral SEO readiness (Score: 0 to 100).
        Analyzes curiosity gap, negative framing, numbers, CTA, and length.
        """
        hook_clean = hook.strip()
        score = 50
        factors = []

        # 1. Length analysis (optimal hook is 25 - 65 characters)
        if 20 <= len(hook_clean) <= 65:
            score += 15
            factors.append("+15: Optimal punchy hook length (<= 65 chars)")
        elif len(hook_clean) <= 125:
            score += 5
            factors.append("+5: Fits above-the-fold cutoff (<= 125 chars)")
        else:
            score -= 10
            factors.append("-10: Hook exceeds 125 chars and gets truncated")

        # 2. Number presence (proven CTR booster: "3 mistakes", "5 habits")
        if re.search(r"\b\d+\b", hook_clean) or "#1" in hook_clean:
            score += 15
            factors.append("+15: Concrete numbers or ranking detected (#1, 3, 5)")

        # 3. Negative framing / loss aversion ("Stop", "Never", "Mistake")
        negative_words = ["stop", "never", "mistake", "worst", "don't", "avoid", "illegal", "killing"]
        if any(w in hook_clean.lower() for w in negative_words):
            score += 15
            factors.append("+15: High-converting loss-aversion or warning hook")

        # 4. Curiosity gap & authority words ("secret", "brutal truth", "how to")
        curiosity_words = ["secret", "truth", "how i", "how to", "why your", "nobody", "revealed"]
        if any(w in hook_clean.lower() for w in curiosity_words):
            score += 10
            factors.append("+10: Intriguing curiosity gap established")

        # 5. Call to action presence in caption
        cta_words = ["save", "comment", "share", "follow", "link in bio", "dm me"]
        has_cta = any(w in caption.lower() for w in cta_words)
        if has_cta:
            score += 10
            factors.append("+10: High-engagement CTA detected in caption")
        else:
            factors.append("0: Consider adding a save/share CTA to boost retention")

        final_score = max(10, min(100, score))
        grade = "Viral" if final_score >= 85 else ("Strong" if final_score >= 70 else "Average")

        return {
            "score": final_score,
            "grade": grade,
            "hook": hook_clean,
            "factors": factors
        }

    # -------------------------------------------------------------
    # 6. Social Meta Tags & Schema.org JSON-LD Generator (SEOTools Engine)
    # -------------------------------------------------------------
    @staticmethod
    def generate_social_meta_tags(
        title: str,
        description: str,
        url: str,
        image_url: str,
        media_type: str = "video.other",
        published_time_iso: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates OpenGraph, Twitter Card, and Schema.org JSON-LD structured metadata."""
        clean_title = title.strip()
        clean_desc = description.strip()

        opengraph = {
            "og:title": clean_title,
            "og:description": clean_desc,
            "og:url": url,
            "og:image": image_url,
            "og:type": media_type,
            "og:site_name": "Meta Business & Social Suite"
        }

        twitter_card = {
            "twitter:card": "summary_large_image",
            "twitter:title": clean_title,
            "twitter:description": clean_desc,
            "twitter:image": image_url
        }

        schema_json_ld = {
            "@context": "https://schema.org",
            "@type": "SocialMediaPosting" if "video" not in media_type else "VideoObject",
            "headline": clean_title,
            "description": clean_desc,
            "url": url,
            "image": image_url,
            "datePublished": published_time_iso or datetime.now(timezone.utc).isoformat()
        }

        return {
            "opengraph": opengraph,
            "twitter_card": twitter_card,
            "schema_json_ld": schema_json_ld
        }
