"""
Antigravity Meta Suite - DeepX Google Flow Bridge Integration Module (v1.0.0)
Exclusively connects Meta Suite Automation to the latest DeepX Google Flow Extension (v1.5.5)
at http://127.0.0.1:8792 and ws://127.0.0.1:8792/ws.

Provides zero-cost AI asset generation:
- 🍌 Nano Banana 2.1 / Nano Banana Pro design & photo card generation
- High-CTR 20M viral thumbnail cover generation (16:9 & 9:16)
- Veo 3.1 & Omni Flash 1.2 vertical Reels & video ad generation
- Direct integration with Meta Business Suite & Facebook/Instagram controllers
"""

import os
import json
import time
import uuid
import base64
import logging
from typing import Dict, Any, List, Optional
import httpx

from mcp_server.meta_viral_seo_engine import meta_viral_seo

logger = logging.getLogger("meta_suite.deepx_bridge")

DEEPX_HTTP_BASE = os.getenv("DEEPX_HTTP_BASE", "http://127.0.0.1:8792")
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
os.makedirs(ASSETS_DIR, exist_ok=True)


class DeepXMetaBridge:
    """Production client connecting Meta Suite automation to DeepX Google Flow."""

    def __init__(self, base_url: str = DEEPX_HTTP_BASE):
        self.base_url = base_url.rstrip("/")

    def get_status(self) -> Dict[str, Any]:
        """Probes local DeepX bridge status."""
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{self.base_url}/status")
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "bridge_online": True,
                        "extension_connected": bool(data.get("extensionConnected", False)),
                        "connected_clients": data.get("connectedClients", 0),
                        "extension_info": data.get("extensionInfo"),
                        "message": "Connected! Google Flow is ready." if data.get("extensionConnected") else "Bridge online. Open flow.google.com with DeepX extension loaded."
                    }
        except Exception as e:
            logger.debug("DeepX bridge probe failed: %s", e)
        return {
            "bridge_online": False,
            "extension_connected": False,
            "connected_clients": 0,
            "message": "DeepX bridge offline. Ensure DeepX extension is installed."
        }

    def execute_command(self, command: str, payload: Dict[str, Any], timeout_seconds: float = 120.0) -> Dict[str, Any]:
        """Sends an autonomous command to Google Flow via DeepX extension."""
        url = f"{self.base_url}/api/command"
        timeout_ms = int(timeout_seconds * 1000)
        body = {
            "command": command,
            "payload": payload,
            "timeout": timeout_ms
        }
        try:
            with httpx.Client(timeout=timeout_seconds + 5.0) as client:
                resp = client.post(url, json=body)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        return data.get("result", {})
                    raise RuntimeError(data.get("error", "DeepX command failed"))
                raise RuntimeError(f"DeepX bridge returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error("Failed executing DeepX command '%s': %s", command, e)
            raise

    # -------------------------------------------------------------
    # 1. Design & Photo Generation (🍌 Nano Banana 2.1 on Google Flow)
    # -------------------------------------------------------------
    def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "4:5",  # 1:1, 4:5, 9:16, 16:9
        model: str = "gemini-nano-banana-2.1",
        count: int = 1,
        wait_for_render: bool = True
    ) -> Dict[str, Any]:
        """Generates social designs & photo cards on Google Flow without API costs."""
        payload = {
            "prompt": prompt,
            "aspectRatio": aspect_ratio,
            "model": model,
            "count": count,
            "wait_for_render": wait_for_render
        }
        logger.info("Dispatching image generation to Google Flow (%s in %s)...", model, aspect_ratio)
        try:
            res = self.execute_command("generateImage", payload, timeout_seconds=90.0)
        except Exception as e:
            logger.error("generate_image failed: %s", e)
            return {
                "success": False,
                "error": str(e),
                "model": model,
                "aspect_ratio": aspect_ratio,
                "prompt": prompt
            }

        # If base64 or download URL returned, save to assets
        saved_path = None
        if isinstance(res, dict):
            b64 = res.get("base64") or res.get("data")
            if b64:
                img_name = f"flow_img_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
                saved_path = os.path.join(ASSETS_DIR, img_name)
                clean_b64 = b64.split(",")[-1] if "," in b64 else b64
                with open(saved_path, "wb") as f:
                    f.write(base64.b64decode(clean_b64))
                logger.info("Saved DeepX image locally to %s", saved_path)

        return {
            "success": True,
            "model": model,
            "aspect_ratio": aspect_ratio,
            "prompt": prompt,
            "saved_path": saved_path,
            "raw_result": res
        }

    # -------------------------------------------------------------
    # 2. Viral Thumbnail Generation (Rule 8: AI Image Model ONLY)
    # -------------------------------------------------------------
    def generate_viral_thumbnail(
        self,
        topic: str,
        title_hook: Optional[str] = None,
        subtitle: Optional[str] = None,
        aspect_ratio: str = "16:9",  # 16:9 for FB landscape / YT, 9:16 for Reels
        archetype: str = "classical_contrast"
    ) -> Dict[str, Any]:
        """
        Creates an agency-grade high-CTR viral thumbnail via 🍌 Nano Banana 2.1 on Google Flow.
        Enforces Rule 8 (AI Image Model ONLY, volumetric rim lighting, 3D gradient text).
        """
        viral_pkg = meta_viral_seo.generate_20m_viral_package(
            topic=topic,
            video_type="reel" if aspect_ratio == "9:16" else "feed_video"
        )
        ai_prompt = viral_pkg["ai_thumbnail_prompt"]

        logger.info("Generating high-CTR thumbnail for '%s' (%s) on Google Flow...", topic, aspect_ratio)
        gen_res = self.generate_image(
            prompt=ai_prompt,
            aspect_ratio=aspect_ratio,
            model="gemini-nano-banana-2.1",
            wait_for_render=True
        )

        return {
            "success": True,
            "topic": topic,
            "aspect_ratio": aspect_ratio,
            "dominant_hook": viral_pkg["headline"]["dominant_thumbnail_hook"],
            "subtitle": viral_pkg["headline"]["secondary_subtitle"],
            "ai_prompt": ai_prompt,
            "thumbnail_path": gen_res.get("saved_path"),
            "raw_result": gen_res
        }

    # -------------------------------------------------------------
    # 3. Reel & Video Ad Generation (Veo 3.1 & Omni Flash on Google Flow)
    # -------------------------------------------------------------
    def generate_video(
        self,
        prompt: str,
        model: str = "veo-3.1-lite",
        duration: int = 10,
        aspect_ratio: str = "9:16",
        wait_for_render: bool = True
    ) -> Dict[str, Any]:
        """Generates video reels/scenes on Google Flow via Veo 3.1."""
        payload = {
            "prompt": prompt,
            "model": model,
            "duration": duration,
            "aspectRatio": aspect_ratio,
            "wait_for_render": wait_for_render
        }
        logger.info("Dispatching video generation to Google Flow (%s, %ds, %s)...", model, duration, aspect_ratio)
        try:
            res = self.execute_command("generateVideo", payload, timeout_seconds=240.0)
        except Exception as e:
            logger.error("generate_video failed: %s", e)
            return {
                "success": False,
                "error": str(e),
                "model": model,
                "duration": duration,
                "aspect_ratio": aspect_ratio,
                "prompt": prompt
            }

        saved_path = None
        if isinstance(res, dict):
            b64 = res.get("base64") or res.get("data")
            if b64:
                vid_name = f"flow_reel_{int(time.time())}_{uuid.uuid4().hex[:6]}.mp4"
                saved_path = os.path.join(ASSETS_DIR, vid_name)
                clean_b64 = b64.split(",")[-1] if "," in b64 else b64
                with open(saved_path, "wb") as f:
                    f.write(base64.b64decode(clean_b64))
                logger.info("Saved DeepX video locally to %s", saved_path)

        return {
            "success": True,
            "model": model,
            "duration": duration,
            "aspect_ratio": aspect_ratio,
            "saved_path": saved_path,
            "raw_result": res
        }

    # -------------------------------------------------------------
    # 4. Full End-to-End Meta Suite Autopilot Production
    # -------------------------------------------------------------
    def produce_and_package_post(
        self,
        topic: str,
        post_type: str = "photo",  # photo, reel
        target_platform: str = "business_suite",
        aspect_ratio: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete 1-call end-to-end autopilot:
        1. Formulates 20M viral SEO package.
        2. Generates the visual design or video reel with Google Flow.
        3. Assembles complete post payload ready for Meta Business Suite / Profile feed.
        """
        ratio = aspect_ratio or ("9:16" if post_type in ("reel", "video") else "4:5")
        viral_pkg = meta_viral_seo.generate_20m_viral_package(
            topic=topic,
            video_type=post_type,
            target_platform=target_platform
        )

        media_path = None
        thumbnail_path = None

        if post_type in ("reel", "video"):
            video_res = self.generate_video(
                prompt=f"Cinematic high-retention reel visual for: {topic}. 8K volumetric lighting, dramatic motion.",
                model="veo-3.1-lite",
                aspect_ratio="9:16"
            )
            media_path = video_res.get("saved_path")
            thumb_res = self.generate_viral_thumbnail(topic, aspect_ratio="9:16")
            thumbnail_path = thumb_res.get("thumbnail_path")
        else:
            img_res = self.generate_image(
                prompt=f"High-impact social media post design: {topic}. Clean typography layout, tactile textures, agency visual.",
                aspect_ratio=ratio,
                model="gemini-nano-banana-2.1"
            )
            media_path = img_res.get("saved_path")

        return {
            "success": True,
            "topic": topic,
            "post_type": post_type,
            "target_platform": target_platform,
            "title": viral_pkg["headline"]["viral_title"],
            "caption": viral_pkg["caption"],
            "hashtags": viral_pkg["hashtags"],
            "media_path": media_path,
            "thumbnail_path": thumbnail_path,
            "first_comment": viral_pkg["first_comment"],
            "seo_package": viral_pkg
        }


# Global singleton bridge instance
deepx_meta = DeepXMetaBridge()


def get_deepx_meta_bridge() -> DeepXMetaBridge:
    """Returns the singleton DeepX Meta Bridge instance."""
    return deepx_meta

