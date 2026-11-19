#!/usr/bin/env python3
"""
Antigravity Meta Suite - Production CLI & Operations Dashboard
Provides command-line management for the SQLite database, APScheduler queue,
WebSocket bridge, and zero-cost media generation engine.
"""

import os
import sys
import argparse
import json
import logging
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# Ensure project root is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from mcp_server.database import db
from mcp_server.policy_guardian import guardian
from mcp_server.free_media_seo import FreeMediaEngine, SocialSEOEngine
from mcp_server.scheduler_engine import scheduler
from mcp_server.bridge_server import bridge
from mcp_server.instagram_controller import ig_controller
from mcp_server.facebook_controller import fb_controller


def cmd_status(args):
    print("=" * 60)
    print("  ANTIGRAVITY META SUITE — PRODUCTION SYSTEM STATUS")
    print("=" * 60)

    # 1. Sessions
    sessions = db.list_all_sessions()
    active_sessions = [s for s in sessions if s.get("is_active") == 1]
    print(f"\n[Synced Accounts & Sessions]: {len(sessions)} total ({len(active_sessions)} active)")
    if not sessions:
        print("  -> No active sessions found. Load Chrome extension & log into IG/FB.")
    else:
        for s in sessions:
            plat = s["platform"].upper()
            user = s.get("username") or "N/A"
            acc_id = s.get("account_id")
            status = s.get("status")
            status_badge = "✅ Active" if s.get("is_active") == 1 else f"⚠️ {status}"
            if plat == "BUSINESS_SUITE" and status == "no_pages":
                status_badge = "ℹ️ No Pages Linked (Personal Profile Active)"
            print(f"  * [{plat}] Name: {user} | ID: {acc_id}")
            print(f"    Status: {status_badge} | Last Synced: {s.get('last_synced_at')}")

    # 2. Rate Limits & Quotas
    print("\n[Rolling 24-Hour Quota Status]:")
    for s in active_sessions:
        plat = s["platform"]
        acc = s["account_id"]
        valid, msg = guardian.validate_publish_action(plat, acc, bypass_spacing=True)
        status_sym = "✅ Compliant" if valid else f"⚠️ Throttled ({msg})"
        print(f"  * {plat.upper()} ({acc}): {status_sym}")

    # 3. Scheduled Queue
    queue = scheduler.list_queue()
    print(f"\n[Scheduled Jobs in Queue]: {len(queue)}")
    for j in queue[:5]:
        print(f"  #ID {j['id']} | {j['platform'].upper()}:{j['content_type']} | Run at: {j['schedule_time_iso']} | Status: {j['status']}")
    if len(queue) > 5:
        print(f"  ... and {len(queue) - 5} more jobs.")

    print("\n" + "=" * 60)


def cmd_queue(args):
    queue = scheduler.list_queue(limit=args.limit)
    print(f"\nTotal jobs retrieved: {len(queue)}\n")
    if not queue:
        print("  Queue is empty.")
        return

    for j in queue:
        print(f"Job #{j['id']}:")
        print(f"  Platform:    {j['platform']} ({j['target_type']}: {j.get('target_id')})")
        print(f"  Content:     {j['content_type']}")
        print(f"  Scheduled:   {j['schedule_time_iso']}")
        print(f"  Status:      {j['status']} (Retries: {j.get('retry_count', 0)}/{j.get('max_retries', 3)})")
        if j.get("published_media_id"):
            print(f"  Published ID:{j['published_media_id']}")
        if j.get("error_message"):
            print(f"  Last Error:  {j['error_message']}")
        print("-" * 50)


def cmd_cancel(args):
    if args.all:
        with db.get_connection() as conn:
            cursor = conn.execute("UPDATE scheduled_jobs SET status='cancelled' WHERE status IN ('pending', 'processing', 'paused');")
            conn.commit()
            print(f"✅ Cancelled {cursor.rowcount} queued jobs.")
    elif args.id:
        scheduler.cancel_job(args.id)
        print(f"✅ Cancelled Job #{args.id}.")
    else:
        print("Error: Specify --id <job_id> or --all to cancel jobs.")


def cmd_retry(args):
    now_iso = datetime.now(timezone.utc).isoformat()
    db.reset_job_retry_count(args.id)
    db.reschedule_job(args.id, now_iso, error_message=None, increment_retry=False)
    print(f"✅ Reset and scheduled Job #{args.id} for immediate retry (retries reset to 0/3).")


def cmd_clear_queue(args):
    statuses = [s.strip() for s in args.statuses.split(",")]
    count = db.clear_jobs(statuses=statuses)
    print(f"✅ Purged {count} jobs with status in {statuses}.")


def cmd_post(args):
    platform = args.platform.lower()
    content_type = args.type.lower()
    media_paths = [args.media] if args.media else []

    print(f"\nDispatching {content_type} post to {platform.upper()} ({args.target})...")

    if args.schedule:
        payload = {
            "media_paths": media_paths,
            "caption": args.caption,
            "description": args.caption,
            "hashtags": [h.strip("#") for h in args.hashtags.split()] if args.hashtags else [],
            "auto_publish": True,
            "bypass_spacing": True
        }
        res = scheduler.schedule_job(
            platform=platform,
            target_type=args.target,
            target_id=args.target_id,
            content_type=content_type,
            payload=payload,
            schedule_time_iso=args.schedule
        )
        print(f"✅ Job enqueued successfully: Job #{res.get('job_id')} at {res.get('schedule_time_iso')}")
    else:
        hashtags = [h.strip("#") for h in args.hashtags.split()] if args.hashtags else []
        if platform == "instagram":
            if content_type == "text":
                print("Note: Instagram requires media. Auto-synthesizing compliant typography graphic...")
                img_path = FreeMediaEngine.generate_image(
                    title_overlay=args.caption[:35],
                    subtitle_overlay="Antigravity Meta Suite"
                )
                res = ig_controller.publish_feed_photo(
                    image_path=img_path,
                    caption=args.caption,
                    hashtags=hashtags,
                    bypass_spacing=args.force
                )
                print(f"✅ Published to Instagram Feed! Media ID: {res.get('media_id')} | Link: {res.get('permalink')}")
            elif content_type == "photo":
                if not media_paths:
                    print("Error: --media path is required for Instagram photo post.")
                    return
                res = ig_controller.publish_feed_photo(
                    image_path=media_paths[0],
                    caption=args.caption,
                    hashtags=hashtags,
                    bypass_spacing=args.force
                )
                print(f"✅ Published to Instagram Feed! Media ID: {res.get('media_id')} | Link: {res.get('permalink')}")
            elif content_type == "reel":
                if not media_paths:
                    print("Error: --media path is required for Instagram Reel.")
                    return
                res = ig_controller.publish_reel(
                    video_path=media_paths[0],
                    caption=args.caption,
                    hashtags=hashtags,
                    bypass_spacing=args.force
                )
                print(f"✅ Published Instagram Reel! Media ID: {res.get('media_id')}")
            else:
                print(f"Error: Unsupported Instagram content type: {content_type}")
        elif platform == "facebook":
            if args.target in ("profile", "group", "page") and not fb_controller.bridge.clients:
                # Live background daemon holds the WebSocket connection; enqueue immediate job
                payload = {
                    "media_paths": media_paths if media_paths else None,
                    "caption": args.caption,
                    "description": args.caption,
                    "hashtags": hashtags,
                    "bypass_spacing": True,
                    "auto_publish": True
                }
                res = scheduler.schedule_job(
                    platform="facebook",
                    target_type=args.target,
                    target_id=args.target_id or "me",
                    content_type=content_type,
                    payload=payload,
                    schedule_time_iso=datetime.now(timezone.utc).isoformat()
                )
                print(f"✅ Immediate post enqueued to live daemon queue: Job #{res.get('job_id')} at {res.get('schedule_time_iso')}")
                print("The active background daemon will dispatch via Chrome Extension in ~10s.")
            else:
                res = fb_controller.publish_or_schedule(
                    target_type=args.target,
                    target_id=args.target_id or "me",
                    content_type=content_type,
                    media_paths=media_paths if media_paths else None,
                    description=args.caption,
                    hashtags=hashtags,
                    bypass_spacing=args.force
                )
                print(f"✅ Published to Facebook ({args.target})! Result: {res}")
        else:
            print(f"Error: Unknown platform '{platform}'")


def cmd_batch(args):
    print("=" * 65)
    print("  🚀 HUMANIZED BATCH SCHEDULER (ANTI-DETECTION 10-25+ POSTS)")
    print(f"  Platform: {args.platform.upper()} | Target: {args.target} ({args.target_id or 'me'})")
    print("=" * 65)

    posts = []
    if args.file and os.path.exists(args.file):
        with open(args.file, "r", encoding="utf-8") as f:
            posts = json.load(f)
    elif args.sample:
        count = args.sample
        topics = [
            ("ताजा समसामयिक घटनाक्रम (२०८१/८२) – लोकसेवा विशेष", "नासु तथा अधिकृत परीक्षार्थीहरूले छुटाउनै नहुने मुख्य समसामयिक बुँदाहरू..."),
            ("नेपालको ताजा आर्थिक परिदृश्य र विश्व बैंक प्रतिवेदन", "आर्थिक वर्ष २०८२/८३ का लागि नेपालको जीडीपी वृद्धिदर २.१% प्रक्षेपण..."),
            ("बौद्धिक परीक्षण (IQ) का जादुई Shortcut Tricks", "प्रथम पत्रको वस्तुगत परीक्षामा समय बचाउने ५ अचूक सर्टकटहरू..."),
            ("नेपालको संविधान – मौलिक हक र धारा सम्झने सुत्र", "भाग ३, धारा १६ देखि ४६ सम्मका मौलिक हकहरू सजिलै कण्ठ पार्ने वैज्ञानिक सूत्र..."),
            ("सार्वजनिक सेवा प्रवाह र सुशासनका स्तम्भहरू", "प्रशासनिक कार्यसम्पादन, नागरिक बडापत्र र पारदर्शिताका मुख्य सिद्धान्त..."),
            ("विपद् जोखिम न्यूनीकरण र व्यवस्थापन ऐन २०७४", "नेपालमा बाढी, पहिरो तथा जलवायु परिवर्तनको प्रभाव र कानुनी संयन्त्र..."),
            ("नेपालको परराष्ट्र नीति र छिमेकी सम्बन्ध", "पञ्चशीलको सिद्धान्त, असंलग्न परराष्ट्र नीति र नेपालको भू-रणनीतिक महत्व..."),
            ("शाखा अधिकृत दोस्रो पत्र: समस्या समाधान मोडेल", "विषयगत उत्तर लेख्दा अङ्क तान्ने संरचना: परिचय, विश्लेषण, सुझाव र निष्कर्ष..."),
            ("संघीय शासन प्रणाली र वित्तीय संघीयता", "स्थानीय तह, प्रदेश र संघबीचको राजस्व बाँडफाँड र वित्तीय समानीकरण अनुदान..."),
            ("सार्वजनिक खरिद ऐन २०६३ का प्रमुख व्यवस्थाहरू", "बोलपत्र आह्वान, ठेक्का व्यवस्थापन र सार्वजनिक खरिद अनुगमन कार्यालयका कार्य..."),
            ("नेपालको जलस्रोत र ऊर्जा विकास रणनीति", "१० वर्षमा १० हजार मेगावाट विद्युत भारत निर्यात गर्ने दीर्घकालीन सम्झौता..."),
            ("सूचना प्रविधि नीति र डिजिटल नेपाल फ्रेमवर्क", "आठ वटा स्तम्भ (8 Domains) र ८० वटा डिजिटल डिजिटल पहलहरूको संक्षिप्त सार..."),
            ("मानव अधिकार संरक्षण र राष्ट्रिय मानव अधिकार आयोग", "संवैधानिक निकायको भूमिका, सिफारिस कार्यान्वयन र कानुनी चुनौतिहरू..."),
            ("कर्मचारी समायोजन र निजामती सेवा विधेयक २०८०", "निजामती प्रशासन सुधारका लागि प्रस्तावित नयाँ ऐनका मुख्य विशेषताहरू..."),
            ("दिगो विकास लक्ष्य (SDGs 2030) र नेपालको प्रगति", "१७ वटा लक्ष्य, १६९ वटा गन्तव्य र नेपालको वर्तमान कार्यान्वयन स्थिति...")
        ]
        for i in range(count):
            t, cap = topics[i % len(topics)]
            posts.append({
                "title": f"[{i + 1}/{count}] {t}",
                "caption": f"🚨 {t}\n\n{cap}\n\n📌 Save & Share for revision!\n\n#LoksewaNepal #CivilService #StudyBatch #RenukaYadav",
                "hashtags": ["LoksewaNepal", "CivilService", "LoksewaPreparation", "RenukaYadav"]
            })

    if not posts:
        print("Error: Specify --file <posts.json> or --sample <number_of_posts> (e.g. --sample 15)")
        return

    res = scheduler.schedule_humanized_batch(
        platform=args.platform.lower(),
        target_type=args.target,
        target_id=args.target_id,
        content_type=args.type,
        posts=posts,
        immediate_first_post=True,
        min_gap_minutes=args.min_gap,
        max_gap_minutes=args.max_gap
    )

    print(f"\n✅ Batch {res['batch_id']} Created Successfully!")
    print(f"  Total Posts:     {res['total_posts']}")
    print(f"  Immediate Post:  {res['immediate_posts']} (Now)")
    print(f"  Scheduled Posts: {res['scheduled_posts']} (Across Peak Engagement Windows)")
    print("\n[Anti-Detection & Velocity Safeguards Active]:")
    print(f"  • Velocity Model:       {res['anti_detection_profile']['velocity_guard']}")
    print(f"  • Creation Guard:       {res['anti_detection_profile']['creation_burst_protection']}")
    print(f"  • Hourly Cap:           Max {res['anti_detection_profile']['rolling_hourly_limit']} posts / 60 min")
    print(f"  • Session Rest Breaks:  {res['anti_detection_profile']['session_rest_breaks']}")
    print("\n[Humanized Distribution Timeline]:")
    for item in res["timeline"]:
        p_mode = "🚀 LIVE NOW" if item["mode"] == "immediate" else f"⏰ +{item['gap_from_previous_minutes']}m ({item['window']})"
        print(f"  #{item['post_index']:02d} [{p_mode}] Job #{item['job_id']}:")
        print(f"      Time: {item['scheduled_time_iso']}")
        print(f"      Title: {item['title'][:55]}...")
        print(f"      Simulated Prep: {item['simulated_prep_seconds']}s")
    print("=" * 65)


