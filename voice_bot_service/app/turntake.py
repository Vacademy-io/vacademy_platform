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
# Match on FRAGMENTS, not whole sentences. Live evidence (call 14029bd6): Sarvam
# rendered "…after the tone" as the complete final "Add the tone." — chasing
# exact operator wording loses to the STT every time, so these are the short
# distinctive pieces that survive a mis-hear.
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
    # Fragments — see the note above. Only ever consulted inside the
    # answering-machine window at the very start of a call.
    # Sarvam splits the SAME operator sentence at different points on different
    # calls, so match the pieces, not the sentence. Live evidence 2026-08-06:
    # one call produced 'Your call has been forwarded to voicemail.' (matched)
    # and the next produced 'Your call.' then 'Has been forwarded to voicemail.'
    # — the first fragment matched nothing, counted as the callee, and killed
    # our opening before the second fragment could arm anything.
    "your call", "been forwarded", "forwarded to", "record your", "leave a",
    "the person you", "trying to reach",
    "the tone", "the beep", "voicemail", "voice mail", "record your message",
    "record your messages", "recording", "hang up", "leave a message",
    "leave your message", "not available", "unavailable", "please try again",
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


def suppresses_opening(text: str, min_words: int = 4) -> bool:
    """Should this caller utterance make us SKIP our scripted opening?

    Only something substantive should. The greet gate used to skip on ANY
    transcript, so a single stray word decided it — and on a voicemail the
    stray words are the operator's own recording arriving in fragments
    ('Hi.', 'Your call.', 'If you record your'). Three calls on 2026-08-06 lost
    their opening that way, and the model improvised a replacement, which is how
    one of them delivered its introduction twice.

    A caller who genuinely opens with "who is this, why are you calling me" is
    substantive and still takes over. "Hello?" is not.
    """
    t = (text or "").strip()
    if not t or is_carrier_announcement(t) or is_audio_check(t):
        return False
    return len(_words(t)) >= min_words


# ── saying the same thing twice ────────────────────────────────────────────
# FOUR prompt-level attempts failed to stop this, each measured over 3+ live
# conversations: style rules in the system prompt (1.7 -> 1.7 repeats, and it
# broke script and gender), no-echo rules with GALAT/SAHI examples in the script
# (3.0 -> 3.0 echoes), removing the scripted acknowledgement lines the model was
# parroting (2.7 -> 2.7), and swapping the model (helps, 1.0 -> 0.3, but the
# founder reverted for latency). The prompt is ~16k characters; it is saturated.
#
# What actually repeats is not the pitch — it is the bot's OWN CLOSING
# QUESTIONS: "kya aap fees ke baare mein jaanna chahenge?" and "kya main is
# WhatsApp number par link bhej doon?", asked again several turns later, because
# nothing tracks which questions have already been put to the caller. That is
# state, and state belongs in code.
_ASK_AGAIN_WORDS = frozenset({
    "repeat", "again", "dobara", "phir", "dubara", "samajh", "sunai", "sunayi",
    "kya", "pardon", "sorry", "दोबारा", "फिर", "समझ", "सुनाई",
})


def caller_asked_to_repeat(text: str) -> bool:
    """Did the caller ASK us to say it again? Then repeating is correct."""
    ws = set(_words(text))
    if not ws:
        return False
    return bool(ws & {"repeat", "dobara", "dubara", "दोबारा"}) or (
        len(ws) <= 5 and bool(ws & {"phir", "फिर", "samajh", "समझ", "sunai", "सुनाई"}))


def is_repeat(sentence: str, spoken, threshold: float = 0.80) -> bool:
    """Has this sentence already been said, in these words or near enough?

    Fuzzy on purpose: the model re-renders its own question slightly differently
    every time ("Kya aap iski fees ke baare mein jaanna chahenge" vs "chahengi"),
    and an exact match would catch none of the real cases.

    Short fragments are never repeats — "haan", "theek hai", "achha" legitimately
    recur, and suppressing them would strip the bot of every acknowledgement.

    COST. This is called for every sentence of every reply, on a 1-vCPU box
    carrying up to ten concurrent calls, and ``spoken`` grows for the whole call.
    A full ratio() against each entry measured 10 ms per sentence at 150 spoken
    sentences and 29 ms at 400 — in the audio path, per sentence. So: hold seq2
    fixed (SequenceMatcher caches its index for b, and rebuilding it per entry
    was most of the cost) and screen with real_quick_ratio/quick_ratio, which are
    UPPER BOUNDS on ratio() — skipping below the threshold cannot change a single
    answer, it only skips work that could not have qualified.
    """
    import difflib
    t = " ".join((sentence or "").split()).casefold()
    if len(t) < 22:
        return False
    # autojunk left at its default on purpose: changing it changes ratio() itself,
    # and this optimisation must be answer-for-answer identical to what shipped.
    sm = difflib.SequenceMatcher(None, "", t)
    for prev in spoken or ():
        sm.set_seq1(prev)
        if sm.real_quick_ratio() < threshold or sm.quick_ratio() < threshold:
            continue
        if sm.ratio() >= threshold:
            return True
    return False


