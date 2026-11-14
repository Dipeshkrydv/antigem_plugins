---
name: Tall Tale 3D Storytime
description: Direct humorous and quirky true stories with 2D cartoon characters emoting inside warm 3D miniature towns and rapid 1-word captions.
version: 1.0.0
---

# Tall Tale 3D Storytime Style (Humorous True Stories)

> 🎭 **Genre**: Bizarre historical events, quirky loopholes, funny cons, and astonishing true stories.
> ⏱️ **Default Timing**: 40–60 seconds · 9:16 vertical widescreen.

## Visual Language & Staging
- **Flat 2D Cutout Characters in 3D Worlds**: Bold ink-outlined expressive cartoon characters acting inside sunny, pastel 3D miniature sets.
- **Dynamic Emoting**: Shocked eyes, sweat drops, dollar-bill eyes, and rapid facial state changes timed directly to word cues.
- **Continuous Camera Glides**: Orbiting dolly moves around houses, street corners, and bank vaults.
- **Punchy Comic Sound Effects**: Slide whistles, cartoon pops, spring bounces, and retro slapstick foley.

## Production CLI
```bash
bash skills/faceless-shorts/scripts/new_video.sh tall-tale ~/faceless-shorts/my-tall-tale
cd ~/faceless-shorts/my-tall-tale
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/voice.py . --voice am_michael
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/words.py .
node tools/capture.mjs sheet review/all.jpg 0.5 10
node tools/capture.mjs video renders/master.mp4 --fast
```
