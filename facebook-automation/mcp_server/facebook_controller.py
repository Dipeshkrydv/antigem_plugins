"""
Facebook Controller Module
Coordinates Publishing, Scheduling, Post Re-Editing, Post Deleting,
Deduplication, and Rate Limits.
"""

import time
import uuid
import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
from .database import FacebookDatabase
from .policy_guardian import PolicyGuardian
from .bridge_server import FacebookBridgeServer

logger = logging.getLogger("FacebookController")

class FacebookController:
    def __init__(self, db: FacebookDatabase, guardian: PolicyGuardian, bridge: FacebookBridgeServer):
        self.db = db
        self.guardian = guardian
        self.bridge = bridge

    async def get_login_status(self) -> Dict[str, Any]:
        """Detects current active Facebook profile/page/group session from browser."""
        if not self.bridge.is_connected():
            return {
                "logged_in": False,
                "bridge_connected": False,
                "error": "Browser extension not connected to WebSocket bridge (ws://127.0.0.1:8766)."
            }

        res = await self.bridge.send_command("CHECK_SESSION", {}, timeout=15.0)
        if res.get("success"):
            data = res.get("data", {})
            return {
                "logged_in": data.get("logged_in", False),
                "bridge_connected": True,
                "account_name": data.get("name", "Unknown"),
                "account_id": data.get("id", "Unknown"),
                "account_type": data.get("type", "profile"),
                "active_tab_url": data.get("url", ""),
                "pages": data.get("pages", [])
            }
        return {
            "logged_in": False,
            "bridge_connected": True,
            "error": res.get("error", "Failed to query Facebook session.")
        }

    async def publish_post(
        self,
        caption: str,
        media_paths: Optional[List[str]] = None,
        post_type: str = "text",
        target_type: str = "profile",
        target_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Publishes a post (text, photo, video, or reel) with:
        1. Strict Anti-Duplicate Check (SHA-256 + Caption Hash)
        2. In-Flight Concurrency Lock
        3. Policy Guardian Rate Pacing
        4. Verified DOM Upload & Publish Confirmation
        """
        media_paths = media_paths or []
        for p in media_paths:
            if not Path(p).exists():
                return {"success": False, "error": f"Media file not found: {p}"}

        # 1. Anti-Duplicate Check
        is_dup, dup_reason = self.db.check_duplicate(media_paths=media_paths, caption=caption)
        if is_dup:
            logger.warning("Duplicate post blocked: %s", dup_reason)
            return {"success": False, "error": dup_reason, "duplicate_detected": True}

        # 2. Policy Guardian Check
        can_pub, pol_reason = self.guardian.can_publish()
        if not can_pub:
            return {"success": False, "error": pol_reason}

        # 3. In-Flight Lock
        lock_key = f"post_lock_{int(time.time() / 60)}"
        if not self.db.acquire_lock(lock_key):
            return {"success": False, "error": "Another post upload is currently in flight. Please wait."}

        client_id = f"fb_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        post_id = self.db.record_post(
            client_id=client_id,
            post_type=post_type,
            caption=caption,
            media_paths=media_paths,
            target_type=target_type,
            target_id=target_id,
            status="publishing"
        )

        try:
            # 4. Dispatch via Bridge
            payload = {
                "client_id": client_id,
                "caption": caption,
                "media_paths": media_paths,
                "post_type": post_type,
                "target_type": target_type,
                "target_id": target_id
            }

            timeout = 180.0 if post_type in ("video", "reel") else 60.0
            res = await self.bridge.send_command("PUBLISH_POST", payload, timeout=timeout)

            if res.get("success"):
                fb_id = res.get("fb_post_id")
                post_url = res.get("post_url")
                self.db.update_post_status(post_id, "published", fb_post_id=fb_id, post_url=post_url)
                self.guardian.record_action()
                self.db.log_audit("publish_post", target_type, target_id, f"Published post #{post_id} ({fb_id})")
                return {
                    "success": True,
                    "post_id": post_id,
                    "fb_post_id": fb_id,
                    "post_url": post_url,
                    "status": "published"
                }
            else:
                err = res.get("error", "Unknown browser error during publish.")
                self.db.update_post_status(post_id, "failed", error_message=err)
                self.guardian.record_error(err)
                return {"success": False, "error": err, "post_id": post_id}

        finally:
            self.db.release_lock(lock_key)

    async def edit_post(self, post_url_or_id: str, new_caption: str) -> Dict[str, Any]:
        """Edits an existing post caption via browser DOM."""
        if not self.bridge.is_connected():
            return {"success": False, "error": "Extension bridge disconnected."}

        res = await self.bridge.send_command(
            "EDIT_POST",
            {"post_target": post_url_or_id, "new_caption": new_caption},
            timeout=45.0
        )
        if res.get("success"):
            self.db.log_audit("edit_post", details=f"Edited post {post_url_or_id}")
            return {"success": True, "message": "Post updated successfully."}
        return {"success": False, "error": res.get("error", "Failed to edit post.")}

    async def delete_post(self, post_url_or_id: str) -> Dict[str, Any]:
        """Deletes or moves a post to trash via browser DOM."""
        if not self.bridge.is_connected():
            return {"success": False, "error": "Extension bridge disconnected."}

        res = await self.bridge.send_command(
            "DELETE_POST",
            {"post_target": post_url_or_id},
            timeout=45.0
        )
        if res.get("success"):
            self.db.log_audit("delete_post", details=f"Deleted post {post_url_or_id}")
            return {"success": True, "message": "Post deleted successfully."}
        return {"success": False, "error": res.get("error", "Failed to delete post.")}

    async def add_comment(self, post_url_or_id: str, comment_text: str) -> Dict[str, Any]:
        """Posts a comment (e.g. first comment with link) on target post."""
        if not self.bridge.is_connected():
            return {"success": False, "error": "Extension bridge disconnected."}

        res = await self.bridge.send_command(
            "ADD_COMMENT",
            {"post_target": post_url_or_id, "comment_text": comment_text},
            timeout=30.0
        )
        return res
