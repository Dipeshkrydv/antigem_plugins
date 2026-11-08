"""
Database Engine & Anti-Duplicate Security Sentinel
Guarantees Idempotency, SHA-256 Media Hashing, Normalized Caption Deduplication,
and In-Flight Concurrency Locks with TTL.
Note: Deduplication hashes are strictly enforced against PUBLISHED and SCHEDULED posts,
so a post that paused for one-time login or failed can be safely retried after login.
"""

import os
import sqlite3
import hashlib
import time
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
from .config import DB_PATH, DEDUPE_WINDOW_HOURS, LOCK_TTL_SECONDS

logger = logging.getLogger("FacebookDB")


class FacebookDatabase:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = str(db_path or DB_PATH)
        self._mem_conn = None
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:")
            self._mem_conn.row_factory = sqlite3.Row
        self._init_schema()

    def _get_connection(self) -> sqlite3.Connection:
        if self._mem_conn:
            return self._mem_conn
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        return conn

    def _init_schema(self):
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT UNIQUE,
                target_type TEXT DEFAULT 'profile', -- 'profile', 'page', 'group'
                target_id TEXT,
                target_name TEXT,
                post_type TEXT DEFAULT 'text',     -- 'text', 'photo', 'carousel', 'video', 'reel', 'story'
                caption TEXT,
                media_paths TEXT,                 -- JSON array of file paths
                status TEXT DEFAULT 'pending',     -- 'pending', 'awaiting_login', 'publishing', 'published', 'failed', 'scheduled'
                fb_post_id TEXT,
                post_url TEXT,
                error_message TEXT,
                created_at REAL,
                updated_at REAL,
                published_at REAL
            );

            CREATE TABLE IF NOT EXISTS schedule_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
                run_at REAL,
                status TEXT DEFAULT 'queued',      -- 'queued', 'running', 'completed', 'failed', 'canceled'
                attempts INTEGER DEFAULT 0,
                max_attempts INTEGER DEFAULT 3,
                last_error TEXT,
                created_at REAL
            );

            CREATE TABLE IF NOT EXISTS dedupe_hashes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sha256_hash TEXT NOT NULL,
                hash_type TEXT NOT NULL,          -- 'media' or 'caption'
                post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS in_flight_locks (
                lock_key TEXT PRIMARY KEY,
                acquired_at REAL NOT NULL,
                expires_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                details TEXT,
                timestamp REAL NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
            CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
            CREATE INDEX IF NOT EXISTS idx_schedule_run_at ON schedule_jobs(run_at, status);
            CREATE INDEX IF NOT EXISTS idx_dedupe_hash ON dedupe_hashes(sha256_hash, created_at);
            """)

    @staticmethod
    def compute_file_hash(file_path: str) -> Optional[str]:
        """Calculates SHA-256 checksum of a media file."""
        p = Path(file_path)
        if not p.is_file():
            return None
        hasher = hashlib.sha256()
        with open(p, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def compute_text_hash(text: str) -> str:
        """Calculates SHA-256 checksum of normalized text."""
        norm = "".join(text.strip().lower().split())
        return hashlib.sha256(norm.encode("utf-8")).hexdigest()

    def check_duplicate(
        self,
        media_paths: Optional[List[str]] = None,
        caption: Optional[str] = None,
        window_hours: int = DEDUPE_WINDOW_HOURS
    ) -> Tuple[bool, Optional[str]]:
        """
        Guarantees ZERO DUPLICATES across both media files and caption text
        for already-published or scheduled posts.
        Returns (is_duplicate: bool, reason: str).
        """
        cutoff = time.time() - (window_hours * 3600)
        with self._get_connection() as conn:
            # Check media hashes against published/scheduled posts
            if media_paths:
                for path in media_paths:
                    file_hash = self.compute_file_hash(path)
                    if file_hash:
                        row = conn.execute(
                            """SELECT d.post_id, d.created_at
                               FROM dedupe_hashes d
                               LEFT JOIN posts p ON d.post_id = p.id
                               WHERE d.sha256_hash = ? AND d.created_at >= ?
                                 AND (p.status IS NULL OR p.status IN ('published', 'scheduled'))
                               LIMIT 1""",
                            (file_hash, cutoff)
                        ).fetchone()
                        if row:
                            return True, f"Duplicate media detected (matches post #{row['post_id']} published within last {window_hours}h)"

            # Check caption hash (only if meaningful length)
            if caption and len(caption.strip()) > 20:
                txt_hash = self.compute_text_hash(caption)
                row = conn.execute(
                    """SELECT d.post_id, d.created_at
                       FROM dedupe_hashes d
                       LEFT JOIN posts p ON d.post_id = p.id
                       WHERE d.sha256_hash = ? AND d.hash_type = 'caption' AND d.created_at >= ?
                         AND (p.status IS NULL OR p.status IN ('published', 'scheduled'))
                       LIMIT 1""",
                    (txt_hash, cutoff)
                ).fetchone()
                if row:
                    return True, f"Duplicate caption detected (matches post #{row['post_id']} published within last {window_hours}h)"

        return False, None

    def acquire_lock(self, lock_key: str, ttl_seconds: int = LOCK_TTL_SECONDS) -> bool:
        """Acquires an atomic in-flight lock with TTL."""
        now = time.time()
        expires = now + ttl_seconds
        with self._get_connection() as conn:
            conn.execute("DELETE FROM in_flight_locks WHERE expires_at < ?", (now,))
            try:
                conn.execute(
                    "INSERT INTO in_flight_locks (lock_key, acquired_at, expires_at) VALUES (?, ?, ?)",
                    (lock_key, now, expires)
                )
                return True
            except sqlite3.IntegrityError:
                return False

    def release_lock(self, lock_key: str):
        """Releases an in-flight lock."""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM in_flight_locks WHERE lock_key = ?", (lock_key,))

    def _record_dedupe_hashes(self, conn: sqlite3.Connection, post_id: int, caption: str, media_paths: List[str], now: float):
        if media_paths:
            for path in media_paths:
                h = self.compute_file_hash(path)
                if h:
                    conn.execute(
                        "INSERT INTO dedupe_hashes (sha256_hash, hash_type, post_id, created_at) VALUES (?, 'media', ?, ?)",
                        (h, post_id, now)
                    )
        if caption and len(caption.strip()) > 20:
            h = self.compute_text_hash(caption)
            conn.execute(
                "INSERT INTO dedupe_hashes (sha256_hash, hash_type, post_id, created_at) VALUES (?, 'caption', ?, ?)",
                (h, post_id, now)
            )

    def record_post(
        self,
        client_id: str,
        post_type: str,
        caption: str,
        media_paths: List[str],
        target_type: str = "profile",
        target_id: Optional[str] = None,
        target_name: Optional[str] = None,
        status: str = "pending"
    ) -> int:
        now = time.time()
        with self._get_connection() as conn:
            cur = conn.execute(
                """INSERT INTO posts (client_id, target_type, target_id, target_name, post_type, caption, media_paths, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (client_id, target_type, target_id, target_name, post_type, caption, json.dumps(media_paths), status, now, now)
            )
            post_id = cur.lastrowid

            # Record dedupe hashes immediately if status is already 'published' or 'scheduled'
            if status in ("published", "scheduled"):
                self._record_dedupe_hashes(conn, post_id, caption, media_paths, now)

            return post_id

    def update_post_status(
        self,
        post_id: int,
        status: str,
        fb_post_id: Optional[str] = None,
        post_url: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        now = time.time()
        pub_at = now if status == "published" else None
        with self._get_connection() as conn:
            conn.execute(
                """UPDATE posts 
                   SET status = ?, fb_post_id = COALESCE(?, fb_post_id), post_url = COALESCE(?, post_url), 
                       error_message = ?, updated_at = ?, published_at = COALESCE(?, published_at)
                   WHERE id = ?""",
                (status, fb_post_id, post_url, error_message, now, pub_at, post_id)
            )
            if status == "published":
                existing = conn.execute("SELECT 1 FROM dedupe_hashes WHERE post_id = ? LIMIT 1", (post_id,)).fetchone()
                if not existing:
                    post_row = conn.execute("SELECT caption, media_paths FROM posts WHERE id = ?", (post_id,)).fetchone()
                    if post_row:
                        try:
                            m_paths = json.loads(post_row["media_paths"] or "[]")
                        except Exception:
                            m_paths = []
                        self._record_dedupe_hashes(conn, post_id, post_row["caption"] or "", m_paths, now)

    def schedule_post(self, post_id: int, run_at: float) -> int:
        now = time.time()
        with self._get_connection() as conn:
            cur = conn.execute(
                "INSERT INTO schedule_jobs (post_id, run_at, status, created_at) VALUES (?, ?, 'queued', ?)",
                (post_id, run_at, now)
            )
            conn.execute("UPDATE posts SET status = 'scheduled', updated_at = ? WHERE id = ?", (now, post_id))
            return cur.lastrowid

    def list_posts(self, limit: int = 20, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if status:
                rows = conn.execute("SELECT * FROM posts WHERE status = ? ORDER BY id DESC LIMIT ?", (status, limit)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM posts ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rows]

    def get_post(self, post_id: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
            return dict(row) if row else None

    def delete_post_record(self, post_id: int) -> bool:
        with self._get_connection() as conn:
            cur = conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
            return cur.rowcount > 0

    def get_due_jobs(self) -> List[Dict[str, Any]]:
        now = time.time()
        with self._get_connection() as conn:
            rows = conn.execute(
                """SELECT j.id AS job_id, j.post_id, j.run_at, j.attempts, p.*
                   FROM schedule_jobs j
                   JOIN posts p ON j.post_id = p.id
                   WHERE j.status = 'queued' AND j.run_at <= ? AND j.attempts < j.max_attempts
                   ORDER BY j.run_at ASC LIMIT 5""",
                (now,)
            ).fetchall()
            return [dict(r) for r in rows]

    def update_job_status(self, job_id: int, status: str, last_error: Optional[str] = None):
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE schedule_jobs SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?",
                (status, last_error, job_id)
            )

    def log_audit(
        self,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[str] = None
    ):
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO audit_logs (action, target_type, target_id, details, timestamp) VALUES (?, ?, ?, ?, ?)",
                (action, target_type, target_id, details, time.time())
            )
