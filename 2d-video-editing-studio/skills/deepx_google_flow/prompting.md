# Prompt craft (from DeepX Rapid Flow)

- The user's script is the source of truth: keep names, dialogue, plot and data. Never swap common nouns for invented characters.
- Use one `@handle` per recurring entity (human, animal, vehicle, product) in every scene where it appears.
- Video scene prompt = subject + action + camera (24/35/85 mm, dolly, orbit, crane, Dutch angle) + lighting (key angle, rim, practicals) + mood + style medium. Keep it to 1–3 sentences.
- Collections (numbers, letters, posters): one shared style sentence (`style_lock`), same background, palette, typography and light, so there is no drift between parts.
- Shorts/Reels: `aspect_ratio:"9:16"`. YouTube: `16:9`. Thumbnails: `16:9` image, bold subject, big readable text.
- Hindi/multilingual scripts are fine. The analyzer detects Devanagari scene markers (`दृश्य 1`, `सीन 1`).
- Call `deepx_get_options` for the full model and limits matrix.
