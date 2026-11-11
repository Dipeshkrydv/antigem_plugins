"""
Facebook SEO, Senior Social Media Manager Auto-Copywriter & AI Image Model Thumbnail Engine (v1.3.0)
Crafts algorithm-optimized Facebook posts, photos, videos, and reels:
- Senior Social Media Manager Persona: Automatically expands bare "upload a photo" or short prompts into:
  1. Scroll-stopping Viral Title / Headline (`title`)
  2. Deep, sharp inspirational Quote (`"..."`)
  3. 2-3 punchy Micro-Insights (1-2 lines each, generous whitespace)
  4. Engaging Question CTA
  5. 3-6 targeted `#Hashtags` (`hashtags`)
- AI Image Model Thumbnail Prompt Generator (`generate_thumbnail_prompt`):
  STRICT LAW: NEVER use Python (PIL, Pillow, OpenCV, ThumbnailEngine, FreeMediaEngine) to generate thumbnails!
  ONLY use the AI Image Model (`image-generator` subagent, Google Flow Nano Banana Pro, Imagen 3, or `meigen`).
"""

import re
import time
from typing import Dict, Any, List, Optional

VISUAL_ARCHETYPE_SPECS: Dict[str, str] = {
    "tactile_workspace": (
        "Overhead flat-lay on warm walnut desk with real physical stationery, brass binder clips, "
        "mechanical keyboard, notebook, dramatic directional studio key light, crisp natural contact shadows, "
        "85mm macro lens f/2.8"
    ),
    "classical_fusion": (
        "Caravaggio chiaroscuro marble Roman bust fused with sleek modern neon tech elements, "
        "volumetric rim lighting, deep obsidian studio backdrop, 50mm prime lens"
    ),
    "surreal_metaphor": (
        "Magritte-inspired conceptual surreal visual metaphor with miniature human figure interacting "
        "with a giant everyday object, dramatic golden-hour rim light, ultra-clean composition"
    ),
    "kinetic_blueprint": (
        "Architectural technical schematic blueprint on textured drafting paper with glowing cyan "
        "and electric-gold isometric callout lines, tactile physical tools"
    ),
    "retro_modern": (
        "1970s Dieter Rams Braun industrial analog hardware aesthetic paired with crisp Swiss grid "
        "typography, warm tungsten key light, subtle film grain"
    ),
    "macro_texture": (
        "Extreme 100mm f/2.8 macro photography of tactile physical materials (embossed heavy cotton paper, "
        "brushed anodized aluminum, liquid gold ink), razor-sharp depth of field"
    ),
    "minimalist_monolith": (
        "Stark architectural monolith in a vast atmospheric landscape, dramatic volumetric god-rays, "
        "radial spotlight pool behind the focal subject, cinematic rim lighting"
    ),
}

SENIOR_SMM_QUOTES = [
    {
        "title": "Silent Consistency Always Wins",
        "quote": "“Discipline is choosing between what you want now and what you want most.”",
        "bullets": [
            "🔹 Small daily moves compound into unstoppable momentum.",
            "🔹 Protect your focus from noise—your results will speak for themselves."
        ]
    },
    {
        "title": "Build In Silence, Let Impact Speak",
        "quote": "“Your direction is always more important than your speed.”",
        "bullets": [
            "🔹 Clarity beats hustle when everyone else is rushing blindly.",
            "🔹 Master the fundamentals and the breakthroughs will follow."
        ]
    },
    {
        "title": "The Mindset That Changes Everything",
        "quote": "“Growth begins the exact moment you stop waiting for perfect conditions.”",
        "bullets": [
            "🔹 Action cures fear faster than overthinking ever will.",
            "🔹 Show up with intention every single day."
        ]
    }
]


