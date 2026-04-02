"""
Pre-built SVG map assets for AI video generation.

Maps are organized by category (continents, countries) with metadata for
intelligent prompt injection. The LLM receives only relevant maps based on
the narration content.

To add a new map:
  1. Upload the SVG to S3 at {MAP_BASE_URL}/{code}.svg
  2. Add an entry to the appropriate category below
  3. Include search_terms that match how the map might be referenced in narration

The SVGs should have <path> elements with data-region attributes so GSAP can
animate individual regions:
  gsap.to('#us-map path[data-region="california"]', {fill:'#ef4444', duration:0.5})
"""

from __future__ import annotations
import re
from typing import Dict, List, Optional
from dataclasses import dataclass, field


# ── Configuration ──────────────────────────────────────────────────────────

MAP_BASE_URL = "https://vacademy-media.s3.ap-south-1.amazonaws.com/assets/maps"


# ── Data Model ─────────────────────────────────────────────────────────────

@dataclass
class MapAsset:
    """A single SVG map asset."""
    code: str                         # Unique identifier, used in URL: {MAP_BASE_URL}/{code}.svg
    name: str                         # Human-readable name
    category: str                     # "continent", "country", "region"
    search_terms: List[str] = field(default_factory=list)  # Keywords that trigger this map in narration
    has_regions: bool = True          # Whether the SVG has data-region attributes for animation
    recommended_style: str = "flat"   # "flat" | "topographic" | "political" — hint for the LLM

    @property
    def url(self) -> str:
        return f"{MAP_BASE_URL}/{self.code}.svg"

    # Common English words that happen to be country codes — require case-sensitive match
    _AMBIGUOUS_TERMS = frozenset({"us", "no", "in", "it", "is", "be", "my", "me", "do"})

    def matches_text(self, text: str) -> bool:
        """Check if this map is relevant to a narration text (whole-word match).

        Short ambiguous terms (e.g. 'us', 'no', 'in') require uppercase in the
        original text to match, preventing false positives from pronouns/articles.
        All other terms match case-insensitively.
        """
        text_lower = text.lower()
        for term in self.search_terms:
            pattern = r'\b' + re.escape(term) + r'\b'
            if term in self._AMBIGUOUS_TERMS:
                # Must appear as uppercase in original text (e.g. "US" or "In India")
                # Match case-sensitively against the UPPER version
                if re.search(r'\b' + re.escape(term.upper()) + r'\b', text):
                    return True
            else:
                if re.search(pattern, text_lower):
                    return True
        return False


# ── Map Registry ───────────────────────────────────────────────────────────