def cmd_test_upload(args):
    print("=" * 60)
    print("  DIAGNOSTIC TEST: MEDIA GENERATION & UPLOAD PIPELINE")
    print("=" * 60)

    # 1. Render test image
    print("\n[Step 1/3] Generating test studio image...")
    img_path = FreeMediaEngine.generate_image(
        title_overlay=args.title or "System Test",
        subtitle_overlay="Antigravity Meta Bridge"
    )
    print(f"  -> Generated: {img_path} ({os.path.getsize(img_path)} bytes)")

    # 2. Check session
    print(f"\n[Step 2/3] Checking active session for {args.platform.upper()}...")
    session = db.get_session(args.platform)
    if not session:
        print(f"  ❌ No active session found for {args.platform}. Log in on Chrome first.")
        return
    print(f"  -> Found session for account: {session.get('account_id')} (@{session.get('username')})")

    # 3. Dry-run or publish
    if args.dry_run:
        print("\n[Step 3/3] Dry run complete. Media and session are valid.")
    else:
        print(f"\n[Step 3/3] Publishing test photo to {args.platform.upper()}...")
        if args.platform == "instagram":
            res = ig_controller.publish_feed_photo(
                image_path=img_path,
                caption="🧪 Antigravity Meta Bridge Diagnostic Test #systemtest",
                hashtags=["test", "automation"]
            )
            print(f"  ✅ Published! Media ID: {res.get('media_id')} | Link: {res.get('permalink')}")
        else:
            res = fb_controller.publish_or_schedule(
                target_type="profile",
                target_id=str(session.get("account_id")),
                content_type="photo",
                media_paths=[img_path],
                description="🧪 Antigravity Meta Bridge Diagnostic Test #systemtest",
                bypass_spacing=True
            )
            print(f"  ✅ Published! Result: {res}")


def cmd_render_media(args):
    print(f"\nGenerating {args.type} asset with FreeMediaEngine...")
    if args.type == "image":
        path = FreeMediaEngine.generate_image(
            prompt=args.prompt,
            aspect_ratio=args.aspect,
            title_overlay=args.title,
            subtitle_overlay=args.subtitle
        )
        print(f"✅ Rendered compliant JPEG image at: {path}")
    elif args.type == "reel":
        script = args.script or "Discover the future of organic social media automation for zero dollars."
        audio_path, srt_path = FreeMediaEngine.generate_voiceover_and_srt(
            text=script,
            voice=args.voice
        )
        img_path = FreeMediaEngine.generate_image(
            prompt=args.prompt or "minimalist futuristic tech neon",
            aspect_ratio="9:16",
            title_overlay=args.title or "Automate Everything",
            subtitle_overlay=args.subtitle or "100% Free Open-Source"
        )
        video_path = FreeMediaEngine.render_reel_video(
            image_or_video_path=img_path,
            audio_path=audio_path,
            srt_path=srt_path
        )
        print(f"✅ Rendered Meta-compliant faststart Reel MP4 at: {video_path}")


def cmd_viral_hooks(args):
    hooks = SocialSEOEngine.get_viral_hooks(category=args.category, count=args.count)
    print(f"\nTop {len(hooks)} Viral Hooks for Category '{args.category.upper()}':")
    for i, h in enumerate(hooks, 1):
        score_info = SocialSEOEngine.score_retention_hook(h)
        print(f" {i}. \"{h}\"")
        print(f"    -> Virality Score: {score_info['score']}/100 [{score_info['grade']}]")


def cmd_bridge(args):
    import signal
    print("=" * 60)
    print("  ANTIGRAVITY META SUITE — LIVE BRIDGE DAEMON")
    print("  WebSocket Bridge: ws://127.0.0.1:8765")
    print("=" * 60)

    scheduler.start(poll_interval_seconds=args.interval)
    print(f"✅ Background APScheduler active (polling SQLite queue every {args.interval}s).")

    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def shutdown(signum=None, frame=None):
        sig_name = f"Signal {signum}" if signum else "User interrupt"
        print(f"\n[DAEMON]: Received {sig_name}. Initiating graceful shutdown...")
        try:
            scheduler.stop()
        except Exception:
            pass
        if loop and loop.is_running():
            loop.call_soon_threadsafe(loop.stop)

    try:
        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)
    except (ValueError, AttributeError):
        pass

    try:
        loop.run_until_complete(bridge.start())
        print("✅ WebSocket Bridge listening on ws://127.0.0.1:8765.")
        print("Waiting for Chrome Extension connection... (Press Ctrl+C or send SIGTERM to stop)")
        loop.run_forever()
    finally:
        print("\nStopping services and flushing SQLite WAL buffer...")
        try:
            scheduler.stop()
        except Exception:
            pass
        try:
            loop.run_until_complete(bridge.stop())
        except Exception:
            pass
        try:
            with db.get_connection() as conn:
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        except Exception:
            pass
        print("Stopped cleanly. All resources released.")


def cmd_reload_extension(args):
    import asyncio, websockets
    async def trigger():
        try:
            async with websockets.connect("ws://127.0.0.1:8765", open_timeout=2) as ws:
                await ws.send(json.dumps({"type": "TRIGGER_EXTENSION_RELOAD"}))
                res = await ws.recv()
                print("✅ Broadcasted extension reload signal to Chrome Extension bridge:", res)
        except Exception as e:
            print("❌ Failed to contact bridge daemon at ws://127.0.0.1:8765:", e)
    asyncio.run(trigger())


def cmd_open(args):
    import asyncio
    import websockets
    import webbrowser
    platform = args.platform.lower().strip()
    urls = {
        "facebook": "https://www.facebook.com/",
        "instagram": "https://www.instagram.com/",
        "business_suite": "https://business.facebook.com/latest/composer",
        "youtube": "https://studio.youtube.com",
        "tiktok": "https://www.tiktok.com/creator-center/upload"
    }
    target_url = urls.get(platform, "https://www.facebook.com/")

    async def run_open():
        try:
            async with websockets.connect("ws://127.0.0.1:8765") as ws:
                await ws.send(json.dumps({
                    "type": "OPEN_CANVAS",
                    "platform": platform
                }))
                res = await ws.recv()
                print(f"✅ Canvas open command dispatched via active Chrome Extension bridge for [{platform}]: {res}")
        except Exception as e:
            print(f"⚠️ Active bridge daemon not reachable directly ({e}). Opening URL directly in default browser...")
            webbrowser.open(target_url)

    asyncio.run(run_open())


def cmd_logout(args):
    import asyncio
    import websockets
    platform = args.platform.lower().strip()
    account_id = getattr(args, "account_id", None)

    # 1. Clear session in SQLite database
    db.delete_session(platform, account_id)
    print(f"✅ Marked session as logged out in SQLite database for platform [{platform}] (account: {account_id or 'all'}).")

    # 2. Instruct active Chrome Extension to clear cookies
    async def run_logout():
        try:
            async with websockets.connect("ws://127.0.0.1:8765") as ws:
                await ws.send(json.dumps({
                    "type": "LOGOUT_ACCOUNT",
                    "platform": platform,
                    "account_id": account_id
                }))
                res = await ws.recv()
                print(f"✅ Cookie purge and logout signal confirmed by Chrome Extension: {res}")
        except Exception as e:
            print(f"ℹ️ Active bridge daemon notice: {e} (cookies will sync on next extension connection).")

    asyncio.run(run_logout())


def cmd_youtube(args):
    print("\n[YouTube Studio] Autonomous GhostHuman Upload:")
    print(f"  Title:    {args.title}")
    print(f"  Media:    {args.media}")
    print(f"  Auto-SEO: {getattr(args, 'auto_seo', False)}")
    try:
        from mcp_server.youtube_controller import youtube
        res = youtube.publish_or_schedule(
            title=args.title,
            description=args.desc or "",
            media_path=args.media,
            tags=args.tags.split(",") if args.tags else None,
            is_short=args.short,
            made_for_kids=args.kids,
            visibility=args.visibility,
            bypass_spacing=args.bypass_spacing,
            auto_seo=getattr(args, "auto_seo", False)
        )
        print(f"✅ Success! Published to YouTube: {res.get('video_url')}")
        if res.get("tags_count"):
            print(f"   Injected Tags: {res['tags_count']} tags | Optimized Title: {res.get('title')}")
    except Exception as e:
        print(f"❌ YouTube upload failed: {e}")


