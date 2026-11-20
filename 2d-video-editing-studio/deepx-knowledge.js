// DeepX Knowledge Base for Google Flow (Veo 3.1 & Imagen 3)

export const FLOW_OPTIONS = {
  videoModels: [
    {
      id: "omni-flash-1.2",
      name: "⚡ Omni Flash 1.2 (New / 15s / Audio)",
      description: "Next-gen multimodal video generator with 15s duration and native realistic sound effects/audio generation.",
      durations: [5, 8, 10, 15],
      aspectRatios: ["16:9", "9:16", "1:1"]
    },
    {
      id: "veo-omni",
      name: "Veo Omni (Abra Multimodal / Fast)",
      description: "Interactive video generation with versatile conditioning on image references and narrative beats.",
      durations: [5, 8, 10],
      aspectRatios: ["16:9", "9:16"]
    },
    {
      id: "veo-quality",
      name: "Veo 3.1 Quality (Director-grade)",
      description: "Highest visual fidelity, photorealistic textures, complex motion dynamics, and precise physics simulation. Best for final cinematic productions.",
      durations: [5, 8],
      aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"]
    },
    {
      id: "veo-lite",
      name: "Veo 3.1 Lite (High-speed)",
      description: "Optimized for fast rendering and rapid iteration. Retains high motion coherence with substantially reduced latency.",
      durations: [5, 8],
      aspectRatios: ["16:9", "9:16", "1:1"]
    }
  ],

  imageModels: [
    {
      id: "🍌 Nano Banana 2.1",
      internalKey: "BANANA_2_1",
      name: "🍌 Nano Banana 2.1 (Ultra Real)",
      description: "Hyper-realistic flagship image generator with photorealistic skin textures, lighting, and cinematic grading.",
      outputsPerPrompt: [1, 2, 4],
      aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"]
    },
    {
      id: "🍌 Nano Banana Pro",
      internalKey: "BANANA_PRO",
      name: "🍌 Nano Banana Pro",
      description: "Professional creative studio model with high dynamic range and fine artistic styling.",
      outputsPerPrompt: [1, 2, 4],
      aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"]
    },
    {
      id: "imagen-3",
      internalKey: "NARWHAL",
      name: "Imagen 3 (Default)",
      description: "State-of-the-art text-to-image model by Google DeepMind. Incredible typography rendering, fine details, and prompt adherence.",
      outputsPerPrompt: [1, 2, 4],
      aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "2:3", "3:2"]
    }
  ],

  generationModes: [
    {
      id: "agentMode",
      name: "Google Flow Agent Mode",
      description: "Direct integration with Google Flow's native Agent Mode: allows pasting complete multi-scene storyboards in one shot (<1s) for autonomous scene clustering, continuity, and asset links.",
      inputsRequired: ["storyboardText"]
    },
    {
      id: "textToVideo",
      name: "Text to Video",
      description: "Generates video directly from a descriptive natural language prompt.",
      inputsRequired: ["prompt"]
    },
    {
      id: "imageToVideo",
      name: "Image to Video (Start Frame)",
      description: "Animates a still start image into a coherent video sequence following the prompt instructions.",
      inputsRequired: ["prompt", "startImageId or startImage file"]
    },
    {
      id: "startAndEndVideo",
      name: "Start and End Frame Interpolation (Fl)",
      description: "Generates smooth temporal transitions between two specified keyframes.",
      inputsRequired: ["prompt", "startImageId", "endImageId"]
    },
    {
      id: "referenceImagesToVideo",
      name: "Reference Images to Video",
      description: "Preserves character likeness, clothing, color palette, or object identity using uploaded asset IDs.",
      inputsRequired: ["prompt", "referenceMediaIds"]
    },
    {
      id: "textToImage",
      name: "Text to Image",
      description: "Generates high-resolution images from prompt.",
      inputsRequired: ["prompt"]
    },
    {
      id: "imageToImage",
      name: "Image to Image",
      description: "Stylizes or expands upon reference images with prompt guidance.",
      inputsRequired: ["prompt", "referenceMediaIds"]
    }
  ],

  aspectRatios: {
    "16:9": "Landscape (1920x1080) - Ideal for YouTube, cinema, desktop displays",
    "9:16": "Portrait (1080x1920) - Ideal for Shorts, Reels, TikTok, mobile feeds",
    "1:1": "Square (1080x1080) - Ideal for Instagram, square feeds, avatars",
    "4:3": "Standard / Retro television format",
    "3:4": "Vertical portrait classic",
    "2:3": "Vertical photography",
    "3:2": "Horizontal photography"
  },

  qualityResolutions: {
    "1080p": "Full HD / 1080p - Default director-grade cinematic resolution",
    "720p": "Standard HD / 720p - High speed, rapid generation and fast draft preview",
    "2k": "QHD / 2K - Enhanced high resolution export and upscale",
    "4k": "Ultra HD / 4K - Maximum fidelity upscale and master export"
  },

  promptEngineeringTips: [
    "Specify Camera Motion: 'smooth slow pan left', 'tracking drone shot', 'low-angle push in', 'handheld documentary style'.",
    "Specify Lighting & Atmosphere: 'golden hour rim lighting', 'volumetric fog with cyan neon highlights', 'soft studio illumination'.",
    "Specify Dynamic Action: Clearly describe how subjects and surroundings evolve through time (e.g., 'water splashes outwards as the character leaps').",
    "Use Character Tags: Prefix character names with @ (e.g. '@hero running through the rain') when referencing saved project characters.",
    "Orderly Naming Convention: Include #tags in prompts (e.g. 'Cinematic hero #scene_01') to automatically name downloaded media files.",
    "Concatenation (isConcat): For continuous long-form storytelling, use isConcat=true to automatically feed the ending frame of each clip as the start frame of the next."
  ]
};

