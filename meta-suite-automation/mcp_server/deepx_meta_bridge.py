# -*- coding: utf-8 -*-
"""deepx_meta_bridge.py -- Meta Suite media generation through the built-in DeepX Google Flow engine.

The old DeepX Chrome bridge (http://127.0.0.1:8792) is gone. This module calls the Meta Suite AntiGem
plugin's own MCP tools (plugin host http://127.0.0.1:8865/mcp?extension=meta-suite-automation):
deepx_meta_status / deepx_meta_generate_design / deepx_meta_generate_thumbnail / deepx_meta_generate_video
and polls deepx_job_status. The engine checks the Google Flow login, asks Agent Mode vs Standard
(pass generation_mode or set DEEPX_GENERATION_MODE), and auto-switches to Agent Mode on
"unusual activity" blocks.
"""
import json
import os
import time
import urllib.request
from typing import Any, Dict, Optional

try:
    from .meta_viral_seo_engine import meta_viral_seo
except Exception:  # pragma: no cover - CLI import path
    from mcp_server.meta_viral_seo_engine import meta_viral_seo

EXT_ID = os.getenv("META_PLUGIN_ID", "meta-suite-automation")
DEEPX_MCP_URL = os.getenv("DEEPX_MCP_URL", f"http://127.0.0.1:8865/mcp?extension={EXT_ID}")
DEVICE_ID = os.getenv("ANTIGEM_DEVICE_ID") or os.getenv("FLOW_DEVICE_ID", "78668db31e6bec3a")


class DeepXMetaBridge:
    """Client for the built-in DeepX Google Flow engine of the Meta Suite plugin."""

    def __init__(self, base_url: str = DEEPX_MCP_URL):
        self.base_url = base_url

    def _call(self, tool: str, args: Dict[str, Any], timeout: float = 200.0) -> Dict[str, Any]:
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": args}}).encode()
        req = urllib.request.Request(self.base_url, data=body, headers={"X-Device-Id": DEVICE_ID, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            resp = json.loads(r.read().decode("utf-8"))
        if "error" in resp:
            raise RuntimeError(resp["error"])
        res = resp.get("result", {})
        text = "".join(c.get("text", "") for c in res.get("content", []))
        try:
            data = json.loads(text)
        except ValueError:
            data = {"text": text}
        if res.get("isError"):
            raise RuntimeError(data.get("error") if isinstance(data, dict) else text)
        return data.get("structuredContent", data) if isinstance(data, dict) else data

    def get_status(self) -> Dict[str, Any]:
        try:
            r = self._call("deepx_meta_status", {}, timeout=60)
            return {"connected": bool(r.get("google_flow_logged_in")), **r}
        except Exception as e:
            return {"connected": False, "error": f"Meta Suite plugin not reachable at {self.base_url}: {e}"}

    def _run(self, tool: str, args: Dict[str, Any], generation_mode: Optional[str], wait_for_render: bool) -> Dict[str, Any]:
        mode = generation_mode or os.getenv("DEEPX_GENERATION_MODE")
        if mode:
            args["generation_mode"] = mode
        try:
            r = self._call(tool, args)
        except Exception as e:
            return {"success": False, "error": str(e)}
        if r.get("action_required"):
            return {"success": False, **r}
        if not wait_for_render or not r.get("job_id"):
            return {"success": True, **r}
        job = r["job_id"]
        deadline = time.time() + 1800
        while r.get("status") not in ("done", "failed", "cancelled") and time.time() < deadline:
            r = self._call("deepx_job_status", {"job_id": job, "wait_seconds": 30}, timeout=90)
        files = r.get("files") or []
        path = files[0].get("path") if files else None
        return {"success": r.get("status") == "done" and bool(path), "job_id": job, "status": r.get("status"),
                "stage": r.get("stage"), "saved_path": path, "files": files, "mode": r.get("mode") or r.get("mode_used"),
                "error": r.get("error")}

    def generate_image(self, prompt: str, aspect_ratio: str = "4:5", model: str = "gemini-nano-banana-2.1",
                       count: int = 1, wait_for_render: bool = True, generation_mode: Optional[str] = None) -> Dict[str, Any]:
        """Social designs & photo cards on Google Flow (Nano Banana) through the built-in DeepX engine."""
        return self._run("deepx_meta_generate_design", {"prompt": prompt, "aspect_ratio": aspect_ratio, "model": model},
                         generation_mode, wait_for_render)

    def generate_viral_thumbnail(self, topic: str, title_hook: Optional[str] = None, subtitle: Optional[str] = None,
                                 aspect_ratio: str = "16:9", archetype: str = "classical_contrast",
                                 generation_mode: Optional[str] = None) -> Dict[str, Any]:
        args = {"topic": topic, "aspect_ratio": aspect_ratio, "archetype": archetype}
        if title_hook:
            args["title_hook"] = title_hook
        if subtitle:
            args["subtitle"] = subtitle
        r = self._run("deepx_meta_generate_thumbnail", args, generation_mode, True)
        r["thumbnail_path"] = r.get("saved_path")
        return r

    def generate_video(self, prompt: str, model: str = "veo-3.1-lite", duration: int = 10, aspect_ratio: str = "9:16",
                       wait_for_render: bool = True, generation_mode: Optional[str] = None) -> Dict[str, Any]:
        """Video reels/scenes on Google Flow (Veo 3.1 / Omni) through the built-in DeepX engine."""
        return self._run("deepx_meta_generate_video", {"prompt": prompt, "model": model, "duration": duration,
                                                        "aspect_ratio": aspect_ratio}, generation_mode, wait_for_render)

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

