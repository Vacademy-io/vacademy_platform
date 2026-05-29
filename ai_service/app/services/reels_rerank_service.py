"""
A2 (Phase 3, 2026-05-22) — LLM rerank for /scan top-N.

The 4-axis heuristic composite is hand-tuned and globally ranks well, but
two candidates with identical composites can have very different "would I
actually post this?" quality. We close that gap with ONE Haiku call per
/scan that reranks the diversified top-N, then nudges the heuristic
composite up or down by a small factor.

Design:
  * Single call per /scan (not per candidate) — cost is one ~2-3k input
    tokens + ~500 output tokens.
  * Linear factor: rank-1 → 1.10×, rank-N → 0.90×. Heuristic still anchors;
    LLM nudges. Even if LLM disagrees wildly with heuristic, no candidate
    moves more than ~10 composite points.
  * Per-candidate `reason` is surfaced on the FE card before /preview is
    called (today rationale only appears post-/preview).
  * On any failure (no API key, transport error, malformed response, etc.)
    the rerank is a no-op — composites and order unchanged. Never blocks
    /scan.

Output shape: a dict mapping candidate index (position in the input list)
to `(factor: float, reason: str)`. Caller applies the factor and stashes
the reason on the candidate's breakdown.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Single attempt, low temperature. The rerank prompt is short and the
# response format is small enough that retries aren't worth the latency.
_RERANK_TIMEOUT_S = 15.0
_RERANK_TEMPERATURE = 0.1
# PB16 (2026-05-22): 30 candidates × ~12-word reason × ~5 chars × +JSON
# overhead lands around 1100-1300 tokens. 1500 gives headroom for verbose
# LLMs without inflating cost meaningfully (~$0.001 extra per scan).
_RERANK_MAX_TOKENS = 1500
# How aggressively the LLM can move candidates relative to the heuristic.
# rank-1 of N → _MAX_BOOST; rank-N → 1/_MAX_BOOST (multiplicative).
# 1.10 keeps a strong heuristic from being silently overruled.
_MAX_BOOST = 1.10

_SYSTEM_PROMPT = """You rank short-video reel candidates for a course-creator
audience. Each input has an ID, a transcript snippet, and a duration estimate.

Your job: rank them by how COMPELLING each would be as a STANDALONE 25s reel
on TikTok / Reels / YouTube Shorts. Optimize for:
  * Strong opening hook (concrete claim, number, counterintuitive framing)
  * Self-contained meaning (no "as I was saying earlier")
  * Single clear idea per clip
  * Educational hook for a course-creator audience
Down-rank: clips that start mid-sentence, depend on prior context, ramble.

Return STRICT JSON with no prose:
{
  "ranking": [
    {"id": "<input id>", "reason": "<EXACTLY 5-10 words>"},
    ...
  ]
}