def cmd_seo_analyze(args):
    print("=" * 65)
    print("  ANTIGRAVITY VIDEO SEO & VIRAL CONTENT ANALYZER")
    print("=" * 65)

    if not os.path.exists(args.media):
        print(f"❌ Error: Media file not found: {args.media}")
        return

    from mcp_server.video_seo_analyzer import seo_analyzer

    print(f"\n[1. Ingesting & Inspecting Media]: {args.media}")
    res = seo_analyzer.analyze_and_generate_all(
        media_path=args.media,
        topic_hint=args.topic,
        channel_name="Renuka Yadav"
    )

    info = res["video_info"]
    print(f"  • Filename:     {info['filename']}")
    print(f"  • Resolution:   {info['width']}x{info['height']} ({info['aspect_ratio']})")
    print(f"  • Duration:     {info['duration_formatted']} ({info['duration']}s)")
    print(f"  • Class:        {'📱 Short / Reel' if info['is_short'] else '📺 Long-form Video'}")
    print(f"  • Audio:        {'✅ ' + info['audio_codec'] if info['has_audio'] else '❌ None'}")
    print(f"  • Inferred:     {res['topic']}")

    platform = (args.platform or "all").lower()

    if platform in ("youtube", "all"):
        yt = res["youtube"]
        ctr = yt.get("ctr_evaluation", {})
        thumb = yt.get("thumbnail_brief", {})
        print("\n" + "─" * 65)
        print("🔴 YOUTUBE KILLER DIRECTORIAL PACKAGE (OUR #1 PRIORITY)")
        print("─" * 65)
        print(f"🎯 VIRAL CTR RATING: {ctr.get('ctr_score', 85)}/100 [{ctr.get('grade', 'Viral')}]")
        print("📌 3 RANKED TITLE OPTIONS (Keyword in first 40 chars, <70 chars):")
        print(f"  🥇 Recommended: {yt['title_options']['recommended']} ({len(yt['title_options']['recommended'])} chars)")
        print(f"  🥈 Search Match: {yt['title_options']['alternative_a_search']}")
        print(f"  🥉 Curiosity:    {yt['title_options']['alternative_b_curiosity']}")

        print(f"\n🖼️ THUMBNAIL DIRECTORIAL BRIEF:")
        print(f"  • Concept:  {thumb.get('visual_concept')}")
        print(f"  • Text:     \"{thumb.get('overlay_text')}\" (Bold static heavyweight typography)")
        print(f"  • Colors:   {thumb.get('color_palette')}")
        print(f"  • Rule:     {thumb.get('focal_rule')}")

        print(f"\n🏷️ CARTESIAN PRODUCT TAGS ({yt['tags_count']} tags | {yt['tags_char_count']}/500 chars):")
        print(f"  {', '.join(yt['tags'][:14])} ...")
        print(f"  📋 Copy-Paste Box:")
        print(f"  {', '.join(yt['tags'])}")

        print(f"\n💬 PINNED ENGAGEMENT VELOCITY COMMENT (<300 chars):")
        print(f"  \"{yt['pinned_comment']}\"")

        if yt.get("community_post"):
            print(f"\n📢 COMPANION COMMUNITY TAB POST (Cross-Promotion):")
            print("  " + yt["community_post"].replace("\n", "\n  "))

        if not yt["is_short"] and yt.get("chapters"):
            print(f"\n⏯️ AUTO-GENERATED CHAPTER TIMESTAMPS:")
            for c in yt["chapters"]:
                print(f"  {c['time']} — {c['title']}")

        print(f"\n📝 RETENTION-ENGINEERED DESCRIPTION (Ready to Copy):")
        print("  " + yt["description"].replace("\n", "\n  "))

    if platform in ("meta_business_suite", "business_suite", "page", "all"):
        bs = res["meta_business_suite"]
        print("\n" + "─" * 65)
        print(f"👑 META BUSINESS SUITE PAGE POST ({bs['target_page_name']} - ID: {bs['target_page_id']})")
        print("─" * 65)
        print("📝 AUTHORITY BLUEPRINT POST (Anti-Book whitespace format):")
        print("  " + bs["full_post_text"].replace("\n", "\n  "))
        print("\n💬 FIRST PINNED COMMENT (Zero Reach Suppression Guarantee):")
        print("  " + bs["first_comment_text"].replace("\n", "\n  "))

    if platform in ("instagram", "all"):
        ig = res["instagram"]
        print("\n" + "─" * 65)
        print("📸 INSTAGRAM ANTI-BOOK POST (@renukayadav & Rule #5)")
        print("─" * 65)
        print(f"🎵 Sound Vibe: {ig.get('sound_recommendation', 'Trending audio')}")
        print("📌 3-TIER HASHTAG LADDER (from InstagramOSINT):")
        print(f"  • High Volume (>1M):    {', '.join(ig['hashtag_ladder']['high_competition'])}")
        print(f"  • Mid Niche (100k-500k): {', '.join(ig['hashtag_ladder']['mid_competition'])}")
        print(f"  • Micro Community:       {', '.join(ig['hashtag_ladder']['micro_community'])}")
        print(f"\n📝 ANTI-BOOK CAPTION (1-2 line micro-bites):")
        print("  " + ig["full_caption"].replace("\n", "\n  "))

    if platform in ("tiktok", "all"):
        tt = res["tiktok"]
        print("\n" + "─" * 65)
        print("🎵 TIKTOK VIRAL SEO PACKAGE (tiktok-hashtags-api)")
        print("─" * 65)
        print(f"🎵 Recommended Sound: {tt.get('sound_recommendation')}")
        print(f"👁️ On-Screen Hook:    \"{tt.get('on_screen_hook_text')}\"")
        print("📌 3-TIER HASHTAG HIERARCHY:")
        print(f"  • Tier 1 Viral:    {', '.join(tt['tag_hierarchy']['tier1_viral'])}")
        print(f"  • Tier 2 Niche:    {', '.join(tt['tag_hierarchy']['tier2_niche'])}")
        print(f"  • Tier 3 Specific: {', '.join(tt['tag_hierarchy']['tier3_entity'])}")
        print(f"\n📝 FULL CAPTION ({tt['char_count']} chars):")
        print("  " + tt["caption"].replace("\n", "\n  "))

    if platform in ("facebook", "all"):
        fb = res["facebook"]
        print("\n" + "─" * 65)
        print("📘 FACEBOOK PERSONAL FEED STORYTELLING POST")
        print("─" * 65)
        print("  " + fb["full_post_text"].replace("\n", "\n  "))

    print("\n" + "=" * 65)


def cmd_publish_video(args):
    print("=" * 60)
    print("  ANTIGRAVITY AUTONOMOUS VIDEO PUBLISHER")
    print("=" * 60)

    if not os.path.exists(args.media):
        print(f"❌ Error: Media file not found: {args.media}")
        return

    platform = args.platform.lower()
    auto_seo = getattr(args, "auto_seo", True)
    topic = getattr(args, "topic", "") or ""

    # Pre-Flight Login Check (Strict User Law)
    from mcp_server.server import check_platform_login_status
    target_key = "business_suite" if platform in ("meta_business_suite", "page") else platform
    login_check = check_platform_login_status(target_key)
    if not login_check.get("logged_in", False):
        print(f"\n❌ BLOCKED: Your {target_key.replace('_', ' ').title()} account is NOT logged in!")
        print(f"   {login_check.get('message')}")
        print(f"   Please open Chrome and log in to {target_key.replace('_', ' ').title()} before publishing.")
        return

    if platform == "youtube":
        from mcp_server.youtube_controller import youtube
        print(f"\n[Publishing to YouTube Studio] Media: {args.media} | Auto-SEO: {auto_seo}")
        res = youtube.publish_or_schedule(
            title=topic or "Autonomous Video Upload",
            media_path=args.media,
            is_short=args.short,
            auto_seo=auto_seo,
            bypass_spacing=args.bypass_spacing
        )
        print(f"✅ Published to YouTube: {res.get('video_url')}")
        print(f"   Title: {res.get('title')}")
        print(f"   Tags Injected: {res.get('tags_count', 0)}")

    elif platform == "tiktok":
        from mcp_server.tiktok_controller import tiktok
        from mcp_server.video_seo_analyzer import seo_analyzer
        seo_data = seo_analyzer.analyze_and_generate_all(args.media, topic_hint=topic)
        caption = seo_data["tiktok"]["caption"]
        print(f"\n[Publishing to TikTok Creator Center] Media: {args.media}")
        res = tiktok.publish_or_schedule(
            caption=caption,
            media_path=args.media,
            bypass_spacing=args.bypass_spacing
        )
        print(f"✅ Published to TikTok: {res.get('url')}")

    elif platform == "instagram":
        from mcp_server.instagram_controller import ig_controller
        from mcp_server.video_seo_analyzer import seo_analyzer
        seo_data = seo_analyzer.analyze_and_generate_all(args.media, topic_hint=topic)
        caption = seo_data["instagram"]["full_caption"]
        print(f"\n[Publishing to Instagram] Media: {args.media}")
        res = ig_controller.publish_reel(
            video_path=args.media,
            caption=caption,
            bypass_spacing=args.bypass_spacing
        )
        print(f"✅ Published to Instagram Reel: {res.get('permalink', res.get('id'))}")

    elif platform in ("facebook", "fb", "profile"):
        from mcp_server.facebook_controller import fb_controller
        from mcp_server.video_seo_analyzer import seo_analyzer
        seo_data = seo_analyzer.analyze_and_generate_all(args.media, topic_hint=topic)
        caption = seo_data["facebook"]["full_post_text"]
        print(f"\n[Publishing to Facebook Profile Feed] Media: {args.media}")
        res = fb_controller.publish_reel(
            video_path=args.media,
            caption=caption,
            target_type="profile",
            target_id="61592442011195",
            bypass_spacing=args.bypass_spacing
        )
        print(f"✅ Published to Facebook Profile: {res}")

    elif platform in ("meta_business_suite", "page", "motivational_docqueen", "mbs"):
        from mcp_server.facebook_controller import fb_controller
        from mcp_server.video_seo_analyzer import seo_analyzer
        seo_data = seo_analyzer.analyze_and_generate_all(args.media, topic_hint=topic)
        caption = seo_data["meta_business_suite"]["full_post_text"]
        print(f"\n[Publishing to Meta Business Suite Page: Motivational Docqueen] Media: {args.media}")
        res = fb_controller.publish_reel(
            video_path=args.media,
            caption=caption,
            target_type="page",
            target_id="1409644015561854",
            bypass_spacing=args.bypass_spacing
        )
        print(f"✅ Published to Meta Business Suite Page: {res}")


def cmd_pipeline(args):
    print("=" * 65)
    print("  🚀 FIXED-ROUTE AUTONOMOUS VIDEO PIPELINE (ZERO OVERTHINKING)")
    print("=" * 65)

    from mcp_server.server import fixed_route_video_prep, publish_or_schedule_video_with_seo

    media_path = getattr(args, "media", None)
    topic = getattr(args, "topic", "") or ""

    # Phase 1: Autonomous Video Prep (Find -> Transcript/SEO -> Thumbnail)
    print("\n▶ [Phase 1: Autonomous Video Prep & Analysis]")
    prep = fixed_route_video_prep(media_path=media_path, topic_hint=topic)
    video_file = prep["video_path"]
    print(f"  ✓ Video Found:     {video_file}")
    print(f"  ✓ Transcript SEO:  {prep['seo_data']['core_metadata']['duration_formatted']} duration")
    print(f"  ✓ Thumbnail Made:  {prep['thumbnail_path']}")
    print(f"  ✓ Flow Prompt:     {prep['google_flow_prompt'][:70]}...")

    # Phase 2: Platform Selection
    plat = getattr(args, "platform", None)
    if not plat:
        print("\nSelect target platform:")
        print("  1. youtube")
        print("  2. instagram")
        print("  3. facebook (profile)")
        print("  4. meta_business_suite (page: Motivational Docqueen)")
        print("  5. tiktok")
        choice = input("Enter platform number or name [1-5]: ").strip().lower()
        mapping = {
            "1": "youtube",
            "2": "instagram",
            "3": "facebook",
            "4": "meta_business_suite",
            "5": "tiktok"
        }
        plat = mapping.get(choice, choice or "youtube")

    schedule_time = getattr(args, "schedule", None)
    if not schedule_time and getattr(args, "interactive", False):
        sched_choice = input("Direct publish (now) or Schedule? [d/s]: ").strip().lower()
        if sched_choice == "s":
            schedule_time = input("Enter schedule time ISO (e.g. 2026-11-05T14:30:00Z): ").strip()

    print(f"\n▶ [Phase 2: Publishing to {plat.upper()}]")
    res = publish_or_schedule_video_with_seo(
        media_path=video_file,
        platform=plat,
        topic_hint=topic,
        thumbnail_path=prep.get("thumbnail_path"),
        schedule_time_iso=schedule_time,
        bypass_spacing=getattr(args, "bypass_spacing", False)
    )
    print(f"\n✅ Result: {json.dumps(res, indent=2)}")
    print("=" * 65)


