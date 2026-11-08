"""
Facebook Automation MCP Server
Exposes Production-Grade Tools for Facebook Post Publishing,
Scheduling, Re-Editing, Deleting, Anti-Duplicate Guard, and Viral SEO.
"""

import asyncio
import json
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
async def fb_status() -> Dict[str, Any]:
    """Check Facebook Automation Bridge status, connected browser extension, and queue metrics."""
    connected = bridge.is_connected()
    due_jobs = db.get_due_jobs()
    recent = db.list_posts(limit=5)
    return {
        "status": "online",
        "bridge_connected": connected,
        "websocket_url": f"ws://{WS_HOST}:{WS_PORT}",
        "database": str(DB_PATH),
        "scheduled_jobs_queued": len(due_jobs),
        "recent_posts_count": len(recent),
        "guardian_blocked_mode": guardian.blocked_mode
    }

@mcp.tool()
async def fb_login_status() -> Dict[str, Any]:
    """Detect current active Facebook login session (profile name, ID, managed pages)."""
    return await controller.get_login_status()

@mcp.tool()
async def fb_publish(
    caption: str,
    media_paths: Optional[List[str]] = None,
    post_type: str = "text",
    target_type: str = "profile",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Publish a post to Facebook immediately with verified DOM confirmation.
    
    Args:
        caption: The text content of the post.
        media_paths: List of absolute file paths to photos or videos.
        post_type: One of 'text', 'photo', 'video', 'reel'.
        target_type: 'profile' (feed), 'page' (managed page), or 'group'.
        target_id: Optional ID or name of page/group.
    """
    return await controller.publish_post(
        caption=caption,
        media_paths=media_paths,
        post_type=post_type,
        target_type=target_type,
        target_id=target_id
    )

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
    Schedule a Facebook post for future publication.
    
    Args:
        caption: The text content of the post.
        run_at_timestamp: Unix epoch timestamp when post should be published.
        media_paths: List of absolute paths to media files.
        post_type: 'text', 'photo', 'video', or 'reel'.
        target_type: 'profile', 'page', or 'group'.
        target_id: Optional target identifier.
    """
    is_dup, dup_reason = db.check_duplicate(media_paths=media_paths, caption=caption)
    if is_dup:
        return {"success": False, "error": dup_reason, "duplicate_detected": True}

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
    """Re-edit an existing Facebook post\'s caption via DOM automation."""
    return await controller.edit_post(post_url_or_id, new_caption)

@mcp.tool()
async def fb_delete_post(post_url_or_id: str) -> Dict[str, Any]:
    """Delete an existing Facebook post or move it to trash."""
    return await controller.delete_post(post_url_or_id)

@mcp.tool()
async def fb_list_posts(limit: int = 15, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """List recent published, scheduled, or failed Facebook posts from local database."""
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
    """Diagnose local setup, database, WebSocket bridge, and rate limits."""
    return {
        "python_version": sys.version,
        "database_exists": os.path.exists(DB_PATH),
        "bridge_online": bridge.is_connected(),
        "websocket_port": WS_PORT,
        "blocked_mode": guardian.blocked_mode,
        "consecutive_errors": guardian.consecutive_errors,
        "recommendation": "Everything healthy!" if not guardian.blocked_mode else "Clear sentinel checkpoint before resuming."
    }

async def start_background_services():
    await bridge.start()
    scheduler.start()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_background_services())
    mcp.run()
