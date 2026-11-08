"""
Autonomous Background Scheduler Loop for Scheduled Facebook Posts.
Periodically queries due jobs from SQLite and executes via FacebookController.
"""

import asyncio
import logging
import time
from typing import Optional
from .database import FacebookDatabase
from .facebook_controller import FacebookController

logger = logging.getLogger("FacebookScheduler")

class FacebookScheduler:
    def __init__(self, db: FacebookDatabase, controller: FacebookController):
        self.db = db
        self.controller = controller
        self.running = False
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self.running:
            self.running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info("Facebook Scheduler loop started.")

    def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()

    async def _run_loop(self):
        while self.running:
            try:
                due_jobs = self.db.get_due_jobs()
                for job in due_jobs:
                    job_id = job["job_id"]
                    post_id = job["post_id"]
                    caption = job.get("caption", "")
                    media_paths = []
                    try:
                        import json
                        media_paths = json.loads(job.get("media_paths") or "[]")
                    except Exception:
                        pass

                    post_type = job.get("post_type", "text")
                    target_type = job.get("target_type", "profile")
                    target_id = job.get("target_id")

                    logger.info("Scheduler executing job #%d for post #%d", job_id, post_id)
                    res = await self.controller.publish_post(
                        caption=caption,
                        media_paths=media_paths,
                        post_type=post_type,
                        target_type=target_type,
                        target_id=target_id
                    )

                    if res.get("success"):
                        self.db.update_job_status(job_id, "completed")
                    else:
                        err = res.get("error", "Execution failed")
                        self.db.update_job_status(job_id, "failed", last_error=err)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in scheduler loop: %s", e)

            await asyncio.sleep(10.0)
