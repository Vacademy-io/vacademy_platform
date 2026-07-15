# AI Call — Deep Review: Humanness, Latency & Practicality

**Scope:** the Vacademy AI voice agent (`voice_bot_service/`, Pipecat + Sarvam, Mumbai-anchored) over Plivo `<Stream>` telephony. Reviewed 2026-07-14 against live code + 12 research streams (latency, turn-taking, humanness, and an STT/TTS provider bake-off). Companion: [`VACADEMY_AI_AGENT.md`](./VACADEMY_AI_AGENT.md).

---

## TL;DR — the thesis

1. **Stay on the India-hosted Sarvam stack.** Every Western STT/TTS provider is *both* less accurate on Hindi *and* slower from Mumbai (~215 ms trans-oceanic tax that swamps their better raw numbers). This is settled by benchmark data, not preference — see [Part 4](#part-4--provider-decision-the-evidence).
2. **The wins are in the pipeline and the prompt, not vendor swaps.** We already do most of the well-known latency basics; the remaining gains are specific and cheap.
3. **The three highest-leverage untapped changes:**
   - **Output code-mixed Devanagari, not romanized Hinglish** — Sarvam's own docs say fully-romanized input *"significantly reduces output quality."* This is likely our biggest naturalness lever and it's a prompt change.
   - **Bulbul pronunciation dictionary (`dict_id`)** — pins brand names + acronyms. This is the real fix for "Vacademy → Vacancy" (a TTS grapheme-to-phoneme miss, not the LLM).
   - **Smart Turn v3 endpointing** (~12 ms CPU) — cut the fixed silence-wait without clipping the caller.

---

## Part 0 — What's already good (don't touch)

Credit where due — the pipeline already implements several things teams commonly get wrong:

| Already done | Why it matters |
|---|---|
| `agg_timeout = 0.2s` (vs Pipecat's notorious `1.0s` default) | Saves ~700 ms/turn — the single most common Pipecat latency bug, already fixed |
| **8 kHz end-to-end** (`audio_in/out_sample_rate=8000`, TTS at 8 kHz) | No resampling; matches Plivo's native μ-law |
| `enable_metrics=True` | Per-service TTFB is measured — we can tune against real numbers |
| `allow_interruptions=True` | Barge-in works |
| **Mumbai anchoring** | Attacks the biggest fixed cost (PSTN transport, 200–700 ms) and keeps Sarvam calls in-country |
| Filler acknowledgments ("Hmm…/Achha…") | Perceived-latency mask (but see [§2.4](#24-fix-the-filler-strategy) — currently mis-tuned) |
| Gender-agreement + आप/जी honorifics in the prompt | Correct Hindi register (a common robotic tell when wrong) |
| `pace = 1.1` | Exactly Sarvam's own recommendation for "brisk, professional" |
| STT language pin (`hi-IN`), temp `0.35`, IDENTITY LOCK | Just shipped — stops language drift + name drift |

**Measured reference:** a Pipecat + telephony turn is ~**1,050 ms** voice-to-voice before deeper optimization, of which ~480 ms is pure network/serialization overhead. Human turn-taking gap is ~200 ms; the production bar is **p95 ≤ 800 ms** on phone (>1.2 s "feels like a legacy IVR"). **Note:** the "0.14 s" figure that appears in our code comments is Sarvam's *STT*, not the LLM — the sarvam-105b **LLM** is likely the largest stage; measure it (see [§P0 caching](#p0--trim--cache-the-system-prompt) and [Part 3 LLM](#llm-the-real-latency-sink--and-the-in-india-gemini-option-changes-the-earlier-call)).

---

## Part 1 — Latency plan

Per-stage budget and where we stand:

| Stage | Optimized target | Our status |
|---|---|---|
| Endpointing (silence wait) | 200–400 ms | ⚠️ `stop_secs=0.5` fixed — **biggest remaining lever** |
| STT finalization | 100–200 ms | ✅ saarika streaming (Sarvam claims <150 ms TTFT) |
| LLM TTFT | 200–400 ms | ⚠️ **likely our biggest stage** (sarvam-105b, ~2 s in reasoning mode; we disable thinking so should be far less — **but unmeasured**); the 10.7 K-char prompt inflates it |
| TTS first-audio | 40–250 ms | ⚠️ verify streaming mode + buffer tuning |
| Network/transport | 50–150 ms | ✅ Mumbai-anchored |

### P0 — Smart Turn v3 endpointing (the biggest remaining win)
A fixed `stop_secs` is added to **every** turn: too high = dead air, too low = clip the caller mid-sentence. **Pipecat Smart Turn v3** is a semantic model (Whisper-tiny backbone, 8 MB, **~12 ms CPU inference**, 23 languages, bundled ONNX — no download) that decides whether a pause is *actually* end-of-turn from the raw waveform (intonation, pace, fillers), not silence alone.
- **Action:** add `LocalSmartTurnAnalyzerV3` + drop Silero `stop_secs` to `0.2`.
- **Expected:** replaces a fixed ~500 ms wait with intelligent detection; ~9.9% false-cutoff at a 300 ms budget. Also a *humanness* win (kills the "walkie-talkie" feel).
- **Risk:** low — 12 ms CPU cost is negligible on our box; keep Silero VAD alongside (required).

### P0 — Trim + cache the system prompt
sarvam-105b's TTFT grows with prompt size (prefill is ~O(n²)); ~800 extra tokens can ~2× TTFT. Our Aarushi prompt is **10,755 chars (~2,700 tokens)** — that's real latency on every turn.
- **Action:** (a) tighten the agent prompt (the biggest agents ramble); (b) **check whether Sarvam's OpenAI-compatible endpoint supports prompt/prefix caching** — if yes, cache the fixed system prefix (published gains: 50–85% TTFT reduction). If not, it's a strong feature request to Sarvam.
- **Expected:** 100–400 ms/turn depending on caching support.
- **Risk:** low; don't trim the IDENTITY LOCK or the non-negotiable rules.

### P1 — Confirm TTS is streaming first-audio, tune the buffer
Pipecat's Sarvam TTS WebSocket exposes `min_buffer_size` (default **50 chars** before synthesis starts) and `max_chunk_length` (150). Sarvam bulbul streams first-byte in ~250 ms / audio starts 300–400 ms (independent test). **We should verify we're on the WebSocket streaming path (not batch HTTP)** and that the first clause fires ASAP.
- **Note on TOKEN vs SENTENCE mode:** streaming *tokens* straight to TTS is fastest (~200 ms) but flattens prosody (the TTS can't plan intonation across an unseen sentence). **Sentence/clause mode is the right default for a sales agent** — keep cohesive prosody, just make sure the *first* sentence fires immediately while the rest generates. Do **not** split sub-sentence (choppy).
- **Expected:** 200–500 ms if we're currently sentence-buffering the whole reply.

### P2 — Warm persistent WebSockets to Sarvam STT + TTS
Cold TCP+TLS per turn is ~40–100 ms each; over a 10-turn call that's ~450 ms hidden. Persistent multiplexed WebSocket recovers it.

### P2 — Use `enable_metrics` output to find *our* actual bottleneck
We already emit per-service TTFB. **Pull it from a few real calls and tune against the measured breakdown** rather than theory — the reference call showed ~480 ms was *overhead*, not AI services.

---

## Part 2 — Humanness plan

The agent config is good (10.7 K-char persona, correct name/brand); the gains are in *how* it speaks and *how it takes turns*.

### 2.1 — Output code-mixed Devanagari, NOT romanized Hinglish (highest-impact)
Sarvam's Bulbul docs are explicit: **transliterated/romanized input (`"Aapka order confirm ho gaya hai"`) significantly reduces TTS quality.** The correct format is **Hindi words in Devanagari + English business terms in Latin**: `"आपका order confirm हो गया है"`. sarvam-105b natively emits Devanagari code-mix, so this is a **prompt instruction**, not new infra.
- **Action:** add a hard output-format rule: *"Write Hindi words in Devanagari script and keep common English business words (confirm, book, demo, WhatsApp, offer, plan…) in English. NEVER romanize Hindi words into Latin letters."*
- **Expected:** materially cleaner, less "robotic" Hindi pronunciation — the single most common mistake in Hinglish TTS.
- **Watch:** don't force English brand words *into* Devanagari (distorts them) — that's what the pronunciation dictionary is for (next).

### 2.2 — Bulbul pronunciation dictionary — the real fix for "Vacademy → Vacancy"
The name/brand mangling is a **TTS grapheme-to-phoneme miss** on a coined English word, not the LLM. Bulbul v3 supports a **Pronunciation Dictionary**: upload JSON (`word → spoken form`), get a `dict_id`, pass it on every TTS call. Docs examples: `"Sarvam":"Saar-vum"`, `"EMI":"ई एम आई"`, `"HDFC":"H D F C"`.
- **Action:** create a per-institute `dict_id` with the brand name + any acronyms (e.g. `"Vacademy":"वेकैडमी"` or a sounds-like spelling), and thread it through `SarvamTTSService`.
- **Expected:** the company/product name is pronounced identically every time. Pairs with the IDENTITY LOCK (which fixes the *text*) to fix the *audio*.
- **Note:** verify our Pipecat version actually forwards the dict (some plugins historically didn't).

### 2.3 — Add an interruption strategy (stop killing the bot on every sound)
We run `allow_interruptions=True` with **no strategy** → *any* detected sound (a cough, "haan", background voice) cancels the bot mid-sentence. Add `MinWordsInterruptionStrategy(min_words=2–3)` so short backchannels/noise don't interrupt, but a real correction does. Applies only while the bot speaks.
- **Expected:** big realism gain; stops the bot getting derailed by the caller's "haan/hmm".
- **Risk:** too high a `min_words` delays legitimate interrupts — 2–3 is the sweet spot.

### 2.4 — Fix the filler strategy
Measured result (CUI 2025, controlled study): verbal fillers help perceived latency **only when the wait is long (>4 s)**; at **low latency (<1.5 s) a "hmm, let me think" before a fast answer reads as fake.** We run `filler_probability=0.7` **unconditionally** — if our turns are ~1 s, this is likely *hurting* naturalness.
- **Action:** either (a) gate fillers behind an expected-latency signal (only when the LLM is genuinely slow / a tool call is running), or (b) drop probability substantially and make them **content-bearing** ("ek second, dekhti hoon…" > bare "Hmm…"). Cap disfluency at 2–4 per turn.

### 2.5 — Conversation-design upgrades (prompt-level)
The prompt already enforces 1–2 sentences + one question (good). Add:
- **Variety rule** — a rotating bank of acknowledgments ("haan", "achha", "theek hai", "samajh gayi") so it never repeats the same confirmation twice (repetition is the #1 cumulative robotic tell).
- **Reflect-back** — acknowledge the caller's *specific* point before answering ("teen din se ye ho raha hai — main abhi sort karti hoon"), not a generic "I understand."
- **Energy matching** — crisp callers get efficiency, chatty callers get engagement.
- **Natural ASR-recovery phrasing** — already present ("aapki awaaz clear nahi aayi"); keep it, never system-speak.
- **Implicit confirmation** — fold captured values into the next line ("theek hai, Nikita ji, aapke liye…") instead of "aapne Nikita bola, sahi hai?" every field.

### 2.6 — Number/time/money handling
Already handled in-prompt (English 12-hour clock, spoken-word numbers, digit-by-digit phone). For deterministic control, **Sarvam's Transliteration API `spoken_form:true`** converts `₹200 → "दो सौ रुपये"`, `9:30am → "साढ़े नौ बजे"` before TTS — optional hardening if numbers still mis-read.

### 2.7 — Backchannels ("haan" while the caller speaks) — **defer**
Measured to raise naturalness, but it's *overlapping* audio that stresses echo-cancellation hard: without solid **server-side AEC**, the bot transcribes its own backchannel and talks to itself. **Do not enable until AEC is verified on the Plivo path.** Higher risk than reward right now.

---

## Part 3 — Model / provider decision (the evidence)

### STT: stay on Sarvam saarika — it's best *and* nearest
"Voice of India" benchmark (arXiv 2604.19151, 306 K utterances, 14 systems), **Hindi WER**:

| Provider | Hindi WER | Hosting |
|---|---|---|
| **Sarvam Audio** | **5.0%** | 🇮🇳 India |
| Gemini 3 Pro | 6.0% | 🇺🇸 global |
| **Saarika 2.5 (ours)** | **6.2%** | 🇮🇳 India |
| ElevenLabs Scribe v2 | 7.7% | 🇺🇸 US |
| Azure Speech | 11.4% | 🇮🇳 Central India region exists |
| Deepgram Nova-3 | 13.0% | 🇺🇸 US |
| AssemblyAI | 19.3% | 🇺🇸 US/EU |
| GPT-4o Transcribe | 33.9% | 🇺🇸 US |

**The India-hosting tax is real and provider-published:** Mumbai↔US-East RTT is ~216–219 ms, *added on top of* each provider's advertised model latency. So a "150 ms" US STT delivers ~350 ms from India; a "300 ms" one approaches ~500 ms+. Sarvam (India-hosted, Yotta H100) pays **zero** cross-border tax. **Verdict: switching STT would be worse on both accuracy and latency.**

### TTS: stay on Bulbul v3
India-hosted, native Hinglish/code-switch in one pass, `pace`+`temperature` control, and the pronunciation dictionary ([§2.2](#22--bulbul-pronunciation-dictionary--the-real-fix-for-vacademy--vacancy)). No SSML anywhere in Sarvam — prosody is `pace`/`temperature` + text segmentation only. (We could tune `temperature` up slightly from the ~0.6 default for warmth.)

### LLM: the real latency sink — and the in-India Gemini option changes the earlier call
**Correction (important):** the "~0.14 s TTFT" figure is **Sarvam's STT** (Saaras Fast mode), *not* the LLM. Independent measurement puts **sarvam-105b LLM TTFT at ~2 s** (reasoning mode); Sarvam's own voice SLA target is only P95 < 1000 ms. Our config disables thinking (`reasoning_effort=null`), which should be far faster than the 2 s reasoning-mode number — but **we have not measured our real LLM TTFB.** The LLM is the most likely bottleneck, not STT/TTS. → **Do action #10 first: pull `enable_metrics` LLM TTFB from real calls.**

**The Gemini objection was based on a wrong assumption.** "Gemini adds latency" is true for Google's *global* endpoint (US-served). But **Vertex AI runs Gemini in `asia-south1` (Mumbai)** — `gemini-2.5-flash-lite` there is ~**0.37 s model TTFT with near-zero network RTT**, comfortably inside the voice budget *and* better instruction-following than sarvam-105b. This is a genuine both-worlds option — the catch is it needs switching from the current `generativelanguage.googleapis.com` (global) endpoint to a **Vertex AI regional (`asia-south1`) integration**, not a config flip.
- **Recommendation:** measure our real sarvam-105b TTFB first (#10). If it's the bottleneck, **A/B Gemini 2.5 Flash-Lite via Vertex asia-south1** (in-India → no latency penalty, better instruction-following) and **Sarvam-30B** (cheaper/faster than 105B, best Hindi) as the two contenders. Keep sarvam-105b as the safe default until measured.

### STT model: consider `saaras:v3` (mode=transcribe / codemix) as a test — not a blind switch
`saarika:v2.5` is now legacy; Sarvam's current STT is `saaras:v3` with a `mode` param (`transcribe` = native script, `codemix` = keep English words in English). `saaras:v3` is India-hosted, telephony-tuned, and Pipecat's default. **We deliberately moved off `saaras` earlier because it was *translating* and garbling Hinglish** — but that was the *translate* mode; `saaras:v3` `mode=transcribe`/`codemix` may actually beat `saarika:v2.5`. Worth a **side-by-side test on our own call audio** (there's a known Pipecat bug #3770 on `saaras:v3` mode handling — verify). Do not switch blind. Note: Sarvam STT returns **final-only transcripts (no interim)** — true barge-in on partials isn't possible on any India-hosted STT.

### Fallbacks worth knowing (do not switch now)
- **Azure Speech, Central India (Pune)** — the *only* Western provider with a true in-India region (~single-digit ms from Mumbai). But continuous language-ID is **segment-level, not within-sentence**, so weaker on true Hinglish. Reasonable disaster-recovery option if Sarvam has an outage.
- **Gnani Prisma v2.5 / Reverie** — India-hosted, telephony-first, claim strong Hinglish (Gnani: 9% Hinglish WER, <300 ms — self-reported). Credible alternates *if* Sarvam underperforms on our real audio; all benchmarks are vendor self-reported, so trust only a bake-off on our own calls.

---

## Part 4 — Prioritized action plan

| # | Change | Layer | Effort | Impact | Risk |
|---|---|---|---|---|---|
| 1 | **Code-mixed Devanagari output** (not romanized) | Prompt | S | 🟢🟢🟢 naturalness | Low |
| 2 | **Bulbul pronunciation dict** (brand + acronyms) | TTS config | M | 🟢🟢🟢 fixes name/brand audio | Low (verify plugin forwards it) |
| 3 | **`MinWordsInterruptionStrategy(2–3)`** | Pipeline | S | 🟢🟢 stops mid-sentence kills | Low |
| 4 | **Smart Turn v3** + `stop_secs=0.2` | Pipeline | M | 🟢🟢 latency + turn realism | Low |
| 5 | **Fix filler gating** (latency-gated / content-bearing) | Config+code | S | 🟢🟢 removes fake pauses | Low |
| 6 | **Trim prompt + check Sarvam prompt caching** | Prompt/infra | M | 🟢🟢 TTFT | Low |
| 7 | **Variety + reflect-back + energy-match** rules | Prompt | S | 🟢🟢 less robotic | Low |
| 8 | **Confirm WS-streaming TTS + tune `min_buffer_size`** | TTS config | M | 🟢 first-audio latency | Low |
| 9 | Warm persistent Sarvam WebSockets | Infra | M | 🟢 ~450 ms/10-turn | Med |
| 10 | Pull `enable_metrics` from real calls → tune to measured budget | Ops | S | 🟢 targets the real bottleneck | Low |
| — | Backchannels ("haan" while listening) | Pipeline | L | 🟢🟢 *if* done right | **High — needs AEC first** |

**Suggested first batch (all low-risk, high-leverage, one deploy):** #1, #3, #5, #7 (prompt + pipeline tweaks) → then #2 + #4 (dict + Smart Turn) → then measure with #10 and decide on #6/#8/#9.

---

## Part 5 — What NOT to do

- ❌ **Don't switch STT/TTS to a Western provider** (Deepgram/AssemblyAI/OpenAI/ElevenLabs) — worse Hindi WER *and* +215 ms India tax. Confirmed by benchmark, not opinion.
- ❌ **Don't route the LLM through a US/global endpoint** (Google `generativelanguage.googleapis.com`, OpenAI, Groq) — ~5× the TTFT from Mumbai. **But** Gemini via **Vertex AI `asia-south1` (Mumbai)** is in-India and fair game — that's the recommended A/B, see Part 4.
- ❌ **Don't romanize the Hindi output** — measurably degrades Bulbul.
- ❌ **Don't blindly switch TTS to TOKEN mode** — faster first-audio but flat prosody; sentence/clause is right for a sales voice.
- ❌ **Don't enable backchannels before verifying server-side AEC** — the bot will transcribe itself.
- ❌ **Don't over-fill** — >4 disfluencies/turn or fillers before fast answers read as fake.

---

## Sources (key)
- Voice of India ASR benchmark — arXiv 2604.19151
- Pipecat Smart Turn v3 — daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms
- Pipecat aggregation/latency — github.com/pipecat-ai/pipecat/issues/1319; docs.pipecat.ai/server/pipeline/pipeline-params
- Filler evidence (CUI 2025) — arXiv 2507.22352
- Turn-taking / barge-in — livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection
- Sarvam Bulbul (Devanagari, pronunciation dict, pace) — docs.sarvam.ai/api/getting-started/models/bulbul.md; docs.sarvam.ai/api/building-for-india.md
- India network tax — latency.bluegoat.net (AWS inter-region); developers.deepgram.com/docs/measuring-streaming-latency
- Conversation design — docs.vapi.ai/prompting-guide; docs.livekit.io/agents/start/prompting; developers.openai.com/cookbook/examples/realtime_prompting_guide
