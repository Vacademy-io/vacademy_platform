"""
Assist mode — decision-gate framework.

Assist mode turns the autonomous video pipeline into a conversational, human-in-
the-loop flow. At each enabled "decision gate" the pipeline pauses, surfaces its
draft / candidate options to the user, and waits for the user to choose, edit,
approve, or steer with free-form text before continuing — exactly like modern
agentic tools (Cursor et al.).

This module is the **pure** core of that framework: the gate taxonomy, the
``DecisionRequired`` sentinel that unwinds a generation "leg", payload builders,
and pure transforms that apply a recorded answer to an artifact. All I/O
(persisting the pending decision to the DB, writing the per-gate S3 sidecars,
launching the resume leg) lives in the service / router layers so this module
stays trivially testable.

Mechanism (generalises the existing "review mode"):

  1. The pipeline reaches a gate. If assist is on, the gate is enabled, and no
     answer is recorded yet → build a ``decision_required`` payload, emit it over
     SSE, persist it, and **stop the leg cleanly** (no failure, no refund). This
     is modelled as raising ``DecisionRequired`` which the service catches.
  2. The user answers via ``POST /external/video/v1/{video_id}/decision``. The
     router records the answer into ``extra_metadata.assist.answered_decisions``,
     writes the per-gate sidecar artifact (the ``script.txt``-overwrite trick,
     generalised), and re-enters the pipeline.
  3. On re-entry the gate finds the recorded answer and applies it (or, for
     ``mode="auto"``, falls through to the original autonomous logic).

Because every leg persists to the ``ai_gen_video`` row + S3, the flow is
restart-safe: a pod restart loses nothing and the eventual answer hits a fresh
pod. See ``docs/ai_content`` plan for the full design.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Gate taxonomy
# ---------------------------------------------------------------------------


class GateType(str, Enum):
    """Every place the pipeline makes a creative judgment call worth surfacing.

    Phase 0/1 gates sit at clean stage boundaries (SCRIPT) or already compute
    their candidates. Phase 2 gates (voice/music/avatar) need preview
    pre-generation and land later. The framework is the same for all of them.
    """

    CREATIVE_CONCEPT = "creative_concept"   # controlling idea / tone / visual metaphor
    SHOT_PLAN = "shot_plan"                  # shot list: types, order, durations, treatments
    NARRATION = "narration"                  # per-shot narration text (subsumes script review)
    VISUAL_CASTING = "visual_casting"        # stock image/video / AI-image pick per media shot
    SHOT_LOOK = "shot_look"                  # best-of-N HTML look pick for hero/hook/CTA shots
    CONTACT_SHEET = "contact_sheet"          # per-shot frame review AFTER HTML, before finalize
    ASSET_REQUEST = "asset_request"          # agent-initiated asks: real screenshots/photos/data
    CAST = "cast"                            # approve character portraits BEFORE filming clips
    STYLEFRAME = "styleframe"                # approve the run's design identity + styleframe
    VOICE = "voice"                          # TTS voice (needs preview audio)   [phase 2]
    MUSIC = "music"                          # background music track (needs previews) [phase 2]
    AVATAR = "avatar"                        # host/avatar pick (needs previews) [phase 2]


# Gates enabled by default when assist mode is on but the caller didn't specify
# an explicit subset. The preview-generation gates are intentionally excluded
# from the default set until phase 2 ships their candidate generation.
DEFAULT_ASSIST_GATES: List[str] = [
    GateType.CREATIVE_CONCEPT.value,
    GateType.SHOT_PLAN.value,
    GateType.STYLEFRAME.value,
    GateType.ASSET_REQUEST.value,
    GateType.NARRATION.value,
    GateType.CAST.value,
    GateType.VISUAL_CASTING.value,
    GateType.SHOT_LOOK.value,
    GateType.CONTACT_SHEET.value,
]

# Gates that resolve at the end of the SCRIPT stage (the pipeline naturally stops
# there today for review mode). These are the lowest-risk gates to ship first —
# they reuse the existing ``stop_at`` boundary instead of pausing mid-HTML.
SCRIPT_BOUNDARY_GATES: List[str] = [
    GateType.CREATIVE_CONCEPT.value,
    GateType.SHOT_PLAN.value,
    # Design identity approval sits right after the plan — the identity is
    # generated at planning time and shapes everything downstream (fonts,
    # motion, finishing, image art direction), so it must lock before
    # narration/HTML work begins.
    GateType.STYLEFRAME.value,
    # Agent-initiated asks sit AFTER the plan (the planner knows what it
    # needs) and BEFORE narration (user-confirmed real numbers flow into
    # the spoken script via the grounding rule).
    GateType.ASSET_REQUEST.value,
    GateType.NARRATION.value,
]

# How long a pending decision waits for the user before a sweeper may auto-resolve
# it with the recommended option (keeps "interactive but never blocks forever").
PENDING_DECISION_TTL_HOURS = 72


class GateOutcome(str, Enum):
    """What the resolver decided when the pipeline reached a gate."""

    EMIT_AND_STOP = "emit_and_stop"   # assist on, gate enabled, no answer → ask + stop the leg
    USE_ANSWER = "use_answer"         # an answer is recorded → apply it
    AUTO_DECIDE = "auto_decide"       # assist off / gate disabled / user said "let AI decide"


class DecisionRequired(BaseException):
    """Sentinel raised to unwind a generation leg when a gate needs the user.

    Carries the full ``decision_required`` payload so the service can persist it
    and the SSE consumer can render the card. It is NOT an error — the service
    catches it, flips the video to ``AWAITING_INPUT``, and returns cleanly.

    Subclasses ``BaseException`` (not ``Exception``) ON PURPOSE: the pipeline's
    HTML stage is wrapped in many ``except Exception`` handlers, and this control-
    flow signal must propagate straight through them to the service (verified: no
    bare ``except:`` clauses exist in automation_pipeline.py). The ThreadPoolExecutor
    that runs the pipeline captures BaseException and re-raises it on ``await``.
    """

    def __init__(self, decision: Dict[str, Any]):
        self.decision = decision
        gate = decision.get("gate_type", "?")
        super().__init__(f"DecisionRequired(gate={gate}, id={decision.get('decision_id')})")


# Decision answer modes accepted by the /decision endpoint.
ANSWER_MODES = ("select", "edit", "freeform", "auto", "auto_all")


# ---------------------------------------------------------------------------
# Assist-state container helpers (operate on the extra_metadata.assist dict)
# ---------------------------------------------------------------------------


def make_assist_state(
    enabled: bool,
    enabled_gates: Optional[List[str]] = None,
    granularity: str = "per_decision",
) -> Dict[str, Any]:
    """Build the initial ``extra_metadata.assist`` block for a new generation."""
    gates = enabled_gates if enabled_gates is not None else list(DEFAULT_ASSIST_GATES)
    # Normalise to known gate values, preserving order, dropping unknowns.
    known = {g.value for g in GateType}
    gates = [g for g in gates if g in known]
    return {
        "enabled": bool(enabled),
        "enabled_gates": gates,
        "granularity": granularity or "per_decision",
        "pending_decision": None,
        "answered_decisions": [],
        # Per-gate-type "auto for everything remaining of this kind" flags set by
        # the user via mode="auto_all". Lets the user escape granular pausing.
        "auto_all_gates": [],
    }


def is_gate_enabled(assist: Optional[Dict[str, Any]], gate_type: str) -> bool:
    if not assist or not assist.get("enabled"):
        return False
    return gate_type in (assist.get("enabled_gates") or [])


def is_auto_all(assist: Optional[Dict[str, Any]], gate_type: str) -> bool:
    if not assist:
        return False
    return gate_type in (assist.get("auto_all_gates") or [])


def _answer_key(gate_type: str, shot_index: Optional[int]) -> str:
    """Stable key identifying a single decision (a gate, optionally per-shot)."""
    return f"{gate_type}:{shot_index}" if shot_index is not None else gate_type


def find_recorded_answer(
    assist: Optional[Dict[str, Any]],
    gate_type: str,
    shot_index: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Return the recorded answer for a gate (and shot), or None if unanswered."""
    if not assist:
        return None
    if is_auto_all(assist, gate_type):
        # The user chose "let AI handle all remaining of this kind".
        return {"mode": "auto", "gate_type": gate_type, "shot_index": shot_index, "answer": {}}
    key = _answer_key(gate_type, shot_index)
    for rec in assist.get("answered_decisions") or []:
        if rec.get("_key") == key:
            return rec
    return None