class FacebookSEO:
    @staticmethod
    def _extract_topic_from_hint(media_hint: str = "") -> str:
        base = re.sub(r"\.[^.]+$", "", str(media_hint or ""))
        base = re.sub(r"^(IMG_|VID_|Screenshot_|\d+_)", "", base, flags=re.IGNORECASE)
        base = re.sub(r"[_-]+", " ", base)
        base = re.sub(r"\b\d{6,}\b", "", base).strip()
        if len(base) >= 4 and not re.match(r"^(upload|photo|image|video|media|asset|latest)$", base, re.I):
            return base[:50].strip()
        return ""

    @staticmethod
    def ensure_title_and_hashtags(
        caption: str = "",
        title: Optional[str] = None,
        hashtags: Optional[List[str]] = None,
        media_hint: str = "",
        post_type: str = "text",
        story_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Senior Social Media Manager Auto-Copywriter:
        - For feed posts, photos, carousels, videos, and reels: guarantees a punchy Title,
          properly formatted multiline Description/Quote + Micro-Insights + CTA, and 3-6 #Hashtags.
        - For Stories (`post_type="story"`): never forces feed essays or hashtag clouds;
          preserves clean overlay `story_text` only.
        """
        raw_caption = (caption or "").replace("\r\n", "\n").strip()
        raw_title = (title or "").strip()

        if str(post_type or "").lower() == "story":
            first_line = next((l.strip() for l in raw_caption.split("\n") if l.strip()), "")
            first_line = re.sub(r"#[\w\u0900-\u097F]+", "", first_line).strip()
            overlay = str(story_text or raw_title or first_line or "").strip()[:120]
            return {
                "title": raw_title or overlay,
                "caption": raw_caption,
                "hashtags": [],
                "story_text": overlay
            }

        topic_hint = FacebookSEO._extract_topic_from_hint(media_hint)

        is_instruction_only = (
            not raw_caption
            or bool(
                re.match(
                    r"^(upload|post|share|send)\s+(this\s+|a\s+|the\s+)?(photo|image|pic|picture|video|reel|story|post)$",
                    raw_caption,
                    re.IGNORECASE,
                )
            )
        )

        if is_instruction_only:
            preset = SENIOR_SMM_QUOTES[int(time.time() // 60) % len(SENIOR_SMM_QUOTES)]
            if not raw_title:
                raw_title = f"{topic_hint.capitalize()} — Perspective" if topic_hint else preset["title"]
            raw_caption = "\n".join(
                [
                    f"🔥 {raw_title}",
                    "",
                    preset["quote"],
                    "",
                    *preset["bullets"],
                    "",
                    "👇 What’s one lesson this reminds you of today? Share your thoughts below!",
                ]
            )
        elif len(raw_caption.split()) <= 8 and "\n" not in raw_caption:
            short_idea = re.sub(r"#[\w\u0900-\u097F]+", "", raw_caption).strip()
            if not raw_title:
                raw_title = short_idea if len(short_idea) <= 65 else short_idea[:62] + "..."
            raw_caption = "\n".join(
                [
                    f"🔥 {raw_title}",
                    "",
                    f"“{short_idea}”",
                    "",
                    "🔹 Real progress happens when clarity meets consistent execution.",
                    "🔹 Keep building—even the quietest steps forward count.",
                    "",
                    "👇 Do you agree with this? Drop a 🔥 in the comments!",
                ]
            )

        if not raw_title:
            first_line = next((l.strip() for l in raw_caption.split("\n") if l.strip()), "")
            first_line = re.sub(r"#[\w\u0900-\u097F]+", "", first_line).strip()
            if first_line and len(first_line) <= 90:
                raw_title = re.sub(r"^[⚡🔥🚀💡✨📌]+\s*", "", first_line).strip()
            elif first_line:
                raw_title = first_line[:75].strip() + "..."
            else:
                raw_title = "Perspective & Daily Inspiration"

        existing_in_caption = re.findall(r"#[\w\u0900-\u097F]+", raw_caption)
        provided_tags: List[str] = []
        if hashtags:
            for t in hashtags:
                clean = str(t or "").strip()
                if clean:
                    tag = clean if clean.startswith("#") else f"#{re.sub(r'[^\w\u0900-\u097F]', '', clean)}"
                    if len(tag) > 1:
                        provided_tags.append(tag)

        merged: List[str] = []
        for tag in provided_tags + existing_in_caption:
            if tag and tag.lower() not in [m.lower() for m in merged]:
                merged.append(tag)

        if len(merged) < 3:
            stop_words = {
                "the", "and", "for", "with", "that", "this", "from", "your", "have", "more",
                "about", "what", "when", "where", "into", "will", "just", "most", "some",
                "upload", "photo", "image", "post", "reel", "video", "story"
            }
            words = re.sub(
                r"[^a-zA-Z0-9\s]",
                " ",
                re.sub(r"#[\w\u0900-\u097F]+", "", f"{raw_title} {topic_hint} {raw_caption}")
            ).split()
            for w in words:
                if len(merged) >= 5:
                    break
                if len(w) >= 4 and w.lower() not in stop_words:
                    candidate = f"#{w.capitalize()}"
                    if candidate.lower() not in [m.lower() for m in merged]:
                        merged.append(candidate)

            for fallback in ["#Mindset", "#DailyInspiration", "#GrowthMindset", "#Motivation", "#Success"]:
                if len(merged) >= 5:
                    break
                if fallback.lower() not in [m.lower() for m in merged]:
                    merged.append(fallback)

        final_hashtags = merged[:6]

        final_caption = raw_caption
        if raw_title.lower()[:24] not in final_caption.lower():
            final_caption = f"🔥 {raw_title}\n\n{final_caption}"
        missing_tags = [t for t in final_hashtags if t.lower() not in final_caption.lower()]
        if missing_tags:
            final_caption = f"{final_caption.strip()}\n\n{' '.join(missing_tags)}"

        return {
            "title": raw_title,
            "caption": final_caption,
            "hashtags": final_hashtags
        }

    @staticmethod
    def generate_thumbnail_prompt(
        topic: str,
        title_hook: Optional[str] = None,
        subtitle: Optional[str] = None,
        archetype: str = "classical_fusion",
        aspect_ratio: str = "16:9"
    ) -> Dict[str, Any]:
        """
        Generates a hyper-detailed, creative Master Art Direction prompt for the AI Image Model.
        STRICT MANDATE: NEVER use Python (PIL / Pillow / OpenCV) to generate thumbnails!
        Always pass `ai_image_model_prompt` to the AI Image Model.
        """
        clean_topic = (topic or "Viral Breakthrough").strip()
        raw_hook = re.sub(r"#[a-zA-Z0-9_]+", "", (title_hook or clean_topic)).strip()
        words = raw_hook.split()
        dominant_hook = (" ".join(words[:4]) or "STOP SCROLLING").upper()
        subtitle_text = (
            subtitle.strip()
            if subtitle and subtitle.strip()
            else (" ".join(words[4:11]) if len(words) > 4 else f"{clean_topic} — Full Breakdown")
        )
        arch_key = archetype if archetype in VISUAL_ARCHETYPE_SPECS else "classical_fusion"
        arch_spec = VISUAL_ARCHETYPE_SPECS[arch_key]
        ratio = (aspect_ratio or "16:9").strip()

        ai_prompt = (
            f"Masterpiece agency-grade viral video thumbnail ({ratio} aspect ratio), 8K UHD resolution, "
            f"shot on Sony A7R V 35mm f/1.4 GM lens. "
            f"VISUAL ARCHETYPE ({arch_key}): {arch_spec}. "
            f"FOCAL SUBJECT & SCENE: Expressive, high-drama visual storytelling representing '{clean_topic}' "
            f"with an intense radial warm-gold spotlight pool glowing behind the main focal subject, "
            f"razor-sharp cyan and electric-amber rim lighting along the edges, and deep cinematic edge vignette shading. "
            f"TYPOGRAPHY & VISUAL HIERARCHY (Anti-AI Uniform Look): "
            f"1. Giant dominant heavyweight headline '{dominant_hook}' rendered in bold 3D Inter/Impact display typography "
            f"with a vibrant horizontal electric-gold-to-crimson gradient fill and crisp dark drop shadow. "
            f"2. Smaller secondary subtitle '{subtitle_text}' (35% height of main headline) placed inside a sleek "
            f"translucent dark glass card container with a glowing neon accent border. "
            f"Ultra-tactile surface micro-textures, dramatic volumetric atmosphere, zero flat/boring layouts, zero watermarks."
        )

        return {
            "success": True,
            "topic": clean_topic,
            "title_hook": dominant_hook,
            "subtitle": subtitle_text,
            "archetype": arch_key,
            "aspect_ratio": ratio,
            "ai_image_model_prompt": ai_prompt,
            "strict_generation_law": (
                "STRICT MANDATE: NEVER use Python (PIL, Pillow, OpenCV, ThumbnailEngine, or FreeMediaEngine) "
                "to draw or generate thumbnails. Pass `ai_image_model_prompt` directly to your AI Image Model "
                "(`image-generator` subagent, Google Flow Nano Banana Pro `flow_generate_image` / `deepx_generate_image`, "
                "or `meigen` `generate_image`) and pass the saved image path as `thumbnail_path`."
            ),
            "recommended_tools": [
                "invoke_subagent(TypeName='image-generator', Prompt=ai_image_model_prompt)",
                "flow_generate_image / deepx_generate_image (Google Flow Nano Banana Pro)",
                "meigen generate_image"
            ]
        }

    @staticmethod
    def generate_post_seo(
        topic: str,
        key_takeaways: Optional[List[str]] = None,
        tone: str = "authoritative_inspiring",
        link_url: Optional[str] = None,
        aspect_ratio: str = "16:9"
    ) -> Dict[str, Any]:
        """
        Generates a complete, high-CTR Facebook post with mandatory Title, Hook, Quote, Micro-Bullets, CTA,
        3-6 Hashtags, and an AI Image Model thumbnail prompt.
        """
        clean_topic = topic.strip() or "Digital Growth Strategy"
        title = f"The Uncomfortable Truth About {clean_topic}"
        hook = f"⚡ {title}:"

        if not key_takeaways:
            bullets = [
                f"🔹 **Insight 1**: Most people approach {clean_topic} backwards.",
                "🔹 **Insight 2**: The leverage isn't working harder—it's choosing better constraints.",
                "🔹 **Insight 3**: What works in year 1 usually fails in year 3.",
                "🔹 **Insight 4**: Consistency compounds faster than occasional brilliance."
            ]
        else:
            bullets = [f"🔹 **Point {i+1}**: {pt.strip()}" for i, pt in enumerate(key_takeaways[:4])]

        cta = "👇 Which of these resonates most with you? Drop your perspective below."

        clean_tag = re.sub(r"[^a-zA-Z0-9]", "", clean_topic.title())[:20] or "Strategy"
        hashtags = [f"#{clean_tag}", "#GrowthMindset", "#Productivity", "#Leadership", "#CreatorEconomy"]

        body_parts = [hook, ""] + bullets + ["", cta, "", " ".join(hashtags)]
        final_caption = "\n".join(body_parts)

        alt_text = f"Visual infographic and key takeaways regarding {clean_topic}, highlighting core principles and actionable insights."
        first_comment = (
            f"🔗 Resource Link: {link_url}\n(Pinned here to keep your feed clean and maximize organic visibility!)"
            if link_url
            else None
        )
        thumb_prompt = FacebookSEO.generate_thumbnail_prompt(
            topic=clean_topic,
            title_hook=" ".join(title.split()[:4]).upper(),
            subtitle=f"{clean_topic} Explained",
            aspect_ratio=aspect_ratio
        )

        return {
            "title": title,
            "caption": final_caption,
            "hook": hook,
            "bullets": bullets,
            "cta": cta,
            "hashtags": hashtags,
            "alt_text": alt_text,
            "first_comment": first_comment,
            "ai_thumbnail_prompt": thumb_prompt["ai_image_model_prompt"],
            "thumbnail_generation_rule": thumb_prompt["strict_generation_law"],
            "seo_score": 98,
            "best_practices": [
                "Always includes a viral Title and 3-6 targeted #Hashtags",
                "Zero outbound link in caption body (avoids Facebook 50% reach penalty)",
                "Thumbnails generated exclusively via AI Image Model (never Python PIL/OpenCV)",
                "Generous vertical whitespace & open-ended closing CTA"
            ]
        }

    @staticmethod
    def audit_caption(caption: str, title: str = "") -> Dict[str, Any]:
        """Audits an existing caption for Title, Hashtags, and Facebook algorithmic optimization."""
        lines = [l.strip() for l in (caption or "").split("\n") if l.strip()]
        words = (caption or "").split()
        hashtags = re.findall(r"#\w+", caption or "")
        links = re.findall(r"https?://\S+", caption or "")
        has_title = bool((title or "").strip()) or (len(lines) > 0 and len(lines[0]) <= 95)

        score = 100
        penalties = []
        suggestions = []

        if not has_title:
            score -= 15
            penalties.append("Missing clear Title / 1-line Hook at the top (-15 pts).")
            suggestions.append("Always include a viral Title (`title`) and 1-line opening hook.")

        if links:
            score -= 25
            penalties.append("Outbound URL found in caption body (-25 pts). Facebook algorithm penalizes external links.")
            suggestions.append("Move external URLs to the first comment.")

        if len(hashtags) > 8:
            score -= 15
            penalties.append(f"Excessive hashtags ({len(hashtags)}) found (-15 pts). Triggers spam filters.")
            suggestions.append("Keep hashtags between 3 and 6 relevant tags.")
        elif len(hashtags) == 0:
            score -= 15
            penalties.append("Zero hashtags found (-15 pts): Never forget hashtags!")
            suggestions.append("Add 3 to 6 relevant #Hashtags at the bottom.")

        if len(lines) == 1 and len(words) > 50:
            score -= 20
            penalties.append("Wall-of-text detected (-20 pts). Dense text kills mobile retention.")
            suggestions.append("Break text into 1-2 line chunks with blank lines in between.")

        has_cta = any(w in (caption or "").lower() for w in ["?", "comment", "drop", "share", "thought", "below", "👇"])
        if not has_cta:
            score -= 10
            penalties.append("No clear call-to-action or discussion prompt found (-10 pts).")
            suggestions.append("End with a question to stimulate comment engagement.")

        return {
            "seo_score": max(score, 10),
            "has_title": has_title,
            "word_count": len(words),
            "line_count": len(lines),
            "hashtag_count": len(hashtags),
            "hashtags_detected": hashtags,
            "outbound_links_count": links,
            "penalties": penalties,
            "suggestions": suggestions,
            "is_ready_for_publish": score >= 70
        }
