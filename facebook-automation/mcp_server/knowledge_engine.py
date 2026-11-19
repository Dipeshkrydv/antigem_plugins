"""
Antigravity Meta Suite - Meta Developer Platform Knowledge Engine
Provides deep, authoritative programmatic lookup of Meta's 83 documentation pages,
end-to-end API workflows, error diagnosis (#1-#80004), and token lifecycle guides.
Backed by references/meta-dev-knowledge-base/.
"""

import os
import re
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("meta_suite.knowledge")

KB_BASE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "references", "meta-dev-knowledge-base")
)

ERROR_CODE_REGISTRY = {
    1: {
        "name": "API Unknown",
        "type": "OAuthException",
        "description": "Unclassified internal Meta API failure or temporary glitch.",
        "action": "Retry request with exponential backoff and 3-5s jitter. If persistent, check Meta status dashboard.",
        "retryable": True
    },
    2: {
        "name": "Service Temporarily Unavailable",
        "type": "OAuthException",
        "description": "Meta service is down or temporarily unreachable.",
        "action": "Exponential backoff: retry after 2s, 5s, 15s. Do not spam requests.",
        "retryable": True
    },
    4: {
        "name": "Application Request Limit Reached",
        "type": "OAuthException",
        "description": "App-level rate limit exceeded. Rolling 1-hour quota exhausted.",
        "action": "Throttle immediately. Wait 15-30 minutes. Back off and inspect 'x-app-usage' response header.",
        "retryable": True
    },
    6: {
        "name": "Max Retries Reached",
        "type": "OAuthException",
        "description": "Action failed repeatedly; persistent internal error.",
        "action": "Halt automatic retries. Log payload and verify parameters before manual retry.",
        "retryable": False
    },
    7: {
        "name": "User Not Active",
        "type": "OAuthException",
        "description": "The target user account is deactivated, checkpointed, or flagged by Meta security.",
        "action": "Have account owner log into facebook.com/instagram.com on desktop to resolve checkpoint.",
        "retryable": False
    },
    10: {
        "name": "Application Lacks Permission",
        "type": "OAuthException",
        "description": "The Meta App lacks permission or Advanced Access for this specific feature/endpoint.",
        "action": "Check App Dashboard -> Use Cases / Permissions. Ensure app is in Live mode or user has an App Role.",
        "retryable": False
    },
    17: {
        "name": "User Request Limit Reached",
        "type": "OAuthException",
        "description": "A single user has exceeded their allowable hourly API action limit.",
        "action": "Pause automation actions for this specific user ID for 30-60 minutes.",
        "retryable": True
    },
    100: {
        "name": "Invalid Parameter",
        "type": "OAuthException",
        "description": "Malformed request. Parameter missing, invalid field, or media URL not publicly accessible.",
        "action": "Verify media_type ('IMAGE'/'VIDEO'/'REELS'), public image URL accessibility, aspect ratio (4:5 or 9:16), or JSON payload structure.",
        "retryable": False
    },
    170: {
        "name": "Invalid Redirect URI",
        "type": "OAuthException",
        "description": "The redirect URI provided does not match the Allowed Redirect URIs in Facebook Login settings.",
        "action": "Add exact callback URL to App Dashboard -> Facebook Login -> Settings -> Valid OAuth Redirect URIs.",
        "retryable": False
    },
    190: {
        "name": "Invalid OAuth Access Token",
        "type": "OAuthException",
        "description": "Access token expired, invalidated, user logged out, or password changed.",
        "action": "Token must be renewed. Convert fresh short-lived token to 60-day long-lived token via fb_exchange_token, or regenerate never-expiring Page token.",
        "retryable": False,
        "subcodes": {
            463: "Token expired after 60 days. Run token exchange flow to generate new long-lived token.",
            467: "User session expired or user logged out on device. Re-authenticate account.",
            468: "User session invalidated due to security reset. Re-authenticate.",
            490: "Target user account inactive."
        }
    },
    200: {
        "name": "Permissions Error",
        "type": "OAuthException",
        "description": "Access token is valid, but lacks the necessary scope for this endpoint.",
        "action": "Request missing permission: for IG publishing need 'instagram_basic' + 'instagram_content_publish'; for Facebook Page need 'pages_show_list' + 'pages_manage_posts'.",
        "retryable": False
    },
    341: {
        "name": "Feed Action Request Limit",
        "type": "OAuthException",
        "description": "Too many consecutive posts made to feed in short succession (anti-spam trigger).",
        "action": "Apply 15-30 minute human spacing between posts. Obey 25 posts/24h cap.",
        "retryable": True
    },
    368: {
        "name": "Temporarily Blocked for Policy Violation",
        "type": "OAuthException",
        "description": "Meta anti-bot heuristic flagged account activity (excessive links, repetitive comments).",
        "action": "Pause all automated actions immediately for 24-48 hours to avoid account suspension.",
        "retryable": False
    },
    613: {
        "name": "Calls to API Too Many",
        "type": "OAuthException",
        "description": "Rate limit exceeded. Too many requests in 60-second window.",
        "action": "Throttle requests. Implement 5s minimum delay between sequential API calls.",
        "retryable": True
    },
    80004: {
        "name": "Page-Scoped Request Limit",
        "type": "OAuthException",
        "description": "Page-level rate limit reached for this Facebook Page.",
        "action": "Back off actions specifically for this Page ID. Other pages or profiles are unaffected.",
        "retryable": True
    }
}


