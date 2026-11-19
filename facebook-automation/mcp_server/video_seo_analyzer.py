"""
Antigravity Social Autopilot - Autonomous Video SEO & Media Content Analyzer
Synthesizes architectures from:
1. youtube-marketing-skills (3-variant title strategy, retention descriptions, 500-char tags, pinned comments, thumbnail brief)
2. seo-meta-tag-generator (OpenGraph, Twitter cards, VideoObject Schema.org JSON-LD)
3. keyword-mixer (Cartesian product combinatorial tags, deduplication, length ceilings)
4. tiktok-hashtags-api (3-tier viral hashtag hierarchy: discovery, niche, hyper-specific)
5. InstagramOSINT (3-tier hashtag ladders, engagement metrics, Anti-Book copywriting)
6. Meta Business Suite Page (Motivational Docqueen - ID: 1409644015561854 authority format)
"""

import os
import re
import json
import itertools
import subprocess
import logging
from html import escape
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("meta_suite.video_seo_analyzer")


class NicheIntelligence:
    """
    Classifies topics into industry niches and provides high-converting vocabulary,
    pain points, emotional hooks, and tailored visual recommendations.
    """

    NICHES = {
        "tech_coding": {
            "keywords": [
                "php", "python", "javascript", "react", "code", "coding", "programming",
                "developer", "api", "sql", "cyber", "security", "vulnerabilities", "vulnerability",
                "hack", "hacker", "linux", "docker", "git", "ai", "algorithm", "backend",
                "frontend", "database", "devops", "cloud", "bug", "exploit"
            ],
            "power_words": ["Critical", "Exploited", "Flaw", "Architectural", "Secure", "Vulnerability", "Zero-Day", "Patch", "Unbreakable", "Cracked"],
            "pain_points": [
                "Legacy security flaws that modern AI exploits in seconds",
                "Hidden memory leaks and unescaped input vulnerabilities",
                "Writing hundreds of lines of boilerplate that breaks in production",
                "Outdated architecture leaving backend services exposed"
            ],
            "thumbnail_concept": "Dark IDE terminal with glowing red alert banner, high-contrast code snippet, and bold neon warning badge.",
            "thumbnail_text": "CRITICAL FLAW",
            "thumbnail_colors": "Deep Charcoal (#0D1117) + Electric Canary Yellow (#FFEA00) + Crimson (#FF1E27)",
            "sound_vibe": "Cyberpunk synthwave or low-frequency digital pulse",
            "default_brand": "Renuka Yadav"
        },
        "motivation_mindset": {
            "keywords": [
                "habit", "habits", "focus", "discipline", "motivation", "dopamine",
                "procrastination", "mindset", "routine", "success", "consistency",
                "growth", "productivity", "deep work", "mental", "brain", "goal", "goals",
                "reflection", "confidence", "psychology", "self improvement"
            ],
            "power_words": ["Relentless", "Non-Negotiable", "Compounding", "Anchor", "Frictionless", "Mastery", "Unstoppable", "Rewire", "Clarity"],
            "pain_points": [
                "Relying on temporary willpower that vanishes after 48 hours",
                "Dopamine overload from endless scrolling and fragmented attention",
                "Overcomplicating the system instead of executing the simplest 2-minute anchor",
                "The quiet exhaustion of starting over every Monday"
            ],
            "thumbnail_concept": "High-contrast split visual: Tired & Distracted vs. Relentlessly Focused in a clean minimal workspace with warm ambient lighting.",
            "thumbnail_text": "STOP WAITING",
            "thumbnail_colors": "Deep Obsidian (#121212) + Pure Sunlight Gold (#FFD700) + Clean White (#FFFFFF)",
            "sound_vibe": "Ambient cinematic piano build-up or atmospheric lo-fi pulse",
            "default_brand": "Motivational Docqueen"
        },
        "finance_business": {
            "keywords": [
                "money", "finance", "invest", "investing", "crypto", "wealth", "stock",
                "business", "solopreneur", "sales", "startup", "passive income", "leverage",
                "marketing", "income", "cashflow", "rich", "revenue", "e-commerce"
            ],
            "power_words": ["Automated", "High-Leverage", "Compounding", "Asymmetric", "Uncapped", "Scalable", "Profitable", "Secret", "Tax-Free"],
            "pain_points": [
                "Trading hours for linear dollars with zero scalable leverage",
                "Holding cash while inflation quietly erodes real purchasing power",
                "Falling into lifestyle creep instead of automated capital compounding",
                "Spending months building products without testing conversion velocity"
            ],
            "thumbnail_concept": "Dramatic financial chart with vertical green breakout curve, minimalist luxury aesthetic, and clear stat callout.",
            "thumbnail_text": "THE TRAP",
            "thumbnail_colors": "Matte Black (#101010) + Emerald Green (#00E676) + Crisp Gold (#FFC107)",
            "sound_vibe": "Sophisticated tech-house or crisp modern beat",
            "default_brand": "Renuka Yadav"
        },
        "fitness_health": {
            "keywords": [
                "fitness", "gym", "workout", "muscle", "fat loss", "diet", "health",
                "sleep", "running", "exercise", "weight", "nutrition", "training", "body"
            ],
            "power_words": ["Targeted", "Metabolic", "Anabolic", "Effortless", "Lean", "Sculpted", "Optimal", "Rebuilt", "Biohack"],
            "pain_points": [
                "Hours of exhausting cardio that stalls fat loss and destroys muscle",
                "Extreme restrictive diets that guarantee a rebound binge",
                "Ignoring sleep and hormonal recovery while wondering why progress stopped",
                "Poor form causing chronic joint inflammation instead of growth"
            ],
            "thumbnail_concept": "High-energy athletic silhouette with glowing biomechanical posture lines and red target fix indicator.",
            "thumbnail_text": "FIX THIS",
            "thumbnail_colors": "Charcoal Black (#1A1A1A) + High-Voltage Orange (#FF6D00) + Ice Blue (#00E5FF)",
            "sound_vibe": "High-octane gym motivation phonk or rhythmic bass drive",
            "default_brand": "Motivational Docqueen"
        },
        "creator_ai": {
            "keywords": [
                "creator", "youtube", "instagram", "tiktok", "social media", "followers",
                "content", "algorithm", "reels", "shorts", "viral", "views", "edit", "editing",
                "gemini", "antigravity", "extension", "prompt", "chatgpt"
            ],
            "power_words": ["Viral", "Retention", "Algorithm-Proof", "Hyper-Speed", "Automated", "10x", "Breakthrough", "Untouchable", "Cheat Sheet"],
            "pain_points": [
                "Getting trapped in the 200-view algorithm jail with generic content",
                "Spending 6 hours editing a video that dies within 12 hours of upload",
                "Missing the crucial 3-second visual pattern interrupt",
                "Overthinking the script while competitors publish 10x faster with AI"
            ],
            "thumbnail_concept": "Creator desk setup with floating analytics graph showing a 1,000,000 view spike and highlighted magic toggle.",
            "thumbnail_text": "10x FASTER",
            "thumbnail_colors": "Deep Violet (#180033) + Cyber Magenta (#FF007F) + Neon Cyan (#00F0FF)",
            "sound_vibe": "Futuristic fast-tempo hyper-pop or subtle electronic drift",
            "default_brand": "Renuka Yadav"
        }
    }

    @classmethod
    def detect_niche(cls, topic: str) -> Tuple[str, Dict[str, Any]]:
        """Analyzes topic text and returns the closest matched niche configuration."""
        topic_lower = topic.lower()
        best_niche = "motivation_mindset"
        max_matches = 0

        for niche_name, conf in cls.NICHES.items():
            matches = sum(1 for kw in conf["keywords"] if re.search(r"\b" + re.escape(kw) + r"\b", topic_lower))
            if matches > max_matches:
                max_matches = matches
                best_niche = niche_name

        return best_niche, cls.NICHES[best_niche]


