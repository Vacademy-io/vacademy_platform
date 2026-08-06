"""PURE mid-reply turn-taking decisions (the "duck" path).

Why this exists: with pipecat 0.0.95's MinWordsInterruptionStrategy, a caller
who speaks while the bot is talking is only acted on after their WHOLE turn
ends (utterance + VAD stop + STT final + aggregation wait ≈ 2.5-4s of the bot
talking over them), and a turn under the word minimum is silently DISCARDED —
the ANSWER_DELETED fault on 67% of the last 30 days' calls, and the founder's
"the bot takes ages to stop" complaint. Both are one mechanism.

The fix (founder-approved 2026-08-05, "absorb but never lose"): DuckGate in
bot.py pauses the bot's audio ~instantly at VAD onset; when the transcript
arrives, THIS module decides what the utterance was:

  ABSORB    — a bare acknowledgment ("haan", "achha", "theek hai"): the held
              reply resumes mid-sentence and the words are appended to the LLM
              context WITHOUT a generation, so consent said mid-pitch still
              counts. The aggregator never sees the turn, so it cannot delete
              it and cannot run the LLM on it.
  INTERRUPT — anything else (a question, a negation, a real answer like
              "IGCSE"): the reply is formally interrupted and the words become
              a normal turn.

PURE by the callstate.py/diagnostics.py rule: no pipecat imports, no I/O, no
clock — the test table drives every word list decision, and word-list changes
are reviewable as data.
"""
from __future__ import annotations

ABSORB = "absorb"
INTERRUPT = "interrupt"

# Affirmative acknowledgments and audio-checks. NOT here, deliberately:
#   * negations ("nahi", "no") — an objection must stop the pitch;
#   * content words — one-word answers ("IGCSE", "Monday") are real turns.
#
# "hello" USED to be excluded here, on the reasoning that a caller saying hello
# mid-reply has lost the audio and interrupting is the only honest response.
# Call 77cb4b47 (2026-08-06) disproved that. Interrupting does not restore their
# audio — it cancels the sentence, and the model then re-asks the SAME question
# from the top. The founder heard the first second of "Shreyash ji, main pooch
# raha tha ki Raman ke last annual exam mein kitne marks aaye the?" four times
# in eleven seconds, said "आपकी आवाज़ कट हो रही है बार-बार", and the loop was
# self-feeding: cut -> caller says "hello?" -> cut -> caller says "hello?".
# Absorbing lets the held reply RESUME, so the caller finally hears the rest of
# the sentence they were asking for. That is the only outcome that ends the loop.
# Devanagari and romanized forms both listed: saaras/saarika emit either script
# depending on model + mode, and the caller doesn't get to choose which.
_BACKCHANNEL_WORDS = frozenset({
    # Devanagari
    "हाँ", "हां", "हा", "हूँ", "हूं", "हम", "हम्म", "जी", "हाँजी", "हांजी",
    "अच्छा", "अच्छे", "अछा", "ठीक", "है", "ओके", "सही", "बिल्कुल", "बिलकुल",
    "बढ़िया", "बढिया", "बहुत",
    "बोलिए", "बोलो", "बताइए", "बताओ", "सर", "मैम", "मैडम", "भैया", "ओ", "के",
    # Romanized Hindi / Hinglish
    "haan", "haa", "han", "ha", "hn", "hm", "hmm", "hmmm", "mm", "mhm", "mhmm",
    "ji", "jee", "jii", "achha", "accha", "acha", "achcha", "thik", "theek",
    "hai", "sahi", "bilkul", "badhiya", "badiya", "bahut", "boliye", "bolo",
    "bataiye", "batao",
    "sir", "sar", "madam", "mam", "maam", "bhaiya",
    # English
    "ok", "okay", "okey", "kk", "yes", "yeah", "yah", "ya", "yup", "yep",
    # Audio-checks: "are you there / can you hear me". A resumed sentence
    # answers these; a cancelled-and-restarted one does not.
    "hello", "helo", "hallo", "hlo", "hey", "हेलो", "हैलो", "हलो",
    "right", "correct", "sure", "fine", "good", "great", "cool", "alright",
    "go", "on", "ahead", "continue", "carry",
})

# Any of these ANYWHERE in the utterance forces INTERRUPT even if every other
# word is an acknowledgment — "haan nahi" is an objection, not consent.
_NEGATION_WORDS = frozenset({
    "नहीं", "नही", "ना", "मत", "नो",
    "nahi", "nahin", "nhi", "na", "no", "not", "dont", "don't", "stop",
    "mat", "but", "lekin", "लेकिन", "पर", "magar", "मगर",
})

