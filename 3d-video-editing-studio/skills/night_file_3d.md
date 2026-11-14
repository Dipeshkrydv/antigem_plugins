---
name: Night File 3D Mystery
description: Direct unsolved mysteries and true crime documentaries with single-light chiaroscuro, glowing red spotlights, typewriter dates, and case files.
version: 1.0.0
---

# Night File 3D Mystery Style (True Crime & Noir)

> 🕵️ **Genre**: Unsolved mysteries, crime files, eerie historical events, and forensic retrospectives.
> ⏱️ **Default Timing**: 30–45 seconds · 9:16 vertical widescreen.

## Visual Language & Staging
- **Single-Source Chiaroscuro Lighting**: Deep moody shadows with dramatic overhead single-cone lamps or red emergency beacons.
- **Subject Isolation**: Key subjects or crime evidence highlighted with intense saturated crimson/red spot lighting.
- **Forensic Inserts**: Vintage typewriter fonts for dates/locations, classified case folders, and pinned Polaroids.
- **Atmospheric Audio**: Low drone sub-bass beds, procedural clock ticks, and heavy muffled impacts.

## Production CLI
```bash
bash skills/faceless-shorts/scripts/new_video.sh night-file ~/faceless-shorts/my-night-file
cd ~/faceless-shorts/my-night-file
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/voice.py . --voice am_michael
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/words.py .
node tools/capture.mjs sheet review/all.jpg 0.5 10
node tools/capture.mjs video renders/master.mp4 --fast
```
