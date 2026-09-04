"""Regressions from the 2026-09-04 deep review of the Live AI Tutor.

Each test pins one confirmed finding: staff-role names, per-slide billing
counters, truncated replies, STALE plans still serving, SVG size, media-task
url rules, resume replay, the final-attempt prompt line, and the settings
fields the compile router now resolves from the course.
"""
import asyncio
import json
from dataclasses import replace

import pytest

from app.schemas.tutor import TeachingPlanDraft
from app.services.tutor import board_ops, plan_store
from app.services.tutor.plan_validator import DEFAULT_LIMITS, validate_plan
from app.services.tutor.roles import STAFF_ROLES, is_staff, normalize_roles
from app.services.tutor.runtime import state as sm
from app.services.tutor.runtime.prompts import turn_prompt
from app.services.tutor.runtime.settings import TutorSettings, _apply


# ── roles ────────────────────────────────────────────────────────────────────

def test_platform_role_names_with_spaces_are_staff():
    assert is_staff(["CONTENT CREATOR"])
    assert is_staff(["course creator"])
    assert is_staff(["STUDENT", "TEACHER"])
    assert not is_staff(["STUDENT"])
    assert not is_staff([])
    assert is_staff([], is_root=True)
    assert normalize_roles(["Content Creator", None, ""]) == {"CONTENT_CREATOR"}
    assert "CONTENT_CREATOR" in STAFF_ROLES


# ── compiler: per-slide counters, truncation, model fallback ────────────────

def test_usage_counters_are_per_slide_not_per_compiler(monkeypatch):
    """Two slides compiled concurrently on one PlanCompiler must bill their
    own tokens (the review found a shared self._usage)."""
    from app.services.tutor import plan_compiler as pc

    compiler = pc.PlanCompiler(institute_id="i", user_id="u")
    calls = {"n": 0}

    class _Client:
        def __init__(self, *_a, **_k):
            pass

        async def chat_completion(self, messages, **kw):
            calls["n"] += 1
            n = calls["n"]
            await asyncio.sleep(0.01 if n == 1 else 0)
            return {"content": "{}", "usage": {"prompt_tokens": 100 * n, "completion_tokens": 10 * n},
                    "model": f"m{n}", "finish_reason": "stop"}

    class _DB:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class _Keys:
        def __init__(self, db):
            pass

        def resolve_keys(self, *a, **k):
            return (None, None, None)

    monkeypatch.setattr(pc, "ChatLLMClient", _Client)
    monkeypatch.setattr(pc, "ApiKeyResolver", _Keys)
    monkeypatch.setattr(pc, "db_session", lambda: _DB())

    async def go():
        r1, r2 = pc._Run(), pc._Run()
        await asyncio.gather(compiler._chat([], r1), compiler._chat([], r2))
        return r1, r2

    r1, r2 = asyncio.run(go())
    totals = sorted((r.usage["prompt_tokens"], r.usage["completion_tokens"]) for r in (r1, r2))
    assert totals == [(100, 10), (200, 20)]
    assert {r1.model_used, r2.model_used} == {"m1", "m2"}


def test_truncated_reply_is_never_repaired_into_a_plan(monkeypatch):
    from app.services.tutor import plan_compiler as pc
    from app.services.tutor.slide_source import SlideSource

    compiler = pc.PlanCompiler(institute_id="i", user_id="u")
    seen = []

    async def fake_chat(messages, run):
        seen.append(len(messages))
        run.model_used = "m"
        return '{"language":"en","objectives":["x"],"topics":[', "length"

    monkeypatch.setattr(compiler, "_chat", fake_chat)

    async def no_kb(source):
        return None

    monkeypatch.setattr(compiler, "_kb_block", no_kb)
    src = SlideSource(slide_id="s", title="T", source_type="DOCUMENT", source_id="d", kind="document", text="body")
    with pytest.raises(RuntimeError) as ei:
        asyncio.run(compiler._build_draft(src, None, pc._Run()))
    assert "cut off" in str(ei.value)
    assert seen == [2, 4, 6]            # initial + two repair rounds, each asking for a shorter plan