export function getDeepXKnowledgeMarkdown() {
  return `# DeepX Knowledge Base: Google Flow (Veo 3.1 & Imagen 3)

## Available Video Models
- **veo-quality** (Veo 3.1 Quality): Highest fidelity, director-grade cinematic output. Supports 5s & 8s durations in 16:9 and 9:16.
- **veo-lite** (Veo 3.1 Lite): Ultra-fast rendering with high coherence. Excellent for rapid iterative scene drafting.
- **veo-omni** (Abra): Multimodal video generation supporting 5s, 8s, 10s.

## Image Generation
- **imagen-3** (NARWHAL): Ultra-high detail, rich color fidelity, text rendering, and multi-asset reference blending. Supports 1x to 4x outputs per prompt.

## Video & Image Modes
1. **textToVideo**: Text prompt -> video.
2. **imageToVideo**: Start frame -> video animation.
3. **startAndEndVideo**: Interpolates between start and end frames.
4. **referenceImagesToVideo**: Enforces character or style consistency from reference assets.
5. **textToImage**: Text prompt -> images.
6. **imageToImage**: Reference image blending -> images.

## Character Generation & Studio (@mentions)
DeepX directly automates Google Flow's native Character Studio (\`/project/<id>/character\`):
- **deepx_generate_character**: Takes \`character_name\` and \`prompt\` to generate character candidate cards in Flow's Character Studio using \`🍌 Nano Banana 2.1\` or \`Imagen 3\`, assign the official character handle (e.g. \`rohan_student\`), and save the character into the project library.
- **deepx_upload_character**: Uploads a local image file and registers it as a named character.
- **Reference in Prompts**: Once saved, reference characters using \`@character_name\` in subsequent image and video prompts (e.g. \`"@rohan_student studying at night with desk lamp"\`). DeepX automatically binds the character asset during generation.
- **Safe Mode Routing**: When generating character images or portraits, always use \`mode: "textToImage"\` and image models (\`🍌 Nano Banana 2.1\` or \`imagen-3\`). DeepX guards against accidental video generation.

## Storytelling Concatenation (isConcat)
When \`isConcat: true\` is used during \`deepx_batch_generate\`, DeepX automatically captures the exact ending frame of video \`N\` and supplies it as the \`startImageId\` for video \`N+1\`, ensuring seamless continuity across scenes.

## Google Flow Agent Mode Policy, Credit Economics & Autopilot Architecture
Google Flow Agent Mode allows users to submit complete multi-scene concepts and storyboards in a single shot. DeepX gives you 100% autonomous autopilot control over the Agent:

### 1. Credit Economics & Model Costs
- **⚡ Omni Flash 1.2 (New / 15s / Native Audio)**: **60 credits** per video generation. Delivers 15 seconds of high-fidelity multimodal video with native synchronised realistic sound effects/audio.
- **Veo 3.1 Quality (Director-grade / 5s or 8s)**: **60 credits** per video generation. Maximum photorealistic detail and fluid motion simulation.
- **Veo 3.1 Lite (High-speed / 5s or 8s)**: **10 credits** per video generation. High-speed cinematic rendering.
- **Omni Flash (Fast / 5s, 8s, 10s)**: **12 credits** per video generation. Fast iterative multimodal video.
- **🍌 Nano Banana 2.1 (Ultra Real)**: **1 to 4 credits** per prompt (1x = 1 credit, 2x = 2 credits, 4x = 4 credits). Flagship ultra-realistic image generation.
- **🍌 Nano Banana Pro**: **1 to 4 credits** per prompt. Professional creative studio image model.
- **🍌 Nano Banana 2 Lite**: **1 to 4 credits** per prompt. High-speed generation.
- **Imagen 3**: **1 to 4 credits** per prompt. High detail with rich textures and accurate typography.

### 2. Autopilot Mode & Zero-Approval Policy
By default, Google Flow Agent pauses and presents confirmation cards:
> *"Would you like me to kick off this 1 video generation, costing X credits? [Approve] [Always approve in project] [Reject]"*

DeepX eliminates these pauses with a 2-tier defense:
1. **Settings Auto-Configuration**: DeepX opens Agent settings (\`flow-agent-panel\` via \`tune\` button) and sets **"Confirm before generating: Never"**. This natively authorizes Google Flow Agent to spend credits and render media automatically.
2. **Background Autopilot Watcher**: An event-driven 400ms polling watcher scans the canvas for any stray approval cards or dialogs and immediately triggers **"Always approve in project"** or **"Approve"** via trusted Pointer/Mouse events, guaranteeing zero conversational blocking.

### 3. Media Type & Model Selection in Agent Mode
Agent Mode is not limited to a single model. DeepX allows programmatic control over:
- **Default Video Model**: Omni Flash 1.2, Omni Flash, Veo 3.1 Quality, Veo 3.1 Lite.
- **Default Image Model**: 🍌 Nano Banana 2.1, 🍌 Nano Banana Pro, 🍌 Nano Banana 2 Lite, Imagen 3.
- Configure via UI controls in the Side Panel or programmatically via \`deepx_flow_agent_configure\`.

### 4. Persistent Custom Instructions (\`article_spark\`)
Flow Agent supports persistent project guidelines:
- DeepX opens the Agent instructions modal (\`article_spark\` button -> \`.instructions-container\`).
- Injects custom directives (e.g. *"2D Documentary Realism, Chiaroscuro Lighting, Zero AI Morphing, Die-Cut Contours"*).
- Directorial rules persist across all autonomous scene generations within the session.
- Manage via UI or via \`deepx_flow_agent_set_instructions\`.

### 5. Character Consistency in Agent Mode
- **@character Tagging**: Characters saved in Flow's Character Studio are automatically referenced using \`@handle\` (e.g. \`@sam_detective\`, \`@maya\`). Flow Agent binds the corresponding reference card across scenes.
- **Terminal Frame Chaining**: For continuous video sequences, DeepX can extract in-memory HTML5 Canvas video terminal frames to anchor sequential visual continuity.

### 6. Selecting & Disconnecting Flow Agent
- **Select / Connect Agent Mode**: Click \`button.agent-mode-chip\` (\`aria-pressed="true"\`). DeepX switches the prompt box to Agent Mode and enables the autonomous dispatch engine.
- **Disconnect / Exit Agent Mode**: Click \`button.agent-mode-chip\` again (\`aria-pressed="false"\`). DeepX restores the standard single-shot prompt box, settings trigger, and manual model selectors.
- Toggle programmatically via \`deepx_flow_agent_toggle\`.

### 7. Google Flow Agent 24-Item Hard Ceiling & Smart Auto-Chunking Architecture
- **The Platform Limitation**: Google Flow Agent enforces a strict server-side ceiling:
  > *"I can only generate up to 24 items per request. Please specify a smaller count (up to 24) or let me know which specific numbers you'd like to create first."*
  Any prompt requesting e.g. "1 to 1000 images", "100 images", or a storyboard with >24 scenes is rejected by Flow Agent if sent as a single prompt.
- **DeepX 24-Item Auto-Chunking Solution**:
  1. **Pattern Detection**: DeepX automatically detects numeric ranges (e.g. \`1 to 1000\`, \`100 images from 1 to 100\`), bulk counts (e.g. \`generate 500 cars\`), or multi-scene storyboards (>24 scenes).
  2. **Mathematical Sharding**: The total count $N$ is partitioned into $\lceil N / 24 \rceil$ sequential batches of at most 24 items each:
     - Example (1000 items): 41 batches of 24 items + 1 batch of 16 items = 42 batches.
     - Example (100 items): 4 batches of 24 items + 1 batch of 4 items = 5 batches.
  3. **Sequential Back-to-Back Autopilot Queue**:
     - DeepX feeds Batch 1 (items 1–24) to Google Flow Agent.
     - The Autopilot Watcher automatically authorizes the credit confirmation card.
     - DeepX monitors Flow Agent's state (detects when the \`stop\` button clears and Flow Agent is idle).
     - DeepX automatically dispatches Batch 2 (items 25–48), then Batch 3, etc.
     - Continues seamlessly on 100% Autopilot until all 1000 items are generated!
  4. **Tools & Access**: Available via UI Side Panel, or programmatically via \`deepx_flow_agent_batch_queue\` / \`flow_agent_batch_queue\`.

### 8. Interactive Question Auto-Resolver & The 5 Pillars of Scene Consistency
- **Autonomous Question Handling**: During bulk generation or concept exploration, Google Flow Agent occasionally asks clarifying multiple-choice questions (e.g. *"What subject or topic would you like the 24 images to feature? (o) Numbers 1 to 24 ( ) Stickman Adventures ( ) Abstract Art Styles"* rendered in \`div.choice-container .option-row[role='radio']\`).
  - DeepX automatically evaluates the pending question cards.
  - Matches the options against active context keywords (e.g. topic/range).
  - Automatically clicks the matching option row via trusted MDC pointer and mouse events, or defaults to Option 0 (Flow Agent's primary intended choice).
  - Guarantees 100% Autopilot progress with zero pauses or manual clicking!
- **The 5 Pillars of Multi-Scene Consistency**:
  1. **World & Environment Anchoring**: Every generated scene locks the primary environment (e.g. tactile paper canvas \`#F8F6EF\`, consistent architectural motifs, horizon line).
  2. **Atmospheric Lighting Physics**: Unified key light direction, high-contrast chiaroscuro shadows, and identical color temperature across all sequential shots.
  3. **Protagonist & Entity Stability**: Hero characters and entities are anchored with persistent \`@handle\` tags (e.g. \`@sam_detective\`, \`@boy\`) ensuring fixed facial proportions, signature clothing, and zero AI morphing distortion.
  4. **Die-Cut Contour & Contact Shadow Law**: Visual assets receive continuous white outer die-cut borders (4-8px) and soft 2-tier ambient drop shadows, preventing flat or ungrounded sticker looks.
  5. **In-Memory Terminal Frame Chaining**: For continuous motion, previous clip terminal frames are grabbed in-memory and stacked into the prompt bar to guarantee absolute frame-to-frame continuity.

### 9. Universal Pre-Loaded Master Directives (Zero-Interruption & Anti-Drift Law)
- **Pre-Loaded for Everyone**: Google Flow Agent Mode automatically pre-loads and enforces the Master Autopilot & Consistency Directive on session start without requiring manual configuration.
- **Autopilot Mandate**: Google Flow Agent operates in 100% Autopilot Mode: no clarifying questions, no multiple-choice radio option stops, and no credit approval pauses.
- **Anti-Drift Collection Formula**: Bulk batches (e.g. numbers 1 to 1000, multi-scene storyboards) are locked into a single cohesive artistic collection with identical tactile canvas (\`#F8F6EF\`), matching architectural typography, uniform lighting angles, and zero style drift.

## Master Creative Director & Script Breakdown Protocol
When a user pastes ANY raw input (rough prompt, full story, bullet points, Hindi / multilingual script, or commercial brief):
- **deepx_analyze_and_breakdown_script**: Automatically decomposes raw text into an advanced cinematic multi-scene storyboard (#scene_01, #scene_02).
- **Universal Entity Isolation**: Detects vehicles (@tesla_roadster), animals (@golden_tiger), characters (@samurai_kaito, @rohan), and hero products (@auraring).
- **Master Reference Ingestion**: Generates master reference prompts for Imagen 3 / 🍌 Nano Banana 2.1 or uploads local assets from \`assets/\`.
- **Autonomous Production**: Feeds the resulting script to \`deepx_rapid_storyboard_autopilot\` for instant back-to-back video rendering, terminal frame grabbing, reference binding, and auto-download.
`;
}