def resolve_gate_outcome(
    assist: Optional[Dict[str, Any]],
    gate_type: str,
    shot_index: Optional[int] = None,
) -> Tuple[GateOutcome, Optional[Dict[str, Any]]]:
    """Decide what to do when the pipeline reaches ``gate_type``.

    Returns ``(outcome, recorded_answer)`` — ``recorded_answer`` is set only for
    ``USE_ANSWER``.
    """
    if not is_gate_enabled(assist, gate_type):
        return GateOutcome.AUTO_DECIDE, None
    recorded = find_recorded_answer(assist, gate_type, shot_index)
    if recorded is not None:
        if recorded.get("mode") == "auto":
            return GateOutcome.AUTO_DECIDE, None
        return GateOutcome.USE_ANSWER, recorded
    return GateOutcome.EMIT_AND_STOP, None


def build_decision_id(gate_type: str, video_id: str, shot_index: Optional[int], seq: int) -> str:
    shot = f"_shot{shot_index}" if shot_index is not None else ""
    return f"dec_{gate_type}_{video_id}{shot}_{seq}"


def _utcnow_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _expiry_iso(hours: int = PENDING_DECISION_TTL_HOURS) -> str:
    return (datetime.utcnow() + timedelta(hours=hours)).replace(microsecond=0).isoformat() + "Z"


