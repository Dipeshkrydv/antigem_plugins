---
name: Tall Tale 3D Storytime
description: Direct humorous and quirky true stories with 2D cartoon characters emoting inside warm 3D miniature towns and rapid 1-word captions. Standalone execution via studio.py.
version: 1.1.0
---

# 🎭 Tall Tale 3D Storytime Style (Humorous True Stories) v1.1.0

> 🎪 **Genre**: Bizarre historical events, quirky loopholes, funny cons, and astonishing true stories.
> ⏱️ **Default Timing**: 40–60 seconds · 9:16 vertical widescreen.
> ⚡ **Self-Contained**: Automatically pre-wires `src/main.js` and `index.html`. Zero external template prompts needed.

## Visual Language & Staging
- **Flat 2D Cutout Characters in 3D Worlds**: Bold ink-outlined expressive cartoon characters acting inside sunny, pastel 3D miniature sets.
- **Dynamic Emoting**: Shocked eyes, sweat drops, dollar-bill eyes, and rapid facial state changes timed directly to word cues.
- **Continuous Camera Glides**: Orbiting dolly moves around houses, street corners, and bank vaults.
- **Punchy Comic Sound Effects**: Slide whistles, cartoon pops, spring bounces, and retro slapstick foley.

## Production CLI
```bash
python3 studio.py new tall-tale ~/faceless-shorts/my-tall-tale
cd ~/faceless-shorts/my-tall-tale
python3 studio.py voice . --voice am_michael
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```
