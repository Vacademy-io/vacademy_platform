"""Tests for the per-call technical diagnostics (app/diagnostics.py).

Pure module, no pipecat — driven directly like the callstate harness. Each
verdict test encodes one of the founder-flagged 2026-07 calls, so the panel can
never silently stop naming the fault that call actually had.
"""
import app.diagnostics as dg


# ── the fault vocabulary is a STORED contract ────────────────────────────────

def test_fault_codes_are_frozen_and_append_only():
    """Renaming a code silently breaks every row already persisted, and every
    saved filter. Adding is fine; changing/removing must fail here."""
    assert set(dg.ALL_FAULTS) >= {
        "CRASH", "TTS_WEDGE", "REPLY_UNPLAYED", "ANSWER_DELETED", "DEAD_AIR",
        "FALSE_REASK", "LIKELY_MACHINE", "STT_DEAF", "SLOW_TTS", "SLOW_LLM",
        "TRANSFER_FAILED", "PROMPT_UNFILLED",
    }
    assert len(set(dg.ALL_FAULTS)) == len(dg.ALL_FAULTS)   # no duplicates
    assert set(dg.HEADLINE_PRIORITY) == set(dg.ALL_FAULTS)  # priority is total
    for code in dg.ALL_FAULTS:
        assert code in dg._HEADLINE_TEXT, f"{code} has no human-readable headline"


def test_clean_call_is_green_with_no_faults():
    d = dg.CallDiagnostics(user_turns=6, bot_turns=6, replies_generated=6)
    v = dg.verdict(d)
    assert v["health"] == dg.GREEN
    assert v["faults"] == {} and v["headline"] is None


# ── the founder's call 19 (Kyoto): TTS wedge -> 10.4s dead air ───────────────

def test_kyoto_call_is_red_tts_wedge():
    d = dg.CallDiagnostics(
        tts_wedges=3, tts_wedge_reconnects=3, tts_stalls=3,
        tts_silent_generations=3, user_turns=7, bot_turns=7,
    )
    d.sample("dead_air", 10.39)
    d.sample("dead_air", 8.11)
    v = dg.verdict(d)
    assert v["health"] == dg.RED
    assert v["headline"] == dg.TTS_WEDGE          # outranks DEAD_AIR
    assert v["faults"][dg.DEAD_AIR] == dg.RED     # …but both are reported
    p = dg.to_payload(d)
    assert p["tts"]["stalls"] == 3
    assert p["latency"]["deadAirMax"] == 10.39
    assert "Voice synthesis stalled" in p["headlineText"]


# ── the founder's call 20 (Nia): announcement generated, never played ────────

def test_unplayed_reply_is_flagged():
    d = dg.CallDiagnostics(replies_generated=4, replies_never_played=2,
                           user_turns=3, bot_turns=2)
    v = dg.verdict(d)
    assert v["health"] == dg.RED and v["headline"] == dg.REPLY_UNPLAYED


# ── "answers need to be repeated" ───────────────────────────────────────────

def test_deleted_answers_named_not_just_counted():
    d = dg.CallDiagnostics(user_turns=5, bot_turns=5)
    for ans in ("IGCSE", "Symbiosis.", "Monday."):
        d.note_deleted_answer(ans)
    v = dg.verdict(d)
    assert v["health"] == dg.RED and v["headline"] == dg.ANSWER_DELETED
    p = dg.to_payload(d)
    assert p["turnTaking"]["answersDeleted"] == 3
    assert "IGCSE" in p["turnTaking"]["answersDeletedSamples"]
    assert p["turnTaking"]["answersDeletedSrc"] == "measured"


def test_unmeasured_answers_are_null_never_zero():
    """The single most important honesty rule: 'we did not check' must never
    render as 'we checked and it was fine'."""
    d = dg.CallDiagnostics(user_turns=4, bot_turns=4)
    assert d.answers_deleted is None
    v = dg.verdict(d)
    assert dg.ANSWER_DELETED not in v["faults"]      # cannot fire when unknown
    p = dg.to_payload(d)
    assert p["turnTaking"]["answersDeleted"] is None
    assert p["turnTaking"]["answersDeletedSrc"] is None


# ── the 72% false re-asks ───────────────────────────────────────────────────

def test_false_reasks_flagged_and_true_reasks_are_not():
    d = dg.CallDiagnostics(orphan_reasks=4, orphan_false_reasks=3)
    assert dg.verdict(d)["faults"][dg.FALSE_REASK] == dg.RED
    honest = dg.CallDiagnostics(orphan_reasks=2, orphan_false_reasks=0)
    assert dg.FALSE_REASK not in dg.verdict(honest)["faults"]


# ── voicemail: evidence only, never a disposition change in v1 ──────────────

def test_machine_score_and_amber():
    d = dg.CallDiagnostics(user_turns=1, bot_turns=3, longest_user_secs=9.0,
                           machine_markers=["forwarded to voicemail"])
    assert dg.machine_score(d) >= 0.7
    v = dg.verdict(d)
    assert dg.LIKELY_MACHINE in v["faults"]
    assert dg.to_payload(d)["machine"]["src"] == "inferred"


def test_human_call_is_not_flagged_as_machine():
    d = dg.CallDiagnostics(user_turns=8, bot_turns=8, longest_user_secs=2.5,
                           barge_ins=2)
    assert dg.machine_score(d) < 0.5
    assert dg.LIKELY_MACHINE not in dg.verdict(d)["faults"]


# ── latency needs a sample floor before it accuses anyone ───────────────────

def test_slow_faults_require_enough_samples():
    d = dg.CallDiagnostics()
    for _ in range(3):
        d.sample("tts_ttfb", 9.0)          # awful, but only 3 samples
    assert dg.SLOW_TTS not in dg.verdict(d)["faults"]
    for _ in range(5):
        d.sample("tts_ttfb", 9.0)
    assert dg.verdict(d)["faults"][dg.SLOW_TTS] == dg.RED


