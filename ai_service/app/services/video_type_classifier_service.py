"""
Video Type Classifier — runs once per fresh video, alongside IntentRouter,
in the pre-script preamble. Reads the user's prompt + attachments + duration
+ orientation, returns a single structured VideoTypePlan that downstream
stages (script LLM, pacing, Director cadence, music plan) consume.

Failure mode: any error returns a safe-default plan ("explainer", education
cadence) so the rest of the pipeline behaves like it did before this stage
was added.
"""
from __future__ import annotations

import json
import logging
from typing import List, Optional

import httpx

from ..constants.models import DEFAULT_MODEL as _DEFAULT_MODEL
from ..schemas.routing import VideoTypePlan

logger = logging.getLogger(__name__)


_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_HTTP_TIMEOUT_S = 20.0

_SYSTEM_PROMPT = """You are a Video Type Classifier for an AI video generation pipeline.

Read the user's prompt + attachments + duration + orientation, and return ONE
canonical video type that should drive the rest of the pipeline (script tone,
shot pacing, Director cadence, music plan).

OUTPUT SHAPE (strict JSON, no prose, no markdown fences):
{
  "type": "<one of the 11 labels below>",
  "confidence": 0.0..1.0,
  "reason": "<short justification — 1 sentence the user can verify>",
  "cadence_hint": "reel" | "marketing" | "education" | "documentary"
}

CANONICAL TYPES (pick exactly one):

  - "explainer":         General educational concept walkthrough. The default
                         for "explain X", "what is Y", curriculum content,
                         science / history / math topics with no tutorial
                         steps and no news article.
  - "tutorial":          Step-by-step how-to. Prompt phrases: "how to", "set
                         up", "build a", "configure", numbered steps, recipe-
                         style, hands-on instructions.
  - "news_recap":        Summarize a specific article / event / current news
                         story. Trigger: prompt is (or contains) a news URL,
                         or names a specific recent event with phrases like
                         "what happened", "summarize this article",
                         "today's news on X".
  - "product_promo":     SaaS / consumer product marketing — sell a product,
                         drive sign-ups, highlight features for prospects.
                         Often short (≤ 60s) and energetic.
  - "case_study":        Business outcome storytelling — "how Company X
                         achieved Y", customer success, before/after metrics,
                         B2B testimonial-style.
  - "documentary":       Long-form factual narration — "the story of",
                         "history of", deep-dive on a topic, often ≥ 3 min,
                         narrator-led, slower pacing, archival/atmospheric
                         visuals.
  - "story":             Narrative / fictional storytelling — short fiction,
                         children's story, parable, "once upon a time",
                         scripted scenes with characters.
  - "listicle":          Top-N / countdown — "top 5", "10 things", "best of",
                         "X reasons", numbered ranking format.
  - "reel":              Short social hook — explicitly "Instagram reel",
                         "TikTok", "shorts", under 30 s, fast cuts, single
                         punchy idea or hot take. Portrait orientation
                         strengthens this signal.
  - "demo_walkthrough":  UI / app / feature demo — input videos showing the
                         product, prompt says "walk through", "demo this",
                         "cover the features in the video". Strongly
                         correlated with input_video_count > 0.
  - "pitch":             Investor / sales pitch — "pitch deck video", "pitch
                         to investors", "B2B sales overview", problem →
                         solution → traction → ask.

CADENCE HINT (separate axis from type):
  - "reel"        → 2–3.5s/shot, high cut frequency, frenetic. Use for: reel,
                    high-energy product_promo (especially portrait + ≤ 60s).
  - "marketing"   → 4–6s/shot, rhythmic, builds momentum. Use for: most
                    product_promo (landscape), case_study, listicle, pitch.
  - "education"   → 4–7s/shot, deliberate, room to breathe. Use for:
                    explainer, tutorial.
  - "documentary" → 6–10s/shot, slow, atmospheric. Use for: documentary,
                    long-form story, news_recap.

DECISION HEURISTICS (apply in order, first match wins):

  1. If `input_video_count > 0` AND prompt mentions "demo", "walk through",
     "cover the videos", "feature tour" → "demo_walkthrough" + "marketing".
  2. If prompt is a URL (or contains one) AND it looks like a news article
     (telanganatoday, nytimes, bbc, reuters, etc.) → "news_recap" +
     "documentary".
  3. If duration ≤ 30s OR prompt explicitly says "reel"/"shorts"/"tiktok"
     → "reel" + "reel".
  4. If prompt has "how to", "step by step", "tutorial", "set up", "build a"
     → "tutorial" + "education".
  5. If prompt has "top 5", "top 10", "best ", "X reasons", "ranking"
     → "listicle" + "marketing".
  6. If prompt has "pitch", "investor", "fundraise", "Series A"
     → "pitch" + "marketing".
  7. If prompt has "case study", "how X achieved Y", "customer success"
     → "case_study" + "marketing".
  8. If prompt has "promo", "launch", "introducing", "sign up", "free trial",
     "marketing video" → "product_promo" + ("reel" if portrait+≤60s else
     "marketing").
  9. If prompt has "story of", "once upon a time", "fictional", "narrative
     about" → "story" + "documentary".
  10. If prompt has "documentary", "deep dive into", "the history of" AND
      duration ≥ 3 min → "documentary" + "documentary".
  11. Otherwise → "explainer" + "education".

ALWAYS:
  - Confidence ≥ 0.8 if a heuristic matched cleanly; ≤ 0.6 if you guessed.
  - Reason must be SHORT and SPECIFIC (a phrase from the prompt the user can
    recognize, not a paraphrase of the rubric).

EXAMPLE — Prompt "https://telanganatoday.com/forest-law-enforcement..." (URL,
no input videos, 1 min, landscape):
{
  "type": "news_recap",
  "confidence": 0.9,
  "reason": "Prompt is a single news article URL with no other framing.",
  "cadence_hint": "documentary"
}

EXAMPLE — Prompt "Explain the clothing manufacturing process in 5 minutes"
(no URL, no videos, 5 min, landscape):
{
  "type": "explainer",
  "confidence": 0.9,
  "reason": "'Explain' + multi-stage process + 5-minute landscape = standard educational explainer.",
  "cadence_hint": "education"
}

EXAMPLE — Prompt "60 second reel: 5 reasons to use TanStack Router"
(portrait, 60s):
{
  "type": "listicle",
  "confidence": 0.85,
  "reason": "'5 reasons' format dominates over 'reel' framing; treat as listicle reel.",
  "cadence_hint": "reel"
}

Return ONLY the JSON object. No prose, no markdown fences.
"""


