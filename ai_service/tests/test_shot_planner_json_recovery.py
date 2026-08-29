"""Recovering a shot plan from a model that answers in prose.

Gemini Flash periodically ignores `response_format={"type":"json_object"}` and
opens with analysis instead — "Let me carefully analyze this request." A real
run hit this on BOTH the first call and the instruction-based corrective turn
("The user wants a valid JSON response. Let me carefully construct...") and
produced nothing parseable, dropping the whole run.

Asking again in words does not work on a model already committed to reasoning.
A trailing assistant turn containing "{" does: it leaves the model mid-object
with no grammatical way back into prose.
"""

import json
import os
import sys

import pytest

_HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(_HERE, "..", "app", "ai-video-gen-main"))

import shot_planner as sp  # noqa: E402


PROSE = "Let me carefully analyze this request.\n\nThe user wants a 300-second explainer."

_PLAN_BODY = {
    "shots": [
        {
            "shot_index": 0,
            "shot_type": "KINETIC_TITLE",
            "narration_brief": "open",
            "duration_estimate_s": 6,
        },
        {
            "shot_index": 1,
            "shot_type": "IMAGE_CLIP",
            "image_index": 3,
            "narration_brief": "the form",
            "duration_estimate_s": 6,
        },
    ]
}


def _plan_json():
    return json.dumps(_PLAN_BODY)


def _run(second_response):
    """Drive plan_shots with a scripted LLM. Returns (result, calls).

    Call 1 answers in prose. Call 2 is the corrective turn and gets the
    caller's response. Any later call (the creative-concept enforcement pass)
    is answered with a valid plan so it cannot disturb what is under test.
    """
    calls = []

    def llm_chat(messages, **kw):
        calls.append({"messages": messages, "kw": kw})
        if len(calls) == 1:
            return PROSE, {"prompt_tokens": 10, "completion_tokens": 5}
        if len(calls) == 2:
            return second_response, {"prompt_tokens": 10, "completion_tokens": 5}
        return _plan_json(), {"prompt_tokens": 10, "completion_tokens": 5}

    result = sp.plan_shots(
        prompt="explain the flow",
        target_duration_s=300.0,
        llm_chat=llm_chat,
        model="google/gemini-3-flash-preview",
        tier="super_ultra",
    )
    return result, calls


def test_the_corrective_turn_prefills_an_open_brace():
    """The mechanism: the retry must END on an assistant turn of '{'."""
    _, calls = _run(_plan_json()[1:])  # continuation, brace already consumed
    # Call 1 is the prose answer, call 2 the corrective turn. A third call may
    # follow (the creative-concept enforcement pass) — not part of recovery.
    assert len(calls) >= 2, "expected a corrective turn"
    last = calls[1]["messages"][-1]
    assert last["role"] == "assistant"
    assert last["content"].strip() == "{"


def test_a_prose_first_answer_still_yields_a_plan():
    result, _ = _run(_plan_json()[1:])
    assert len(result["shots"]) == 2
    assert result["shots"][1]["image_index"] == 3


def test_a_provider_that_echoes_the_prefill_also_parses():
    """Some providers continue from the prefill, others repeat it. Both must
    work, or the fix trades one parse failure for another."""
    result, _ = _run(_plan_json())  # full object, leading '{' included
    assert len(result["shots"]) == 2
    assert result["shots"][1]["image_index"] == 3


def test_prose_on_both_turns_still_raises():
    """Recovery must not paper over a genuinely unusable response."""
    with pytest.raises(sp.ShotPlanError):
        _run("Still thinking about it, no JSON here.")


def test_the_corrective_turn_is_cooled_and_keeps_json_mode():
    _, calls = _run(_plan_json()[1:])
    kw = calls[1]["kw"]
    assert kw.get("response_format") == {"type": "json_object"}
    assert kw.get("temperature", 1.0) <= 0.2, "retry should not be as hot as the first call"
