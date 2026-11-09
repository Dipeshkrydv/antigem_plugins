"""
Facebook Controller Module (v1.3.0)
Senior Social Media Manager & Precision Touch Coordinator:
- One-Time Login Verification & Auto-Opening Facebook in Browser
- Automatic Latest Photo/Video Discovery (`media_paths=["latest"]` or omitted on photo/video posts)
- Unified Photo + Deep Quote/Caption + Title + 3-6 Hashtags in ONE Single Post
- Publishing (Text, Photo, Carousel, Video, Reel, Story), Scheduling, Re-Editing, Deleting, and Comments
"""

import os
import re
import time
import uuid
import base64
import mimetypes
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
from .database import FacebookDatabase
from .policy_guardian import PolicyGuardian
from .bridge_server import FacebookBridgeServer
from .fb_seo import FacebookSEO

logger = logging.getLogger("FacebookController")


def auto_discover_latest_media(prefer_video: bool = False) -> Optional[str]:
    """Finds the most recently modified photo or video file across standard mobile & desktop folders."""
    search_dirs = [
        "/sdcard/Download/AntiGem",
        "/storage/emulated/0/Download/AntiGem",
        "/sdcard/Download",
        "/storage/emulated/0/Download",
        "/sdcard/Pictures",
        "/storage/emulated/0/Pictures",
        "/sdcard/DCIM/Camera",
        "/storage/emulated/0/DCIM/Camera",
        os.path.expanduser("~/Downloads"),
        os.path.expanduser("~/Pictures"),
        "/home/cat/Music/phone/Download/AntiGem",
        "/home/cat/Music/phone/Download",
        "/home/cat/facebook automation/assets",
    ]
    valid_exts = {".mp4", ".mov", ".m4v", ".webm"} if prefer_video else {".jpg", ".jpeg", ".png", ".webp"}
    best_path: Optional[str] = None
    best_mtime: float = -1.0

    for d in search_dirs:
        if not os.path.isdir(d):
            continue
        try:
            for entry in os.scandir(d):
                if not entry.is_file():
                    continue
                ext = os.path.splitext(entry.name)[1].lower()
                if ext not in valid_exts:
                    continue
                st = entry.stat()
                if st.st_size < 1024:
                    continue
                if st.st_mtime > best_mtime:
                    best_mtime = st.st_mtime
                    best_path = entry.path
        except Exception:
            continue
    return best_path


def resolve_media_path(raw_path: str, prefer_video: bool = False) -> str:
    """Resolves 'latest', ~/ and Android /sdcard/ paths to real filesystem paths."""
    trimmed = str(raw_path or "").strip()
    if not trimmed or re.match(r"^(latest|newest|auto|last|recent)$", trimmed, re.IGNORECASE):
        latest = auto_discover_latest_media(prefer_video=prefer_video)
        if latest:
            return latest
        return trimmed

    p = os.path.expanduser(trimmed)
    if p.startswith("/sdcard/"):
        rel = p[len("/sdcard/"):]
        for prefix in ("/storage/emulated/0/", "/home/cat/Music/phone/"):
            alt = prefix + rel
            if os.path.exists(alt):
                return alt
    if os.path.exists(p):
        return p

    # Fallback search if a bare filename was given
    if "/" not in p:
        for folder in (
            "/sdcard/Download/AntiGem",
            "/storage/emulated/0/Download/AntiGem",
            "/sdcard/Download",
            "/home/cat/Music/phone/Download/AntiGem",
            "/home/cat/Music/phone/Download",
            "/home/cat/facebook automation/assets",
        ):
            candidate = os.path.join(folder, p)
            if os.path.exists(candidate):
                return candidate

    return p


