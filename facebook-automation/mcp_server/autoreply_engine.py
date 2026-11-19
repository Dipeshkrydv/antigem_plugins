"""
Antigravity Meta Suite - Automated Comment & Keyword Auto-Reply Engine
Inspired by fb-autoreply-pro.
Manages 24/7 automated comment scanning, keyword matching, public reply loops,
and compliant Comment-to-DM funnels for Meta Business Suite Page and personal feeds.
"""

from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from mcp_server.database import db
from mcp_server.facebook_controller import fb_controller, GRAPH_BASE_URL

logger = logging.getLogger("meta_suite.autoreply")


class AutoReplyEngine:
    """
    Autonomous Comment & Keyword Auto-Reply Engine for Meta Business Suite.
    Integrates with SQLite rules and enforces Meta safety cooldowns.
    """

    def __init__(self):
        self.db = db
        self.fb = fb_controller

    def process_single_comment(
        self,
        post_id: str,
        comment_id: str,
        commenter_id: str,
        commenter_name: str,
        comment_text: str,
        platform: str = "facebook",
        page_id: str = "1409644015561854",
        page_name: str = "Motivational Docqueen",
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluates an individual comment against keyword rules and dispatches reply/DM.
        """
        # 1. Deduplication check: Check if already processed in dm_comment_funnel
        with self.db.get_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT id, public_replied, private_dm_sent FROM dm_comment_funnel WHERE comment_id=?;", (comment_id,))
            existing = c.fetchone()
            if existing and existing["public_replied"] == 1:
                return {"status": "skipped", "reason": "Already replied", "comment_id": comment_id}

        # 2. Match against active keyword rules
        match = self.db.match_keyword_rules(
            comment_text=comment_text,
            commenter_name=commenter_name,
            platform=platform,
            target_page_id=page_id,
            page_name=page_name
        )

        if not match:
            return {"status": "ignored", "reason": "No keyword matched", "comment_id": comment_id}

        action = match.get("action")
        if action == "hide_or_flag":
            logger.warning("[AutoReplyEngine] Toxic comment '%s' from %s flagged: %s", comment_id, commenter_name, match.get("reason"))
            self.db.record_funnel_comment(
                platform=platform,
                comment_id=comment_id,
                post_id=post_id,
                commenter_id=commenter_id,
                commenter_username=commenter_name,
                comment_text=comment_text,
                public_replied=False,
                private_dm_sent=False,
                trigger_keyword=match.get("reason"),
                status="flagged_toxic"
            )
            return {"status": "flagged_toxic", "reason": match.get("reason"), "comment_id": comment_id}

        public_reply = match.get("public_reply")
        send_dm = match.get("send_private_dm", False)
        dm_text = match.get("private_dm_text")
        rule_name = match.get("rule_name")

        if dry_run:
            return {
                "status": "dry_run_success",
                "rule_name": rule_name,
                "comment_id": comment_id,
                "public_reply": public_reply,
                "send_private_dm": send_dm,
                "private_dm_text": dm_text
            }

        # 3. Apply humanized jitter delay (5.0s to 15.0s) to simulate human response speed
        jitter = random.uniform(4.5, 12.0)
        logger.info("[AutoReplyEngine] Applying humanized response jitter of %.1fs for comment %s", jitter, comment_id)
        time.sleep(jitter)

        # 4. Dispatch Public Reply
        reply_res = None
        public_success = False
        try:
            reply_res = self.fb.reply_to_comment(comment_id=comment_id, reply_text=public_reply)
            public_success = True
            logger.info("[AutoReplyEngine] Public reply posted to comment %s (rule: %s)", comment_id, rule_name)
        except Exception as e:
            logger.error("[AutoReplyEngine] Failed to post public reply: %s", e)

        # 5. Dispatch Private DM if requested (Comment-to-DM Funnel)
        dm_success = False
        if send_dm and dm_text:
            try:
                # Use commenter_id as PSID if available
                dm_res = self.fb.send_messenger_dm(recipient_psid=commenter_id, message_text=dm_text)
                dm_success = True
                logger.info("[AutoReplyEngine] Private DM sent to %s for comment %s", commenter_name, comment_id)
            except Exception as e:
                logger.warning("[AutoReplyEngine] Messenger DM skipped/failed (%s). Note: User must have messaged or opted into Messenger.", e)

        # 6. Record in Database
        self.db.record_funnel_comment(
            platform=platform,
            comment_id=comment_id,
            post_id=post_id,
            commenter_id=commenter_id,
            commenter_username=commenter_name,
            comment_text=comment_text,
            public_replied=public_success,
            public_reply_text=public_reply if public_success else None,
            private_dm_sent=dm_success,
            trigger_keyword=match.get("matched_keyword"),
            status="replied" if public_success else "reply_failed"
        )

        return {
            "status": "success" if public_success else "partial_or_failed",
            "rule_name": rule_name,
            "comment_id": comment_id,
            "public_replied": public_success,
            "public_reply": public_reply,
            "private_dm_sent": dm_success
        }

    def run_auto_reply_cycle(
        self,
        platform: str = "facebook",
        page_id: str = "1409644015561854",
        limit_posts: int = 5,
        max_replies_per_cycle: int = 10,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Executes a complete scan-and-reply cycle over recent Page posts.
        """
        session = self.fb._get_active_session()
        tokens = session.get("tokens", {})
        access_token = tokens.get("page_access_token") or tokens.get("access_token")

        if not access_token:
            # If no direct page access token, signal DOM bridge availability
            logger.info("[AutoReplyEngine] No Graph API page token found. Relying on active DOM Bridge or session cookies.")
            return {
                "status": "dom_bridge_ready",
                "message": "Auto-Reply engine is active via Chrome Bridge. Inbox comments will be processed via DOM automation.",
                "page_id": page_id,
                "rules_active": len(self.db.list_keyword_rules(platform))
            }

        # Query recent Page posts
        posts_url = f"{GRAPH_BASE_URL}/{page_id}/feed"
        posts = []
        try:
            with httpx.Client(timeout=25.0) as client:
                r = client.get(posts_url, params={"access_token": access_token, "limit": limit_posts, "fields": "id,message,created_time"})
                if r.status_code == 200:
                    posts = r.json().get("data", [])
        except Exception as e:
            logger.error("[AutoReplyEngine] Failed to fetch recent posts: %s", e)
            return {"status": "error", "error": str(e)}

        total_scanned = 0
        total_replied = 0
        actions = []

        with httpx.Client(timeout=25.0) as client:
            for p in posts:
                post_id = p["id"]
                # Fetch comments on post
                com_resp = client.get(
                    f"{GRAPH_BASE_URL}/{post_id}/comments",
                    params={"access_token": access_token, "limit": 25, "fields": "id,from,message,created_time"}
                )
                if com_resp.status_code != 200:
                    continue

                comments = com_resp.json().get("data", [])
                for c in comments:
                    total_scanned += 1
                    cid = c["id"]
                    from_user = c.get("from", {})
                    c_author_id = from_user.get("id", "unknown")
                    c_author_name = from_user.get("name", "Friend")
                    c_text = c.get("message", "")

                    # Skip comments posted by the Page itself
                    if c_author_id == page_id:
                        continue

                    res = self.process_single_comment(
                        post_id=post_id,
                        comment_id=cid,
                        commenter_id=c_author_id,
                        commenter_name=c_author_name,
                        comment_text=c_text,
                        platform=platform,
                        page_id=page_id,
                        dry_run=dry_run
                    )

                    if res.get("status") in ("success", "dry_run_success"):
                        total_replied += 1
                        actions.append(res)

                    if total_replied >= max_replies_per_cycle:
                        break

                if total_replied >= max_replies_per_cycle:
                    break

        return {
            "status": "cycle_completed",
            "page_id": page_id,
            "posts_inspected": len(posts),
            "comments_scanned": total_scanned,
            "replies_dispatched": total_replied,
            "actions": actions
        }


# Global singleton instance
autoreply_engine = AutoReplyEngine()