def build_decision_payload(
    *,
    video_id: str,
    gate_type: str,
    prompt: str,
    options: List[Dict[str, Any]],
    recommended_option_id: Optional[str] = None,
    allow_freeform: bool = False,
    allow_edit: bool = False,
    shot_index: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
    seq: int = 1,
) -> Dict[str, Any]:
    """Assemble the ``decision_required`` event body (also stored as pending_decision)."""
    return {
        "type": "decision_required",
        "video_id": video_id,
        "decision_id": build_decision_id(gate_type, video_id, shot_index, seq),
        "gate_type": gate_type,
        "shot_index": shot_index,
        "prompt": prompt,
        "options": options or [],
        "recommended_option_id": recommended_option_id,
        "allow_freeform": bool(allow_freeform),
        "allow_edit": bool(allow_edit),
        "created_at": _utcnow_iso(),
        "expires_at": _expiry_iso(),
        "payload": payload or {},
    }


def set_pending(assist: Dict[str, Any], decision: Dict[str, Any]) -> Dict[str, Any]:
    """Store a pending decision on the assist block (returns the same dict)."""
    assist["pending_decision"] = decision
    return assist


def clear_pending(assist: Dict[str, Any]) -> Dict[str, Any]:
    assist["pending_decision"] = None
    return assist


def record_answer(
    assist: Dict[str, Any],
    *,
    decision_id: str,
    gate_type: str,
    mode: str,
    answer: Dict[str, Any],
    shot_index: Optional[int] = None,
    artifact_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Append an answer to the ledger and clear the pending decision.

    Idempotent on ``_key`` — re-answering the same gate replaces the prior entry
    so a double-submit can't create duplicate ledger rows.
    """
    key = _answer_key(gate_type, shot_index)
    rec = {
        "_key": key,
        "decision_id": decision_id,
        "gate_type": gate_type,
        "shot_index": shot_index,
        "mode": mode,
        "answer": answer or {},
        "answered_at": _utcnow_iso(),
        "artifact_key": artifact_key,
    }
    ledger = [r for r in (assist.get("answered_decisions") or []) if r.get("_key") != key]
    ledger.append(rec)
    assist["answered_decisions"] = ledger

    if mode == "auto_all":
        auto_all = list(assist.get("auto_all_gates") or [])
        if gate_type not in auto_all:
            auto_all.append(gate_type)
        assist["auto_all_gates"] = auto_all

    clear_pending(assist)
    return assist


# ---------------------------------------------------------------------------
# Gate option builders — turn pipeline artifacts into decision payloads
# ---------------------------------------------------------------------------

# Fields surfaced for each shot in the shot-plan gate (editable in the FE table).
_SHOT_PLAN_FIELDS = (
    "shot_index",
    "shot_type",
    "intent_role",
    "duration_estimate_s",
    "background_treatment",
    "transition_in",
    "pacing_role",
    "audio_policy",
    "narration_brief",
)


def shot_plan_summary(shots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Project a v3 shot plan's shots into the compact summary the gate shows."""
    out: List[Dict[str, Any]] = []
    for i, shot in enumerate(shots or []):
        if not isinstance(shot, dict):
            continue
        row = {f: shot.get(f) for f in _SHOT_PLAN_FIELDS}
        if row.get("shot_index") is None:
            row["shot_index"] = i
        out.append(row)
    return out


def build_shot_plan_decision(video_id: str, shots: List[Dict[str, Any]], seq: int = 1) -> Dict[str, Any]:
    summary = shot_plan_summary(shots)
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.SHOT_PLAN.value,
        prompt=(
            f"I've drafted a {len(summary)}-shot plan. Approve it, edit any shot, "
            "or let me decide."
        ),
        options=[{"option_id": "as_planned", "label": "Use this plan", "is_recommended": True}],
        recommended_option_id="as_planned",
        allow_freeform=True,
        allow_edit=True,
        payload={"shots": summary},
        seq=seq,
    )


