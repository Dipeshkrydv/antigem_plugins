"""
Facebook Automation MCP Server (v1.3.0)
Senior Social Media Manager & Mobile Precision Touch Edition:
Exposes Production-Grade Tools for Facebook One-Time Login Verification,
Auto-Opening Facebook in Browser, Unified Photo/Carousel/Video/Reel/Story + Deep Quote Publishing,
Scheduling, Re-Editing, Deleting, Anti-Duplicate Guard, and Viral SEO.
"""

import asyncio
import logging
import os
import sys
import threading
from typing import Optional, List, Dict, Any

# Ensure stderr logging so stdout is dedicated 100% to MCP JSON-RPC protocol
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("meta_suite.mcp_server")

try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except (ImportError, ModuleNotFoundError):
    try:
        from mcp.server.fastmcp import FastMCP
    except (ImportError, ModuleNotFoundError):
        from mcp.server import Server as FastMCP

from .config import WS_HOST, WS_PORT, DB_PATH
from .database import FacebookDatabase
from .policy_guardian import PolicyGuardian
from .fb_seo import FacebookSEO
from .meta_viral_seo_engine import meta_viral_seo
from .deepx_meta_bridge import deepx_meta
from .bridge_server import FacebookBridgeServer
from .facebook_controller import FacebookController
from .scheduler import FacebookScheduler

mcp = FastMCP("Facebook Automation", dependencies=["websockets", "pillow"])

db = FacebookDatabase()
guardian = PolicyGuardian(db)
bridge = FacebookBridgeServer(WS_HOST, WS_PORT)
controller = FacebookController(db, guardian, bridge)
scheduler = FacebookScheduler(database=db, policy_guardian=guardian, fb=controller)


