"""
Facebook Automation MCP Server (v1.3.0)
Senior Social Media Manager & Mobile Precision Touch Edition:
Exposes Production-Grade Tools for Facebook One-Time Login Verification,
Auto-Opening Facebook in Browser, Unified Photo/Carousel/Video/Reel/Story + Deep Quote Publishing,
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
    NOTE: When publishing, do NOT call fb_status first—call fb_publish directly in 1 step!
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
    caption: str = "",
    title: Optional[str] = None,
    hashtags: Optional[List[str]] = None,
    thumbnail_path: Optional[str] = None,
    media_paths: Optional[List[str]] = None,
    post_type: str = "text",
    target_type: str = "profile",
    target_id: Optional[str] = None,
    first_comment: Optional[str] = None,
    story_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    ONE-TOUCH SENIOR SOCIAL MEDIA MANAGER PUBLISHER (Feed Posts, Photos, Carousels, Feed Videos — and routes Reel/Story if specified):
    NOTE: For Facebook REELS prefer `fb_publish_reel(...)`; for Facebook STORIES prefer `fb_publish_story(...)`.
    MANDATORY RULES:
    1. ZERO OVERTHINKING: Call `fb_publish`, `fb_publish_reel`, or `fb_publish_story` directly as your FIRST tool call.
    2. UNIFIED PHOTO + DEEP QUOTE IN ONE CALL: When uploading a photo (`post_type="photo"`), NEVER upload bare text or bare photo — pass `media_paths=["latest"]` (or user file path), `title`, formatted multiline `caption` (Title -> blank line -> Quote -> Bullets -> CTA), and 3-6 `hashtags`.
    3. FORMATTED CAPTION & HASHTAGS: Keep `\n\n` spacing between Title, Description, CTA, and `#Hashtags`.
    4. CUSTOM VIDEO THUMBNAIL: When uploading a Feed Video (`post_type="video"`) with user's `thumbnail_path`, pass `thumbnail_path` and automation uploads it inside Facebook's Edit Video -> Thumbnail panel (never as a second post media item). If no `thumbnail_path` is provided for Video/Reel, ask the user whether to provide one or generate via AI Image Model (`fb_thumbnail_prompt`).
    """
    return await controller.publish_post(
        caption=caption,
        title=title,
        hashtags=hashtags,
        thumbnail_path=thumbnail_path,
        media_paths=media_paths,
        post_type=post_type,
        target_type=target_type,
        target_id=target_id,
        first_comment=first_comment,
        story_text=story_text
    )


@mcp.tool()
async def fb_publish_reel(
    video_path: str = "latest",
    caption: str = "",
    title: Optional[str] = None,
    hashtags: Optional[List[str]] = None,
    thumbnail_path: Optional[str] = None,
    target_type: str = "profile",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    DEDICATED FACEBOOK REELS PUBLISHER (`https://www.facebook.com/reels/create` + automatic mobile fallback):
    Uploads a vertical video as a Facebook Reel with:
    - Custom Cover / Thumbnail (`thumbnail_path`): automatically uploaded in the Reels Edit/Cover panel (NEVER attached as a feed photo). If missing, ask user to provide or generate with AI Image Model (`fb_thumbnail_prompt`).
    - Viral `title` + formatted multiline `caption` description (`\n\n` spacing preserved) + 3-6 `#Hashtags`.
    - Supports `video_path="latest"` to automatically pick the newest vertical video on the device.
    """
    return await controller.publish_post(
        caption=caption,
        title=title,
        hashtags=hashtags,
        thumbnail_path=thumbnail_path,
        media_paths=[video_path],
        post_type="reel",
        target_type=target_type,
        target_id=target_id
    )


@mcp.tool()
async def fb_publish_story(
    media_path: Optional[str] = None,
    story_text: Optional[str] = None,
    caption: str = "",
    target_type: str = "profile",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    DEDICATED FACEBOOK STORIES PUBLISHER (`https://www.facebook.com/stories/create`):
    Publishes a Photo/Video Story (with optional short overlay `story_text`) or a Text Story (`Create a text story`).
    NOTE: Facebook Stories do NOT have a caption/description/hashtag field; use `story_text` (<=120 chars) for short overlay text on Photo/Video Stories or full text on Text Stories.
    """
    return await controller.publish_post(
        caption=caption,
        story_text=story_text,
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
    run_at_timestamp: float,
    caption: str = "",
    title: Optional[str] = None,
    hashtags: Optional[List[str]] = None,
    thumbnail_path: Optional[str] = None,
    media_paths: Optional[List[str]] = None,
    post_type: str = "text",
    target_type: str = "profile",
    target_id: Optional[str] = None,
    story_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Schedule a Facebook post, reel, or story for future publication.
    Always enforces a viral Title (`title`), formatted multiline Description, and 3-6 `#Hashtags` (`hashtags`) for posts/videos/reels, or clean `story_text` for Stories.
    """
    enriched = FacebookSEO.ensure_title_and_hashtags(
        caption=caption,
        title=title,
        hashtags=hashtags,
        post_type=post_type,
        story_text=story_text
    )
    final_caption = enriched["caption"]
    is_dup, dup_reason = db.check_duplicate(media_paths=media_paths, caption=final_caption)
    if is_dup:
        return {"success": False, "error": dup_reason, "duplicate_detected": True, "stop_loop": True}

    client_id = f"sched_{int(run_at_timestamp)}"
    post_id = db.record_post(
        client_id=client_id,
        post_type=post_type,
        caption=final_caption,
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
        "job_id": job_id,
        "title": enriched["title"],
        "hashtags": enriched["hashtags"],
        "thumbnail_path": thumbnail_path
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
    link_url: Optional[str] = None,
    aspect_ratio: str = "16:9"
) -> Dict[str, Any]:
    """
    Generate an algorithm-optimized viral Facebook post with:
    - Mandatory Viral Title (`title`)
    - 1-line retention hook & deep quote
    - 3-4 punchy micro-bullets
    - Engagement CTA
    - 3-6 targeted `#Hashtags` (`hashtags`)
    - AI Image Model Thumbnail Prompt (`ai_thumbnail_prompt`)
    - First-comment link recommendation (protects organic reach)
    """
    return FacebookSEO.generate_post_seo(
        topic,
        key_takeaways=key_takeaways,
        link_url=link_url,
        aspect_ratio=aspect_ratio
    )


@mcp.tool()
async def fb_thumbnail_prompt(
    topic: str,
    title_hook: Optional[str] = None,
    subtitle: Optional[str] = None,
    archetype: str = "classical_fusion",
    aspect_ratio: str = "16:9"
) -> Dict[str, Any]:
    """
    Craft a hyper-detailed, creative Master Art Direction prompt for generating a viral video/reel/post thumbnail
    using an AI Image Model (Nano Banana Pro / `image-generator` / Google Flow / Imagen 3).
    STRICT MANDATE: NEVER use Python (PIL, Pillow, OpenCV, ThumbnailEngine, or FreeMediaEngine) to generate thumbnails!
    """
    return FacebookSEO.generate_thumbnail_prompt(
        topic=topic,
        title_hook=title_hook,
        subtitle=subtitle,
        archetype=archetype,
        aspect_ratio=aspect_ratio
    )


@mcp.tool()
async def fb_audit_caption(caption: str, title: str = "") -> Dict[str, Any]:
    """Audit a post caption for Title, Hashtags, and Facebook algorithmic penalties (outbound links, hashtag stuffing, dense text)."""
    return FacebookSEO.audit_caption(caption, title=title)


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
