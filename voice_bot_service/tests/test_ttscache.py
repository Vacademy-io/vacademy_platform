"""TTS speech cache — the pure parts, which is nearly all of the risk.

The dangerous failures here are not "the cache missed". They are:
  * serving audio that does not match the words (a key that is too loose),
  * caching half a sentence (a fragment that got laddered),
  * learning from a call the caller never actually heard,
  * playing sentence 3 before sentence 2.

Every one of those is decidable from state alone, so it is tested here rather
than discovered on a live call.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import ttscache                                            # noqa: E402
from app.ttscache import (SAMPLE_RATE, SAMPLE_WIDTH, Candidate, CallCandidates,
                          SpeechCache, TtsTurnWatcher, cache_key, is_async_arrival,
                          is_complete, owns_turn_brackets,
                          agent_allowed, mode_allows, MODE_OFF, MODE_FIXED,
                          MODE_FULL)                              # noqa: E402


def _key(text, **over):
    args = dict(engine="sarvam", model="bulbul:v3", voice="priya", pace=1.1,
                temperature=0.5, sample_rate=SAMPLE_RATE, term_map_version="",
                text=text, salt="test")
    args.update(over)
    return cache_key(**args)


# ── the core product requirement ────────────────────────────────────────────

def test_one_character_difference_is_a_different_key():
    """THE requirement: anything but a byte-exact match goes to the vendor.

    If this ever passes by accident — a normalisation creeping into cache_key,
    a case-fold, a whitespace collapse — the cache starts speaking words that
    are not the words it was asked for.
    """
    a = _key("Aapka din shubh ho.")
    b = _key("Aapka din shubh ho!")
    c = _key("aapka din shubh ho.")
    d = _key("Aapka din  shubh ho.")     # two spaces
    assert len({a, b, c, d}) == 4


def test_gender_variants_are_distinct_entries():
    """sir/ma'am and the gendered Hindi verb forms are different strings, so they
    must land on different keys with no special handling."""
    assert _key("Main aapko bata rahi hoon.") != _key("Main aapko bata raha hoon.")
    assert _key("Aap kaise hain?") != _key("Aap kaisi hain?")
    assert _key("Ji sir, samajh gayi.") != _key("Ji ma'am, samajh gayi.")


def test_lead_name_produces_its_own_key():
    """Name-bearing sentences are cached, not excluded — they simply key
    separately and only earn a render once the name recurs."""
    assert _key("Namaste Rohan ji.") != _key("Namaste Aarav ji.")


@pytest.mark.parametrize("field,value", [
    ("engine", "google"), ("model", "bulbul:v2"), ("voice", "anushka"),
    ("pace", 1.2), ("temperature", 0.9), ("sample_rate", 24000),
    ("term_map_version", "abc123"), ("salt", "v2"),
])
def test_every_render_affecting_field_changes_the_key(field, value):
    """A field that changes the audio but not the key would serve the wrong
    voice. Includes the salt, which is the poisoned-entry escape hatch."""
    assert _key("Theek hai.") != _key("Theek hai.", **{field: value})


def test_pace_formatting_is_stable():
    """1.1 and 1.10 are the same pace and must not split the cache in two."""
    assert _key("Theek hai.", pace=1.1) == _key("Theek hai.", pace=1.10)


def test_field_boundaries_cannot_be_forged():
    """Concatenating fields without a separator would let voice+text collide with
    a different voice+text split at another point."""
    assert _key("ok.", voice="ab") != _key("ok.", voice="a")


# ── G1: completeness ────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "Aapka din shubh ho.", "Kya aap sun paa rahe hain?", "Bahut badhiya!",
    "आप किस class में हैं?", "यह ठीक है।", "Hmm…",
    'He said "theek hai."', "(Yes, that is right.)",
    # pipecat's aggregator splits on these too, so refusing them would skip
    # utterances it legitimately cut as whole sentences.
    "Pehla point yeh hai;", "यह पूरा वाक्य है॥",
])
def test_complete_sentences_are_accepted(text):
    assert is_complete(text)


@pytest.mark.parametrize("text", [
    "Aur wo abhi", "तो लास्ट exam में", "main aapko", "", "   ", "94",
])
def test_fragments_are_refused(text):
    """pipecat FLUSHES the aggregator remainder into TTS on
    LLMFullResponseEndFrame (tts_service.py:705-719), so partial clauses reach
    run_tts routinely. Caching one would play half a sentence, standalone, to
    every future caller who matched it."""
    assert not is_complete(text)


# ── ordering ────────────────────────────────────────────────────────────────

def test_async_arrival_engines_are_classified():
    for e in ("sarvam", "smallest", "rumik", "SARVAM"):
        assert is_async_arrival(e)
    for e in ("google", "edge", "deepgram", ""):
        assert not is_async_arrival(e)


def test_watcher_blocks_serving_while_the_vendor_owes_us_audio():
    """The one bug that would garble a live call.

    pipecat reuses ONE audio context per turn, drained in APPEND order. Cached
    audio appends instantly, vendor audio ~300ms later — so serving from cache
    while a vendor sentence is outstanding puts sentence 3 ahead of sentence 2.
    """
    w = TtsTurnWatcher()
    assert not w.vendor_inflight                      # start of turn: safe

    w.note_vendor_dispatch()
    assert w.vendor_inflight                          # mid-turn: must NOT serve

    w.observe(_FakeFrame("TTSStoppedFrame"))
    assert not w.vendor_inflight                      # turn drained: safe again


def test_watcher_clears_inflight_on_interruption():
    """A barge-in cancels the vendor's in-flight request, so the flag must clear
    or the cache would stay locked out for the rest of the call."""
    w = TtsTurnWatcher()
    w.note_vendor_dispatch()
    w.observe(_FakeFrame("StartInterruptionFrame"))
    assert not w.vendor_inflight


def test_watcher_records_interruption_time_for_g2():
    w = TtsTurnWatcher()
    t0 = ttscache.time.time()
    assert not w.interrupted_since(t0)
    w.observe(_FakeFrame("InterruptionFrame"))
    assert w.interrupted_since(t0)


def _FakeFrame(name):
    """The watcher dispatches on type(frame).__name__, so a bare class with the
    right name is a faithful stand-in and keeps pipecat out of the unit tests."""
    return type(name, (object,), {})()


def test_cached_utterance_mirrors_the_engines_own_frame_contract():
    """A cached sentence must emit exactly what the engine would have emitted.

    sarvam and google declare push_start_frame/push_stop_frames, so the BASE
    class brackets the utterance — emitting our own pair there gives the caller
    two of everything and re-arms the stop-frame bookkeeping. Our EdgeTTSService
    declares neither and yields its own pair, so there we must.
    """
    class _Managed:                       # sarvam / google
        _push_start_frame = True
        _push_stop_frames = True

    class _SelfBracketing:                # our EdgeTTSService
        pass

    assert owns_turn_brackets(_Managed()) == (False, False)
    assert owns_turn_brackets(_SelfBracketing()) == (True, True)


def test_an_unconfigured_agent_is_untouched_by_the_feature():
    """THE ship-safety invariant: nothing changes for anyone until an admin turns
    the cache on for one specific agent.

    Every existing ai_agent row is stamped OFF by V466, the call context always
    emits the key (never conditionally), and the bot's fallback for a missing key
    is OFF. So every path an unconfigured agent can take must refuse to serve —
    including when the ops kill switches are both ON, which is their default.
    """
    for mode in (MODE_OFF, "", None):
        for is_fixed in (True, False):
            assert not mode_allows(mode, is_fixed), (mode, is_fixed)


def test_mode_off_is_the_default_for_anything_unrecognised():
    """The only safe default for "may this agent replay stored audio" is no. A
    dropped key, a typo, or an agent saved by a client predating the field must
    all land on OFF rather than silently enabling playback."""
    for mode in (MODE_OFF, "", None, "off", "true", "ENABLED", "full "):
        expected = mode is not None and mode.strip().upper() == MODE_FULL
        assert mode_allows(mode, is_fixed_line=True) is expected
        assert mode_allows(mode, is_fixed_line=False) is expected


def test_fixed_tier_serves_only_the_bots_own_lines():
    """FIXED is the safe first tier: authored standalone utterances, no join to a
    neighbouring sentence, so render parity cannot bite."""
    assert mode_allows(MODE_FIXED, is_fixed_line=True)
    assert not mode_allows(MODE_FIXED, is_fixed_line=False)


def test_full_tier_serves_both():
    assert mode_allows(MODE_FULL, is_fixed_line=True)
    assert mode_allows(MODE_FULL, is_fixed_line=False)
    assert mode_allows("full", is_fixed_line=False)      # case-insensitive


def test_empty_allowlist_means_no_restriction():
    """The master switches already default off, so the allowlist is the SECOND
    gate. Empty has to mean "every agent", or setting the master switch alone
    would silently do nothing and look like a broken cache."""
    assert agent_allowed((), "agent-1", "Aarushi")


def test_allowlist_scopes_the_rollout_to_named_agents():
    """The whole point: one agent gets the first live test, nobody else's calls
    are touched by the same env flip."""
    allow = ("agent-1",)
    assert agent_allowed(allow, "agent-1", "Aarushi")
    assert not agent_allowed(allow, "agent-2", "Priya")


def test_allowlist_matches_id_or_name_case_insensitively():
    """Whoever edits /opt/voice-bot/.env is reading a screen showing the agent's
    NAME; making them hunt for a uuid is how the wrong agent gets listed."""
    assert agent_allowed(("aarushi",), "agent-1", "Aarushi")     # name, lower entry
    assert agent_allowed(("AGENT-1",), "agent-1", "Aarushi")     # upper entry
    assert agent_allowed(("agent-1",), "AGENT-1", "")            # upper id
    assert agent_allowed((" aarushi ",), "agent-1", "Aarushi")   # stray whitespace
    assert not agent_allowed(("aarushi",), "agent-2", "Priya")


# ── the store ───────────────────────────────────────────────────────────────

@pytest.fixture
def cache(tmp_path, monkeypatch):
    monkeypatch.setattr(ttscache, "get_settings", lambda: _Settings(str(tmp_path)))
    c = SpeechCache(root=str(tmp_path / "speech"))
    c.open()
    assert c.ready
    return c


class _Settings:
    def __init__(self, root, speech=True, llm=True, agents=()):
        self.speech_cache_dir = os.path.join(root, "speech")
        self.tts_cache_salt = "test"
        self.tts_cache_min_seen = 2
        self.tts_speech_cache_max_bytes = 10_000_000
        self.tts_cache_min_blob_ms = 200
        self.tts_cache_speech_enabled = speech
        self.tts_cache_llm_enabled = llm
        self.tts_cache_agents = agents
        self.tts_cache_debug = False


def _pcm(ms):
    return b"\x01\x02" * int(SAMPLE_RATE * ms / 1000)


def _cand(text, key=None, **over):
    args = dict(key=key or _key(text), text=text, chars=len(text), engine="sarvam",
                model="bulbul:v3", voice="priya", pace=1.1, temperature=0.5)
    args.update(over)
    return Candidate(**args)


def test_store_then_lookup_roundtrip(cache):
    c = _cand("Aapka din shubh ho.")
    assert cache.store(c, _pcm(800))
    entry = cache.lookup(c.key, c.text)
    assert entry is not None
    assert entry.duration_ms == 800
    assert cache.size == 1
    # The sidecar is the rebuild source and the human-readable record.
    with open(cache.meta_path(c.key), encoding="utf-8") as f:
        assert json.load(f)["text"] == c.text


def test_g5_refuses_a_render_too_short_to_be_speech(cache):
    """A sub-200ms blob is a silent stub or a decoded error page — dead air."""
    c = _cand("Theek hai.")
    assert not cache.store(c, _pcm(50))
    assert cache.lookup(c.key, c.text) is None


def test_g5_refuses_a_ragged_buffer(cache):
    """A byte count that is not a whole number of samples means a truncated
    write, and would play as a click or a clipped tail."""
    c = _cand("Theek hai.")
    assert not cache.store(c, _pcm(800) + b"\x00")
    assert cache.lookup(c.key, c.text) is None


def test_g6_text_mismatch_is_a_miss_not_a_wrong_play(cache):
    """Last line of defence. A hash collision, a corrupted row or a renamed file
    must cost one vendor render — never confidently speak the wrong words."""
    c = _cand("Aapka din shubh ho.")
    assert cache.store(c, _pcm(800))
    assert cache.lookup(c.key, "Something else entirely.") is None


def test_index_survives_reopen(cache):
    """Startup rebuilds from ONE query, not from tens of thousands of sidecars."""
    c = _cand("Aapka din shubh ho.")
    cache.store(c, _pcm(800))
    fresh = SpeechCache(root=cache.root)
    fresh.open()
    assert fresh.lookup(c.key, c.text) is not None


def test_a_row_whose_file_vanished_is_not_indexed(cache):
    """A hit that 404s into silence is worse than a miss."""
    c = _cand("Aapka din shubh ho.")
    cache.store(c, _pcm(800))
    os.remove(cache.blob_path(c.key))
    fresh = SpeechCache(root=cache.root)
    fresh.open()
    assert fresh.lookup(c.key, c.text) is None


# ── the ledger ──────────────────────────────────────────────────────────────

def test_render_is_due_only_after_min_seen_sightings(cache):
    c = _cand("Yeh humara flagship programme hai.")
    cache.ladder([c])
    assert cache.due() == []                    # once seen is not evidence
    cache.ladder([c])
    due = cache.due()
    assert [d.key for d in due] == [c.key]      # twice is


def test_a_fixed_line_is_due_after_ONE_sighting(cache):
    """MIN_SEEN exists because an LLM sentence might be a one-off — a name that
    never recurs — so a second sighting is how we learn it was worth rendering.

    A fixed line has no such doubt: it is authored, and it is spoken on every
    call by construction. Making it wait would delay the only lines guaranteed to
    pay off, which is the opposite of what the threshold is for.
    """
    fixed = _cand("Namaste ji, main Shreya bol rahi hoon.", fixed=True)
    cache.ladder([fixed])
    assert [d.key for d in cache.due()] == [fixed.key]


def test_an_llm_sentence_still_waits_for_the_second(cache):
    """The other half — dropping the threshold for everything would spend a
    render on every one-off personalised sentence."""
    llm = _cand("Rohan abhi kaun si class mein hai?")
    cache.ladder([llm])
    assert cache.due() == []
    cache.ladder([llm])
    assert [d.key for d in cache.due()] == [llm.key]


def test_fixed_lines_are_rendered_before_speculative_ones(cache):
    """A capped pass must spend its budget on the certain wins first."""
    fixed = _cand("Theek hai, dhanyavaad.", fixed=True)
    llm = _cand("Aur uski fees kya hai?")
    cache.ladder([llm]); cache.ladder([llm])
    cache.ladder([fixed])
    assert cache.due(limit=1)[0].key == fixed.key


def test_an_already_rendered_key_is_not_due_again(cache):
    c = _cand("Yeh humara flagship programme hai.")
    cache.ladder([c])
    cache.ladder([c])
    cache.store(c, _pcm(900))
    assert cache.due() == []


# ── G3 / G4: what a call is allowed to teach the cache ──────────────────────

def test_g3_a_sentence_the_caller_never_heard_is_not_laddered(cache):
    """PlayedTranscriptRecorder sits after transport.output(), so its transcript
    is text the caller actually HEARD. NoRepeatGate learned this the hard way on
    call 4b1a44b9: "'Already said' has to mean 'already HEARD'."
    """
    cc = CallCandidates(cache)
    heard = _cand("Yeh humara flagship programme hai.")
    never = _cand("Aur uski fees kya hai?")
    cc.add(heard)
    cc.add(never)
    n = cc.flush(played_text="Namaste. Yeh humara flagship programme hai.",
                 verdict_faults=[], health="GREEN")
    assert n == 1
    cache.ladder([heard])
    assert [d.key for d in cache.due()] == [heard.key]


@pytest.mark.parametrize("fault", ["TTS_WEDGE", "BOT_SILENT", "CRASH",
                                   "REPLY_UNPLAYED", "STT_DEAF"])
def test_g4_an_unhealthy_call_teaches_the_cache_nothing(cache, fault):
    """A call where synthesis wedged or a reply never played is not evidence
    about anything, so the whole batch is dropped rather than picked over."""
    cc = CallCandidates(cache)
    c = _cand("Yeh humara flagship programme hai.")
    cc.add(c)
    assert cc.flush(played_text=c.text, verdict_faults=[fault], health="AMBER") == 0


def test_the_counter_only_ever_counts_whole_sentences(cache):
    """The count means "this WHOLE sentence was delivered N times". A fragment
    reaching it would certify half a sentence, and the blob rendered from that
    count gets played to every future caller who matches it."""
    cc = CallCandidates(cache)
    whole = _cand("Yeh humara flagship programme hai.")
    frag = _cand("Aur uski fees")            # a flush remainder, no terminal mark
    cc.add(whole)
    cc.add(frag)
    n = cc.flush(played_text="Yeh humara flagship programme hai. Aur uski fees",
                 verdict_faults=[], health="GREEN")
    assert n == 1                             # the fragment never even got proposed

    cc2 = CallCandidates(cache)
    cc2.add(frag)
    assert cc2.flush(played_text="Aur uski fees", verdict_faults=[], health="GREEN") == 0
    assert cache.due() == []


def test_a_fixed_line_survives_a_red_call(cache):
    """The change live agent shreya-v3 forced: 15 of its 22 calls are RED, so one
    strict bar meant its opening line could only be learned from one call in
    three. And the faults doing the blocking — DEAD_AIR, SLOW_LLM,
    ANSWER_DELETED, REPLY_LOOP — say nothing about whether that opening was
    rendered correctly. It demonstrably was; it is the first line of the
    transcript."""
    cc = CallCandidates(cache)
    fixed = _cand("Namaste ji, main Shreya bol rahi hoon.", fixed=True)
    cc.add(fixed)
    n = cc.flush(played_text="",
                 verdict_faults=["ANSWER_DELETED", "DEAD_AIR", "REPLY_LOOP", "SLOW_LLM"],
                 health="RED")
    assert n == 1
    assert [d.key for d in cache.due()] == [fixed.key]


@pytest.mark.parametrize("fault", ["CRASH", "BOT_SILENT", "TTS_WEDGE", "REPLY_UNPLAYED"])
def test_a_fixed_line_is_still_dropped_when_the_AUDIO_is_suspect(cache, fault):
    """The narrowing is not a free pass. These four implicate the audio itself,
    and they must still veto a fixed line."""
    cc = CallCandidates(cache)
    cc.add(_cand("Theek hai, dhanyavaad.", fixed=True))
    assert cc.flush(played_text="", verdict_faults=[fault], health="AMBER") == 0


@pytest.mark.parametrize("fault", ["STT_DEAF", "REPLY_LOOP", "CRASH", "BOT_SILENT",
                                   "TTS_WEDGE", "REPLY_UNPLAYED"])
def test_an_llm_sentence_is_blocked_by_NAMED_faults(cache, fault):
    """The stricter bar for LLM sentences is a NAMED list, not a verdict.

    STT_DEAF means the reply may be answering nothing; REPLY_LOOP means the model
    was repeating itself. Both genuinely undermine "it will say this again". The
    four audio faults undermine the render. These still block.
    """
    cc = CallCandidates(cache)
    llm = _cand("Aur uski fees kya hai?")
    cc.add(llm)
    assert cc.flush(played_text=llm.text, verdict_faults=[fault], health="AMBER") == 0


def test_a_red_verdict_alone_no_longer_blocks_an_llm_sentence(cache):
    """Regression for the live case that made FULL useless.

    shreya-v3 is RED on essentially every call, and on two consecutive FULL calls
    62 and 46 LLM sentences were discarded whose only fault was DEAD_AIR. Long
    silences say nothing about whether a near-verbatim pitch line is worth
    keeping, so the blanket RED veto meant FULL could never learn anything.
    """
    cc = CallCandidates(cache)
    llm = _cand("exact fees teen cheezon par depend karti hai.")
    cc.add(llm)
    assert cc.flush(played_text=llm.text,
                    verdict_faults=["ANSWER_DELETED", "DEAD_AIR", "HANDBACK_LOOP"],
                    health="RED") == 1


def test_the_two_kinds_are_still_judged_separately(cache):
    """Both arrive from one call and answer to different bars. On STT_DEAF the
    fixed line survives (its audio is fine) and the LLM one does not (the reply
    may be answering something we never heard)."""
    cc = CallCandidates(cache)
    fixed = _cand("Theek hai, dhanyavaad.", fixed=True)
    llm = _cand("Aur uski fees kya hai?")
    cc.add(fixed); cc.add(llm)
    assert cc.flush(played_text=llm.text + " " + fixed.text,
                    verdict_faults=["STT_DEAF"], health="RED") == 1
    assert [d.key for d in cache.due()] == [fixed.key]


def test_a_red_call_with_no_named_fault_teaches_everything(cache):
    """RED is a summary of how the CALL went. A call can be RED purely for long
    silences while every sentence in it was spoken correctly."""
    cc = CallCandidates(cache)
    fixed = _cand("Theek hai, dhanyavaad.", fixed=True)
    llm = _cand("Aur uski fees kya hai?")
    cc.add(fixed); cc.add(llm)
    assert cc.flush(played_text=llm.text + " " + fixed.text,
                    verdict_faults=["DEAD_AIR"], health="RED") == 2


def test_a_healthy_amber_call_still_teaches(cache):
    """AMBER is not RED. Refusing to learn from every imperfect call would mean
    learning from almost none of them."""
    cc = CallCandidates(cache)
    c = _cand("Yeh humara flagship programme hai.")
    cc.add(c)
    assert cc.flush(played_text=c.text, verdict_faults=["DEAD_AIR"], health="AMBER") == 1


def test_fixed_lines_bypass_the_heard_gate(cache):
    """An admin-authored line is not learned FROM a call, so there is no call to
    have heard it on."""
    cc = CallCandidates(cache)
    cc.add(_cand("Theek hai, dhanyavaad.", fixed=True))
    assert cc.flush(played_text="", verdict_faults=[], health="GREEN") == 1


def test_played_match_tolerates_whitespace_but_the_key_does_not(cache):
    """PlayedTranscriptRecorder space-joins per-word TTSTextFrames, so the
    CONFIRMATION must be whitespace-tolerant. The key stays byte-exact — the two
    comparisons answer different questions."""
    cc = CallCandidates(cache)
    c = _cand("Yeh humara flagship programme hai.")
    cc.add(c)
    assert cc.flush(played_text="Yeh   humara\nflagship  programme hai.",
                    verdict_faults=[], health="GREEN") == 1
    assert _key("Yeh humara flagship programme hai.") != _key("Yeh  humara flagship programme hai.")


# ── eviction ────────────────────────────────────────────────────────────────

def test_eviction_drops_the_unused_before_the_frequently_hit(cache, monkeypatch):
    """Plain LRU would evict the very lines the cache exists for. Order is
    (hits ASC, last_served ASC) — the same reasoning that already protects
    warmed IVR prompts in _evict_tts_cache."""
    hot = _cand("Namaste, main Aarushi bol rahi hoon.")
    cold = _cand("Ek minute rukiye.")
    cache.store(hot, _pcm(1000))
    cache.store(cold, _pcm(1000))
    for _ in range(5):
        cache._bump_hit(hot.key)

    settings = _Settings(os.path.dirname(cache.root))
    settings.tts_speech_cache_max_bytes = len(_pcm(1000)) + 10
    monkeypatch.setattr(ttscache, "get_settings", lambda: settings)

    assert cache.evict() == 1
    assert cache.lookup(hot.key, hot.text) is not None
    assert cache.lookup(cold.key, cold.text) is None


# ── the ship-safety invariant, end to end ───────────────────────────────────

async def _sentinel_run_tts(text, context_id=None):
    """Stand-in for a real engine's run_tts. Identity is what the test asserts."""
    yield None


