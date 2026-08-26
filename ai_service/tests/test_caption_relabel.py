"""Captions must carry the author's words, not the recogniser's guesses.

Whisper transcribes the synthesized audio, so caption text inherits ASR
errors. On a cranial-nerve video that put "René, 512 herds, mastide" on
screen — three mangled clinical terms in one line, on a brief that pinned
"Rinne", "512 Hz" and "mastoid" exactly. The words are known before the audio
is made; alignment should borrow Whisper's timings and keep the script.
"""
import re
import sys
from pathlib import Path

_AI = Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
_SRC = (_AI / "automation_pipeline.py").read_text()


def _load_relabel():
    """Exec just the helper — importing the module needs heavy optional deps."""
    start = _SRC.index("def _relabel_words_from_script")
    end = _SRC.index("def _whisper_align", start)
    ns = {"re": re}
    exec(_SRC[start:end], ns)
    return ns["_relabel_words_from_script"]


_relabel = _load_relabel()

# Verbatim from the run: Whisper's text against what was actually spoken.
_ASR = [
    {"word": "René,", "start": 1.0, "end": 1.4},
    {"word": "512", "start": 1.4, "end": 1.9},
    {"word": "herds,", "start": 1.9, "end": 2.4},
    {"word": "mastide,", "start": 2.4, "end": 3.0},
    {"word": "then", "start": 3.0, "end": 3.2},
    {"word": "beside", "start": 3.2, "end": 3.6},
    {"word": "the", "start": 3.6, "end": 3.7},
    {"word": "ear", "start": 3.7, "end": 4.0},
]
_SCRIPT = "Rinne, 512 hertz: mastoid, then beside the ear"


def test_mangled_clinical_terms_are_restored():
    out = _relabel(_ASR, _SCRIPT)
    text = " ".join(w["word"] for w in out)
    for wrong in ("René", "herds", "mastide"):
        assert wrong not in text, f"{wrong!r} survived: {text}"
    for right in ("Rinne", "hertz", "mastoid"):
        assert right in text, f"{right!r} missing: {text}"


def test_timings_are_preserved_and_monotonic():
    out = _relabel(_ASR, _SCRIPT)
    assert out[0]["start"] == 1.0
    assert out[-1]["end"] <= 4.0
    for a, b in zip(out, out[1:]):
        assert b["start"] >= a["start"]
        assert b["end"] >= b["start"]


def test_unrelated_audio_is_left_alone():
    """A script that does not match the audio means something is wrong —
    relabelling would put the wrong words on screen with confident timings."""
    out = _relabel(_ASR, "completely different narration about quarterly revenue growth")
    assert [w["word"] for w in out] == [w["word"] for w in _ASR]


def test_missing_script_is_a_no_op():
    assert _relabel(_ASR, "") == _ASR
    assert _relabel(_ASR, None) == _ASR
    assert _relabel([], "anything") == []


def test_alignment_is_wired_into_the_whisper_path():
    assert "script_text=text" in _SRC, "_align_with_whisper must pass its text through"
    assert "script_text=script_text" in _SRC, "the Sarvam path must pass its script through"
    seg = _SRC[_SRC.index("def _whisper_align("):]
    seg = seg[:seg.index("\ndef ", 10)]
    assert "_relabel_words_from_script(word_entries, script_text)" in seg