def build_creative_concept_decision(video_id: str, concept: Dict[str, Any], seq: int = 1) -> Dict[str, Any]:
    fields = ("controlling_idea", "tonal_register", "emotional_arc", "visual_metaphor", "signature_device")
    proj = {f: (concept or {}).get(f) for f in fields}
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.CREATIVE_CONCEPT.value,
        prompt="Here's the creative direction I'm going with. Approve or refine it.",
        options=[{"option_id": "as_drafted", "label": "Looks good", "is_recommended": True}],
        recommended_option_id="as_drafted",
        allow_freeform=True,
        allow_edit=True,
        payload={"concept": proj},
        seq=seq,
    )


def build_narration_decision(
    video_id: str,
    per_shot: List[Dict[str, Any]],
    full_script: str,
    seq: int = 1,
) -> Dict[str, Any]:
    """``per_shot`` = [{shot_index, narration_text}]; ``full_script`` for the textarea."""
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.NARRATION.value,
        prompt="Here's the narration script. Edit it, approve it, or let me decide.",
        options=[{"option_id": "as_written", "label": "Use this script", "is_recommended": True}],
        recommended_option_id="as_written",
        allow_freeform=True,
        allow_edit=True,
        payload={"shots": per_shot or [], "full_script": full_script or ""},
        seq=seq,
    )


def to_casting_candidate(raw: Dict[str, Any], *, is_recommended: bool = False) -> Dict[str, Any]:
    """Normalise a stock/AI media candidate dict into the casting card shape."""
    raw = raw or {}
    kind = raw.get("kind")
    if not kind:
        kind = "video" if (raw.get("duration") or raw.get("video_url")) else "image"
    url = raw.get("url") or raw.get("video_url") or raw.get("image_url") or raw.get("src") or ""
    return {
        "candidate_id": str(raw.get("id") or raw.get("candidate_id") or url),
        "kind": kind,
        "url": url,
        "thumb": raw.get("thumb") or raw.get("thumbnail") or raw.get("preview") or url,
        "provider": raw.get("provider") or raw.get("source"),
        "width": raw.get("width"),
        "height": raw.get("height"),
        "duration": raw.get("duration"),
        "alt": raw.get("alt") or raw.get("description"),
        "is_recommended": bool(is_recommended),
    }


def build_visual_casting_groups_decision(
    video_id: str,
    groups: List[Dict[str, Any]],
    seq: int = 1,
) -> Dict[str, Any]:
    """Batched casting decision — one candidate group per media query.

    ``groups`` = [{query, kind, shot_index?, candidates[], recommended_candidate_id?}].
    The user picks a candidate per query (or defers to AI); selections are keyed
    by query string (the resolver's forcing key).
    """
    n = len(groups)
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.VISUAL_CASTING.value,
        prompt=(
            f"I gathered visual options for {n} shot{'s' if n != 1 else ''}. "
            "Pick the ones you like, or let me choose."
        ),
        options=[],
        recommended_option_id=None,
        allow_freeform=False,
        allow_edit=True,
        payload={"groups": groups},
        seq=seq,
    )


def build_visual_casting_decision(
    video_id: str,
    shot_index: int,
    query: str,
    candidates: List[Dict[str, Any]],
    recommended_candidate_id: Optional[str],
    seq: int = 1,
) -> Dict[str, Any]:
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.VISUAL_CASTING.value,
        prompt=f"Which visual for shot {shot_index + 1}" + (f" ({query})?" if query else "?"),
        options=[],
        recommended_option_id=recommended_candidate_id,
        allow_freeform=True,
        allow_edit=True,
        shot_index=shot_index,
        payload={
            "query": query,
            "recommended_candidate_id": recommended_candidate_id,
            "candidates": candidates or [],
        },
        seq=seq,
    )


# ---------------------------------------------------------------------------
# Pure answer-application transforms (the service/router calls these, then
# writes the result to the per-gate S3 sidecar)
# ---------------------------------------------------------------------------


