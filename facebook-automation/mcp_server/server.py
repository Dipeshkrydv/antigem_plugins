"""
Facebook Automation MCP Server (v1.1.0)
Exposes Production-Grade Tools for Facebook One-Time Login Verification,
Auto-Opening Facebook in Browser, Post/Photo/Carousel/Video/Reel/Story Publishing,
Scheduling, Re-Editing, Deleting, Anti-Duplicate Guard, and Viral SEO.
"""

import asyncio
import os
import sys
from typing import Optional, List, Dict, Any
from mcp.server.fastmcp import FastMCP

from .config import WS_HOST, WS_PORT, DB_PATH
from .database import FacebookDatabase
from .policy_guardian import PolicyGuardian
from .fb_seo import FacebookSEO
from .bridge_server import FacebookBridgeServer
from .facebook_controller import FacebookController
from .scheduler import FacebookScheduler

mcp = FastMCP("Facebook Automation", dependencies=["websockets", "pillow"])

db = FacebookDatabase()
guardian = PolicyGuardian(db)
bridge = FacebookBridgeServer(WS_HOST, WS_PORT)
controller = FacebookController(db, guardian, bridge)
scheduler = FacebookScheduler(db, controller)


@mcp.tool()
async def fb_status(open_browser: bool = True) -> Dict[str, Any]:
    """
    Check Facebook Automation status, open Facebook in the browser if needed,
    and verify one-time login readiness.
    IMPORTANT: If logged_in is false (action_required='ONE_TIME_LOGIN_REQUIRED'),
    tell the user once to sign in to Facebook in the open browser tab and STOP immediately (do not loop).
    """
    connected = bridge.is_connected()
    due_jobs = db.get_due_jobs()
    recent = db.list_posts(limit=5)
    login_info = await controller.get_login_status() if (connected and open_browser) else {"logged_in": False}
    return {
        "status": "ready" if login_info.get("logged_in") else ("awaiting_one_time_login" if connected else "bridge_offline"),
        "bridge_connected": connected,
        **login_info,
        "websocket_url": f"ws://{WS_HOST}:{WS_PORT}",
        "database": str(DB_PATH),
        "scheduled_jobs_queued": len(due_jobs),
        "recent_posts_count": len(recent),
        "pending_task": controller.pending_task,
        "guardian_blocked_mode": guardian.blocked_mode
    }


@mcp.tool()
async def fb_login_status(open_browser: bool = True) -> Dict[str, Any]:
    """
    Open Facebook (https://www.facebook.com/) in the browser if not already open,
    detect current active login session, and persist one-time login state.
    IMPORTANT: If logged_in is false, tell the user once to sign in inside the open browser tab and STOP immediately.
    """
    return await controller.get_login_status(
        target_url="https://www.facebook.com/" if open_browser else None
    )


