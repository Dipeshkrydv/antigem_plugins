"""
Antigravity Meta Suite - Instagram Step-by-Step Controller
Combines instagrapi synced with Chrome Extension live sessionid & User-Agent,
and Chrome Extension DOM Relay fallback.
Covers Feed, Reels, Stories, Lifecycle (delete, archive, edit), Comments & 24h DMs.
"""

import os
import time
import logging
from typing import Any, Dict, List, Optional, Tuple
from mcp_server.database import Database, db
from mcp_server.policy_guardian import MetaPolicyGuardian, guardian, MetaPolicyViolation
from mcp_server.bridge_server import BridgeServer, bridge
from mcp_server.free_media_seo import FreeMediaEngine

logger = logging.getLogger("meta_suite.instagram")


class InstagramController:
    """Full-featured controller for Instagram automation."""

    def __init__(self, database: Optional[Database] = None, policy_guardian: Optional[MetaPolicyGuardian] = None, bridge_server: Optional[BridgeServer] = None):
        self.db = database or db
        self.guardian = policy_guardian or guardian
        self.bridge = bridge_server or bridge
        self._client = None
        self._current_account_id: Optional[str] = None
        self.prefer_dom = False

    @property
    def client(self):
        if self._client is None:
            from instagrapi import Client
            self._client = Client()
        return self._client

    def _sync_client_session(self) -> str:
        """Loads live session from SQLite and injects cookies into instagrapi client."""
        session_data = self.db.get_session("instagram")
        if not session_data or not session_data.get("cookies"):
            raise ConnectionError(
                "No active Instagram session found in database. "
                "Log into instagram.com in Chrome with Antigravity Meta Bridge extension loaded."
            )

        account_id = str(session_data["account_id"])
        cookies = session_data["cookies"]
        user_agent = session_data.get("user_agent")

        # Inject User-Agent if provided
        if user_agent:
            self.client.set_user_agent(user_agent)

        session_id = cookies.get("sessionid")
        if not session_id:
            raise ConnectionError("Missing sessionid in Instagram cookies.")

        if self._current_account_id != account_id:
            # Load session cookies into instagrapi
            try:
                self.client.login_by_sessionid(session_id)
                self._current_account_id = account_id
                logger.info("Instagrapi client authenticated via synced session for account: %s", account_id)
            except Exception as e:
                self.guardian.handle_api_exception(account_id, e)
                raise ConnectionError(f"Failed to authenticate Instagram session: {e}")

        return account_id

    # -------------------------------------------------------------
    # 1. Publishing: Feed, Carousel, Reels, Stories
    # -------------------------------------------------------------
    def publish_feed_photo(
        self,
        image_path: str,
        caption: str,
        hashtags: Optional[List[str]] = None,
        alt_text: Optional[str] = None,
        user_tags: Optional[List[Dict[str, Any]]] = None,
        location_id: Optional[str] = None,
        job_id: Optional[int] = None,
        bypass_spacing: bool = False
    ) -> Dict[str, Any]:
        """Publishes a single photo post to Instagram Feed with strict container formatting."""
        account_id = self._sync_client_session()

        # Enforce daily 25-post cap and 15m spacing (unless bypassed)
        valid, msg = self.guardian.validate_publish_action("instagram", account_id, bypass_spacing=bypass_spacing)
        if not valid:
            raise MetaPolicyViolation(msg)

        # Enforce JPEG container (PNG is rejected by Meta)
        clean_image_path = self._ensure_jpeg(image_path)

        # Validate specs
        valid_specs, spec_msg = self.guardian.validate_instagram_photo(clean_image_path)
        if not valid_specs:
            logger.warning("Photo specs warning: %s. Applying auto-crop/adjustment.", spec_msg)
            clean_image_path = self._auto_conform_feed_photo(clean_image_path)

        # Global Anti-Repeat Gatekeeper: Check text and media uniqueness
        media_hash = self.db.compute_file_hash(clean_image_path)
        valid_uniq, uniq_reason = self.guardian.validate_content_uniqueness(
            platform="instagram",
            text=caption,
            media_paths=[clean_image_path],
            exclude_job_id=job_id
        )
        if not valid_uniq:
            raise MetaPolicyViolation(f"Repeat upload blocked: {uniq_reason}")

        # Sanitize caption
        final_caption = self.guardian.sanitize_instagram_caption(caption, hashtags)

        # Apply human jitter
        self.guardian.apply_human_jitter(4.5, 12.0)

        if self.prefer_dom:
            logger.info("Direct Instagram DOM relay mode active. Routing photo to Chrome Extension.")
            return self._publish_via_dom_relay(clean_image_path, final_caption, is_video=False, account_id=account_id, job_id=job_id)

        try:
            extra_data = {}
            if user_tags:
                extra_data["usertags"] = user_tags
            if alt_text:
                extra_data["accessibility_caption"] = alt_text

            media = self.client.photo_upload(
                path=clean_image_path,
                caption=final_caption,
                extra_data=extra_data
            )

            media_id = str(media.pk if hasattr(media, "pk") else media.id)
            shortcode = getattr(media, "code", None)
            permalink = f"https://www.instagram.com/p/{shortcode}/" if shortcode else None

            # Record in database & compliance log
            self.db.record_published_content(
                platform="instagram",
                media_id=media_id,
                content_type="photo",
                caption=final_caption,
                media_hash=media_hash,
                shortcode=shortcode,
                permalink=permalink
            )
            self.db.log_compliance_action("instagram", account_id, "publish_post", f"photo:{media_id}", "success")

            return {
                "status": "success",
                "media_id": media_id,
                "shortcode": shortcode,
                "permalink": permalink,
                "platform": "instagram"
            }

        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            self.db.log_compliance_action("instagram", account_id, "publish_post", "photo:error", "error")
            logger.warning("Instagrapi photo upload failed (%s). Attempting Chrome DOM bridge fallback...", e)
            self.prefer_dom = True
            try:
                return self._publish_via_dom_relay(clean_image_path, final_caption, is_video=False, account_id=account_id, job_id=job_id)
            except Exception as dom_err:
                logger.error("Instagram DOM relay fallback also failed: %s", dom_err)
            raise RuntimeError(f"Instagram photo upload failed: {e}")

    def publish_carousel(
        self,
        media_paths: List[str],
        caption: str,
        hashtags: Optional[List[str]] = None,
        bypass_spacing: bool = False
    ) -> Dict[str, Any]:
        """Publishes a carousel (album) of photos/videos."""
        account_id = self._sync_client_session()
        valid, msg = self.guardian.validate_publish_action("instagram", account_id, bypass_spacing=bypass_spacing)
        if not valid:
            raise MetaPolicyViolation(msg)

        if not media_paths or len(media_paths) < 2:
            raise ValueError("Carousel requires at least 2 media files.")

        clean_paths = [self._ensure_jpeg(p) if p.lower().endswith((".png", ".webp", ".jpg", ".jpeg")) else p for p in media_paths]
        valid_uniq, uniq_reason = self.guardian.validate_content_uniqueness(
            platform="instagram",
            text=caption,
            media_paths=clean_paths
        )
        if not valid_uniq:
            raise MetaPolicyViolation(f"Repeat upload blocked: {uniq_reason}")

        final_caption = self.guardian.sanitize_instagram_caption(caption, hashtags)
        self.guardian.apply_human_jitter(5.0, 14.0)

        try:
            media = self.client.album_upload(paths=clean_paths, caption=final_caption)
            media_id = str(media.pk if hasattr(media, "pk") else media.id)
            shortcode = getattr(media, "code", None)
            permalink = f"https://www.instagram.com/p/{shortcode}/" if shortcode else None

            self.db.record_published_content("instagram", media_id, "carousel", final_caption, shortcode=shortcode, permalink=permalink)
            self.db.log_compliance_action("instagram", account_id, "publish_post", f"carousel:{media_id}", "success")

            return {
                "status": "success",
                "media_id": media_id,
                "shortcode": shortcode,
                "permalink": permalink,
                "items_count": len(clean_paths)
            }
        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            self.db.log_compliance_action("instagram", account_id, "publish_post", "carousel:error", "error")
            raise RuntimeError(f"Instagram carousel upload failed: {e}")

    def publish_reel(
        self,
        video_path: str,
        caption: str,
        hashtags: Optional[List[str]] = None,
        cover_path: Optional[str] = None,
        share_to_feed: bool = True,
        job_id: Optional[int] = None,
        bypass_spacing: bool = False,
        schedule_time_iso: Optional[str] = None
    ) -> Dict[str, Any]:
        """Publishes an Instagram Reel with thumbnail cover and optional feed sharing."""
        account_id = self._sync_client_session()
        valid, msg = self.guardian.validate_publish_action("instagram", account_id, bypass_spacing=bypass_spacing)
        if not valid:
            raise MetaPolicyViolation(msg)

        valid_specs, spec_msg = self.guardian.validate_reel_or_story_video(video_path)
        if not valid_specs:
            raise MetaPolicyViolation(spec_msg)

        if schedule_time_iso:
            from mcp_server.scheduler_engine import scheduler
            payload = {
                "media_paths": [video_path],
                "caption": caption,
                "hashtags": hashtags or [],
                "cover_path": cover_path,
                "share_to_feed": share_to_feed,
                "auto_publish": True,
                "bypass_spacing": bypass_spacing
            }
            job = scheduler.schedule_job(
                platform="instagram",
                target_type="profile",
                target_id="43599208749",
                content_type="reel",
                payload=payload,
                schedule_time_iso=schedule_time_iso
            )
            return {
                "status": "scheduled",
                "job_id": job.get("job_id"),
                "scheduled_time_iso": schedule_time_iso,
                "platform": "instagram"
            }

        # Global Anti-Repeat Gatekeeper: Check text and video uniqueness
        media_hash = self.db.compute_file_hash(video_path)
        valid_uniq, uniq_reason = self.guardian.validate_content_uniqueness(
            platform="instagram",
            text=caption,
            media_paths=[video_path],
            exclude_job_id=job_id
        )
        if not valid_uniq:
            raise MetaPolicyViolation(f"Repeat upload blocked: {uniq_reason}")

        final_caption = self.guardian.sanitize_instagram_caption(caption, hashtags)
        self.guardian.apply_human_jitter(6.0, 15.0)

        if self.prefer_dom:
            logger.info("Direct Instagram DOM relay mode active. Routing reel to Chrome Extension.")
            return self._publish_via_dom_relay(video_path, final_caption, is_video=True, account_id=account_id, job_id=job_id)

        try:
            thumbnail = self._ensure_jpeg(cover_path) if cover_path else None
            media = self.client.clip_upload(
                path=video_path,
                caption=final_caption,
                thumbnail=thumbnail,
                extra_data={"like_and_view_counts_disabled": 0}
            )

            media_id = str(media.pk if hasattr(media, "pk") else media.id)
            shortcode = getattr(media, "code", None)
            permalink = f"https://www.instagram.com/reel/{shortcode}/" if shortcode else None

            self.db.record_published_content("instagram", media_id, "reel", final_caption, media_hash=media_hash, shortcode=shortcode, permalink=permalink)
            self.db.log_compliance_action("instagram", account_id, "publish_post", f"reel:{media_id}", "success")

            return {
                "status": "success",
                "media_id": media_id,
                "shortcode": shortcode,
                "permalink": permalink,
                "content_type": "reel"
            }
        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            self.db.log_compliance_action("instagram", account_id, "publish_post", "reel:error", "error")
            logger.warning("Instagrapi Reel upload failed (%s). Attempting Chrome DOM bridge fallback...", e)
            self.prefer_dom = True
            try:
                return self._publish_via_dom_relay(video_path, final_caption, is_video=True, account_id=account_id, job_id=job_id)
            except Exception as dom_err:
                logger.error("Instagram Reel DOM relay fallback also failed: %s", dom_err)
            raise RuntimeError(f"Instagram Reel upload failed: {e}")

    def publish_story(
        self,
        media_path: str,
        story_link_url: Optional[str] = None,
        bypass_spacing: bool = True
    ) -> Dict[str, Any]:
        """Publishes a Story (photo or 9:16 video) with optional link sticker."""
        account_id = self._sync_client_session()
        valid, msg = self.guardian.validate_publish_action("instagram", account_id, bypass_spacing=bypass_spacing)
        if not valid:
            raise MetaPolicyViolation(msg)

        is_video = media_path.lower().endswith(".mp4")
        self.guardian.apply_human_jitter(4.5, 10.0)

        try:
            if is_video:
                from pathlib import Path
                p = Path(media_path)
                upload_id, width, height, duration, thumbnail = self.client.video_rupload(p, to_story=True)
                # Allow Meta backend 10s to finish processing/transcoding video before configure
                time.sleep(10)
                configured = None
                last_err = None
                for attempt in range(6):
                    try:
                        configured = self.client.video_configure_to_story(
                            upload_id, width, height, duration, thumbnail, caption=""
                        )
                        break
                    except Exception as err:
                        last_err = err
                        time.sleep(6)
                if not configured:
                    raise last_err or RuntimeError("Failed to configure video to story.")
                media_id = str(configured.get("media", {}).get("pk") or configured.get("pk") or upload_id)
                shortcode = configured.get("media", {}).get("code")
            else:
                clean_img = self._ensure_jpeg(media_path)
                media = self.client.photo_upload_to_story(path=clean_img)
                media_id = str(media.pk if hasattr(media, "pk") else media.id)
                shortcode = getattr(media, "code", None)

            media_hash = self.db.compute_file_hash(media_path)
            self.db.record_published_content(
                platform="instagram",
                media_id=media_id,
                content_type="story",
                caption=f"Exam IQ Story: {os.path.basename(media_path)}",
                media_hash=media_hash,
                shortcode=shortcode
            )
            self.db.log_compliance_action("instagram", account_id, "publish_post", f"story:{media_id}", "success")

            return {
                "status": "success",
                "media_id": media_id,
                "content_type": "story"
            }
        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            self.db.log_compliance_action("instagram", account_id, "publish_post", "story:error", "error")
            raise RuntimeError(f"Instagram Story upload failed: {e}")

    # -------------------------------------------------------------
    # 2. Content Lifecycle: List, Delete, Archive, Pin, Edit
    # -------------------------------------------------------------
    def list_user_content(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves user's published media and caches into SQLite."""
        self._sync_client_session()
        try:
            medias = self.client.user_medias(self.client.user_id, amount=limit)
            results = []
            for m in medias:
                m_id = str(m.pk)
                shortcode = m.code
                caption = m.caption_text if hasattr(m, "caption_text") else ""
                likes = m.like_count if hasattr(m, "like_count") else 0
                comments = m.comment_count if hasattr(m, "comment_count") else 0
                media_type = "photo" if m.media_type == 1 else ("video" if m.media_type == 2 else "carousel")

                self.db.record_published_content(
                    platform="instagram",
                    media_id=m_id,
                    content_type=media_type,
                    caption=caption,
                    shortcode=shortcode,
                    permalink=f"https://www.instagram.com/p/{shortcode}/"
                )
                results.append({
                    "media_id": m_id,
                    "shortcode": shortcode,
                    "type": media_type,
                    "caption": caption[:80],
                    "likes": likes,
                    "comments": comments
                })
            return results
        except Exception as e:
            logger.warning("Failed to fetch user medias from API: %s. Returning cached DB content.", e)
            return self.db.list_published_content("instagram", limit=limit)

    def manage_post(self, action: str, media_id: str, new_caption: Optional[str] = None) -> Dict[str, Any]:
        """Lifecycle actions: 'delete', 'archive', 'unarchive', 'edit_caption', 'toggle_comments'."""
        self._sync_client_session()
        self.guardian.apply_human_jitter(3.0, 7.0)

        try:
            if action == "delete":
                try:
                    self.client.media_delete(media_id)
                except Exception as api_err:
                    logger.warning("API delete failed (%s). Triggering DOM bridge fallback.", api_err)
                    if self.bridge.is_connected():
                        asyncio.run(self.bridge.dispatch_dom_action("DELETE_POST_DOM", {"platform": "instagram", "post_id": media_id}))
                    else:
                        raise api_err
                self.db.update_content_status(media_id, "delete")
                return {"status": "success", "action": "delete", "media_id": media_id}

            elif action == "archive":
                self.client.media_archive(media_id, revert=False)
                self.db.update_content_status(media_id, "archive")
                return {"status": "success", "action": "archive", "media_id": media_id}

            elif action == "unarchive":
                self.client.media_archive(media_id, revert=True)
                self.db.update_content_status(media_id, "unarchive")
                return {"status": "success", "action": "unarchive", "media_id": media_id}

            elif action == "edit_caption" and new_caption:
                self.client.media_edit(media_id, new_caption)
                self.db.update_content_status(media_id, "edit_caption", new_caption=new_caption)
                return {"status": "success", "action": "edit_caption", "media_id": media_id}

            else:
                raise ValueError(f"Unsupported content action: {action}")
        except Exception as e:
            raise RuntimeError(f"Instagram action '{action}' failed on media {media_id}: {e}")

    # -------------------------------------------------------------
    # 3. Comments & Comment-to-DM Keyword Funnel
    # -------------------------------------------------------------
    def get_media_comments(self, media_id: str, amount: int = 50) -> List[Dict[str, Any]]:
        self._sync_client_session()
        comments = self.client.media_comments(media_id, amount=amount)
        result = []
        for c in comments:
            result.append({
                "comment_id": str(c.pk),
                "user_id": str(c.user.pk),
                "username": c.user.username,
                "text": c.text,
                "created_at_utc": c.created_at_utc.isoformat() if hasattr(c, "created_at_utc") and c.created_at_utc else None
            })
        return result

    def reply_to_comment_public(self, media_id: str, comment_id: str, reply_text: str) -> Dict[str, Any]:
        """Posts a public reply to a comment."""
        account_id = self._sync_client_session()
        self.guardian.apply_human_jitter(3.0, 8.0)
        try:
            res = self.client.media_comment(media_id, reply_text, replied_to_comment_id=comment_id)
            self.db.log_compliance_action("instagram", account_id, "comment_reply", f"comment:{comment_id}", "success")
            return {"status": "success", "comment_id": comment_id, "reply_id": str(res.pk)}
        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            raise RuntimeError(f"Failed to post public reply: {e}")

    def send_private_dm_for_comment(
        self,
        comment_id: str,
        user_id: str,
        dm_text: str,
        trigger_keyword: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enforces Meta's rule: strictly 1 private DM reply per comment within 7 days.
        Deduplicates in SQLite dm_comment_funnel table.
        """
        account_id = self._sync_client_session()

        # Enforce Meta compliance
        valid, reason = self.guardian.validate_comment_private_reply(comment_id)
        if not valid:
            raise MetaPolicyViolation(reason)

        self.guardian.apply_human_jitter(4.0, 9.0)

        try:
            # Send DM via instagrapi
            res = self.client.direct_send(dm_text, user_ids=[int(user_id)])

            # Record in funnel table to ensure deduplication
            self.db.record_comment_funnel_action(
                platform="instagram",
                comment_id=comment_id,
                post_id="unknown",
                commenter_id=user_id,
                commenter_username="",
                comment_text="",
                private_dm_sent=True,
                trigger_keyword=trigger_keyword
            )
            self.db.log_compliance_action("instagram", account_id, "send_dm", f"private_reply_comment:{comment_id}", "success")

            return {
                "status": "success",
                "comment_id": comment_id,
                "user_id": user_id,
                "private_dm_sent": True
            }
        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            raise RuntimeError(f"Private comment DM reply failed: {e}")

    # -------------------------------------------------------------
    # 4. Direct Messages (24-Hour Messaging Window)
    # -------------------------------------------------------------
    def list_dm_threads(self, limit: int = 20) -> List[Dict[str, Any]]:
        self._sync_client_session()
        threads = self.client.direct_threads(amount=limit)
        results = []
        for t in threads:
            t_id = str(t.id)
            users = [u.username for u in t.users]
            results.append({
                "thread_id": t_id,
                "users": users,
                "title": t.thread_title or ", ".join(users),
                "is_group": t.is_group
            })
        return results

    def send_direct_message(self, thread_id: str, text: str) -> Dict[str, Any]:
        """Sends a DM strictly verifying Meta's 24-hour messaging window."""
        account_id = self._sync_client_session()

        valid, reason = self.guardian.validate_direct_message(thread_id)
        if not valid:
            raise MetaPolicyViolation(reason)

        self.guardian.apply_human_jitter(4.0, 10.0)
        try:
            res = self.client.direct_send(text, thread_ids=[int(thread_id)])
            self.db.log_compliance_action("instagram", account_id, "send_dm", f"thread:{thread_id}", "success")
            return {"status": "success", "thread_id": thread_id}
        except Exception as e:
            self.guardian.handle_api_exception(account_id, e)
            raise RuntimeError(f"Failed to send Instagram direct message: {e}")

    # -------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------
    @staticmethod
    def _ensure_jpeg(path: str) -> str:
        """Converts PNG or other formats to compliant JPEG RGB."""
        from PIL import Image
        if not os.path.exists(path):
            raise FileNotFoundError(f"File not found: {path}")

        base, ext = os.path.splitext(path)
        if ext.lower() in (".jpg", ".jpeg"):
            return path

        jpeg_path = f"{base}_converted.jpg"
        with Image.open(path) as img:
            rgb_im = img.convert("RGB")
            rgb_im.save(jpeg_path, "JPEG", quality=95)
        return jpeg_path

    @staticmethod
    def _auto_conform_feed_photo(path: str) -> str:
        """Crops or pads image to conform to 4:5 Instagram feed aspect ratio (1080x1350)."""
        from PIL import Image, ImageOps
        with Image.open(path) as img:
            rgb = img.convert("RGB")
            conformed = ImageOps.fit(rgb, (1080, 1350), method=Image.Resampling.LANCZOS)
            base, _ = os.path.splitext(path)
            out = f"{base}_conformed.jpg"
            conformed.save(out, "JPEG", quality=95)
            return out

    def _publish_via_dom_relay(
        self,
        image_or_video_path: str,
        caption: str,
        is_video: bool = False,
        account_id: str = "instagram",
        job_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Dispatches autonomous Instagram post DOM action to Chrome Extension."""
        import base64
        import time

        if not self.bridge.is_connected():
            if job_id is None:
                session = self.db.get_session("instagram")
                if session:
                    logger.info("Direct WebSocket connection held by background daemon. Enqueuing Instagram job to SQLite queue...")
                    from datetime import datetime, timezone
                    now_iso = datetime.now(timezone.utc).isoformat()
                    new_job_id = self.db.create_scheduled_job(
                        platform="instagram",
                        target_type="reel" if is_video else "feed",
                        target_id=None,
                        content_type="reel" if is_video else "photo",
                        payload={
                            "media_paths": [image_or_video_path],
                            "caption": caption,
                            "bypass_spacing": True,
                            "auto_publish": True
                        },
                        schedule_time_iso=now_iso
                    )
                    return {
                        "status": "queued_for_background_bridge",
                        "job_id": new_job_id,
                        "platform": "instagram",
                        "message": "Enqueued to background bridge queue for autonomous execution in Chrome."
                    }
            raise ConnectionError(
                "Chrome Extension bridge required for Instagram DOM posting. "
                "Ensure extension is loaded in Chrome and connected at ws://127.0.0.1:8765."
            )

        base64_data = None
        ext = os.path.splitext(image_or_video_path)[1].lower()
        mime_type = "video/mp4" if is_video or ext in (".mp4", ".mov") else "image/jpeg"
        file_name = os.path.basename(image_or_video_path)

        with open(image_or_video_path, "rb") as f_media:
            base64_data = base64.b64encode(f_media.read()).decode("utf-8")

        params = {
            "platform": "instagram",
            "text": caption,
            "base64_data": base64_data,
            "mime_type": mime_type,
            "file_name": file_name,
            "is_video": is_video,
            "auto_publish": True
        }

        try:
            res = self.bridge.dispatch_dom_action_sync("AUTONOMOUS_INSTAGRAM_POST", params, timeout=75.0)
            synthetic_id = f"dom_ig_{int(time.time())}"
            self.db.record_published_content(
                platform="instagram",
                media_id=synthetic_id,
                content_type="reel" if is_video else "photo",
                caption=caption,
                permalink="https://www.instagram.com/"
            )
            return {"status": "success", "media_id": synthetic_id, "platform": "instagram", "relay": "dom_bridge", "details": res}
        except Exception as e:
            logger.error("Instagram DOM relay post failed: %s", e)
            raise RuntimeError(f"Instagram DOM relay post failed: {e}")


# Global singleton
ig_controller = InstagramController()