def build_contact_sheet_decision(
    video_id: str,
    shots: List[Dict[str, Any]],
    seq: int = 1,
) -> Dict[str, Any]:
    """Contact-sheet gate — per-shot frame review AFTER the HTML stage.

    ``shots`` = [{shot_index, shot_type?, narration_excerpt?, thumb_url?}].
    The user approves the whole sheet or sends specific shots back with a note
    (answer mode ``edit`` with ``regens: [{shot_index, note}]``). Shots without
    a thumb render as text-only cards (screenshots exist only where the vision
    reviewer ran).
    """
    n = len(shots)
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.CONTACT_SHEET.value,
        prompt=(
            f"All {n} shot{'s' if n != 1 else ''} are built — here's the contact "
            "sheet. Approve to finish, or send any shot back with a note."
        ),
        options=[],
        recommended_option_id=None,
        allow_freeform=False,
        allow_edit=True,
        payload={"shots": shots},
        seq=seq,
    )


def build_cast_decision(
    video_id: str,
    characters: List[Dict[str, Any]],
    seq: int = 1,
) -> Dict[str, Any]:
    """Cast gate — approve the characters' portraits BEFORE any dialogue clip
    is filmed (each clip costs real money; a wrong face multiplies across the
    whole video). ``characters`` = [{name, visual_description, voice_hint,
    sheet_url}]. Answer = ``edit`` with ``characters: [{name, url?,
    regen_note?}]`` — keep by default, upload a replacement, or regenerate
    with a note.
    """
    n = len(characters)
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.CAST.value,
        prompt=(
            f"Meet your cast — {n} character{'s' if n != 1 else ''}. Approve them "
            "before I film the scenes, or fix any portrait first."
        ),
        options=[],
        recommended_option_id=None,
        allow_freeform=False,
        allow_edit=True,
        payload={"characters": characters},
        seq=seq,
    )


def cast_gate_directives(answer: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """{name_lower: {url?, note?}} from a cast ``edit`` answer."""
    out: Dict[str, Dict[str, Any]] = {}
    for c in ((answer or {}).get("characters") or []):
        if not isinstance(c, dict):
            continue
        name = str(c.get("name") or "").strip().lower()
        if not name:
            continue
        url = sanitize_media_url(c.get("url"))
        note = str(c.get("regen_note") or "").strip()[:500] or None
        if url or note:
            out[name] = {"url": url, "note": note}
    return out


def build_styleframe_decision(
    video_id: str,
    identity: Dict[str, Any],
    pairing_options: List[Dict[str, Any]],
    motion_options: List[Dict[str, Any]],
    seq: int = 1,
) -> Dict[str, Any]:
    """Styleframe gate — approve the run's DESIGN IDENTITY before any shot is
    built. ``identity`` is the normalized design_identity dict from
    shot_plan.json (typography pairing, motion personality, finishing tokens,
    color arc note, image art direction, optional styleframe_url — one hero
    image rendered from the identity). ``pairing_options``/``motion_options``
    are registry summaries [{key, label, vibe}] so the card can offer swaps
    without hardcoding the registry in the FE.

    Answer = ``edit`` with ``identity: {font_pairing?, motion_personality?,
    finishing?, color_arc_note?, image_art_direction?}`` — only registry keys
    and short text; the backend re-normalizes everything.
    """
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.STYLEFRAME.value,
        prompt=(
            "Here's the design identity for this video — typography, motion "
            "personality, and finishing. Approve it, or adjust before I build "
            "the shots."
        ),
        options=[],
        recommended_option_id=None,
        allow_freeform=True,
        allow_edit=True,
        payload={
            "identity": identity,
            "pairing_options": pairing_options,
            "motion_options": motion_options,
        },
        seq=seq,
    )


