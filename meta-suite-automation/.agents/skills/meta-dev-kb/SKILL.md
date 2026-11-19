---
name: meta-dev-kb
description: >-
  Authoritative Meta Developer Platform Knowledge Base & Architecture Engine. Use when the user asks questions about Meta Graph API, Instagram Graph API, Facebook Pages API, Messenger Platform, Threads API, WhatsApp Business Cloud API, Marketing API, Webhooks, error codes (#1-#80004), token lifecycle (never-expiring page token, 60-day user token exchange), permissions, rate limits, or mentions 'meta error', 'graph api', 'instagram api', 'access token expired', 'error 190', 'page token', 'rate limit', 'webhook verification', or 'meta-dev-knowledge-base'. Backed by 83 local documentation files, 6 production workflows, and instant MCP/CLI lookup tools.
---

# Meta Developer Platform Knowledge Base & Architecture Engine

This skill equips Antigravity with authoritative, enterprise-grade developer knowledge covering Meta's complete developer ecosystem (Graph API v21.0), derived from `references/meta-dev-knowledge-base/`.

---

## 0. Instant Lookup Capabilities (Zero Guesswork)

Antigravity has access to dedicated MCP tools and CLI commands backed by the local indexed repository:
- **`lookup_meta_knowledge(query, product, limit)`** or `python3 cli.py kb "<query>"`:
  Searches 83 documentation files and 6 end-to-end workflows.
- **`diagnose_meta_error(error_code, subcode)`** or `python3 cli.py error <code> [--subcode <subcode>]`:
  Instantly resolves root cause, OAuth exception type, retryability, and recovery protocol for any Meta Graph API error code (#1–#80004).
- **`get_meta_token_guide(token_type)`** or `python3 cli.py tokens [--type <type>]`:
  Provides step-by-step guides for never-expiring page tokens, 60-day long-lived tokens, and debugging inspection.

---

## 1. Error Code Diagnostic Matrix (#1 - #80004)

Always diagnose Meta API failures accurately with the exact error mapping:

| Error Code | Name | Type | Retryable? | Root Cause & Remediation |
|---|---|---|---|---|
| **#1** | API Unknown | `OAuthException` | Yes (Backoff) | Meta internal failure or temporary glitch. Retry with exponential backoff and 3-5s jitter. |
| **#2** | Service Unavailable | `OAuthException` | Yes (Backoff) | Meta backend down or overloaded. Pause and retry after 2s, 5s, 15s. |
| **#4** | App Request Limit | `OAuthException` | Yes (Pause 15-30m) | Rolling 1-hour quota exhausted (200 calls/hr/user baseline). Throttle and inspect `x-app-usage`. |
| **#6** | Max Retries Reached | `OAuthException` | No | Persistent failure. Halt retries; inspect request payload and token validity. |
| **#7** | User Not Active | `OAuthException` | No | Account deactivated or security checkpointed. Account owner must verify on desktop browser. |
| **#10** | App Lacks Permission | `OAuthException` | No | Meta App lacks permission or Advanced Access in App Dashboard -> Use Cases / Permissions. |
| **#17** | User Request Limit | `OAuthException` | Yes (Pause 30-60m) | A single user exceeded hourly API limit. Pause automation for this user ID. |
| **#100** | Invalid Parameter | `OAuthException` | No | Missing required parameter, invalid field, aspect ratio violation, or media URL not public HTTPS. |
| **#170** | Invalid Redirect URI | `OAuthException` | No | Callback URL not in App Dashboard -> Facebook Login -> Settings -> Valid OAuth Redirect URIs. |
| **#190** | Invalid OAuth Token | `OAuthException` | No (Requires Renewal) | Access token expired, revoked, or invalidated. See Subcode Table below. |
| **#200** | Missing Scope | `OAuthException` | No | Valid token lacks required scope (`instagram_content_publish`, `pages_manage_posts`, etc.). |
| **#341** | Feed Action Limit | `OAuthException` | Yes (15-30m space) | Anti-spam trigger from too many rapid posts. Obey 25 posts/24h cap and human spacing. |
| **#368** | Policy Block | `OAuthException` | No (Pause 24-48h) | Meta anti-bot flagged repetitive behavior. Halt automated actions immediately. |
| **#613** | Burst Rate Limit | `OAuthException` | Yes (5s delay) | Rate limit in 60-second sliding window. Implement 5s delay between sequential calls. |
| **#80004** | Page Request Limit | `OAuthException` | Yes (Backoff Page) | Page-level limit reached for this specific Page ID. Other pages or profile feeds unaffected. |

### Error #190 Subcode Resolutions:
- **Subcode 463**: Token expired after 60 days. Run token exchange flow (`grant_type=fb_exchange_token`) to generate a new long-lived token.
- **Subcode 467**: User session expired or user logged out on a device. Re-authenticate via Facebook Login.
- **Subcode 468**: User password was changed or security reset triggered. Re-authenticate account.
- **Subcode 490**: Target user account inactive or checkpointed. Account owner must log in on desktop to clear checkpoint.

---

## 2. Token Lifecycle & The Never-Expiring Page Token Secret

### The Official Formula:
A common misconception is that all Facebook Page Tokens expire. **Meta official specification guarantees that a Page Token NEVER expires if and only if it is generated using a long-lived User Token!**

1. **Step 1: Short-Lived User Token (~1-2h)**
   Generated via OAuth Dialog or Graph API Explorer with permissions (`pages_show_list`, `pages_manage_posts`).
2. **Step 2: Exchange for 60-Day Long-Lived User Token**
   ```http
   GET /oauth/access_token?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
3. **Step 3: Extract NEVER-EXPIRING Page Token**
   ```http
   GET /me/accounts?access_token={LONG_LIVED_USER_TOKEN}
   ```
   Each page object returns `access_token`. Because queried with a long-lived user token, **this page token has no expiration date (`never_expires: true`)** unless the page administrator revokes app permissions or resets their account password.

---

## 3. Production Workflows Architecture

### Workflow 1: Instagram 2-Step Container Publishing
1. **Container Creation**:
   ```http
   POST /{ig_user_id}/media
   image_url={PUBLIC_HTTPS_URL}&caption={VIRAL_CAPTION}&access_token={PAGE_TOKEN}
   ```
   Returns `{ "id": "{container_id}" }`.
2. **Container Status Check (Reels/Videos)**:
   ```http
   GET /{container_id}?fields=status_code&access_token={PAGE_TOKEN}
   ```
   Wait for status `FINISHED` before proceeding.
3. **Publishing**:
   ```http
   POST /{ig_user_id}/media_publish
   creation_id={container_id}&access_token={PAGE_TOKEN}
   ```
   Returns `{ "id": "{published_post_id}" }`.
- **Requirements**: Scopes `instagram_basic` + `instagram_content_publish`. 25 posts/24h cap.

### Workflow 2: 24-Hour Messaging Window & Message Tags
- **Standard 24-Hour Rule**: Automated messaging can only be sent within 24 hours of the user's last inbound message.
- **Outside 24-Hour Window**: Must use approved `MESSAGE_TAG` (`CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE`). Strictly non-promotional.
- **`HUMAN_AGENT` Tag**: Extends response window to 7 days for manual agent replies.

---

## 4. Viral SEO & Nano Banana Creative Studio

When generating or scheduling social media posts:
1. **Apply 3-Second Retention Hooks**:
   - *Contrarian*: "Stop doing [Common Practice]. Here is what top 1% do instead: 👇"
   - *Numbered Blueprint*: "The 30-Day [Goal] Blueprint (Zero BS, Just Pure Execution): 🧵"
   - *Vulnerability*: "From [Unfavorable State] to [Accomplishment] in [Timeframe]. 5 hard lessons:"
2. **Apply 7 Nano Banana Visual Archetypes**:
   - `tactile_workspace`: Physical clipboard, brass binder clips, mechanical keyboard, warm natural desk light.
   - `classical_fusion`: Marble The Thinker statue holding an ultramodern aluminum laptop with code on screen.
   - `surreal_metaphor`: Hourglass filled with miniature glowing microchips instead of sand.
   - `kinetic_blueprint`: Exploded isometric 3D blueprint with cyan/indigo technical drafting callouts.
   - `retro_modern`: 16-bit arcade pixel art with CRT scanlines and neon city reflections.
   - `macro_texture`: Embossed gold foil debossed on textured dark linen paper.
   - `minimalist_monolith`: Brutalist black stone monolith in Scandinavian mist.