def test_prompt_unfilled_is_amber_never_red():
    d = dg.CallDiagnostics(user_turns=5, bot_turns=5)
    d.note_unfilled("child_name")
    v = dg.verdict(d)
    assert v["faults"][dg.PROMPT_UNFILLED] == dg.AMBER
    assert v["health"] == dg.AMBER          # a config bug never reads as breakage


def test_crash_always_red_and_outranks_everything():
    d = dg.CallDiagnostics(crash="RuntimeError: boom", tts_stalls=3)
    v = dg.verdict(d)
    assert v["health"] == dg.RED and v["headline"] == dg.CRASH


# ── bounds + totality: this runs on a 1-vCPU box during live calls ──────────

def test_reservoirs_and_lists_are_bounded():
    d = dg.CallDiagnostics()
    for i in range(5000):
        d.sample("dead_air", i * 0.001)
        d.note_unfilled(f"k{i}")
        d.note_deleted_answer("x" * 200)
    assert len(d.dead_air) <= dg._MAX_SAMPLES
    assert len(d.prompt_unfilled) <= dg._MAX_UNFILLED_KEYS
    assert len(d.answers_deleted_samples) <= dg._MAX_DELETED_ANSWERS
    assert d.answers_deleted == 5000                  # counted, not stored
    assert all(len(x) <= 60 for x in d.answers_deleted_samples)


def test_hooks_never_raise_on_bad_input():
    d = dg.CallDiagnostics()
    d.bump("does_not_exist")
    d.sample("does_not_exist", 1.0)
    d.sample("dead_air", "not-a-number")
    d.note_unfilled(None)
    assert isinstance(dg.to_payload(d), dict)


def test_to_payload_is_total_even_on_corrupt_state():
    d = dg.CallDiagnostics()
    d.tts_ttfb = "corrupt"                            # type: ignore[assignment]
    p = dg.to_payload(d)
    assert isinstance(p, dict) and "rulesVersion" in p


def test_payload_is_json_serialisable_and_small():
    import json
    d = dg.CallDiagnostics(user_turns=9, bot_turns=9, tts_stalls=1)
    for i in range(300):
        d.sample("tts_ttfb", 0.2)
        d.sample("dead_air", 1.0)
    blob = json.dumps(dg.to_payload(d))
    assert len(blob) < 4096, f"diagnostics blob too fat: {len(blob)}B"


# ── slice 2: reconciliation — the ground truth for "answers need repeating" ──

def test_reconcile_names_the_deleted_answer():
    """The live shape: caller said IGCSE, the aggregator deleted it, the model
    never saw it, and the bot carried on as if nothing was said."""
    heard = ["Yes", "IGCSE", "Symbiosis."]
    delivered = ["Yes", "Symbiosis."]          # IGCSE never reached the model
    n, samples = dg.reconcile_answers(heard, delivered)
    assert n == 1 and samples == ["IGCSE"]


def test_reconcile_is_punctuation_and_case_insensitive():
    n, _ = dg.reconcile_answers(["SSC."], ["ssc"])
    assert n == 0, "a formatting difference must not read as a deleted answer"


def test_reconcile_multiset_handles_genuine_repeats():
    # Caller said it twice, model got it once -> exactly one was lost.
    n, samples = dg.reconcile_answers(["SSC.", "SSC."], ["SSC."])
    assert n == 1 and samples == ["SSC."]
    # Both delivered -> nothing lost.
    assert dg.reconcile_answers(["SSC.", "SSC."], ["SSC.", "ssc"])[0] == 0


def test_reconcile_clean_call_reports_zero_not_none():
    n, samples = dg.reconcile_answers(["CBSE", "DPS"], ["CBSE", "DPS"])
    assert n == 0 and samples == []


def test_reconcile_ignores_empty_and_whitespace():
    n, _ = dg.reconcile_answers(["", "   ", "CBSE"], ["CBSE"])
    assert n == 0


def test_reconciled_count_drives_the_fault():
    d = dg.CallDiagnostics(user_turns=5, bot_turns=5)
    n, samples = dg.reconcile_answers(["IGCSE", "Symbiosis.", "Monday."], [])
    d.answers_deleted, d.answers_deleted_samples = n, samples
    v = dg.verdict(d)
    assert v["health"] == dg.RED and v["headline"] == dg.ANSWER_DELETED
    assert dg.to_payload(d)["turnTaking"]["answersDeletedSrc"] == "measured"


# ── REGRESSION 2026-08-03: a false SLOW_TTS on the founder's own call ────────
# "ResilientSarvamSTTService".lower() CONTAINS the substring "tts"
# (...sarvams-TTS-ervice), so routing that tested "tts" before "stt" filed every
# STT latency into the TTS reservoir. The panel's first live call reported
# SLOW_TTS while the real TTS times were all ~0.2s.

def test_ttfb_routing_discriminates_stt_from_tts():
    import inspect
    import app.bot as b
    src = inspect.getsource(b.TtfbObserver)
    body = src[src.index("proc = (d.processor"):]
    body = body[:body.index("except Exception")] if "except Exception" in body else body
    assert body.index('"stt" in proc') < body.index('"tts" in proc'), (
        "stt must be tested BEFORE tts: the STT class name contains 'tts'"
    )
    # And prove the discrimination on the real class names.
    stt = "ResilientSarvamSTTService#0".lower()
    tts = "ResilientSarvamTTSService#0".lower()
    assert "tts" in stt and "stt" in stt      # the trap
    assert "stt" not in tts                   # …which ordering resolves cleanly
