from __future__ import annotations

from typing import Dict, List, Optional
import copy
import re

from pydantic import BaseModel, Field, ConfigDict


HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class ThemePalette(BaseModel):
    background: str
    surface: str
    text: str
    accent: str
    accent2: str
    border: str


class ThemeTypography(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    font_family: str = Field(alias="fontFamily")
    weights: Dict[str, int]
    scale: Dict[str, float]


class ThemeComponents(BaseModel):
    button: str
    card: str
    table: str


class ThemeSpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    palette: ThemePalette
    typography: ThemeTypography
    density: str
    components: ThemeComponents
    motion: str
    motifs: Optional[str] = None
    theme_id: Optional[str] = Field(default=None, alias="themeId")


FONT_STACKS = {
    "system": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
    "humanist": "'Segoe UI', 'Trebuchet MS', 'Verdana', sans-serif",
    "display": "'Trebuchet MS', 'Segoe UI', 'Arial Rounded MT Bold', sans-serif",
    "mono": "'JetBrains Mono', 'Cascadia Mono', 'Consolas', 'Courier New', monospace",
    "serif": "'Merriweather', 'Georgia', 'Times New Roman', serif",
}


THEME_LIBRARY: Dict[str, ThemeSpec] = {
    "aurora": ThemeSpec(
        themeId="aurora",
        palette=ThemePalette(
            background="#1e1b4b",
            surface="#312e81",
            text="#f8fafc",
            accent="#6366f1",
            accent2="#22d3ee",
            border="#4338ca",
        ),
        typography=ThemeTypography(
            fontFamily="system",
            weights={"base": 400, "strong": 700},
            scale={"sm": 0.9, "base": 1.0, "lg": 1.15, "xl": 1.3},
        ),
        density="comfortable",
        components=ThemeComponents(button="filled", card="shadowed", table="minimal"),
        motion="subtle",
        motifs=None,
    ),
    "halloween": ThemeSpec(
        themeId="halloween",
        palette=ThemePalette(
            background="#120c1b",
            surface="#22112d",
            text="#f8f5f2",
            accent="#f97316",
            accent2="#facc15",
            border="#6b21a8",
        ),
        typography=ThemeTypography(
            fontFamily="display",
            weights={"base": 500, "strong": 800},
            scale={"sm": 0.9, "base": 1.0, "lg": 1.2, "xl": 1.45},
        ),
        density="comfortable",
        components=ThemeComponents(button="filled", card="bordered", table="grid"),
        motion="active",
        motifs="pumpkin",
    ),
    "winter": ThemeSpec(
        themeId="winter",
        palette=ThemePalette(
            background="#0f172a",
            surface="#1e293b",
            text="#e2e8f0",
            accent="#38bdf8",
            accent2="#a5f3fc",
            border="#334155",
        ),
        typography=ThemeTypography(
            fontFamily="humanist",
            weights={"base": 400, "strong": 700},
            scale={"sm": 0.9, "base": 1.0, "lg": 1.12, "xl": 1.28},
        ),
        density="comfortable",
        components=ThemeComponents(button="outlined", card="shadowed", table="minimal"),
        motion="subtle",
        motifs="snow",
    ),
    "sports": ThemeSpec(
        themeId="sports",
        palette=ThemePalette(
            background="#08131d",
            surface="#132235",
            text="#f8fafc",
            accent="#22c55e",
            accent2="#38bdf8",
            border="#1d4ed8",
        ),
        typography=ThemeTypography(
            fontFamily="display",
            weights={"base": 600, "strong": 800},
            scale={"sm": 0.92, "base": 1.02, "lg": 1.2, "xl": 1.45},
        ),
        density="compact",
        components=ThemeComponents(button="filled", card="shadowed", table="grid"),
        motion="active",
        motifs=None,
    ),
    "finance": ThemeSpec(
        themeId="finance",
        palette=ThemePalette(
            background="#0b1120",
            surface="#111827",
            text="#e5e7eb",
            accent="#10b981",
            accent2="#60a5fa",
            border="#334155",
        ),
        typography=ThemeTypography(
            fontFamily="humanist",
            weights={"base": 400, "strong": 700},
            scale={"sm": 0.88, "base": 1.0, "lg": 1.08, "xl": 1.2},
        ),
        density="compact",
        components=ThemeComponents(button="outlined", card="bordered", table="grid"),
        motion="subtle",
        motifs=None,
    ),
    "retro-terminal": ThemeSpec(
        themeId="retro-terminal",
        palette=ThemePalette(
            background="#040f0f",
            surface="#0a1f1a",
            text="#d1fae5",
            accent="#34d399",
            accent2="#22c55e",
            border="#14532d",
        ),
        typography=ThemeTypography(
            fontFamily="mono",
            weights={"base": 400, "strong": 700},
            scale={"sm": 0.92, "base": 1.0, "lg": 1.1, "xl": 1.25},
        ),
        density="compact",
        components=ThemeComponents(button="flat", card="bordered", table="minimal"),
        motion="subtle",
        motifs="scanlines",
    ),
    "sci-fi": ThemeSpec(
        themeId="sci-fi",
        palette=ThemePalette(
            background="#0b1023",
            surface="#111a31",
            text="#e2e8f0",
            accent="#7c3aed",
            accent2="#38bdf8",
            border="#1e40af",
        ),
        typography=ThemeTypography(
            fontFamily="display",
            weights={"base": 500, "strong": 800},
            scale={"sm": 0.9, "base": 1.0, "lg": 1.18, "xl": 1.38},
        ),
        density="comfortable",
        components=ThemeComponents(button="filled", card="shadowed", table="minimal"),
        motion="active",
        motifs=None,
    ),
    "ocean": ThemeSpec(
        themeId="ocean",
        palette=ThemePalette(
            background="#061a1f",
            surface="#0f2a33",
            text="#e0f2fe",
            accent="#06b6d4",
            accent2="#22c55e",
            border="#0e7490",
        ),
        typography=ThemeTypography(
            fontFamily="humanist",
            weights={"base": 400, "strong": 700},
            scale={"sm": 0.9, "base": 1.0, "lg": 1.12, "xl": 1.28},
        ),
        density="comfortable",
        components=ThemeComponents(button="filled", card="shadowed", table="minimal"),
        motion="subtle",
        motifs=None,
    ),
    "festival": ThemeSpec(
        themeId="festival",
        palette=ThemePalette(
            background="#1a1025",
            surface="#2b1740",
            text="#fdf4ff",
            accent="#ec4899",
            accent2="#f59e0b",
            border="#a855f7",
        ),
        typography=ThemeTypography(
            fontFamily="display",
            weights={"base": 500, "strong": 800},
            scale={"sm": 0.92, "base": 1.02, "lg": 1.22, "xl": 1.5},
        ),
        density="comfortable",
        components=ThemeComponents(button="filled", card="shadowed", table="minimal"),
        motion="active",
        motifs="confetti",
    ),
}

DEFAULT_THEME_ID = "aurora"

VIBE_THEME_MAP = {
    "spooky": "halloween",
    "festive": "festival",
    "winter": "winter",
    "sporty": "sports",
    "corporate": "finance",
    "academic": "finance",
    "retro": "retro-terminal",
    "sci-fi": "sci-fi",
    "ocean": "ocean",
}

SENSITIVE_TOPIC_RE = re.compile(
    r"\b(politic|election|war|violence|terror|hate|racis|sexis|weapon|assault)\b",
    re.IGNORECASE,
)


def is_valid_hex_color(value: str) -> bool:
    return bool(HEX_COLOR_RE.match(value or ""))


def is_sensitive_topic(topic: str) -> bool:
    return bool(SENSITIVE_TOPIC_RE.search(topic))


def analyze_topic(topic: str) -> List[str]:
    lowered = topic.lower()
    vibes = []
    if any(word in lowered for word in ["halloween", "spooky", "ghost", "pumpkin"]):
        vibes.append("spooky")
    if any(word in lowered for word in ["christmas", "holiday", "winter", "snow", "new year"]):
        vibes.append("festive")
    if any(word in lowered for word in ["sport", "soccer", "football", "basketball", "score"]):
        vibes.append("sporty")
    if any(word in lowered for word in ["finance", "account", "tax", "ledger", "bank"]):
        vibes.append("corporate")
    if any(word in lowered for word in ["retro", "arcade", "80s", "terminal"]):
        vibes.append("retro")
    if any(word in lowered for word in ["sci-fi", "space", "robot", "ai", "cyber"]):
        vibes.append("sci-fi")
    if any(word in lowered for word in ["ocean", "sea", "reef", "coral"]):
        vibes.append("ocean")
    return vibes or ["neutral"]


def select_theme_base(vibes: List[str]) -> ThemeSpec:
    for vibe in vibes:
        theme_id = VIBE_THEME_MAP.get(vibe)
        if theme_id and theme_id in THEME_LIBRARY:
            return copy.deepcopy(THEME_LIBRARY[theme_id])
    return copy.deepcopy(THEME_LIBRARY[DEFAULT_THEME_ID])


def apply_intensity(theme: ThemeSpec, intensity: str) -> ThemeSpec:
    if intensity == "strong":
        theme.motion = "active" if theme.motion != "none" else "subtle"
        theme.components.button = "filled"
        theme.components.card = "shadowed"
    elif intensity == "subtle":
        if theme.motion == "active":
            theme.motion = "subtle"
        theme.components.button = "outlined" if theme.components.button != "flat" else "flat"
        theme.components.card = "bordered"
    return theme


def apply_deltas(theme: ThemeSpec, deltas: Dict[str, object]) -> ThemeSpec:
    if not deltas:
        return theme
    palette = deltas.get("palette") if isinstance(deltas, dict) else None
    if isinstance(palette, dict):
        for key in ["background", "surface", "text", "accent", "accent2", "border"]:
            value = palette.get(key)
            if isinstance(value, str) and is_valid_hex_color(value):
                setattr(theme.palette, key, value)

    typography = deltas.get("typography") if isinstance(deltas, dict) else None
    if isinstance(typography, dict):
        font_family = typography.get("fontFamily") or typography.get("font_family")
        if isinstance(font_family, str) and font_family in FONT_STACKS:
            theme.typography.font_family = font_family
        weights = typography.get("weights")
        if isinstance(weights, dict):
            base = weights.get("base")
            strong = weights.get("strong")
            if isinstance(base, int):
                theme.typography.weights["base"] = base
            if isinstance(strong, int):
                theme.typography.weights["strong"] = strong

    if isinstance(deltas.get("density"), str):
        theme.density = deltas["density"]

    components = deltas.get("components") if isinstance(deltas, dict) else None
    if isinstance(components, dict):
        for key in ["button", "card", "table"]:
            value = components.get(key)
            if isinstance(value, str):
                setattr(theme.components, key, value)

    if isinstance(deltas.get("motion"), str):
        theme.motion = deltas["motion"]

    if isinstance(deltas.get("motifs"), str):
        theme.motifs = deltas["motifs"]

    return theme


def _hex_to_rgb(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    return (
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
    )


def _luminance(rgb: tuple[float, float, float]) -> float:
    def channel(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(color_a: str, color_b: str) -> float:
    lum_a = _luminance(_hex_to_rgb(color_a))
    lum_b = _luminance(_hex_to_rgb(color_b))
    lighter = max(lum_a, lum_b)
    darker = min(lum_a, lum_b)
    return (lighter + 0.05) / (darker + 0.05)


def validate_theme_spec(theme: ThemeSpec) -> List[str]:
    issues: List[str] = []

    for key, value in theme.palette.model_dump().items():
        if not is_valid_hex_color(value):
            issues.append(f"palette.{key} must be a hex color")

    if theme.typography.font_family not in FONT_STACKS:
        issues.append("typography.fontFamily must be a whitelisted font key")

    base_weight = theme.typography.weights.get("base")
    strong_weight = theme.typography.weights.get("strong")
    for label, weight in [("base", base_weight), ("strong", strong_weight)]:
        if not isinstance(weight, int) or weight < 300 or weight > 900:
            issues.append(f"typography.weights.{label} must be 300-900")

    for label, value in theme.typography.scale.items():
        if not isinstance(value, (int, float)) or value < 0.75 or value > 1.8:
            issues.append(f"typography.scale.{label} must be 0.75-1.8")

    if theme.density not in ["compact", "comfortable"]:
        issues.append("density must be compact or comfortable")

    if theme.components.button not in ["flat", "outlined", "filled"]:
        issues.append("components.button must be flat/outlined/filled")
    if theme.components.card not in ["bordered", "shadowed"]:
        issues.append("components.card must be bordered/shadowed")
    if theme.components.table not in ["minimal", "grid"]:
        issues.append("components.table must be minimal/grid")

    if theme.motion not in ["none", "subtle", "active"]:
        issues.append("motion must be none/subtle/active")

    if theme.motifs not in [None, "snow", "scanlines", "confetti", "pumpkin"]:
        issues.append("motifs must be snow/scanlines/confetti/pumpkin")

    try:
        if contrast_ratio(theme.palette.text, theme.palette.background) < 4.5:
            issues.append("text contrast on background is too low")
        if contrast_ratio(theme.palette.text, theme.palette.surface) < 4.5:
            issues.append("text contrast on surface is too low")
    except Exception:
        issues.append("contrast check failed")

    return issues


def get_theme_by_id(theme_id: str) -> Optional[ThemeSpec]:
    if theme_id in THEME_LIBRARY:
        return copy.deepcopy(THEME_LIBRARY[theme_id])
    return None
