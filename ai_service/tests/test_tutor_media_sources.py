"""Video / PDF slides compiled from their own words (design §4.2) and the
credit estimate shown before preparing — the parts without a database."""
from app.services.tutor import compile_estimate, source_text
from app.services.tutor.compile_prompts import media_task_user_prompt
from app.services.tutor.slide_source import SlideSource, source_kind_label


def _src(**kw):
    base = dict(slide_id="s", title="T", source_type="VIDEO", source_id="v", kind="video", content_hash="h0")
    base.update(kw)
    return SlideSource(**base)


def test_source_kind_labels():
    assert source_kind_label(_src(ai_gen_video_id="vid_1", source_type="HTML_VIDEO")) == "ai_video"
    assert source_kind_label(_src(media_file_id="0a4b6f2e-1111-2222-3333-444455556666")) == "video_upload"
    assert source_kind_label(_src(media_url="https://youtu.be/abc123def45")) == "youtube"
    assert source_kind_label(_src(media_url="https://vimeo.com/1")) == "video_link"
    assert source_kind_label(_src(kind="pdf", source_type="DOCUMENT", media_file_id="f")) == "pdf"
    assert source_kind_label(_src(kind="quiz", source_type="QUIZ")) == "quiz"


def test_expected_text_kind_and_hash_change_with_text():
    up = _src(media_file_id="f1")
    assert source_text.expected_text_kind(up) == "transcript"
    assert source_text.expected_text_kind(_src(media_url="https://vimeo.com/1")) is None
    h_desc = source_text.hash_for(up, None)
    h_tr = source_text.hash_for(up, "transcript")
    assert h_desc == "h0" and h_tr != h_desc and h_tr == source_text.hash_for(up, "transcript")
    assert source_text.hash_for(_src(kind="document", source_type="DOCUMENT"), "pdf") == "h0"


def test_transcription_minutes_rounds_up_and_prefers_measured_duration():
    assert source_text.transcription_minutes(4672000) == 78
    assert source_text.transcription_minutes(None) == 0
    assert source_text.transcription_minutes(4672000, duration_seconds=61) == 2


def test_media_prompt_uses_the_material_words_when_present():
    with_text = media_task_user_prompt(slide_title="S", chapter_title=None, course_title=None, kind="video",
                                       description="teacher note", lang="en", transcript="hello world " * 5, text_kind="transcript")
    assert "TRANSCRIPT (speech recognition" in with_text and "teacher note" in with_text and "1 to 3 topics" in with_text
    assert "3 to 8 teaching concepts" in with_text
    without = media_task_user_prompt(slide_title="S", chapter_title=None, course_title=None, kind="pdf",
                                     description="teacher note", lang="hi")
    assert "Build ONE topic" in without and "read the document" in without


class _Plan:
    def __init__(self, status, content_hash, language="en", source_description=None):
        self.status, self.content_hash, self.language, self.source_description = status, content_hash, language, source_description


class _Est:
    def __init__(self, db):
        pass

    def estimate(self, key, params):
        if key == "tutor_compile_slide":
            return {"estimated_credits": 2}
        if key == "tutor_media_image":
            return {"estimated_credits": 1}
        if key == "transcription":
            return {"estimated_credits": max(2.0, 0.5 * float(params.get("audio_minutes") or 0))}
        raise ValueError(key)

    def estimate_with_balance(self, key, params, institute_id):
        return {"current_balance": 10}


def test_estimate_compile_per_kind(monkeypatch):
    sources = {
        "doc": _src(slide_id="doc", kind="document", source_type="DOCUMENT", content_hash="hd"),
        "doc_ok": _src(slide_id="doc_ok", kind="document", source_type="DOCUMENT", content_hash="hd2"),
        "up": _src(slide_id="up", media_file_id="f1", video_length_ms=4672000),
        "up_desc_only": _src(slide_id="up_desc_only", media_file_id="f2", video_description="what it teaches"),
        "yt": _src(slide_id="yt", media_url="https://youtu.be/abc123def45"),
        "link": _src(slide_id="link", media_url="https://vimeo.com/1"),
        "quiz": _src(slide_id="quiz", kind="quiz", source_type="QUIZ"),
    }
    monkeypatch.setattr(compile_estimate, "load_slide_source", lambda db, sid: sources.get(sid))
    monkeypatch.setattr(compile_estimate.plan_store, "latest_plans_for_slides", lambda db, ids: {"doc_ok": _Plan("READY", "hd2")})
    monkeypatch.setattr(compile_estimate, "ToolCostEstimator", _Est)
    monkeypatch.setattr(compile_estimate.source_text, "transcription_available", lambda: True)
    monkeypatch.setattr(compile_estimate.source_text, "transcript_cached", lambda db, fid: False)

    out = compile_estimate.estimate_compile(None, institute_id="i", slide_ids=list(sources) + ["missing"], language="en",
                                            generate_images=True, transcribe_videos=True, force=False)
    by = {r["slide_id"]: r for r in out["slides"]}
    assert by["doc"]["action"] == "compile" and by["doc"]["images_max"] == 4 and by["doc"]["total"] == 2
    assert by["doc_ok"]["action"] == "up_to_date" and by["doc_ok"]["total"] == 0
    assert by["up"]["action"] == "compile" and by["up"]["minutes"] == 78 and by["up"]["transcription"] == 39.0 and by["up"]["total"] == 41.0
    assert by["yt"]["text"] == "captions" and by["yt"]["total"] == 2
    assert by["link"]["action"] == "needs_details" and by["link"]["total"] == 0
    assert by["quiz"]["action"] == "skip"
    assert by["missing"]["action"] == "unpublished"
    t = out["totals"]
    assert t["to_compile"] == 4 and t["required"] == 2 + 41 + (2 + 5) + 2 and t["images_max"] == 4 and t["worst_case"] == t["required"] + 4
    assert out["balance"] == 10 and out["sufficient"] is False

    # Transcription off: the uploaded video with a slide-editor description compiles from it; the other parks.
    out2 = compile_estimate.estimate_compile(None, institute_id="i", slide_ids=["up", "up_desc_only"], language="en",
                                             generate_images=False, transcribe_videos=False, force=False)
    by2 = {r["slide_id"]: r for r in out2["slides"]}
    assert by2["up"]["action"] == "needs_details" and by2["up_desc_only"]["action"] == "compile" and by2["up_desc_only"]["transcription"] == 0
