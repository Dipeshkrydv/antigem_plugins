---
name: facebook-seo
description: "Algorithmic Facebook SEO, viral copy, and AI Image Model thumbnail prompt engine (v1.2.0). Enforces mandatory viral Title + 3-6 #Hashtags on every post, 1-line retention hooks, 3-4 micro-bullets, first-comment link placement, and hyper-detailed AI Image Model thumbnail generation (strictly zero Python PIL/OpenCV thumbnail rendering)."
---

# Facebook SEO, Viral Copy & AI Image Model Thumbnail Skill (v1.2.0)

## Master Editorial & Thumbnail Principles
1. **Never Forget Title & Hashtags (`title` + `hashtags`)**:
   - Every Facebook post, photo, carousel, video, and reel MUST include a punchy **Title / Headline** (`title`) and **3 to 6 targeted `#Hashtags`** (`hashtags`).
   - Never publish any post, video, or reel without a title and hashtags.
2. **The 1-Line Hook & Micro-Bite Structure**:
   - Capture mobile scrolling attention within 0.8 seconds using a bold 1-line hook, followed by 3–4 crisp 1–2 line micro-bullets separated by blank lines. Never write dense paragraphs or walls of text.
3. **Always Ask for Thumbnail on Videos & Reels**:
   - When uploading a Video or Reel without a `thumbnail_path`, always ask the user if they want to provide a thumbnail image or have you generate one.
4. **AI Image Model ONLY for Thumbnails (Strictly Zero Python)**:
   - When the user asks you to generate the thumbnail yourself, **NEVER use Python (`PIL`, `Pillow`, `OpenCV`, `matplotlib`, `ThumbnailEngine`, or `FreeMediaEngine`)** to draw or create thumbnails!
   - **ONLY use the AI Image Model** (`image-generator` subagent, Google Flow Nano Banana Pro `flow_generate_image` / `deepx_generate_image`, or `meigen` `generate_image`) using the detailed prompt from `fb_thumbnail_prompt(topic=..., title_hook=..., subtitle=..., archetype=..., aspect_ratio=...)`:
     - **Visual Hierarchy**: Giant dominant 3D headline (`title_hook`) with a horizontal electric-gold-to-crimson gradient fill + smaller secondary `subtitle` inside a translucent dark glass card container with a glowing neon border.
     - **Dramatic Lighting**: Radial warm-gold spotlight pool behind the focal subject, razor-sharp cyan/amber rim lighting, 8K surface micro-textures, and cinematic vignette shading.
5. **Outbound Link Reach Protection**:
   - Never place outbound links directly in the main caption body (avoids Facebook's 50% external-link reach penalty). Always place links in the **first comment** (`first_comment`).
