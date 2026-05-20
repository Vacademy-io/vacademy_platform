"""Cultural / geographic context for image routing + quality filtering.

Why this exists:
The pipeline used to generate culturally-mismatched imagery — e.g., a video
for an Indian UPSC coaching institute (Chanakya IAS Academy) shipped with
generic Pexels students who were not Indian, plus AI-regenerated logos when
the brand kit already had the real logo. Root cause: nothing in the pipeline
knew the video's target audience / setting was India-specific.

This module derives a per-run `CulturalContext` at pipeline start and is
plumbed into:
  • stock-photo query construction (inject region keyword)
  • Serper web image search (pass `gl=` for geo-biased indexing)
  • AI image generation prompts (weave demographic + setting descriptors)
  • per-shot LLM system prompt (taught to write region-aware image prompts —
    PR 2; this module only provides the data)

Derivation order (cheap signals first, LLM fallback last):
  1. Explicit `cultural_context` API param           — $0
  2. Institute profile field `default_region`        — $0
  3. Brand kit metadata `region`                     — $0
  4. Named entities → region inference (rule-based)  — $0
  5. User prompt → region inference (LLM, Flash)     — ~$0.001
  6. Default `region="none"`                         — $0

The "none" default means the video is genuinely culture-agnostic (a chemistry
explainer, a global SaaS demo). In that case the pipeline must NOT inject
region keywords — doing so would over-constrain stock search.

This module is intentionally STATELESS — `CulturalContext` is computed once
per run and stashed on the pipeline. Inference is idempotent.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# Region → ISO 3166-1 alpha-2 code for Serper `gl=` (Google geolocation bias).
# Keys are normalised lowercase; values match Google's `gl` parameter.
_REGION_TO_GL: Dict[str, str] = {
    "india": "in",
    "usa": "us",
    "united states": "us",
    "america": "us",
    "uk": "gb",
    "united kingdom": "gb",
    "britain": "gb",
    "canada": "ca",
    "australia": "au",
    "germany": "de",
    "france": "fr",
    "spain": "es",
    "italy": "it",
    "brazil": "br",
    "mexico": "mx",
    "japan": "jp",
    "china": "cn",
    "south korea": "kr",
    "korea": "kr",
    "singapore": "sg",
    "indonesia": "id",
    "philippines": "ph",
    "vietnam": "vn",
    "thailand": "th",
    "malaysia": "my",
    "pakistan": "pk",
    "bangladesh": "bd",
    "sri lanka": "lk",
    "nepal": "np",
    "uae": "ae",
    "saudi arabia": "sa",
    "egypt": "eg",
    "kenya": "ke",
    "nigeria": "ng",
    "south africa": "za",
    "russia": "ru",
    "turkey": "tr",
    "argentina": "ar",
    "chile": "cl",
    "colombia": "co",
    "netherlands": "nl",
    "sweden": "se",
    "norway": "no",
    "denmark": "dk",
    "finland": "fi",
    "poland": "pl",
    "ireland": "ie",
    "new zealand": "nz",
}


# Keyword → region rule-based fallback. Each pattern is a lowercase substring
# match against the user prompt + named-entity-name corpus. First hit wins.
# Kept ASCII-only to keep matching robust to Unicode normalisation.
#
# Conservative: only highly unambiguous tokens. We'd rather fall through to
# the LLM inferrer than mis-tag a chemistry explainer as "indian" because the
# script happened to mention "delhi metallurgy lab".
_KEYWORD_REGION_RULES: List[tuple] = [
    # (region, [keywords that strongly indicate this region])
    ("india", [
        "upsc", "ias coaching", "ias academy", "ias officer", "civil services",
        "neet", "jee main", "jee advanced", "iit ", "nit ", "iiit ",
        "sansad bhavan", "rashtrapati", "lok sabha", "rajya sabha",
        "bharat", "hindustan", "indian rupee", "rupees", "₹",
        "delhi", "mumbai", "bengaluru", "bangalore", "kolkata", "chennai",
        "hyderabad", "ahmedabad", "pune", "jaipur", "lucknow", "indore",
        "byju's", "unacademy", "physicswallah", "vedantu",
        # plain "indian" is intentionally weaker — caught by name+context not
        # standalone, to avoid mis-tagging shots that mention "Indian Ocean".
    ]),
    ("usa", [
        "sat exam", "act exam", "gre exam", "gmat exam", "lsat", "mcat",
        "usmle", "ivy league", "ucla", "stanford", "harvard", "mit ",
        "silicon valley", "wall street", "new york city", "san francisco",
        "los angeles", "chicago", "boston", "seattle",
        "white house", "capitol hill", "the pentagon",
        "dollar bill", "us dollar", "treasury department",
    ]),
    ("uk", [
        "ucas", "a-levels", "gcse", "oxbridge", "oxford university",
        "cambridge university", "london city", "edinburgh", "manchester",
        "10 downing", "house of commons", "house of lords",
        "british pound", "sterling",
    ]),
    ("japan", [
        "tokyo university", "kyoto university", "osaka university",
        "shibuya", "shinjuku", "akihabara", "ginza",
        "japanese yen", "¥",
    ]),
    ("china", [
        "tsinghua", "peking university", "gaokao",
        "beijing", "shanghai", "shenzhen", "guangzhou", "hangzhou",
        "chinese yuan", "renminbi", "rmb",
    ]),
    ("uae", ["dubai", "abu dhabi", "burj khalifa", "burj al arab"]),
    ("singapore", ["nus singapore", "ntu singapore", "marina bay sands"]),
    ("australia", ["uts sydney", "anu canberra", "melbourne university"]),
]


@dataclass
class CulturalContext:
    """Per-run cultural / geographic context derived from inputs.

    `region == "none"` is the explicit "culture-agnostic" sentinel — pipeline
    must NOT inject region keywords in that case (over-constraining stock /
    web search hurts recall).
    """
    region: str = "none"
    people_descriptors: List[str] = field(default_factory=list)
    setting_descriptors: List[str] = field(default_factory=list)
    extra_stock_keywords: List[str] = field(default_factory=list)
    gl: str = "us"   # default Google geo bias when no specific region
    hl: str = "en"
    language_hint: str = ""
    confidence: float = 0.0
    derived_from: str = "default"

    @property
    def has_region(self) -> bool:
        """True if a specific (non-default) region was inferred."""
        return self.region not in ("", "none")

    def stock_query_with_region(self, query: str) -> str:
        """Prepend the region keyword to a stock-search query when missing.

        No-op if region is `none` or if any of `extra_stock_keywords` already
        appear in the query (case-insensitive). Returns the (possibly modified)
        query string.
        """
        if not self.has_region or not self.extra_stock_keywords:
            return query
        q_lower = query.lower()
        if any(kw.lower() in q_lower for kw in self.extra_stock_keywords):
            return query
        # Prepend the FIRST descriptor (the primary one) so Pexels treats it
        # as a high-signal keyword. Trailing original query keeps the subject.
        return f"{self.extra_stock_keywords[0]} {query}".strip()

    def to_prompt_block(self) -> str:
        """Format as a `<CULTURAL_CONTEXT>` block for LLM system prompts.

        Used by PR 2 (per-shot LLM teaching) — not by this PR's runtime
        cascade. Returns empty string if region is `none`.
        """
        if not self.has_region:
            return ""
        people = ", ".join(self.people_descriptors) or self.region
        settings = ", ".join(self.setting_descriptors[:3]) if self.setting_descriptors else f"{self.region} settings"
        return (
            "<CULTURAL_CONTEXT>\n"
            f"region: {self.region}\n"
            f"people: {people} (region-appropriate features and attire)\n"
            f"settings: {settings}\n"
            f"language: {self.language_hint or 'regional'}\n"
            "When emitting `data-img-prompt`, weave the cultural descriptor in "
            "naturally (e.g. \"Indian student studying\", not just \"student "
            "studying\"). For `data-img-query` (stock), include the region "
            "keyword as the first word.\n"
            "</CULTURAL_CONTEXT>"
        )


# ── Predefined per-region descriptor packs ──────────────────────────────────
# Once `region` is known, these populate the people / setting descriptors and
# stock keywords. Single source of truth so adding a new region is one entry.
_REGION_PACKS: Dict[str, Dict[str, Any]] = {
    "india": {
        "people_descriptors": ["Indian", "south asian"],
        "setting_descriptors": [
            "Indian classroom", "Indian library", "Indian institution",
            "Delhi street", "Mumbai cityscape", "Bengaluru tech district",
        ],
        "extra_stock_keywords": ["indian", "india"],
        "language_hint": "english (indian)",
    },
    "usa": {
        "people_descriptors": ["American", "diverse"],
        "setting_descriptors": [
            "American campus", "US classroom", "New York street",
            "American library", "US workplace",
        ],
        "extra_stock_keywords": ["american", "usa"],
        "language_hint": "english (us)",
    },
    "uk": {
        "people_descriptors": ["British"],
        "setting_descriptors": [
            "British classroom", "Oxford-style college", "London street",
            "UK library", "British workplace",
        ],
        "extra_stock_keywords": ["british", "uk"],
        "language_hint": "english (uk)",
    },
    "japan": {
        "people_descriptors": ["Japanese"],
        "setting_descriptors": [
            "Japanese classroom", "Tokyo street", "Japanese library",
            "Japanese campus",
        ],
        "extra_stock_keywords": ["japanese", "japan"],
        "language_hint": "japanese",
    },
    "china": {
        "people_descriptors": ["Chinese"],
        "setting_descriptors": [
            "Chinese classroom", "Beijing street", "Chinese library",
        ],
        "extra_stock_keywords": ["chinese", "china"],
        "language_hint": "chinese (mandarin)",
    },
    "uae": {
        "people_descriptors": ["Middle Eastern", "Emirati"],
        "setting_descriptors": ["Dubai cityscape", "Abu Dhabi modern building"],
        "extra_stock_keywords": ["uae", "dubai"],
        "language_hint": "arabic",
    },
    "singapore": {
        "people_descriptors": ["Singaporean", "Southeast Asian"],
        "setting_descriptors": ["Singapore campus", "Marina Bay cityscape"],
        "extra_stock_keywords": ["singapore"],
        "language_hint": "english (singapore)",
    },
    "australia": {
        "people_descriptors": ["Australian"],
        "setting_descriptors": ["Sydney cityscape", "Melbourne campus"],
        "extra_stock_keywords": ["australian", "australia"],
        "language_hint": "english (australian)",
    },
}


def _build_from_pack(region: str, *, confidence: float, derived_from: str) -> CulturalContext:
    """Hydrate a CulturalContext from the `_REGION_PACKS` table.

    Falls back to a minimal context for regions we don't have a pack for —
    `gl` is still set from `_REGION_TO_GL` so Serper geo bias still works.
    """
    pack = _REGION_PACKS.get(region) or {}
    return CulturalContext(
        region=region,
        people_descriptors=list(pack.get("people_descriptors", [region.title()])),
        setting_descriptors=list(pack.get("setting_descriptors", [f"{region.title()} setting"])),
        extra_stock_keywords=list(pack.get("extra_stock_keywords", [region.lower()])),
        gl=_REGION_TO_GL.get(region, "us"),
        hl="en",
        language_hint=pack.get("language_hint", ""),
        confidence=confidence,
        derived_from=derived_from,
    )


# ── Inferrers ───────────────────────────────────────────────────────────────

def _rule_based_region(text: str) -> Optional[tuple]:
    """Try keyword rules against the corpus text. Returns (region, matched_kw) or None.

    Lowercased substring match. First rule that hits wins. Conservative —
    only strong signals; weak signals fall through to the LLM inferrer.
    """
    corpus = (text or "").lower()
    if not corpus:
        return None
    for region, keywords in _KEYWORD_REGION_RULES:
        for kw in keywords:
            if kw in corpus:
                return (region, kw)
    return None


_LLM_SYSTEM_PROMPT = (
    "You infer the cultural / geographic context of a short-form video so that "
    "downstream image searches retrieve region-appropriate visuals.\n\n"
    "Decide a single primary region. Use ISO-style names: 'india', 'usa', 'uk', "
    "'japan', 'china', 'uae', 'singapore', 'australia', 'canada', 'germany', "
    "'france', 'brazil', 'mexico', 'south korea', 'indonesia', 'philippines', "
    "'vietnam', 'thailand', 'malaysia', 'pakistan', 'bangladesh', 'sri lanka', "
    "'nepal', 'egypt', 'kenya', 'nigeria', 'south africa', 'russia', 'turkey'.\n\n"
    "Return `region: \"none\"` ONLY when the video is genuinely culture-"
    "agnostic — a global product, abstract concept, pure science, math. If "
    "any signal in the prompt points to a country (named place, exam name, "
    "institution, currency, language hint, audience), use it.\n\n"
    "Output strict JSON with exactly two keys: `region` (string) and "
    "`confidence` (0.0-1.0). No commentary, no markdown fences."
)


def _llm_infer_region(
    user_prompt: str,
    named_entities: Optional[List[Dict[str, Any]]],
    brand_brief: Optional[Dict[str, Any]],
    script_client: Any,
) -> Optional[tuple]:
    """LLM fallback. Returns (region, confidence) or None on failure.

    Uses the cheapest model on the script_client (typically Gemini Flash).
    Safe against API errors / malformed JSON — caller falls back to "none".
    """
    if script_client is None:
        return None

    # Compose a tight user prompt — under 1500 tokens, mostly the user's
    # original prompt + a digest of named entities + brand name.
    entities_digest = ""
    if named_entities:
        names = []
        for e in named_entities[:12]:
            if isinstance(e, dict):
                n = (e.get("name") or "").strip()
                k = (e.get("kind") or "").strip()
                if n:
                    names.append(f"{n} ({k})" if k else n)
        if names:
            entities_digest = "Named entities extracted: " + ", ".join(names) + "\n"

    brand_digest = ""
    if isinstance(brand_brief, dict):
        bn = (brand_brief.get("name") or "").strip()
        if bn:
            brand_digest = f"Brand: {bn}\n"

    excerpt = (user_prompt or "")[:1200]

    user_msg = (
        f"{brand_digest}"
        f"{entities_digest}"
        f"User prompt:\n---\n{excerpt}\n---\n\n"
        "Return JSON: {\"region\": \"<region>\", \"confidence\": <0.0-1.0>}"
    )

    try:
        raw, _usage = script_client.chat(
            messages=[
                {"role": "system", "content": _LLM_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.1,
            max_tokens=80,
        )
    except Exception as e:
        print(f"[cultural_context] LLM inferrer failed: {e}")
        return None

    text = (raw or "").strip()
    # Strip code fences if the model added them.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.MULTILINE)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract the JSON object from a noisy response.
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            print(f"[cultural_context] LLM inferrer returned non-JSON: {text[:120]}")
            return None
        try:
            data = json.loads(m.group(0))
        except Exception:
            return None

    region = str(data.get("region") or "").strip().lower()
    confidence = float(data.get("confidence", 0.0) or 0.0)
    if not region or region == "none":
        return ("none", confidence)
    # Sanity-check the region is one we know how to geo-bias for. Unknown
    # regions still work via the default gl='us' but lower the confidence.
    if region not in _REGION_TO_GL:
        print(f"[cultural_context] LLM returned unknown region '{region}'; treating as 'none'")
        return ("none", max(0.0, confidence - 0.3))
    return (region, confidence)


def infer_cultural_context(
    user_prompt: str,
    *,
    named_entities: Optional[List[Dict[str, Any]]] = None,
    brand_brief: Optional[Dict[str, Any]] = None,
    explicit_region: Optional[str] = None,
    script_client: Any = None,
) -> CulturalContext:
    """Derive the run's cultural context. Layered, cheap-first.

    Args:
        user_prompt: the original prompt that started the video.
        named_entities: output of `subject_extractor.extract_named_entities_*`.
            Used in the rule-based pass and as digest for the LLM fallback.
        brand_brief: optional brand kit metadata dict. Inspected for a
            `region` key (explicit operator override) and `name`.
        explicit_region: if the API caller passed a region directly, use it
            verbatim — skip all inference. Highest priority.
        script_client: an OpenRouterClient (or similar) used for the cheap
            Flash inference call. If None, LLM stage is skipped.

    Returns:
        A `CulturalContext`. Always returns a value — never raises.
    """
    # Layer 1 — explicit param wins outright.
    if explicit_region:
        region = explicit_region.strip().lower()
        if region in _REGION_TO_GL or region in _REGION_PACKS:
            return _build_from_pack(region, confidence=1.0, derived_from="explicit_param")
        if region == "none":
            return CulturalContext(region="none", confidence=1.0, derived_from="explicit_param")
        print(f"[cultural_context] explicit_region '{region}' unknown; falling through to inference")

    # Layer 2 — brand brief override.
    if isinstance(brand_brief, dict):
        brand_region = (brand_brief.get("region") or "").strip().lower()
        if brand_region and brand_region in _REGION_TO_GL:
            return _build_from_pack(brand_region, confidence=0.95, derived_from="brand_kit")

    # Build the corpus for rule-based + LLM passes.
    entity_text = ""
    if isinstance(named_entities, list):
        entity_text = " ".join(
            (e.get("name") or "") for e in named_entities if isinstance(e, dict)
        )
    brand_text = ""
    if isinstance(brand_brief, dict):
        brand_text = (brand_brief.get("name") or "")
    corpus = f"{user_prompt}\n{entity_text}\n{brand_text}".strip()

    # Layer 3 — rule-based pass on the corpus.
    rule_hit = _rule_based_region(corpus)
    if rule_hit is not None:
        region, matched_kw = rule_hit
        print(f"[cultural_context] rule-based region '{region}' (matched: '{matched_kw}')")
        return _build_from_pack(region, confidence=0.85, derived_from=f"rule:{matched_kw}")

    # Layer 4 — LLM inferrer (cheap).
    llm_hit = _llm_infer_region(user_prompt, named_entities, brand_brief, script_client)
    if llm_hit is not None:
        region, confidence = llm_hit
        if region != "none" and confidence >= 0.55:
            print(f"[cultural_context] LLM region '{region}' (conf={confidence:.2f})")
            return _build_from_pack(region, confidence=confidence, derived_from="llm")
        # Low-confidence LLM result is treated as "none" — over-injecting
        # region keywords on a culture-neutral video hurts more than it helps.
        if region == "none":
            print(f"[cultural_context] LLM returned 'none' (conf={confidence:.2f})")

    # Layer 5 — default: culture-agnostic.
    return CulturalContext(region="none", confidence=0.0, derived_from="default")


__all__ = ["CulturalContext", "infer_cultural_context"]