class FacebookController:
    def __init__(self, db: FacebookDatabase, guardian: PolicyGuardian, bridge: FacebookBridgeServer):
        self.db = db
        self.guardian = guardian
        self.bridge = bridge
        self.pending_task: Optional[Dict[str, Any]] = None

    async def get_login_status(self, target_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Opens Facebook in the browser (if not already open) and checks active login session.
        If not logged in, returns action_required='ONE_TIME_LOGIN_REQUIRED' and stop_loop=True.
        """
        if not self.bridge.is_connected():
            return {
                "success": False,
                "logged_in": False,
                "bridge_connected": False,
                "stop_loop": True,
                "error": (
                    "Browser extension not connected to WebSocket bridge (ws://127.0.0.1:8766). "
                    "On AntiGem Mobile, tools run natively via worker.js in the AntiGem browser."
                )
            }

        payload = {"target_url": target_url} if target_url else {}
        res = await self.bridge.send_command("CHECK_SESSION", payload, timeout=20.0)
        if res.get("success"):
            data = res.get("data", {})
            logged_in = bool(res.get("logged_in", data.get("logged_in", False)))
            if not logged_in:
                return {
                    "success": False,
                    "logged_in": False,
                    "bridge_connected": True,
                    "browser_opened": True,
                    "active_tab_url": data.get("url", "https://www.facebook.com/"),
                    "action_required": "ONE_TIME_LOGIN_REQUIRED",
                    "stop_loop": True,
                    "message": (
                        "Facebook has been opened in your browser. Please complete the ONE-TIME LOGIN "
                        "to your Facebook account in the open browser tab, then reply 'continue' "
                        "(or call fb_resume_pending)."
                    ),
                    "agent_instruction": (
                        "STOP IMMEDIATELY. Do NOT call fb_login_status or fb_publish in a loop. "
                        "Ask the user once to sign in to Facebook in the open browser tab and wait."
                    )
                }

            return {
                "success": True,
                "logged_in": True,
                "one_time_login_verified": True,
                "bridge_connected": True,
                "browser_opened": True,
                "account_name": data.get("name", "Facebook Account"),
                "account_id": data.get("id", "authenticated"),
                "account_type": data.get("type", "profile"),
                "active_tab_url": data.get("url", "https://www.facebook.com/"),
                "pages": data.get("pages", [])
            }

        return {
            "success": False,
            "logged_in": False,
            "bridge_connected": True,
            "stop_loop": True,
            "error": res.get("error", "Failed to query Facebook session.")
        }

    async def open_browser(self, view: str = "feed", target_id: Optional[str] = None) -> Dict[str, Any]:
        """Opens the requested Facebook section in the browser and verifies one-time login."""
        url = "https://www.facebook.com/"
        if view == "reels":
            url = "https://www.facebook.com/reels/create"
        elif view == "stories":
            url = "https://www.facebook.com/stories/create"
        elif view == "business_suite":
            url = "https://business.facebook.com/"
        elif view == "page" and target_id:
            url = target_id if target_id.startswith("http") else f"https://www.facebook.com/{target_id}"
        elif target_id and target_id.startswith("http"):
            url = target_id

        return await self.get_login_status(target_url=url)

    async def publish_post(
        self,
        caption: str = "",
        media_paths: Optional[List[str]] = None,
        post_type: str = "text",
        target_type: str = "profile",
        target_id: Optional[str] = None,
        first_comment: Optional[str] = None,
        title: Optional[str] = None,
        hashtags: Optional[List[str]] = None,
        thumbnail_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Senior Social Media Manager Publisher:
        0. Auto-discovers latest photo/video if post_type is photo/video/reel and media_paths is empty or ['latest']
        1. Auto-crafts Title + Deep Quote + 3-6 Hashtags (never uploads bare photo or text-only by mistake!)
        2. Pre-Flight Browser Open & One-Time Login Check (Zero Loop Guarantee)
        3. Strict Anti-Duplicate Check (SHA-256 + Caption Hash)
        4. Verified DOM Upload & Publish Confirmation
        """
        prefer_vid = post_type in ("video", "reel")
        raw_paths = list(media_paths or [])
        if not raw_paths and post_type in ("photo", "carousel", "video", "reel"):
            auto_file = auto_discover_latest_media(prefer_video=prefer_vid)
            if auto_file:
                raw_paths = [auto_file]

        resolved_paths: List[str] = []
        for p in raw_paths:
            rp = resolve_media_path(p, prefer_video=prefer_vid)
            if not rp or not Path(rp).exists():
                return {"success": False, "stop_loop": True, "error": f"Media file not found: {p}"}
            resolved_paths.append(rp)

        if resolved_paths and post_type == "text":
            ext = os.path.splitext(resolved_paths[0])[1].lower()
            post_type = "video" if ext in (".mp4", ".mov", ".m4v", ".webm") else ("carousel" if len(resolved_paths) > 1 else "photo")

        media_hint = os.path.basename(resolved_paths[0]) if resolved_paths else ""
        enriched = FacebookSEO.ensure_title_and_hashtags(
            caption=caption,
            title=title,
            hashtags=hashtags,
            media_hint=media_hint
        )
        final_title = enriched["title"]
        final_caption = enriched["caption"]
        final_hashtags = enriched["hashtags"]

        resolved_thumbnail: Optional[str] = None
        if thumbnail_path and str(thumbnail_path).strip():
            rt = resolve_media_path(thumbnail_path, prefer_video=False)
            if rt and Path(rt).exists():
                resolved_thumbnail = rt

        # 1. Anti-Duplicate Check
        is_dup, dup_reason = self.db.check_duplicate(media_paths=resolved_paths, caption=final_caption)
        if is_dup:
            logger.warning("Duplicate post blocked: %s", dup_reason)
            return {"success": False, "error": dup_reason, "duplicate_detected": True, "stop_loop": True}

        # 2. One-Time Login Gatekeeper (Opens Facebook in browser if not open)
        login_state = await self.get_login_status()
        if not login_state.get("logged_in"):
            self.pending_task = {
                "action": "publish_post",
                "kwargs": {
                    "caption": final_caption,
                    "title": final_title,
                    "hashtags": final_hashtags,
                    "thumbnail_path": resolved_thumbnail,
                    "media_paths": resolved_paths,
                    "post_type": post_type,
                    "target_type": target_type,
                    "target_id": target_id,
                    "first_comment": first_comment
                },
                "saved_at": time.time()
            }
            return {
                **login_state,
                "pending_task_saved": True,
                "pending_post_type": post_type,
                "title": final_title,
                "hashtags": final_hashtags
            }

        # 3. Policy Guardian Check
        can_pub, pol_reason = self.guardian.can_publish()
        if not can_pub:
            return {"success": False, "stop_loop": True, "error": pol_reason}

        # 4. In-Flight Lock
        lock_key = f"post_lock_{int(time.time() / 60)}"
        if not self.db.acquire_lock(lock_key):
            return {
                "success": False,
                "stop_loop": True,
                "error": "Another post upload is currently in flight. Please wait."
            }

        client_id = f"fb_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        post_id = self.db.record_post(
            client_id=client_id,
            post_type=post_type,
            caption=final_caption,
            media_paths=resolved_paths,
            target_type=target_type,
            target_id=target_id,
            status="publishing"
        )

        try:
            media_files = []
            for rp in resolved_paths:
                mime, _ = mimetypes.guess_type(rp)
                with open(rp, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                media_files.append({
                    "path": rp,
                    "filename": os.path.basename(rp),
                    "mime_type": mime or "application/octet-stream",
                    "base64": b64
                })

            thumbnail_file = None
            if resolved_thumbnail:
                t_mime, _ = mimetypes.guess_type(resolved_thumbnail)
                with open(resolved_thumbnail, "rb") as tf:
                    t_b64 = base64.b64encode(tf.read()).decode("ascii")
                thumbnail_file = {
                    "path": resolved_thumbnail,
                    "filename": os.path.basename(resolved_thumbnail),
                    "mime_type": t_mime or "image/png",
                    "base64": t_b64
                }

            payload = {
                "client_id": client_id,
                "title": final_title,
                "caption": final_caption,
                "hashtags": final_hashtags,
                "thumbnail_path": resolved_thumbnail,
                "thumbnail_file": thumbnail_file,
                "media_paths": resolved_paths,
                "media_files": media_files,
                "post_type": post_type,
                "target_type": target_type,
                "target_id": target_id
            }

            timeout = 180.0 if post_type in ("video", "reel") else 75.0
            res = await self.bridge.send_command("PUBLISH_POST", payload, timeout=timeout)

            if res.get("success"):
                fb_id = res.get("fb_post_id")
                post_url = res.get("post_url")
                self.db.update_post_status(post_id, "published", fb_post_id=fb_id, post_url=post_url)
                self.guardian.record_action()
                self.db.log_audit("publish_post", target_type, target_id, f"Published post #{post_id} ({fb_id})")
                self.pending_task = None

                first_comment_res = None
                if first_comment and first_comment.strip():
                    first_comment_res = await self.add_comment("latest", first_comment.strip())

                return {
                    "success": True,
                    "post_id": post_id,
                    "fb_post_id": fb_id,
                    "post_url": post_url,
                    "post_type": post_type,
                    "title": final_title,
                    "caption": final_caption,
                    "hashtags": final_hashtags,
                    "media_attached": resolved_paths,
                    "thumbnail_path": resolved_thumbnail,
                    "first_comment_result": first_comment_res,
                    "status": "published"
                }
            else:
                if res.get("action_required") == "ONE_TIME_LOGIN_REQUIRED":
                    self.db.update_post_status(post_id, "awaiting_login", error_message="Waiting for one-time login")
                    return {
                        "success": False,
                        "logged_in": False,
                        "action_required": "ONE_TIME_LOGIN_REQUIRED",
                        "stop_loop": True,
                        "post_id": post_id,
                        "message": res.get("error", "Please complete one-time Facebook login in the open browser tab.")
                    }

                err = res.get("error", "Unknown browser error during publish.")
                self.db.update_post_status(post_id, "failed", error_message=err)
                self.guardian.record_error(err)
                return {"success": False, "stop_loop": True, "error": err, "post_id": post_id}

        finally:
            self.db.release_lock(lock_key)

    async def resume_pending(self) -> Dict[str, Any]:
        """Resumes the saved pending task after the user completes their one-time login."""
        login = await self.get_login_status()
        if not login.get("logged_in"):
            return login

        if not self.pending_task:
            return {
                "success": True,
                "logged_in": True,
                "message": "Facebook is logged in and ready. No pending task was queued."
            }

        task = self.pending_task
        self.pending_task = None
        if task.get("action") == "publish_post":
            return await self.publish_post(**task["kwargs"])
        return {"success": True, "logged_in": True}

    async def edit_post(self, post_url_or_id: str, new_caption: str) -> Dict[str, Any]:
        """Edits an existing post caption via browser DOM."""
        login = await self.get_login_status()
        if not login.get("logged_in"):
            return login

        res = await self.bridge.send_command(
            "EDIT_POST",
            {"post_target": post_url_or_id, "new_caption": new_caption},
            timeout=45.0
        )
        if res.get("success"):
            self.db.log_audit("edit_post", details=f"Edited post {post_url_or_id}")
            return {"success": True, "message": "Post updated successfully."}
        return {"success": False, "stop_loop": True, "error": res.get("error", "Failed to edit post.")}

    async def delete_post(self, post_url_or_id: str) -> Dict[str, Any]:
        """Deletes or moves a post to trash via browser DOM."""
        login = await self.get_login_status()
        if not login.get("logged_in"):
            return login

        res = await self.bridge.send_command(
            "DELETE_POST",
            {"post_target": post_url_or_id},
            timeout=45.0
        )
        if res.get("success"):
            self.db.log_audit("delete_post", details=f"Deleted post {post_url_or_id}")
            return {"success": True, "message": "Post deleted successfully."}
        return {"success": False, "stop_loop": True, "error": res.get("error", "Failed to delete post.")}

    async def add_comment(self, post_url_or_id: str, comment_text: str) -> Dict[str, Any]:
        """Posts a comment (e.g. first comment with link) on target post."""
        login = await self.get_login_status()
        if not login.get("logged_in"):
            return login

        res = await self.bridge.send_command(
            "ADD_COMMENT",
            {"post_target": post_url_or_id, "comment_text": comment_text},
            timeout=30.0
        )
        return res
