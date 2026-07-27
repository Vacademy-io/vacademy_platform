# Voice Bot Deep Review — 2026-07-27

Four independent adversarial reviews (state-machine/timing, provider/websocket vs the
actual pinned pipecat 0.0.95 source, pipeline frame semantics vs the 0.0.95 wheel, and
call lifecycle/reporting). ~30 findings, deduped and ranked below by client impact.
Cross-referenced against every live incident from 2026-07-20 → 27.

## A. LIVE-HURTING NOW (fix first)

| # | Finding | Mechanism | Live symptom |
|---|---------|-----------|--------------|
| A1 | **Transcript-dedupe eats meaningful repeats** (bot.py TranscriptCollector; 2 reviewers) | "haan"/"yes" to two different questions within 4s → second answer dropped; drop then satisfies the VAD-orphan test | Bot says "sorry, I couldn't hear you" to a caller who answered twice; answer lost |
| A2 | **Assistant-aggregator underflow after early barge-in** (pipecat 0.0.95 `_started` count goes to −1; verified in wheel) | Barge-in while LLM still streaming → orphan `LLMFullResponseEndFrame` decrements past zero → ALL later assistant text silently dropped from context until a healing event | Bot re-greets, re-asks answered questions, repeats verbatim — the conversation-level failures we tried to prompt-fix |
| A3 | **Report analyzer judges text the caller never heard** (SentinelGate commits at generation, not playout; nudges/farewells/fillers never recorded; 2 reviewers) | outcome.transcript ≠ what played | Wrong dispositions (live `Wrong_Number` on a caller who heard nothing); wrong summaries; auto-booking off unheard "agreements" |
| A4 | **Response tail swallowed: text sent AFTER the flush command** (stock 0.0.95 Sarvam TTS ordering; made frequent by ClauseFlushAggregator) | Short unpunctuated tail sits in Sarvam's server buffer until next turn/discard | Last words of a reply never play, or splice onto the next reply |
| A5 | **"Deaf-call guard" is dead code** (base run_stt swallows send errors; exception never escapes) | ResilientSarvamSTTService reconnect can only fire on initial-connect failure | Mid-call STT socket death still = permanently deaf call (the original 617-error incident is still possible) + ~50 log-lines/sec flood |
| A6 | **Transfer path breaks its promise** (3 reviewers) | Failed handoff registration still stops the call; partial `<<TRANSF` marker (max_tokens cut) maps to END; `_register_handoff` = blocking 10s HTTP inside a frame handler; sentinel stop path never arms the graceful-stop deadline | "Connecting you now" → dead line; human-requested callers hung up on; dead air pre-bridge; zombie drains |
| A7 | **Farewell barge-in → silent hangup or zombie** (2 reviewers) | Barge-in cancels farewell audio AND drains the queued EndFrame; stop branch never re-queues | "Disconnected without proper closing" recurrence; or call keeps running until the 25s hard-cancel mid-conversation |
| A8 | **Synthetic "Hmm." backchannel pollution** (2 reviewers) | Empty final can precede the real final (double generation); prompt rule 7 reads "Hmm." as YES (phantom consent); synthetic turns recorded as real caller speech; re-arms orphan | Double replies; noise treated as consent to book; corrupted transcripts; orphan fires at silence |
| A9 | **Greet: callee-spoke-first check physically unsatisfiable** + LLM-path double-opening race | Finals can't arrive within the 0.8s window (dead code); on the cue path a pickup-hello final lands after cue queued but before audio → second opening | Opening talks over callers; double/triple greeting reproduced at pipeline level (not just prompts) |
| A10 | **Noisy-line nudge loop** | VAD blips clear `nudged` and reset idle clock; escalation unreachable | "Are you still there?" dozens of times; up to 10 min of billed dead air |
| A11 | **One-word answers deleted while bot speaks** (pipecat min-words path resets aggregation; BotStopped lags 0.35s+) | "haan" during bot audio recorded in transcript but never reaches LLM | Rule 7 promises haan=YES; pipeline deletes that word; nudge after caller answered |

## B. LATENT / GUARDED

| # | Finding | Status |
|---|---------|--------|
| B1 | Stall-recovery stamp still broken (3 reviewers, identical mechanism) | Disabled via STALL_RECOVERY_ENABLED=false. MUST fix stamp (never stamp while speaking; clear on BotStopped + UserStarted) + serialize TTS connect/disconnect under a lock before re-enabling. Watchdog's forced private `_disconnect/_connect` races 3 concurrent connect drivers → server-side socket leaks (plausible contributor to the first-byte stalls themselves) |
| B2 | Odia agents: `od-IN` vs pipecat enum `or-IN` → ValueError → blanket except discards ALL InputParams (language pin + high_vad_sensitivity) | Silent; fix tag + narrow the except |
| B3 | ClauseFlushAggregator no-space path flushes whole buffer / can split Devanagari clusters; `rfind(", ")` dead code | Rare but guaranteed-bad audio |
| B4 | Unauthenticated /ws + no handshake timeout → 10-slot pinning DoS; guessed-corr live session; /tts unbounded disk cache | Security/abuse |
| B5 | Reports lost on transient admin_core failure (2 attempts, no backoff/spool); crashes reported as `no-answer` (dispo corruption + redial storms — happened in today's incident); answered-but-silent = "no-answer"; synthetic Hmm. = "completed" | Reporting integrity |
| B6 | Per-call Vertex construction does synchronous SA OAuth on the event loop | ~1–3s of the 5.7s setup + garbles audio on OTHER concurrent calls during refresh. Pre-warm: module-level credentials singleton + lifespan refresh; never share pipecat service instances |
| B7 | Teardown gaps: pipeline task not cancelled if runner.run raises; `_greet_when_ready` untracked; `watchdog_task.cancel()` never awaited (dead watchdog silently disables cap/idle = unbounded spend); per-call AsyncSarvamAI never closed | Slow leak pressure on a 2GB box |

## C. VERIFIED CORRECT (don't churn)

Orphan discriminator (`usta > transcript_t`); watchdog snapshot consistency; filler
arming semantics; marker hold-back across token chunks (post-sentinel text is
marker-free); TTS `_connect` done-task clearing; run_tts wrapper cancellation
semantics; `TranscriptionFrame(language=None)`; STT has no base reconnect to fight.

## D. Plan (agreed shape: root cause → discuss → fix, harness before risky changes)

- **Wave 1 (small, high-confidence, each tied to a live symptom):** A1 dedupe scope
  (require bot hasn't spoken since last accepted transcript + stamp transcript_t on
  drop), A4 tail re-flush after response-end, B2 Odia tag + narrowed except, A6a
  partial-marker→transfer + failed-handoff fallback speech + async handoff, A7
  re-issue stop_when_done every ~3s while stopping, A9a greet VAD-gating, A10
  transcript-gated nudge + max-nudge cap, A8a debounce synthetic backchannel + make
  its text non-consent + tag as synthetic.
- **Wave 2 (harness first):** call-timeline test harness encoding EVERY finding above
  as a scripted-timeline test; state-machine refactor (flags → explicit CallState);
  then A2 sentinel End-shield, A3 played-text transcript commit, B1 stall recovery
  re-enable (fixed + locked), A5 real deaf-call detection.
- **Wave 3 (infra/security):** B4 WS HMAC token + handshake timeout + cache cap,
  B5 report spool/backoff + crash status, B6 Vertex pre-warm, B7 teardown fixes.