Include EVERY input ID EXACTLY ONCE. Best clip FIRST. Reason must be a
real critique — "strong contrarian hook" not "good clip". Keep reasons
short so the response fits in the token budget."""


async def rerank_candidates(
    *,
    candidates: list[dict],
    api_key: Optional[str],
    base_url: str,
    model: str,
) -> dict[str, tuple[float, str]]:
    """Run a single LLM rerank pass over `candidates`. Returns a dict mapping
    `candidate["id"]` → `(factor, reason)`. Empty dict on any failure.

    Each `candidate` is `{"id": str, "snippet": str, "duration_s": float}`.
    The caller controls how the factor is applied to its composite score.
    """
    if not candidates or not api_key:
        return {}
    if len(candidates) < 2:
        # Nothing to rerank — return a no-op map with reasons left blank.
        return {}

    user = _build_user_prompt(candidates)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        "temperature": _RERANK_TEMPERATURE,
        "max_tokens": _RERANK_MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    raw: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=_RERANK_TIMEOUT_S) as client:
            try:
                resp = await client.post(base_url, headers=headers, json=payload)
            except httpx.HTTPError as e:
                logger.warning(f"[ReelsRerank] transport error: {e}")
                return {}
            if resp.status_code != 200:
                # 400 with "response_format" in body → retry plain.
                if resp.status_code == 400 and "response_format" in resp.text:
                    plain = {k: v for k, v in payload.items() if k != "response_format"}
                    try:
                        resp = await client.post(base_url, headers=headers, json=plain)
                    except httpx.HTTPError as e:
                        logger.warning(f"[ReelsRerank] retry transport: {e}")
                        return {}
                if resp.status_code != 200:
                    logger.warning(
                        f"[ReelsRerank] LLM {resp.status_code}: "
                        f"{resp.text[:200]!r}"
                    )
                    return {}
            try:
                data = resp.json()
                raw = data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.warning(f"[ReelsRerank] unwrap failed: {e}")
                return {}
    except Exception as e:
        logger.warning(f"[ReelsRerank] unexpected: {e}")
        return {}

    if not raw:
        return {}

    parsed = _parse_response(raw)
    if not parsed:
        return {}

    return _build_factor_map(parsed, valid_ids={c["id"] for c in candidates})


def _build_user_prompt(candidates: list[dict]) -> str:
    """Render the candidate list as a numbered block. Keep snippets short —
    we just need enough text for the LLM to judge the hook + content."""
    lines = ["Rank these candidates:\n"]
    for c in candidates:
        snippet = (c.get("snippet") or "").strip()
        if len(snippet) > 320:
            snippet = snippet[:317] + "..."
        dur = c.get("duration_s", 0.0)
        lines.append(
            f'  - id: "{c["id"]}"\n'
            f"    duration_s: {dur:.1f}\n"
            f'    snippet: "{snippet}"'
        )
    return "\n".join(lines)


def _parse_response(raw: str) -> Optional[list[dict]]:
    """Extract `ranking` array. Strips markdown fences if the LLM added any."""
    text = raw.strip()
    # Strip ```json fences if present.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"[ReelsRerank] JSON parse failed: {e}; raw={text[:200]!r}")
        return None
    ranking = obj.get("ranking")
    if not isinstance(ranking, list):
        logger.warning(f"[ReelsRerank] missing 'ranking' array; got {type(ranking).__name__}")
        return None
    return ranking


def _build_factor_map(
    ranking: list[dict],
    valid_ids: set[str],
) -> dict[str, tuple[float, str]]:
    """Translate LLM rank order into per-id (factor, reason) tuples.

    rank-1 → _MAX_BOOST, rank-N → 1/_MAX_BOOST, linear in between. Unknown
    IDs in the response are dropped (LLM hallucination guard).

    PB15 (2026-05-22): IDs the LLM OMITTED from its response are appended
    at the END of the ordering with identity factor 1.0 — they're treated
    as "LLM had no opinion, keep heuristic position". This prevents partial
    LLM coverage from leaving some composites unscaled while others get
    rescaled, which otherwise produced inconsistent post-sort order.
    """
    out: dict[str, tuple[float, str]] = {}
    # First pass: just collect the rank order, filtering hallucinated ids.
    ordered_ids: list[tuple[str, str]] = []
    seen: set[str] = set()
    for entry in ranking:
        if not isinstance(entry, dict):
            continue
        cand_id = entry.get("id")
        if not isinstance(cand_id, str) or cand_id not in valid_ids or cand_id in seen:
            continue
        reason = entry.get("reason")
        reason_str = reason if isinstance(reason, str) else ""
        ordered_ids.append((cand_id, reason_str[:200]))
        seen.add(cand_id)
    if not ordered_ids:
        return {}
    # PB15: append missing valid IDs so EVERY candidate gets a factor. The
    # ones the LLM ranked get the boost/floor curve; the ones it omitted
    # get an identity factor at the end (no nudge).
    missing_ids = sorted(valid_ids - seen)
    n_ranked = len(ordered_ids)
    if n_ranked + len(missing_ids) == 1:
        # Single candidate — no nudging applicable.
        out[ordered_ids[0][0]] = (1.0, ordered_ids[0][1])
        return out
    # Linear from _MAX_BOOST → 1/_MAX_BOOST across the LLM's ranked items only.
    floor = 1.0 / _MAX_BOOST
    if n_ranked > 1:
        for i, (cand_id, reason) in enumerate(ordered_ids):
            frac = i / (n_ranked - 1)
            factor = _MAX_BOOST + (floor - _MAX_BOOST) * frac
            out[cand_id] = (factor, reason)
    elif n_ranked == 1:
        # Single LLM endorsement among missing ones — give it the boost.
        out[ordered_ids[0][0]] = (_MAX_BOOST, ordered_ids[0][1])
    # Identity factor + empty reason for the LLM-omitted ones.
    for cand_id in missing_ids:
        out[cand_id] = (1.0, "")
    return out