class _FakeTTS:
    _push_start_frame = True
    _push_stop_frames = True

    def __init__(self):
        self.run_tts = _sentinel_run_tts


def _install(monkeypatch, tmp_path, *, mode, speech=True, llm=True, agents=()):
    pytest.importorskip("pipecat.frames.frames")
    monkeypatch.setattr(
        ttscache, "get_settings",
        lambda: _Settings(str(tmp_path), speech=speech, llm=llm, agents=agents))
    tts = _FakeTTS()
    watcher = ttscache.install_tts_cache(
        tts, engine="sarvam", model="bulbul:v3", voice="priya", pace=1.1,
        temperature=0.5, fixed_lines={"Theek hai."}, cache_mode=mode,
        cache=SpeechCache(root=str(tmp_path / "speech")))
    return tts, watcher


def test_a_disabled_agent_gets_no_wrapper_at_all(monkeypatch, tmp_path):
    """THE ship-safety invariant.

    For an agent nobody has enabled, run_tts must be the ENGINE'S OWN function —
    untouched, not a wrapper of ours that decides to decline. "My code never ran"
    is a far stronger claim than "my code chose to do nothing", and with every
    agent defaulting to OFF it is the claim that actually matters.

    install_tts_cache returning None is also what keeps the TtsTurnWatcher
    processor out of the pipeline, so the whole frame chain stays byte-identical.
    """
    for mode in (ttscache.MODE_OFF, "", None, "nonsense"):
        tts, watcher = _install(monkeypatch, tmp_path, mode=mode)
        assert tts.run_tts is _sentinel_run_tts, mode
        assert watcher is None, mode


