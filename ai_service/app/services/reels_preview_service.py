"""
Gate 2 enrichment for reels-from-long-video (POST /preview).

For each user-picked scan candidate, this service produces:
  - title           (≤8 words, ≤60 chars)
  - rationale       (≤20 words explaining why this clip is worth rendering)
  - word_importance ([word, t_start, t_end, importance 0-3])
  - cut_plan        ([t_start, t_end, kind: silence | word | filler])
  - predicted_output_duration_s (after the cut plan is applied)

Design notes:
- Single LLM call per candidate (Haiku-class model) returns title + rationale
  + a parallel `importance` array indexed by word position. Word indices
  instead of full word objects keep the response bandwidth small.
- The LLM provides the BASE word importance; deterministic post-processing
  applies hard rules: emphasis-marked words get importance ≥ 2, topic-
  keyword matches get importance = 3.
- If the LLM key is missing or the call fails / response is malformed, a
  pure-heuristic fallback produces usable (but coarser) importance scores.
  The Phase-1 product can ship with the fallback; the LLM is quality polish.
- The cut planner is deterministic: greedy selection of lowest-importance
  words until predicted duration matches target ± tolerance. Constraints:
    * never cut importance ≥ 2
    * each merged cut span is ≥80ms (avoid sub-syllable artifacts) and ≤2s
      (longer cuts feel jumpy even with crossfade)
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Optional, Sequence

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants — mirror engagement scorer where applicable
# ---------------------------------------------------------------------------

_LLM_TIMEOUT_S = 30.0
_LLM_MODEL_ENV = "REELS_PREVIEW_LLM_MODEL"
# Haiku-class default — cheap + fast. Override per institute via env if needed.
_LLM_DEFAULT_MODEL = "anthropic/claude-3-5-haiku"

# Cut planner constraints.
MIN_CUT_SPAN_S = 0.080         # below this = sub-syllable, audible artifact risk
MAX_CUT_SPAN_S = 2.000         # longer than this feels jumpy even with crossfade
# Validation drops sub-MIN_CUT_SPAN_S spans (lossy step). The planner over-
# marks by this fraction so the validated total still hits the target.
# Empirically ~10% covers typical stutter-heavy windows; higher would risk
# cutting actually-needed words on clean transcripts.
CUT_OVERSHOOT_FRACTION = 0.15

# Heuristic filler — single-word disfluencies. Importance 0 by default in
# the fallback path.
# Notes on cuts from earlier lists:
#  - "actually", "literally", "basically", "really" are NOT filler here —
#    they can be contrarian/emphasis markers (engagement scorer treats
#    "actually" as a strong opener +25). Conflating these would have the two
#    services disagreeing about the same word.
#  - Multi-word fillers ("you know", "i mean", "kind of", "sort of") are
#    handled separately by `_count_filler_bigrams` below, since the single-
#    token `in FILLER_WORDS` test can't match them.
FILLER_WORDS = {
    "um", "uh", "uhh", "umm", "er", "erm", "hmm", "ah", "ahh", "ahem",
    "y'know",
}

# Bigram fillers — checked against (token_i, token_i+1). When matched, BOTH
# words get importance 0.
FILLER_BIGRAMS = {
    ("you", "know"),
    ("i", "mean"),
    ("kind", "of"),
    ("sort", "of"),
    ("you", "see"),
}

# Common low-content stopwords for the heuristic — importance 1 (cuttable
# but not as freely as fillers).
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "of", "to", "in",
    "on", "at", "by", "for", "with", "from", "as", "is", "are", "was",
    "were", "be", "been", "being", "am", "i", "you", "he", "she", "it",
    "we", "they", "them", "us", "me", "my", "your", "his", "her", "its",
    "our", "their", "this", "that", "these", "those", "so", "well", "just",
    "now", "very", "would", "could", "should", "do", "does", "did", "has",
    "have", "had", "yeah", "yep", "oh",
}


# ---------------------------------------------------------------------------
# Internal types
# ---------------------------------------------------------------------------

@dataclass
class _Word:
    """Word with timing + importance — internal to the planner."""
    idx: int
    text: str
    t_start: float
    t_end: float
    importance: int = 2  # default routine
    keyword_type: Optional[str] = None  # important | definition | warning
    # Optional emoji to display next to this word in captions (Phase 2c.7).
    # Populated only when the LLM emits an emoji for this slot; heuristic
    # fallback leaves it None.
    emoji: Optional[str] = None

    @property
    def duration(self) -> float:
        return max(0.0, self.t_end - self.t_start)


# Maximum emojis to surface across all captions in a single reel. Research
# §12.4: 0-3 emoji per reel is the engagement sweet spot; more becomes
# visual clutter that competes with the keyword-color highlight pattern.
MAX_EMOJIS_PER_REEL = 3
# Per-entry codepoint cap. Most caption emojis are 1-2 chars (single emoji
# or emoji + skin-tone modifier). ZWJ family sequences (5-7 chars) are
# extremely rare in caption context and indistinguishable at small font
# sizes anyway. Cap of 4 rejects "emoji walls" (8+ unrelated emojis in one
# slot, sometimes emitted when the LLM misinterprets the schema) while
# still allowing emoji+modifier pairs.
MAX_EMOJI_LEN = 4
# Reject any emoji-slot that contains an ASCII letter or digit. LLMs
# occasionally emit text labels ("money" instead of "💰") when they don't
# know an emoji — we drop those rather than render mid-sentence text.
_EMOJI_REJECT_RE = re.compile(r"[A-Za-z0-9]")


@dataclass
class _CutSpan:
    """One contiguous range to remove from the audio + video."""
    t_start: float
    t_end: float
    kind: str  # "word" | "filler" | "silence"

    @property
    def duration(self) -> float:
        return max(0.0, self.t_end - self.t_start)


@dataclass
class EnrichedPayload:
    """JSON-serializable result persisted to ai_reel_candidates.enriched."""
    title: str
    rationale: str
    word_importance: list[dict]   # [{word, t_start, t_end, importance, keyword_type}]
    cut_plan: list[dict]          # [{t_start, t_end, kind}]
    predicted_output_duration_s: float
    method: str                   # "llm" | "heuristic_fallback"

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "rationale": self.rationale,
            "word_importance": self.word_importance,
            "cut_plan": self.cut_plan,
            "predicted_output_duration_s": self.predicted_output_duration_s,
            "method": self.method,
        }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsPreviewService:
    """Single-candidate enrichment. Stateless — instantiate per /preview call."""

    def __init__(self):
        self._settings = get_settings()
        self._api_key = self._settings.openrouter_api_key
        self._llm_url = self._settings.llm_base_url
        self._model = os.getenv(_LLM_MODEL_ENV, "").strip() or _LLM_DEFAULT_MODEL

    @property
    def has_llm(self) -> bool:
        return bool(self._api_key)

    async def enrich(
        self,
        candidate_row: Any,            # AiReelCandidate
        context: dict,                 # parsed video_context.json
        target_duration_sec: int,
        duration_tolerance_sec: int,
        topic_keywords: Sequence[str] = (),
    ) -> EnrichedPayload:
        """Enrich one scan candidate. Falls back to heuristic when LLM is
        unavailable or returns malformed output. Always returns a payload."""
        # 1. Extract the window's word-level data from the transcript.
        words = _extract_window_words(
            context.get("transcript") or [],
            candidate_row.source_t_start,
            candidate_row.source_t_end,
        )
        if not words:
            # Window has no words — degenerate but real (e.g., silent stretch
            # that nonetheless scored). Return empty enrichment so the FE can
            # show "no usable content" rather than crash.
            return EnrichedPayload(
                title="(silent window)",
                rationale="No transcribed speech in this window.",
                word_importance=[],
                cut_plan=[],
                predicted_output_duration_s=float(candidate_row.predicted_output_duration_s or 0),
                method="heuristic_fallback",
            )

        # 2. LLM importance (or heuristic fallback). The LLM path also
        # returns an emoji-per-word parallel array; heuristic path has no
        # emojis (a static-keyword → emoji mapping looks robotic and was
        # rejected during Phase 2c.7 design — LLM context-awareness is
        # what makes the emoji feel intentional).
        emojis_arr: list[str] = []
        if self.has_llm:
            llm_out = await self._call_llm(words, candidate_row, topic_keywords)
            if llm_out is not None:
                title, rationale, importance_arr, emojis_arr = llm_out
                method = "llm"
            else:
                title, rationale, importance_arr = _heuristic_importance(
                    words, candidate_row, topic_keywords
                )
                method = "heuristic_fallback"
        else:
            title, rationale, importance_arr = _heuristic_importance(
                words, candidate_row, topic_keywords
            )
            method = "heuristic_fallback"

        # 3. Apply LLM-or-heuristic importance + emojis to the word list,
        #    then enforce deterministic floors from emphasis marks +
        #    topic keyword matches.
        _apply_importance(words, importance_arr)
        if emojis_arr:
            _apply_emojis(words, emojis_arr)
        _enforce_deterministic_floors(
            words,
            emphasis_marks=context.get("emphasis") or [],
            topic_keywords=topic_keywords,
            candidate_t_start=candidate_row.source_t_start,
            candidate_t_end=candidate_row.source_t_end,
        )

        # 4. Cut planner.
        predicted_after_silence_s = _get_predicted_after_silence(
            candidate_row, words
        )
        cut_plan, predicted_final = plan_cuts(
            words,
            target_duration_sec=target_duration_sec,
            duration_tolerance_sec=duration_tolerance_sec,
            predicted_after_silence_s=predicted_after_silence_s,
        )

        return EnrichedPayload(
            title=title or _fallback_title(words),
            rationale=rationale or _fallback_rationale(candidate_row),
            word_importance=[
                {
                    "word": w.text,
                    "t_start": round(w.t_start, 3),
                    "t_end": round(w.t_end, 3),
                    "importance": w.importance,
                    "keyword_type": w.keyword_type,
                    "emoji": w.emoji,
                }
                for w in words
            ],
            cut_plan=[
                {"t_start": round(c.t_start, 3), "t_end": round(c.t_end, 3), "kind": c.kind}
                for c in cut_plan
            ],
            predicted_output_duration_s=round(predicted_final, 2),
            method=method,
        )

    # ── LLM call ──────────────────────────────────────────────────────────

    async def _call_llm(
        self,
        words: list[_Word],
        candidate_row: Any,
        topic_keywords: Sequence[str],
    ) -> Optional[tuple[str, str, list[int], list[str]]]:
        """One LLM call returning (title, rationale, importance_array, emojis_array).

        `emojis_array` is parallel to `importance_array` — same length,
        with "" entries for words that don't get an emoji. Defaults to
        `[]` when the LLM omits the optional `emojis` key OR when the
        validator rejects malformed emoji entries.

        Returns None on transport error, schema validation failure, or
        importance-array length mismatch — caller falls back to heuristic.
        """
        system = _SYSTEM_PROMPT
        user = _build_user_prompt(words, candidate_row, topic_keywords)
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,  # low — we want consistent rankings
            "max_tokens": 1500,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        raw: Optional[str] = None
        try:
            async with httpx.AsyncClient(timeout=_LLM_TIMEOUT_S) as client:
                # Multi-attempt strategy:
                #  1. response_format=json_object (best quality)
                #  2. plain payload (fallback if provider rejects response_format)
                #  3. plain payload, second try (retry on transient 5xx/timeout
                #     from attempt 2 — providers sometimes hiccup briefly)
                attempts: list[dict] = [
                    {**payload, "response_format": {"type": "json_object"}},
                    payload,
                    payload,
                ]
                last_error_summary: Optional[str] = None
                for i, attempt in enumerate(attempts):
                    try:
                        resp = await client.post(self._llm_url, headers=headers, json=attempt)
                    except httpx.TimeoutException as e:
                        last_error_summary = f"timeout: {e}"
                        # Retry on next attempt — transient.
                        continue
                    except httpx.HTTPError as e:
                        # Connection-level error: try once more (next attempt).
                        last_error_summary = f"transport: {e}"
                        continue
                    if resp.status_code == 200:
                        try:
                            data = resp.json()
                            raw = data["choices"][0]["message"]["content"]
                            break
                        except Exception as e:
                            logger.warning(
                                f"[ReelsPreview] LLM unwrap failed: {e}; body={resp.text[:300]!r}"
                            )
                            return None
                    elif resp.status_code == 400 and "response_format" in resp.text:
                        # Provider rejects response_format — fall through to plain.
                        continue
                    elif 500 <= resp.status_code < 600 or resp.status_code in (408, 429):
                        # 5xx / request timeout / rate limit → retry next attempt.
                        last_error_summary = f"{resp.status_code}: {resp.text[:200]!r}"
                        continue
                    else:
                        # 4xx other than 400/408/429 — caller error; don't retry.
                        logger.warning(
                            f"[ReelsPreview] LLM {resp.status_code}: {resp.text[:300]!r}"
                        )
                        return None
                if raw is None and last_error_summary:
                    logger.warning(
                        f"[ReelsPreview] LLM gave up after {len(attempts)} attempts: {last_error_summary}"
                    )
        except Exception as e:
            logger.warning(f"[ReelsPreview] LLM unexpected error: {e}")
            return None

        if not raw:
            return None

        return _parse_llm_response(raw, expected_len=len(words))


# ---------------------------------------------------------------------------
# Cut planner
# ---------------------------------------------------------------------------

def plan_cuts(
    words: list[_Word],
    *,
    target_duration_sec: int,
    duration_tolerance_sec: int,
    predicted_after_silence_s: float,
) -> tuple[list[_CutSpan], float]:
    """Greedy cut planner. Returns (cut_plan, predicted_final_duration_s).

    Algorithm:
      1. If already within tolerance, no cuts needed.
      2. We need to remove `excess_s = predicted_after_silence_s - target` seconds.
      3. Sort cuttable words (importance ≤ 1) by (importance asc, duration desc)
         so we cut the most-filler-y and longest first (fewer total cut points
         → fewer crossfade artifacts).
      4. Mark words until `accumulated_s ≥ excess_s * (1 + overshoot)` so
         validation losses still leave us inside tolerance (P18 fix).
      5. Merge consecutive marks → spans.
      6. Validate: drop sub-80ms spans, split spans >2s into 2s chunks.
      7. If validation losses still left us short of target, iterate: mark
         more cuttable words, re-validate. Bounded retries protect against
         pathological cases.
    """
    if not words:
        return [], max(0.0, predicted_after_silence_s)

    tolerance_s = float(duration_tolerance_sec)
    target_s = float(target_duration_sec)
    excess_s = predicted_after_silence_s - target_s

    # Within tolerance OR already shorter than target — no word-cuts needed.
    if excess_s <= tolerance_s:
        return [], max(0.0, predicted_after_silence_s)

    # Cuttable list, sorted once. (importance asc, -duration) is a static
    # preference order — we'll iterate through it across retry rounds.
    cuttable_idxs = [w.idx for w in words if w.importance <= 1]
    cuttable_idxs.sort(key=lambda i: (words[i].importance, -words[i].duration))
    if not cuttable_idxs:
        return [], max(0.0, predicted_after_silence_s)

    marked: set[int] = set()
    cursor = 0  # how far we've consumed cuttable_idxs across retries

    # Budget the planner aims for. Overshoot by CUT_OVERSHOOT_FRACTION on the
    # first pass; later passes scale up if validation drops too much.
    needed_s = excess_s
    budget_s = needed_s * (1.0 + CUT_OVERSHOOT_FRACTION)

    validated: list[_CutSpan] = []
    MAX_RETRIES = 3
    for _attempt in range(MAX_RETRIES):
        # Mark more words until budget is met OR cuttable list exhausted.
        accumulated_s = sum(words[i].duration for i in marked)
        while cursor < len(cuttable_idxs) and accumulated_s < budget_s:
            idx = cuttable_idxs[cursor]
            cursor += 1
            if idx in marked:
                continue
            marked.add(idx)
            accumulated_s += words[idx].duration

        if not marked:
            return [], max(0.0, predicted_after_silence_s)

        # Merge consecutive marked words into spans.
        marked_sorted = sorted(marked)
        spans: list[_CutSpan] = []
        run_start_idx = marked_sorted[0]
        run_last_idx = run_start_idx
        for idx in marked_sorted[1:]:
            if idx == run_last_idx + 1:
                run_last_idx = idx
                continue
            spans.append(_make_span(words, run_start_idx, run_last_idx))
            run_start_idx = idx
            run_last_idx = idx
        spans.append(_make_span(words, run_start_idx, run_last_idx))

        # Validate + split too-long spans.
        validated = []
        for span in spans:
            if span.duration < MIN_CUT_SPAN_S:
                # Sub-syllable — skip to avoid audible artifact.
                continue
            if span.duration <= MAX_CUT_SPAN_S:
                validated.append(span)
                continue
            # Too long — split into MAX_CUT_SPAN_S chunks.
            cur = span.t_start
            while cur < span.t_end:
                next_end = min(cur + MAX_CUT_SPAN_S, span.t_end)
                if next_end - cur >= MIN_CUT_SPAN_S:
                    validated.append(_CutSpan(cur, next_end, span.kind))
                cur = next_end

        cuts_total_s = sum(c.duration for c in validated)
        # Are we within tolerance?
        predicted_final = max(0.0, predicted_after_silence_s - cuts_total_s)
        if predicted_final - target_s <= tolerance_s:
            return validated, predicted_final
        # Still over target — bump budget for another pass. Stop if we've
        # exhausted the cuttable list (predicted_final reflects best effort).
        if cursor >= len(cuttable_idxs):
            return validated, predicted_final
        # Bump budget by the validation-loss gap + a fresh overshoot margin.
        residual_s = (predicted_final - target_s) - tolerance_s
        budget_s += max(0.5, residual_s * (1.0 + CUT_OVERSHOOT_FRACTION))

    # Should be unreachable — MAX_RETRIES with bumping budget converges. Best
    # effort return on the off chance we're stuck.
    cuts_total_s = sum(c.duration for c in validated)
    return validated, max(0.0, predicted_after_silence_s - cuts_total_s)


def _make_span(words: list[_Word], start_idx: int, end_idx: int) -> _CutSpan:
    t_start = words[start_idx].t_start
    t_end = words[end_idx].t_end
    # Tag the span "filler" if every word in the run has importance 0;
    # otherwise "word".
    all_filler = all(words[i].importance == 0 for i in range(start_idx, end_idx + 1))
    return _CutSpan(t_start=t_start, t_end=t_end, kind="filler" if all_filler else "word")


# ---------------------------------------------------------------------------
# Heuristic fallback (used when LLM unavailable or response fails)
# ---------------------------------------------------------------------------

def _heuristic_importance(
    words: list[_Word],
    candidate_row: Any,
    topic_keywords: Sequence[str],
) -> tuple[str, str, list[int]]:
    """Returns (title, rationale, importance_array). Coarser than LLM but
    deterministic and free."""
    kw_lower = {k.lower().strip() for k in topic_keywords if k}
    tokens = [w.text.lower().strip(",.!?;:\"'()[]") for w in words]

    # Pass 1: bigram filler detection (must run before single-word so both
    # halves of the bigram land at importance 0 atomically).
    filler_idxs: set[int] = set()
    for i in range(len(tokens) - 1):
        if (tokens[i], tokens[i + 1]) in FILLER_BIGRAMS:
            filler_idxs.add(i)
            filler_idxs.add(i + 1)

    # Pass 2: single-word classification.
    importance: list[int] = []
    for i, token in enumerate(tokens):
        if i in filler_idxs or token in FILLER_WORDS:
            importance.append(0)
        elif token in kw_lower:
            importance.append(3)
        elif token in STOPWORDS or len(token) <= 2:
            importance.append(1)
        else:
            # Numeric, capitalized, or long content word → keep (importance 2).
            importance.append(2)
    title = _fallback_title(words)
    rationale = _fallback_rationale(candidate_row)
    return title, rationale, importance


def _fallback_title(words: list[_Word]) -> str:
    """First ~6 meaningful words of the window, capitalized."""
    if not words:
        return "Untitled clip"
    pieces: list[str] = []
    for w in words[:12]:
        tok = w.text.strip(",.!?;:\"'()[]")
        if not tok:
            continue
        pieces.append(tok)
        if len(pieces) >= 6:
            break
    if not pieces:
        return "Untitled clip"
    out = " ".join(pieces)
    return out[:60] + ("…" if len(out) > 60 else "")


def _fallback_rationale(candidate_row: Any) -> str:
    """Generic rationale built from the candidate's score breakdown."""
    try:
        score = candidate_row.score or {}
        comp = float(score.get("composite") or 0)
    except Exception:
        comp = 0
    if comp >= 75:
        return "High engagement score with strong hook, pacing and information density."
    if comp >= 60:
        return "Solid candidate — engagement signals are above average for this source."
    return "Lower-confidence candidate; review before rendering."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_window_words(
    transcript: list[dict],
    t_start: float,
    t_end: float,
) -> list[_Word]:
    """Pull words within [t_start, t_end] from the transcript, in order.

    Indexer's transcript stores words inside each sentence's `.words` list.
    """
    out: list[_Word] = []
    idx = 0
    for sentence in transcript:
        if sentence.get("end", 0) < t_start or sentence.get("start", 1e9) > t_end:
            continue
        for w in sentence.get("words") or []:
            ws = float(w.get("start", 0.0) or 0.0)
            we = float(w.get("end", 0.0) or 0.0)
            if we < t_start or ws > t_end:
                continue
            # Clip to window edges so cut-plan timestamps stay inside.
            ws = max(ws, t_start)
            we = min(we, t_end)
            if we <= ws:
                continue
            out.append(_Word(
                idx=idx,
                text=str(w.get("word") or ""),
                t_start=ws,
                t_end=we,
            ))
            idx += 1
    return out


