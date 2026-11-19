/**
 * Antigravity Meta Suite - Meta Developer Platform Knowledge Base Module
 * Client-side authoritative knowledge base containing:
 * - 83 Documentation files index across 9 Meta API categories
 * - Complete Error Code Diagnostic Registry (#1 to #80004) with subcode resolutions
 * - End-to-End Workflow Blueprints (Instagram 2-step, Page Token formula, 24h DM window, etc.)
 * - Token Lifecycle & Renewal Formulas
 * - Viral SEO Hooks & 7 Nano Banana Visual Archetypes
 */

export const metaKnowledgeData = {
  // ---------------------------------------------------------------------------
  // 1. Error Code Diagnostic Matrix
  // ---------------------------------------------------------------------------
  errorCodes: {
    1: {
      name: "API Unknown / Internal Error",
      type: "OAuthException",
      description: "Unclassified internal Meta API failure or temporary backend glitch.",
      action: "Retry request with exponential backoff and 3-5s jitter. If persistent, verify Meta Developer Status dashboard.",
      retryable: true,
      category: "System",
      cliCommand: "python3 cli.py error 1"
    },
    2: {
      name: "Service Temporarily Unavailable",
      type: "OAuthException",
      description: "Meta Graph API service is temporarily overloaded or unreachable.",
      action: "Exponential backoff: pause and retry after 2s, 5s, 15s. Do not spam rapid requests.",
      retryable: true,
      category: "System",
      cliCommand: "python3 cli.py error 2"
    },
    4: {
      name: "Application Request Limit Reached",
      type: "OAuthException",
      description: "App-level rate limit exceeded. Rolling 1-hour quota exhausted (200 calls/hr/user baseline).",
      action: "Throttle all calls immediately. Inspect 'x-app-usage' response header. Wait 15-30 minutes before next batch.",
      retryable: true,
      category: "Rate Limit",
      cliCommand: "python3 cli.py error 4"
    },
    6: {
      name: "Max Retries Reached",
      type: "OAuthException",
      description: "Action failed repeatedly; persistent internal server failure.",
      action: "Halt automated retries. Check endpoint parameters, access token validity, and payload formatting.",
      retryable: false,
      category: "System",
      cliCommand: "python3 cli.py error 6"
    },
    7: {
      name: "User Not Active",
      type: "OAuthException",
      description: "The target Facebook/Instagram account is deactivated, locked, or undergoing checkpoint verification.",
      action: "Have account owner log into facebook.com or instagram.com in a desktop browser to clear security checkpoint.",
      retryable: false,
      category: "Authentication",
      cliCommand: "python3 cli.py error 7"
    },
    10: {
      name: "Application Lacks Permission",
      type: "OAuthException",
      description: "The Meta App lacks Advanced Access or permission for this specific endpoint.",
      action: "Check App Dashboard -> Use Cases / Permissions. If app in Development Mode, ensure requesting user has an Admin/Developer/Tester role.",
      retryable: false,
      category: "Permissions",
      cliCommand: "python3 cli.py error 10"
    },
    17: {
      name: "User Request Limit Reached",
      type: "OAuthException",
      description: "A single user has exceeded their allowable hourly API action limit.",
      action: "Pause API actions for this specific user ID for 30-60 minutes. Other user accounts are unaffected.",
      retryable: true,
      category: "Rate Limit",
      cliCommand: "python3 cli.py error 17"
    },
    100: {
      name: "Invalid Parameter / Malformed Request",
      type: "OAuthException",
      description: "Parameter missing, invalid field, unsupported aspect ratio, or media URL not publicly accessible via HTTPS.",
      action: "Verify media_type ('IMAGE'/'VIDEO'/'REELS'), public image URL accessibility, aspect ratio (4:5 or 9:16), or JSON payload structure.",
      retryable: false,
      category: "Validation",
      cliCommand: "python3 cli.py error 100"
    },
    170: {
      name: "Invalid Redirect URI",
      type: "OAuthException",
      description: "The OAuth redirect URI does not match the Valid OAuth Redirect URIs configured in App Dashboard.",
      action: "Go to App Dashboard -> Facebook Login -> Settings -> Valid OAuth Redirect URIs and add your exact callback URL.",
      retryable: false,
      category: "Authentication",
      cliCommand: "python3 cli.py error 170"
    },
    190: {
      name: "Invalid OAuth 2.0 Access Token",
      type: "OAuthException",
      description: "Access token is expired, revoked, invalidated, user logged out, or password was changed.",
      action: "Token must be renewed. Run token exchange flow to exchange short-lived token for 60-day token, or re-authorize.",
      retryable: false,
      category: "Authentication",
      cliCommand: "python3 cli.py error 190 --subcode 463",
      subcodes: {
        463: {
          title: "Token Expired",
          desc: "Token expired after 60 days. Run token exchange flow via fb_exchange_token to generate a new long-lived token."
        },
        467: {
          title: "Session Expired",
          desc: "User session expired or user logged out on a device. Re-authenticate via Facebook Login."
        },
        468: {
          title: "Security Reset",
          desc: "User password changed or security reset triggered. Generate fresh short-lived token and exchange."
        },
        490: {
          title: "User Inactive",
          desc: "Target user account inactive or checkpointed. Account owner must verify on facebook.com."
        }
      }
    },
    200: {
      name: "Permissions Disallowed / Missing Scope",
      type: "OAuthException",
      description: "Access token is valid, but lacks the necessary permission scope for this specific operation.",
      action: "For IG publishing: require 'instagram_basic' + 'instagram_content_publish'. For Facebook Pages: require 'pages_show_list' + 'pages_manage_posts'.",
      retryable: false,
      category: "Permissions",
      cliCommand: "python3 cli.py error 200"
    },
    341: {
      name: "Feed Action Request Limit",
      type: "OAuthException",
      description: "Too many consecutive posts made to feed in short succession (anti-spam trigger).",
      action: "Enforce human spacing (15-30 minutes minimum between posts). Obey 25 posts per 24 hours cap.",
      retryable: true,
      category: "Rate Limit",
      cliCommand: "python3 cli.py error 341"
    },
    368: {
      name: "Temporarily Blocked for Policy Violation",
      type: "OAuthException",
      description: "Meta anti-bot heuristic flagged account behavior (repetitive posts, aggressive link sharing).",
      action: "Halt all automated posting immediately for 24-48 hours to avoid permanent account ban. Use browser session cookies or manual publishing.",
      retryable: false,
      category: "Policy",
      cliCommand: "python3 cli.py error 368"
    },
    613: {
      name: "Calls to API Too Many",
      type: "OAuthException",
      description: "Rate limit exceeded. Too many requests sent within a 60-second sliding window.",
      action: "Throttle requests. Implement 5s minimum delay between sequential API calls.",
      retryable: true,
      category: "Rate Limit",
      cliCommand: "python3 cli.py error 613"
    },
    80004: {
      name: "Page-Scoped Request Limit Reached",
      type: "OAuthException",
      description: "Rate limit reached specifically for this Facebook Page ID.",
      action: "Back off actions specifically for this Page ID. Other pages and personal profile feeds are unaffected.",
      retryable: true,
      category: "Rate Limit",
      cliCommand: "python3 cli.py error 80004"
    }
  },

  // ---------------------------------------------------------------------------
  // 2. End-to-End Workflow Blueprints
  // ---------------------------------------------------------------------------
  workflows: [
    {
      id: "instagram_publishing",
      title: "Instagram 2-Step Container Publishing",
      icon: "📸",
      badge: "API v21.0 Standard",
      description: "Official 2-step media publishing architecture for Instagram Feed photos, videos, and Reels.",
      steps: [
        {
          number: "Step 1",
          name: "Create Media Container",
          endpoint: "POST /{ig_user_id}/media",
          payload: "image_url=https://...&caption=Hook+Value+CTA&access_token={PAGE_TOKEN}",
          note: "Image must be publicly accessible over HTTPS (JPEG, max 8MB, 4:5 or 1:1 aspect ratio)."
        },
        {
          number: "Step 2",
          name: "Poll Container Status (Reels/Videos)",
          endpoint: "GET /{container_id}?fields=status_code",
          payload: "access_token={PAGE_TOKEN}",
          note: "Wait until status_code returns 'FINISHED' (images ready instantly; reels take 5-30s)."
        },
        {
          number: "Step 3",
          name: "Publish Media Container",
          endpoint: "POST /{ig_user_id}/media_publish",
          payload: "creation_id={container_id}&access_token={PAGE_TOKEN}",
          note: "Returns published post ID. Post goes live immediately on Instagram profile."
        }
      ],
      requiredScopes: ["instagram_basic", "instagram_content_publish"],
      rateLimits: "25 published posts per rolling 24-hour window.",
      cliSnippet: "python3 cli.py post --platform instagram --caption 'Your viral post' --media path/to/image.jpg"
    },
    {
      id: "page_token_formula",
      title: "Never-Expiring Page Token Formula",
      icon: "🔑",
      badge: "Official Secret",
      description: "The exact 3-step formula to generate Page Tokens that NEVER expire.",
      steps: [
        {
          number: "Step 1",
          name: "Acquire Short-Lived User Token",
          endpoint: "OAuth Dialog / Graph Explorer",
          payload: "Scopes: pages_show_list, pages_manage_posts, pages_read_engagement",
          note: "Token validity: ~1-2 hours."
        },
        {
          number: "Step 2",
          name: "Exchange for 60-Day Long-Lived Token",
          endpoint: "GET /oauth/access_token",
          payload: "grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}",
          note: "Returns long_lived_user_token valid for 60 days."
        },
        {
          number: "Step 3",
          name: "Extract NEVER-EXPIRING Page Token",
          endpoint: "GET /me/accounts",
          payload: "access_token={LONG_LIVED_USER_TOKEN}",
          note: "CRITICAL SECRET: Because queried using a long-lived user token, the returned page access_token has NO EXPIRATION DATE!"
        }
      ],
      requiredScopes: ["pages_show_list", "pages_manage_posts"],
      rateLimits: "Token never expires unless page admin resets password or revokes app permissions.",
      cliSnippet: "python3 cli.py tokens --type never_expiring_page"
    },
    {
      id: "messaging_24h_policy",
      title: "24-Hour Messaging Window & Tags",
      icon: "💬",
      badge: "Compliance Rule",
      description: "Policy rules and message tags for automated responses in Messenger & Instagram DM.",
      steps: [
        {
          number: "Rule 1",
          name: "Standard 24-Hour Window",
          endpoint: "POST /{ig_user_id}/messages or /{page_id}/messages",
          payload: "recipient={'id':'...'}&message={'text':'...'}",
          note: "Free-form automated messaging is allowed strictly within 24 hours of the user's last inbound message."
        },
        {
          number: "Rule 2",
          name: "Outside 24-Hour Window (Message Tags)",
          endpoint: "POST /me/messages",
          payload: "messaging_type=MESSAGE_TAG&tag=CONFIRMED_EVENT_UPDATE|POST_PURCHASE_UPDATE|ACCOUNT_UPDATE",
          note: "Promotional content strictly prohibited in tags. Violation causes instant app suspension."
        },
        {
          number: "Rule 3",
          name: "HUMAN_AGENT Tag (7-Day Extension)",
          endpoint: "POST /me/messages",
          payload: "messaging_type=MESSAGE_TAG&tag=HUMAN_AGENT",
          note: "Allows manual agent replies up to 7 days after user's message (requires app review approval)."
        }
      ],
      requiredScopes: ["instagram_manage_messages", "pages_messaging"],
      rateLimits: "Standard Messenger rate limits apply.",
      cliSnippet: "python3 cli.py kb 'instagram messaging'"
    },
    {
      id: "facebook_pages_posting",
      title: "Facebook Pages & Feed Automation",
      icon: "📄",
      badge: "Feed Architecture",
      description: "Publishing text updates, links, single photos, and albums to Facebook Pages.",
      steps: [
        {
          number: "Step 1",
          name: "Text or Link Post",
          endpoint: "POST /{page_id}/feed",
          payload: "message=Your+post+content&link=https://...&access_token={PAGE_TOKEN}",
          note: "Publishes immediately to the page's public feed."
        },
        {
          number: "Step 2",
          name: "Photo Post with Caption",
          endpoint: "POST /{page_id}/photos",
          payload: "url=https://...&message=Caption+text&access_token={PAGE_TOKEN}",
          note: "Publishes photo directly with full viral SEO caption."
        }
      ],
      requiredScopes: ["pages_manage_posts", "pages_read_engagement"],
      rateLimits: "Avoid exceeding 25 posts/day to prevent anti-spam algorithmic penalties.",
      cliSnippet: "python3 cli.py post --platform facebook --caption 'Your announcement'"
    }
  ],

  // ---------------------------------------------------------------------------
  // 3. Viral SEO Hook Formulas
  // ---------------------------------------------------------------------------
  viralHooks: [
    {
      type: "Contrarian Hook",
      name: "The Common Mistake",
      icon: "⚡",
      formula: "Stop doing [Common Practice]. Here is what top 1% [Niche Role] do instead: 👇",
      example: "Stop studying 12 hours a day for Loksewa. Here is what rank #1 toppers do instead in 4 focused hours: 👇",
      cta: "Save this post before Meta algorithm refreshes your feed! 📌"
    },
    {
      type: "Numbered Blueprint",
      name: "The Zero-BS Roadmap",
      icon: "🗺️",
      formula: "The 30-Day [Goal] Blueprint (Zero BS, Just Pure Execution): 🧵",
      example: "The 30-Day Meta Ads Mastery Blueprint (Zero Fluff, 100% Practical): 🧵",
      cta: "Which step are you currently stuck on? Drop a comment below! 💬"
    },
    {
      type: "Vulnerability & Proof",
      name: "The Transformation",
      icon: "📈",
      formula: "From [Unfavorable Past State] to [Prestigious Accomplishment] in [Timeframe]. Here are 5 hard lessons:",
      example: "From failing my first 3 technical interviews to receiving 4 senior offers. Here are 5 hard truths:",
      cta: "Share this with a friend who is currently grinding! 🚀"
    },
    {
      type: "Secret Formula",
      name: "The Hidden Framework",
      icon: "🔑",
      formula: "Most people fail at [Goal] because of this one silent killer: [X]. Here is how to fix it:",
      example: "Most people fail at Facebook organic reach because of generic stock imagery. Here is the tactile visual formula:",
      cta: "Double tap if you found this valuable! ❤️"
    }
  ],

  // ---------------------------------------------------------------------------
  // 4. 7 Nano Banana / Agency Visual Archetypes
  // ---------------------------------------------------------------------------
  creativeArchetypes: [
    {
      id: "tactile_workspace",
      name: "Tactile Physical Workspace",
      category: "Study / Productivity / Tech",
      visualDescription: "Physical clipboard with matte craft paper, vintage brass binder clips, mechanical keyboard with keycaps, warm natural morning desk lighting.",
      promptTemplate: "Award-winning editorial photograph of a minimalist mahogany desk workspace. In the center rests a heavy vintage clipboard with textured craft paper displaying clean handwritten notes: '{TITLE}'. Next to it sits a retro mechanical keyboard with warm backlight, a ceramic coffee mug, and brass binder clips. Warm morning sunlight casting soft geometric window shadows. Hasselblad 500C, 50mm f/1.8, razor-sharp focus on paper fibers, zero digital gloss, cinematic color grading.",
      bestFor: "Study routines, productivity schedules, Loksewa guides, tech setup posts."
    },
    {
      id: "classical_fusion",
      name: "Classical Sculpture Meets Modern Tech",
      category: "Thought Leadership / Strategy",
      visualDescription: "White marble Greco-Roman sculpture (The Thinker or Athena) holding a modern sleek laptop or holographic blueprint. Contrast between antiquity and AI future.",
      promptTemplate: "High-impact editorial campaign visual. A pristine white Carrara marble statue of The Thinker seated thoughtfully, resting a sleek ultramodern aluminum laptop on its lap with glowing terminal code on screen: '{TITLE}'. Dramatic chiaroscuro studio lighting, pitch-black void background, razor-sharp marble chisel textures, museum quality, 8k resolution, Behance featured award winner.",
      bestFor: "AI automation announcements, strategy frameworks, philosophical insights."
    },
    {
      id: "surreal_metaphor",
      name: "Surreal Conceptual Metaphor",
      category: "Viral Engagement / Problem-Solution",
      visualDescription: "Tangible physical object representing abstract struggle: an oversized hourglass filled with glowing circuit chips instead of sand, or a bonsai tree growing fiber optic cables.",
      promptTemplate: "Surreal conceptual photography for an elite creative agency. A massive brass antique hourglass suspended mid-air against a deep indigo backdrop. Inside the hourglass, glowing golden microchips and glowing code snippets flow seamlessly downward like fine sand, representing '{TITLE}'. Volumetric light rays, hyper-tactile glass reflections, Vogue editorial aesthetic, 8k.",
      bestFor: "Time management posts, productivity hurdles, technical transformations."
    },
    {
      id: "kinetic_blueprint",
      name: "Kinetic Exploded Blueprint",
      category: "Engineering / Architecture / Systems",
      visualDescription: "Architectural blueprint styled with cyan/indigo isometric layers, exploded 3D component view, technical callouts, and tactile drafting pencil.",
      promptTemplate: "Architectural technical breakdown visualization. An isometric exploded view blueprint rendered on crisp technical draft paper. Layered components floating in zero-gravity with crisp white technical annotations and precision grid lines labeled '{TITLE}'. A metallic mechanical drafting pencil rests at a 45-degree angle. Studio overhead softbox lighting, clean Scandinavian technical minimalism.",
      bestFor: "System architecture, API breakdown, backend pipeline explanations."
    },
    {
      id: "retro_modern",
      name: "Retro-Modern 8-Bit Fusion",
      category: "Gaming / Culture / High Energy",
      visualDescription: "Nostalgic Japanese 8-bit / 16-bit arcade pixel art fused with hyper-modern cinematic neon glow and CRT scanline reflections.",
      promptTemplate: "Nostalgic 16-bit retro arcade aesthetic merged with hyper-modern cinema. Glowing arcade cabinet screen displaying an intricate pixel-art scene with title '{TITLE}'. Soft CRT phosphor scanlines, reflections of neon cyan and magenta city lights on polished chrome arcade buttons. Cyberpunk Tokyo alleyway background, atmospheric smoke, high aesthetic vibe.",
      bestFor: "Gamified challenges, developer milestones, launch announcements."
    },
    {
      id: "macro_texture",
      name: "Macro Craftsmanship & Material Focus",
      category: "Luxury / Brand / Premium",
      visualDescription: "Extreme macro photograph focusing on luxurious materials (embossed gold foil, woven linen, brushed titanium) with typography pressed directly into the material.",
      promptTemplate: "Extreme macro product photography. Heavyweight textured dark linen paper with deep embossed gold foil typography debossed cleanly: '{TITLE}'. Razor-sharp depth of field showing exquisite fiber texture and metallic foil leafing edges. Warm directional spotlight, luxury boutique agency aesthetic, cinematic 100mm macro lens.",
      bestFor: "Milestones, premium announcements, brand values, certificates."
    },
    {
      id: "minimalist_monolith",
      name: "Minimalist Industrial Monolith",
      category: "Authority / Major Announcement",
      visualDescription: "Brutalist concrete or black obsidian monolith standing in a serene natural mist, minimal typography carved into stone.",
      promptTemplate: "Monumental minimalist photograph. A tall brutalist black matte stone monolith standing majestically in a calm foggy Scandinavian landscape. Carved cleanly into the face of the monolith in modern sans-serif typography: '{TITLE}'. Soft overcast diffused daylight, subtle misty ground fog, monumental scale, calm architectural authority.",
      bestFor: "Manifesto posts, mission statements, milestone records."
    }
  ],

  // ---------------------------------------------------------------------------
  // 5. 83 Meta Developer Documentation Catalog (Curated Quick-Search Index)
  // ---------------------------------------------------------------------------
  docCategories: [
    {
      name: "Instagram Graph API",
      count: 14,
      docs: [
        { title: "Instagram Content Publishing API", path: "documentation/instagram-graph-api/content-publishing.md", summary: "2-step publishing flow for photos, carousel albums, reels, and stories." },
        { title: "Instagram Direct Messaging API", path: "documentation/instagram-graph-api/instagram-messaging.md", summary: "24-hour messaging window, webhooks, quick replies, and icebreakers." },
        { title: "Instagram User Insights & Metrics", path: "documentation/instagram-graph-api/insights.md", summary: "Reach, impressions, profile views, follower demographics, and media metrics." },
        { title: "Instagram Comments & Moderation", path: "documentation/instagram-graph-api/comment-moderation.md", summary: "Fetch comments, reply to user comments, hide negative sentiment, and delete spam." },
        { title: "Instagram Reels Publishing & Audio", path: "documentation/instagram-graph-api/reels-publishing.md", summary: "Reels container creation, video encoding specifications, aspect ratio 9:16." },
        { title: "Instagram Story Highlights & Mentions", path: "documentation/instagram-graph-api/story-mentions.md", summary: "Webhooks for story @mentions and ephemeral media interactions." }
      ]
    },
    {
      name: "Facebook Pages API",
      count: 12,
      docs: [
        { title: "Pages Feed Publishing & Photos", path: "documentation/facebook-pages-api/page-feed-publishing.md", summary: "POST /{page-id}/feed and /{page-id}/photos with never-expiring page token." },
        { title: "Page Access Tokens & Roles", path: "documentation/facebook-pages-api/page-access-tokens.md", summary: "Never-expiring token generation, Tasks, and Page admin permissions." },
        { title: "Page Webhooks & Subscriptions", path: "documentation/facebook-pages-api/page-webhooks.md", summary: "Real-time subscriptions for feed, mentions, ratings, and messenger." },
        { title: "Page Moderation & Filter Rules", path: "documentation/facebook-pages-api/moderation.md", summary: "Auto-hide profanity, block offensive keywords, and manage community posts." }
      ]
    },
    {
      name: "Authentication & Token Management",
      count: 10,
      docs: [
        { title: "OAuth 2.0 Token Exchange Flow", path: "documentation/authentication-and-authorization/access-tokens.md", summary: "Converting short-lived tokens to 60-day long-lived tokens via fb_exchange_token." },
        { title: "Never-Expiring Page Token Secret", path: "documentation/authentication-and-authorization/page-tokens.md", summary: "Extracting indefinite page tokens using long-lived user tokens via /me/accounts." },
        { title: "Token Debugger Tool & Inspection", path: "documentation/authentication-and-authorization/token-debugger.md", summary: "GET /debug_token to inspect scopes, expiration timestamp, and user ID." },
        { title: "Permissions & Feature Access Review", path: "documentation/authentication-and-authorization/permissions-reference.md", summary: "Standard Access vs Advanced Access in Meta App Review." }
      ]
    },
    {
      name: "Messenger Platform & Bots",
      count: 8,
      docs: [
        { title: "24-Hour Messaging Policy", path: "documentation/messenger-platform/policy-overview.md", summary: "Standard 24h window, message tags, and the 7-day HUMAN_AGENT tag." },
        { title: "Send API & Message Templates", path: "documentation/messenger-platform/send-api-reference.md", summary: "Generic templates, buttons, quick replies, and receipt templates." }
      ]
    },
    {
      name: "Threads API",
      count: 6,
      docs: [
        { title: "Threads 2-Step Publishing", path: "documentation/threads-api/publishing-guide.md", summary: "POST /me/threads container creation and publishing for text & media." },
        { title: "Threads Reply Management", path: "documentation/threads-api/reply-moderation.md", summary: "Fetch replies, control reply visibility, and manage conversation threads." }
      ]
    },
    {
      name: "WhatsApp Business Platform",
      count: 9,
      docs: [
        { title: "Cloud API Quickstart & Messages", path: "documentation/whatsapp-business-platform/cloud-api-quickstart.md", summary: "Sending template messages, interactive buttons, and media via Cloud API." },
        { title: "Message Templates & Approval", path: "documentation/whatsapp-business-platform/message-templates.md", summary: "Utility, marketing, and authentication template categories." }
      ]
    },
    {
      name: "Marketing & Ads API",
      count: 10,
      docs: [
        { title: "Campaigns, AdSets & Creatives", path: "documentation/marketing-api/ad-creation.md", summary: "Programmatic campaign management, dynamic creative ads, and bidding." },
        { title: "Custom Audiences & Conversions", path: "documentation/marketing-api/custom-audiences.md", summary: "Customer list matching and Conversions API (CAPI) server events." }
      ]
    },
    {
      name: "Error Handling & Rate Limits",
      count: 8,
      docs: [
        { title: "Complete Error Code Index", path: "documentation/graph-api-core/error-handling.md", summary: "Detailed codes (#1 to #80004), retry policies, and exponential backoff." },
        { title: "Rate Limiting & x-app-usage Headers", path: "documentation/graph-api-core/rate-limits.md", summary: "App rate limits (200 calls/hr/user), Business Manager limits, Page limits." }
      ]
    },
    {
      name: "Webhooks & Real-Time Events",
      count: 6,
      docs: [
        { title: "Webhook Verification & Handshake", path: "documentation/webhooks-and-real-time-events/verification.md", summary: "hub.mode, hub.challenge, and hub.verify_token setup." },
        { title: "Payload Signature Verification", path: "documentation/webhooks-and-real-time-events/signature-verification.md", summary: "HMAC-SHA256 X-Hub-Signature validation using App Secret." }
      ]
    }
  ]
};