def cmd_thumbnail(args):
    print("=" * 60)
    print("  ANTIGRAVITY CLICKBAIT THUMBNAIL & POST CARD GENERATOR")
    print("=" * 60)
    from mcp_server.thumbnail_engine import thumbnail_engine
    out = thumbnail_engine.generate_clickbait_thumbnail(
        crazy_title=args.title,
        subtitle=args.sub or "",
        reference_media=args.media if (hasattr(args, "media") and args.media) else None,
        aspect_ratio=args.ratio or "16:9",
        color_theme=args.theme or "canary_crimson",
        badge_text=args.badge
    )
    print(f"✅ Thumbnail Generated Successfully!")
    print(f"  • File:   {out}")
    print(f"  • Ratio:  {args.ratio or '16:9'}")
    print(f"  • Title:  {args.title}")
    print(f"  • Sub:    {args.sub or 'None'}")


def cmd_login_status(args):
    print("=" * 60)
    print("  PLATFORM LOGIN STATUS PRE-FLIGHT AUDIT")
    print("=" * 60)
    from mcp_server.server import check_platform_login_status
    plat = getattr(args, "platform", "all") or "all"
    res = check_platform_login_status(plat)
    if "platforms" in res:
        for p, s in res["platforms"].items():
            status_icon = "✅ LOGGED IN" if s["logged_in"] else "❌ NOT LOGGED IN"
            user_str = f"({s['username']})" if s['username'] else ""
            print(f"  • {p.replace('_', ' ').title():<22}: {status_icon} {user_str}")
    else:
        status_icon = "✅ LOGGED IN" if res["logged_in"] else "❌ NOT LOGGED IN"
        user_str = f"({res.get('username')})" if res.get('username') else ""
        print(f"  • {res['platform'].replace('_', ' ').title():<22}: {status_icon} {user_str}")
        print(f"    Message: {res['message']}")


def cmd_tiktok(args):
    print("\n[TikTok Creator Center] Autonomous GhostHuman Upload:")
    print(f"  Caption: {args.caption}")
    print(f"  Media:   {args.media}")
    try:
        from mcp_server.tiktok_controller import tiktok
        res = tiktok.publish_or_schedule(
            caption=args.caption,
            media_path=args.media,
            privacy=args.privacy,
            bypass_spacing=args.bypass_spacing
        )
        print(f"✅ Success! Published to TikTok.")
    except Exception as e:
        print(f"❌ TikTok upload failed: {e}")


def cmd_creative_prompt(args):
    from mcp_server.creative_director import CreativeDirector
    prompt = CreativeDirector.build_prompt(
        archetype=args.archetype,
        headline=args.headline,
        tagline=args.tagline,
        body_points=args.points,
        keys=args.keys
    )
    print("\n" + "="*70)
    print(f"🎨 CREATIVE DIRECTOR PROMPT [{args.archetype.upper()}]")
    print("="*70)
    print(prompt)
    print("="*70 + "\n")


def cmd_trends(args):
    from mcp_server.trend_reach_engine import trend_engine
    sources = [s.strip() for s in args.sources.split(",")] if args.sources else None
    print("=" * 65)
    print(f"  ⚡ TREND REACH RADAR — LIVE BREAKOUT DISCOVERY")
    print(f"  Keywords: '{args.keywords}' | Competitor: '{args.competitor or 'N/A'}'")
    print("=" * 65)

    res = trend_engine.scan_all_trends(
        keywords=args.keywords,
        sources=sources,
        competitor_channel=args.competitor,
        min_viral_score=args.min_score,
        limit=args.limit
    )

    print(f"\nDiscovered {len(res['trends'])} trends in {res['execution_time_ms']}ms across {res['sources_scanned']}:\n")
    for t in res["trends"]:
        r = t.get("radar", {})
        print(f"  [{t['platform'].upper()}] {r.get('tier', 'TREND')} ({r.get('viral_score', 0)}/100) | {r.get('velocity_label', '')}")
        print(f"    Title:     {t['title']}")
        print(f"    Channel:   {t.get('channel', 'Creator')} | Freshness: {t.get('published_time_text', 'recent')}")
        print(f"    URL:       {t.get('url', '')}")
        print("-" * 65)


def cmd_twitter_trends(args):
    from mcp_server.trend_reach_engine import trend_engine
    print("=" * 70)
    print("  🐦 REAL-TIME TWITTER / X BREAKOUT RADAR & VIRAL IDEAS")
    print(f"  Keywords: '{args.keywords}' | Time Window: Last 24 Hours (Today, Oct 23, 2026)")
    print("=" * 70)

    tweets = trend_engine.search_twitter(query=args.keywords, max_results=args.limit)
    print(f"\nDiscovered {len(tweets)} live breakout tweets/discussions from the last 24h:\n")

    for idx, t in enumerate(tweets, 1):
        idea = t.get("twitter_idea", {})
        print(f"--- [#{idx:02d}] {t.get('channel', '@XUser')} | {t.get('published_time_text')} | Likes: {t.get('likes', 0):,} | RTs: {t.get('retweets', 0):,} ---")
        print(f"  Tweet: {t.get('title')}")
        print(f"  Link:  {t.get('url')}")
        print(f"\n  💡 RECOMMENDED TWITTER / X IDEA:")
        print(f"  [Single Tweet Hook]:\n  {idea.get('tweet_single') or idea.get('tweet_hook')}")
        if idea.get("thread_angle"):
            print(f"  [Thread Angle]: {idea.get('thread_angle')}")
        if idea.get("thread_blueprint"):
            print("  [Thread Blueprint]:")
            for tweet_step in idea.get("thread_blueprint"):
                print(f"    • {tweet_step}")
        if idea.get("engagement_poll"):
            poll = idea.get("engagement_poll")
            if isinstance(poll, dict):
                print(f"  [Poll Question]: {poll.get('question')}")
                for opt in poll.get("options", []):
                    print(f"    - {opt}")
            else:
                print(f"  [Engagement Poll]:\n  {poll}")
        if idea.get("bookmark_cta") or idea.get("retweet_cta"):
            print(f"  [CTA]: {idea.get('retweet_cta') or idea.get('bookmark_cta')}")
        print("-" * 70 + "\n")


def cmd_deep_research(args):
    from mcp_server.trend_reach_engine import deep_trend_engine
    print("=" * 70)
    print("  🌐 DEEP GLOBAL RESEARCH & MULTI-PLATFORM CLUSTERING ENGINE")
    print(f"  Keywords: '{args.keywords}' | Target Posts: {args.posts}")
    print(f"  Scale: 1,000+ Twitter/X, 1,000+ YouTube, 10,000+ Reddit, 50+ GitHub, 100,000+ Facebook")
    print("  Geographic Scope: Worldwide (US, GB, DE, JP, CA, AU, FR, KR — No Regional Bias)")
    print("=" * 70)

    res = deep_trend_engine.run_deep_research(args.keywords, target_posts=args.posts)
    summary = res["data_harvest_summary"]
    print(f"\n[Data Ingestion Completed in {res['execution_time_seconds']}s]:")
    print(f"  • Twitter / X Real-Time:  {summary.get('twitter_signals_analyzed', 0):,}")
    print(f"  • YouTube Global Videos:  {summary['youtube_videos_analyzed']:,}")
    print(f"  • Reddit Community Feeds: {summary['reddit_signals_analyzed']:,}")
    print(f"  • GitHub Breakout Repos:  {summary['github_repos_analyzed']:,}")
    print(f"  • Facebook Signals:       {summary['facebook_signals_analyzed']:,}")
    print(f"  • Total Signals Processed: {summary['total_signals_processed']:,}")

    print(f"\n[Discovered {res['clusters_discovered']} High-Velocity Breakout Clusters]:")
    for idx, c in enumerate(res["top_clusters"], 1):
        print(f"  #{idx:02d} [{c['tier']}] ({c['viral_score']}/100) {c['headline'][:60]}")
        print(f"       Signals: {c['total_signals_in_cluster']} | Platforms: {', '.join(c['platforms_present'])}")

    print("\n" + "=" * 70)
    print(f"  📝 GENERATED READY-TO-PUBLISH SOCIAL POSTS ({len(res['generated_posts'])})")
    print("  Enforcing Anti-Book, Ultra-Punchy Short & Sweet Writing Protocol")
    print("=" * 70 + "\n")

    for p in res["generated_posts"]:
        print(f"--- [POST #{p['post_number']}] {p['tier']} ({p['viral_score']}/100) ---")
        print(f"Headline: {p['headline']}")
        print(f"Verified Link: {p['primary_source_url']}")
        if p.get("twitter_idea"):
            tw = p["twitter_idea"]
            print("\n[🐦 Twitter / X Viral Single Tweet]:")
            print(tw.get("viral_single_tweet"))
            print("\n[🧵 Twitter / X 4-Tweet Thread Blueprint]:")
            for t_line in tw.get("thread_blueprint", []):
                print(f"  {t_line}\n")
            print(f"[📊 Twitter Engagement Poll]: {tw.get('engagement_poll', {}).get('question')}")
            for opt in tw.get("engagement_poll", {}).get("options", []):
                print(f"  • {opt}")
            print(f"\n[🔁 Retweet CTA]: {tw.get('retweet_cta')}")
        print("\n[Facebook Profile Ready (Renuka Yadav)]:")
        print(p["facebook_post"])
        print("\n" + "-" * 70 + "\n")


def cmd_spy(args):
    from mcp_server.trend_reach_engine import trend_engine
    print("=" * 65)
    print(f"  🎯 COMPETITOR SPY & CONTENT GAP INTELLIGENCE")
    print(f"  Target: '{args.target}' on {args.platform.upper()}")
    print("=" * 65)

    res = trend_engine.spy_competitor_channels(args.target, platform=args.platform)
    print(f"\nChannel Benchmark Average Views: {res['average_views_benchmark']:,}\n")

    print("[Top Outlier Videos]:")
    for v in res["outlier_videos"]:
        print(f"  * {v['title']}")
        print(f"    Views: {v['views']:,} ({v['outlier_multiplier']}) | Hook Formula: {v['winning_formula']}")

    print("\n[Actionable Content Gaps For Meta Growth]:")
    for g in res["content_gaps"]:
        print(f"  ⚡ {g['gap_title']} [{g['format']}]")
        print(f"     Hook: {g['retention_hook']}")
        print(f"     Why:  {g['why_it_wins']}")
    print("-" * 65 + "\n")


def cmd_optimize(args):
    from mcp_server.trend_reach_engine import pre_post_optimizer
    print("=" * 70)
    print("  ⚔️ PRE-POST VIRAL SEO & COMPETITOR BATTLE ANALYZER")
    print(f"  Concept: '{args.concept}'")
    print(f"  Platform: {args.platform.upper()} | Type: {args.type.upper()}")
    print("=" * 70)

    res = pre_post_optimizer.analyze_and_optimize(
        draft_concept=args.concept,
        target_platform=args.platform,
        content_type=args.type,
        creative_archetype=args.archetype
    )

    bm = res["head_to_head_benchmark"]
    print(f"\n[Head-To-Head Benchmark Result ({res['execution_time_ms']}ms)]:")
    print(f"  🔥 Virality Index:        {bm['virality_index']}/100")
    print(f"  ⚡ SEO Readiness Score:   {bm['seo_readiness_score']}/100")
    print(f"  🎯 Competitors Scanned:    {bm['competitor_count_analyzed']} (Avg {bm['competitor_avg_views']:,} views)")
    print(f"  🔑 Exploited Keywords:    {', '.join(bm['competitor_keywords_exploited'])}")
    print(f"\n[Competitor Weakness Exposed]:\n  \"{bm['competitor_weakness']}\"")
    print(f"\n[Winning Growth Angle]:\n  {bm['winning_angle']}")

    print("\n" + "=" * 70)
    print("  🚀 ANTI-BORING VIRAL POST BLUEPRINT (ZERO WALL OF TEXT)")
    print("=" * 70)
    print(f"Hook:      {res['viral_hook']}")
    print(f"Punchline: {res['sub_punchline']}")

    if args.platform in ("instagram", "both"):
        print("\n--- INSTAGRAM CAPTION (High-Retention Spacing) ---")
        print(res["instagram"]["full_caption"])

    if args.platform in ("facebook", "both"):
        print("\n--- FACEBOOK POST (High-Reach Formatting) ---")
        print(res["facebook"]["full_post_text"])

    print("\n--- CREATIVE DIRECTOR PROMPT (Agency Visual) ---")
    print(res["creative_director"]["prompt"])

    print("\n--- KINETIC REEL SCRIPT ---")
    for k, v in res["reel_script"].items():
        if isinstance(v, dict):
            print(f"  [{k}] Visual: {v.get('visual')} | Audio: \"{v.get('audio')}\"")
        else:
            print(f"  [{k}] {v}")
    print("=" * 70 + "\n")