class VideoTypeClassifierService:
    """Single LLM call → structured VideoTypePlan."""

    def __init__(self, openrouter_key: str, model: str = _DEFAULT_MODEL):
        self._openrouter_key = openrouter_key
        self._model = model

    async def classify(
        self,
        prompt: str,
        *,
        input_video_count: int = 0,
        attached_file_count: int = 0,
        urls_in_prompt: Optional[List[str]] = None,
        orientation: str = "landscape",
        content_type: str = "VIDEO",
        target_duration: str = "2-3 minutes",
    ) -> VideoTypePlan:
        """Return a VideoTypePlan. On any failure: return safe defaults."""
        urls_in_prompt = urls_in_prompt or []

        # Non-VIDEO content types don't need genre classification — they have
        # their own dedicated prompts (QUIZ/STORYBOOK/etc).
        if content_type != "VIDEO":
            return VideoTypePlan(
                type="explainer",
                confidence=1.0,
                reason=f"Non-VIDEO content_type ({content_type}) — classifier skipped.",
                cadence_hint="education",
                source="default",
            )

        if not self._openrouter_key:
            logger.warning("[VideoTypeClassifier] No OpenRouter key — returning default plan")
            return _default_plan(prompt, urls_in_prompt, input_video_count, orientation, target_duration)

        user_msg = (
            f"USER PROMPT:\n{prompt}\n\n"
            f"ATTACHED RESOURCES:\n"
            f"  - input_videos: {input_video_count}\n"
            f"  - reference_files: {attached_file_count}\n"
            f"  - urls_in_prompt: {urls_in_prompt}\n"
            f"  - orientation: {orientation}\n"
            f"  - target_duration: {target_duration}\n"
        )

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.1,
            "max_tokens": 250,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {self._openrouter_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(_OPENROUTER_URL, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"[VideoTypeClassifier] LLM call failed (using defaults): {e}")
            return _default_plan(prompt, urls_in_prompt, input_video_count, orientation, target_duration)

        content_clean = content.strip()
        if content_clean.startswith("```"):
            content_clean = content_clean.strip("`")
            if content_clean.lower().startswith("json"):
                content_clean = content_clean[4:].strip()

        try:
            raw = json.loads(content_clean)
            plan = VideoTypePlan.model_validate(raw)
        except Exception as e:
            logger.warning(f"[VideoTypeClassifier] Parse failed (using defaults): {e}; raw={content[:300]!r}")
            return _default_plan(prompt, urls_in_prompt, input_video_count, orientation, target_duration)

        logger.info(
            f"[VideoTypeClassifier] {plan.type} (conf={plan.confidence:.2f}, "
            f"cadence={plan.cadence_hint}) — {plan.reason}"
        )
        return plan


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _default_plan(
    prompt: str,
    urls_in_prompt: List[str],
    input_video_count: int,
    orientation: str,
    target_duration: str,
) -> VideoTypePlan:
    """Heuristic fallback when the LLM is unavailable.

    Mirrors the top of the rubric so behavior degrades gracefully — keeps
    URL-only prompts as news_recap and input-video prompts as walkthroughs.
    """
    p = (prompt or "").lower()
    is_portrait = orientation == "portrait"
    dur = (target_duration or "").lower()
    is_short = "second" in dur or " 30 " in dur or " 60 " in dur or dur.startswith("30 ")

    if input_video_count > 0 and any(k in p for k in ("demo", "walk through", "walkthrough", "feature tour", "cover the video")):
        return VideoTypePlan(
            type="demo_walkthrough", confidence=0.7,
            reason="Default heuristic: input videos + walkthrough phrasing.",
            cadence_hint="marketing", source="default",
        )
    if urls_in_prompt and input_video_count == 0:
        return VideoTypePlan(
            type="news_recap", confidence=0.65,
            reason="Default heuristic: URL in prompt with no input videos.",
            cadence_hint="documentary", source="default",
        )
    if is_short or is_portrait or "reel" in p or "shorts" in p or "tiktok" in p:
        return VideoTypePlan(
            type="reel", confidence=0.6,
            reason="Default heuristic: short / portrait / reel keyword.",
            cadence_hint="reel", source="default",
        )
    if "how to" in p or "tutorial" in p or "step by step" in p or "step-by-step" in p:
        return VideoTypePlan(
            type="tutorial", confidence=0.65,
            reason="Default heuristic: tutorial phrasing.",
            cadence_hint="education", source="default",
        )
    return VideoTypePlan(
        type="explainer", confidence=0.5,
        reason="Default heuristic: no specific signals matched.",
        cadence_hint="education", source="default",
    )


def apply_user_override(plan: VideoTypePlan, override: Optional[str]) -> VideoTypePlan:
    """If the user explicitly picked a type via the request, that wins."""
    if not override:
        return plan
    # Derive the allow-list from VideoTypeLabel so the override validator can't
    # drift behind the schema. Adding a new label to the Literal automatically
    # extends the override path.
    from ..schemas.routing import VideoTypeLabel
    valid = set(VideoTypeLabel.__args__)  # type: ignore[attr-defined]
    if override not in valid:
        return plan
    if override != plan.type:
        plan.type = override  # type: ignore[assignment]
        plan.source = "user"
        plan.reason = f"User override → {override}."
        plan.confidence = 1.0
    return plan