def _apply_importance(words: list[_Word], importance: list[int]) -> None:
    """Write LLM-or-heuristic importance into the Word objects."""
    for w, imp in zip(words, importance):
        try:
            i = int(imp)
        except (TypeError, ValueError):
            i = 2
        w.importance = max(0, min(3, i))


def _enforce_deterministic_floors(
    words: list[_Word],
    emphasis_marks: list[dict],
    topic_keywords: Sequence[str],
    candidate_t_start: float,
    candidate_t_end: float,
) -> None:
    """Apply hard rules that don't depend on the LLM:

    - Emphasis-marked words get importance ≥ 2 (never cuttable).
    - Topic-keyword matches get importance = 3 and `keyword_type = important`.
    Both rules monotonically raise importance — they never lower an LLM score.
    """
    # Index emphasis times for fast lookup. `m.get("t") or -1.0` (not the
    # 2-arg default) so explicit None values don't trip the float comparison.
    emph_ts: list[float] = []
    for m in emphasis_marks:
        t = m.get("t")
        if t is None:
            continue
        try:
            tv = float(t)
        except (TypeError, ValueError):
            continue
        if candidate_t_start <= tv <= candidate_t_end:
            emph_ts.append(tv)
    emph_ts.sort()
    kw_lower = {k.lower().strip() for k in topic_keywords if k}

    for w in words:
        # Topic-keyword exact match → 3 + classify as keyword.
        token = w.text.lower().strip(",.!?;:\"'()[]")
        if token in kw_lower:
            w.importance = max(w.importance, 3)
            if w.keyword_type is None:
                w.keyword_type = "important"
            continue
        # Emphasis-mark coverage → at least 2.
        for et in emph_ts:
            if w.t_start <= et <= w.t_end:
                w.importance = max(w.importance, 2)
                break