def cmd_start_server(args):
    from mcp_server.server import main
    print("Starting Antigravity Meta Suite MCP server...")
    main()


def cmd_kb(args):
    from mcp_server.knowledge_engine import knowledge_engine
    print("=" * 60)
    print(f"  META DEVELOPER KNOWLEDGE BASE: '{args.query}'")
    print("=" * 60)
    matches = knowledge_engine.lookup_docs(query=args.query, product=args.product, limit=args.limit)
    if not matches:
        print("  No matching documentation pages found.")
    for i, m in enumerate(matches, 1):
        print(f"\n[{i}] {m['title']} ({m['category']})")
        print(f"    Path: references/meta-dev-knowledge-base/{m['relative_path']}")
        print(f"    Summary: {m['summary']}")

    if any(k in args.query.lower() for k in ("workflow", "publish", "step", "flow", "container", "page", "message", "dm")):
        wf = knowledge_engine.get_workflow(args.query)
        print("\n--- RECOMMENDED WORKFLOW ---")
        print(json.dumps(wf, indent=2))
    print("\n" + "=" * 60)


def cmd_error(args):
    from mcp_server.knowledge_engine import knowledge_engine
    res = knowledge_engine.diagnose_error(error_code=args.code, subcode=args.subcode)
    print("=" * 60)
    print(f"  META ERROR DIAGNOSTICS: #{args.code}" + (f" (Subcode: {args.subcode})" if args.subcode else ""))
    print("=" * 60)
    print(f"  Name:        {res.get('name')}")
    print(f"  Type:        {res.get('type')}")
    print(f"  Retryable:   {'✅ Yes' if res.get('retryable') else '❌ No (Fix Request First)'}")
    print(f"\n  Description: {res.get('description')}")
    if res.get("subcode_explanation"):
        print(f"  Subcode:     {res.get('subcode_explanation')}")
    print(f"\n  Action Plan: {res.get('action')}")
    print("=" * 60)


def cmd_tokens(args):
    from mcp_server.knowledge_engine import knowledge_engine
    res = knowledge_engine.get_token_guide(token_type=args.type)
    print("=" * 60)
    print(f"  META TOKEN LIFECYCLE GUIDE: {res.get('token_type')}")
    print("=" * 60)
    if res.get("validity"):
        print(f"  Validity:        {res.get('validity')}")
    if res.get("target_platform"):
        print(f"  Target Platform: {res.get('target_platform')}")
    if res.get("generation_steps"):
        print("\n  Steps to Generate:")
        for s in res["generation_steps"]:
            print(f"    * {s}")
    if res.get("crucial_rule"):
        print(f"\n  ⚠️ CRUCIAL RULE: {res.get('crucial_rule')}")
    if res.get("renewal_rule"):
        print(f"  ℹ️ RENEWAL:      {res.get('renewal_rule')}")
def cmd_manager(args):
    from mcp_server.algorithm_manager import smm_manager
    action = args.action.lower()
    if action == "audit":
        caption = args.caption or ""
        if not caption:
            print("Error: --caption is required for audit action.")
            return
        res = smm_manager.audit_post(caption=caption, media_type=args.type, platform=args.platform)
        print("=" * 60)
        print("  SENIOR SOCIAL MEDIA MANAGER — 2026 ALGORITHM AUDIT")
        print("=" * 60)
        print(f"  Reach Score:   {res['overall_reach_score']}/100")
        print(f"  Verdict:       {res['verdict']}")
        print(f"  Platform:      {res['platform'].upper()} ({res['media_type']})")
        print("\n[Pillar Diagnostics]:")
        for p_name, p_val in res["pillars"].items():
            print(f"  * {p_name.replace('_', ' ').title()}: {p_val['score']}/{p_val['max']}")
            for note in p_val["notes"]:
                print(f"    - {note}")
        if res["external_link_fix"]["had_external_link"]:
            print("\n⚠️ External Link Detected: Avoid reach suppression by placing link in first comment:")
            print(f"  First Comment Directive: {res['external_link_fix']['first_comment_action']}")
        print("\n[Algorithm-Optimized Draft]:")
        print(res["optimized_version"])
        print("=" * 60)

    elif action == "timing":
        slots = smm_manager.get_optimal_posting_slots()
        print("=" * 60)
        print("  2026 FACEBOOK & INSTAGRAM ENGAGEMENT PEAK WINDOWS")
        print("=" * 60)
        for s in slots:
            print(f"  ⏰ {s['time']} — {s['label']}")
            print(f"     Audience:  {s['audience']}")
            print(f"     Format:    {s['ideal_format']}")
            print(f"     Behavior:  {s['algorithm_behavior']}")
            print("-" * 50)
        print("=" * 60)


def cmd_autoreply(args):
    from mcp_server.autoreply_engine import autoreply_engine
    subcmd = args.subcmd.lower()

    if subcmd == "list":
        rules = db.list_keyword_rules(platform=args.platform)
        print("=" * 60)
        print(f"  SMART KEYWORD AUTO-REPLY RULES ({len(rules)} Active)")
        print("=" * 60)
        for r in rules:
            status = "🟢 ON" if r.get("is_active") == 1 else "🔴 OFF"
            print(f"  #{r['id']} [{r['rule_name']}] {status} | Mode: {r['match_mode'].upper()}")
            print(f"     Keywords: {', '.join(r.get('keywords', []))}")
            print(f"     Templates ({len(r.get('reply_templates', []))} variations):")
            for t in r.get("reply_templates", [])[:2]:
                print(f"       * {t}")
            if r.get("send_private_dm"):
                print(f"     DM Funnel: 📩 {r.get('dm_template')}")
            if r.get("toxic_filter"):
                print(f"     Toxic Filter: 🚫 {', '.join(r.get('toxic_filter'))}")
            print("-" * 50)
        print("=" * 60)

    elif subcmd == "add":
        if not args.name or not args.keywords or not args.reply:
            print("Error: --name, --keywords, and --reply are required.")
            return
        kw_list = [k.strip() for k in args.keywords.split(",") if k.strip()]
        rep_list = [r.strip() for r in args.reply.split("||") if r.strip()]
        toxic_list = [t.strip() for t in args.toxic.split(",") if t.strip()] if args.toxic else []
        r_id = db.create_keyword_rule(
            rule_name=args.name,
            keywords=kw_list,
            reply_templates=rep_list,
            platform=args.platform,
            match_mode=args.mode,
            send_private_dm=bool(args.dm),
            dm_template=args.dm,
            toxic_filter=toxic_list
        )
        print(f"✅ Auto-reply rule #{r_id} '{args.name}' created successfully.")

    elif subcmd == "test":
        comment = args.comment or "Bhai price koto?"
        res = db.match_keyword_rules(
            comment_text=comment,
            commenter_name=args.user or "Ahmed",
            platform=args.platform,
            target_page_id="1409644015561854",
            page_name="Motivational Docqueen"
        )
        print("=" * 60)
        print(f"  KEYWORD AUTO-REPLY TEST")
        print("=" * 60)
        print(f"  Input Comment:  '{comment}' (from {args.user or 'Ahmed'})")
        if not res:
            print("  Result: ⚠️ No keyword matched. No reply dispatched.")
        elif res.get("action") == "hide_or_flag":
            print(f"  Result: 🚫 TOXIC/SPAM FLAGGED: {res.get('reason')}")
        else:
            print(f"  Result:         ✅ Matched Rule: {res.get('rule_name')} (Mode: {res.get('mode')})")
            print(f"  Matched Keyword: '{res.get('matched_keyword')}'")
            print(f"  Public Reply:   '{res.get('public_reply')}'")
            if res.get("send_private_dm"):
                print(f"  Private DM:     📩 '{res.get('private_dm_text')}'")
        print("=" * 60)

    elif subcmd == "run":
        print("Running autonomous comment scan-and-reply cycle...")
        res = autoreply_engine.run_auto_reply_cycle(
            platform=args.platform,
            page_id=args.page_id or "1409644015561854",
            limit_posts=args.limit_posts,
            max_replies_per_cycle=args.max_replies,
            dry_run=args.dry_run
        )
        print(json.dumps(res, indent=2))


def cmd_cron(args):
    action = args.action.lower()
    if action == "list":
        slots = db.list_cron_time_slots()
        print("=" * 60)
        print(f"  DAILY CRON TIME SLOTS ({len(slots)} Active)")
        print("=" * 60)
        for s in slots:
            print(f"  ⏰ {s['slot_time']} — {s.get('slot_label')} (Target: {s.get('target_id')})")
        print("=" * 60)

    elif action == "add":
        if not args.time:
            print("Error: --time (e.g. 08:15) is required.")
            return
        s_id = db.save_cron_time_slot(slot_time=args.time, slot_label=args.label or "Peak Slot")
        print(f"✅ Time slot #{s_id} for {args.time} saved.")

    elif action == "delete":
        if not args.time:
            print("Error: --time is required.")
            return
        ok = db.delete_cron_time_slot(slot_time=args.time)
        print(f"✅ Deleted slot {args.time}." if ok else "⚠️ Slot not found.")

    elif action == "recover":
        count = db.recover_stale_jobs(stale_minutes=args.stale_minutes)
        print(f"✅ Recovered {count} stale running jobs.")


def cmd_doctor(args):
    """
    Automated self-healing diagnostics for CI/CD, systemd, and production operations.
    Returns exit code 0 if all core systems are healthy, 1 if critical issues exist.
    """
    print("=" * 65)
    print("  ANTIGRAVITY META SUITE — SYSTEM DIAGNOSTICS & DOCTOR")
    print("=" * 65)

    passed_checks = 0
    total_checks = 0
    warnings = []
    failures = []

    # Check 1: Python Runtime & Dependencies
    total_checks += 1
    deps = ["mcp", "websockets", "fastapi", "uvicorn", "httpx", "pydantic", "apscheduler", "PIL"]
    missing_deps = []
    for d in deps:
        try:
            __import__(d)
        except ImportError:
            missing_deps.append(d)
    if not missing_deps:
        print("  [✓] Dependencies: All core libraries loaded successfully.")
        passed_checks += 1
    else:
        failures.append(f"Missing Python dependencies: {', '.join(missing_deps)}")
        print(f"  [✗] Dependencies: Missing {missing_deps}")

    # Check 2: SQLite Database Integrity & WAL Mode
    total_checks += 1
    try:
        with db.get_connection() as conn:
            c = conn.cursor()
            c.execute("PRAGMA integrity_check;")
            integ = c.fetchone()[0]
            c.execute("PRAGMA journal_mode;")
            jmode = c.fetchone()[0]
            if integ == "ok":
                print(f"  [✓] SQLite Database: Integrity OK (Journal Mode: {jmode.upper()}).")
                passed_checks += 1
            else:
                failures.append(f"Database integrity compromised: {integ}")
                print(f"  [✗] SQLite Database: Integrity check returned: {integ}")
    except Exception as e:
        failures.append(f"Database connection failed: {e}")
        print(f"  [✗] SQLite Database: Error {e}")

    # Check 3: Queue Health & Stuck Processing Jobs
    total_checks += 1
    try:
        with db.get_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT count(*) FROM scheduled_jobs WHERE status='processing';")
            stuck_count = c.fetchone()[0]
            c.execute("SELECT count(*) FROM scheduled_jobs WHERE status='pending';")
            pending_count = c.fetchone()[0]
            if stuck_count > 0:
                warnings.append(f"{stuck_count} jobs were in 'processing' state. Recovering...")
                db.reset_stuck_processing_jobs()
                print(f"  [!] Queue: Recovered {stuck_count} stale processing jobs ({pending_count} pending).")
            else:
                print(f"  [✓] Queue: 0 stuck processing jobs ({pending_count} pending).")
            passed_checks += 1
    except Exception as e:
        failures.append(f"Queue inspection error: {e}")
        print(f"  [✗] Queue: Error {e}")

    # Check 4: WebSocket Bridge Port Availability & Latency
    total_checks += 1
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    is_listening = s.connect_ex(("127.0.0.1", 8765)) == 0
    s.close()
    if is_listening:
        print("  [✓] WebSocket Bridge: Port 8765 is actively listening.")
        passed_checks += 1
    else:
        warnings.append("WebSocket Bridge daemon is not currently listening on port 8765.")
        print("  [!] WebSocket Bridge: Port 8765 not listening. (Run 'python3 cli.py bridge')")
        passed_checks += 1

    # Check 5: Active Social Account Sessions
    total_checks += 1
    sessions = db.list_active_sessions()
    if sessions:
        accounts_summary = [f"{s['platform']}:{s.get('username') or s['account_id']}" for s in sessions]
        print(f"  [✓] Active Sessions: {len(sessions)} online ({', '.join(accounts_summary)}).")
        passed_checks += 1
    else:
        warnings.append("No active sessions currently synced in database.")
        print("  [!] Active Sessions: 0 active sessions synced.")
        passed_checks += 1

    # Check 6: Extension Files Integrity
    total_checks += 1
    ext_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extension")
    req_ext_files = ["manifest.json", "background.js", "content_bridge.js", "sidepanel.html", "sidepanel.js", "popup.html", "popup.js"]
    missing_ext = [f for f in req_ext_files if not os.path.exists(os.path.join(ext_dir, f))]
    if not missing_ext:
        print("  [✓] Extension: All core Manifest V3 scripts present.")
        passed_checks += 1
    else:
        failures.append(f"Missing extension files: {missing_ext}")
        print(f"  [✗] Extension: Missing {missing_ext}")

    # Summary
    print("-" * 65)
    if not failures:
        print(f"  STATUS: HEALTHY ({passed_checks}/{total_checks} checks passed).")
        if warnings:
            for w in warnings:
                print(f"   * Notice: {w}")
        print("=" * 65)
        sys.exit(0)
    else:
        print(f"  STATUS: DEGRADED / UNHEALTHY ({len(failures)} critical failures).")
        for f in failures:
            print(f"   * Error: {f}")
        print("=" * 65)
        sys.exit(1)


