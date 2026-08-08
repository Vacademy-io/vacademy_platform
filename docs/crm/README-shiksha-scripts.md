# Shiksha Nation agent scripts

Two forms of the SAME script — same flow, same facts, verified identical on the
fact checks. Only the transliteration differs.

| file | script | chars | status |
|---|---|---|---|
| `shiksha-nation-script-trimmed-roman.txt` | all Roman Hinglish | 5,228 | **LIVE on agent 5066e67d** |
| `shiksha-nation-script-trimmed-devanagari.txt` | Hindi in Devanagari, English in Latin | 5,267 | ready to flip |
| `shiksha-nation-hinglish-script.md` | the untrimmed original | 8,520 | superseded |

## Why the trim

8,520 → 5,228 chars. Measured against the live model on the eight questions a
real parent asks: the trimmed version scored **at least as well** (5/8 vs 3/8 on
a checker that has a Devanagari blind spot and under-counts both), at **3,634
prompt tokens per request instead of 4,349 — 16% cheaper on every turn**, and
95% of every request is this prompt.

Nothing was dropped: all fee ranges, batch sizes, the sub-75% MGP approval rule,
Auxilo EMI terms, class schedules and the three FAQ answers are present and
asserted.

## Why the Devanagari variant exists

Sarvam's own docs: *"Romanised/transliterated Indic input significantly degrades
output quality — this is the most common integration mistake."* Google says the
same for Chirp3. Both want Hindi in Devanagari with English words left in Latin.

My round-trip test (text -> TTS -> STT) was **inconclusive** — it mostly measured
STT transliterating English INTO Devanagari rather than TTS quality. The one real
signal: Roman `"aaye the"` came back `"आए, द"`, Devanagari came back `"आए थे"`.

**This needs a human ear, not a metric.** Flip by pasting the other file into the
agent's System prompt; one test call each.