class MetaKnowledgeEngine:
    """Production knowledge engine serving local Meta developer documentation & workflows."""

    def __init__(self, kb_path: str = KB_BASE_PATH):
        self.kb_path = kb_path
        self._doc_cache: Dict[str, Any] = {}
        self._load_doc_index()

    def _load_doc_index(self):
        """Indexes all markdown documentation files for fast keyword search."""
        doc_dir = os.path.join(self.kb_path, "documentation")
        workflow_dir = os.path.join(self.kb_path, "workflows")

        paths_to_scan = []
        if os.path.isdir(doc_dir):
            for root, _, files in os.walk(doc_dir):
                for f in files:
                    if f.endswith(".md"):
                        paths_to_scan.append(os.path.join(root, f))

        if os.path.isdir(workflow_dir):
            for root, _, files in os.walk(workflow_dir):
                for f in files:
                    if f.endswith(".md"):
                        paths_to_scan.append(os.path.join(root, f))

        for fpath in paths_to_scan:
            try:
                rel = os.path.relpath(fpath, self.kb_path)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # Extract first H1 title
                title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
                title = title_match.group(1).strip() if title_match else os.path.basename(fpath).replace(".md", "")

                # Extract category
                parts = rel.split(os.sep)
                category = parts[1] if len(parts) > 1 and parts[0] == "documentation" else parts[0]

                self._doc_cache[rel] = {
                    "path": fpath,
                    "relative_path": rel,
                    "title": title,
                    "category": category,
                    "content": content
                }
            except Exception as e:
                logger.debug("Failed indexing %s: %s", fpath, e)

    def lookup_docs(self, query: str, product: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Searches the local 83 documentation pages by query keywords and optional product filter.
        """
        q_tokens = [t.lower() for t in query.split() if len(t) > 2]
        matches = []

        for rel, doc in self._doc_cache.items():
            if product and product.lower() not in doc["category"].lower() and product.lower() not in rel.lower():
                continue

            score = 0
            title_lower = doc["title"].lower()
            content_lower = doc["content"].lower()

            for tok in q_tokens:
                if tok in title_lower:
                    score += 10
                if tok in rel.lower():
                    score += 5
                score += min(content_lower.count(tok), 10)

            if score > 0 or not q_tokens:
                # Extract first 400 chars as summary
                clean_body = re.sub(r"#+.*", "", doc["content"]).strip()
                summary = clean_body[:300].replace("\n", " ").strip() + "..."
                matches.append({
                    "title": doc["title"],
                    "relative_path": rel,
                    "category": doc["category"],
                    "score": score,
                    "summary": summary
                })

        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:limit]

    def diagnose_error(self, error_code: int, subcode: Optional[int] = None) -> Dict[str, Any]:
        """
        Diagnoses a Graph API error code and subcode with exact explanation and remediation.
        """
        entry = ERROR_CODE_REGISTRY.get(int(error_code))
        if not entry:
            return {
                "error_code": error_code,
                "subcode": subcode,
                "found": False,
                "name": f"Error #{error_code}",
                "description": "Unregistered or vendor-specific Meta error code.",
                "action": "Inspect error message string and fbtrace_id in response. If 4xx, correct parameters. If 5xx, retry with exponential backoff.",
                "retryable": False
            }

        subcode_msg = None
        if subcode and "subcodes" in entry and subcode in entry["subcodes"]:
            subcode_msg = entry["subcodes"][subcode]

        return {
            "error_code": error_code,
            "subcode": subcode,
            "found": True,
            "name": entry["name"],
            "type": entry.get("type", "OAuthException"),
            "description": entry["description"],
            "subcode_explanation": subcode_msg,
            "action": entry["action"],
            "retryable": entry.get("retryable", False)
        }

    def get_token_guide(self, token_type: str = "long_lived_page") -> Dict[str, Any]:
        """
        Provides authoritative step-by-step token generation and renewal formulas.
        token_type: 'never_expiring_page', 'long_lived_user', 'short_lived', 'renewal'.
        """
        t = token_type.lower().replace("-", "_")

        if t in ("never_expiring_page", "page", "fb_page", "never_expiring"):
            return {
                "token_type": "Never-Expiring Facebook Page Token",
                "validity": "Never expires (permanent) unless user changes Facebook password or revokes permissions",
                "target_platform": "Facebook Pages (posts, reels, stories, comments)",
                "generation_steps": [
                    "Step 1: Get App ID & App Secret from developers.facebook.com -> App settings -> Basic.",
                    "Step 2: Generate short-lived User Token with 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'.",
                    "Step 3: Convert to 60-day Long-Lived User Token via GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}",
                    "Step 4: Query GET https://graph.facebook.com/v21.0/{PAGE_ID}?fields=access_token using the 60-day Long-Lived User Token.",
                    "Step 5: The returned 'access_token' is a NEVER-EXPIRING Page Token. Save it to .env as FB_PAGE_ACCESS_TOKEN."
                ],
                "crucial_rule": "Page Token only becomes never-expiring when queried using a LONG-LIVED user token (Meta official specification). Querying with a short-lived token generates a short-lived page token."
            }
        elif t in ("long_lived_user", "instagram", "ig", "60_day"):
            return {
                "token_type": "Long-Lived User Access Token (Instagram)",
                "validity": "60 Days (5,184,000 seconds)",
                "target_platform": "Instagram Creator / Business automation",
                "generation_steps": [
                    "Step 1: Get App ID & App Secret from App Settings -> Basic.",
                    "Step 2: Generate short-lived User Token with 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments'.",
                    "Step 3: Exchange via GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}",
                    "Step 4: The returned JSON contains 'access_token' with 'expires_in: 5184000'. Save as IG_ACCESS_TOKEN."
                ],
                "renewal_rule": "Can be renewed between Day 1 and Day 60 without logging in again by repeating the fb_exchange_token call with the current long-lived token."
            }
        elif t in ("short_lived", "test"):
            return {
                "token_type": "Short-Lived User Token (Testing Only)",
                "validity": "1 to 2 hours",
                "generation_steps": [
                    "Step 1: Open developers.facebook.com -> Tools -> Graph API Explorer.",
                    "Step 2: Select your Meta App from the dropdown.",
                    "Step 3: Add permissions and click 'Generate Access Token'.",
                    "Step 4: Use exclusively for rapid endpoint testing in Graph Explorer."
                ]
            }
        else:
            return {
                "token_type": "Token Renewal Lifecycle",
                "rules": [
                    "Never-expiring Page Tokens do not need renewal unless password reset.",
                    "Long-lived User Tokens (60 days) should be renewed every 45-50 days via automated cron.",
                    "If token returns Error #190 (subcode 463), token has already expired and requires re-login.",
                    "Antigravity Meta Suite automatically syncs live session cookies directly from Chrome Extension, providing permanent zero-manual renewal."
                ]
            }

    def get_workflow(self, workflow_name: str) -> Dict[str, Any]:
        """
        Retrieves complete recipe for a given workflow.
        workflow_name: 'instagram_publishing', 'pages_management', 'messaging', 'threads'.
        """
        name = workflow_name.lower().replace(" ", "_")

        if "instagram" in name and "publish" in name:
            return {
                "workflow": "Instagram Two-Step Container Publishing",
                "steps": [
                    {"step": 1, "action": "Prepare Media", "detail": "Public HTTPS URL for image/video or in-memory DataTransfer in extension bridge. Aspect ratio: 4:5 (Feed), 9:16 (Reel/Story), 1:1 (Square). JPEG RGB required for photos."},
                    {"step": 2, "action": "Create Container", "endpoint": "POST /v21.0/{ig-user-id}/media", "params": {"image_url": "URL", "caption": "SEO Caption #tags"}},
                    {"step": 3, "action": "Check Status (Videos)", "endpoint": "GET /v21.0/{container-id}?fields=status_code", "expected": "FINISHED (or poll until ready)"},
                    {"step": 4, "action": "Publish Container", "endpoint": "POST /v21.0/{ig-user-id}/media_publish", "params": {"creation_id": "{container-id}"}},
                    {"step": 5, "action": "Verify & Retrieve Link", "endpoint": "GET /v21.0/{media-id}?fields=permalink,id"}
                ],
                "rate_limits": "25 posts / 24 hours per account. Enforce 15-minute anti-spam spacing."
            }
        elif "page" in name:
            return {
                "workflow": "Facebook Page Publishing & Comment Moderation",
                "steps": [
                    {"step": 1, "action": "Feed Text / Link Post", "endpoint": "POST /v21.0/{page-id}/feed", "params": {"message": "Text", "link": "Optional URL"}},
                    {"step": 2, "action": "Photo Post", "endpoint": "POST /v21.0/{page-id}/photos", "params": {"url": "Image URL", "message": "Caption"}},
                    {"step": 3, "action": "Video / Reel Post", "endpoint": "POST https://graph-video.facebook.com/v21.0/{page-id}/videos", "params": {"file_url": "Video URL", "description": "Caption"}},
                    {"step": 4, "action": "Moderate Comments", "endpoint": "GET /v21.0/{post-id}/comments", "reply_endpoint": "POST /v21.0/{comment-id}/comments"}
                ],
                "tokens": "Requires never-expiring Page Token with pages_manage_posts scope."
            }
        elif "messag" in name or "dm" in name:
            return {
                "workflow": "Instagram & Messenger 24-Hour Policy Window",
                "rules": [
                    "24-Hour Window: You may message a user within 24 hours of their last incoming message.",
                    "Human Agent Tag: Allows 1 human response up to 7 days for complex customer inquiries.",
                    "Comment-to-DM Funnel: You may send exactly 1 private DM in response to a public comment within 7 days.",
                    "Automated cold DMs outside the 24-hour window are strictly prohibited by Meta policy."
                ]
            }
        else:
            return {
                "workflow": "General Meta Automation Rules",
                "summary": "Covers Instagram, Facebook Pages, Messenger, and Threads automation with rate-limit compliance, anti-spam spacing, and authentic account routing."
            }


# Global singleton instance
knowledge_engine = MetaKnowledgeEngine()