def test_provider_rejection_falls_back_but_timeouts_do_not(monkeypatch):
    import httpx
    from app.services.tutor import plan_compiler as pc

    compiler = pc.PlanCompiler(institute_id="i", user_id="u", model_override="bad/model")
    attempts = []

    class _DB:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class _Keys:
        def __init__(self, db):
            pass

        def resolve_keys(self, *a, **k):
            return (None, None, None)

    class _Client:
        def __init__(self, *_a, **_k):
            pass

        async def chat_completion(self, messages, **kw):
            attempts.append(kw.get("model"))
            if kw.get("model") == "bad/model":
                req = httpx.Request("POST", "https://x")
                raise httpx.HTTPStatusError("nope", request=req, response=httpx.Response(404, request=req))
            return {"content": "{}", "usage": {}, "model": "default", "finish_reason": "stop"}

    monkeypatch.setattr(pc, "ChatLLMClient", _Client)
    monkeypatch.setattr(pc, "ApiKeyResolver", _Keys)
    monkeypatch.setattr(pc, "db_session", lambda: _DB())
    content, fr = asyncio.run(compiler._chat([], pc._Run()))
    assert attempts == ["bad/model", None] and fr == "stop"

    class _Timeout(_Client):
        async def chat_completion(self, messages, **kw):
            attempts.append(kw.get("model"))
            raise httpx.ReadTimeout("slow")

    attempts.clear()
    monkeypatch.setattr(pc, "ChatLLMClient", _Timeout)
    with pytest.raises(httpx.ReadTimeout):
        asyncio.run(compiler._chat([], pc._Run()))
    assert attempts == ["bad/model"]    # no second, expensive attempt


# ── plans: STALE serves, hash reinstates ────────────────────────────────────

def test_serving_statuses_include_stale():
    assert plan_store.SERVING_STATUSES == ("READY", "STALE")


def test_description_unchanged_reads_compile_inputs():
    from app.services.tutor.plan_compiler import _description_unchanged
    from types import SimpleNamespace as NS
    assert _description_unchanged(NS(raw_plan_json={"compile_inputs": {"source_description": " a "}}, source_description="a"))
    assert not _description_unchanged(NS(raw_plan_json={"compile_inputs": {"source_description": "a"}}, source_description="b"))
    assert _description_unchanged(NS(raw_plan_json=None, source_description="b"))   # legacy row: trust the hash


# ── board ops: svg size, media_task url rule ────────────────────────────────

def test_oversized_svg_is_rejected_not_truncated():
    big = "<svg viewBox='0 0 10 10'>" + "<circle r='1'/>" * 2000 + "</svg>"
    assert len(big) > board_ops._MAX_SVG_CHARS
    assert board_ops.sanitize_svg(big) == ""
    errors, _ = board_ops.validate_ops([{"op": "svg", "id": "d", "svg": big, "description": "x"}])
    assert errors and "too long" in errors[0]


def test_media_task_with_file_id_shaped_url_fails_validation_like_storage():
    uuid_url = "5d4a0e0e-1111-2222-3333-444444444444"
    op = {"op": "media_task", "id": "m", "kind": "video", "url": uuid_url, "description": "watch"}
    errors, _ = board_ops.validate_ops([op])
    assert errors and "https" in errors[0]
    assert board_ops.clean_ops([op]) == []
    ok = {"op": "media_task", "id": "m", "kind": "video", "file_id": uuid_url, "description": "watch"}
    assert board_ops.validate_ops([ok])[0] == [] and len(board_ops.clean_ops([ok])) == 1


def test_uploaded_video_url_becomes_file_id():
    from app.services.tutor.slide_source import SlideSource, _video

    class _DB:
        def execute(self, *_a, **_k):
            class R:
                def first(self):
                    return ("5d4a0e0e-1111-2222-3333-444444444444", None)
            return R()

    src = SlideSource(slide_id="s", title="v", source_type="VIDEO", source_id="x", kind="other")
    _video(_DB(), src, "x", html_video=False)
    assert src.media_file_id and src.media_url is None


# ── runtime: resume replay, final attempt, settings ─────────────────────────