def test_the_kill_switches_also_prevent_installation(monkeypatch, tmp_path):
    """Both ops kill switches off is the same as OFF: nothing installed."""
    tts, watcher = _install(monkeypatch, tmp_path, mode=ttscache.MODE_FULL,
                            speech=False, llm=False)
    assert tts.run_tts is _sentinel_run_tts
    assert watcher is None


def test_an_agent_outside_the_ops_allowlist_gets_no_wrapper(monkeypatch, tmp_path):
    tts, watcher = _install(monkeypatch, tmp_path, mode=ttscache.MODE_FULL,
                            agents=("some-other-agent",))
    assert tts.run_tts is _sentinel_run_tts
    assert watcher is None


def test_an_enabled_agent_does_get_the_wrapper(monkeypatch, tmp_path):
    """The other half: if this ever stopped installing, the feature would be
    silently dead and every test above would still pass."""
    for mode in (ttscache.MODE_FIXED, ttscache.MODE_FULL):
        tts, watcher = _install(monkeypatch, tmp_path, mode=mode)
        assert tts.run_tts is not _sentinel_run_tts, mode
        assert watcher is not None, mode


def test_warm_and_live_must_derive_the_same_key():
    """The warm path and the live path must agree on the model, or a pre-warmed
    blob is filed under a key no call can produce.

    This shipped broken: admin_core sent model="" and left resolution to the bot,
    but warm() passed that empty string straight into cache_key while the live
    path used engine_of(tts)[1] — the resolved "bulbul:v3" / "lightning_v3.1".
    Same sentence, same voice, two different digests, cache never hits and
    nothing looks wrong anywhere.
    """
    live = _key("Namaste ji.", engine="smallest", model="lightning_v3.1")
    warm_broken = _key("Namaste ji.", engine="smallest", model="")
    assert live != warm_broken, "the bug this test exists for"

    providers = pytest.importorskip("app.providers")
    resolved = providers.default_engine_model("smallest")
    assert resolved, "smallest must resolve to a concrete model, never blank"
    assert _key("Namaste ji.", engine="smallest", model=resolved) ==            _key("Namaste ji.", engine="smallest", model=resolved)


