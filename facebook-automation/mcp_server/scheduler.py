"""
Autonomous Background Scheduler Loop for Scheduled Facebook Posts.
Periodically queries due jobs from SQLite and executes via FacebookController.
Includes Zero-Loop One-Time Login Guard: if Facebook is not logged in yet,
jobs are held cleanly without burning retry attempts or entering an error loop.
"""

import asyncio
import json
import logging
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
                if due_jobs:
                    # Pre-flight login check before running due jobs
                    login_state = await self.controller.get_login_status()
                    if not login_state.get("logged_in"):
                        logger.info(
                            "Scheduler holding %d due job(s): waiting for one-time Facebook login.",
                            len(due_jobs)
                        )
                        await asyncio.sleep(30.0)
                        continue

                for job in due_jobs:
                    job_id = job["job_id"]
                    post_id = job["post_id"]
                    caption = job.get("caption", "")
                    media_paths = []
                    try:
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
                    elif res.get("action_required") == "ONE_TIME_LOGIN_REQUIRED":
                        logger.info("Job #%d paused awaiting one-time login.", job_id)
                        break
                    else:
                        err = res.get("error", "Execution failed")
                        self.db.update_job_status(job_id, "failed", last_error=err)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in scheduler loop: %s", e)

            await asyncio.sleep(15.0)