def _get_predicted_after_silence(candidate_row: Any, words: list[_Word]) -> float:
    """Recover `predicted_after_silence_s` from the candidate's stored
    breakdown. If unavailable (older row), fall back to the words' span."""
    try:
        bd = candidate_row.breakdown or {}
        val = bd.get("predicted_after_silence_s")
        if val is not None:
            return float(val)
    except Exception:
        pass
    if not words:
        return 0.0
    return max(0.0, words[-1].t_end - words[0].t_start)


def _parse_llm_response(
    raw: str, expected_len: int
) -> Optional[tuple[str, str, list[int], list[str]]]:
    """Parse the LLM's JSON output. Returns None on any validation failure
    of the REQUIRED fields (title / rationale / importance) — caller falls
    back to heuristic in that case. The OPTIONAL emojis array is degraded
    silently to `[]` if absent or malformed, so a typo in the emoji slot
    doesn't lose us the whole enrichment."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"[ReelsPreview] LLM returned non-JSON: {e}; raw[:200]={raw[:200]!r}")
        return None
    if not isinstance(parsed, dict):
        logger.warning(f"[ReelsPreview] LLM returned non-object: {type(parsed)}")
        return None
    title = str(parsed.get("title") or "").strip()
    rationale = str(parsed.get("rationale") or "").strip()
    imp = parsed.get("importance")
    if not isinstance(imp, list) or len(imp) != expected_len:
        logger.warning(
            f"[ReelsPreview] LLM importance array length mismatch: "
            f"got {len(imp) if isinstance(imp, list) else type(imp)}, expected {expected_len}"
        )
        return None
    if len(title) > 80:
        title = title[:77] + "…"
    if len(rationale) > 200:
        rationale = rationale[:197] + "…"
    emojis = _validate_emojis(parsed.get("emojis"), expected_len)
    return title, rationale, imp, emojis


def _validate_emojis(raw_emojis: Any, expected_len: int) -> list[str]:
    """Filter the LLM's `emojis` array into a clean parallel list.

    Rules:
      - Wrong shape (not a list, length mismatch) → `[]` (no emojis).
        We don't reject the whole response — the optional field is
        graceful-degradation.
      - Each entry MUST be a string; non-strings → "" in that slot.
      - Strip whitespace; cap at MAX_EMOJI_LEN bytes.
      - Reject entries containing any ASCII letter / digit (LLM tried to
        emit a text label).
      - Cap total non-empty entries at MAX_EMOJIS_PER_REEL; extras beyond
        the cap become "" so the renderer doesn't carpet-bomb.
    """
    if not isinstance(raw_emojis, list) or len(raw_emojis) != expected_len:
        return []
    out: list[str] = []
    kept = 0
    for e in raw_emojis:
        if not isinstance(e, str):
            out.append("")
            continue
        s = e.strip()
        if not s:
            out.append("")
            continue
        if len(s) > MAX_EMOJI_LEN:
            out.append("")
            continue
        if _EMOJI_REJECT_RE.search(s):
            out.append("")
            continue
        if kept >= MAX_EMOJIS_PER_REEL:
            out.append("")
            continue
        out.append(s)
        kept += 1
    return out


def _apply_emojis(words: list[_Word], emojis: list[str]) -> None:
    """Set `_Word.emoji` from a parallel-index emojis array. Silently
    no-ops when lengths disagree — the caller's path should already have
    rejected mismatches via `_validate_emojis`, but we double-check."""
    if not emojis or len(emojis) != len(words):
        return
    for w, e in zip(words, emojis):
        if e:
            w.emoji = e


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are an editor scoring podcast transcript words for a short reel.

Given a transcript window and a target output duration, rate each word's importance on a 0-3 scale:
  0 = filler / disposable ("um", "uh", "like", repetitions, hedge phrases)
  1 = routine / cuttable (stopwords, low-information glue)
  2 = important (carries meaning; cutting would damage the sentence)
  3 = keyword / definition (must keep; topic-defining words)

Editorial principles:
- Preserve every claim, named entity, number, and emotional spike.
- Filler words ("um", "you know", "kind of") and verbal-pause stutters ("I, I think") are score 0.
- If a word is part of an emphasis cluster or topic keyword, it stays high — never below 2.
- Strong opening words (first 2 seconds) bias toward 2-3.
- The end of the window biases toward 2-3 (callback/payoff matters for retention).

Also produce:
- title:     a working title ≤8 words, ≤60 chars, no quotes around it.
- rationale: ≤20 words explaining why this clip is worth rendering. Mention the hook, the payoff, and one concrete content beat.

Optionally enhance engagement with emoji punctuation:
- Add an "emojis" array the same length as "importance".
- MOST entries should be "" (no emoji). Tag emoji ONLY on words where a single icon meaningfully sharpens the message — typically a stat, named entity, action verb, or vivid noun.
- 0-3 emoji per reel is the sweet spot; more becomes clutter. Pick the highest-impact words.
- Examples that work: "million" → 💰, "growth" → 📈, "fast" → ⚡, "team" → 👥, "secret" → 🔒, "warning" → ⚠️, "amazing" → 🤯, "data" → 📊, "love" → ❤️.
- Skip emoji for: stopwords, filler, abstract terms ("thing", "way", "idea"), and words that already carry their meaning clearly enough through tone and context.

Return ONLY valid JSON with this exact shape (no markdown, no commentary):
{
  "title": "...",
  "rationale": "...",
  "importance": [0, 1, 2, 3, ...],
  "emojis":     ["", "", "💰", "", "📈", "", ...]
}
The `importance` array MUST have exactly the same length as the words list given.
The `emojis` array is optional; when present it MUST have the same length as `importance`."""