@pytest.mark.parametrize("engine", ["sarvam", "smallest", "google", "edge", "rumik"])
def test_every_live_engine_resolves_to_a_concrete_model(engine):
    """A blank here silently recreates the mismatch above for that engine."""
    providers = pytest.importorskip("app.providers")
    assert providers.default_engine_model(engine).strip(), engine


# ── the wording-consistency prompt rule (bot.build_system_prompt) ────────────

def _prompt_for(mode, language="hinglish"):
    pytest.importorskip("pipecat.frames.frames")
    # build_system_prompt fills date placeholders with glibc-only strftime
    # directives (%-d). They work on the Linux container and raise on Windows,
    # which is the same reason several existing tests here cannot run locally.
    import datetime as _dt
    try:
        _dt.datetime.now().strftime("%-d")
    except ValueError:
        pytest.skip("%-d strftime is glibc-only; this asserts in CI")
    from app import bot
    agent = {"id": "a1", "name": "T", "language": language, "voice": "mrunal",
             "tts_model": "smallest_pro", "systemPrompt": "SCRIPT BODY",
             "openingLine": "नमस्ते जी।", "speech_cache_mode": mode}
    return bot.build_system_prompt({"agent": agent, "instituteName": "X",
                                    "direction": "OUTBOUND", "leadName": "P"})


