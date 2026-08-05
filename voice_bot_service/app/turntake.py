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

# Affirmative acknowledgments only. NOT here, deliberately:
#   * negations ("nahi", "no") — an objection must stop the pitch;
#   * "hello"/"haan?" — a caller saying hello mid-reply has LOST the audio and
#     interrupting is the only honest response;
#   * content words — one-word answers ("IGCSE", "Monday") are real turns.
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
