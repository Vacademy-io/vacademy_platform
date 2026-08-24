"""A brief that ships its own narration must be spoken, not paraphrased.

A clinical brief supplied ten `VO:` lines plus rules like "keep every named
test exactly as named". The writer rewrote them: it renamed a test (head
thrust -> head impulse), invented specifics the brief never states (Ishihara
plates, pinprick, diplopia, supranuclear), added diagnostic qualifiers the
brief explicitly ruled out, and dropped required terms (PEARL, pterygoids,
"front two-thirds"). For factual subjects that is a correctness bug.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"))

from narration_writer import apply_authored_vo, extract_authored_vo  # noqa: E402

# Quoted VO blocks hard-wrapped across lines — the real shape a pasted brief
# arrives in, and the shape that used to truncate mid-sentence.
_BRIEF = '''
3. CN I AND II (0:30-0:52) - PROCESS_STEPS
VO: "Nerve one: eyes closed, one nostril occluded, a familiar smell. Nerve two takes four
checks - acuity on a Snellen chart, fields by confrontation, the accommodation reflex, and
colour vision - then fundoscopy to look inside the eye itself."
VISUAL: five numbered test cards building left to right.
4. CN III, IV, VI (0:52-1:12) - TEXT_DIAGRAM
VO: "Three, four and six move the eye. Inspect for ptosis, and for pupil size, shape and
equality. Shine a light - the lit pupil constricts, and so does its partner. Record it as
PEARL. Then trace an H and watch both eyes follow."
VISUAL: a pupil pair animating direct then consensual constriction.
8. GRADING (2:18-2:34) - DATA_STORY
VO: "These muscles don't move bones, so manual muscle testing doesn't apply. F, functional.
WF, weak functional. NF, non-functional. Zero, absent."
'''


def test_wrapped_quoted_blocks_are_captured_whole():
    vo = extract_authored_vo(_BRIEF)
    assert len(vo) == 3
    # The truncation bug cut this line before its most important instruction.
    assert vo[1].endswith("watch both eyes follow.")
    assert "PEARL" in vo[1]
    assert "WF, weak functional" in vo[2]
    assert "\n" not in vo[1]


def test_lines_are_assigned_to_speaking_shots_in_order():
    vo = extract_authored_vo(_BRIEF)
    shots = [
        {"shot_index": 0, "audio_policy": "narration_only", "narration_text": "paraphrase"},
        {"shot_index": 1, "audio_policy": "intrinsic_only", "narration_text": "x"},
        {"shot_index": 2, "audio_policy": "narration_only", "narration_text": "paraphrase"},
        {"shot_index": 3, "audio_policy": "narration_only", "narration_text": "paraphrase"},
    ]
    assert apply_authored_vo(shots, vo) is True
    assert shots[0]["narration_text"].startswith("Nerve one:")
    assert "PEARL" in shots[2]["narration_text"]
    assert shots[1]["narration_text"] == ""      # intrinsic shot stays silent


def test_a_count_mismatch_refuses_rather_than_misaligning():
    vo = extract_authored_vo(_BRIEF)
    shots = [{"shot_index": 0, "audio_policy": "narration_only", "narration_text": "keep"}]
    assert apply_authored_vo(shots, vo) is False
    assert shots[0]["narration_text"] == "keep"


def test_briefs_without_authored_vo_are_untouched():
    assert extract_authored_vo("make a nice video about cranial nerves") == []
    assert extract_authored_vo(None) == []
    # One stray mention is not a script.
    assert extract_authored_vo('VO: "hello there and welcome back to the channel"') == []


def test_unquoted_one_line_per_vo_still_works():
    brief = (
        "VO: Twelve nerves leave the brain without passing through the spinal cord.\n"
        "VO: Each nerve is sensory, motor, or both, and each leaves through its own opening.\n"
        "VO: Examine, grade, compare sides, and the examination tells you where.\n"
    )
    vo = extract_authored_vo(brief)
    assert len(vo) == 3 and vo[0].startswith("Twelve nerves")