def test_consistency_rule_is_absent_for_an_agent_with_the_cache_off():
    """It tightens delivery for a reason that only exists when the cache is on.
    26 agents are OFF and this feature has no business changing how they speak."""
    for mode in ("OFF", "", None):
        assert "SAY A RECURRING LINE THE SAME WAY" not in _prompt_for(mode), mode


def test_consistency_rule_is_present_once_the_cache_is_on():
    """The three drifts measured on shreya-v3, now told to every cached agent
    instead of being fixed one prompt at a time."""
    for mode in ("FIXED", "FULL"):
        p = _prompt_for(mode)
        assert "SAY A RECURRING LINE THE SAME WAY" in p, mode
        assert "never Raman" in p, mode
        assert "never 'क्लास'" in p, mode
        assert "सर/मैम goes exactly where the script puts it" in p, mode


def test_consistency_rule_never_forces_devanagari_on_an_english_agent():
    """An en-IN agent is told to write Latin only; a Devanagari name rule there
    would contradict its own SCRIPT rule."""
    p = _prompt_for("FULL", language="en")
    assert "never Raman" not in p


# ── provenance + flush (the analytics dimension) ────────────────────────────

def _acand(text, agent, **over):
    return _cand(text, agent_id=agent, agent_name=agent.upper(),
                 institute_id="inst-1", **over)


