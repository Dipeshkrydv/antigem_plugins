"""
Antigravity Social Autopilot - YouTube Studio Controller
Executes 100% human-emulated video and Shorts uploads via GhostHuman DOM automation.
Protected by policy guardian caps (max 4/day, 60m spacing, unique SHA-256 mutation).
"""

import os
import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from mcp_server.database import Database, db
from mcp_server.policy_guardian import MetaPolicyGuardian, guardian, MetaPolicyViolation
from mcp_server.bridge_server import BridgeServer, bridge

logger = logging.getLogger("meta_suite.youtube")


class YouTubeController:
    """Production controller for YouTube Studio automated publishing."""

    def __init__(
        self,
        database: Optional[Database] = None,
        policy_guardian: Optional[MetaPolicyGuardian] = None,
        bridge_server: Optional[BridgeServer] = None
    ):
        self.db = database or db
        self.guardian = policy_guardian or guardian
        self.bridge = bridge_server or bridge

    def _get_active_session(self) -> Dict[str, Any]:
        """Fetches active YouTube session credentials from database."""
        session = self.db.get_session("youtube")
        if not session:
            # Fallback to general session or default channel
            return {
                "platform": "youtube",
                "account_id": "youtube_creator",
                "username": "YouTube Creator",
                "status": "healthy"
            }
        return session

    def publish_or_schedule(
        self,
        title: str,
        description: str = "",
        media_path: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_short: bool = False,
        made_for_kids: bool = False,
        visibility: str = "PUBLIC",
        schedule_time_iso: Optional[str] = None,
        job_id: Optional[int] = None,
        bypass_spacing: bool = False,
        auto_seo: bool = False,
        thumbnail_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Publishes or schedules a video / Short to YouTube Studio via GhostHuman DOM automation.
        If auto_seo is True, automatically generates high-CTR title variants, description,
        Cartesian product tags (up to 500 chars), and pinned comment via VideoSEOAnalyzer.
        """
        seo_meta = None
        if auto_seo and media_path and os.path.exists(media_path):
            try:
                from mcp_server.video_seo_analyzer import seo_analyzer
                topic_hint = title if (title and title.lower() not in ("video", "upload", "autonomous upload", "untitled")) else None
                seo_meta = seo_analyzer.analyze_and_generate_all(media_path, topic_hint=topic_hint)
                yt_seo = seo_meta.get("youtube", {})
                title = yt_seo.get("primary_title", title)
                description = yt_seo.get("description", description)
                tags = yt_seo.get("tags", tags or [])
                is_short = yt_seo.get("is_short", is_short)
                logger.info("Auto-SEO applied for YouTube: Title='%s', TagsCount=%d", title, len(tags))
            except Exception as seo_err:
                logger.warning("Auto-SEO generation failed: %s (using provided title/desc)", seo_err)
        session = self._get_active_session()
        account_id = str(session.get("account_id", "youtube_creator"))

        # 1. Anti-Ban & Rate-Limit Check
        valid, msg = self.guardian.validate_publish_action("youtube", account_id, bypass_spacing=bypass_spacing)
        if not valid:
            raise MetaPolicyViolation(msg)

        # 2. Media Verification & Encoding
        if not media_path or not os.path.exists(media_path):
            raise FileNotFoundError(f"Media file not found for YouTube upload: {media_path}")

        file_size = os.path.getsize(media_path)
        if file_size == 0:
            raise ValueError(f"Media file is empty: {media_path}")

        # Compute SHA-256 for deduplication
        media_hash = self.db.compute_file_hash(media_path)

        # 3. Uniqueness Check
        if not bypass_spacing:
            valid_uniq, uniq_reason = self.guardian.validate_content_uniqueness(
                platform="youtube",
                text=title,
                media_paths=[media_path],
                exclude_job_id=job_id
            )
            if not valid_uniq:
                raise MetaPolicyViolation(f"Repeat YouTube upload blocked: {uniq_reason}")

        # 4. Prepare Media Payload for Browser Relay
        file_name = os.path.basename(media_path)
        with open(media_path, "rb") as f:
            raw_bytes = f.read()
        base64_data = base64.b64encode(raw_bytes).decode("ascii")

        thumbnail_base64 = None
        if thumbnail_path and os.path.exists(thumbnail_path):
            with open(thumbnail_path, "rb") as f_thumb:
                thumbnail_base64 = base64.b64encode(f_thumb.read()).decode("ascii")

        params = {
            "platform": "youtube",
            "title": title,
            "description": description,
            "tags": tags or [],
            "thumbnailPath": thumbnail_path,
            "thumbnailBase64": thumbnail_base64,
            "fileName": file_name,
            "base64Data": base64_data,
            "mimeType": "video/mp4",
            "madeForKids": made_for_kids,
            "visibility": visibility.upper(),
            "scheduleTimeIso": schedule_time_iso
        }

        logger.info("Dispatching autonomous YouTube upload for: %s (%d bytes)", title, file_size)

        # 5. Dispatch via BridgeServer
        try:
            result = self.bridge.dispatch_dom_action_sync(
                "AUTONOMOUS_YOUTUBE_POST",
                params=params,
                timeout=240.0
            )
        except Exception as e:
            logger.error("YouTube autonomous upload failed: %s", e)
            raise RuntimeError(f"YouTube Studio automation failed: {e}")

        # 6. Record in Database
        video_url = result.get("videoUrl") or "https://studio.youtube.com"
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            self.db.record_published_content(
                platform="youtube",
                media_id=video_url.split("/")[-1] if "/" in video_url else str(int(datetime.now(timezone.utc).timestamp())),
                content_type="short" if is_short else "video",
                caption=f"{title}\n\n{description}",
                seo_title=title,
                media_hash=media_hash,
                permalink=video_url
            )
        except Exception as db_err:
            logger.warning("Could not record published YouTube content in DB: %s", db_err)

        return {
            "status": "success",
            "platform": "youtube",
            "title": title,
            "video_url": video_url,
            "published_at": now_iso,
            "tags_count": len(tags or []),
            "is_short": is_short,
            "seo_metadata": seo_meta
        }


# Singleton instance
youtube = YouTubeController()
