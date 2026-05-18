"""
Reference Image Pre-Fetcher (Pillar 3)

Eager (NOT lazy) Serper image fetch for named entities in the user's prompt.
Today the Director / ShotPlanner sees entities as TEXT descriptions only; the
actual image URLs are fetched per-shot inside the post-Director image task
loop. That late-binding fetch fails silently when (a) the Director didn't
emit a `data-img-source="web"` slot the replacer can find, or (b) the per-
shot HTML regen rewrote the placeholder before replacement landed (root cause
of the Met-Gala run's shot-4 black frame for Beyoncé).

This module shifts the fetch UPSTREAM so:
  • The planner sees actual image URLs at shot-layout time and can pick
    shot_type intelligently (IMAGE_HERO with `data-img-source="reference"`
    instead of guessing if a `web` slot will resolve).
  • The replacer doesn't have to do object-identity lookup for these entities
    — the URL is baked into the placeholder when the per-shot HTML LLM emits
    the tag.
  • Failures are visible at the start of the run (1 LLM call's worth of
    latency before Director) instead of at the end-of-run replacement pass
    where they're harder to attribute.

Cost: ~$0.001 per Serper query × max_assets entries (default 8) = < $0.01
per run. Negligible vs the visible-defect cost of a black shot.

Behavior:
  • Hits Serper only for entities of `kind in {"person", "brand", "product",
    "event", "place"}` — abstract concepts (e.g. "fashion", "craft") are
    skipped because the top result for them is unreliable.
  • Falls back gracefully: any individual Serper failure is logged and the
    entity is dropped from the returned list. The pipeline continues with
    the entities that did resolve.
  • De-duplicates by entity name (case-insensitive). When the same name
    appears with multiple kinds, the FIRST one wins.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# Kinds we attempt to pre-fetch. Anything else gets skipped — the Serper top
# result for an abstract noun ("fashion", "craft", "speed") is typically a
# generic stock photo that doesn't match the editorial intent.
_PREFETCH_KINDS = {"person", "brand", "product", "event", "place", "organization", "logo"}

# Words that look like proper nouns but aren't useful for image search.
_BORING_NAMES = {
    "google", "youtube", "facebook", "twitter", "instagram", "tiktok",
    "internet", "world", "today", "everyone", "anyone", "people",
}


def prefetch_reference_assets(
    named_entities: Optional[List[Dict[str, Any]]],
    serper_service: Any,
    *,
    max_assets: int = 8,
    orientation: Optional[str] = None,
    cost_tracker: Any = None,
) -> List[Dict[str, Any]]:
    """For each named entity with a fetchable kind, call Serper for the top
    image hit and return enriched entries.

    Args:
        named_entities: Output of `subject_extractor.extract_named_entities_*`
            — list of {name, kind, suggested_query?}. Empty / None ⇒ no-op.
        serper_service: An instance of `SerperService`. Caller passes
            `pipeline._serper_service`. Pre-fetch is skipped silently when
            `serper_service.is_available` is False.
        max_assets: Hard cap on how many Serper calls to make this run.
            Default 8 — well below the per-run Serper budget and enough for
            most editorial prompts (named-entity videos typically have
            2-6 entities worth pre-fetching).
        orientation: "portrait" or "landscape" — forwarded to Serper for
            aspect-aware ranking. Caller passes based on `video_width <
            video_height`.
        cost_tracker: Optional `CostEventTracker` instance. When set, each
            Serper call is recorded as `kind="stock"` for the per-run
            cost balance sheet.

    Returns:
        List of `{name, kind, image_url, source, title}` dicts. Skipped /
        failed entities are NOT in the list. Order matches input order
        (with skips removed). Empty list on no input / no service /
        all failures.
    """
    if not named_entities or not isinstance(named_entities, list):
        return []
    if serper_service is None:
        return []
    if not getattr(serper_service, "is_available", False):
        return []

    seen_names: set[str] = set()
    out: List[Dict[str, Any]] = []
    attempts_remaining = max(1, int(max_assets))

    for entity in named_entities:
        if attempts_remaining <= 0:
            break
        if not isinstance(entity, dict):
            continue
        name = (entity.get("name") or "").strip()
        kind = (entity.get("kind") or "").strip().lower()
        if not name or not kind:
            continue
        # Filter — only fetch for kinds where a top image hit is reliable.
        if kind not in _PREFETCH_KINDS:
            continue
        if name.lower() in _BORING_NAMES:
            continue
        # De-dupe across entries with the same name (different kinds).
        name_key = name.lower()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        # Build the search query. Prefer the LLM's `suggested_query` because
        # it usually already includes disambiguating context ("Beyoncé 2026
        # Met Gala" rather than just "Beyoncé").
        query = (entity.get("suggested_query") or name).strip()

        attempts_remaining -= 1
        try:
            hit = serper_service.best_image(query, orientation=orientation)
        except Exception as exc:
            # Serper rate limits or transport errors fall through — the
            # pipeline still runs with lazy fetch for this entity.
            print(f"   ⚠️ Reference prefetch failed for '{name}': {exc}")
            continue

        if not hit or not hit.get("url"):
            print(f"   🔍 No reference image for '{name}' (query: {query[:60]})")
            continue

        url = (hit.get("url") or "").strip()
        if not url:
            continue

        out.append({
            "name": name,
            "kind": kind,
            "image_url": url,
            "source": hit.get("source") or "",
            "title": hit.get("title") or "",
            "suggested_query": query,
        })
        if cost_tracker is not None:
            try:
                cost_tracker.record_stock(
                    stage="reference_prefetch",
                    provider="serper",
                )
            except Exception:
                pass

        print(
            f"   🖼️  Reference prefetched: {name} ({kind}) "
            f"[{hit.get('source','?')}] → {url[:80]}"
        )

    if out:
        print(f"   📌 Pre-fetched {len(out)} reference assets (Pillar 3)")
    return out
