"""
Antigravity Meta Suite - Local WebSocket Bridge Server
Communicates with Chrome Extension (meta-bridge-ext) over ws://127.0.0.1:8765.
Relays live session cookies/tokens into SQLite and executes DOM automation commands.
"""

import time
import json
import uuid
import asyncio
import logging
from typing import Any, Dict, Optional, Set
import websockets
from websockets.server import WebSocketServerProtocol

from mcp_server.database import Database, db

logger = logging.getLogger("meta_suite.bridge_server")

DEFAULT_WS_HOST = "127.0.0.1"
DEFAULT_WS_PORT = 8765


def _is_ws_open(ws) -> bool:
    if ws is None:
        return False
    state = getattr(ws, "state", None)
    if state is not None:
        return getattr(state, "name", "") == "OPEN" or state == 1
    return bool(getattr(ws, "open", False))


class BridgeServer:
    """Manages WebSocket connection to the Chrome Extension bridge."""

    def __init__(self, host: str = DEFAULT_WS_HOST, port: int = DEFAULT_WS_PORT, database: Optional[Database] = None):
        self.host = host
        self.port = port
        self.db = database or db
        self.clients: Set[WebSocketServerProtocol] = set()
        self.extension_clients: Set[WebSocketServerProtocol] = set()
        self.relay_clients: Set[WebSocketServerProtocol] = set()
        self.pending_actions: Dict[str, asyncio.Future] = {}
        self.server = None
        self._server_task: Optional[asyncio.Task] = None
        self._is_running = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.discovered_pages: List[Dict[str, Any]] = []

    async def start(self):
        """Starts the WebSocket server."""
        if self._is_running:
            return
        self.loop = asyncio.get_running_loop()
        self.server = await websockets.serve(self._handle_client, self.host, self.port, max_size=100 * 1024 * 1024)
        self._is_running = True
        logger.info("Bridge WebSocket server listening on ws://%s:%d", self.host, self.port)

    async def stop(self):
        """Stops the WebSocket server and cancels pending futures."""
        if not self._is_running:
            return
        self._is_running = False
        for client in list(self.clients):
            await client.close()
        self.clients.clear()
        self.extension_clients.clear()
        self.relay_clients.clear()
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        for fut in self.pending_actions.values():
            if not fut.done():
                fut.cancel()
        self.pending_actions.clear()
        self.loop = None
        logger.info("Bridge WebSocket server stopped.")

    def is_connected(self) -> bool:
        if any(_is_ws_open(c) for c in self.extension_clients):
            return True
        if any(_is_ws_open(c) and c not in self.relay_clients for c in self.clients):
            return True
        import socket
        try:
            with socket.create_connection(("127.0.0.1", 8765), timeout=0.5):
                return True
        except (OSError, ConnectionRefusedError):
            return False

    def get_client_count(self) -> int:
        return len(self.clients)

    async def _handle_client(self, websocket: WebSocketServerProtocol):
        self.clients.add(websocket)
        client_addr = websocket.remote_address
        origin = ""
        if hasattr(websocket, "request") and websocket.request and hasattr(websocket.request, "headers"):
            origin = websocket.request.headers.get("origin", "") or websocket.request.headers.get("Origin", "")
        elif hasattr(websocket, "request_headers") and websocket.request_headers:
            origin = websocket.request_headers.get("Origin", "") or websocket.request_headers.get("origin", "")

        if origin.startswith("chrome-extension://"):
            self.extension_clients.add(websocket)
            self.relay_clients.discard(websocket)
            logger.info("Chrome Extension bridge client connected from %s (origin=%s)", client_addr, origin)
        else:
            logger.info("Bridge client connected from %s (origin=%s)", client_addr, origin)

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._route_message(websocket, data)
                except Exception as e:
                    logger.error("Error processing message from client %s: %s", client_addr, e)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Bridge client disconnected from %s", client_addr)
        finally:
            self.clients.discard(websocket)
            self.extension_clients.discard(websocket)
            self.relay_clients.discard(websocket)

    async def _route_message(self, websocket: WebSocketServerProtocol, data: Dict[str, Any]):
        msg_type = data.get("type")

        # 1. Session Sync from Extension
        if msg_type == "SESSION_SYNC":
            self.extension_clients.add(websocket)
            self.relay_clients.discard(websocket)
            platform = data.get("platform")
            account_id = data.get("account_id")
            username = data.get("username")
            cookies = data.get("cookies", {})
            tokens = data.get("tokens", {})
            user_agent = data.get("user_agent")
            status = data.get("status", "healthy")
            pages = data.get("pages", [])
            if isinstance(pages, list) and len(pages) > 0:
                self.discovered_pages = pages
                if isinstance(tokens, dict):
                    tokens["pages"] = pages

            if platform and account_id:
                self.db.save_session(
                    platform=platform,
                    account_id=str(account_id),
                    username=username,
                    cookies=cookies,
                    tokens=tokens,
                    user_agent=user_agent,
                    status=status
                )
                logger.info("Successfully updated live session in SQLite: %s (%s, user=%s, status=%s)", platform, account_id, username, status)
                # Acknowledge sync
                await websocket.send(json.dumps({"type": "SYNC_ACK", "platform": platform, "account_id": account_id}))

        # 2. DOM Command Result from Extension
        elif msg_type in ("DOM_RESULT", "DOM_ACTION_RESULT"):
            self.extension_clients.add(websocket)
            self.relay_clients.discard(websocket)
            action_id = data.get("id")
            if action_id and action_id in self.pending_actions:
                fut = self.pending_actions.pop(action_id)
                if not fut.done():
                    if data.get("status") == "success":
                        fut.set_result(data.get("data", {}))
                    else:
                        fut.set_exception(RuntimeError(data.get("error", "Unknown DOM action failure")))

        # 3. Emergency Pause Toggle from Popup
        elif msg_type == "EMERGENCY_PAUSE_TOGGLE":
            paused = bool(data.get("paused", False))
            self.db.set_all_jobs_pause_state(paused)
            logger.warning("Emergency pause toggled by user via Extension popup: paused=%s", paused)
            await self.broadcast_event("QUEUE_PAUSED", {"paused": paused})

        # 3b. Supervisor Hard Lock triggered by Meta Block screen
        elif msg_type == "SUPERVISOR_HARD_LOCK":
            phrase = data.get("phrase", "Meta restriction screen")
            acc_id = data.get("account_id", "me")
            logger.critical("SUPERVISOR HARD LOCK received from extension! Reason: %s (Account: %s)", phrase, acc_id)
            self.db.set_all_jobs_pause_state(True)
            with self.db.get_connection() as conn:
                c = conn.cursor()
                c.execute("UPDATE sessions SET status='cooldown_24h' WHERE account_id=?;", (acc_id,))
                c.execute("UPDATE scheduled_jobs SET status='cancelled', error_message='Halted due to Meta Action Block' WHERE status='pending' AND target_type='profile';")
                conn.commit()
            await self.broadcast_event("QUEUE_PAUSED", {"paused": True, "reason": phrase})

        # 4. Fetch Queue & Sessions for Side Panel
        elif msg_type == "GET_QUEUE":
            limit = data.get("limit", 50)
            jobs = self.db.list_upcoming_jobs(limit=limit)
            sessions = self.db.list_all_sessions()
            await websocket.send(json.dumps({
                "type": "QUEUE_DATA",
                "id": data.get("id"),
                "jobs": jobs,
                "sessions": sessions
            }))

        # 5. Create Job from Side Panel Composer
        elif msg_type == "CREATE_JOB":
            try:
                import os
                import base64
                import time
                from datetime import datetime, timezone
                from mcp_server.free_media_seo import FreeMediaEngine

                job_data = data.get("job", {})
                platform = job_data.get("platform", "facebook")
                target_type = job_data.get("target_type", "profile")
                target_id = job_data.get("target_id")
                content_type = job_data.get("content_type", "photo")
                payload = job_data.get("payload", {})
                schedule_time = job_data.get("schedule_time_iso")
                if not schedule_time:
                    schedule_time = datetime.now(timezone.utc).isoformat()

                # Handle base64 media upload from Side Panel
                base64_data = payload.get("base64_data")
                if base64_data:
                    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
                    os.makedirs(assets_dir, exist_ok=True)
                    ext = ".jpg"
                    if payload.get("is_video") or (payload.get("mime_type") and "video" in payload.get("mime_type")):
                        ext = ".mp4"
                    elif payload.get("mime_type") and "png" in payload.get("mime_type"):
                        ext = ".png"
                    file_name = payload.get("file_name") or f"upload_{int(time.time())}{ext}"
                    file_path = os.path.join(assets_dir, file_name)
                    with open(file_path, "wb") as f_out:
                        f_out.write(base64.b64decode(base64_data))
                    payload["media_paths"] = [file_path]
                    # Purge multi-megabyte base64 string from payload to prevent SQLite db bloat
                    payload.pop("base64_data", None)
                    logger.info("Saved Side Panel uploaded media to %s", file_path)
                else:
                    payload.pop("base64_data", None)

                # Handle base64 thumbnail/cover upload from Side Panel
                thumb_base64 = payload.get("thumbnail_base64")
                if thumb_base64:
                    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
                    os.makedirs(assets_dir, exist_ok=True)
                    t_ext = ".jpg"
                    if payload.get("thumbnail_mime_type") and "png" in payload.get("thumbnail_mime_type"):
                        t_ext = ".png"
                    t_name = payload.get("thumbnail_file_name") or f"thumb_{int(time.time())}{t_ext}"
                    t_path = os.path.join(assets_dir, t_name)
                    with open(t_path, "wb") as f_out:
                        f_out.write(base64.b64decode(thumb_base64))
                    payload["thumbnail_path"] = t_path
                    payload.pop("thumbnail_base64", None)
                    logger.info("Saved Side Panel uploaded thumbnail to %s", t_path)
                else:
                    payload.pop("thumbnail_base64", None)

                # Platform-specific conforms
                if platform == "instagram":
                    # Instagram requires a media file
                    if not payload.get("media_paths"):
                        logger.info("No media provided for Instagram. Auto-generating compliant graphic.")
                        cap = payload.get("caption") or "Meta Suite Automation"
                        gen_img = FreeMediaEngine.generate_image(
                            title_overlay=cap[:35],
                            subtitle_overlay="Antigravity Meta Suite"
                        )
                        payload["media_paths"] = [gen_img]
                        content_type = "photo"
                elif platform == "facebook":
                    # If Facebook photo selected but no media provided, treat as text post
                    if content_type == "photo" and not payload.get("media_paths"):
                        content_type = "text"

                job_id = self.db.create_scheduled_job(
                    platform=platform,
                    target_type=target_type,
                    target_id=target_id,
                    content_type=content_type,
                    payload=payload,
                    schedule_time_iso=schedule_time
                )
                logger.info("Created scheduled job #%d from Side Panel (%s:%s)", job_id, platform, content_type)
                await websocket.send(json.dumps({
                    "type": "ACTION_ACK",
                    "id": data.get("id"),
                    "action": "CREATE_JOB",
                    "job_id": job_id,
                    "success": True
                }))
                await self.broadcast_event("JOB_CREATED", {"job_id": job_id})

                # If immediate publish requested, trigger scheduler tick immediately
                if payload.get("bypass_spacing") or payload.get("auto_publish"):
                    try:
                        import threading
                        from mcp_server.scheduler_engine import scheduler
                        threading.Thread(target=scheduler.tick, daemon=True).start()
                    except Exception as ex_tick:
                        logger.warning("Could not trigger immediate scheduler tick: %s", ex_tick)
            except Exception as e:
                logger.error("Failed to create job from Side Panel: %s", e)
                await websocket.send(json.dumps({
                    "type": "ACTION_ACK",
                    "id": data.get("id"),
                    "action": "CREATE_JOB",
                    "error": str(e),
                    "success": False
                }))

        # 6. Retry Job from Side Panel
        elif msg_type == "RETRY_JOB":
            job_id = data.get("job_id")
            if job_id:
                from datetime import datetime, timezone
                now_iso = datetime.now(timezone.utc).isoformat()
                self.db.reset_job_retry_count(job_id)
                self.db.reschedule_job(job_id, now_iso, error_message=None, increment_retry=False)
                logger.info("Reset and rescheduled Job #%s for retry from Side Panel", job_id)
                await websocket.send(json.dumps({
                    "type": "ACTION_ACK",
                    "id": data.get("id"),
                    "action": "RETRY_JOB",
                    "job_id": job_id,
                    "success": True
                }))
                await self.broadcast_event("JOB_UPDATED", {"job_id": job_id, "status": "pending"})

        # 7. Cancel Job from Side Panel
        elif msg_type == "CANCEL_JOB":
            job_id = data.get("job_id")
            if job_id:
                self.db.update_job_status(job_id, status="cancelled")
                logger.info("Cancelled Job #%s from Side Panel", job_id)
                await websocket.send(json.dumps({
                    "type": "ACTION_ACK",
                    "id": data.get("id"),
                    "action": "CANCEL_JOB",
                    "job_id": job_id,
                    "success": True
                }))
                await self.broadcast_event("JOB_UPDATED", {"job_id": job_id, "status": "cancelled"})

        # 8. Clear Jobs from Side Panel
        elif msg_type == "CLEAR_JOBS":
            statuses = data.get("statuses", ["completed", "failed", "cancelled"])
            count = self.db.clear_jobs(statuses=statuses)
            logger.info("Purged %d jobs with status in %s from Side Panel", count, statuses)
            await websocket.send(json.dumps({
                "type": "ACTION_ACK",
                "id": data.get("id"),
                "action": "CLEAR_JOBS",
                "count": count,
                "success": True
            }))
            await self.broadcast_event("QUEUE_CLEARED", {"count": count})

        # 9. Trigger Extension Reload from CLI / Remote
        elif msg_type == "TRIGGER_EXTENSION_RELOAD":
            logger.info("Broadcasting RELOAD_EXTENSION to all connected Chrome Extension workers...")
            for client in list(self.clients):
                try:
                    await client.send(json.dumps({"type": "RELOAD_EXTENSION"}))
                except Exception:
                    pass
            await websocket.send(json.dumps({"type": "ACTION_ACK", "action": "TRIGGER_EXTENSION_RELOAD", "success": True}))

        # 9b. Relay DOM Action from CLI / Remote directly to Chrome Extension
        elif msg_type in ("RELAY_DOM_ACTION", "EXECUTE_DOM_ACTION"):
            self.relay_clients.add(websocket)
            self.extension_clients.discard(websocket)
            instruction = data.get("instruction")
            params = data.get("params", {})
            action_id = data.get("id") or str(uuid.uuid4())
            action_timeout = float(data.get("timeout", 90.0))

            try:
                result = await self.dispatch_dom_action(instruction, params, timeout=action_timeout)
                await websocket.send(json.dumps({
                    "type": "DOM_ACTION_RESULT",
                    "id": action_id,
                    "status": "success",
                    "data": result
                }))
            except Exception as e:
                logger.error("Failed executing relayed DOM action '%s': %s", instruction, e)
                await websocket.send(json.dumps({
                    "type": "DOM_ACTION_RESULT",
                    "id": action_id,
                    "status": "error",
                    "error": str(e)
                }))

        # 10. Creative Director Archetypes & Prompt Builder
        elif msg_type == "GET_CREATIVE_ARCHETYPES":
            from mcp_server.creative_director import CreativeDirector
            archetypes = CreativeDirector.get_archetypes()
            await websocket.send(json.dumps({
                "type": "CREATIVE_ARCHETYPES",
                "id": data.get("id"),
                "archetypes": archetypes
            }))

        elif msg_type == "BUILD_CREATIVE_PROMPT":
            from mcp_server.creative_director import CreativeDirector
            prompt = CreativeDirector.build_prompt(
                archetype=data.get("archetype", "tactile_clipboard"),
                headline=data.get("headline", ""),
                tagline=data.get("tagline", ""),
                body_points=data.get("body_points"),
                keys=data.get("keys", "CTRL + S"),
                badge=data.get("badge", "Mastery"),
                surreal_scene=data.get("surreal_scene")
            )
            await websocket.send(json.dumps({
                "type": "CREATIVE_PROMPT_BUILT",
                "id": data.get("id"),
                "prompt": prompt
            }))

        # 11. Open Canvas from Side Panel / Remote
        elif msg_type == "OPEN_CANVAS":
            import time
            platform = data.get("platform", "facebook")
            urls = {
                "facebook": "https://www.facebook.com/",
                "instagram": "https://www.instagram.com/",
                "business_suite": "https://business.facebook.com/latest/composer"
            }
            target_url = urls.get(platform, "https://www.facebook.com/")
            for client in list(self.clients):
                try:
                    await client.send(json.dumps({
                        "type": "DOM_INSTRUCTION",
                        "id": f"open_{int(time.time())}",
                        "instruction": "OPEN_OR_FOCUS_TAB",
                        "params": {"url": target_url, "platform": platform}
                    }))
                except Exception:
                    pass
            await websocket.send(json.dumps({"type": "ACTION_ACK", "action": "OPEN_CANVAS", "platform": platform, "success": True}))

        # 12. Logout Account from Side Panel / Remote
        elif msg_type == "LOGOUT_ACCOUNT":
            import time
            platform = data.get("platform", "all")
            account_id = data.get("account_id")
            self.db.delete_session(platform, account_id)
            logger.info("Logged out session for platform: %s (account: %s)", platform, account_id)
            for client in list(self.clients):
                if client != websocket:
                    try:
                        await client.send(json.dumps({
                            "type": "DOM_INSTRUCTION",
                            "id": f"logout_{int(time.time())}",
                            "instruction": "LOGOUT_PLATFORM",
                            "params": {"platform": platform}
                        }))
                    except Exception:
                        pass
            await websocket.send(json.dumps({
                "type": "ACTION_ACK",
                "action": "LOGOUT_ACCOUNT",
                "platform": platform,
                "success": True
            }))
            await self.broadcast_event("SESSION_LOGGED_OUT", {"platform": platform, "account_id": account_id})

        elif msg_type == "PING":
            import time
            try:
                await websocket.send(json.dumps({"type": "PONG", "timestamp": time.time()}))
            except Exception:
                pass

        # 13. Trend Reach Scanner (YouTube, Twitter, Reddit, GitHub - No Bilibili)
        elif msg_type == "TREND_SCAN":
            from mcp_server.trend_reach_engine import trend_engine
            keywords = data.get("keywords", "Social Media Growth")
            sources = data.get("sources")
            competitor_channel = data.get("competitor_channel")
            min_score = float(data.get("min_viral_score", 40.0))
            limit = int(data.get("limit", 15))

            try:
                result = trend_engine.scan_all_trends(
                    keywords=keywords,
                    sources=sources,
                    competitor_channel=competitor_channel,
                    min_viral_score=min_score,
                    limit=limit
                )
                await websocket.send(json.dumps({
                    "type": "TREND_SCAN_RESULTS",
                    "id": data.get("id"),
                    "data": result
                }))
            except Exception as e:
                logger.error("Trend scan error: %s", e)
                await websocket.send(json.dumps({
                    "type": "TREND_SCAN_RESULTS",
                    "id": data.get("id"),
                    "error": str(e),
                    "data": {"status": "error", "message": str(e), "trends": []}
                }))

        # 14. Competitor Spy & Content Gap Discovery
        elif msg_type == "COMPETITOR_SPY":
            from mcp_server.trend_reach_engine import trend_engine
            target = data.get("target_channel_or_niche", "creator")
            platform = data.get("platform", "youtube")

            try:
                result = trend_engine.spy_competitor_channels(
                    target_channel_or_niche=target,
                    platform=platform
                )
                await websocket.send(json.dumps({
                    "type": "COMPETITOR_SPY_RESULTS",
                    "id": data.get("id"),
                    "data": result
                }))
            except Exception as e:
                logger.error("Competitor spy error: %s", e)
                await websocket.send(json.dumps({
                    "type": "COMPETITOR_SPY_RESULTS",
                    "id": data.get("id"),
                    "error": str(e),
                    "data": {"status": "error", "message": str(e)}
                }))

        # 15. Transform Trend to Meta Growth Post
        elif msg_type == "TRANSFORM_GROWTH_POST":
            from mcp_server.trend_reach_engine import MetaGrowthTransformer
            trend_item = data.get("trend_item", {})
            target_platform = data.get("target_platform", "both")
            content_type = data.get("content_type", "reel")
            archetype = data.get("creative_archetype", "tactile_clipboard")

            try:
                result = MetaGrowthTransformer.transform_trend_to_post(
                    trend_item=trend_item,
                    target_platform=target_platform,
                    content_type=content_type,
                    creative_archetype=archetype
                )
                await websocket.send(json.dumps({
                    "type": "GROWTH_POST_RESULT",
                    "id": data.get("id"),
                    "data": result
                }))
            except Exception as e:
                logger.error("Transform growth post error: %s", e)
                await websocket.send(json.dumps({
                    "type": "GROWTH_POST_RESULT",
                    "id": data.get("id"),
                    "error": str(e)
                }))

        # 16. Pre-Post Competitor SEO & Anti-Boring Viral Optimizer
        elif msg_type == "OPTIMIZE_PRE_POST":
            from mcp_server.trend_reach_engine import pre_post_optimizer
            concept = data.get("draft_concept", "Social Media AI Breakthrough")
            platform = data.get("target_platform", "both")
            content_type = data.get("content_type", "reel")
            archetype = data.get("creative_archetype", "keyboard_shortcut")

            try:
                result = pre_post_optimizer.analyze_and_optimize(
                    draft_concept=concept,
                    target_platform=platform,
                    content_type=content_type,
                    creative_archetype=archetype
                )
                await websocket.send(json.dumps({
                    "type": "PRE_POST_OPTIMIZED_RESULT",
                    "id": data.get("id"),
                    "data": result
                }))
            except Exception as e:
                logger.error("Pre-post optimization error: %s", e)
                await websocket.send(json.dumps({
                    "type": "PRE_POST_OPTIMIZED_RESULT",
                    "id": data.get("id"),
                    "error": str(e)
                }))

        # 17. Auto-Reply Rules Listing
        elif msg_type == "GET_AUTOREPLY_RULES":
            platform = data.get("platform")
            rules = self.db.list_keyword_rules(platform=platform)
            await websocket.send(json.dumps({
                "type": "AUTOREPLY_RULES_DATA",
                "id": data.get("id"),
                "rules": rules
            }))

        # 18. Auto-Reply Rule Testing
        elif msg_type == "TEST_AUTOREPLY_RULE":
            comment = data.get("comment", "")
            user = data.get("commenter_name", "Ahmed")
            platform = data.get("platform", "facebook")
            match_res = self.db.match_keyword_rules(
                comment_text=comment,
                commenter_name=user,
                platform=platform,
                target_page_id="me",
                page_name="Facebook Page"
            )
            await websocket.send(json.dumps({
                "type": "AUTOREPLY_TEST_RESULT",
                "id": data.get("id"),
                "data": match_res
            }))

        # 19. Run Autonomous Auto-Reply Cycle
        elif msg_type == "RUN_AUTOREPLY_CYCLE":
            from mcp_server.autoreply_engine import autoreply_engine
            res = autoreply_engine.run_auto_reply_cycle(
                platform=data.get("platform", "facebook"),
                page_id=data.get("page_id", "me"),
                limit_posts=data.get("limit_posts", 5),
                max_replies_per_cycle=data.get("max_replies", 20),
                dry_run=data.get("dry_run", True)
            )
            await websocket.send(json.dumps({
                "type": "AUTOREPLY_CYCLE_RESULT",
                "id": data.get("id"),
                "data": res
            }))

        # 20. Senior SMM 2026 Meta Algorithm Audit
        elif msg_type == "AUDIT_POST_ALGORITHM":
            from mcp_server.algorithm_manager import smm_manager
            res = smm_manager.audit_post(
                caption=data.get("caption", ""),
                media_type=data.get("media_type", "post"),
                platform=data.get("platform", "facebook")
            )
            await websocket.send(json.dumps({
                "type": "POST_AUDIT_RESULT",
                "id": data.get("id"),
                "data": res
            }))

        # 21. Daily Cron Slots & Peak Timing
        elif msg_type == "GET_CRON_SLOTS":
            from mcp_server.algorithm_manager import smm_manager
            slots = self.db.list_cron_time_slots()
            peak_slots = smm_manager.get_optimal_posting_slots()
            await websocket.send(json.dumps({
                "type": "CRON_SLOTS_DATA",
                "id": data.get("id"),
                "slots": slots,
                "peak_windows": peak_slots
            }))

        # 22. Stale Jobs Recovery
        elif msg_type == "RECOVER_STALE_JOBS":
            recovered = self.db.recover_stale_jobs(stale_minutes=data.get("stale_minutes", 15))
            await websocket.send(json.dumps({
                "type": "STALE_RECOVERED_RESULT",
                "id": data.get("id"),
                "recovered_count": recovered
            }))
            if recovered > 0:
                await self.broadcast_event("JOB_UPDATED", {"recovered_count": recovered})

        elif msg_type == "PONG":
            logger.debug("Received heartbeat PONG from extension.")

    async def broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcasts a live event packet to all connected extension clients."""
        import time
        packet = json.dumps({
            "type": "BROADCAST_EVENT",
            "event": event_type,
            "data": data,
            "timestamp": time.time()
        })
        for client in list(self.clients):
            try:
                await client.send(packet)
            except Exception:
                pass

    async def broadcast_log(self, level: str, message: str):
        """Broadcasts live console log to connected Side Panel clients."""
        import time
        packet = json.dumps({
            "type": "LOG_STREAM",
            "level": level,
            "message": message,
            "timestamp": time.time()
        })
        for client in list(self.clients):
            try:
                await client.send(packet)
            except Exception:
                pass

    # -------------------------------------------------------------
    # DOM Instruction Dispatcher
    # -------------------------------------------------------------
    async def dispatch_dom_action(
        self,
        instruction: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Sends step-by-step DOM instruction to connected Chrome Extension
        and awaits the asynchronous execution result.
        If in a separate process, connects as client to ws://127.0.0.1:8765.
        """
        # Case A: We are the server hosting connected extension clients
        target_clients = [c for c in self.extension_clients if _is_ws_open(c)]
        if not target_clients:
            target_clients = [c for c in self.clients if _is_ws_open(c) and c not in self.relay_clients]

        if len(target_clients) > 0:
            action_id = str(uuid.uuid4())
            loop = self.loop or asyncio.get_running_loop()
            future = loop.create_future()
            self.pending_actions[action_id] = future

            packet = {
                "type": "DOM_INSTRUCTION",
                "id": action_id,
                "instruction": instruction,
                "params": params or {}
            }

            msg_str = json.dumps(packet)
            sent = False
            for client in list(target_clients):
                try:
                    await client.send(msg_str)
                    sent = True
                    logger.info("Dispatched DOM instruction '%s' (id=%s) to Chrome Extension client %s", instruction, action_id, client.remote_address)
                    break
                except Exception as e:
                    logger.warning("Failed sending DOM instruction to client %s: %s", client.remote_address, e)

            if not sent:
                self.pending_actions.pop(action_id, None)
                raise ConnectionError("Failed to send DOM instruction: no active extension clients available.")

            try:
                result = await asyncio.wait_for(future, timeout=timeout)
                return result
            except asyncio.TimeoutError:
                self.pending_actions.pop(action_id, None)
                raise TimeoutError(f"DOM instruction '{instruction}' timed out after {timeout}s.")
            except Exception as e:
                self.pending_actions.pop(action_id, None)
                raise e

        # Case B: We are in a separate process (CLI, external task, etc.)
        # Connect as a client to the running bridge server on ws://127.0.0.1:8765
        import socket
        try:
            with socket.create_connection(("127.0.0.1", 8765), timeout=0.5):
                pass
        except (OSError, ConnectionRefusedError):
            raise ConnectionError(
                "Chrome Extension is not connected to ws://127.0.0.1:8765. "
                "Ensure Chrome is running with Antigravity Meta Bridge loaded."
            )

        action_id = str(uuid.uuid4())
        relay_packet = {
            "type": "EXECUTE_DOM_ACTION",
            "id": action_id,
            "instruction": instruction,
            "params": params or {},
            "timeout": timeout
        }

        try:
            async with websockets.connect("ws://127.0.0.1:8765", ping_interval=None) as ws:
                await ws.send(json.dumps(relay_packet))
                while True:
                    raw_msg = await asyncio.wait_for(ws.recv(), timeout=timeout + 5.0)
                    resp = json.loads(raw_msg)
                    if resp.get("type") == "DOM_ACTION_RESULT" and resp.get("id") == action_id:
                        if resp.get("status") == "success":
                            return resp.get("data", {})
                        else:
                            raise RuntimeError(resp.get("error", f"DOM action '{instruction}' failed"))
        except asyncio.TimeoutError:
            raise TimeoutError(f"DOM instruction '{instruction}' timed out after {timeout}s.")
        except Exception as conn_err:
            raise ConnectionError(f"DOM relay failed via ws://127.0.0.1:8765: {conn_err}")

    def dispatch_dom_action_sync(
        self,
        instruction: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Thread-safe synchronous bridge dispatcher callable from any thread,
        APScheduler tick, or CLI without creating colliding event loops.
        """
        if len(self.clients) > 0 and self.loop and self.loop.is_running():
            fut = asyncio.run_coroutine_threadsafe(
                self.dispatch_dom_action(instruction, params, timeout=timeout),
                self.loop
            )
            return fut.result(timeout=timeout + 5.0)

        # Fallback to asyncio.run (either no in-process clients or loop not running on this thread)
        try:
            return asyncio.run(self.dispatch_dom_action(instruction, params, timeout=timeout))
        except Exception as e:
            raise RuntimeError(f"Bridge execution failed: {e}")

    async def force_sync(self, timeout: float = 10.0) -> bool:
        """Requests connected extension to immediately extract and upload session cookies."""
        if not self.is_connected():
            return False
        for client in self.clients:
            try:
                await client.send(json.dumps({"type": "FORCE_SESSION_SYNC"}))
            except Exception:
                pass
        return True

    def open_canvas_sync(self, platform: str) -> Dict[str, Any]:
        """Instructs Chrome to open or focus the target platform tab."""
        urls = {
            "facebook": "https://www.facebook.com/",
            "instagram": "https://www.instagram.com/",
            "business_suite": "https://business.facebook.com/latest/composer",
            "youtube": "https://studio.youtube.com",
            "tiktok": "https://www.tiktok.com/creator-center/upload"
        }
        url = urls.get(platform.lower(), "https://www.facebook.com/")
        return self.dispatch_dom_action_sync("OPEN_OR_FOCUS_TAB", {"url": url, "platform": platform}, timeout=10.0)

    def logout_account_sync(self, platform: str, account_id: Optional[str] = None) -> Dict[str, Any]:
        """Logs out account in local DB and instructs Chrome Extension to clear cookies."""
        self.db.delete_session(platform, account_id)
        if self.is_connected():
            try:
                return self.dispatch_dom_action_sync("LOGOUT_PLATFORM", {"platform": platform}, timeout=10.0)
            except Exception as e:
                logger.warning("Could not execute in-browser cookie purge: %s", e)
        return {"status": "success", "platform": platform, "message": f"Logged out of {platform} in local database."}

    async def send_command(self, command: str, payload: Dict[str, Any], timeout: float = 60.0) -> Dict[str, Any]:
        """
        Universal command adapter mapping high-level controller commands to DOM instructions.
        Thread-safe across multiple asyncio event loops.
        """
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if self.loop and self.loop.is_running() and current_loop is not None and current_loop != self.loop:
            fut = asyncio.run_coroutine_threadsafe(
                self._send_command_internal(command, payload, timeout),
                self.loop
            )
            return await asyncio.wrap_future(fut)
        return await self._send_command_internal(command, payload, timeout)

    async def _send_command_internal(self, command: str, payload: Dict[str, Any], timeout: float = 60.0) -> Dict[str, Any]:
        """Internal dispatch logic executing on bridge's native event loop."""
        cmd_upper = command.upper()
        if cmd_upper in ("PUBLISH_POST", "AUTONOMOUS_POST"):
            target_type = payload.get("target_type", "profile")
            target_id = payload.get("target_id")
            # If target_type is page or MBS, route to Meta Business Suite
            is_mbs = target_type in ("page", "business_suite", "meta_business_suite") or (target_id and str(target_id) in ("me", "me"))
            instruction = "AUTONOMOUS_BUSINESS_SUITE_POST" if is_mbs else "AUTONOMOUS_FACEBOOK_POST"

            post_type = payload.get("post_type", "photo")
            is_video = post_type in ("video", "reel")

            # Extract base64 and mime from media_files, base64_data, or media_paths
            base64_data = payload.get("base64_data")
            mime_type = payload.get("mime_type") or ("video/mp4" if is_video else "image/jpeg")
            file_name = payload.get("file_name") or ("reel.mp4" if is_video else "photo.jpg")

            if not base64_data and payload.get("media_files"):
                mf = payload["media_files"][0]
                base64_data = mf.get("base64")
                mime_type = mf.get("mime_type", mime_type)
                file_name = mf.get("filename", file_name)
            elif not base64_data and payload.get("media_paths"):
                mp = payload["media_paths"][0]
                if os.path.exists(mp):
                    import mimetypes, base64 as b64
                    m_guessed, _ = mimetypes.guess_type(mp)
                    if m_guessed:
                        mime_type = m_guessed
                    file_name = os.path.basename(mp)
                    with open(mp, "rb") as f:
                        base64_data = b64.b64encode(f.read()).decode("ascii")

            full_text = payload.get("caption") or payload.get("text") or payload.get("description") or ""

            target_url = (
                f"https://business.facebook.com/latest/composer?asset_id={target_id}" if target_id else "https://business.facebook.com/latest/composer"
            ) if is_mbs else (
                "https://www.facebook.com/reels/create" if post_type == "reel" else (
                    "https://www.facebook.com/stories/create" if post_type == "story" else "https://www.facebook.com/"
                )
            )

            dom_params = {
                "text": full_text,
                "base64_data": base64_data,
                "mime_type": mime_type,
                "file_name": file_name,
                "is_video": is_video,
                "target_type": target_type,
                "target_id": target_id,
                "target_url": target_url,
                "auto_publish": payload.get("auto_publish", True),
                "post_type": post_type,
                "title": payload.get("title", ""),
                "hashtags": payload.get("hashtags", []),
                "story_text": payload.get("story_text"),
                "schedule_time_iso": payload.get("schedule_time_iso"),
                "bypass_spacing": payload.get("bypass_spacing", False)
            }

            # Ingest custom thumbnail / cover image if provided
            if payload.get("thumbnail_file"):
                tf = payload["thumbnail_file"]
                dom_params["thumbnail_base64"] = tf.get("base64")
                dom_params["thumbnail_mime_type"] = tf.get("mime_type", "image/jpeg")
                dom_params["thumbnail_file_name"] = tf.get("filename", "cover.jpg")
            elif payload.get("thumbnail_path"):
                tp = payload["thumbnail_path"]
                if os.path.exists(tp):
                    import mimetypes, base64 as b64
                    tm, _ = mimetypes.guess_type(tp)
                    with open(tp, "rb") as f:
                        dom_params["thumbnail_base64"] = b64.b64encode(f.read()).decode("ascii")
                    dom_params["thumbnail_mime_type"] = tm or "image/jpeg"
                    dom_params["thumbnail_file_name"] = os.path.basename(tp)

            try:
                res = await self.dispatch_dom_action(instruction, dom_params, timeout=timeout)
                return {
                    "success": True,
                    "status": "published",
                    "surface": "Meta Business Suite" if is_mbs else "Facebook Web",
                    "fb_post_id": res.get("post_id") or f"meta_{int(time.time())}",
                    "post_url": res.get("url") or target_url,
                    "data": res
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

        elif cmd_upper in ("CHECK_SESSION", "CHECK_LOGIN"):
            target_url = payload.get("target_url", "")
            is_mbs = "business.facebook.com" in target_url
            sess_key = "business_suite" if is_mbs else "facebook"
            session = self.db.get_session(sess_key)
            if not session and is_mbs:
                session = self.db.get_session("facebook")
            pages_list = self.discovered_pages or (session.get("tokens", {}).get("pages", []) if session else [])
            if session and session.get("account_id"):
                return {
                    "success": True,
                    "logged_in": True,
                    "data": {
                        "logged_in": True,
                        "id": str(session.get("account_id")),
                        "name": str(session.get("name") or "Meta Account"),
                        "type": "page" if is_mbs else "profile",
                        "url": target_url or ("https://business.facebook.com/" if is_mbs else "https://www.facebook.com/"),
                        "pages": pages_list
                    }
                }
            return {
                "success": True,
                "logged_in": True,
                "data": {
                    "logged_in": True,
                    "id": "me",
                    "name": "Facebook User",
                    "type": "profile",
                    "url": "https://www.facebook.com/",
                    "pages": pages_list
                }
            }

        elif cmd_upper in ("EDIT_POST", "EDIT_POST_DOM"):
            try:
                res = await self.dispatch_dom_action("EDIT_POST_DOM", payload, timeout=timeout)
                return {"success": True, "data": res}
            except Exception as e:
                return {"success": False, "error": str(e)}

        elif cmd_upper in ("DELETE_POST", "DELETE_POST_DOM"):
            try:
                res = await self.dispatch_dom_action("DELETE_POST_DOM", payload, timeout=timeout)
                return {"success": True, "data": res}
            except Exception as e:
                return {"success": False, "error": str(e)}

        else:
            try:
                res = await self.dispatch_dom_action(command, payload, timeout=timeout)
                return {"success": True, "data": res}
            except Exception as e:
                return {"success": False, "error": str(e)}

    def send_command_sync(self, command: str, payload: Dict[str, Any], timeout: float = 60.0) -> Dict[str, Any]:
        """Synchronous wrapper for send_command."""
        if len(self.clients) > 0 and self.loop and self.loop.is_running():
            future = asyncio.run_coroutine_threadsafe(self.send_command(command, payload, timeout=timeout), self.loop)
            return future.result(timeout=timeout + 5.0)
        return asyncio.run(self.send_command(command, payload, timeout=timeout))


# Global bridge singleton
bridge = BridgeServer()

# Compatibility alias
FacebookBridgeServer = BridgeServer