@mcp.tool()
async def fb_open_browser(view: str = "feed", target_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Explicitly open and focus Facebook in the browser (feed, reels, stories, page, or business_suite)
    and check one-time login readiness.
    """
    return await controller.open_browser(view=view, target_id=target_id)


@mcp.tool()
async def fb_publish(
    caption: str,
    media_paths: Optional[List[str]] = None,
    post_type: str = "text",
    target_type: str = "profile",
    target_id: Optional[str] = None,
    first_comment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Publish a post (text, photo, carousel, video, reel, or story) to Facebook immediately with DOM confirmation.
    Automatically opens Facebook in the browser first and checks one-time login.
    If not logged in, saves the task and returns action_required='ONE_TIME_LOGIN_REQUIRED' (STOP and ask user once to sign in).
    """
    return await controller.publish_post(
        caption=caption,
        media_paths=media_paths,
        post_type=post_type,
        target_type=target_type,
        target_id=target_id,
        first_comment=first_comment
    )


@mcp.tool()
async def fb_publish_reel(
    video_path: str,
    caption: str,
    target_type: str = "profile",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload and publish a vertical video as a Facebook Reel (https://www.facebook.com/reels/create).
    Automatically opens Facebook, checks one-time login, attaches the MP4 video, and completes the Reel wizard.
    """
    return await controller.publish_post(
        caption=caption,
        media_paths=[video_path],
        post_type="reel",
        target_type=target_type,
        target_id=target_id
    )


@mcp.tool()
async def fb_publish_story(
    media_path: Optional[str] = None,
    caption: str = "",
    target_type: str = "profile",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload and publish a photo, video, or text Story to Facebook (https://www.facebook.com/stories/create).
    """
    return await controller.publish_post(
        caption=caption,
        media_paths=[media_path] if media_path else [],
        post_type="story",
        target_type=target_type,
        target_id=target_id
    )


@mcp.tool()
async def fb_resume_pending() -> Dict[str, Any]:
    """
    Resume and execute any pending Facebook task that was saved while waiting for the user's one-time login.
    """
    return await controller.resume_pending()


@mcp.tool()
async def fb_schedule(
    caption: str,
    run_at_timestamp: float,
    media_paths: Optional[List[str]] = None,
    post_type: str = "text",
    target_type: str = "profile",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Schedule a Facebook post, reel, or story for future publication.
    """
    is_dup, dup_reason = db.check_duplicate(media_paths=media_paths, caption=caption)
    if is_dup:
        return {"success": False, "error": dup_reason, "duplicate_detected": True, "stop_loop": True}

    client_id = f"sched_{int(run_at_timestamp)}"
    post_id = db.record_post(
        client_id=client_id,
        post_type=post_type,
        caption=caption,
        media_paths=media_paths or [],
        target_type=target_type,
        target_id=target_id,
        status="scheduled"
    )
    job_id = db.schedule_post(post_id, run_at_timestamp)
    return {
        "success": True,
        "message": f"Post scheduled for timestamp {run_at_timestamp}",
        "post_id": post_id,
        "job_id": job_id
    }


@mcp.tool()
async def fb_edit_post(post_url_or_id: str, new_caption: str) -> Dict[str, Any]:
    """Re-edit an existing Facebook post's caption via DOM automation."""
    return await controller.edit_post(post_url_or_id, new_caption)


@mcp.tool()
async def fb_delete_post(post_url_or_id: str) -> Dict[str, Any]:
    """Delete an existing Facebook post or move it to trash."""
    return await controller.delete_post(post_url_or_id)


@mcp.tool()
async def fb_list_posts(limit: int = 15, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """List recent published, scheduled, awaiting_login, or failed Facebook posts from local database."""
    return db.list_posts(limit=limit, status=status)


@mcp.tool()
async def fb_seo_generate(
    topic: str,
    key_takeaways: Optional[List[str]] = None,
    link_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate an algorithm-optimized viral Facebook post with:
    - 1-line retention hook
    - 3-4 punchy micro-bullets
    - Engagement CTA
    - 3-6 targeted hashtags
    - Alt-text for image accessibility
    - First-comment link recommendation (protects organic reach)
    """
    return FacebookSEO.generate_post_seo(topic, key_takeaways=key_takeaways, link_url=link_url)


@mcp.tool()
async def fb_audit_caption(caption: str) -> Dict[str, Any]:
    """Audit a post caption for Facebook algorithmic penalties (outbound links, hashtag stuffing, dense text)."""
    return FacebookSEO.audit_caption(caption)


@mcp.tool()
async def fb_comments(post_url_or_id: str, comment_text: str) -> Dict[str, Any]:
    """Post a first comment (such as a resource link) or reply on a Facebook post."""
    return await controller.add_comment(post_url_or_id, comment_text)


@mcp.tool()
async def fb_doctor() -> Dict[str, Any]:
    """Diagnose local setup, database, WebSocket bridge, login status, and rate limits."""
    login = await controller.get_login_status() if bridge.is_connected() else {"logged_in": False}
    return {
        "python_version": sys.version,
        "database_exists": os.path.exists(DB_PATH),
        "bridge_online": bridge.is_connected(),
        "logged_in": login.get("logged_in", False),
        "pending_task": controller.pending_task,
        "websocket_port": WS_PORT,
        "blocked_mode": guardian.blocked_mode,
        "consecutive_errors": guardian.consecutive_errors,
        "recommendation": (
            "Everything healthy!"
            if (not guardian.blocked_mode and login.get("logged_in"))
            else (
                "Complete one-time Facebook login in the open browser tab."
                if not guardian.blocked_mode
                else "Clear sentinel checkpoint before resuming."
            )
        )
    }


async def start_background_services():
    await bridge.start()
    scheduler.start()


if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_background_services())
    mcp.run()