MAP_REGISTRY: List[MapAsset] = [

    # ── Continents & World ──
    MapAsset("world", "World Map", "continent",
             ["world", "global", "planet", "earth", "international", "worldwide"]),
    MapAsset("europe", "Europe", "continent",
             ["europe", "european", "eu", "western europe", "eastern europe"]),
    MapAsset("asia", "Asia", "continent",
             ["asia", "asian", "east asia", "south asia", "southeast asia"]),
    MapAsset("africa", "Africa", "continent",
             ["africa", "african", "sub-saharan", "north africa"]),
    MapAsset("north-america", "North America", "continent",
             ["north america", "americas"]),
    MapAsset("south-america", "South America", "continent",
             ["south america", "latin america"]),
    MapAsset("oceania", "Oceania", "continent",
             ["oceania", "australasia", "pacific islands"]),

    # ── Asia ──
    MapAsset("in", "India", "country",
             ["india", "indian", "delhi", "mumbai", "bharat", "indus"]),
    MapAsset("cn", "China", "country",
             ["china", "chinese", "beijing", "shanghai", "prc"]),
    MapAsset("jp", "Japan", "country",
             ["japan", "japanese", "tokyo"]),
    MapAsset("kr", "South Korea", "country",
             ["south korea", "korean", "seoul"]),
    MapAsset("id", "Indonesia", "country",
             ["indonesia", "indonesian", "jakarta"]),
    MapAsset("th", "Thailand", "country",
             ["thailand", "thai", "bangkok"]),
    MapAsset("vn", "Vietnam", "country",
             ["vietnam", "vietnamese", "hanoi"]),
    MapAsset("my", "Malaysia", "country",
             ["malaysia", "malaysian", "kuala lumpur"]),
    MapAsset("ph", "Philippines", "country",
             ["philippines", "filipino", "manila"]),
    MapAsset("pk", "Pakistan", "country",
             ["pakistan", "pakistani", "islamabad"]),
    MapAsset("bd", "Bangladesh", "country",
             ["bangladesh", "bangladeshi", "dhaka"]),
    MapAsset("sa", "Saudi Arabia", "country",
             ["saudi arabia", "saudi", "riyadh"]),
    MapAsset("ae", "UAE", "country",
             ["uae", "united arab emirates", "dubai", "abu dhabi"]),
    MapAsset("ir", "Iran", "country",
             ["iran", "iranian", "persia", "persian", "tehran"]),
    MapAsset("iq", "Iraq", "country",
             ["iraq", "iraqi", "baghdad", "mesopotamia"]),
    MapAsset("tr", "Turkey", "country",
             ["turkey", "turkish", "türkiye", "istanbul", "ankara", "ottoman"]),
    MapAsset("il", "Israel", "country",
             ["israel", "israeli", "jerusalem", "tel aviv"]),

    # ── Europe ──
    MapAsset("gb", "United Kingdom", "country",
             ["united kingdom", "uk", "britain", "british", "england", "london", "scotland", "wales"]),
    MapAsset("fr", "France", "country",
             ["france", "french", "paris"]),
    MapAsset("de", "Germany", "country",
             ["germany", "german", "berlin", "prussia"]),
    MapAsset("it", "Italy", "country",
             ["italy", "italian", "rome", "roman"]),
    MapAsset("es", "Spain", "country",
             ["spain", "spanish", "madrid"]),
    MapAsset("pt", "Portugal", "country",
             ["portugal", "portuguese", "lisbon"]),
    MapAsset("nl", "Netherlands", "country",
             ["netherlands", "dutch", "holland", "amsterdam"]),
    MapAsset("se", "Sweden", "country",
             ["sweden", "swedish", "stockholm"]),
    MapAsset("no", "Norway", "country",
             ["norway", "norwegian", "oslo"]),
    MapAsset("fi", "Finland", "country",
             ["finland", "finnish", "helsinki"]),
    MapAsset("dk", "Denmark", "country",
             ["denmark", "danish", "copenhagen"]),
    MapAsset("ch", "Switzerland", "country",
             ["switzerland", "swiss", "bern", "zurich"]),
    MapAsset("at", "Austria", "country",
             ["austria", "austrian", "vienna", "habsburg"]),
    MapAsset("pl", "Poland", "country",
             ["poland", "polish", "warsaw"]),
    MapAsset("gr", "Greece", "country",
             ["greece", "greek", "athens", "ancient greece", "sparta", "hellenic"]),
    MapAsset("ie", "Ireland", "country",
             ["ireland", "irish", "dublin"]),
    MapAsset("ua", "Ukraine", "country",
             ["ukraine", "ukrainian", "kyiv"]),
    MapAsset("ru", "Russia", "country",
             ["russia", "russian", "moscow", "soviet", "ussr"]),

    # ── Americas ──
    MapAsset("us", "United States", "country",
             ["united states", "usa", "us", "america", "american", "washington"]),
    MapAsset("ca", "Canada", "country",
             ["canada", "canadian", "ottawa", "toronto"]),
    MapAsset("mx", "Mexico", "country",
             ["mexico", "mexican", "aztec", "mexico city"]),
    MapAsset("br", "Brazil", "country",
             ["brazil", "brazilian", "brasilia", "rio"]),
    MapAsset("ar", "Argentina", "country",
             ["argentina", "argentine", "buenos aires"]),
    MapAsset("co", "Colombia", "country",
             ["colombia", "colombian", "bogota"]),
    MapAsset("pe", "Peru", "country",
             ["peru", "peruvian", "lima", "inca"]),
    MapAsset("cl", "Chile", "country",
             ["chile", "chilean", "santiago"]),

    # ── Africa ──
    MapAsset("eg", "Egypt", "country",
             ["egypt", "egyptian", "cairo", "nile", "pharaoh", "pyramid"]),
    MapAsset("za", "South Africa", "country",
             ["south africa", "cape town", "johannesburg"]),
    MapAsset("ng", "Nigeria", "country",
             ["nigeria", "nigerian", "lagos", "abuja"]),
    MapAsset("ke", "Kenya", "country",
             ["kenya", "kenyan", "nairobi"]),
    MapAsset("et", "Ethiopia", "country",
             ["ethiopia", "ethiopian", "addis ababa"]),
    MapAsset("tz", "Tanzania", "country",
             ["tanzania", "tanzanian", "kilimanjaro", "serengeti"]),
    MapAsset("ma", "Morocco", "country",
             ["morocco", "moroccan", "rabat", "marrakech"]),

    # ── Oceania ──
    MapAsset("au", "Australia", "country",
             ["australia", "australian", "sydney", "canberra"]),
    MapAsset("nz", "New Zealand", "country",
             ["new zealand", "kiwi", "wellington", "auckland"]),

    # ── Historical / Special ──
    MapAsset("roman-empire", "Roman Empire", "region",
             ["roman empire", "ancient rome", "roman republic", "caesar"],
             has_regions=True, recommended_style="political"),
    MapAsset("silk-road", "Silk Road", "region",
             ["silk road", "silk route", "trade route"],
             has_regions=False, recommended_style="topographic"),
    MapAsset("ancient-civilizations", "Ancient Civilizations", "region",
             ["ancient civilizations", "mesopotamia", "indus valley", "ancient egypt"],
             has_regions=True, recommended_style="political"),
]