def cmd_db_maintenance(args):
    """
    Automated database maintenance:
    Prunes logs older than --days (default 90) and finished jobs older than 30 days.
    Executes WAL checkpoint and SQLite VACUUM to reclaim disk space.
    """
    print("=" * 60)
    print("  ANTIGRAVITY META SUITE — DATABASE MAINTENANCE")
    print("=" * 60)

    db_path = os.path.abspath(db.db_path)
    size_before = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    log_days = getattr(args, "log_days", 90)
    job_days = getattr(args, "job_days", 30)
    dry_run = getattr(args, "dry_run", False)

    with db.get_connection() as conn:
        c = conn.cursor()

        c.execute("SELECT count(*) FROM compliance_logs WHERE timestamp < datetime('now', ?);", (f"-{log_days} days",))
        logs_to_clean = c.fetchone()[0]

        c.execute("SELECT count(*) FROM scheduled_jobs WHERE status IN ('completed', 'cancelled') AND updated_at < datetime('now', ?);", (f"-{job_days} days",))
        jobs_to_clean = c.fetchone()[0]

        print(f"Found {logs_to_clean} compliance logs older than {log_days} days.")
        print(f"Found {jobs_to_clean} completed/cancelled jobs older than {job_days} days.")

        if dry_run:
            print("\n[DRY RUN]: No modifications performed.")
            print("=" * 60)
            return

        c.execute("DELETE FROM compliance_logs WHERE timestamp < datetime('now', ?);", (f"-{log_days} days",))
        c.execute("DELETE FROM scheduled_jobs WHERE status IN ('completed', 'cancelled') AND updated_at < datetime('now', ?);", (f"-{job_days} days",))
        conn.commit()

        c.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        c.execute("PRAGMA optimize;")
        conn.commit()

    with db.get_connection() as conn:
        conn.execute("VACUUM;")

    size_after = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    freed_kb = (size_before - size_after) / 1024

    print(f"✅ Pruned {logs_to_clean} old logs and {jobs_to_clean} historical jobs.")
    print(f"✅ Executed WAL truncate, index optimization, and VACUUM.")
    print(f"📊 DB Size: {size_before / 1024:.1f} KB -> {size_after / 1024:.1f} KB (Freed: {freed_kb:.1f} KB)")
    print("=" * 60)


def cmd_viral_seo(args):
    from mcp_server.meta_viral_seo_engine import meta_viral_seo
    import json

    if args.audit:
        print("=" * 70)
        print("  ⚡ META ALGORITHM VIRAL REACH AUDIT (0-100)")
        print("=" * 70)
        res = meta_viral_seo.audit_caption_for_20m_potential(args.audit, title=args.topic or "")
        print(f"Viral Score:  {res['score']} / 100")
        print(f"Tier:         {res['viral_tier']}")
        print(f"Production:   {'✅ READY' if res['is_ready_for_production'] else '⚠️ NEEDS REVISION'}")
        if res['strengths']:
            print("\n[Strengths]:")
            for s in res['strengths']:
                print(f"  ✓ {s}")
        if res['penalties']:
            print("\n[Penalties]:")
            for p in res['penalties']:
                print(f"  ✗ {p}")
        if res['recommendations']:
            print("\n[Optimization Directives]:")
            for r in res['recommendations']:
                print(f"  👉 {r}")
        print("=" * 70)
        return

    topic = args.topic or "High Performance Mindset"
    pkg = meta_viral_seo.generate_20m_viral_package(
        topic=topic,
        video_type=args.type,
        target_platform=args.platform
    )
    print("=" * 75)
    print(f"  🚀 META 20M+ VIRAL SEO ENGINE: '{topic}'")
    print(f"  Target: {args.platform.upper()} | Type: {args.type.upper()} ({pkg['aspect_ratio']})")
    print(f"  Framework: {pkg['framework_used']} | Trigger: {pkg['psychological_trigger']}")
    print("=" * 75)
    print(f"\n[VIRAL HEADLINE]:\n{pkg['headline']['viral_title']}")
    print(f"\n[THUMBNAIL 3D DISPLAY TEXT (Rule 8: AI Image Model ONLY)]:")
    print(f"  Giant Hook: '{pkg['headline']['dominant_thumbnail_hook']}'")
    print(f"  Subtitle:   '{pkg['headline']['secondary_subtitle']}'")
    print(f"\n[RETENTION-ENGINEERED CAPTION]:\n{pkg['caption']}")
    print(f"\n[FIRST PINNED COMMENT (Organic Reach Shield)]:\n{pkg['first_comment']}")
    print(f"\n[MULTIMODAL SEMANTIC KEYWORDS (Meta V-JEPA Indexer)]:\n{', '.join(pkg['semantic_keywords'])}")
    print(f"\n[MASTER AI IMAGE MODEL THUMBNAIL PROMPT (9:16 / 16:9)]:\n{pkg['ai_thumbnail_prompt']}")
    print("\n" + "=" * 75)


def cmd_flow_design(args):
    from mcp_server.deepx_meta_bridge import deepx_meta
    print("=" * 65)
    print("  🎨 DEEPX GOOGLE FLOW — ZERO-COST DESIGN GENERATOR")
    print(f"  Model: {args.model} | Ratio: {args.ratio}")
    print(f"  Prompt: '{args.prompt}'")
    print("=" * 65)
    try:
        res = deepx_meta.generate_image(prompt=args.prompt, aspect_ratio=args.ratio, model=args.model)
        print(f"✅ Image generated successfully via Google Flow!")
        if res.get("saved_path"):
            print(f"   Saved Asset: {res.get('saved_path')}")
        else:
            print("   Output returned via Google Flow canvas.")
    except Exception as e:
        print(f"❌ Error generating design on Google Flow: {e}")
        print("   Make sure flow.google.com is open with DeepX extension v1.5.5 loaded.")


def cmd_flow_thumbnail(args):
    from mcp_server.deepx_meta_bridge import deepx_meta
    print("=" * 65)
    print("  🖼️ DEEPX GOOGLE FLOW — VIRAL HIGH-CTR THUMBNAIL (RULE 8)")
    print(f"  Topic: '{args.topic}' | Ratio: {args.ratio}")
    print("=" * 65)
    try:
        res = deepx_meta.generate_viral_thumbnail(topic=args.topic, aspect_ratio=args.ratio)
        print(f"✅ Thumbnail generated on Google Flow (🍌 Nano Banana 2.1)!")
        print(f"   Hook Text: '{res['dominant_hook']}'")
        print(f"   Subtitle:  '{res['subtitle']}'")
        if res.get("thumbnail_path"):
            print(f"   Saved Thumbnail: {res.get('thumbnail_path')}")
    except Exception as e:
        print(f"❌ Error generating thumbnail on Google Flow: {e}")
        print("   Make sure flow.google.com is open with DeepX extension v1.5.5 loaded.")


def cmd_flow_post(args):
    from mcp_server.deepx_meta_bridge import deepx_meta
    from mcp_server.facebook_controller import fb_controller
    print("=" * 70)
    print("  🚀 DEEPX GOOGLE FLOW -> META SUITE 1-CLICK AUTOPILOT")
    print(f"  Topic: '{args.topic}' | Type: {args.type.upper()} | Platform: {args.platform.upper()}")
    print("=" * 70)
    try:
        pkg = deepx_meta.produce_and_package_post(
            topic=args.topic,
            post_type=args.type,
            target_platform=args.platform
        )
        print(f"\n[Generated Viral SEO Headline]:\n{pkg['title']}")
        print(f"\n[Generated Caption]:\n{pkg['caption']}")
        if pkg.get("media_path"):
            print(f"\n[Google Flow Rendered Asset]:\n{pkg['media_path']}")
        if pkg.get("thumbnail_path"):
            print(f"[Google Flow Rendered Thumbnail]:\n{pkg['thumbnail_path']}")

        if args.publish:
            print("\nPublishing post to Meta...")
            pub_res = fb_controller.publish_or_schedule(
                target_type="page" if args.platform == "business_suite" else "profile",
                target_id="1409644015561854" if args.platform == "business_suite" else "61592442011195",
                content_type=args.type,
                media_paths=[pkg["media_path"]] if pkg.get("media_path") else None,
                thumbnail_path=pkg.get("thumbnail_path"),
                description=pkg["caption"],
                title=pkg["title"],
                hashtags=pkg["hashtags"]
            )
            print(f"✅ Published: {pub_res}")
        else:
            print("\nℹ️ Post packaged successfully. Use --publish to broadcast live immediately.")
    except Exception as e:
        print(f"❌ Error in DeepX Meta Suite Autopilot: {e}")


