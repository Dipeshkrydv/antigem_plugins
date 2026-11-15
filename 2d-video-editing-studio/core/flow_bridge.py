# -*- coding: utf-8 -*-
"""flow_bridge.py: Google Flow Production & Asset Automation Bridge.

Automates asset formulation and generation for Google Flow (Nano Banana Pro / 2.1 & Imagen 3)
via DeepX Flow WebSocket Bridge (ws://127.0.0.1:8792/ws).
"""

import argparse, json, os, sys, urllib.request

WS_URL = os.environ.get("DEEPX_WS_URL", "ws://127.0.0.1:8792/ws")

MAGENTA_CHROMA_CLAUSE = (
    "on a solid flat pure magenta background, uniform chroma key pure magenta hex 0xFF00FF filling "
    "the entire background and showing through every gap and hole, the object itself contains "
    "no magenta anywhere, sharp crisp outlines, no drop shadow, no cast shadow, no glow, no blur, "
    "no background scenery, transparent cut-out asset ready"
)

PROMPT_TEMPLATES = {
    "vox_documentary": (
        "A detailed historical cut-out illustration of {subject}, archival museum artifact, "
        "clean vector outlines, sharp edges, Vox editorial explainer style, " + MAGENTA_CHROMA_CLAUSE
    ),
    "stickman_hybrid": (
        "Minimalist expressive stickman character {action}, bold black ink stroke lines, "
        "simple round head, emotive stick figure posture, hand-drawn sketchbook aesthetic, " + MAGENTA_CHROMA_CLAUSE
    ),
    "crayon_doodle": (
        "Warm hand-drawn crayon doodle of {subject}, textured wax pastel strokes, "
        "vibrant playful colors, childlike charming sketchbook art, " + MAGENTA_CHROMA_CLAUSE
    ),
    "suspense_thriller": (
        "Dramatic noir forensic evidence item {subject}, high-contrast chiaroscuro lighting, "
        "desaturated cinematic tones, forensic detail, " + MAGENTA_CHROMA_CLAUSE
    )
}

def generate_element_prompts(elements_tsv='ELEMENTS.tsv', style='vox_documentary', out_json='flow_prompts.json'):
    assert os.path.exists(elements_tsv), f"Missing {elements_tsv}"
    import csv
    with open(elements_tsv, encoding='utf-8') as f:
        rows = list(csv.DictReader(f, delimiter='\t'))
        
    template = PROMPT_TEMPLATES.get(style, PROMPT_TEMPLATES['vox_documentary'])
    prompts = []
    for r in rows:
        subject = r.get('prompt') or r.get('object') or r.get('name') or r.get('id')
        p_text = template.format(subject=subject, action=subject)
        prompts.append({
            'id': r['id'],
            'name': r.get('name', r.get('object', r['id'])),
            'prompt': p_text,
            'aspect_ratio': '1:1',
            'model': 'nano-banana-2'
        })
        
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)
        
    print(f"Generated {len(prompts)} Google Flow prompts in {out_json} using style '{style}'!")
    return prompts

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--elements', default='ELEMENTS.tsv')
    p.add_argument('--style', default='vox_documentary', choices=list(PROMPT_TEMPLATES.keys()))
    p.add_argument('--out', default='flow_prompts.json')
    args = p.parse_args()
    generate_element_prompts(args.elements, args.style, args.out)
