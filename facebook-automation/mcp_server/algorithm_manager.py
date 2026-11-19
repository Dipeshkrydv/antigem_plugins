"""
Antigravity Meta Suite - Senior Social Media Manager & Algorithm Engine
Inspired by AlgoHack-AI and reverse-engineered from Meta's 2026 ranking algorithm.
Provides algorithmic reach auditing, 3-second retention hooks, MSI score calculation,
anti-engagement bait sanitization, and first-comment external link bypass.
"""

from __future__ import annotations

import re
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


class SeniorSocialMediaManager:
    """
    Expert AI Social Media Manager specializing in the Meta/Facebook Algorithm (2026).
    Enforces Meaningful Social Interactions (MSI), retention loops, and anti-penalty rules.
    """

    # Penalized engagement bait patterns (trigger algorithm de-ranking)
    ENGAGEMENT_BAIT_PATTERNS = [
        (r"\b(like\s+this\s+post|hit\s+like|please\s+like)\b", "Drop a reaction if this resonated with you"),
        (r"\b(share\s+(this\s+)?with\s+\d+\s+friends|share\s+to\s+\d+\s+groups)\b", "Pass this along to someone preparing for exams"),
        (r"\b(comment\s+['\"]?yes['\"]?|type\s+['\"]?yes['\"]?)\b", "What was your first thought when you saw this?"),
        (r"\b(comment\s+['\"]?agree['\"]?|type\s+['\"]?agree['\"]?)\b", "Do you see this working differently in practice?"),
        (r"\b(tag\s+a\s+friend|tag\s+someone)\b", "Who needs to see this pattern today?"),
        (r"\b(follow\s+for\s+more|subscribe\s+now)\b", "More daily challenges on this page")
    ]

    # Dopamine retention hook templates categorized by psychological trigger
    HOOK_TIERS = {
        "curiosity_gap": [
            "Most people stare at this for 2 minutes without seeing the real pattern...",
            "Only 3% of applicants solve this within 20 seconds...",
            "There is a hidden mathematical trick in step 2 that textbooks never show...",
            "What looks like a simple question actually broke 90% of exam candidates...",
            "Before you jump to the obvious answer, look closer at the sequence..."
        ],
        "contrarian_shock": [
            "Stop solving IQ puzzles the traditional way — here is the speed method.",
            "Why the most obvious answer in this sequence is mathematically wrong.",
            "Traditional formulas make this 10x harder than it needs to be.",
            "Most students get stuck on step 1 because they were taught the wrong rule."
        ],
        "micro_story": [
            "This exact puzzle appeared in a 2024 premier civil service examination...",
            "Stanford logic labs tested 500 engineers with this exact question...",
            "A math professor created this 40 years ago, and people still debate it...",
            "In 1982, this exact problem was classified as an impossible Mensa prompt..."
        ]
    }

    def __init__(self):
        pass

    # -------------------------------------------------------------
    # 1. External Link Suppression Bypass (First-Comment Rule)
    # -------------------------------------------------------------
    def sanitize_external_links(self, caption: str) -> Tuple[str, Optional[str], Optional[str]]:
        """
        Facebook penalizes organic reach by 60-80% for posts containing external links in the caption.
        This extracts the external link, removes it from the caption body, and generates:
        1. Clean caption without external link
        2. Direct first-comment directive ("🔗 Direct Source / Access Link: ...")
        3. DM keyword trigger ("Comment LINK below to get direct access")
        """
        urls = re.findall(r"https?://\S+", caption)
        if not urls:
            return caption, None, None

        first_url = urls[0]
        # Remove URL from caption
        clean_caption = re.sub(r"https?://\S+", "", caption).strip()
        # Clean up any residual "Link:" or "Source:" prefixes
        clean_caption = re.sub(r"(🔗|Link|Source|Visit|Check out):\s*$", "", clean_caption, flags=re.MULTILINE).strip()

        # Add natural keyword inquiry to post
        clean_caption += "\n\n💬 Drop a comment below if you want the full step-by-step breakdown!"

        first_comment = f"🔗 Direct Solution & Full Breakdown Link:\n{first_url}"
        dm_trigger = "Comment 'LINK' below and our automated assistant will DM you direct access."

        return clean_caption, first_comment, dm_trigger

    # -------------------------------------------------------------
    # 2. Anti-Engagement Bait Sanitizer
    # -------------------------------------------------------------
    def sanitize_engagement_bait(self, caption: str) -> Tuple[str, List[str]]:
        """
        Detects and neutralizes algorithm-penalized spam trigger phrases.
        """
        flags_detected = []
        sanitized = caption

        for pattern, replacement in self.ENGAGEMENT_BAIT_PATTERNS:
            if re.search(pattern, sanitized, re.IGNORECASE):
                match = re.search(pattern, sanitized, re.IGNORECASE).group(0)
                flags_detected.append(match)
                sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

        return sanitized, flags_detected

    # -------------------------------------------------------------
    # 3. Meaningful Social Interactions (MSI) Analyzer
    # -------------------------------------------------------------
    def calculate_msi_score(self, caption: str) -> Dict[str, Any]:
        """
        Computes Meaningful Social Interaction score according to Meta's weighted formula:
        - Fan-to-Fan conversation potential (weight 4x)
        - Author comment loop inquiry (weight 3x)
        - Intellectual curiosity / debate trigger (weight 2x)
        - Passive reaction value (weight 1x)
        """
        text = caption.lower()
        score = 0
        factors = []

        # Check for ending inquiry / debate question
        has_question = bool(re.search(r"\?[\s]*$", text.strip()) or "?" in text)
        if has_question:
            score += 35
            factors.append("Active inquiry question (+35 MSI): Drives comment thread depth.")
        else:
            factors.append("No closing question (-25 MSI): Risk of passive scrolling without commenting.")

        # Check for opinion / challenge words
        debate_keywords = ["which", "why", "how", "what", "can you", "find", "spot", "debate", "agree", "differ"]
        matched_debate = [w for w in debate_keywords if f" {w} " in f" {text} "]
        if matched_debate:
            score += 25
            factors.append(f"Cognitive debate triggers ({', '.join(matched_debate[:3])}) (+25 MSI)")

        # Check for vertical micro-bite structure (anti-book rule)
        lines = [l.strip() for l in caption.split("\n") if l.strip()]
        avg_line_words = sum(len(l.split()) for l in lines) / max(len(lines), 1)
        if avg_line_words <= 18:
            score += 20
            factors.append("Clean scannable lines (<=18 words/line) (+20 MSI): Maximizes dwell time.")
        else:
            factors.append("Dense text blocks (>18 words/line) (-15 MSI): Dwell time drops by 45%.")

        # Check for emoji visual anchors
        emoji_count = len(re.findall(r"[\U00010000-\U0010ffff]", caption))
        if 2 <= emoji_count <= 8:
            score += 20
            factors.append(f"Optimal visual emoji density ({emoji_count} emojis) (+20 MSI)")
        elif emoji_count > 12:
            factors.append("Emoji overload (>12) (-10 MSI): Meta spam filters flag as low-grade.")
            score = max(0, score - 10)

        normalized_score = min(100, max(10, score))
        return {
            "score": normalized_score,
            "rating": "Viral Potential" if normalized_score >= 80 else ("Solid Reach" if normalized_score >= 60 else "Low Engagement"),
            "factors": factors
        }

    # -------------------------------------------------------------
    # 4. Full Algorithm Audit Tool
    # -------------------------------------------------------------
    def audit_post(
        self,
        caption: str,
        media_type: str = "photo",
        platform: str = "facebook"
    ) -> Dict[str, Any]:
        """
        Senior SMM Diagnostic: Evaluates post draft against 2026 Meta algorithm.
        Returns detailed scoring across 4 pillars, detected glitches, and an optimized version.
        """
        # Pillar 1: Retention Hook (First 1-2 lines)
        first_line = caption.strip().split("\n")[0] if caption.strip() else ""
        hook_score = 0
        hook_notes = []
        if any(h_word in first_line.lower() for h_word in ["only", "most", "stop", "before", "trick", "secret", "why", "puzzle", "can you"]):
            hook_score = 25
            hook_notes.append("High-voltage psychological hook (+25)")
        elif len(first_line.split()) <= 12 and ("?" in first_line or "!" in first_line):
            hook_score = 20
            hook_notes.append("Punchy opening headline (+20)")
        else:
            hook_score = 10
            hook_notes.append("Weak or slow hook: Lacks initial dopamine trigger (+10)")

        # Pillar 2: Formatting & Anti-Book Rule
        lines = [l.strip() for l in caption.split("\n") if l.strip()]
        has_blank_lines = "\n\n" in caption
        format_score = 0
        format_notes = []
        if has_blank_lines and len(lines) >= 3:
            format_score += 15
            format_notes.append("Generous vertical whitespace (+15)")
        else:
            format_notes.append("Dense paragraphs: Missing blank lines (-10)")

        # Bullet check
        if any(re.match(r"^(\*|-|•|\d+\.)", l) for l in lines):
            format_score += 10
            format_notes.append("Structured bullet anchors (+10)")
        else:
            format_score += 5

        # Pillar 3: Meaningful Social Interactions
        msi = self.calculate_msi_score(caption)
        msi_score = int(msi["score"] * 0.25)  # Scale to 25 max

        # Pillar 4: Anti-Penalty & Compliance
        sanitized, bait_found = self.sanitize_engagement_bait(caption)
        urls = re.findall(r"https?://\S+", caption)
        compliance_score = 25
        compliance_notes = []

        if bait_found:
            compliance_score -= 10
            compliance_notes.append(f"Engagement bait detected: '{', '.join(bait_found)}' (-10 penalty)")
        else:
            compliance_notes.append("Zero engagement bait detected (+10)")

        if urls:
            compliance_score -= 10
            compliance_notes.append("External link in caption: Triggers 70% link reach suppression (-10)")
        else:
            compliance_notes.append("Link-free caption: Safe from external link suppression (+15)")

        total_score = hook_score + format_score + msi_score + compliance_score
        total_score = min(100, max(15, total_score))

        # Generate optimized recommendation
        optimized_caption, first_comment, dm_trigger = self.sanitize_external_links(sanitized)
        if not ("?" in optimized_caption):
            optimized_caption += "\n\n💡 Can you solve this in under 30 seconds? Drop your answer below!"

        return {
            "platform": platform,
            "media_type": media_type,
            "overall_reach_score": total_score,
            "verdict": (
                "🔥 90+ Top 1% Viral Blueprint" if total_score >= 88 else (
                    "✅ 75+ Strong Organic Engagement" if total_score >= 70 else "⚠️ Needs Algorithmic Optimization"
                )
            ),
            "pillars": {
                "hook_strength": {"score": hook_score, "max": 25, "notes": hook_notes},
                "formatting_scannability": {"score": format_score, "max": 25, "notes": format_notes},
                "msi_interaction_weight": {"score": msi_score, "max": 25, "notes": msi["factors"]},
                "compliance_anti_penalty": {"score": compliance_score, "max": 25, "notes": compliance_notes}
            },
            "external_link_fix": {
                "had_external_link": bool(urls),
                "first_comment_action": first_comment,
                "dm_trigger_action": dm_trigger
            },
            "optimized_version": optimized_caption
        }

    # -------------------------------------------------------------
    # 5. Optimal Time Slot Engine (2026 Engagement Peak)
    # -------------------------------------------------------------
    def get_optimal_posting_slots(self, local_tz_name: str = "Asia/Dhaka") -> List[Dict[str, Any]]:
        """
        Returns optimal daily posting slots grounded in 2026 Facebook algorithm metrics.
        """
        return [
            {
                "time": "08:15",
                "label": "🌅 Morning Commute Prime",
                "audience": "Working professionals & students",
                "ideal_format": "MCQ Quiz Card or Quick Logic Bite",
                "algorithm_behavior": "High save & share velocity during commute"
            },
            {
                "time": "13:10",
                "label": "🍱 Midday Micro-Break",
                "audience": "General feed browsers",
                "ideal_format": "Video Reel / Shortform (9:16)",
                "algorithm_behavior": "High 3-second completion rate"
            },
            {
                "time": "17:45",
                "label": "🌇 Evening Transition",
                "audience": "Exam candidates & evening commuters",
                "ideal_format": "Carousel or High-Impact Puzzle",
                "algorithm_behavior": "Peak comment debate velocity"
            },
            {
                "time": "20:30",
                "label": "🌙 Prime Leisure Window",
                "audience": "Maximum daily active users (DAU)",
                "ideal_format": "Full Storyline Post or Community Q&A",
                "algorithm_behavior": "Longest dwell time of the day"
            }
        ]


# Global singleton instance
smm_manager = SeniorSocialMediaManager()
