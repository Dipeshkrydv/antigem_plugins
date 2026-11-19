"""
Creative Director Engine for Social Media & Google Flow Automation.
Transforms raw topics, study plans, and business hooks into agency-grade,
conceptually brilliant visual prompts based on the 7 Creative Archetypes.
"""
from typing import Dict, Any, Optional

CREATIVE_ARCHETYPES = {
    "tactile_clipboard": {
        "name": "📋 Real Tactile Clipboard & Stationery",
        "description": "Authentic wooden/acrylic clipboard with metal binder clip, textured paper notepad, clean numbered points, and desk props.",
        "template": (
            "A clean, ultra-professional modern agency social media graphic in vertical 4:5 format. "
            "The centerpiece is a real physical wooden clipboard with an authentic black metallic binder clip at the top, "
            "holding a crisp white textured paper notepad. The notepad is angled slightly on a warm, minimalist slate-gray or warm oak desk. "
            "On the notepad, bold editorial typography in deep crimson and charcoal black reads: '{headline}'. "
            "Numbered list with clean contrasting numbers: {body_points}. "
            "Next to the clipboard on the desk sits a vintage mechanical chrome stopwatch and a fountain pen casting soft natural contact shadows. "
            "At the bottom of the paper, an elegant red wax stamp or gold embossed seal reads '{tagline}'. "
            "Clean Swiss graphic design, generous negative space, authentic paper texture, soft directional studio lighting, "
            "zero artificial glassy neon clutter, hyper-realistic, agency-level creative direction."
        )
    },
    "classical_contrast": {
        "name": "🏛️ Classical Marble Statue + Modern Tech",
        "description": "Classical Roman/Greek Thinker marble sculpture typing on a modern MacBook with moody chiaroscuro lighting.",
        "template": (
            "An ultra-high-end, witty and sophisticated creative agency social media advertisement in vertical 4:5 portrait format. "
            "The centerpiece is a classical Roman marble bust/statue of The Thinker with hand resting on chin in deep contemplation, "
            "sitting at a sleek minimalist dark desk typing on an illuminated modern silver Apple laptop. "
            "Dramatic, moody chiaroscuro studio lighting with warm golden rim light on sculpted marble edges and dark atmospheric shadows. "
            "Above in elegant, crisp modern typography (combination of classic serif and clean minimalist sans-serif) in white and electric blue: '{headline}'. "
            "Subtitle in clean muted gray: '{tagline}'. "
            "Modern dark subtle grid lines faintly visible on the wall behind. "
            "Minimalist, intellectual, museum-meets-tech contrast, hyper-realistic, award-winning advertising agency visual."
        )
    },
    "keyboard_shortcut": {
        "name": "⌨️ Tactile Keyboard Key Metaphor",
        "description": "Real human hand holding physical mechanical keyboard keycaps (e.g. CTRL+V, CTRL+S, ESC) with an unexpected conceptual hook.",
        "template": (
            "An ultra-sleek, minimalist modern creative agency social media advertisement in vertical 4:5 portrait format. "
            "A photorealistic human hand emerges gracefully against a warm minimalist textured cream-beige background, "
            "holding two real tactile matte-black mechanical keyboard keycaps with bold crisp white engraved lettering: '{keys}'. "
            "Above the hand, sophisticated modern editorial typography in warm chocolate brown and rich rust-orange reads: '{headline}'. "
            "Subtitle or callout in crisp clean sans-serif: '{tagline}'. "
            "Below the keys, a sleek rounded pill badge reads '{badge}'. "
            "Subtle soft natural directional studio lighting, crisp macro detail on fingertips and plastic keycap texture, "
            "generous breathing space, award-winning Pinterest/Behance graphic design aesthetic."
        )
    },
    "surreal_metaphor": {
        "name": "🐢 Surreal Visual Pun & Metaphor",
        "description": "Witty juxtaposition (tortoise on skateboard, lightbulb fuel gauge, origami flight progression) that instantly stops the scroll.",
        "template": (
            "A witty, high-concept surreal creative advertising graphic in vertical 4:5 format. "
            "Centerpiece visual metaphor: {surreal_scene}. "
            "Against a clean, premium studio backdrop with soft atmospheric lighting and subtle contact shadows. "
            "Bold, authoritative headline in punchy sans-serif: '{headline}'. "
            "Complementary punchline or sub-headline: '{tagline}'. "
            "Clean agency branding, generous negative space, crisp conceptual clarity, intelligent humor."
        )
    },
    "ui_as_reality": {
        "name": "👥 Architectural UI as Reality",
        "description": "Physical humans interacting with oversized digital UI (executives sitting around an Instagram card table, sitting on a giant phone).",
        "template": (
            "A clever and surreal conceptual advertising visual in vertical 4:5 format. "
            "Overhead bird's-eye view of 4 professional business executives seated around a giant 3D physical social media post UI card, "
            "using it as their boardroom conference table. The card features crisp UI icons (like, comment, share) and clean typography. "
            "Bold headline at the top: '{headline}'. "
            "At the bottom, high-contrast slogan: '{tagline}'. "
            "Deep royal purple or midnight navy floor, clean directional studio spotlights, playful yet razor-sharp corporate visual metaphor."
        )
    },
    "editorial_color_block": {
        "name": "⚡ Bold Editorial & Color Block Slash",
        "description": "High-fashion black and white portrait with vibrant neon tape/color-slash across eyes and bold Swiss typography.",
        "template": (
            "An avant-garde high-fashion editorial poster in vertical 4:5 portrait format. "
            "A high-contrast black and white photographic portrait of a focused person, "
            "with a vibrant fluorescent neon lime-green or bright orange graphic tape/brush-slash boldly overlaid across the eyes. "
            "Bold, asymmetrical typography in stark black and white: '{headline}'. "
            "Hashtag or call-to-action pill badge: '{tagline}'. "
            "Minimalist Swiss international typographic style, sharp geometric tension, ultra-modern agency portfolio aesthetic."
        )
    },
    "pop_culture_subversion": {
        "name": "🎬 Pop-Culture & Cinema Subversion",
        "description": "Iconic cultural/cinematic moments reimagined with monochrome risograph textures and witty strategy advice.",
        "template": (
            "A witty, high-engagement cultural graphic poster in vertical 4:5 format styled as a two-tone risograph/screen-print illustration. "
            "Visual portrays an iconic dramatic cinematic confrontation or legendary teacher-student moment in intense cobalt blue and white ink. "
            "Stark, bold speech bubble or stencil typography in Hindi/English reads: '{headline}'. "
            "Sub-punchline in high-contrast highlighted box: '{tagline}'. "
            "Textured paper grain, vintage halftone dots, sharp visual humor, highly shareable viral post design."
        )
    }
}

class CreativeDirector:
    """Generates agency-grade prompts and concepts across the 7 design archetypes."""

    @classmethod
    def get_archetypes(cls) -> Dict[str, Any]:
        return {k: {"name": v["name"], "description": v["description"]} for k, v in CREATIVE_ARCHETYPES.items()}

    @classmethod
    def build_prompt(
        cls,
        archetype: str,
        headline: str,
        tagline: str,
        body_points: Optional[str] = None,
        keys: Optional[str] = "CTRL + S",
        badge: Optional[str] = "Mastery Series",
        surreal_scene: Optional[str] = "A real tortoise on a fingerboard skateboard being flicked forward by a human hand"
    ) -> str:
        arch = CREATIVE_ARCHETYPES.get(archetype, CREATIVE_ARCHETYPES["tactile_clipboard"])
        template = arch["template"]
        return template.format(
            headline=headline,
            tagline=tagline,
            body_points=body_points or "01 | Step One, 02 | Step Two, 03 | Step Three",
            keys=keys or "CTRL + S",
            badge=badge or "Mastery",
            surreal_scene=surreal_scene or "A real tortoise on a skateboard propelled by a hand"
        )

    # Alias for backwards/alternate naming
    render_prompt = build_prompt

