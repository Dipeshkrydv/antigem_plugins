---
name: Deep Dive 3D Explainer
description: Direct Zack D. Films style 3D medical, science, and bodily explainers with sunlit sets, glowing cyan x-ray anatomy, and macro camera journeys.
version: 1.0.0
---

# Deep Dive 3D Explainer Style (Zack D. Films Style)

> 🔬 **Genre**: Biology, physiology, human anatomy, medical conditions, and scientific "What happens if...?" explainers.
> ⏱️ **Default Timing**: 30–45 seconds · 9:16 vertical widescreen.

## Visual Language & Staging
- **Warm Sunlit Environments**: Natural wood floors, soft window sunlight, realistic procedural textures.
- **Glowing Cyan X-Ray Anatomy**: High-contrast illuminated internal organs, blood vessels, and bone structures.
- **Continuous Camera Travel**: Macro pans traveling through blood streams, zoom-ins past skin layers, and shallow focus (Bokeh).
- **One-Word / Rapid-Paced Captions**: Clean, bold sans-serif text placed inside mobile safe zones.

## Production CLI
```bash
bash skills/faceless-shorts/scripts/new_video.sh deep-dive ~/faceless-shorts/my-deep-dive
cd ~/faceless-shorts/my-deep-dive
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/voice.py . --voice am_michael
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/words.py .
node tools/capture.mjs sheet review/all.jpg 0.5 10
node tools/capture.mjs video renders/master.mp4 --fast
```
