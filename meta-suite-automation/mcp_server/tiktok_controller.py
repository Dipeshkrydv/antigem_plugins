"""
Antigravity Social Autopilot - TikTok Creator Center Controller
Executes 100% human-emulated video uploads via GhostHuman DOM automation.
Protected by policy guardian caps (max 5/day, 45m spacing, unique SHA-256 mutation).
"""

import os
import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from mcp_server.database import Database, db
from mcp_server.policy_guardian import MetaPolicyGuardian, guardian, MetaPolicyViolation
from mcp_server.bridge_server import BridgeServer, bridge

logger = logging.getLogger("meta_suite.tiktok")


class TikTokController:
    """Production controller for TikTok Creator Center automated publishing."""

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
        """Fetches active TikTok session credentials from database."""
        session = self.db.get_session("tiktok")
        if not session:
            # Fallback to general session
            return {
                "platform": "tiktok",
                "account_id": "tiktok_creator",
                "username": "TikTok Creator",
                "status": "healthy"
            }
        return session

    def publish_or_schedule(
        self,
        caption: str,
        media_path: Optional[str] = None,
        privacy: str = "PUBLIC",
        allow_comments: bool = True,
        allow_duet: bool = True,
        allow_stitch: bool = True,
        schedule_time_iso: Optional[str] = None,
        job_id: Optional[int] = None,
        bypass_spacing: bool = False,
        hashtags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Publishes or schedules a video to TikTok Creator Center via GhostHuman DOM automation.
        """
        session = self._get_active_session()
        account_id = str(session.get("account_id", "tiktok_creator"))

        # 1. Anti-Ban & Rate-Limit Check
        valid, msg = self.guardian.validate_publish_action("tiktok", account_id, bypass_spacing=bypass_spacing)
        if not valid:
            raise MetaPolicyViolation(msg)

        # Append hashtags if not already in caption
        if hashtags:
            for ht in hashtags:
                tag_clean = f"#{ht.lstrip('#')}"
                if tag_clean.lower() not in caption.lower():
                    caption = f"{caption} {tag_clean}".strip()

        # 2. Media Verification & Encoding
        if not media_path or not os.path.exists(media_path):
            raise FileNotFoundError(f"Media file not found for TikTok upload: {media_path}")

        file_size = os.path.getsize(media_path)
        if file_size == 0:
            raise ValueError(f"Media file is empty: {media_path}")

        # Compute SHA-256 for deduplication
        media_hash = self.db.compute_file_hash(media_path)

        # 3. Uniqueness Check
        if not bypass_spacing:
            valid_uniq, uniq_reason = self.guardian.validate_content_uniqueness(
                platform="tiktok",
                text=caption,
                media_paths=[media_path],
                exclude_job_id=job_id
            )
            if not valid_uniq:
                raise MetaPolicyViolation(f"Repeat TikTok upload blocked: {uniq_reason}")

        # 4. Prepare Media Payload for Browser Relay
        file_name = os.path.basename(media_path)
        with open(media_path, "rb") as f:
            raw_bytes = f.read()
        base64_data = base64.b64encode(raw_bytes).decode("ascii")

        params = {
            "platform": "tiktok",
            "caption": caption,
            "fileName": file_name,
            "base64Data": base64_data,
            "mimeType": "video/mp4",
            "privacy": privacy.upper(),
            "allowComments": allow_comments,
            "allowDuet": allow_duet,
            "allowStitch": allow_stitch,
            "scheduleTimeIso": schedule_time_iso
        }

        logger.info("Dispatching autonomous TikTok upload for caption: %s (%d bytes)", caption[:40], file_size)

        # 5. Dispatch via BridgeServer
        try:
            result = self.bridge.dispatch_dom_action_sync(
                "AUTONOMOUS_TIKTOK_POST",
                params=params,
                timeout=240.0
            )
        except Exception as e:
            logger.error("TikTok autonomous upload failed: %s", e)
            raise RuntimeError(f"TikTok Creator Center automation failed: {e}")

        # 6. Record in Database
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            self.db.record_published_content(
                platform="tiktok",
                media_id=str(int(datetime.now(timezone.utc).timestamp())),
                content_type="video",
                caption=caption,
                seo_title=caption[:50],
                media_hash=media_hash,
                permalink="https://www.tiktok.com"
            )
        except Exception as db_err:
            logger.warning("Could not record published TikTok content in DB: %s", db_err)

        return {
            "status": "success",
            "platform": "tiktok",
            "caption": caption,
            "published_at": now_iso
        }


# Singleton instance
tiktok = TikTokController()
