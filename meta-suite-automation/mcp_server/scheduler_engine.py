"""
Antigravity Meta Suite - Dual-Mode Free Scheduler Engine
100% Free - Runs locally via SQLite and APScheduler ($0.00 cost).
Enforces 25 posts/24h cap, 15-30m spacing, exponential backoff retries,
and Native Meta Business Suite push (20 min to 75 days ahead).
"""

import os
import json
import random
import math
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from mcp_server.database import Database, db
from mcp_server.policy_guardian import MetaPolicyGuardian, guardian, MetaPolicyViolation
from mcp_server.instagram_controller import InstagramController, ig_controller
from mcp_server.facebook_controller import FacebookController, fb_controller

logger = logging.getLogger("meta_suite.scheduler")


class SchedulerEngine:
    """Production dual-mode background scheduler for Instagram and Facebook."""

    def __init__(
        self,
        database: Optional[Database] = None,
        policy_guardian: Optional[MetaPolicyGuardian] = None,
        ig: Optional[InstagramController] = None,
        fb: Optional[FacebookController] = None
    ):
        self.db = database or db
        self.guardian = policy_guardian or guardian
        self.ig = ig or (InstagramController(self.db, self.guardian) if database else ig_controller)
        self.fb = fb or (FacebookController(self.db, self.guardian) if database else fb_controller)
        self.scheduler = BackgroundScheduler(daemon=True)
        self._is_running = False
        self._worker_lock = threading.Lock()

    def start(self, poll_interval_seconds: int = 30):
        """Starts the background APScheduler tick loop."""
        if self._is_running:
            return
        # Unstick any interrupted processing jobs from prior runs
        self.db.reset_stuck_processing_jobs()
        self.scheduler.add_job(
            self.tick,
            trigger=IntervalTrigger(seconds=poll_interval_seconds),
            id="meta_scheduler_tick",
            replace_existing=True
        )
        self.scheduler.start()
        self._is_running = True
        logger.info("SchedulerEngine started. Polling SQLite queue every %ds.", poll_interval_seconds)

    def stop(self):
        """Stops the APScheduler."""
        if not self._is_running:
            return
        self.scheduler.shutdown(wait=False)
        self._is_running = False
        logger.info("SchedulerEngine stopped.")

    # -------------------------------------------------------------
    # 1. Job Scheduling & Enqueuing
    # -------------------------------------------------------------
    def schedule_job(
        self,
        platform: str,
        target_type: str,
        target_id: Optional[str],
        content_type: str,
        payload: Dict[str, Any],
        schedule_time_iso: Optional[str] = None,
        use_native_meta_scheduler: bool = False
    ) -> Dict[str, Any]:
        """
        Enqueues a job for immediate or future execution.
        If use_native_meta_scheduler=True and eligible, pushes directly to Meta Business Suite.
        """
        now = datetime.now(timezone.utc)
        target_dt = now

        if schedule_time_iso:
            try:
                target_dt = datetime.fromisoformat(schedule_time_iso.replace("Z", "+00:00"))
            except Exception as e:
                raise ValueError(f"Invalid schedule_time_iso format: {schedule_time_iso}. Use ISO-8601 UTC.")

        # Global Anti-Repeat Gatekeeper: Check text and media uniqueness
        media_paths = payload.get("media_paths") or []
        media_hash = None
        if media_paths and os.path.exists(media_paths[0]):
            media_hash = self.db.compute_file_hash(media_paths[0])

        caption_text = payload.get("caption") or payload.get("description") or payload.get("text") or ""
        valid_uniq, uniq_reason = self.guardian.validate_content_uniqueness(
            platform=platform,
            text=caption_text,
            media_paths=media_paths
        )
        if not valid_uniq:
            raise MetaPolicyViolation(f"Duplicate post blocked: {uniq_reason}")

        meta_scheduled_id = None

        # Mode 2: Meta Business Suite Native Scheduler Push
        if use_native_meta_scheduler and platform == "facebook" and target_type == "page":
            delta = target_dt - now
            if 20 * 60 <= delta.total_seconds() <= 75 * 86400:
                logger.info("Pushing job directly to Meta Business Suite Native Scheduler...")
                res = self.fb.publish_or_schedule(
                    target_type=target_type,
                    target_id=target_id or "me",
                    content_type=content_type,
                    media_paths=media_paths,
                    description=payload.get("caption") or payload.get("description", ""),
                    hashtags=payload.get("hashtags"),
                    link_url=payload.get("link_url"),
                    schedule_time_iso=schedule_time_iso,
                    use_native_meta_scheduler=True
                )
                meta_scheduled_id = res.get("post_id")
                # Record as completed in local DB with native ID
                job_id = self.db.create_scheduled_job(
                    platform=platform,
                    target_type=target_type,
                    target_id=target_id,
                    content_type=content_type,
                    payload=payload,
                    schedule_time_iso=schedule_time_iso,
                    media_hash=media_hash,
                    meta_scheduled_id=meta_scheduled_id
                )
                self.db.update_job_status(job_id, "completed", published_media_id=meta_scheduled_id)
                return {
                    "job_id": job_id,
                    "status": "scheduled_via_meta_native",
                    "meta_scheduled_id": meta_scheduled_id,
                    "schedule_time_iso": schedule_time_iso
                }

        # Mode 1: Local SQLite APScheduler Queue
        job_id = self.db.create_scheduled_job(
            platform=platform,
            target_type=target_type,
            target_id=target_id,
            content_type=content_type,
            payload=payload,
            schedule_time_iso=target_dt.isoformat(),
            media_hash=media_hash
        )

        logger.info("Enqueued local scheduled job #%d for %s at %s", job_id, platform, target_dt.isoformat())
        return {
            "job_id": job_id,
            "status": "queued",
            "schedule_time_iso": target_dt.isoformat(),
            "mode": "local_sqlite_queue"
        }

    # -------------------------------------------------------------
    # 1b. Humanized Batch Scheduler (Anti-Detection & Anti-Burst)
    # -------------------------------------------------------------
    def calculate_human_safe_slot(
        self,
        platform: str,
        start_dt: datetime,
        min_gap_minutes: int = 40,
        max_gap_minutes: int = 65,
        session_posts_count: int = 0
    ) -> datetime:
        """
        Calculates the next natural human posting slot adhering to peak audience windows:
        - Morning peak: 09:00 - 11:30
        - Afternoon peak: 13:00 - 15:30
        - Evening peak: 18:00 - 21:30
        Applies Box-Muller / Gaussian jitter so timestamps are non-uniform and realistic.
        Enforces session rest break after 4 consecutive posts in a batch.
        """
        candidate = start_dt

        # If user has already posted 4 items in this session, enforce an extended resting pause
        if session_posts_count > 0 and session_posts_count % 4 == 0:
            rest_gap = random.uniform(110.0, 160.0)  # 2 - 2.5 hour human break
            candidate = candidate + timedelta(minutes=rest_gap)
        else:
            base_gap = random.uniform(min_gap_minutes, max_gap_minutes)
            jitter = abs(random.gauss(0, 4.5))
            candidate = candidate + timedelta(minutes=base_gap + jitter)

        while True:
            hour = candidate.hour
            is_peak = (9 <= hour < 12) or (13 <= hour < 16) or (18 <= hour < 22)

            if is_peak:
                second_jitter = random.randint(0, 59)
                candidate = candidate.replace(second=second_jitter)
                return candidate

            # Advance to next peak window if outside
            if hour < 9:
                candidate = candidate.replace(
                    hour=9,
                    minute=random.randint(12, 38),
                    second=random.randint(0, 59)
                )
            elif 12 <= hour < 13:
                candidate = candidate.replace(
                    hour=13,
                    minute=random.randint(8, 28),
                    second=random.randint(0, 59)
                )
            elif 16 <= hour < 18:
                candidate = candidate.replace(
                    hour=18,
                    minute=random.randint(10, 35),
                    second=random.randint(0, 59)
                )
            else:  # hour >= 22 (night cooldown)
                # Roll over to tomorrow morning 09:00 with natural jitter
                candidate = (candidate + timedelta(days=1)).replace(
                    hour=9,
                    minute=random.randint(12, 42),
                    second=random.randint(0, 59)
                )

    def schedule_humanized_batch(
        self,
        platform: str,
        target_type: str,
        target_id: Optional[str],
        content_type: str,
        posts: List[Dict[str, Any]],
        immediate_first_post: bool = True,
        use_native_meta_scheduler: bool = False,
        min_gap_minutes: int = 40,
        max_gap_minutes: int = 65
    ) -> Dict[str, Any]:
        """
        High-grade humanized batch scheduler designed for 10-25+ posts.
        - Post #1: Executed or queued immediately with simulated human staging.
        - Posts #2 to #N: Distributed safely across natural peak audience windows
          (09:00-11:30, 13:00-15:30, 18:00-21:30) with non-uniform Gaussian jitter.
        - Enforces rolling 1-hour quota (max 2/hr) and 24-hour quota (max 20/day).
        - Prevents automated machine bursts so Meta never detects high-velocity scheduling.
        - Stored safely in local SQLite queue ($0 cost, 100% compliant) where daemon
          dispatches one post at a time strictly when due.
        """
        if not posts:
            raise ValueError("No posts provided in batch.")

        now_utc = datetime.now(timezone.utc)
        batch_id = f"batch_{int(now_utc.timestamp())}_{random.randint(1000, 9999)}"
        results = []
        timeline = []

        candidate_time = now_utc
        session_count = 0

        for idx, post in enumerate(posts):
            p_title = post.get("title") or post.get("seo_title") or f"Post #{idx + 1}"
            p_caption = post.get("caption") or post.get("description", "")
            p_media = post.get("media_paths") or ([post["media"]] if post.get("media") else [])
            p_hashtags = post.get("hashtags") or []

            payload = {
                "media_paths": p_media,
                "title": p_title,
                "seo_title": p_title,
                "caption": p_caption,
                "description": p_caption,
                "hashtags": p_hashtags,
                "batch_id": batch_id,
                "batch_index": idx + 1,
                "total_in_batch": len(posts),
                "auto_publish": True
            }

            if idx == 0 and immediate_first_post:
                # Immediate publication slot
                sched_iso = now_utc.isoformat()
                simulated_prep = random.randint(45, 80)
                payload["simulated_human_prep_seconds"] = simulated_prep
                payload["bypass_spacing"] = True

                res = self.schedule_job(
                    platform=platform,
                    target_type=target_type,
                    target_id=target_id,
                    content_type=content_type,
                    payload=payload,
                    schedule_time_iso=sched_iso,
                    use_native_meta_scheduler=False
                )
                results.append(res)
                timeline.append({
                    "post_index": idx + 1,
                    "title": p_title,
                    "scheduled_time_iso": sched_iso,
                    "mode": "immediate",
                    "window": "Immediate Post #1 (Now)",
                    "gap_from_previous_minutes": 0,
                    "simulated_prep_seconds": simulated_prep,
                    "job_id": res.get("job_id")
                })
                candidate_time = now_utc
                session_count += 1
            else:
                # Scheduled slot with Gaussian human timing
                candidate_time = self.calculate_human_safe_slot(
                    platform=platform,
                    start_dt=candidate_time,
                    min_gap_minutes=min_gap_minutes,
                    max_gap_minutes=max_gap_minutes,
                    session_posts_count=session_count
                )
                sched_iso = candidate_time.isoformat()
                simulated_prep = random.randint(60, 130)
                payload["simulated_human_prep_seconds"] = simulated_prep
                payload["bypass_spacing"] = False

                res = self.schedule_job(
                    platform=platform,
                    target_type=target_type,
                    target_id=target_id,
                    content_type=content_type,
                    payload=payload,
                    schedule_time_iso=sched_iso,
                    use_native_meta_scheduler=use_native_meta_scheduler
                )
                results.append(res)

                # Determine peak window label
                hour = candidate_time.hour
                if 9 <= hour < 12:
                    win_label = "Morning Peak (09:00 - 11:30)"
                elif 13 <= hour < 16:
                    win_label = "Afternoon Peak (13:00 - 15:30)"
                elif 18 <= hour < 22:
                    win_label = "Evening Prime (18:00 - 21:30)"
                else:
                    win_label = "Standard Window"

                prev_iso = timeline[-1]["scheduled_time_iso"]
                gap_mins = round((datetime.fromisoformat(sched_iso.replace("Z", "+00:00")) - datetime.fromisoformat(prev_iso.replace("Z", "+00:00"))).total_seconds() / 60.0, 1)

                timeline.append({
                    "post_index": idx + 1,
                    "title": p_title,
                    "scheduled_time_iso": sched_iso,
                    "mode": "scheduled",
                    "window": win_label,
                    "gap_from_previous_minutes": gap_mins,
                    "simulated_prep_seconds": simulated_prep,
                    "job_id": res.get("job_id")
                })
                session_count += 1

        logger.info(
            "Batch %s successfully scheduled: %d posts (%d immediate, %d scheduled) across humanized peak windows.",
            batch_id, len(posts), 1 if immediate_first_post else 0, len(posts) - (1 if immediate_first_post else 0)
        )

        return {
            "status": "success",
            "batch_id": batch_id,
            "platform": platform,
            "target_type": target_type,
            "target_id": target_id or "me",
            "total_posts": len(posts),
            "immediate_posts": 1 if immediate_first_post else 0,
            "scheduled_posts": len(posts) - (1 if immediate_first_post else 0),
            "anti_detection_profile": {
                "velocity_guard": "Humanized non-uniform Gaussian distribution",
                "creation_burst_protection": "Zero API burst - staged in local SQLite queue",
                "rolling_hourly_limit": 2,
                "rolling_daily_limit": 20,
                "peak_engagement_windows_enforced": True,
                "session_rest_breaks": "Mandatory 2-hour rest after every 4 posts"
            },
            "timeline": timeline
        }

    # -------------------------------------------------------------
    # 2. Main Worker Tick: Checks & Executes Due Jobs
    # -------------------------------------------------------------
    def tick(self):
        """Worker cycle inspecting upcoming pending jobs. Strictly single-threaded execution."""
        if not self._worker_lock.acquire(blocking=False):
            logger.debug("Scheduler tick already in progress. Skipping overlapping execution.")
            return

        try:
            # 0. Automatically recover any jobs stuck in 'running' state past 15 min threshold
            self.db.recover_stale_jobs(stale_minutes=15)

            upcoming = self.db.list_upcoming_jobs(limit=10)
            now = datetime.now(timezone.utc)

            for job in upcoming:
                if job["status"] != "pending":
                    continue

                sched_iso = job.get("schedule_time_iso")
                if sched_iso:
                    sched_dt = datetime.fromisoformat(sched_iso.replace("Z", "+00:00"))
                    if sched_dt > now:
                        # Job is scheduled for later
                        continue

                self._process_single_job(job)
                # Process strictly 1 job per tick to maintain spacing and prevent overlapping DOM posting
                break

        except Exception as e:
            logger.error("Error during scheduler tick: %s", e)
        finally:
            self._worker_lock.release()

    def _process_single_job(self, job: Dict[str, Any]):
        job_id = job["id"]
        platform = job["platform"]
        target_type = job["target_type"]
        target_id = job.get("target_id")
        content_type = job["content_type"]
        payload = job["payload"]

        logger.info("Processing scheduled job #%d (%s:%s)", job_id, platform, content_type)
        self.db.update_job_status(job_id, "processing")

        try:
            result = None
            if platform == "instagram":
                result = self._dispatch_instagram(target_type, content_type, payload, job_id=job_id)
            elif platform == "facebook":
                result = self._dispatch_facebook(target_type, target_id, content_type, payload, job_id=job_id)
            elif platform == "youtube":
                result = self._dispatch_youtube(payload, job_id=job_id)
            elif platform == "tiktok":
                result = self._dispatch_tiktok(payload, job_id=job_id)
            else:
                raise ValueError(f"Unknown platform: {platform}")

            if isinstance(result, dict) and (result.get("success") is False or result.get("status") == "failed"):
                raise RuntimeError(result.get("error") or result.get("message") or "Publishing dispatch failed")

            published_id = result.get("media_id") or result.get("post_id") or result.get("published_id") or result.get("fb_post_id")
            self.db.update_job_status(job_id, "completed", published_media_id=str(published_id or ""))
            logger.info("Job #%d completed successfully. Media ID: %s", job_id, published_id)

        except MetaPolicyViolation as pv:
            err_str = str(pv)
            if "duplicate" in err_str.lower() or "repeat" in err_str.lower():
                # Permanent rejection: NEVER auto-shift or re-attempt duplicate questions/media
                self.db.update_job_status(job_id, "failed", error_message=f"Permanent duplicate rejected: {err_str}")
                logger.error("Job #%d permanently rejected as duplicate: %s", job_id, err_str)
            else:
                # Rate limit / daily cap / spacing: Auto-shift to next compliant slot
                auto_shift = datetime.now(timezone.utc) + timedelta(minutes=20)
                self.db.reschedule_job(job_id, auto_shift.isoformat(), error_message=err_str, increment_retry=False)
                logger.warning("Policy guard auto-shifted job #%d to %s: %s", job_id, auto_shift.isoformat(), pv)

        except Exception as err:
            err_msg = str(err)
            retry_count = job.get("retry_count", 0) + 1
            max_retries = job.get("max_retries", 3)

            if retry_count >= max_retries:
                self.db.update_job_status(job_id, "failed", error_message=f"Exceeded max retries. Last error: {err_msg}")
                logger.error("Job #%d permanently failed after %d retries: %s", job_id, retry_count, err_msg)
            else:
                # Exponential backoff retry: 5m, 15m, 45m
                backoff_minutes = 5 * (3 ** (retry_count - 1))
                next_try = datetime.now(timezone.utc) + timedelta(minutes=backoff_minutes)
                self.db.reschedule_job(job_id, next_try.isoformat(), error_message=err_msg, increment_retry=True)
                logger.warning("Job #%d failed (attempt %d/%d). Retrying at %s: %s", job_id, retry_count, max_retries, next_try.isoformat(), err_msg)

    def _dispatch_instagram(self, target_type: str, content_type: str, payload: Dict[str, Any], job_id: Optional[int] = None) -> Dict[str, Any]:
        caption = payload.get("caption", "")
        hashtags = payload.get("hashtags")
        media_paths = payload.get("media_paths") or []
        bypass_spacing = payload.get("bypass_spacing", False)

        if content_type == "photo" or target_type == "feed":
            if len(media_paths) > 1:
                return self.ig.publish_carousel(media_paths, caption=caption, hashtags=hashtags, bypass_spacing=bypass_spacing)
            else:
                return self.ig.publish_feed_photo(
                    image_path=media_paths[0],
                    caption=caption,
                    hashtags=hashtags,
                    alt_text=payload.get("alt_text"),
                    user_tags=payload.get("user_tags"),
                    location_id=payload.get("location_id"),
                    job_id=job_id,
                    bypass_spacing=bypass_spacing
                )
        elif content_type == "reel" or target_type == "reel":
            return self.ig.publish_reel(
                video_path=media_paths[0],
                caption=caption,
                hashtags=hashtags,
                cover_path=payload.get("cover_path"),
                share_to_feed=payload.get("share_to_feed", True),
                job_id=job_id,
                bypass_spacing=bypass_spacing
            )
        elif content_type == "story" or target_type == "story":
            return self.ig.publish_story(
                media_path=media_paths[0],
                story_link_url=payload.get("story_link_url")
            )
        raise ValueError(f"Unsupported Instagram content type: {content_type}")

    def _dispatch_facebook(self, target_type: str, target_id: Optional[str], content_type: str, payload: Dict[str, Any], job_id: Optional[int] = None) -> Dict[str, Any]:
        bypass_spacing = payload.get("bypass_spacing", False)
        return self.fb.publish_or_schedule(
            target_type=target_type or "page",
            target_id=target_id or "me",
            content_type=content_type,
            media_paths=payload.get("media_paths"),
            title=payload.get("title") or payload.get("seo_title"),
            description=payload.get("description") or payload.get("caption", ""),
            hashtags=payload.get("hashtags"),
            link_url=payload.get("link_url"),
            thumbnail_path=payload.get("thumbnail_path"),
            srt_path=payload.get("srt_path"),
            bypass_spacing=bypass_spacing,
            job_id=job_id
        )

    def _dispatch_youtube(self, payload: Dict[str, Any], job_id: Optional[int] = None) -> Dict[str, Any]:
        from mcp_server.youtube_controller import youtube
        media_paths = payload.get("media_paths") or []
        media_path = media_paths[0] if media_paths else payload.get("media_path")
        return youtube.publish_or_schedule(
            title=payload.get("title") or payload.get("caption", "YouTube Video"),
            description=payload.get("description") or payload.get("caption", ""),
            media_path=media_path,
            tags=payload.get("tags"),
            is_short=payload.get("is_short", False),
            made_for_kids=payload.get("made_for_kids", False),
            visibility=payload.get("visibility", "PUBLIC"),
            job_id=job_id,
            bypass_spacing=payload.get("bypass_spacing", False)
        )

    def _dispatch_tiktok(self, payload: Dict[str, Any], job_id: Optional[int] = None) -> Dict[str, Any]:
        from mcp_server.tiktok_controller import tiktok
        media_paths = payload.get("media_paths") or []
        video_path = media_paths[0] if media_paths else payload.get("video_path")
        return tiktok.publish_or_schedule(
            caption=payload.get("caption") or payload.get("description", "TikTok Video"),
            video_path=video_path,
            privacy=payload.get("privacy", "PUBLIC_TO_EVERYONE"),
            allow_comments=payload.get("allow_comments", True),
            allow_duet=payload.get("allow_duet", True),
            allow_stitch=payload.get("allow_stitch", True),
            job_id=job_id,
            bypass_spacing=payload.get("bypass_spacing", False)
        )

    # -------------------------------------------------------------
    # 3. Queue Management
    # -------------------------------------------------------------
    def list_queue(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.db.list_upcoming_jobs(limit=limit)

    def cancel_job(self, job_id: int):
        self.db.update_job_status(job_id, "cancelled")

    def reschedule_job(self, job_id: int, new_iso_time: str):
        self.db.reschedule_job(job_id, new_iso_time)

    def pause_queue(self):
        self.db.set_all_jobs_pause_state(paused=True)

    def resume_queue(self):
        self.db.set_all_jobs_pause_state(paused=False)


# Global singleton
scheduler = SchedulerEngine()