def _lesson():
    view = {
        "plan_id": "p", "slide_id": "s", "version": 1, "language": "en", "objectives": [], "slide_title": "Force basics",
        "topics": [{"id": "t1", "title": "Force", "order": 1, "summary_ops": [], "concepts": [
            {"id": "c1", "title": "A", "order": 1, "concept_tags": [], "board_ops": [{"op": "heading", "id": "h", "text": "F"}],
             "say": "one", "say_i18n": {}, "teach_notes": None, "check": {"type": "none"}},
            {"id": "c2", "title": "B", "order": 2, "concept_tags": [], "board_ops": [{"op": "text", "id": "t", "text": "x"}],
             "say": "two", "say_i18n": {}, "teach_notes": None, "check": {"type": "none"}},
            {"id": "c3", "title": "C", "order": 3, "concept_tags": [], "board_ops": [{"op": "text", "id": "u", "text": "y"}],
             "say": "three", "say_i18n": {}, "teach_notes": None, "check": {"type": "open", "prompt": "?", "expected": "y"}},
        ]}],
    }
    return sm.from_plan_view(view)


def test_resume_replays_earlier_concepts_and_carries_slide_title():
    L = _lesson()
    assert L.slide_title == "Force basics"
    p = L.find("c3")
    ids = [op["id"] for op in sm.replay_ops(L, p)]
    assert ids == ["h", "t"]
    assert sm.replay_ops(L, sm.Pointer()) == []
    assert sm.enter(L, p).clear_board is False


def test_final_attempt_line_tells_model_not_to_reask():
    kw = dict(learner_name=None, learner_block="", slide_title="s", objectives=[], board_ops=[], concept_title="c",
              concept_say="say", teach_notes=None, check={"type": "open", "prompt": "?"}, transcript=[],
              learner_message="dunno", remediation_no=1, mode="text")
    assert "FINAL ATTEMPT" in turn_prompt(final_attempt=True, **kw)
    assert "FINAL ATTEMPT" not in turn_prompt(final_attempt=False, **kw)


def test_settings_carry_kb_grounding_and_only_valid_modes():
    s = TutorSettings()
    _apply(s, {"kbGrounding": {"knowledge_base_id": "kb1", "mode": "BLENDED"}})
    assert s.kb_grounding == {"knowledge_base_id": "kb1", "mode": "BLENDED"}
    _apply(s, {"kbGrounding": {"knowledge_base_id": "kb2", "mode": "weird"}})
    assert s.kb_grounding["mode"] == "STRICT"
    _apply(s, {"kbGrounding": None})
    assert s.kb_grounding["knowledge_base_id"] == "kb2"     # empty values never override


def test_post_media_validation_tolerates_a_dropped_image():
    """A topic whose only visual was an image the system could not fill is
    still delivered (with its text) instead of failing the whole plan."""
    from tests.test_tutor_compile import _plan
    data = _plan().model_dump(by_alias=True)
    for t in data["topics"]:
        for c in t["concepts"]:
            c["board_ops"] = [op for op in c["board_ops"] if op["op"] not in ("svg", "image", "video", "media_task")]
    p = TeachingPlanDraft.model_validate(data)
    assert validate_plan(p, "en", limits=DEFAULT_LIMITS)                                            # strict: rejected
    assert validate_plan(p, "en", limits=replace(DEFAULT_LIMITS, require_visual_per_topic=False)) == []


def test_lesson_frame_shape_is_json_serialisable():
    L = _lesson()
    frame = {"type": "lesson", "slide_id": L.slide_id, "slide_title": L.slide_title,
             "topics": [{"id": t.id, "title": t.title, "concepts": len(t.concepts)} for t in L.topics],
             "progress": sm.Pointer().progress(L)}
    assert json.loads(json.dumps(frame))["topics"][0]["concepts"] == 3


def test_sarvam_speaker_rejects_unknown_voices():
    from app.services.voice_tts import SARVAM_DEFAULT_FEMALE, sarvam_speaker
    assert sarvam_speaker("anushka", SARVAM_DEFAULT_FEMALE) == "priya"     # bulbul:v2 name → silent lesson before
    assert sarvam_speaker("nirupma", SARVAM_DEFAULT_FEMALE) == "priya"     # a Smallest.ai voice
    assert sarvam_speaker(" Ritu ", SARVAM_DEFAULT_FEMALE) == "ritu"
    assert sarvam_speaker(None, "shubh") == "shubh"