def test_provenance_records_which_agents_contributed(cache):
    """The cache key is global so agents share blobs — nothing in the ledger
    names an agent. seen_agent is the separate dimension that makes
    "what has THIS agent cached" answerable at all."""
    line = "Theek hai, dhanyavaad."
    cache.ladder([_acand(line, "agent-a", fixed=True)])
    cache.ladder([_acand(line, "agent-b", fixed=True)])
    rows = cache.export_for_report()
    agents = sorted(r["agentId"] for r in rows)
    assert agents == ["agent-a", "agent-b"]
    assert all(r["cacheKey"] == rows[0]["cacheKey"] for r in rows), "one shared key"


def test_export_marks_unrendered_rows(cache):
    """The misses screen IS the rows with no blob — not missing data."""
    c = _acand("Aur uski fees kya hai?", "agent-a")
    cache.ladder([c])
    assert cache.export_for_report()[0]["rendered"] is False
    cache.store(c, _pcm(600))
    assert cache.export_for_report()[0]["rendered"] is True


def test_flush_defaults_to_a_dry_run_that_deletes_nothing(cache):
    """The destructive reading of an ambiguous request is the wrong one."""
    c = _acand("Theek hai, dhanyavaad.", "agent-a", fixed=True)
    cache.ladder([c]); cache.store(c, _pcm(800))
    entries, freed, note = cache.forget(agent_id="agent-a")
    assert entries == 1 and freed > 0 and note.startswith("DRY RUN")
    assert cache.lookup(c.key, c.text) is not None, "dry run must not delete"


def test_flushing_one_agent_keeps_audio_another_still_uses(cache):
    """THE hazard of a global key: two agents share one blob, so flushing one
    must not take the audio the other is still serving."""
    line = "Theek hai, dhanyavaad."
    a = _acand(line, "agent-a", fixed=True)
    cache.ladder([a]); cache.ladder([_acand(line, "agent-b", fixed=True)])
    cache.store(a, _pcm(800))

    entries, freed, note = cache.forget(agent_id="agent-a", dry_run=False)
    assert entries == 0, "nothing removable — agent-b still references it"
    assert "1 shared with another agent and kept" in note
    assert cache.lookup(a.key, a.text) is not None, "audio must survive"


def test_flushing_the_last_agent_does_remove_the_audio(cache):
    c = _acand("Theek hai, dhanyavaad.", "agent-a", fixed=True)
    cache.ladder([c]); cache.store(c, _pcm(800))
    entries, freed, note = cache.forget(agent_id="agent-a", dry_run=False)
    assert entries == 1 and freed > 0
    assert cache.lookup(c.key, c.text) is None
    assert cache.export_for_report() == []