def cmd_pack_extension(args):
    """
    Packages the Chrome extension into a production-ready, clean distribution zip bundle.
    Validates manifest.json, strips git/cache/test files, and computes SHA-256.
    """
    import zipfile
    import hashlib

    project_root = os.path.abspath(os.path.dirname(__file__))
    ext_dir = os.path.join(project_root, "extension")
    dist_dir = os.path.join(project_root, "dist")
    os.makedirs(dist_dir, exist_ok=True)

    manifest_path = os.path.join(ext_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        print("❌ Error: extension/manifest.json not found.")
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    version = manifest.get("version", "1.0.0")
    name = manifest.get("name", "antigravity-meta-bridge")
    safe_name = name.lower().replace(" ", "-").replace("(", "").replace(")", "")
    zip_filename = f"{safe_name}-v{version}.zip"
    zip_path = os.path.join(dist_dir, zip_filename)

    print("=" * 60)
    print(f"  PACKAGING EXTENSION: {name} (v{version})")
    print("=" * 60)

    excluded_patterns = {".git", ".DS_Store", "__pycache__", ".pytest_cache", ".map", ".tmp"}

    file_count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(ext_dir):
            dirs[:] = [d for d in dirs if d not in excluded_patterns]
            for file in files:
                if any(file.endswith(ext) for ext in [".map", ".tmp", ".pyc"]):
                    continue
                if file in excluded_patterns:
                    continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, ext_dir)
                zipf.write(abs_path, rel_path)
                file_count += 1

    zip_size_kb = os.path.getsize(zip_path) / 1024

    with open(zip_path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()

    print(f"✅ Packaged {file_count} files into:")
    print(f"   📦 {zip_path}")
    print(f"   📊 Size: {zip_size_kb:.1f} KB")
    print(f"   🔒 SHA-256: {sha256}")
    print("=" * 60)


def main_cli():
    parser = argparse.ArgumentParser(description="Antigravity Meta Suite CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Bridge Daemon
    p_bridge = subparsers.add_parser("bridge", help="Run standalone WebSocket bridge & scheduler daemon")
    p_bridge.add_argument("--interval", type=int, default=30, help="Scheduler poll interval in seconds")
    p_bridge.set_defaults(func=cmd_bridge)

    # Status
    p_status = subparsers.add_parser("status", help="Show system, session & rate-limit status")
    p_status.set_defaults(func=cmd_status)

    # Queue
    p_queue = subparsers.add_parser("queue", help="List upcoming scheduled jobs")
    p_queue.add_argument("--limit", type=int, default=50, help="Max jobs to display")
    p_queue.set_defaults(func=cmd_queue)

    # Post
    p_post = subparsers.add_parser("post", help="Publish a post immediately or schedule for future")
    p_post.add_argument("--platform", choices=["instagram", "facebook"], required=True, help="Platform")
    p_post.add_argument("--type", choices=["photo", "reel", "text", "story"], default="photo", help="Content type")
    p_post.add_argument("--target", default="feed", help="Target type: 'feed', 'profile', 'page', 'group'")
    p_post.add_argument("--target-id", default=None, help="Target ID (Page ID, Group ID, or Profile ID)")
    p_post.add_argument("--media", type=str, default=None, help="Path to photo or video media file")
    p_post.add_argument("--caption", type=str, default="", help="Caption / text content")
    p_post.add_argument("--hashtags", type=str, default="", help="Space-separated hashtags")
    p_post.add_argument("--schedule", type=str, default=None, help="Optional ISO UTC schedule time")
    p_post.add_argument("--force", action="store_true", help="Bypass anti-spam spacing for immediate manual post")
    p_post.set_defaults(func=cmd_post)

    # Humanized Batch Scheduler (Anti-Detection 10-25+ Posts)
    p_batch = subparsers.add_parser("batch", help="Schedule multi-post batch with humanized pacing (1 live + rest scheduled)")
    p_batch.add_argument("--platform", choices=["instagram", "facebook"], default="facebook", help="Platform")
    p_batch.add_argument("--type", choices=["photo", "reel", "text", "story"], default="photo", help="Content type")
    p_batch.add_argument("--target", default="profile", help="Target type: 'profile', 'feed', 'page', 'group'")
    p_batch.add_argument("--target-id", default="61592442011195", help="Target ID (Default: Renuka Yadav profile)")
    p_batch.add_argument("--file", type=str, default=None, help="JSON file containing array of post objects")
    p_batch.add_argument("--sample", type=int, default=15, help="Number of sample study/Loksewa posts to generate & schedule (Default: 15)")
    p_batch.add_argument("--min-gap", type=int, default=40, help="Minimum spacing in minutes (Default: 40)")
    p_batch.add_argument("--max-gap", type=int, default=65, help="Maximum spacing in minutes (Default: 65)")
    p_batch.set_defaults(func=cmd_batch)

    # Cancel
    p_cancel = subparsers.add_parser("cancel", help="Cancel a scheduled job")
    p_cancel.add_argument("--id", type=int, default=None, help="Job ID to cancel")
    p_cancel.add_argument("--all", action="store_true", help="Cancel all pending jobs")
    p_cancel.set_defaults(func=cmd_cancel)

    # Retry
    p_retry = subparsers.add_parser("retry", help="Reschedule a job for immediate execution")
    p_retry.add_argument("--id", type=int, required=True, help="Job ID to retry")
    p_retry.set_defaults(func=cmd_retry)

    # Clear Queue
    p_clear = subparsers.add_parser("clear", help="Purge completed, failed, or cancelled jobs from queue")
    p_clear.add_argument("--statuses", default="completed,failed,cancelled", help="Comma-separated statuses to delete")
    p_clear.set_defaults(func=cmd_clear_queue)

    # Test Upload
    p_test = subparsers.add_parser("test-upload", help="Diagnostic pipeline test for media generation & upload")
    p_test.add_argument("--platform", choices=["instagram", "facebook"], default="facebook", help="Target platform")
    p_test.add_argument("--title", type=str, default="System Diagnostic", help="Overlay title")
    p_test.add_argument("--dry-run", action="store_true", help="Verify asset generation and session without publishing")
    p_test.set_defaults(func=cmd_test_upload)

    # Render Media
    p_render = subparsers.add_parser("render", help="Generate zero-cost image or reel video")
    p_render.add_argument("--type", choices=["image", "reel"], default="image")
    p_render.add_argument("--aspect", choices=["4:5", "1:1", "9:16", "16:9"], default="4:5")
    p_render.add_argument("--title", type=str, default="Viral Growth 2026")
    p_render.add_argument("--subtitle", type=str, default="Antigravity Meta Suite")
    p_render.add_argument("--prompt", type=str, default=None)
    p_render.add_argument("--script", type=str, default=None)
    p_render.add_argument("--voice", type=str, default="en-US-ChristopherNeural")
    p_render.set_defaults(func=cmd_render_media)

    # Viral Hooks
    p_hooks = subparsers.add_parser("hooks", help="Inspect viral hook library and scores")
    p_hooks.add_argument("--category", type=str, default="creator")
    p_hooks.add_argument("--count", type=int, default=5)
    p_hooks.set_defaults(func=cmd_viral_hooks)

    # Reload Extension
    p_reload = subparsers.add_parser("reload-extension", help="Send live reload signal to connected Chrome extension")
    p_reload.set_defaults(func=cmd_reload_extension)

    # Creative Prompt Builder
    p_creative = subparsers.add_parser("creative-prompt", help="Build high-converting agency prompt from 7 archetypes")
    p_creative.add_argument("--archetype", type=str, default="tactile_clipboard", choices=["tactile_clipboard", "classical_contrast", "keyboard_shortcut", "surreal_metaphor", "ui_as_reality", "editorial_color_block", "pop_culture_subversion"])
    p_creative.add_argument("--headline", type=str, default="4 RULES OF DAILY CONSISTENCY", help="Main bold headline/hook")
    p_creative.add_argument("--tagline", type=str, default="Consistency > Intensity", help="Supporting tagline or punchline")
    p_creative.add_argument("--points", type=str, default=None, help="Numbered list points")
    p_creative.add_argument("--keys", type=str, default="CTRL + S", help="Keycap labels for keyboard archetype")
    p_creative.set_defaults(func=cmd_creative_prompt)

    # Open Canvas
    p_open = subparsers.add_parser("open", help="Open or focus Facebook, Instagram, Business Suite, YouTube, or TikTok canvas")
    p_open.add_argument("platform", choices=["facebook", "instagram", "business_suite", "youtube", "tiktok"], help="Target platform to open")
    p_open.set_defaults(func=cmd_open)

    # Logout Account
    p_logout = subparsers.add_parser("logout", help="Log out of Facebook, Instagram, Business Suite, YouTube, TikTok, or all platforms")
    p_logout.add_argument("platform", choices=["facebook", "instagram", "business_suite", "youtube", "tiktok", "all"], help="Target platform to log out")
    p_logout.add_argument("--account-id", default=None, help="Optional specific account ID to disconnect")
    p_logout.set_defaults(func=cmd_logout)

    # YouTube Studio Autonomous Upload
    p_yt = subparsers.add_parser("youtube", help="GhostHuman autonomous video or Short upload to YouTube Studio")
    p_yt.add_argument("--title", default="Autonomous Video Upload", help="Video title (auto-generated if --auto-seo is passed)")
    p_yt.add_argument("--media", required=True, help="Path to video MP4 file")
    p_yt.add_argument("--desc", default="", help="Video description")
    p_yt.add_argument("--tags", default="", help="Comma-separated tags")
    p_yt.add_argument("--short", action="store_true", help="Mark as YouTube Short")
    p_yt.add_argument("--auto-seo", action="store_true", help="Automatically generate high-CTR title, retention description, 500-char Cartesian tags, and pinned comment")
    p_yt.add_argument("--kids", action="store_true", help="Made for kids flag (default false)")
    p_yt.add_argument("--visibility", default="PUBLIC", choices=["PUBLIC", "UNLISTED", "PRIVATE"], help="Visibility")
    p_yt.add_argument("--bypass-spacing", action="store_true", help="Bypass spacing check (emergency only)")
    p_yt.set_defaults(func=cmd_youtube)

    # Video SEO & Analysis (YouTube, TikTok, Instagram, Facebook)
    p_seo = subparsers.add_parser("seo-analyze", help="Inspect video and generate multi-platform creative SEO (YouTube, TikTok, Instagram, Facebook)")
    p_seo.add_argument("--media", required=True, help="Path to video file (.mp4, etc.)")
    p_seo.add_argument("--topic", default=None, help="Optional topic/focus hint")
    p_seo.add_argument("--platform", choices=["youtube", "tiktok", "instagram", "facebook", "meta_business_suite", "all"], default="all", help="Target platform to view")
    p_seo.set_defaults(func=cmd_seo_analyze)

    # Unified Video Publish
    p_pub_vid = subparsers.add_parser("publish-video", help="Publish video to any platform with automatic creative SEO")
    p_pub_vid.add_argument("--media", required=True, help="Path to video file (.mp4, etc.)")
    p_pub_vid.add_argument("--platform", choices=["youtube", "tiktok", "instagram", "facebook", "meta_business_suite", "page"], required=True, help="Target platform")
    p_pub_vid.add_argument("--topic", default=None, help="Optional topic hint")
    p_pub_vid.add_argument("--short", action="store_true", help="Force Short/Reel flag")
    p_pub_vid.add_argument("--no-auto-seo", dest="auto_seo", action="store_false", default=True, help="Disable auto-SEO")
    p_pub_vid.add_argument("--bypass-spacing", action="store_true", help="Bypass spacing check (emergency only)")
    p_pub_vid.set_defaults(func=cmd_publish_video)

    # Fast Fixed-Route Video Autopilot Pipeline
    p_pipe = subparsers.add_parser("pipeline", help="Fast fixed-route video autopilot: Find -> SEO -> Thumbnail -> Platform Upload")
    p_pipe.add_argument("--media", default=None, help="Path to video file (.mp4). Omit to auto-pick newest")
    p_pipe.add_argument("--platform", choices=["youtube", "tiktok", "instagram", "facebook", "meta_business_suite", "page"], default=None, help="Target platform")
    p_pipe.add_argument("--topic", default="", help="Optional topic hint")
    p_pipe.add_argument("--schedule", default=None, help="ISO-8601 UTC schedule time (omit for immediate publish)")
    p_pipe.add_argument("--interactive", action="store_true", help="Prompt for choices")
    p_pipe.add_argument("--bypass-spacing", action="store_true", help="Bypass spacing check (emergency only)")
    p_pipe.set_defaults(func=cmd_pipeline)

    # TikTok Creator Center Autonomous Upload
    p_tt = subparsers.add_parser("tiktok", help="GhostHuman autonomous video upload to TikTok Creator Center")
    p_tt.add_argument("--caption", required=True, help="Video caption with hashtags")
    p_tt.add_argument("--media", required=True, help="Path to video MP4 file")
    p_tt.add_argument("--privacy", default="PUBLIC", choices=["PUBLIC", "FRIENDS", "PRIVATE"], help="Privacy level")
    p_tt.add_argument("--bypass-spacing", action="store_true", help="Bypass spacing check (emergency only)")
    p_tt.set_defaults(func=cmd_tiktok)

    # Trend Radar
    p_trends = subparsers.add_parser("trends", help="Scan real-time breakout trends across YouTube, Twitter, Reddit, GitHub (No Bilibili)")
    p_trends.add_argument("--keywords", type=str, default="AI Automation", help="Niche or keyword to search")
    p_trends.add_argument("--sources", type=str, default="youtube,twitter,reddit,github", help="Comma-separated channels")
    p_trends.add_argument("--competitor", type=str, default=None, help="Optional competitor channel handle")
    p_trends.add_argument("--min-score", type=float, default=40.0, help="Minimum viral score filter (0-100)")
    p_trends.add_argument("--limit", type=int, default=10, help="Max results")
    p_trends.set_defaults(func=cmd_trends)

    # Real-Time Twitter / X Radar & Viral Ideas
    p_tw = subparsers.add_parser("twitter-trends", help="Scan real-time Twitter/X trends and get instant viral tweet/thread ideas (Last 24h)")
    p_tw.add_argument("--keywords", type=str, default="AI Automation", help="Keywords to search on Twitter/X")
    p_tw.add_argument("--limit", type=int, default=10, help="Max tweets/ideas to return")
    p_tw.set_defaults(func=cmd_twitter_trends)

    # Deep Global Research & Multi-Platform Harvester
    p_deep = subparsers.add_parser("deep-research", help="Deep global research across 1k+ YouTube, 10k+ Reddit, 50+ GitHub, 100k+ Facebook")
    p_deep.add_argument("--keywords", type=str, default="AI Automation", help="Topic or keyword to research globally")
    p_deep.add_argument("--posts", type=int, default=10, help="Number of ready-to-publish posts to generate (e.g. 10 or 50)")
    p_deep.set_defaults(func=cmd_deep_research)

    # Competitor Spy
    p_spy = subparsers.add_parser("spy", help="Reverse-engineer competitor outlier videos and detect content gaps")
    p_spy.add_argument("target", type=str, help="Target channel handle, name, or niche")
    p_spy.add_argument("--platform", choices=["youtube", "twitter"], default="youtube", help="Platform")
    p_spy.set_defaults(func=cmd_spy)

    # Pre-Post Competitor Battle & Viral SEO Optimizer
    p_optimize = subparsers.add_parser("optimize", help="Pre-post competitor search, keyword benchmark, and anti-boring viral layout")
    p_optimize.add_argument("concept", type=str, help="Draft concept or post topic (e.g. 'flow + antigravity extension')")
    p_optimize.add_argument("--platform", choices=["instagram", "facebook", "both"], default="both", help="Target platform")
    p_optimize.add_argument("--type", choices=["reel", "carousel", "photo"], default="reel", help="Content format")
    p_optimize.add_argument("--archetype", default="keyboard_shortcut", help="Creative Director visual archetype")
    p_optimize.set_defaults(func=cmd_optimize)

    # Start Server
    p_server = subparsers.add_parser("server", help="Run the MCP Server over stdio")
    p_server.set_defaults(func=cmd_start_server)

    # Knowledge Base Lookup
    p_kb = subparsers.add_parser("kb", help="Search Meta Developer documentation and workflows")
    p_kb.add_argument("query", type=str, help="Search query (e.g. 'instagram publishing', 'error codes', 'webhook')")
    p_kb.add_argument("--product", type=str, default=None, help="Filter: instagram, facebook-pages, graph-api, etc.")
    p_kb.add_argument("--limit", type=int, default=5, help="Max results")
    p_kb.set_defaults(func=cmd_kb)

    # Error Diagnostics
    p_err = subparsers.add_parser("error", help="Diagnose Graph API error code and subcode")
    p_err.add_argument("code", type=int, help="Error code (e.g. 190, 200, 4, 100, 80004)")
    p_err.add_argument("--subcode", type=int, default=None, help="Optional error_subcode (e.g. 463, 467)")
    p_err.set_defaults(func=cmd_error)

    # Token Lifecycle Guide
    p_tok = subparsers.add_parser("tokens", help="Get token generation & renewal guides")
    p_tok.add_argument("--type", type=str, default="never_expiring_page", choices=["never_expiring_page", "long_lived_user", "short_lived", "renewal"], help="Token type")
    p_tok.set_defaults(func=cmd_tokens)

    # Senior Social Media Manager & 2026 Algorithm Engine
    p_manager = subparsers.add_parser("manager", help="Senior Social Media Manager 2026 Meta Algorithm Diagnostics & Peak Timing")
    p_manager.add_argument("action", choices=["audit", "timing"], help="Action: 'audit' (4-pillar check) or 'timing' (optimal posting slots)")
    p_manager.add_argument("--caption", type=str, default="", help="Draft caption to audit")
    p_manager.add_argument("--type", choices=["post", "reel", "story"], default="post", help="Media type")
    p_manager.add_argument("--platform", choices=["facebook", "instagram"], default="facebook", help="Target platform")
    p_manager.set_defaults(func=cmd_manager)

    # Smart Keyword Auto-Reply Engine
    p_autoreply = subparsers.add_parser("autoreply", help="Auto-reply rules, testing, and autonomous comment scan-and-reply cycle")
    p_autoreply.add_argument("subcmd", choices=["list", "add", "test", "run"], help="Subcommand: list, add, test, run")
    p_autoreply.add_argument("--platform", choices=["facebook", "instagram"], default="facebook", help="Platform")
    p_autoreply.add_argument("--name", type=str, default=None, help="Rule name (for add)")
    p_autoreply.add_argument("--keywords", type=str, default=None, help="Comma-separated keywords (for add)")
    p_autoreply.add_argument("--reply", type=str, default=None, help="Reply templates separated by '||' (for add)")
    p_autoreply.add_argument("--mode", choices=["all", "specific", "both"], default="specific", help="Match mode (for add)")
    p_autoreply.add_argument("--dm", type=str, default=None, help="Private DM funnel template (for add)")
    p_autoreply.add_argument("--toxic", type=str, default=None, help="Comma-separated toxic keywords (for add)")
    p_autoreply.add_argument("--comment", type=str, default=None, help="Comment text to test (for test)")
    p_autoreply.add_argument("--user", type=str, default="Ahmed", help="Commenter name (for test)")
    p_autoreply.add_argument("--page-id", type=str, default="1409644015561854", help="Meta Business Suite Page ID (for run)")
    p_autoreply.add_argument("--limit-posts", type=int, default=5, help="Number of recent posts to scan (for run)")
    p_autoreply.add_argument("--max-replies", type=int, default=20, help="Max replies per cycle (for run)")
    p_autoreply.add_argument("--dry-run", action="store_true", help="Simulate replies without posting")
    p_autoreply.set_defaults(func=cmd_autoreply)

    # Cron Time Slots & Stale Recovery
    p_cron = subparsers.add_parser("cron", help="Manage daily cron time slots & recover stale running jobs")
    p_cron.add_argument("action", choices=["list", "add", "delete", "recover"], help="Action: list, add, delete, recover")
    p_cron.add_argument("--time", type=str, default=None, help="Time slot (e.g. '08:15')")
    p_cron.add_argument("--label", type=str, default=None, help="Label for time slot")
    p_cron.add_argument("--stale-minutes", type=int, default=15, help="Stale running timeout in minutes (for recover)")
    p_cron.set_defaults(func=cmd_cron)

    # Clickbait Thumbnail & Social Post Generator
    p_thumb = subparsers.add_parser("thumbnail", help="Generate high-CTR clickbait thumbnail with gradient text & box highlighting")
    p_thumb.add_argument("--title", required=True, help="Crazy bold title for thumbnail (e.g. 'CRITICAL FLAW')")
    p_thumb.add_argument("--sub", default="", help="Small subtitle ('What it is about')")
    p_thumb.add_argument("--media", default=None, help="Optional reference video (extracts keyframe) or image")
    p_thumb.add_argument("--ratio", choices=["16:9", "9:16", "4:5", "1:1"], default="16:9", help="Target aspect ratio")
    p_thumb.add_argument("--theme", choices=["canary_crimson", "cyan_violet", "gold_amber", "lime_emerald", "fire_orange"], default="canary_crimson", help="Color palette")
    p_thumb.add_argument("--badge", default=None, help="Optional top badge text (e.g. '2026 EXPOSED')")
    p_thumb.set_defaults(func=cmd_thumbnail)

    # Pre-Flight Platform Login Audit
    p_login = subparsers.add_parser("login-status", help="Check active login status of all or specific social platforms")
    p_login.add_argument("--platform", choices=["youtube", "facebook", "instagram", "business_suite", "tiktok", "all"], default="all", help="Target platform")
    p_login.set_defaults(func=cmd_login_status)

    # Automated System Diagnostics & Doctor
    p_doc = subparsers.add_parser("doctor", help="Run automated self-healing system diagnostics")
    p_doc.set_defaults(func=cmd_doctor)

    # Database Maintenance & Hygiene
    p_dbc = subparsers.add_parser("db-clean", help="Prune historical logs and optimize SQLite database")
    p_dbc.add_argument("--log-days", type=int, default=90, help="Retention period for compliance logs in days (default: 90)")
    p_dbc.add_argument("--job-days", type=int, default=30, help="Retention period for completed/cancelled jobs in days (default: 30)")
    p_dbc.add_argument("--dry-run", action="store_true", help="Inspect records without deleting")
    p_dbc.set_defaults(func=cmd_db_maintenance)

    # Extension Packaging Pipeline
    p_pack = subparsers.add_parser("pack-extension", help="Package Chrome extension into production zip bundle")
    p_pack.set_defaults(func=cmd_pack_extension)

    # Master Meta 20M+ Viral SEO Engine
    p_viral = subparsers.add_parser("viral-seo", help="Generate 2M-20M scale viral SEO package for Meta Business Suite & Reels")
    p_viral.add_argument("--topic", type=str, default="High Performance Mindset", help="Core topic, thesis, or problem")
    p_viral.add_argument("--type", type=str, choices=["reel", "short", "feed_video", "carousel", "photo"], default="reel", help="Format (default: reel)")
    p_viral.add_argument("--platform", type=str, choices=["business_suite", "facebook", "instagram"], default="business_suite", help="Target platform (default: business_suite)")
    p_viral.add_argument("--audit", type=str, help="Caption text to audit against Meta recommendation algorithm (0-100 score)")
    p_viral.set_defaults(func=cmd_viral_seo)

    # DeepX Google Flow Integration for Meta Suite
    p_fd = subparsers.add_parser("flow-design", help="Generate social post designs & photo cards on Google Flow via DeepX")
    p_fd.add_argument("--prompt", type=str, required=True, help="Visual design prompt")
    p_fd.add_argument("--ratio", type=str, default="4:5", choices=["1:1", "4:5", "9:16", "16:9"], help="Aspect ratio (default: 4:5)")
    p_fd.add_argument("--model", type=str, default="gemini-nano-banana-2.1", help="Image model (default: gemini-nano-banana-2.1)")
    p_fd.set_defaults(func=cmd_flow_design)

    p_ft = subparsers.add_parser("flow-thumbnail", help="Generate viral 3D gradient thumbnail on Google Flow via DeepX (Rule 8)")
    p_ft.add_argument("--topic", type=str, required=True, help="Video topic or hook")
    p_ft.add_argument("--ratio", type=str, default="16:9", choices=["16:9", "9:16"], help="Aspect ratio (default: 16:9)")
    p_ft.set_defaults(func=cmd_flow_thumbnail)

    p_fp = subparsers.add_parser("flow-post", help="1-Click Autopilot: Viral SEO + Google Flow Media + Meta Suite Posting")
    p_fp.add_argument("--topic", type=str, required=True, help="Topic for viral post")
    p_fp.add_argument("--type", type=str, default="photo", choices=["photo", "reel"], help="Post type (default: photo)")
    p_fp.add_argument("--platform", type=str, default="business_suite", choices=["business_suite", "facebook", "instagram"], help="Target platform")
    p_fp.add_argument("--publish", action="store_true", help="Publish directly to Meta upon completion")
    p_fp.set_defaults(func=cmd_flow_post)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main_cli()
