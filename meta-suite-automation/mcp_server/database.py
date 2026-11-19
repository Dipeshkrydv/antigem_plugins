"""
Antigravity Meta Suite - Database Module (meta_suite.db)
Production-grade SQLite schema and DAL with WAL mode, thread safety,
deduplication via SHA-256 media hashing, 24h rate-limit tracking,
and Meta compliance safeguards.
"""

import os
import json
import sqlite3
import hashlib
import re
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("meta_suite.database")

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(DB_DIR, "..", "meta_suite.db")


class Database:
    """Thread-safe SQLite database manager for Meta Suite."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = os.path.abspath(db_path)
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30.0)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for high concurrency between APScheduler and MCP calls
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Sessions table: Stores live cookies & page tokens synced from Chrome Extension
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,                -- 'instagram', 'facebook', 'business_suite'
                account_id TEXT NOT NULL,              -- ds_user_id (IG) or c_user (FB)
                username TEXT,
                cookies_json TEXT NOT NULL,            -- Serialized cookies dict
                tokens_json TEXT,                      -- fb_dtsg, lsd, X-IG-App-ID, etc.
                user_agent TEXT,                       -- Exact browser User-Agent
                last_synced_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                status TEXT DEFAULT 'healthy',         -- 'healthy', 'checkpoint', 'challenge', 'rate_limited', 'expired'
                UNIQUE(platform, account_id)
            );
            """)

            # 2. Scheduled Jobs table: Queued posts, reels, videos, stories
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,                -- 'instagram', 'facebook'
                target_type TEXT NOT NULL,             -- 'feed', 'reel', 'story', 'carousel', 'page', 'group', 'profile'
                target_id TEXT,                        -- Page ID, Group ID, or Profile ID
                content_type TEXT NOT NULL,            -- 'photo', 'video', 'carousel', 'story', 'text', 'link'
                payload_json TEXT NOT NULL,            -- Full parameters: paths, caption, tags, alt_text, etc.
                schedule_time_iso TEXT,                -- ISO-8601 UTC timestamp (None for immediate)
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT DEFAULT 'pending',         -- 'pending', 'processing', 'completed', 'failed', 'paused', 'cancelled'
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                error_message TEXT,
                media_hash TEXT,                       -- SHA-256 for deduplication
                meta_scheduled_id TEXT,                -- ID if synced to Meta Business Suite native scheduler
                published_media_id TEXT                -- Resulting Meta media_id / post_id
            );
            """)

            # 3. Published Content table: Content lifecycle, edits, archives, and deletions
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS published_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                media_id TEXT NOT NULL UNIQUE,         -- Native Meta media ID or post ID
                post_id TEXT,                          -- Graph post ID if distinct
                shortcode TEXT,                        -- IG shortcode (e.g. C8k9abc)
                content_type TEXT NOT NULL,
                caption TEXT,
                seo_title TEXT,
                media_hash TEXT,
                published_at TEXT NOT NULL,
                permalink TEXT,
                likes_count INTEGER DEFAULT 0,
                comments_count INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0,
                comments_enabled INTEGER DEFAULT 1,
                status TEXT DEFAULT 'published'        -- 'published', 'deleted', 'archived'
            );
            """)

            # 4. Compliance Logs: Tracks rolling 24h uploads and hourly API quotas
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS compliance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                account_id TEXT NOT NULL,
                action_type TEXT NOT NULL,             -- 'api_call', 'publish_post', 'send_dm', 'comment_reply', 'dom_action'
                endpoint_or_desc TEXT,
                status TEXT NOT NULL,                  -- 'success', 'throttled', 'circuit_breaker', 'error'
                headers_usage_json TEXT,               -- X-App-Usage, X-Business-Use-Case-Usage
                timestamp TEXT NOT NULL
            );
            """)

            # 5. Comment-to-DM Funnel table: Enforces 1 private DM per comment (strict Meta policy)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS dm_comment_funnel (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                comment_id TEXT NOT NULL UNIQUE,       -- Deduplication key: max 1 private DM reply
                post_id TEXT NOT NULL,
                commenter_id TEXT NOT NULL,
                commenter_username TEXT,
                comment_text TEXT,
                comment_timestamp TEXT,
                public_replied INTEGER DEFAULT 0,
                public_reply_text TEXT,
                private_dm_sent INTEGER DEFAULT 0,
                private_dm_timestamp TEXT,
                trigger_keyword TEXT,
                status TEXT DEFAULT 'processed'
            );
            """)

            # 6. DM Threads table: Enforces 24-Hour standard messaging window
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS dm_threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                thread_id TEXT NOT NULL UNIQUE,
                user_id TEXT NOT NULL,
                username TEXT,
                last_user_message_at TEXT NOT NULL,    -- Timestamp of user's incoming message
                can_send_automated_dm INTEGER DEFAULT 1,
                thread_type TEXT DEFAULT 'standard_24h',-- 'standard_24h', 'click_to_direct_7d', 'human_agent_7d'
                last_bot_reply_at TEXT
            );
            """)

            # 7. Keyword Auto-Reply Rules Table (Inspired by fb-autoreply-pro)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS keyword_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_name TEXT NOT NULL,
                platform TEXT DEFAULT 'facebook',
                target_page_id TEXT DEFAULT '1409644015561854',
                keywords_json TEXT NOT NULL,          -- JSON array of trigger words/phrases
                match_mode TEXT DEFAULT 'specific',   -- 'all', 'specific', 'both'
                reply_templates_json TEXT NOT NULL,   -- JSON array of response variations
                send_private_dm INTEGER DEFAULT 0,
                dm_template TEXT,
                toxic_filter_json TEXT,               -- JSON array of banned/toxic words
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """)

            # 8. Cron Time Slots Table (Inspired by facebook-content-automation-dashboard)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS cron_time_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slot_time TEXT NOT NULL UNIQUE,       -- '08:00', '13:00', '17:30', '20:45'
                slot_label TEXT,                      -- 'Morning Prime', 'Midday Break', etc.
                platform TEXT DEFAULT 'facebook',
                target_id TEXT DEFAULT '1409644015561854',
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );
            """)

            # Helpful indices for fast querying
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status_sched ON scheduled_jobs(status, schedule_time_iso);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_compliance_account_time ON compliance_logs(account_id, timestamp);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_published_media ON published_content(media_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_funnel_comment ON dm_comment_funnel(comment_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_threads_time ON dm_threads(last_user_message_at);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_platform ON keyword_rules(platform, is_active);")

            # Global Anti-Repeat: Add content_hash column if missing and create indices
            for table in ["scheduled_jobs", "published_content"]:
                cols = [c[1] for c in cursor.execute(f"PRAGMA table_info({table});").fetchall()]
                if "content_hash" not in cols:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN content_hash TEXT;")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_content_hash ON scheduled_jobs(content_hash);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_pub_content_hash ON published_content(content_hash);")

            # Backfill content_hash for legacy published_content rows
            cursor.execute("SELECT id, caption FROM published_content WHERE content_hash IS NULL AND caption IS NOT NULL;")
            for row in cursor.fetchall():
                ch = Database.compute_content_hash(row["caption"])
                if ch:
                    cursor.execute("UPDATE published_content SET content_hash=? WHERE id=?;", (ch, row["id"]))

            # Backfill content_hash for legacy scheduled_jobs rows
            cursor.execute("SELECT id, payload_json FROM scheduled_jobs WHERE content_hash IS NULL;")
            for row in cursor.fetchall():
                try:
                    p = json.loads(row["payload_json"])
                    txt = p.get("caption") or p.get("description") or p.get("text") or ""
                    ch = Database.compute_content_hash(txt)
                    if ch:
                        cursor.execute("UPDATE scheduled_jobs SET content_hash=? WHERE id=?;", (ch, row["id"]))
                except Exception:
                    pass

            conn.commit()
            logger.info("Database initialized successfully at %s", self.db_path)

    # ---------------------------------------------------------
    # Helper: SHA-256 Media Hashing for Deduplication
    # ---------------------------------------------------------
    @staticmethod
    def compute_file_hash(file_path: str) -> Optional[str]:
        """Calculates SHA-256 hash of a file to prevent duplicate uploads."""
        if not os.path.exists(file_path):
            return None
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    # Backward-compatible alias
    compute_media_hash = compute_file_hash

    @staticmethod
    def compute_content_hash(text: Optional[str]) -> Optional[str]:
        """Calculates normalized SHA-256 hash of post text to prevent duplicate captions."""
        if not text:
            return None
        clean = re.sub(r"https?://\S+", "", text)
        clean = re.sub(r"#[a-zA-Z_]\w*", "", clean)
        clean = re.sub(r"[^\w\s]", "", clean)
        clean = re.sub(r"\s+", " ", clean).strip().lower()
        if not clean:
            return None
        return hashlib.sha256(clean.encode("utf-8")).hexdigest()

    # ---------------------------------------------------------
    # Sessions DAL
    # ---------------------------------------------------------
    def save_session(
        self,
        platform: str,
        account_id: str,
        username: Optional[str],
        cookies: Dict[str, Any],
        tokens: Optional[Dict[str, Any]] = None,
        user_agent: Optional[str] = None,
        status: str = "healthy"
    ) -> int:
        now_iso = datetime.now(timezone.utc).isoformat()
        cookies_json = json.dumps(cookies)
        tokens_json = json.dumps(tokens or {})
        is_active = 0 if status in ("no_pages", "logged_out", "expired") else 1
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO sessions (platform, account_id, username, cookies_json, tokens_json, user_agent, last_synced_at, is_active, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, account_id) DO UPDATE SET
                username=excluded.username,
                cookies_json=excluded.cookies_json,
                tokens_json=excluded.tokens_json,
                user_agent=COALESCE(excluded.user_agent, sessions.user_agent),
                last_synced_at=excluded.last_synced_at,
                is_active=excluded.is_active,
                status=excluded.status;
            """, (platform, account_id, username, cookies_json, tokens_json, user_agent, now_iso, is_active, status))
            conn.commit()
            return cursor.lastrowid

    def get_session(self, platform: str, account_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if account_id:
                cursor.execute("SELECT * FROM sessions WHERE platform=? AND account_id=? AND is_active=1 LIMIT 1;", (platform, account_id))
            else:
                cursor.execute("SELECT * FROM sessions WHERE platform=? AND is_active=1 ORDER BY last_synced_at DESC LIMIT 1;", (platform,))
            row = cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["cookies"] = json.loads(data["cookies_json"])
            data["tokens"] = json.loads(data["tokens_json"] or "{}")
            return data

    def list_active_sessions(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, platform, account_id, username, user_agent, last_synced_at, status FROM sessions WHERE is_active=1;")
            return [dict(row) for row in cursor.fetchall()]

    def list_all_sessions(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, platform, account_id, username, user_agent, last_synced_at, is_active, status FROM sessions ORDER BY id ASC;")
            return [dict(row) for row in cursor.fetchall()]

    def update_session_status(self, platform: str, account_id: str, status: str):
        with self.get_connection() as conn:
            conn.execute("UPDATE sessions SET status=? WHERE platform=? AND account_id=?;", (status, platform, account_id))
            conn.commit()

    def delete_session(self, platform: str, account_id: Optional[str] = None):
        with self.get_connection() as conn:
            if platform == "all":
                conn.execute("UPDATE sessions SET is_active=0, status='logged_out', cookies_json='{}', tokens_json='{}';")
            elif account_id:
                conn.execute("UPDATE sessions SET is_active=0, status='logged_out', cookies_json='{}', tokens_json='{}' WHERE platform=? AND account_id=?;", (platform, account_id))
            else:
                conn.execute("UPDATE sessions SET is_active=0, status='logged_out', cookies_json='{}', tokens_json='{}' WHERE platform=?;", (platform,))
            conn.commit()

    # ---------------------------------------------------------
    # Scheduled Jobs DAL
    # ---------------------------------------------------------
    def create_scheduled_job(
        self,
        platform: str,
        target_type: str,
        target_id: Optional[str],
        content_type: str,
        payload: Dict[str, Any],
        schedule_time_iso: Optional[str] = None,
        media_hash: Optional[str] = None,
        meta_scheduled_id: Optional[str] = None,
        content_hash: Optional[str] = None
    ) -> int:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload_json = json.dumps(payload)
        if not content_hash:
            caption_text = payload.get("caption") or payload.get("description") or payload.get("text") or ""
            content_hash = self.compute_content_hash(caption_text)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO scheduled_jobs (
                platform, target_type, target_id, content_type, payload_json,
                schedule_time_iso, created_at, updated_at, status, media_hash, meta_scheduled_id, content_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?);
            """, (
                platform, target_type, target_id, content_type, payload_json,
                schedule_time_iso, now_iso, now_iso, media_hash, meta_scheduled_id, content_hash
            ))
            conn.commit()
            return cursor.lastrowid

    def get_job(self, job_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM scheduled_jobs WHERE id=?;", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            res["payload"] = json.loads(res["payload_json"])
            return res

    def list_upcoming_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM scheduled_jobs
            WHERE status IN ('pending', 'processing', 'paused')
            ORDER BY schedule_time_iso ASC, id ASC
            LIMIT ?;
            """, (limit,))
            jobs = []
            for row in cursor.fetchall():
                d = dict(row)
                d["payload"] = json.loads(d["payload_json"])
                jobs.append(d)
            return jobs

    def get_due_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Alias to list_upcoming_jobs for backward compatibility."""
        return self.list_upcoming_jobs(limit=limit)

    def schedule_post(self, post_id: int, run_at_timestamp: float) -> int:
        """Alias to create_scheduled_job for backward compatibility."""
        from datetime import datetime, timezone
        schedule_iso = datetime.fromtimestamp(run_at_timestamp, tz=timezone.utc).isoformat()
        return self.create_scheduled_job(
            platform="facebook",
            target_type="profile",
            target_id=None,
            content_type="photo",
            payload={"post_id": post_id, "auto_publish": True},
            schedule_time_iso=schedule_iso
        )

    def list_scheduled_jobs(self, limit: int = 100, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("""
                SELECT * FROM scheduled_jobs
                WHERE status = ?
                ORDER BY id DESC
                LIMIT ?;
                """, (status, limit))
            else:
                cursor.execute("""
                SELECT * FROM scheduled_jobs
                ORDER BY id DESC
                LIMIT ?;
                """, (limit,))
            jobs = []
            for row in cursor.fetchall():
                d = dict(row)
                try:
                    d["payload"] = json.loads(d["payload_json"])
                except Exception:
                    d["payload"] = {}
                jobs.append(d)
            return jobs

    def update_job_status(
        self,
        job_id: int,
        status: str,
        published_media_id: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status == "failed":
                cursor.execute("""
                UPDATE scheduled_jobs
                SET status=?, error_message=?, retry_count=retry_count+1, updated_at=?
                WHERE id=?;
                """, (status, error_message, now_iso, job_id))
            else:
                cursor.execute("""
                UPDATE scheduled_jobs
                SET status=?, published_media_id=COALESCE(?, published_media_id),
                    error_message=?, updated_at=?
                WHERE id=?;
                """, (status, published_media_id, error_message, now_iso, job_id))
            conn.commit()

    def reschedule_job(
        self,
        job_id: int,
        new_schedule_time_iso: str,
        error_message: Optional[str] = None,
        increment_retry: bool = False
    ):
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            if increment_retry:
                conn.execute("""
                UPDATE scheduled_jobs
                SET schedule_time_iso=?, status='pending', retry_count=retry_count+1,
                    error_message=COALESCE(?, error_message), updated_at=?
                WHERE id=?;
                """, (new_schedule_time_iso, error_message, now_iso, job_id))
            else:
                conn.execute("""
                UPDATE scheduled_jobs
                SET schedule_time_iso=?, status='pending',
                    error_message=COALESCE(?, error_message), updated_at=?
                WHERE id=?;
                """, (new_schedule_time_iso, error_message, now_iso, job_id))
            conn.commit()

    def reset_stuck_processing_jobs(self):
        """Resets any jobs left in 'processing' state back to 'pending'."""
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            conn.execute("UPDATE scheduled_jobs SET status='pending', updated_at=? WHERE status='processing';", (now_iso,))
            conn.commit()

    def reset_job_retry_count(self, job_id: int):
        """Resets the retry count and error message of a job."""
        with self.get_connection() as conn:
            conn.execute("UPDATE scheduled_jobs SET retry_count=0, error_message=NULL WHERE id=?;", (job_id,))
            conn.commit()

    def clear_jobs(self, statuses: Optional[List[str]] = None) -> int:
        """Purges jobs with matching status ('completed', 'failed', 'cancelled')."""
        if not statuses:
            statuses = ["completed", "failed", "cancelled"]
        placeholders = ",".join(["?"] * len(statuses))
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"DELETE FROM scheduled_jobs WHERE status IN ({placeholders});", tuple(statuses))
            conn.commit()
            return cursor.rowcount

    def set_all_jobs_pause_state(self, paused: bool):
        target_status = "paused" if paused else "pending"
        source_status = "pending" if paused else "paused"
        with self.get_connection() as conn:
            conn.execute("UPDATE scheduled_jobs SET status=? WHERE status=?;", (target_status, source_status))
            conn.commit()

    def is_duplicate_media(self, media_hash: str, platform: Optional[str] = None, exclude_job_id: Optional[int] = None) -> bool:
        """Checks if identical media was published or queued recently on the same platform (or globally if platform is None)."""
        if not media_hash:
            return False
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if platform:
                # Check published content on the same platform
                cursor.execute("SELECT 1 FROM published_content WHERE media_hash=? AND platform=? LIMIT 1;", (media_hash, platform))
                if cursor.fetchone():
                    return True
                # Check queued jobs on the same platform
                if exclude_job_id is not None:
                    cursor.execute("SELECT 1 FROM scheduled_jobs WHERE media_hash=? AND platform=? AND status IN ('pending', 'processing') AND id!=? LIMIT 1;", (media_hash, platform, exclude_job_id))
                else:
                    cursor.execute("SELECT 1 FROM scheduled_jobs WHERE media_hash=? AND platform=? AND status IN ('pending', 'processing') LIMIT 1;", (media_hash, platform))
                return cursor.fetchone() is not None
            else:
                # Check published content globally
                cursor.execute("SELECT 1 FROM published_content WHERE media_hash=? LIMIT 1;", (media_hash,))
                if cursor.fetchone():
                    return True
                # Check queued jobs globally
                if exclude_job_id is not None:
                    cursor.execute("SELECT 1 FROM scheduled_jobs WHERE media_hash=? AND status IN ('pending', 'processing') AND id!=? LIMIT 1;", (media_hash, exclude_job_id))
                else:
                    cursor.execute("SELECT 1 FROM scheduled_jobs WHERE media_hash=? AND status IN ('pending', 'processing') LIMIT 1;", (media_hash,))
                return cursor.fetchone() is not None

    def is_duplicate_post(
        self,
        text: Optional[str] = None,
        media_hash: Optional[str] = None,
        platform: Optional[str] = None,
        exclude_job_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Global Anti-Repeat Gatekeeper:
        Strictly verifies both media hash and normalized text hash against all published and queued posts.
        Returns (is_duplicate: bool, reason: str).
        """
        c_hash = self.compute_content_hash(text) if text else None

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Media Hash Check
            if media_hash:
                if platform:
                    cursor.execute("SELECT 1 FROM published_content WHERE media_hash=? AND platform=? AND status='published' LIMIT 1;", (media_hash, platform))
                else:
                    cursor.execute("SELECT 1 FROM published_content WHERE media_hash=? AND status='published' LIMIT 1;", (media_hash,))
                if cursor.fetchone():
                    return True, f"Duplicate media: This image/video was already published previously on {platform or 'social platforms'}."

                query = "SELECT 1 FROM scheduled_jobs WHERE media_hash=? AND status IN ('pending', 'processing')"
                params = [media_hash]
                if platform:
                    query += " AND platform=?"
                    params.append(platform)
                if exclude_job_id is not None:
                    query += " AND id!=?"
                    params.append(exclude_job_id)
                query += " LIMIT 1;"
                cursor.execute(query, tuple(params))
                if cursor.fetchone():
                    return True, f"Duplicate media: This image/video is already waiting in the scheduled queue for {platform or 'social platforms'}."

            # 2. Text / Content Hash Check
            if c_hash:
                if platform:
                    cursor.execute("SELECT 1 FROM published_content WHERE content_hash=? AND platform=? AND status='published' LIMIT 1;", (c_hash, platform))
                else:
                    cursor.execute("SELECT 1 FROM published_content WHERE content_hash=? AND status='published' LIMIT 1;", (c_hash,))
                if cursor.fetchone():
                    return True, f"Duplicate content: An identical question or caption was already published on {platform or 'social platforms'}."

                query = "SELECT 1 FROM scheduled_jobs WHERE content_hash=? AND status IN ('pending', 'processing')"
                params = [c_hash]
                if platform:
                    query += " AND platform=?"
                    params.append(platform)
                if exclude_job_id is not None:
                    query += " AND id!=?"
                    params.append(exclude_job_id)
                query += " LIMIT 1;"
                cursor.execute(query, tuple(params))
                if cursor.fetchone():
                    return True, f"Duplicate content: An identical question or caption is already waiting in the scheduled queue for {platform or 'social platforms'}."

        return False, None

    def check_duplicate(
        self,
        media_paths: Optional[List[str]] = None,
        caption: Optional[str] = None,
        platform: Optional[str] = None,
        exclude_job_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """Compatibility alias for is_duplicate_post."""
        media_hash = None
        if media_paths and len(media_paths) > 0 and os.path.exists(media_paths[0]):
            media_hash = self.compute_media_hash(media_paths[0])
        return self.is_duplicate_post(
            text=caption,
            media_hash=media_hash,
            platform=platform,
            exclude_job_id=exclude_job_id
        )

    # ---------------------------------------------------------
    # Published Content DAL
    # ---------------------------------------------------------
    def record_published_content(
        self,
        platform: str,
        media_id: str,
        content_type: str,
        caption: Optional[str] = None,
        seo_title: Optional[str] = None,
        media_hash: Optional[str] = None,
        shortcode: Optional[str] = None,
        permalink: Optional[str] = None,
        content_hash: Optional[str] = None
    ) -> int:
        now_iso = datetime.now(timezone.utc).isoformat()
        if not content_hash and caption:
            content_hash = self.compute_content_hash(caption)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO published_content (
                platform, media_id, shortcode, content_type, caption,
                seo_title, media_hash, published_at, permalink, status, content_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
            ON CONFLICT(media_id) DO UPDATE SET
                caption=COALESCE(excluded.caption, published_content.caption),
                permalink=COALESCE(excluded.permalink, published_content.permalink),
                content_hash=COALESCE(excluded.content_hash, published_content.content_hash);
            """, (platform, media_id, shortcode, content_type, caption, seo_title, media_hash, now_iso, permalink, content_hash))
            conn.commit()
            return cursor.lastrowid

    def list_published_content(self, platform: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if platform:
                cursor.execute("SELECT * FROM published_content WHERE platform=? AND status!='deleted' ORDER BY published_at DESC LIMIT ?;", (platform, limit))
            else:
                cursor.execute("SELECT * FROM published_content WHERE status!='deleted' ORDER BY published_at DESC LIMIT ?;", (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def update_content_status(self, media_id: str, action: str, new_caption: Optional[str] = None):
        """action in ['delete', 'archive', 'unarchive', 'pin', 'unpin', 'edit_caption', 'toggle_comments']"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if action == "delete":
                cursor.execute("UPDATE published_content SET status='deleted' WHERE media_id=?;", (media_id,))
            elif action == "archive":
                cursor.execute("UPDATE published_content SET is_archived=1 WHERE media_id=?;", (media_id,))
            elif action == "unarchive":
                cursor.execute("UPDATE published_content SET is_archived=0 WHERE media_id=?;", (media_id,))
            elif action == "pin":
                cursor.execute("UPDATE published_content SET is_pinned=1 WHERE media_id=?;", (media_id,))
            elif action == "unpin":
                cursor.execute("UPDATE published_content SET is_pinned=0 WHERE media_id=?;", (media_id,))
            elif action == "edit_caption" and new_caption is not None:
                cursor.execute("UPDATE published_content SET caption=? WHERE media_id=?;", (new_caption, media_id))
            elif action == "toggle_comments":
                cursor.execute("UPDATE published_content SET comments_enabled = CASE WHEN comments_enabled=1 THEN 0 ELSE 1 END WHERE media_id=?;", (media_id,))
            conn.commit()

    # ---------------------------------------------------------
    # In-Flight Lock & Compatibility DAL
    # ---------------------------------------------------------
    _active_locks: set = set()

    def acquire_lock(self, lock_key: str) -> bool:
        if lock_key in Database._active_locks:
            return False
        Database._active_locks.add(lock_key)
        return True

    def release_lock(self, lock_key: str):
        Database._active_locks.discard(lock_key)

    def record_post(
        self,
        client_id: str,
        post_type: str,
        caption: str,
        media_paths: Optional[List[str]] = None,
        target_type: str = "page",
        target_id: Optional[str] = None,
        status: str = "publishing"
    ) -> int:
        media_p = media_paths[0] if media_paths else None
        m_hash = self.compute_media_hash(media_p) if media_p else None
        return self.record_published_content(
            platform="facebook",
            media_id=client_id,
            content_type=post_type,
            caption=caption,
            media_hash=m_hash,
            permalink=None
        )

    def update_post_status(
        self,
        post_id: int,
        status: str,
        fb_post_id: Optional[str] = None,
        post_url: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if fb_post_id:
                cursor.execute(
                    "UPDATE published_content SET status=?, media_id=?, permalink=? WHERE id=?;",
                    (status, fb_post_id, post_url, post_id)
                )
            else:
                cursor.execute(
                    "UPDATE published_content SET status=? WHERE id=?;",
                    (status, post_id)
                )
            conn.commit()

    def list_posts(self, limit: int = 15, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, platform, media_id, content_type, caption, seo_title, permalink, status, published_at FROM published_content"
            params = []
            if status:
                query += " WHERE status = ?"
                params.append(status)
            query += " ORDER BY id DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [
                {
                    "id": r[0],
                    "platform": r[1],
                    "media_id": r[2],
                    "content_type": r[3],
                    "caption": r[4],
                    "seo_title": r[5],
                    "permalink": r[6],
                    "status": r[7],
                    "published_at": r[8]
                }
                for r in rows
            ]

    def log_audit(self, action: str, target_type: str = "", target_id: str = "", details: str = ""):
        self.log_compliance_action(
            platform="facebook",
            account_id=str(target_id or "default"),
            action_type=action,
            endpoint_or_desc=f"{target_type}:{details}",
            status="success"
        )

    # ---------------------------------------------------------
    # Compliance & Quota DAL
    # ---------------------------------------------------------
    def log_compliance_action(
        self,
        platform: str,
        account_id: str,
        action_type: str,
        endpoint_or_desc: str,
        status: str,
        headers_usage: Optional[Dict[str, Any]] = None
    ):
        now_iso = datetime.now(timezone.utc).isoformat()
        usage_json = json.dumps(headers_usage or {})
        with self.get_connection() as conn:
            conn.execute("""
            INSERT INTO compliance_logs (platform, account_id, action_type, endpoint_or_desc, status, headers_usage_json, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (platform, account_id, action_type, endpoint_or_desc, status, usage_json, now_iso))
            conn.commit()

    def get_rolling_24h_upload_count(self, platform: str, account_id: str) -> int:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT COUNT(*) FROM compliance_logs
            WHERE platform=? AND account_id=? AND action_type='publish_post' AND status='success' AND timestamp >= ?;
            """, (platform, account_id, cutoff))
            return cursor.fetchone()[0]

    def get_rolling_hourly_api_count(self, platform: str, account_id: str) -> int:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT COUNT(*) FROM compliance_logs
            WHERE platform=? AND account_id=? AND action_type IN ('api_call', 'publish_post', 'comment_reply', 'send_dm') AND timestamp >= ?;
            """, (platform, account_id, cutoff))
            return cursor.fetchone()[0]

    def get_last_upload_time(self, platform: str, account_id: str) -> Optional[datetime]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT timestamp FROM compliance_logs
            WHERE platform=? AND account_id=? AND action_type='publish_post' AND status='success'
            ORDER BY timestamp DESC LIMIT 1;
            """, (platform, account_id))
            row = cursor.fetchone()
            if row:
                return datetime.fromisoformat(row[0])
            return None

    # ---------------------------------------------------------
    # Comment-to-DM Funnel DAL
    # ---------------------------------------------------------
    def has_private_dm_been_sent(self, comment_id: str) -> bool:
        """Guarantees strict Meta policy compliance: 1 private DM reply per comment."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT private_dm_sent FROM dm_comment_funnel WHERE comment_id=?;", (comment_id,))
            row = cursor.fetchone()
            return bool(row and row[0] == 1)

    def record_comment_funnel_action(
        self,
        platform: str,
        comment_id: str,
        post_id: str,
        commenter_id: str,
        commenter_username: str,
        comment_text: str,
        public_replied: bool = False,
        public_reply_text: Optional[str] = None,
        private_dm_sent: bool = False,
        trigger_keyword: Optional[str] = None
    ):
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO dm_comment_funnel (
                platform, comment_id, post_id, commenter_id, commenter_username,
                comment_text, comment_timestamp, public_replied, public_reply_text,
                private_dm_sent, private_dm_timestamp, trigger_keyword
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(comment_id) DO UPDATE SET
                public_replied=MAX(dm_comment_funnel.public_replied, excluded.public_replied),
                public_reply_text=COALESCE(excluded.public_reply_text, dm_comment_funnel.public_reply_text),
                private_dm_sent=MAX(dm_comment_funnel.private_dm_sent, excluded.private_dm_sent),
                private_dm_timestamp=COALESCE(excluded.private_dm_timestamp, dm_comment_funnel.private_dm_timestamp);
            """, (
                platform, comment_id, post_id, commenter_id, commenter_username,
                comment_text, now_iso, int(public_replied), public_reply_text,
                int(private_dm_sent), now_iso if private_dm_sent else None, trigger_keyword
            ))
            conn.commit()

    # ---------------------------------------------------------
    # DM Threads (24-Hour Standard Messaging Window)
    # ---------------------------------------------------------
    def update_dm_thread_activity(
        self,
        platform: str,
        thread_id: str,
        user_id: str,
        username: Optional[str],
        incoming_message_time: Optional[datetime] = None,
        thread_type: str = "standard_24h"
    ):
        now_iso = (incoming_message_time or datetime.now(timezone.utc)).isoformat()
        with self.get_connection() as conn:
            conn.execute("""
            INSERT INTO dm_threads (platform, thread_id, user_id, username, last_user_message_at, can_send_automated_dm, thread_type)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(thread_id) DO UPDATE SET
                username=COALESCE(excluded.username, dm_threads.username),
                last_user_message_at=excluded.last_user_message_at,
                can_send_automated_dm=1,
                thread_type=excluded.thread_type;
            """, (platform, thread_id, user_id, username, now_iso, thread_type))
            conn.commit()

    def can_send_dm_in_window(self, thread_id: str) -> Tuple[bool, str]:
        """Validates Meta's 24-hour messaging window (or 7 days for click-to-direct/human-agent)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT last_user_message_at, thread_type FROM dm_threads WHERE thread_id=?;", (thread_id,))
            row = cursor.fetchone()
            if not row:
                return False, "No incoming message record found for this thread. Cold unsolicited DMs are prohibited by Meta policy."
            
            last_msg_at = datetime.fromisoformat(row[0])
            thread_type = row[1]
            now = datetime.now(timezone.utc)

            allowed_window = timedelta(days=7) if thread_type in ("click_to_direct_7d", "human_agent_7d") else timedelta(hours=24)
            if now - last_msg_at <= allowed_window:
                return True, "Within active messaging window."
            else:
                return False, f"Messaging window expired ({thread_type} limit: {allowed_window}). User must initiate new message."

    # ---------------------------------------------------------
    # Keyword Auto-Reply Rules (fb-autoreply-pro Engine)
    # ---------------------------------------------------------
    def create_keyword_rule(
        self,
        rule_name: str,
        keywords: List[str],
        reply_templates: List[str],
        platform: str = "facebook",
        target_page_id: str = "1409644015561854",
        match_mode: str = "specific",
        send_private_dm: bool = False,
        dm_template: Optional[str] = None,
        toxic_filter: Optional[List[str]] = None
    ) -> int:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO keyword_rules (
                rule_name, platform, target_page_id, keywords_json, match_mode,
                reply_templates_json, send_private_dm, dm_template, toxic_filter_json,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);
            """, (
                rule_name, platform, target_page_id,
                json.dumps(keywords), match_mode,
                json.dumps(reply_templates), 1 if send_private_dm else 0,
                dm_template, json.dumps(toxic_filter or []),
                now_iso, now_iso
            ))
            conn.commit()
            return cursor.lastrowid

    def list_keyword_rules(self, platform: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if platform:
                cursor.execute("SELECT * FROM keyword_rules WHERE platform=? ORDER BY id DESC;", (platform,))
            else:
                cursor.execute("SELECT * FROM keyword_rules ORDER BY id DESC;")
            rows = cursor.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["keywords"] = json.loads(d.get("keywords_json") or "[]")
                d["reply_templates"] = json.loads(d.get("reply_templates_json") or "[]")
                d["toxic_filter"] = json.loads(d.get("toxic_filter_json") or "[]")
                results.append(d)
            return results

    def get_keyword_rule(self, rule_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM keyword_rules WHERE id=?;", (rule_id,))
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            d["keywords"] = json.loads(d.get("keywords_json") or "[]")
            d["reply_templates"] = json.loads(d.get("reply_templates_json") or "[]")
            d["toxic_filter"] = json.loads(d.get("toxic_filter_json") or "[]")
            return d

    def delete_keyword_rule(self, rule_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM keyword_rules WHERE id=?;", (rule_id,))
            conn.commit()
            return cursor.rowcount > 0

    def toggle_keyword_rule(self, rule_id: int, is_active: Optional[bool] = None) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if is_active is None:
                cursor.execute("UPDATE keyword_rules SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?;", (rule_id,))
            else:
                cursor.execute("UPDATE keyword_rules SET is_active=? WHERE id=?;", (1 if is_active else 0, rule_id))
            conn.commit()
            return cursor.rowcount > 0

    def match_keyword_rules(
        self,
        comment_text: str,
        commenter_name: str = "Friend",
        platform: str = "facebook",
        target_page_id: str = "1409644015561854",
        page_name: str = "Motivational Docqueen"
    ) -> Optional[Dict[str, Any]]:
        """
        Matches comment against active keyword rules using the 3 modes from fb-autoreply-pro:
        1. 'all': Blanket reply for any comment
        2. 'specific': Requires matching at least one keyword
        3. 'both': Specific reply if matched, else fallback default reply
        """
        if not comment_text:
            return None

        clean_text = comment_text.lower().strip()
        rules = self.list_keyword_rules(platform=platform)
        active_rules = [r for r in rules if r.get("is_active") == 1]

        # 1. Toxic / Spam check
        for rule in active_rules:
            toxic_words = rule.get("toxic_filter") or []
            for tw in toxic_words:
                if tw.lower() in clean_text:
                    logger.warning("[AutoReplyGuard] Comment flagged as toxic/spam by keyword '%s': '%s'", tw, comment_text)
                    return {
                        "action": "hide_or_flag",
                        "reason": f"Toxic keyword '{tw}' detected",
                        "comment_text": comment_text,
                        "rule_name": rule["rule_name"]
                    }

        # 2. Check for Specific keyword match first
        for rule in active_rules:
            keywords = rule.get("keywords") or []
            matched_kw = None
            for kw in keywords:
                pattern = rf"\b{re.escape(kw.lower())}\b"
                if re.search(pattern, clean_text) or kw.lower() in clean_text:
                    matched_kw = kw
                    break

            if matched_kw:
                templates = rule.get("reply_templates") or ["Thank you for reaching out!"]
                chosen_template = random.choice(templates)
                reply = chosen_template.replace("{name}", commenter_name).replace("{page_name}", page_name).replace("{trigger}", matched_kw)
                
                dm_reply = None
                if rule.get("send_private_dm") and rule.get("dm_template"):
                    dm_reply = rule["dm_template"].replace("{name}", commenter_name).replace("{page_name}", page_name).replace("{trigger}", matched_kw)

                return {
                    "action": "reply",
                    "mode": "specific",
                    "rule_id": rule["id"],
                    "rule_name": rule["rule_name"],
                    "matched_keyword": matched_kw,
                    "public_reply": reply,
                    "send_private_dm": bool(rule.get("send_private_dm")),
                    "private_dm_text": dm_reply
                }

        # 3. If no specific match, check for 'both' (smart fallback) or 'all' (blanket)
        for rule in active_rules:
            mode = rule.get("match_mode", "specific")
            if mode in ("all", "both"):
                templates = rule.get("reply_templates") or ["Thanks for engaging with our post!"]
                chosen_template = random.choice(templates)
                reply = chosen_template.replace("{name}", commenter_name).replace("{page_name}", page_name).replace("{trigger}", "comment")
                return {
                    "action": "reply",
                    "mode": mode,
                    "rule_id": rule["id"],
                    "rule_name": rule["rule_name"],
                    "matched_keyword": "DEFAULT_FALLBACK",
                    "public_reply": reply,
                    "send_private_dm": False,
                    "private_dm_text": None
                }

        return None

    def seed_default_keyword_rules(self):
        """Seeds standard high-converting keyword rules if empty."""
        rules = self.list_keyword_rules()
        if len(rules) == 0:
            self.create_keyword_rule(
                rule_name="Price & Cost Inquiry",
                keywords=["price", "cost", "how much", "rate", "fee", "koto", "dam koto", "charge"],
                reply_templates=[
                    "Hi {name}! Check your inbox — we just sent you the full details 🔥",
                    "Hey {name}, thanks for asking! Direct message sent with the complete breakdown 🚀",
                    "Hi {name}! Sent you a quick DM with the special offer link 📩"
                ],
                match_mode="specific",
                send_private_dm=True,
                dm_template="Hi {name}! Here is the complete information and access link from {page_name}: https://facebook.com/1409644015561854",
                toxic_filter=["scam", "fraud", "fake", "bad", "cheat", "bastard"]
            )
            self.create_keyword_rule(
                rule_name="Exam & Solution Questions",
                keywords=["answer", "solution", "how", "explain", "logic", "exam", "upsc", "cat", "gre"],
                reply_templates=[
                    "Brilliant observation, {name}! Did you notice the pattern in step 2? 💡",
                    "Great attempt {name}! Drop your final answer and see if anyone can beat your speed ⏱️",
                    "Spot on {name}! What was the hardest part of this puzzle for you? 🧠"
                ],
                match_mode="specific",
                send_private_dm=False,
                toxic_filter=["fuck", "shit", "spam"]
            )
            self.create_keyword_rule(
                rule_name="Viral Engagement Booster (Smart Both)",
                keywords=["love", "awesome", "great", "nice", "good", "super", "wow"],
                reply_templates=[
                    "Thank you so much, {name}! More high-iq challenges coming your way every hour 🚀",
                    "Appreciate the support {name}! Make sure to follow {page_name} for daily workouts 🧠",
                    "Glad you enjoyed this one, {name}! 💥"
                ],
                match_mode="both",
                send_private_dm=False,
                toxic_filter=["hate", "boring"]
            )
            logger.info("Seeded 3 default keyword auto-reply rules into SQLite.")

    # ---------------------------------------------------------
    # Cron Time Slots & Stale Recovery (Dashboard Engine)
    # ---------------------------------------------------------
    def save_cron_time_slot(self, slot_time: str, slot_label: str = "Engagement Slot", platform: str = "facebook", target_id: str = "1409644015561854") -> int:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO cron_time_slots (slot_time, slot_label, platform, target_id, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(slot_time) DO UPDATE SET
                slot_label=excluded.slot_label,
                is_active=1;
            """, (slot_time, slot_label, platform, target_id, now_iso))
            conn.commit()
            return cursor.lastrowid

    def list_cron_time_slots(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cron_time_slots WHERE is_active=1 ORDER BY slot_time ASC;")
            return [dict(r) for r in cursor.fetchall()]

    def delete_cron_time_slot(self, slot_time: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM cron_time_slots WHERE slot_time=?;", (slot_time,))
            conn.commit()
            return cursor.rowcount > 0

    def recover_stale_jobs(self, stale_minutes: int = 15) -> int:
        """
        Recovers jobs stuck in 'running' state past stale cutoff (from facebook-content-automation-dashboard).
        Resets them to 'queued' or 'failed' to prevent queue stalls.
        """
        cutoff_time = (datetime.now(timezone.utc) - timedelta(minutes=stale_minutes)).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE scheduled_jobs
            SET status='failed',
                error_message='Recovered stale running job past timeout threshold'
            WHERE status='running' AND schedule_time_iso <= ?;
            """, (cutoff_time,))
            recovered = cursor.rowcount
            conn.commit()
            if recovered > 0:
                logger.warning("Recovered %d stale running jobs.", recovered)
            return recovered


# Singleton database instance
db = Database()
db.seed_default_keyword_rules()

# Compatibility aliases
FacebookDatabase = Database

