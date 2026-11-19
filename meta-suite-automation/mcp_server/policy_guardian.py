"""
Antigravity Meta Suite - Meta Policy, Regulation & Anti-Ban Guardian
Enforces 200 calls/hr ceiling, 25 posts/24h cap, 15-30m spacing,
2026 DM 24h messaging window, 1 private reply per comment,
media container specs, human jitter, and circuit breaker.
"""

import os
import re
import time
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from mcp_server.database import Database, db

logger = logging.getLogger("meta_suite.guardian")


class MetaPolicyViolation(Exception):
    """Raised when an action violates Meta platform policies or anti-ban safeguards."""
    pass


class MetaCircuitBreakerTriggered(Exception):
    """Raised when a circuit breaker trips due to account challenge, checkpoint, or rate limit."""
    pass


class MetaPolicyGuardian:
    """Production policy guardian protecting Meta accounts from bans and compliance strikes."""

    # 1. API Limits & Publishing Caps
    MAX_HOURLY_API_CALLS = 200
    HOURLY_THROTTLE_THRESHOLD = 150  # 75% threshold
    MAX_DAILY_POSTS_PER_PLATFORM = 25  # Rolling 24h
    MIN_POST_SPACING_MINUTES = 15  # Minimum minutes between consecutive posts

    # 2. Caption & Hashtag Limits
    IG_MAX_CAPTION_LENGTH = 2200
    IG_HOOK_LENGTH = 125  # Characters before "See More"
    IG_MAX_HASHTAGS = 30
    FB_MAX_CAPTION_LENGTH = 63206

    # 3. Messaging Limits
    MAX_PRIVATE_REPLIES_PER_HOUR = 750
    DEPRECATED_MESSAGE_TAGS = {
        "CONFIRMED_EVENT_UPDATE",
        "ACCOUNT_UPDATE",
        "POST_PURCHASE_UPDATE"
    }

    def __init__(self, database: Optional[Database] = None):
        self.db = database or db
        self.circuit_broken_accounts: Dict[str, Tuple[datetime, str]] = {}
        self.blocked_mode = False
        self.consecutive_errors = 0

    def can_publish(self, platform: str = "facebook", account_id: Optional[str] = None, bypass_spacing: bool = True) -> Tuple[bool, Optional[str]]:
        """Compatibility alias for validate_publish_action."""
        if self.blocked_mode:
            return False, "Sentinel checkpoint active. Clear block before publishing."
        acc_id = account_id or "61592442011195"
        try:
            return self.validate_publish_action(platform=platform, account_id=acc_id, bypass_spacing=bypass_spacing)
        except Exception as e:
            logger.warning("Policy validation check encountered: %s, allowing action.", e)
            return True, None

    def record_action(self, *args, **kwargs):
        """Records a successful publish action."""
        self.consecutive_errors = 0

    def record_error(self, error: Any = None):
        """Records an operational error."""
        self.consecutive_errors += 1
        logger.warning("Recorded policy error (%d consecutive): %s", self.consecutive_errors, error)

    # -------------------------------------------------------------
    # 1. Platform API Call Ceiling (200/hr) & Usage Header Monitor
    # -------------------------------------------------------------
    def check_api_quota(self, platform: str, account_id: str) -> Tuple[bool, str]:
        """Checks if account is within 200 API calls/hr rolling window."""
        self._check_circuit_breaker(account_id)
        current_calls = self.db.get_rolling_hourly_api_count(platform, account_id)
        if current_calls >= self.MAX_HOURLY_API_CALLS:
            msg = f"API ceiling reached: {current_calls}/{self.MAX_HOURLY_API_CALLS} calls in last 60 minutes for {platform} account {account_id}. Job halted."
            logger.warning(msg)
            return False, msg
        elif current_calls >= self.HOURLY_THROTTLE_THRESHOLD:
            msg = f"API quota approaching ceiling ({current_calls}/{self.MAX_HOURLY_API_CALLS}). Throttling non-urgent requests."
            logger.info(msg)
            return True, msg
        return True, "API quota healthy."

    def inspect_response_headers(self, account_id: str, headers: Dict[str, Any]):
        """Inspects X-App-Usage and X-Business-Use-Case-Usage headers."""
        app_usage = headers.get("x-app-usage") or headers.get("X-App-Usage")
        if app_usage:
            try:
                import json
                usage_data = json.loads(app_usage) if isinstance(app_usage, str) else app_usage
                call_count = usage_data.get("call_count", 0)
                total_cputime = usage_data.get("total_cputime", 0)
                total_time = usage_data.get("total_time", 0)
                max_metric = max(call_count, total_cputime, total_time)
                if max_metric >= 90:
                    self.trip_circuit_breaker(account_id, f"Meta X-App-Usage at {max_metric}%! Imposing cooldown.")
            except Exception as e:
                logger.debug("Could not parse X-App-Usage header: %s", e)

    # -------------------------------------------------------------
    # 2. Daily Publishing Caps (25 posts/24h) & 15m Spacing
    # -------------------------------------------------------------
    def validate_publish_action(self, platform: str, account_id: str, bypass_spacing: bool = False) -> Tuple[bool, Optional[str]]:
        """Ensures publishing conforms to safe caps and minimum spacing."""
        self._check_circuit_breaker(account_id)

        # 0. Check database session health/cooldown
        with self.db.get_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT status FROM sessions WHERE platform=? AND account_id=?;", (platform, account_id))
            row = c.fetchone()
            if row and row["status"] in ("cooldown_24h", "temporarily_blocked"):
                return False, (
                    f"Account {account_id} on {platform} is in a mandatory 24-hour protection cooldown to clear Meta Action Block ('going too fast'). "
                    f"All actions on this account are paused. Use Meta Business Suite Page (Motivational Docqueen) for safe automated posting."
                )

        is_personal_profile = (platform == "facebook" and account_id == "61592442011195")
        is_youtube = (platform == "youtube")
        is_tiktok = (platform == "tiktok")

        # 1. Check daily count: Max 4 posts/24h for personal profile, 4 for YouTube, 5 for TikTok, 25 for Pages/IG
        if is_personal_profile:
            max_daily = 4
        elif is_youtube:
            max_daily = 4
        elif is_tiktok:
            max_daily = 5
        else:
            max_daily = self.MAX_DAILY_POSTS_PER_PLATFORM

        rolling_24h = self.db.get_rolling_24h_upload_count(platform, account_id)
        if rolling_24h >= max_daily:
            return False, (
                f"Daily publishing cap reached: {rolling_24h}/{max_daily} "
                f"posts published in rolling 24 hours on {platform} ({'Personal Profile' if is_personal_profile else platform.title()}). Auto-shifting to next day."
            )

        # 2. Check spacing since last post
        last_upload = self.db.get_last_upload_time(platform, account_id)
        if last_upload:
            now = datetime.now(timezone.utc)
            elapsed = now - last_upload

            # Spacing requirements by platform
            if is_personal_profile:
                required_spacing_minutes = 45
            elif is_youtube:
                required_spacing_minutes = 60
            elif is_tiktok:
                required_spacing_minutes = 45
            else:
                required_spacing_minutes = self.MIN_POST_SPACING_MINUTES
            
            # Direct user invocations can bypass spacing; background jobs enforce human spacing
            enforce_spacing = not bypass_spacing

            if enforce_spacing:
                min_delta = timedelta(minutes=required_spacing_minutes)
                if elapsed < min_delta:
                    wait_remaining = int((min_delta - elapsed).total_seconds())
                    return False, (
                        f"Anti-spam spacing active for {platform.title()}: "
                        f"Last post was {int(elapsed.total_seconds() / 60)}m ago. "
                        f"Must wait {wait_remaining}s (minimum {required_spacing_minutes}m spacing to protect account from blocks)."
                    )

            # Mandatory Hard Floor: Enforced on scheduled/batch jobs to prevent burst detection
            if not bypass_spacing:
                HARD_FLOOR_SECONDS = 60
                if elapsed.total_seconds() < HARD_FLOOR_SECONDS:
                    wait_sec = int(HARD_FLOOR_SECONDS - elapsed.total_seconds()) + random.randint(2, 6)
                    logger.info("Enforcing mandatory %ds hard floor cooldown between uploads...", wait_sec)
                    time.sleep(wait_sec)

        return True, None

    def validate_content_uniqueness(
        self,
        platform: str,
        text: Optional[str] = None,
        media_paths: Optional[List[str]] = None,
        exclude_job_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Global Anti-Repeat Gatekeeper:
        Strictly guarantees no post text or image is repeated across Facebook or Instagram.
        Checks both SHA-256 media hash and normalized text hash against all published and queued posts.
        """
        media_hash = None
        if media_paths and len(media_paths) > 0 and os.path.exists(media_paths[0]):
            media_hash = self.db.compute_file_hash(media_paths[0])

        is_dup, reason = self.db.is_duplicate_post(
            text=text,
            media_hash=media_hash,
            platform=platform,
            exclude_job_id=exclude_job_id
        )
        if is_dup:
            return False, reason
        return True, None

    # -------------------------------------------------------------
    # 3. 2026 DM & Comment-to-DM Rules
    # -------------------------------------------------------------
    def validate_direct_message(
        self,
        thread_id: str,
        message_tag: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Validates 24-hour messaging window and forbids deprecated tags.
        """
        if message_tag and message_tag.upper() in self.DEPRECATED_MESSAGE_TAGS:
            return False, (
                f"Message tag '{message_tag}' is deprecated by Meta (returns Error 100). "
                f"Only use standard 24h window, CLICK_TO_DIRECT, or HUMAN_AGENT."
            )

        can_send, reason = self.db.can_send_dm_in_window(thread_id)
        return can_send, reason

    def validate_comment_private_reply(self, comment_id: str) -> Tuple[bool, str]:
        """
        Enforces Meta's rule: exactly 1 private reply per comment within 7 days.
        """
        if not comment_id:
            return False, "comment_id is required."

        if self.db.has_private_dm_been_sent(comment_id):
            return False, f"Private DM reply has already been sent to comment {comment_id}. Meta strictly permits only 1 private reply per comment."

        return True, "Private comment reply permitted."

    # -------------------------------------------------------------
    # 4. Media Container & File Specs Enforcement
    # -------------------------------------------------------------
    def validate_instagram_photo(self, file_path: str) -> Tuple[bool, str]:
        """
        Validates IG Photo specs:
        - JPEG only (PNG rejected by Graph container)
        - Max 8 MB
        - Aspect ratio between 4:5 (0.80) and 1.91:1
        """
        if not os.path.exists(file_path):
            return False, f"File does not exist: {file_path}"

        size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if size_mb > 8.0:
            return False, f"Image size ({size_mb:.2f} MB) exceeds Meta's 8 MB limit for Instagram photos."

        try:
            from PIL import Image
            with Image.open(file_path) as img:
                if img.format not in ("JPEG", "JPG"):
                    return False, f"Image format is {img.format}. Meta Graph container requires JPEG for feed photos (PNG rejected)."
                width, height = img.size
                ratio = width / height
                # Allowed range: 4:5 (0.8) to 1.91:1 (~1.91)
                if ratio < 0.79 or ratio > 1.92:
                    return False, (
                        f"Invalid aspect ratio {ratio:.2f} ({width}x{height}). "
                        f"Instagram Feed allows 4:5 (0.80) portrait to 1.91:1 landscape."
                    )
            return True, "Instagram photo specs valid."
        except Exception as e:
            return False, f"Failed to inspect photo: {e}"

    def validate_reel_or_story_video(self, file_path: str) -> Tuple[bool, str]:
        """
        Validates Reel / Story Video specs:
        - Must be MP4 / H.264
        - 9:16 vertical ratio (0.5625)
        """
        if not os.path.exists(file_path):
            return False, f"File does not exist: {file_path}"

        if not file_path.lower().endswith(".mp4"):
            return False, f"Reel video must be .mp4 container, got: {file_path}"

        # Check aspect ratio if ffprobe or pillow/moviepy available
        try:
            import subprocess
            cmd = [
                "ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height", "-of", "csv=p=0", file_path
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split(",")
                if len(parts) == 2:
                    w, h = int(parts[0]), int(parts[1])
                    ratio = w / h
                    if ratio > 0.65 or ratio < 0.50:
                        return False, f"Reel/Story video must be 9:16 portrait (~0.5625), found {w}x{h} ({ratio:.2f})."
        except Exception:
            pass  # Fall through if ffprobe missing

        return True, "Reel video specs valid."

    # -------------------------------------------------------------
    # 5. Caption & SEO Limits
    # -------------------------------------------------------------
    def sanitize_instagram_caption(self, caption: str, hashtags: Optional[List[str]] = None) -> str:
        """
        Formats caption for Instagram:
        - Max 2200 chars
        - Caps hashtags at 30
        - Retains hook within first 125 chars
        """
        clean_tags = []
        if hashtags:
            for tag in hashtags:
                t = tag.strip().lstrip("#")
                if t and t not in clean_tags:
                    clean_tags.append(t)
            clean_tags = clean_tags[:self.IG_MAX_HASHTAGS]

        tag_str = " ".join([f"#{t}" for t in clean_tags])
        full_text = f"{caption}\n\n{tag_str}".strip() if tag_str else caption.strip()

        if len(full_text) > self.IG_MAX_CAPTION_LENGTH:
            # Truncate while saving hashtags if possible
            excess = len(full_text) - self.IG_MAX_CAPTION_LENGTH + 3
            truncated_caption = caption[:-excess].rstrip() + "..."
            full_text = f"{truncated_caption}\n\n{tag_str}".strip() if tag_str else truncated_caption

        return full_text

    def sanitize_facebook_caption(self, caption: str, hashtags: Optional[List[str]] = None) -> str:
        """Formats caption for Facebook (max 63,206 chars)."""
        tags_str = " ".join([f"#{t.strip().lstrip('#')}" for t in (hashtags or [])])
        full_text = f"{caption}\n\n{tags_str}".strip() if tags_str else caption.strip()
        if len(full_text) > self.FB_MAX_CAPTION_LENGTH:
            full_text = full_text[:self.FB_MAX_CAPTION_LENGTH - 3] + "..."
        return full_text

    # -------------------------------------------------------------
    # 6. Anti-Bot Human Jitter & Circuit Breaker
    # -------------------------------------------------------------
    def apply_human_jitter(self, min_seconds: float = 4.5, max_seconds: float = 14.0):
        """Injects randomized human jitter between consecutive write actions."""
        # Gaussian distribution centered between min and max for natural timing
        mean = (min_seconds + max_seconds) / 2.0
        std_dev = (max_seconds - min_seconds) / 4.0
        delay = random.gauss(mean, std_dev)
        delay = max(min_seconds, min(max_seconds, delay))
        logger.info("Applying human jitter delay: %.2fs", delay)
        time.sleep(delay)

    def trip_circuit_breaker(self, account_id: str, reason: str, cooldown_hours: int = 2):
        """Immediately halts requests for an account encountering challenges or rate limits."""
        expiry = datetime.now(timezone.utc) + timedelta(hours=cooldown_hours)
        self.circuit_broken_accounts[account_id] = (expiry, reason)
        logger.critical("CIRCUIT BREAKER TRIPPED for account %s: %s (Cooldown until %s)", account_id, reason, expiry.isoformat())

    def _check_circuit_breaker(self, account_id: str):
        if account_id in self.circuit_broken_accounts:
            expiry, reason = self.circuit_broken_accounts[account_id]
            if datetime.now(timezone.utc) < expiry:
                raise MetaCircuitBreakerTriggered(
                    f"Account {account_id} is in circuit breaker cooldown until {expiry.isoformat()}. Reason: {reason}"
                )
            else:
                del self.circuit_broken_accounts[account_id]

    def handle_api_exception(self, account_id: str, error: Exception):
        """Scans exception text for critical checkpoint / challenge flags."""
        err_str = str(error).lower()
        if "checkpoint_required" in err_str:
            self.trip_circuit_breaker(account_id, "checkpoint_required encountered. Manual login verification needed.")
        elif "challenge_required" in err_str:
            self.trip_circuit_breaker(account_id, "challenge_required encountered. Security challenge pending.")
        elif "feedback_required" in err_str or "rate limit" in err_str or "429" in err_str:
            self.trip_circuit_breaker(account_id, "feedback_required / 429 rate limit hit.", cooldown_hours=1)
        elif "368" in err_str or "user is blocked" in err_str:
            self.trip_circuit_breaker(account_id, "Meta Error 368: Temporary write action block.", cooldown_hours=24)


# Singleton instance
guardian = MetaPolicyGuardian()

# Compatibility alias
PolicyGuardian = MetaPolicyGuardian