# ── Lookup Helpers ─────────────────────────────────────────────────────────

# Flat dict for backwards compatibility: {code: name}
AVAILABLE_MAPS: Dict[str, str] = {m.code: m.name for m in MAP_REGISTRY}

# Index by code for O(1) lookup
_MAP_BY_CODE: Dict[str, MapAsset] = {m.code: m for m in MAP_REGISTRY}


def get_map(code: str) -> Optional[MapAsset]:
    """Get a map asset by its code."""
    return _MAP_BY_CODE.get(code)


def get_maps_by_category(category: str) -> List[MapAsset]:
    """Get all maps in a category ('continent', 'country', 'region')."""
    return [m for m in MAP_REGISTRY if m.category == category]


def find_relevant_maps(text: str, max_results: int = 5) -> List[MapAsset]:
    """
    Find maps relevant to a narration text.
    Returns up to max_results maps, prioritized by:
      1. Country-level matches (most specific)
      2. Continent-level matches
      3. Special/historical maps

    Used by automation_pipeline.py to inject only relevant maps into the prompt,
    avoiding prompt bloat from listing all 50+ maps.
    """
    matches: List[MapAsset] = []

    # Priority order: country > region > continent
    priority = {"country": 0, "region": 1, "continent": 2}

    for m in MAP_REGISTRY:
        # Pass ORIGINAL text — matches_text handles case logic internally
        if m.matches_text(text):
            matches.append(m)

    # Sort by priority (country first), then by name
    matches.sort(key=lambda m: (priority.get(m.category, 99), m.name))

    return matches[:max_results]


def format_maps_for_prompt(maps: List[MapAsset]) -> str:
    """
    Format a list of MapAsset objects into a prompt-friendly string.
    Used by automation_pipeline.py to inject map hints.
    """
    if not maps:
        return ""

    lines = [f"  - {m.name} (`{m.code}`): `<img src='{m.url}' class='map-svg' id='{m.code}-map' />`"
             for m in maps]

    return (
        f"\n**🗺️ SVG MAPS AVAILABLE FOR THIS SEGMENT**:\n"
        f"Pre-built SVG maps matching this narration — embed directly:\n"
        + "\n".join(lines)
        + "\n\nAnimate regions with GSAP: `gsap.to('#map-id path[data-region=\"name\"]', {fill:'#ef4444', duration:0.5})`\n"
    )