class VideoInspector:
    """Inspects video files via ffprobe/ffmpeg to extract duration, dimensions, ratio, and codec details."""

    @staticmethod
    def inspect(media_path: str) -> Dict[str, Any]:
        """Runs ffprobe on the target media file and returns structured metadata."""
        if not os.path.exists(media_path):
            raise FileNotFoundError(f"Media file does not exist: {media_path}")

        file_size_bytes = os.path.getsize(media_path)
        file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
        filename = os.path.basename(media_path)
        base_name, _ = os.path.splitext(filename)

        clean_topic = re.sub(r"[_\-]+", " ", base_name).strip()
        clean_topic = re.sub(r"\b(test|sample|video|clip|short|reel|final|v\d+)\b", "", clean_topic, flags=re.IGNORECASE).strip()
        inferred_topic = clean_topic.title() if clean_topic else "Focus & Daily Motivation"

        info: Dict[str, Any] = {
            "media_path": os.path.abspath(media_path),
            "filename": filename,
            "inferred_topic": inferred_topic,
            "file_size_bytes": file_size_bytes,
            "file_size_mb": file_size_mb,
            "duration": 60.0,
            "duration_formatted": "01:00",
            "duration_iso": "PT60S",
            "width": 1080,
            "height": 1920,
            "aspect_ratio": "9:16",
            "is_vertical": True,
            "is_short": True,
            "has_audio": True,
            "video_codec": "h264",
            "audio_codec": "aac",
            "fps": 30.0
        }

        try:
            cmd = [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                media_path
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
            if result.returncode == 0 and result.stdout.strip():
                data = json.loads(result.stdout)
                streams = data.get("streams", [])
                fmt = data.get("format", {})

                duration = 0.0
                if "duration" in fmt:
                    try:
                        duration = float(fmt["duration"])
                    except (ValueError, TypeError):
                        pass

                has_audio = False
                video_stream = None
                for s in streams:
                    stype = s.get("codec_type")
                    if stype == "video" and not video_stream:
                        video_stream = s
                    elif stype == "audio":
                        has_audio = True
                        info["audio_codec"] = s.get("codec_name", "aac")

                if video_stream:
                    if duration == 0.0 and "duration" in video_stream:
                        try:
                            duration = float(video_stream["duration"])
                        except (ValueError, TypeError):
                            pass

                    width = int(video_stream.get("width") or 1080)
                    height = int(video_stream.get("height") or 1920)
                    codec = video_stream.get("codec_name", "h264")

                    is_vertical = height > width
                    if abs(width / max(1, height) - 9 / 16) < 0.1:
                        aspect_ratio = "9:16"
                    elif abs(width / max(1, height) - 16 / 9) < 0.1:
                        aspect_ratio = "16:9"
                    elif abs(width / max(1, height) - 1.0) < 0.05:
                        aspect_ratio = "1:1"
                    elif abs(width / max(1, height) - 4 / 5) < 0.1:
                        aspect_ratio = "4:5"
                    else:
                        aspect_ratio = f"{width}:{height}"

                    fps = 30.0
                    r_fps = video_stream.get("r_frame_rate", "30/1")
                    if "/" in r_fps:
                        num, den = r_fps.split("/")
                        if float(den) > 0:
                            fps = round(float(num) / float(den), 2)

                    is_short = (duration <= 60.5) and (is_vertical or aspect_ratio in ("9:16", "1:1"))

                    minutes = int(duration // 60)
                    seconds = int(duration % 60)
                    duration_formatted = f"{minutes:02d}:{seconds:02d}"
                    duration_iso = f"PT{int(duration)}S"

                    info.update({
                        "duration": round(duration, 2),
                        "duration_formatted": duration_formatted,
                        "duration_iso": duration_iso,
                        "width": width,
                        "height": height,
                        "aspect_ratio": aspect_ratio,
                        "is_vertical": is_vertical,
                        "is_short": is_short,
                        "has_audio": has_audio,
                        "video_codec": codec,
                        "fps": fps
                    })
        except Exception as e:
            logger.warning("ffprobe inspection error on %s: %s (using defaults)", media_path, e)

        return info


class KeywordMixer:
    """
    Combinatorial keyword mixing engine based on Cartesian product permutations (keyword-mixer).
    Generates rich, deduplicated, search-optimized long-tail tag arrays capped at 500 characters.
    """

    @classmethod
    def cartesian_mix(
        cls,
        groups: List[List[str]],
        separator: str = " ",
        dedupe: bool = True,
        negative_words: Optional[List[str]] = None
    ) -> List[str]:
        """Performs Cartesian product across multiple keyword groups and formats results."""
        if not groups:
            return []

        clean_groups = []
        for g in groups:
            cleaned = [w.strip() for w in g if w and w.strip()]
            if cleaned:
                clean_groups.append(cleaned)

        if not clean_groups:
            return []

        combos = []
        for item in itertools.product(*clean_groups):
            phrase = separator.join(item).strip()
            phrase = re.sub(r"\s+", " ", phrase)
            combos.append(phrase)

        neg_set = set([n.lower().strip() for n in (negative_words or []) if n.strip()])
        if neg_set:
            combos = [c for c in combos if not any(neg in c.lower() for neg in neg_set)]

        if dedupe:
            seen = set()
            deduped = []
            for c in combos:
                norm = c.lower()
                if norm not in seen:
                    seen.add(norm)
                    deduped.append(c)
            return deduped

        return combos

    @classmethod
    def generate_youtube_tag_package(
        cls,
        topic: str,
        related_entities: Optional[List[str]] = None,
        brand: str = "Renuka Yadav",
        is_short: bool = False,
        max_chars: int = 500
    ) -> List[str]:
        """
        Generates 20+ optimized YouTube tags strictly adhering to YouTube algorithm & policy:
        1. Exact primary keyword first
        2. Exact secondary variations
        3. Long-tail combinations from Cartesian product
        4. Category & brand tags
        5. Hard cap at max_chars (default 500 chars)
        6. Max 7 repetitions of any single word (avoids YouTube's 8x spam flag)
        """
        topic_clean = topic.strip().lower()
        words = [w for w in re.split(r"\s+", topic_clean) if len(w) > 1]

        entities: List[str] = [topic_clean]
        if len(words) >= 2:
            for i in range(len(words) - 1):
                entities.append(f"{words[i]} {words[i+1]}")
        for w in words:
            if w not in entities and len(w) > 2:
                entities.append(w)

        entities.extend([
            f"{topic_clean} tips",
            f"{topic_clean} tutorial",
            f"{topic_clean} guide",
            f"{topic_clean} 2026"
        ])
        if related_entities:
            for e in related_entities:
                if e.strip().lower() not in entities:
                    entities.append(e.strip().lower())

        tags: List[str] = []
        primary_tag = topic_clean[:50].strip()
        tags.append(primary_tag)

        for e in entities:
            clean_e = e[:50].strip()
            if clean_e not in tags and len(clean_e) <= 50:
                tags.append(clean_e)

        prefixes = ["how to", "best", "complete", "learn", "top", "easy", "secret to"]
        modifiers = ["tutorial", "guide", "tips", "hacks", "explained", "2026", "for beginners"]

        combos: List[str] = []
        for p in prefixes:
            for e in entities[:4]:
                for m in modifiers[:4]:
                    combos.append(f"{p} {e} {m}")
                    combos.append(f"{e} {m}")
                    combos.append(f"{p} {e}")

        for kw in combos:
            clean_kw = kw[:50].strip()
            if clean_kw not in tags and len(clean_kw) <= 50:
                tags.append(clean_kw)

        if brand:
            brand_clean = brand.lower().strip()
            if brand_clean not in tags:
                tags.append(brand_clean)
            tags.append(f"{brand_clean} shorts" if is_short else f"{brand_clean} official")

        if is_short:
            tags.extend(["shorts", "youtubeshorts", "shortsvideo", "viralshorts"])
        else:
            tags.extend(["video", "tutorial", "education"])

        word_counts: Dict[str, int] = {}
        filtered_tags: List[str] = []

        for tag in tags:
            tag_words = tag.lower().split()
            would_exceed = False
            for w in tag_words:
                if len(w) > 3 and word_counts.get(w, 0) >= 7:
                    would_exceed = True
                    break

            if would_exceed:
                continue

            for w in tag_words:
                if len(w) > 3:
                    word_counts[w] = word_counts.get(w, 0) + 1

            filtered_tags.append(tag)

        final_tags: List[str] = []
        current_len = 0
        for tag in filtered_tags:
            extra = len(tag) + (1 if final_tags else 0)
            if current_len + extra <= max_chars:
                final_tags.append(tag)
                current_len += extra
            else:
                break

        return final_tags


class YouTubeSEOEngine:
    """
    YouTube metadata, viral CTR scoring, and thumbnail directorial engine.
    Implements 3-variant title strategy, keyword in first 40 chars, <70 chars total,
    retention descriptions, timestamps from 0:00, pinned comments, and thumbnail briefs.
    """

    @classmethod
    def score_title_ctr(cls, title: str, primary_keyword: str) -> Dict[str, Any]:
        """Calculates algorithmic Click-Through Rate (CTR) score (0-100)."""
        score = 50
        factors = []
        t_clean = title.strip()
        t_lower = t_clean.lower()
        pk_lower = primary_keyword.strip().lower()

        # 1. Primary keyword in first 40 characters
        pk_pos = t_lower.find(pk_lower)
        if 0 <= pk_pos <= 40:
            score += 15
            factors.append("+15: Primary keyword is in the first 40 characters (search priority)")
        elif pk_pos > 40:
            score += 5
            factors.append("+5: Primary keyword present but after 40 characters")

        # 2. Optimal mobile display length (40 - 68 characters)
        if 40 <= len(t_clean) <= 68:
            score += 15
            factors.append("+15: Optimal title length for mobile devices (40-68 chars)")
        elif len(t_clean) > 70:
            score -= 10
            factors.append("-10: Title exceeds 70 characters and will be truncated on mobile")

        # 3. Power words & curiosity triggers
        power_triggers = ["why", "stop", "never", "how to", "secret", "master", "blueprint", "routine", "trap", "hack", "fix", "2026"]
        found_triggers = [p for p in power_triggers if p in t_lower]
        if found_triggers:
            score += min(15, len(found_triggers) * 5)
            factors.append(f"+{min(15, len(found_triggers) * 5)}: High-CTR power triggers detected ({', '.join(found_triggers)})")

        # 4. Numbers / Year presence
        if re.search(r"\b(2026|\d+)\b", t_clean):
            score += 10
            factors.append("+10: Concrete numbers or 2026 freshness marker detected")

        final_score = max(20, min(100, score))
        grade = "Viral" if final_score >= 85 else ("Strong" if final_score >= 70 else "Average")

        return {
            "title": t_clean,
            "char_count": len(t_clean),
            "ctr_score": final_score,
            "grade": grade,
            "factors": factors
        }

    @classmethod
    def generate_seo_package(
        cls,
        video_info: Dict[str, Any],
        topic: str,
        target_audience: str = "general",
        channel_name: str = "Renuka Yadav",
        channel_id: str = "UC-VcJRiM87_NxDFe6rBx6YQ",
        video_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates the complete, broadcast-grade YouTube metadata & directorial package."""
        is_short = video_info.get("is_short", False)
        duration = video_info.get("duration", 60.0)
        raw_topic = topic.strip()
        clean_topic = re.sub(r"\b202\d\b", "", raw_topic).strip()
        clean_topic = re.sub(r"\s+", " ", clean_topic)
        if not clean_topic:
            clean_topic = raw_topic
        year = "2026"

        niche_key, niche_conf = NicheIntelligence.detect_niche(clean_topic)

        # ---------------------------------------------------------
        # 1. 3 Title Variants Tailored to Niche
        # ---------------------------------------------------------
        if niche_key == "tech_coding":
            if is_short:
                title_hook = f"{clean_topic} in 2026: Why It Gets Cracked #Shorts"
                title_search = f"How Hackers Exploit {clean_topic} in 60s #Shorts"
                title_question = f"Stop Writing {clean_topic} Like This: 3 Critical Flaws"
            else:
                title_hook = f"{clean_topic} in {year}: Why Most Codebases Get Cracked (Fix This)"
                title_search = f"{clean_topic} Security Masterclass: Full {year} Defense Guide"
                title_question = f"Why Hackers Love {clean_topic} (And The 3 Line Patch)"
        elif niche_key == "finance_business":
            if is_short:
                title_hook = f"{clean_topic}: The Fatal Money Trap #Shorts"
                title_search = f"How to Build Wealth With {clean_topic} in 60s #Shorts"
                title_question = f"Why {clean_topic} Fails For 99% Of People"
            else:
                title_hook = f"{clean_topic} in {year}: The High-Leverage Wealth Blueprint"
                title_search = f"How to Master {clean_topic}: Step-by-Step {year} Roadmap"
                title_question = f"3 Huge Mistakes People Make With {clean_topic}"
        else:
            if is_short:
                title_hook = f"{clean_topic}: Do This Daily | Zero Willpower #Shorts"
                title_search = f"How to Master {clean_topic} in 60s #Shorts"
                title_question = f"Still Struggling With {clean_topic}? Watch This"
            else:
                title_hook = f"Master {clean_topic} In 10 Mins: The Complete {year} Blueprint"
                title_search = f"{clean_topic} Masterclass: Step-by-Step Guide for {year}"
                title_question = f"Why Most People Fail at {clean_topic} (And The Real Fix)"

        title_options = {
            "recommended": title_hook[:70].strip(),
            "alternative_a_search": title_search[:70].strip(),
            "alternative_b_curiosity": title_question[:70].strip()
        }

        # Select primary title and score CTR
        primary_title = title_options["recommended"]
        ctr_eval = cls.score_title_ctr(primary_title, clean_topic)

        # ---------------------------------------------------------
        # 2. Thumbnail Concept & Directorial Brief
        # ---------------------------------------------------------
        thumbnail_brief = {
            "visual_concept": niche_conf["thumbnail_concept"],
            "overlay_text": niche_conf["thumbnail_text"],
            "color_palette": niche_conf["thumbnail_colors"],
            "focal_rule": "Focal element positioned in the left 60% of canvas; right 40% reserved for high-contrast bold 2-word text.",
            "aspect_ratio": "9:16" if is_short else "16:9"
        }

        # ---------------------------------------------------------
        # 3. Description Structure
        # ---------------------------------------------------------
        subscribe_url = f"https://www.youtube.com/channel/{channel_id}?sub_confirmation=1"
        tag_base = re.sub(r"[^a-zA-Z0-9]", "", clean_topic)

        if is_short:
            description_text = (
                f"Discover how to master {clean_topic} with zero fluff.\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"⚡ KEY TAKEAWAYS (60-SECOND BREAKDOWN)\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"✅ The core mechanism behind {clean_topic}\n"
                f"✅ The #1 trap most people fall into (and how to avoid it)\n"
                f"✅ 1 actionable step you can implement today\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"📌 SUBSCRIBE & RESOURCES\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"▶ Subscribe for Daily Breakthroughs: {subscribe_url}\n"
                f"▶ Official Community: https://www.facebook.com/groups/motivationaldocqueen\n\n"
                f"#Shorts #YouTubeShorts #{tag_base} #Motivation #Success"
            )
            hashtags = ["Shorts", "YouTubeShorts", tag_base, "SelfImprovement", "Success"]
            chapters = []
        else:
            opening = (
                f"Unlock the proven framework for {clean_topic}. "
                f"In this comprehensive {year} guide, we break down actionable steps you can apply immediately."
            )

            bullets = [
                f"The foundational architecture behind {clean_topic}",
                f"The 3 most dangerous traps that derail progress (and the exact solution)",
                f"A step-by-step daily execution routine engineered for high performance",
                f"How top practitioners sustain momentum without burning out",
                f"Actionable checklist to audit your progress today"
            ]
            bullets_formatted = "\n".join([f"✅ {b}" for b in bullets])

            seg_time = max(15, int(duration // 4))
            t1 = "0:00"
            t2 = f"{seg_time // 60:02d}:{seg_time % 60:02d}"
            t3 = f"{(seg_time * 2) // 60:02d}:{(seg_time * 2) % 60:02d}"
            t4 = f"{(seg_time * 3) // 60:02d}:{(seg_time * 3) % 60:02d}"

            timestamps_formatted = (
                f"{t1} — Introduction & The Core Problem\n"
                f"{t2} — The Science & Architecture of {clean_topic}\n"
                f"{t3} — 3-Step Implementation Blueprint\n"
                f"{t4} — Final Checklist & Next Steps"
            )
            chapters = [
                {"time": t1, "title": "Introduction & The Core Problem"},
                {"time": t2, "title": f"The Science & Architecture of {clean_topic}"},
                {"time": t3, "title": "3-Step Implementation Blueprint"},
                {"time": t4, "title": "Final Checklist & Next Steps"}
            ]

            hashtags = [
                tag_base,
                "PersonalGrowth",
                "Productivity",
                "SelfImprovement",
                "SuccessMindset",
                "Focus",
                "DailyHabits",
                "Motivation2026"
            ]
            tag_string = " ".join([f"#{t}" for t in hashtags])

            description_text = (
                f"{opening}\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"🔥 WHAT YOU'LL LEARN\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"{bullets_formatted}\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"⏯️ TIMESTAMPS\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"{timestamps_formatted}\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"📌 CONNECT & SUBSCRIBE\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"▶ Subscribe for Weekly Breakthroughs: {subscribe_url}\n"
                f"▶ Official Community: https://www.facebook.com/groups/motivationaldocqueen\n\n"
                f"{tag_string}"
            )

        # ---------------------------------------------------------
        # 4. Cartesian Product Tags (Capped at 500 chars)
        # ---------------------------------------------------------
        tags = KeywordMixer.generate_youtube_tag_package(
            topic=clean_topic,
            related_entities=[f"{clean_topic} tips", f"{clean_topic} routine", f"{clean_topic} guide"],
            brand=channel_name,
            is_short=is_short,
            max_chars=500
        )

        # ---------------------------------------------------------
        # 5. Pinned Comment & YouTube Community Post Companion
        # ---------------------------------------------------------
        pinned_comment = (
            f"Question for you: What's the #1 obstacle holding you back with {clean_topic}? "
            f"Drop a comment below — I read and reply to every single response! 👇"
        )[:295]

        community_post = (
            f"New video just dropped on {clean_topic}!\n\n"
            f"Quick question for the community: Where are you currently focusing your efforts?\n\n"
            f"A) Building the initial habit\n"
            f"B) Eliminating distractions\n"
            f"C) Scaling consistency\n"
            f"D) Recovering from burnout\n\n"
            f"Drop your vote below and check out the full breakdown on the channel! 🚀"
        )

        # ---------------------------------------------------------
        # 6. Schema.org VideoObject JSON-LD
        # ---------------------------------------------------------
        now_iso = datetime.now(timezone.utc).isoformat()
        v_id = video_id or "pending_upload"
        watch_url = f"https://www.youtube.com/watch?v={v_id}" if video_id else "https://studio.youtube.com"
        embed_url = f"https://www.youtube.com/embed/{v_id}" if video_id else "https://studio.youtube.com"
        thumb_url = f"https://i.ytimg.com/vi/{v_id}/maxresdefault.jpg" if video_id else f"https://img.youtube.com/vi/{v_id}/0.jpg"

        video_schema = {
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": primary_title,
            "description": description_text[:250],
            "thumbnailUrl": thumb_url,
            "uploadDate": now_iso,
            "duration": video_info.get("duration_iso", "PT60S"),
            "embedUrl": embed_url,
            "url": watch_url
        }

        og_tags = {
            "og:title": primary_title,
            "og:description": description_text[:200],
            "og:type": "video.other",
            "og:url": watch_url,
            "twitter:card": "player",
            "twitter:title": primary_title,
            "twitter:description": description_text[:200]
        }

        return {
            "platform": "youtube",
            "is_short": is_short,
            "primary_title": primary_title,
            "title_options": title_options,
            "ctr_evaluation": ctr_eval,
            "thumbnail_brief": thumbnail_brief,
            "description": description_text,
            "tags": tags,
            "tags_count": len(tags),
            "tags_char_count": len(",".join(tags)),
            "pinned_comment": pinned_comment,
            "community_post": community_post,
            "chapters": chapters,
            "hashtags": hashtags,
            "schema_json_ld": video_schema,
            "open_graph": og_tags
        }


class MetaBusinessSuiteSEOEngine:
    """
    Dedicated SEO & Engagement engine for Meta Business Suite Page:
    Target: 'Motivational Docqueen' (Asset ID: 1409644015561854)
    Formats authority posts with comment-to-DM hooks, generous vertical spacing,
    and link-in-first-comment guarantee.
    """

    PAGE_NAME = "Motivational Docqueen"
    PAGE_ID = "1409644015561854"

    @classmethod
    def generate_seo_package(cls, video_info: Dict[str, Any], topic: str) -> Dict[str, Any]:
        clean_topic = topic.strip()
        tag_base = re.sub(r"[^a-zA-Z0-9]", "", clean_topic)
        niche_key, _ = NicheIntelligence.detect_niche(clean_topic)

        hook = f"🔥 {clean_topic.title()}: The Truth High Performers Never Talk About"
        sub_hook = f"Most people wait for the 'right time'. High performers build the system."

        b1 = f"🔹 **Anchor Habit**: Pick ONE non-negotiable daily action that takes under 5 minutes."
        b2 = f"🔹 **Friction Elimination**: Remove every barrier between you and your execution."
        b3 = f"🔹 **Compounding Returns**: Small, boring daily wins beat occasional heroics every single time."

        punchline = f"Stop overthinking the mountain. Win today's 15 minutes."
        cta = f"💬 Comment 'FOCUS' below and I'll send you our complete 1-page action template.\n\n👇 Drop your thoughts: What is your #1 goal for this week?"
        comment_link_directive = f"🔗 Resource link and community discussion are in the first pinned comment below 👇"

        tags = [
            "MotivationalDocqueen",
            "DailyMotivation",
            "MindsetShift",
            "Discipline",
            "SuccessHabits",
            tag_base
        ]
        tag_string = " ".join([f"#{t}" for t in tags if t])

        full_post = (
            f"{hook}\n\n"
            f"{sub_hook}\n\n"
            f"{b1}\n\n"
            f"{b2}\n\n"
            f"{b3}\n\n"
            f"{punchline}\n\n"
            f"{cta}\n\n"
            f"{comment_link_directive}\n\n"
            f"{tag_string}"
        )

        first_comment_text = (
            f"🔗 Full Breakdown & Resources: https://www.facebook.com/groups/motivationaldocqueen\n\n"
            f"Save this post and drop any questions below — I respond to all of you!"
        )

        return {
            "platform": "meta_business_suite",
            "target_page_name": cls.PAGE_NAME,
            "target_page_id": cls.PAGE_ID,
            "hook": hook,
            "full_post_text": full_post,
            "first_comment_text": first_comment_text,
            "hashtags": tags,
            "char_count": len(full_post)
        }


class TikTokSEOEngine:
    """
    TikTok metadata and viral hashtag engine based on tiktok-hashtags-api.
    Constructs punchy 1-2 line curiosity caption + 3-tier hashtag stack (Viral, Niche, Entity).
    """

    @classmethod
    def generate_seo_package(cls, video_info: Dict[str, Any], topic: str) -> Dict[str, Any]:
        clean_topic = topic.strip()
        topic_tag = re.sub(r"[^a-zA-Z0-9]", "", clean_topic)
        niche_key, niche_conf = NicheIntelligence.detect_niche(clean_topic)

        caption_hook = (
            f"If you're trying to master {clean_topic}, stop scrolling right now.\n\n"
            f"Save this for your next session. Which part surprised you the most?"
        )

        tier1_viral = ["fyp", "foryou", "viral"]
        tier2_niche = [niche_key.replace("_", ""), "mindset", "productivity", "tips"]
        tier3_entity = [topic_tag.lower(), f"{topic_tag.lower()}2026", "routine"]

        selected_tags = [
            tier1_viral[0],
            tier1_viral[1],
            tier2_niche[0],
            tier2_niche[1],
            tier3_entity[0],
            tier3_entity[1]
        ]

        tag_string = " ".join([f"#{t}" for t in selected_tags if t])
        full_caption = f"{caption_hook}\n\n{tag_string}".strip()

        return {
            "platform": "tiktok",
            "caption": full_caption,
            "caption_hook": caption_hook,
            "sound_recommendation": niche_conf["sound_vibe"],
            "on_screen_hook_text": f"Wait till the end of {clean_topic}...",
            "hashtags": selected_tags,
            "tag_hierarchy": {
                "tier1_viral": tier1_viral[:2],
                "tier2_niche": tier2_niche[:2],
                "tier3_entity": tier3_entity[:2]
            },
            "char_count": len(full_caption)
        }


class InstagramSEOEngine:
    """
    Instagram metadata & copywriting engine based on InstagramOSINT & User Rule #5 (Anti-Book Format).
    Produces 1-2 line micro-bites with whitespace, 3-second hook, and 3-tier hashtag ladder.
    """

    @classmethod
    def generate_seo_package(cls, video_info: Dict[str, Any], topic: str) -> Dict[str, Any]:
        clean_topic = topic.strip()
        tag_base = re.sub(r"[^a-zA-Z0-9]", "", clean_topic)
        niche_key, niche_conf = NicheIntelligence.detect_niche(clean_topic)

        hook = f"Most people approach {clean_topic} completely backwards."
        b1 = f"**The Trap**: Forcing motivation when you should be building automated friction."
        b2 = f"**The Fix**: A 2-minute non-negotiable anchor habit that eliminates decision fatigue."
        b3 = f"**The Result**: Compounding momentum without relying on willpower."
        punchline = f"Consistency isn't a personality trait. It's an engineered environment."
        cta = f"📌 Save this for when you need a reset."

        # 3-Tier Hashtag Ladder (12 tags total)
        tier1_high = ["motivation", "mindset", "success"]
        tier2_mid = ["personaldevelopment", "dailyfocus", "productivitytips", "selfgrowth", "habits"]
        tier3_micro = [tag_base.lower(), f"{tag_base.lower()}tips", "mindsetreset", "disciplineovermotivation"]

        all_tags = tier1_high + tier2_mid + tier3_micro
        tag_string = " ".join([f"#{t}" for t in all_tags if t])

        full_caption = (
            f"{hook}\n\n"
            f"{b1}\n\n"
            f"{b2}\n\n"
            f"{b3}\n\n"
            f"{punchline}\n\n"
            f"{cta}\n\n"
            f"{tag_string}"
        )

        return {
            "platform": "instagram",
            "hook": hook,
            "full_caption": full_caption,
            "hashtags": all_tags,
            "sound_recommendation": niche_conf["sound_vibe"],
            "hashtag_ladder": {
                "high_competition": tier1_high,
                "mid_competition": tier2_mid,
                "micro_community": tier3_micro
            },
            "char_count": len(full_caption)
        }


class FacebookSEOEngine:
    """
    Facebook conversational storytelling & personal feed reach optimizer.
    Guarantees no reach suppression by placing outbound links into first-comment directives.
    """

    @classmethod
    def generate_seo_package(cls, video_info: Dict[str, Any], topic: str) -> Dict[str, Any]:
        clean_topic = topic.strip()
        tag_base = re.sub(r"[^a-zA-Z0-9]", "", clean_topic)

        hook = f"A quick reminder for anyone working on their {clean_topic} this week:"
        body = (
            f"You don't need an overhaul.\n\n"
            f"You need 15 minutes of uninterrupted focus on the thing that matters most.\n\n"
            f"Stop looking for the magic routine. Build the simple one you can repeat 100 days in a row."
        )
        footer = f"🔗 The complete breakdown guide is linked in the first pinned comment below 👇"
        tags = ["Mindset", "DailyFocus", "Consistency", tag_base]
        tag_string = " ".join([f"#{t}" for t in tags if t])

        full_text = f"{hook}\n\n{body}\n\n{footer}\n\n{tag_string}"

        return {
            "platform": "facebook",
            "full_post_text": full_text,
            "hashtags": tags,
            "char_count": len(full_text)
        }


class VideoSEOAnalyzer:
    """
    Master Orchestrator: Combines Video Inspection + Platform-Specific Creative SEO Engines.
    Provides a single entry point for analyzing video files and producing broadcast SEO packages
    across YouTube, TikTok, Instagram, Facebook Profile, and Meta Business Suite Page.
    """

    def __init__(self):
        self.inspector = VideoInspector()
        self.keyword_mixer = KeywordMixer()
        self.youtube_engine = YouTubeSEOEngine()
        self.business_suite_engine = MetaBusinessSuiteSEOEngine()
        self.tiktok_engine = TikTokSEOEngine()
        self.instagram_engine = InstagramSEOEngine()
        self.facebook_engine = FacebookSEOEngine()

    def analyze_and_generate_all(
        self,
        media_path: str,
        topic_hint: Optional[str] = None,
        target_audience: str = "general",
        channel_name: str = "Renuka Yadav"
    ) -> Dict[str, Any]:
        """Ingests a video file, inspects duration & specs, and produces SEO metadata for all platforms."""
        video_info = self.inspector.inspect(media_path)
        topic = (topic_hint or video_info.get("inferred_topic") or "Focus & Consistency").strip()

        yt_seo = self.youtube_engine.generate_seo_package(
            video_info=video_info,
            topic=topic,
            target_audience=target_audience,
            channel_name=channel_name
        )

        bs_seo = self.business_suite_engine.generate_seo_package(
            video_info=video_info,
            topic=topic
        )

        tt_seo = self.tiktok_engine.generate_seo_package(
            video_info=video_info,
            topic=topic
        )

        ig_seo = self.instagram_engine.generate_seo_package(
            video_info=video_info,
            topic=topic
        )

        fb_seo = self.facebook_engine.generate_seo_package(
            video_info=video_info,
            topic=topic
        )

        niche_key, _ = NicheIntelligence.detect_niche(topic)

        return {
            "video_info": video_info,
            "topic": topic,
            "detected_niche": niche_key,
            "youtube": yt_seo,
            "meta_business_suite": bs_seo,
            "tiktok": tt_seo,
            "instagram": ig_seo,
            "facebook": fb_seo,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# Singleton instance
seo_analyzer = VideoSEOAnalyzer()