# Punctuation stripped before matching — includes the Devanagari danda, which
# Sarvam appends to almost every final ("हाँ।").
_STRIP = "।॥.,!…\"'`~()[]{}:;-–—"


def _words(text: str) -> list:
    out = []
    for raw in (text or "").split():
        w = raw.strip(_STRIP).casefold()
        if w:
            out.append(w)
    return out


def mid_reply_action(text: str, extra_backchannels: frozenset = frozenset(),
                     max_words: int = 3) -> str:
    """Classify a caller final that arrived while the bot's reply is ducked.

    ABSORB only when EVERY word is a known acknowledgment, the utterance is
    short, and nothing negates or questions. Anything uncertain INTERRUPTS —
    wrongly stopping the bot costs a moment; wrongly steamrolling the caller
    costs the call (that asymmetry is the whole point of the fix).
    """
    t = (text or "").strip()
    if not t:
        return ABSORB          # nothing was said; nothing to interrupt for
    if "?" in t or "？" in t:
        return INTERRUPT       # a question mid-reply means they didn't follow
    ws = _words(t)
    if not ws or len(ws) > max_words:
        return INTERRUPT
    vocab = _BACKCHANNEL_WORDS | extra_backchannels
    for w in ws:
        if w in _NEGATION_WORDS:
            return INTERRUPT
        if w not in vocab:
            return INTERRUPT
    return ABSORB


# ── carrier announcements ──────────────────────────────────────────────────
# The network, not a person. On call 77cb4b47 the operator played "Your call has
# been forwarded to voicemail. The person you're trying to reach is not
# available." BEFORE the founder picked up, and the bot treated it as the callee
# speaking. Three things went wrong at once, all from that one mis-read:
#   * the scripted opening was SKIPPED ("callee spoke first"), so the call began
#     with silence and the founder said "hello?" twice into it;
#   * it counted as a barge-in, cancelling the reply that was starting;
#   * worst, it became the FIRST USER MESSAGE and stayed in the LLM context for
#     the whole 2.5-minute call — every single generation for the rest of the
#     call was conditioned on being told it had reached a voicemail box.
#
# Substring match on lowercased text, so partial finals ("...forwarded to
# voicemai") still match. Kept deliberately narrow: these are fixed operator
# recordings, and a human saying one of these sentences on a sales call is not a
# thing that happens.
_CARRIER_PHRASES = (
    # English (Airtel / Jio / Vi / BSNL + generic)
    "forwarded to voicemail", "call has been forwarded", "leave a message after",
    "after the tone", "after the beep", "record your message",
    "the person you're trying to reach", "the person you are trying to reach",
    "is not available", "is currently busy", "the number you have dialled",
    "the number you have dialed", "the subscriber you have dialled",
    "the subscriber you have dialed", "is switched off", "out of coverage",
    "please try again later", "call cannot be completed", "temporarily out of service",
    "is unreachable", "not reachable", "incoming call facility",
    # Hindi
    "आप जिस नंबर", "डायल किया गया नंबर", "उपलब्ध नहीं", "स्विच ऑफ",
    "थोड़ी देर बाद", "व्यस्त है", "संपर्क क्षेत्र", "कृपया बाद में",
)


def is_carrier_announcement(text: str) -> bool:
    """True when a transcript is the OPERATOR's recorded message, not the callee.

    Callers of this must not feed the text to the LLM, must not let it count as
    "the callee spoke first", and must not let it interrupt the bot — but SHOULD
    still keep it in the call transcript, because the answering-machine detector
    reads exactly these markers to raise LIKELY_MACHINE.
    """
    t = (text or "").casefold()
    if not t.strip():
        return False
    return any(p in t for p in _CARRIER_PHRASES)


# ── audio-checks ───────────────────────────────────────────────────────────
# "hello?" mid-reply is its own thing: not consent to carry on (a backchannel)
# and not a new question, but the caller checking whether the line is alive.
# It gets absorbed like a backchannel, but the CALLER'S SECOND one in a row
# means the first response did not work and repeating the sentence again will
# not either — see TranscriptCollector, which switches to a short "can you hear
# me?" and then stops talking.
_AUDIO_CHECK_WORDS = frozenset({
    "hello", "helo", "hallo", "hlo", "hey", "हेलो", "हैलो", "हलो",
})


def is_audio_check(text: str, max_words: int = 3) -> bool:
    """True for a bare "hello?"-style line-check (in any of our scripts)."""
    ws = _words(text)
    if not ws or len(ws) > max_words:
        return False
    return any(w in _AUDIO_CHECK_WORDS for w in ws)