def normalize_spoken(sentence: str) -> str:
    return " ".join((sentence or "").split()).casefold()


# ── asking the same QUESTION twice, in different words ─────────────────────
# Sentence similarity catches a re-rendered sentence but not a paraphrase. Live
# call 597aeb3f asked for the class twice — "Aur wo abhi kis class mein hai?"
# then "Raman abhi kis class mein padh raha hai?" — which score about 0.6
# against each other and sailed through a 0.80 gate.
#
# A counselling call asks a FIXED, SMALL set of questions, so the robust key is
# not the wording but the SUBJECT: name, class, marks, weak subject, fees, the
# quiz link, the counselling slot. Ask about the same subject twice and it is a
# repeat however it is phrased.
_QUESTION_TOPICS = (
    ("child_name", ("naam", "नाम", "name")),
    ("klass", ("class", "क्लास", "kaksha", "कक्षा", "grade")),
    ("marks", ("marks", "मार्क्स", "score", "स्कोर", "percent", "परसेंट", "%")),
    ("weak_subject", ("subject", "सब्जेक्ट", "dikkat", "दिक्कत", "weak", "kamzor")),
    ("fees", ("fees", "फीस", "fee", "price", "cost", "kitni hai")),
    ("quiz_link", ("link", "लिंक", "quiz", "क्विज़", "whatsapp", "व्हाट्सएप")),
    ("counselling", ("counselling", "counseling", "काउंसलिंग", "session", "सेशन",
                     "slot", "book kar")),
    ("program_more", ("aur jaanna", "और जानना", "baare mein aur", "और बताना")),
)


# ── parroting the caller's own answer back at them ─────────────────────────
# Founder, 2026-08-12, after a live Shiksha Nation call: "every time the person
# answers, the AI again says okay. It asked how many marks, the person said
# ninety-four, and it comes back 'okay, you got ninety-four'. There is no need to
# reconfirm every time. It looks like an AI if you reconfirm everything."
#
# Three consecutive turns on that call opened with a restatement:
#   "अच्छा है सुबोध, तो सुबोध अभी कौन से क्लास में है?"
#   "ओके, सुबोध अभी आठवीं क्लास में है, तो … कितने मार्क्स आए थे?"
#   "सुबोध के लास्ट बहुत अच्छे, तिरानवे प्रतिशत मार्क्स, बहुत बढ़िया स्कोर है।"
#
# WHY IN CODE, not the prompt. This is the same class NoRepeatGate exists for,
# and the four measured prompt-only attempts recorded above (including no-echo
# rules with GALAT/SAHI examples: 3.0 -> 3.0) are exactly this experiment. A
# prompt rule ships alongside as a second line of defence; this is the first.
#
# CLAUSE level, not sentence level, because the parroting and the real question
# share one sentence — dropping the sentence would drop the question with it.
# What survives is anything the bot ADDED: "बहुत बढ़िया स्कोर है।" is a human
# reaction and stays; "तिरानवे प्रतिशत मार्क्स" is the caller's own words and goes.
_CLAUSE_SEP = ",;—–"

# Words that carry no answer content, so a clause made only of these plus the
# caller's own words is pure parroting. Deliberately function words only — a
# content word the caller did NOT say means the bot is adding something.
_ECHO_STOPWORDS = frozenset({
    "अभी", "में", "मे", "है", "हैं", "हूँ", "हूं", "था", "थी", "थे", "का", "की", "के",
    "को", "से", "पर", "ही", "भी", "और", "तो", "यह", "ये", "वो", "वह", "कि", "जी",
    "कर", "हो", "आप", "आपके", "आपका", "आपकी", "मैं", "उनका", "उनकी", "उनके", "उसका",
    "उसकी", "उसके", "इसका", "इसकी", "इसके",
    "is", "are", "was", "were", "the", "a", "an", "in", "at", "of", "to", "for",
    "and", "so", "has", "have", "had", "you", "your", "i", "it", "its", "that",
    "this", "he", "she", "his", "her", "their", "got", "get", "with", "on",
})
# Leading connectives left dangling once the parroting in front of them is gone.
_LEADING_CONNECTORS = frozenset({"तो", "और", "अब", "so", "and", "then", "now", "ok",
                                 "okay", "ओके"})