@mcp.tool()
async def fb_status(open_browser: bool = True) -> Dict[str, Any]:
    """
    Check Meta Suite and Facebook Automation status, verify bridge connectivity, and active login session.
    MANDATORY LITERAL FIRST TOOL CALL on any Meta Suite or Facebook task (<100ms).
    Returns ready status, logged_in state, active accounts, discovered pages, and queued jobs.
    """
    connected = bridge.is_connected()
    due_jobs = db.list_upcoming_jobs() if hasattr(db, "list_upcoming_jobs") else []
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
    target_type: str = "page",
    target_id: Optional[str] = "me",
    first_comment: Optional[str] = None,
    story_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    ONE-TOUCH META BUSINESS SUITE PAGE PUBLISHER (Page Posts, Photos, Carousels, Videos, Reels, Stories):
    Dedicated strictly to Facebook Page Management via Meta Business Suite (business.facebook.com).
    MANDATORY RULES:
    1. ZERO OVERTHINKING: Call `fb_publish`, `fb_publish_reel`, or `fb_publish_story` directly as your FIRST tool call.
    2. UNIFIED PHOTO + DEEP QUOTE: Pass `media_paths=["latest"]` (or user file path), `title`, formatted multiline `caption` (Title -> blank line -> Quote -> Bullets -> CTA), and 3-6 `hashtags`.
    3. FORMATTED CAPTION & HASHTAGS: Keep `\n\n` spacing between Title, Description, CTA, and `#Hashtags`.
    4. CUSTOM VIDEO THUMBNAIL: When uploading Page Videos with `thumbnail_path`, passes `thumbnail_path` to Edit Video -> Thumbnail panel.
    5. ORGANIC SHIELD: Strictly ensures 'Make this an ad post' is OFF.
    """
    return await controller.publish_post(
        caption=caption,
        title=title,
        hashtags=hashtags,
        thumbnail_path=thumbnail_path,
        media_paths=media_paths,
        post_type=post_type,
        target_type=target_type or "page",
        target_id=target_id or "me",
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
    target_type: str = "page",
    target_id: Optional[str] = "me"
) -> Dict[str, Any]:
    """
    DEDICATED META BUSINESS SUITE PAGE REELS PUBLISHER:
    Uploads a vertical 9:16 video as a Facebook Page Reel in Meta Business Suite:
    - Custom Cover / Thumbnail (`thumbnail_path`): automatically uploaded in Reel Cover panel.
    - Viral `title` + formatted multiline `caption` (`\n\n` spacing preserved) + 3-6 `#Hashtags`.
    - Supports `video_path="latest"` to pick the newest vertical video automatically.
    """
    return await controller.publish_post(
        caption=caption,
        title=title,
        hashtags=hashtags,
        thumbnail_path=thumbnail_path,
        media_paths=[video_path],
        post_type="reel",
        target_type=target_type or "page",
        target_id=target_id or "me"
    )


@mcp.tool()
async def fb_publish_story(
    media_path: Optional[str] = None,
    story_text: Optional[str] = None,
    caption: str = "",
    target_type: str = "page",
    target_id: Optional[str] = "me"
) -> Dict[str, Any]:
    """
    DEDICATED META BUSINESS SUITE PAGE STORIES PUBLISHER:
    Publishes a Photo/Video Page Story (with optional short overlay `story_text`) or a Text Story.
    """
    return await controller.publish_post(
        caption=caption,
        story_text=story_text,
        media_paths=[media_path] if media_path else [],
        post_type="story",
        target_type=target_type or "page",
        target_id=target_id or "me"
    )


@mcp.tool()
async def fb_resume_pending() -> Dict[str, Any]:
    """
    Resume and execute any pending Facebook task that was saved while waiting for the user's one-time login.
    """
    return await controller.resume_pending()


@mcp.tool()
async def fb_schedule(
    run_at_timestamp: Optional[float] = None,
    schedule_time_iso: Optional[str] = None,
    caption: str = "",
    title: Optional[str] = None,
    hashtags: Optional[List[str]] = None,
    thumbnail_path: Optional[str] = None,
    media_paths: Optional[List[str]] = None,
    post_type: str = "text",
    target_type: str = "page",
    target_id: Optional[str] = "me",
    story_text: Optional[str] = None,
    use_native_meta_scheduler: bool = True
) -> Dict[str, Any]:
    """
    Schedule a Facebook Page post, reel, or story for future publication in Meta Business Suite.
    Enqueues the job into the SQLite APScheduler queue (or native Meta Business Suite scheduler).
    Accepts either `schedule_time_iso` (e.g. '2026-11-19T10:00:00Z') or `run_at_timestamp` (epoch float).
    Always enforces a viral Title (`title`), formatted multiline Description, and 3-6 `#Hashtags` (`hashtags`) for posts/videos/reels, or clean `story_text` for Stories.
    """
    from datetime import datetime, timezone, timedelta
    target_iso = None
    if schedule_time_iso:
        target_iso = schedule_time_iso
    elif run_at_timestamp:
        target_iso = datetime.fromtimestamp(run_at_timestamp, tz=timezone.utc).isoformat()
    else:
        target_iso = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

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

    payload = {
        "media_paths": media_paths or [],
        "title": enriched["title"],
        "caption": final_caption,
        "description": final_caption,
        "hashtags": enriched["hashtags"],
        "thumbnail_path": thumbnail_path,
        "story_text": story_text,
        "auto_publish": True,
        "bypass_spacing": False
    }

    try:
        res = scheduler.schedule_job(
            platform="facebook",
            target_type=target_type or "page",
            target_id=target_id or "me",
            content_type=post_type,
            payload=payload,
            schedule_time_iso=target_iso,
            use_native_meta_scheduler=use_native_meta_scheduler
        )
        return {
            "success": True,
            "message": f"Page post scheduled successfully for {target_iso}",
            "job_id": res.get("job_id"),
            "schedule_time_iso": target_iso,
            "mode": res.get("mode", "local_sqlite_queue"),
            "title": enriched["title"],
            "hashtags": enriched["hashtags"],
            "thumbnail_path": thumbnail_path,
            "target_type": target_type or "page",
            "target_id": target_id or "me"
        }
    except Exception as e:
        return {"success": False, "error": str(e), "stop_loop": True}


@mcp.tool()
async def fb_manage_queue(
    action: str = "list",
    job_id: Optional[int] = None,
    new_schedule_time_iso: Optional[str] = None,
    limit: int = 20
) -> Dict[str, Any]:
    """
    Controls and inspects the local SQLite APScheduler post queue for Meta Business Suite & Facebook:
    - action='list': Lists upcoming and pending scheduled posts.
    - action='cancel': Cancels a scheduled job by `job_id`.
    - action='reschedule': Changes scheduled time for `job_id` to `new_schedule_time_iso`.
    - action='pause_all': Emergency pauses all upcoming jobs in queue.
    - action='resume_all': Resumes paused jobs in queue.
    """
    act = (action or "list").lower().strip()
    try:
        if act == "list":
            jobs = scheduler.list_queue(limit=limit)
            return {"success": True, "action": "list", "count": len(jobs), "jobs": jobs}
        elif act == "cancel":
            if not job_id:
                return {"success": False, "error": "job_id is required for cancel action"}
            scheduler.cancel_job(job_id)
            return {"success": True, "action": "cancel", "job_id": job_id, "message": f"Job #{job_id} cancelled."}
        elif act == "reschedule":
            if not job_id or not new_schedule_time_iso:
                return {"success": False, "error": "job_id and new_schedule_time_iso are required for reschedule action"}
            scheduler.reschedule_job(job_id, new_schedule_time_iso)
            return {"success": True, "action": "reschedule", "job_id": job_id, "new_time": new_schedule_time_iso, "message": f"Job #{job_id} rescheduled to {new_schedule_time_iso}."}
        elif act in ("pause_all", "pause"):
            scheduler.pause_queue()
            return {"success": True, "action": "pause_all", "message": "All scheduled queue processing paused."}
        elif act in ("resume_all", "resume"):
            scheduler.resume_queue()
            return {"success": True, "action": "resume_all", "message": "Scheduled queue processing resumed."}
        else:
            return {"success": False, "error": f"Unknown action '{action}'. Supported: list, cancel, reschedule, pause_all, resume_all"}
    except Exception as e:
        return {"success": False, "error": str(e)}


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
async def meta_viral_seo_generate(
    topic: str,
    video_type: str = "reel",
    target_platform: str = "business_suite",
    audience_persona: str = "ambitious_practitioner"
) -> Dict[str, Any]:
    """
    Generate an elite 2M-20M view scale viral SEO package for Meta Business Suite, Facebook Reels, and Instagram Reels:
    - High-CTR Pattern Interrupt Viral Title
    - 3-Second Retention Hook (Line 1 before 'See More' cutoff)
    - Anti-Book 1-2 line Micro-Takeaways with double whitespace
    - Comment Warfare Debate Driver (triggers multi-turn reply threads)
    - Share & Save Catalysts (12x Share and 6x Save algorithmic multipliers)
    - 3-6 Diamond Cluster Hashtags
    - Master AI Image Model Thumbnail Prompt (strictly compliant with Rule 8: AI Image Model ONLY, volumetric rim lighting, 3D gradient text)
    - Multimodal Semantic Keywords for Meta V-JEPA indexer.
    """
    return meta_viral_seo.generate_20m_viral_package(
        topic=topic,
        video_type=video_type,
        target_platform=target_platform,
        audience_persona=audience_persona
    )


@mcp.tool()
async def meta_viral_algorithm_audit(caption: str, title: str = "") -> Dict[str, Any]:
    """
    Rigorously audit any video or post caption against Meta's recommendation algorithm.
    Checks 3-second retention, outbound link penalties, comment warfare prompts,
    whitespace structure, and hashtag stuffing. Returns 0-100 score and viral reach tier.
    """
    return meta_viral_seo.audit_caption_for_20m_potential(caption, title=title)


@mcp.tool()
async def fb_trend_search(
    keywords: Optional[str] = None,
    sources: str = "all",
    limit: int = 5
) -> Dict[str, Any]:
    """
    Real-Time Multi-Platform Viral Topic & Trend Search Engine:
    Scans YouTube / Google Trends, Twitter/X breaking topics, and Reddit in real time.
    Returns:
    - Ranked viral trends with Virality Momentum Scores (0-100)
    - 5-Stage High-Retention Script Blueprint (Golden Hook -> Disrupt Assumptions -> Unveil Insider Secrets -> Ultimate Truth -> Elevation & Discussion)
    - Google Flow character and asset visual generation prompt
    """
    try:
        from core.trends import scan_all, scan_youtube, scan_twitter, scan_reddit, format_sticker_concept
        src_lower = (sources or "all").lower()
        results = {}
        if src_lower == "all":
            results = scan_all(limit=limit)
        else:
            if "youtube" in src_lower:
                results["youtube"] = scan_youtube(limit=limit)
            if "twitter" in src_lower or "x" in src_lower:
                results["twitter"] = scan_twitter(limit=limit)
            if "reddit" in src_lower:
                results["reddit"] = scan_reddit(limit_per_sub=max(2, limit // 2))

        all_items = []
        for p, items in results.items():
            all_items.extend(items)
        all_items.sort(key=lambda x: x.get("score", 0), reverse=True)

        top_concept = None
        if all_items:
            top_concept = format_sticker_concept(all_items[0])

        return {
            "success": True,
            "total_trends": len(all_items),
            "sources_scanned": list(results.keys()),
            "top_trend": all_items[0] if all_items else None,
            "recommended_blueprint": top_concept,
            "trends": all_items[:limit * 2]
        }
    except Exception as e:
        logger.error("Error in fb_trend_search: %s", e)
        return {"success": False, "error": str(e)}


@mcp.tool()
async def deepx_meta_status() -> Dict[str, Any]:
    """Check connection status between Meta Suite and the latest DeepX Google Flow Extension."""
    return deepx_meta.get_status()


@mcp.tool()
async def deepx_meta_generate_design(
    prompt: str,
    aspect_ratio: str = "4:5",
    model: str = "gemini-nano-banana-2.1"
) -> Dict[str, Any]:
    """Generate high-converting social designs and photo cards on Google Flow via DeepX (🍌 Nano Banana 2.1)."""
    return deepx_meta.generate_image(prompt=prompt, aspect_ratio=aspect_ratio, model=model)


@mcp.tool()
async def deepx_meta_generate_thumbnail(
    topic: str,
    aspect_ratio: str = "16:9"
) -> Dict[str, Any]:
    """
    Generate an agency-grade high-CTR viral thumbnail for Facebook/Instagram via DeepX Google Flow.
    Strictly follows Rule 8 (AI Image Model ONLY: volumetric rim lighting, 3D gradient text, translucent glass badge).
    """
    return deepx_meta.generate_viral_thumbnail(topic=topic, aspect_ratio=aspect_ratio)


@mcp.tool()
async def deepx_meta_generate_video(
    prompt: str,
    duration: int = 10,
    aspect_ratio: str = "9:16",
    model: str = "veo-3.1-lite"
) -> Dict[str, Any]:
    """Generate vertical Reels or video ads on Google Flow via Veo 3.1 & DeepX."""
    return deepx_meta.generate_video(prompt=prompt, duration=duration, aspect_ratio=aspect_ratio, model=model)


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


def check_platform_login_status(platform: str = "all") -> Dict[str, Any]:
    """Synchronous helper to check platform login readiness against the active session store."""
    active_sessions = db.list_active_sessions()
    session_map = {s["platform"]: s for s in active_sessions}
    platforms_to_check = ["facebook", "instagram", "business_suite", "youtube", "tiktok"]

    if platform != "all":
        sess = session_map.get(platform) or db.get_session(platform)
        logged_in = bool(sess and sess.get("status") in ("online", "healthy") and sess.get("is_active", 1))
        username = sess.get("username", "") if sess else ""
        return {
            "platform": platform,
            "logged_in": logged_in,
            "username": username,
            "message": "Authenticated and active session verified." if logged_in else "Not logged in or session expired."
        }

    platforms_res = {}
    for p in platforms_to_check:
        sess = session_map.get(p)
        logged_in = bool(sess and sess.get("status") in ("online", "healthy"))
        username = sess.get("username", "") if sess else ""
        platforms_res[p] = {
            "logged_in": logged_in,
            "username": username,
            "account_id": sess.get("account_id") if sess else None,
            "status": sess.get("status") if sess else "logged_out"
        }

    return {"platforms": platforms_res}


def _run_background_loop():
    bridge_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(bridge_loop)
    bridge_loop.run_until_complete(bridge.start())
    scheduler.start()
    logger.info("Background services (WebSocket bridge & APScheduler) permanently active on dedicated loop.")
    bridge_loop.run_forever()


def main():
    """Main entrypoint for MCP server with isolated background thread for bridge & scheduler."""
    t = threading.Thread(target=_run_background_loop, daemon=True)
    t.start()
    mcp.run()


if __name__ == "__main__":
    main()