_TOPIC_KEYWORD_MAX_CHARS = 64
# Strip control + delimiters that could break out of the "topic keywords"
# line in the prompt (angle brackets, backticks, newlines). We don't try to
# be paranoid — a corrupted importance array trips our parser and we fall
# back to heuristic, so worst case is "wasted LLM call." This is hygiene.
_KEYWORD_STRIP_RE = re.compile(r"[\x00-\x1f\x7f<>`\"\n\r]+")


def _sanitize_topic_keywords(keywords: Sequence[str]) -> list[str]:
    """Trim + strip dangerous characters from user-provided topic keywords
    before injecting into the LLM prompt."""
    out: list[str] = []
    for kw in keywords or ():
        if not isinstance(kw, str):
            continue
        cleaned = _KEYWORD_STRIP_RE.sub(" ", kw).strip()
        if not cleaned:
            continue
        if len(cleaned) > _TOPIC_KEYWORD_MAX_CHARS:
            cleaned = cleaned[:_TOPIC_KEYWORD_MAX_CHARS]
        out.append(cleaned)
    return out


def _build_user_prompt(
    words: list[_Word],
    candidate_row: Any,
    topic_keywords: Sequence[str],
) -> str:
    """Compact word-indexed prompt — keeps response bandwidth small."""
    duration = candidate_row.source_t_end - candidate_row.source_t_start
    parts: list[str] = []
    parts.append(
        f"Window: source seconds {candidate_row.source_t_start:.1f}–{candidate_row.source_t_end:.1f} "
        f"({duration:.1f}s total, {len(words)} words)."
    )
    safe_keywords = _sanitize_topic_keywords(topic_keywords)
    if safe_keywords:
        parts.append(f"Topic keywords (prefer to keep): {', '.join(safe_keywords)}")
    parts.append("")
    parts.append("Words (index: text):")
    for w in words:
        parts.append(f"{w.idx}: {w.text}")
    parts.append("")
    parts.append(
        f"Return JSON with title, rationale, and an importance array of "
        f"exactly {len(words)} integers (one per word, in index order)."
    )
    return "\n".join(parts)