# Interrogatives, for "was the caller ASKING?" — reflecting a QUESTION back before
# answering it is wanted behaviour (it is a prompt rule), and must survive this.
_QUESTION_CUES = frozenset({
    "क्या", "कितना", "कितनी", "कितने", "कैसे", "कैसा", "क्यों", "कब", "कहाँ", "कहां",
    "कौन", "कौनसा", "किस", "kya", "kitna", "kitni", "kitne", "kaise", "kaisa",
    "kyun", "kyon", "kab", "kahan", "kaun", "what", "how", "why", "when", "where",
    "which", "who", "whom", "can", "could", "do", "does", "did", "will", "would",
})


def caller_asked_a_question(text: str) -> bool:
    """Was the caller's last turn a QUESTION rather than an answer?

    Reflecting a question back ("अच्छा, आप timing को लेकर पूछ रहे हैं —") is a
    prompt rule and good practice; parroting an ANSWER back is what the founder
    flagged. Sarvam does not reliably punctuate, so cues as well as '?'.
    """
    t = (text or "").strip()
    if not t:
        return False
    if "?" in t or "？" in t:
        return True
    return bool(set(_words(t)) & _QUESTION_CUES)


def strip_echo_opener(sentence: str, caller_text: str, bot_question: str = "",
                      max_clauses: int = 2, echo_ratio: float = 0.6) -> str:
    """PURE. Drop leading clauses that only repeat what the caller just said.

    Returns the trimmed sentence, or the sentence unchanged when there is nothing
    safe to drop. NEVER returns empty, and never drops:
      * a clause containing a question (that IS the next step),
      * a clause with two or more digit groups (a phone number / date read-back
        is required behaviour, see the CLOSE CONCRETELY prompt rule),
      * anything at all when the caller was ASKING rather than answering,
      * the last remaining clause, or a tail too thin to stand alone.

    A clause is parroting when nearly all of its CONTENT words (function words and
    acknowledgments removed) already appear in the caller's answer or in the bot's
    own question — i.e. it introduces nothing.
    """
    import re

    text = (sentence or "").strip()
    if not text or not (caller_text or "").strip():
        return sentence
    if caller_asked_a_question(caller_text):
        return sentence
    # Split on clause punctuation, keeping the separators so nothing is glued.
    clauses: list = []
    buf = ""
    for p in re.split(f"([{re.escape(_CLAUSE_SEP)}])", text):
        if p in _CLAUSE_SEP:
            clauses.append(buf)
            buf = ""
        else:
            buf += p
    clauses.append(buf)
    clauses = [c for c in clauses if c.strip()]
    if len(clauses) < 2:
        return sentence

    reference = set(_words(caller_text)) | set(_words(bot_question))
    acks = _BACKCHANNEL_WORDS
    dropped = 0
    while dropped < max_clauses and len(clauses) - dropped >= 2:
        clause = clauses[dropped]
        ws = _words(clause)
        if not ws:
            dropped += 1
            continue
        if "?" in clause or "？" in clause:
            break
        if len(ws) > 10:
            break                       # too much said to be a bare restatement
        if len(re.findall(r"\d+", clause)) >= 2:
            break                       # a read-back we are required to do
        content = [w for w in ws if w not in acks and w not in _ECHO_STOPWORDS]
        if not content:
            dropped += 1                # pure acknowledgment ("ओके")
            continue
        overlap = sum(1 for w in content if w in reference)
        if overlap >= max(1, int(round(echo_ratio * len(content)))):
            dropped += 1
            continue
        break

    if not dropped:
        return sentence
    tail = clauses[dropped:]
    # Shed a connective the parroting used to hang off ("…, तो <question>").
    head_words = _words(tail[0])
    if head_words and head_words[0] in _LEADING_CONNECTORS:
        first = tail[0].strip()
        tail = [first.split(None, 1)[1] if " " in first else first, *tail[1:]]
    out = ", ".join(t.strip() for t in tail if t.strip()).strip()
    # A tail that cannot stand on its own is worse than the parroting.
    if len(_words(out)) < 3 and "?" not in out:
        return sentence
    if out[:1].islower() and text[:1].isupper():
        out = out[0].upper() + out[1:]
    return out or sentence


def question_topic(sentence: str):
    """Which of our standard questions is this, if any? None = not one of them.

    Only classifies actual QUESTIONS — a statement that merely mentions fees is
    not the fees question, and suppressing it would gut the pitch.
    """
    t = " ".join((sentence or "").split()).casefold()
    if not t or ("?" not in t and "？" not in t):
        return None
    for topic, cues in _QUESTION_TOPICS:
        if any(c in t for c in cues):
            return topic
    return None