def styleframe_answer_identity(answer: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """The raw identity-edit dict from a styleframe ``edit`` answer. The
    caller MUST re-normalize via design_identity.normalize_design_identity —
    this only shapes/limits the input (registry validation happens there)."""
    ident = (answer or {}).get("identity")
    if not isinstance(ident, dict):
        return {}
    out: Dict[str, Any] = {}
    for key in ("font_pairing", "motion_personality", "identity_name"):
        if isinstance(ident.get(key), str):
            out[key] = ident[key][:64]
    if isinstance(ident.get("finishing"), dict):
        out["finishing"] = {
            k: str(v)[:16]
            for k, v in ident["finishing"].items()
            if k in ("grain", "vignette", "light")
        }
    for key in ("color_arc_note", "image_art_direction"):
        if isinstance(ident.get(key), str):
            out[key] = ident[key][:260]
    return out


def build_asset_request_decision(
    video_id: str,
    requests: List[Dict[str, Any]],
    seq: int = 1,
) -> Dict[str, Any]:
    """Agent-initiated asks — the planner requested real assets from the user.

    ``requests`` = [{index, shot_index?, kind: screenshot|photo|data|inspiration,
    ask, why, options?}]. Every item is individually skippable; the answer is
    ``edit`` with ``responses: [{index, url?|text?|choice?|skipped?}]``.
    """
    n = len(requests)
    return build_decision_payload(
        video_id=video_id,
        gate_type=GateType.ASSET_REQUEST.value,
        prompt=(
            f"I could make {('this shot' if n == 1 else f'{n} shots')} much more real "
            "with a few things from you — upload, answer, or skip any of them."
        ),
        options=[],
        recommended_option_id=None,
        allow_freeform=False,
        allow_edit=True,
        payload={"requests": requests},
        seq=seq,
    )


def sanitize_media_url(url: Any) -> Optional[str]:
    """Validate a caller-supplied media URL before it can reach shot_plan.json
    and, from there, LLM prompts and rendered HTML. Only http(s), no quotes/
    angle-brackets/whitespace/control chars (attribute/prompt breakout), ≤2000
    chars. Returns the clean URL or None."""
    u = str(url or "").strip()
    if not u or len(u) > 2000:
        return None
    low = u.lower()
    if not (low.startswith("http://") or low.startswith("https://")):
        return None
    if any(c in u for c in ('"', "'", "<", ">", "`", "\\")):
        return None
    if any(ord(c) < 33 for c in u):  # spaces + control chars
        return None
    return u


def asset_request_responses(answer: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize the responses list from an asset_request ``edit`` answer."""
    out: List[Dict[str, Any]] = []
    for r in ((answer or {}).get("responses") or []):
        if not isinstance(r, dict):
            continue
        try:
            idx = int(r.get("index"))
        except (TypeError, ValueError):
            continue
        out.append({
            "index": idx,
            "url": sanitize_media_url(r.get("url")),
            "text": (str(r.get("text")).strip()[:400] if r.get("text") else None),
            "choice": (str(r.get("choice")).strip()[:200] if r.get("choice") else None),
            "skipped": bool(r.get("skipped")),
        })
    return out


def contact_sheet_regen_notes(answer: Optional[Dict[str, Any]]) -> Dict[int, str]:
    """Extract {shot_index: note} from a contact_sheet ``edit`` answer."""
    notes: Dict[int, str] = {}
    for r in ((answer or {}).get("regens") or []):
        if not isinstance(r, dict):
            continue
        try:
            idx = int(r.get("shot_index"))
        except (TypeError, ValueError):
            continue
        note = str(r.get("note") or "").strip()
        if note:
            notes[idx] = note[:800]
    return notes


def apply_shot_plan_answer(shots: List[Dict[str, Any]], answer: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Overlay user-edited shot rows onto the shot list (matched by shot_index)."""
    edited = (answer or {}).get("shots")
    if not edited:
        return shots
    by_index = {row.get("shot_index"): row for row in edited if isinstance(row, dict)}
    out = []
    for i, shot in enumerate(shots or []):
        if not isinstance(shot, dict):
            out.append(shot)
            continue
        idx = shot.get("shot_index", i)
        patch = by_index.get(idx)
        if patch:
            merged = dict(shot)
            for f in _SHOT_PLAN_FIELDS:
                if f in patch and patch[f] is not None:
                    merged[f] = patch[f]
            out.append(merged)
        else:
            out.append(shot)
    return out


def apply_narration_answer(shots: List[Dict[str, Any]], answer: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Overlay edited per-shot narration text onto the shot list."""
    edited = (answer or {}).get("shots")
    if not edited:
        return shots
    by_index = {row.get("shot_index"): row.get("narration_text")
                for row in edited if isinstance(row, dict)}
    out = []
    for i, shot in enumerate(shots or []):
        if not isinstance(shot, dict):
            out.append(shot)
            continue
        idx = shot.get("shot_index", i)
        if idx in by_index and by_index[idx] is not None:
            merged = dict(shot)
            merged["narration_text"] = by_index[idx]
            out.append(merged)
        else:
            out.append(shot)
    return out


def narration_full_script_from_shots(shots: List[Dict[str, Any]]) -> str:
    """Concatenate per-shot narration into a single script string (legacy textarea)."""
    parts = []
    for shot in shots or []:
        if isinstance(shot, dict):
            text = (shot.get("narration_text") or "").strip()
            if text:
                parts.append(text)
    return " ".join(parts)
