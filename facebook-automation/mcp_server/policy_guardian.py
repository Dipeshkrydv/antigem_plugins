"""
Policy Guardian & Account Safety Sentinel
Enforces anti-burst spacing, daily post ceiling, humanization delays,
and detects Facebook checkpoint/block notices.
"""

import time
import random
import logging
from typing import Dict, Any, Tuple
from .config import MAX_POSTS_PER_DAY, MIN_POST_INTERVAL_SECONDS
from .database import FacebookDatabase

logger = logging.getLogger("PolicyGuardian")

class PolicyGuardian:
    def __init__(self, db: FacebookDatabase):
        self.db = db
        self.last_action_time = 0.0
        self.consecutive_errors = 0
        self.blocked_mode = False

    def can_publish(self) -> Tuple[bool, str]:
        """Validates if action can proceed safely under Facebook's algorithmic rules."""
        if self.blocked_mode:
            return False, "Sentinel Lock Active: Facebook returned a checkpoint or block warning. Automation paused for safety."

        now = time.time()
        elapsed = now - self.last_action_time
        if self.last_action_time > 0 and elapsed < MIN_POST_INTERVAL_SECONDS:
            wait_time = int(MIN_POST_INTERVAL_SECONDS - elapsed)
            return False, f"Anti-Burst Protection: Please wait {wait_time}s before publishing again."

        # Check daily ceiling
        today_start = now - (now % 86400)
        recent = self.db.list_posts(limit=100)
        today_posts = [p for p in recent if (p.get("published_at") or 0) >= today_start and p.get("status") == "published"]
        if len(today_posts) >= MAX_POSTS_PER_DAY:
            return False, f"Daily Ceiling Reached: {len(today_posts)}/{MAX_POSTS_PER_DAY} posts today. Pausing to protect account reputation."

        return True, "OK"

    def record_action(self):
        """Records timestamp of completed action."""
        self.last_action_time = time.time()
        self.consecutive_errors = 0

    def record_error(self, error_message: str):
        """Tracks consecutive errors and evaluates block risk."""
        self.consecutive_errors += 1
        msg = error_message.lower()
        block_signals = [
            "checkpoint", "temporarily blocked", "unusual activity", 
            "confirm your identity", "restricted from posting", "action blocked"
        ]
        if any(sig in msg for sig in block_signals):
            self.blocked_mode = True
            logger.critical("SENTINEL TRIP: Detected Facebook account block signal: %s", error_message)

    def human_delay(self, min_sec: float = 1.2, max_sec: float = 2.8):
        """Adaptive randomized micro-jitter to prevent mechanical bot fingerprinting."""
        delay = random.uniform(min_sec, max_sec)
        time.sleep(delay)
