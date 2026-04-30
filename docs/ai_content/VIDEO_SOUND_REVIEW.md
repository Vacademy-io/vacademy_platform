# Video Sound Effects — Audit & High-Impact Fix Plan

Scope: SFX cue planning and mixing for AI-generated videos. Pipeline side
[`sound_planner.py`](../../ai_service/app/ai-video-gen-main/sound_planner.py) /
[`sound_catalog.py`](../../ai_service/app/ai-video-gen-main/sound_catalog.py).
Player side
[`useSoundScheduler.ts`](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useSoundScheduler.ts).

Companion: [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md),
[AI_VIDEO_GENERATION.md §2.5](./AI_VIDEO_GENERATION.md#25-audio-tracks-background-music-sfx).

---

## 1. How a cue ends up in your ear

```
Director plan            Skill compose            Sound Planner
(shots, sync_points)  →  (HTML, audio_events)  →  (per-entry sound_cues)
                                                       │
                                                       ▼
                                  Timeline JSON  ─────────────────────►
                                  (entries[].sound_cues with absolute_time)
                                                       │
                                                       ▼
                                  useSoundScheduler (Howler one-shots)
                                                       │
                                                       ▼
                                  Web Audio destination (no shared bus,
                                  no narration ducking, no LUFS norm)
```

Three places where quality is decided:

1. **Selection** — which file, which role (`sound_catalog.py`).
2. **Placement** — *when* relative to the cut, the reveal, the word
   (`sound_planner.py`).
3. **Mixing** — how loud, how it sits against narration & music
   (`useSoundScheduler.ts`).

The current implementation is competent at #1, weakest at #2 and #3.

---

## 2. Why current SFX feel "not at the right points"

### 2.1 Timing bugs (cues land *after* the moment, not *on* it)

| # | File / Line | Symptom |
|---|---|---|
| **T1** | [sound_planner.py:188](../../ai_service/app/ai-video-gen-main/sound_planner.py#L188) | Transition whoosh placed at `t=0.00` of the **incoming** shot. A whoosh's transient should hit the cut — instead the cut happens, *then* the whoosh tail explains it. ~150–250 ms perceptual lag. |
| **T2** | [sound_planner.py:380-383](../../ai_service/app/ai-video-gen-main/sound_planner.py#L380-L383) | A `+30…80 ms` hash-based "natural offset" is added to **every** cue, including transitions and impacts. Pushes already-late whooshes further past the cut, and prevents impact cues from being sample-accurate. |
| **T3** | [sound_planner.py:383](../../ai_service/app/ai-video-gen-main/sound_planner.py#L383) | `max(0.0, …)` floor in `_cue_from_palette` makes negative `t` impossible — silently clamps any pre-cut placement to zero. Blocks the whoosh-leads-cut fix. |
| **T4** | [useSoundScheduler.ts:55,173](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useSoundScheduler.ts#L55) | `TRIGGER_WINDOW = 0.15` — cues fire when the **JS clock** crosses the trigger inside a ±150 ms window. Web Audio scheduling is sample-accurate; relying on `requestAnimationFrame` polling adds 50–150 ms of jitter on top. |
| **T5** | [sound_planner.py:81-94](../../ai_service/app/ai-video-gen-main/sound_planner.py#L81-L94) `SHOT_TYPE_CUE` | Static `{shot_type → role, t, vol}` map. `KINETIC_TITLE` always gets an impact at `t=0.05`, regardless of when the title actually animates in. Should anchor to the actual visual sync point or to a narration emphasis word. |
| **T6** | [sound_planner.py:228-236](../../ai_service/app/ai-video-gen-main/sound_planner.py#L228-L236) Rule 4 | Emphasis fallback fires **only when** there are no other cues *and* `duration ≥ 2.5s`. The signal is good (longest silence gap or first long word) — but it's gated to long, otherwise-empty shots. The same anchor should be used to *relocate* signature cues on shorter shots, not just fill empty long ones. |

### 2.2 Mixing problems (cues "don't sit" in the mix)

| # | File / Line | Symptom |
|---|---|---|
| **M1** | [useSoundScheduler.ts:84-95](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useSoundScheduler.ts#L84-L95) | One Howl per URL. No shared `GainNode`, no analyzer, no compressor. Blocks **sidechain ducking** — the single most useful technique to make SFX feel present without being loud. Result: SFX either step on narration (too loud) or are inaudible (turned down to compensate). |
| **M2** | [sound_catalog.py:109-119](../../ai_service/app/ai-video-gen-main/sound_catalog.py#L109-L119), [sound_planner.py:374-376](../../ai_service/app/ai-video-gen-main/sound_planner.py#L374-L376) | Volume = `role_default × volume_mul × 0.6`. **No per-file LUFS normalization.** A "Whoosh 027" baked at -8 LUFS and a "ui-tap-12" at -28 LUFS both play "at 0.3" — one deafens, the other vanishes. This is the dominant reason the SFX library "feels random." |
| **M3** | [useSoundScheduler.ts:200-211](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useSoundScheduler.ts#L200-L211) | Pause / seek path calls `Howl.stop()` instantly. Audible click on tail-cut. 30 ms exponential fade-out fixes it. |
| **M4** | None — missing | No frequency-shaping. A 4 kHz chime collides with sibilants; an 80 Hz impact muddies a male voice fundamental. A two-band shelf on the SFX bus (≈-3 dB at 200–400 Hz under narration; ride 2–6 kHz) is cheap and audible. |
| **M5** | None — missing | No coordination with `meta.audio_tracks[]` (Lyria background score). Music + SFX + narration just sum. With a real bus, `bgMusicGain` should also dip ~2 dB when a high-energy SFX plays. |

### 2.3 Selection problems (right idea, wrong file)

| # | File / Line | Symptom |
|---|---|---|
| **S1** | [sound_planner.py:43-72](../../ai_service/app/ai-video-gen-main/sound_planner.py#L43-L72) `TOPIC_SYNONYMS` | Hand-coded ~25-topic table. "Marketing strategy", "machine learning", "supply chain", "history of the Mughal empire" all fall through. Topic-bias becomes a no-op for most real videos. |
| **S2** | [sound_planner.py:298-317](../../ai_service/app/ai-video-gen-main/sound_planner.py#L298-L317) palette = 4 variations | A 30-shot video reuses the same whoosh ~7×. Bump to 6–8 + add an anti-repeat window (no repeat within last N cues of the same role). |
| **S3** | [sound_planner.py:14, header](../../ai_service/app/ai-video-gen-main/sound_planner.py#L14) "Director does NOT see sound information" | Self-imposed limit. The Director knows where the *moments* are (it placed `sync_points`). Adding a single optional `audio_intent: "reveal"\|"punch"\|"negative"\|"positive"\|"ambient"\|null` per shot lets the Director say "this is the beat" without learning file ids. |
| **S4** | None — missing | No **narration-derived** anchors. Words like "but", "however", "imagine", "introducing", numerals, sentence-final `!`/`?` are the strongest sound-design opportunities — and you already have word timestamps on every video. |
| **S5** | [sound_planner.py:159-160](../../ai_service/app/ai-video-gen-main/sound_planner.py#L159-L160) caps | `max_cues_per_video = 20` is constant regardless of length. A 6-min video gets the same budget as a 1-min video. Make per-minute. |

---

## 3. The two changes that move the needle most

If you only ship two things, ship these. Together they fix "lands at the
wrong moment" and "doesn't sit in the mix" — the two complaints that drive
the perception that SFX are random and noisy.

### 3.1 Lead the cut with the transition whoosh

Pre-roll the whoosh onto the **previous** entry so its transient peaks on
the cut, drop the natural-offset for transition/impact cues, and remove the
`max(0.0, …)` floor that prevents pre-cut placement.

Sketch (`sound_planner.py`):

```python
# ── inside plan_sounds(), replace the per-entry loop's Rule 1 ──
for i, entry in enumerate(ordered):
    entry["sound_cues"] = entry.get("sound_cues") or []
    if total_cues >= max_per_video:
        continue

    shot_type = str(entry.get("_shot_type", "") or "")
    shot_idx = int(entry.get("index", 0))
    director_shot = shots_by_index.get(shot_idx, {})
    start_time = float(entry.get("start", 0.0))
    end_time = float(entry.get("end", start_time + 1.0))
    duration = max(0.01, end_time - start_time)

    # Rule 1 (revised): transition whoosh — attach to the *previous* entry
    # so its transient peaks on the cut. Falls back to t=0 of current entry
    # only if there is no previous entry to host it.
    if prev_shot_type is not None and i > 0:
        prev_family = _FAMILY.get(prev_shot_type, "other")
        cur_family = _FAMILY.get(shot_type, "other")
        if prev_family != cur_family and "transition_whoosh" in palette:
            prev_entry = ordered[i - 1]
            prev_dur = max(0.01, float(prev_entry.get("end", 0)) -
                                 float(prev_entry.get("start", 0)))
            # Look up the file we'd pick so we know its duration.
            variations = palette["transition_whoosh"]
            sample = variations[0] if isinstance(variations, list) else variations
            whoosh_dur = max(0.25, min(1.5, float(sample.get("duration") or 0.5)))
            # Place start so the transient (~65% in) lands on the cut.
            t_pre = max(0.0, prev_dur - whoosh_dur * 0.65)
            cue = _cue_from_palette(
                palette, "transition_whoosh",
                shot_idx, "transition", t=t_pre, volume_mul=1.0,
                no_natural_offset=True,
            )
            if cue:
                prev_entry.setdefault("sound_cues", []).append(cue)
                total_cues += 1

    # Rule 2: signature cue — anchor to a narration emphasis word when
    # available; otherwise fall back to the static placement.
    sig = SHOT_TYPE_CUE.get(shot_type)
    if sig is not None:
        role, placement, volume_mul = sig
        anchor = _find_emphasis_anchor(words, start_time, end_time)
        if anchor is not None and 0.0 <= anchor < duration:
            placement = anchor  # override sync[0]/fixed time with real anchor
        sig_cues = _resolve_signature_cue(
            palette=palette, role=role, placement=placement,
            volume_mul=volume_mul, shot=director_shot,
            start_time=start_time, duration=duration, shot_idx=shot_idx,
            no_natural_offset=(role == "impact"),
        )
        entry["sound_cues"].extend(sig_cues)

    # … Rules 3, 4, dedup, caps stay the same …
```

And in `_cue_from_palette` (`sound_planner.py:347-394`), thread the
`no_natural_offset` flag and drop the `max(0.0, …)` clamp:

```python
def _cue_from_palette(
    palette, role, shot_idx, slot,
    *, t, volume_mul, no_natural_offset: bool = False,
):
    variations = palette.get(role)
    if not variations:
        return None
    if isinstance(variations, dict):
        picked = variations
    else:
        counter_key = f"_{role}_counter"
        idx = palette.get(counter_key, 0) % len(variations)
        picked = variations[idx]
        palette[counter_key] = idx + 1

    base_volume = picked.get("volume_hint", 0.5)
    volume = max(0.0, min(1.0, base_volume * volume_mul * 0.6))

    if no_natural_offset:
        adjusted_t = round(float(t), 3)
    else:
        import hashlib
        h = int(hashlib.md5(f"{shot_idx}:{slot}".encode()).hexdigest()[:4], 16)
        offset = 0.03 + (h % 50) / 1000.0
        adjusted_t = round(float(t) + offset, 3)

    return {
        "id": f"sfx_{shot_idx}_{slot}",
        "t": adjusted_t,
        "url": picked.get("url"),
        "volume": round(volume, 3),
        "role": role,
        "file_id": picked.get("file_id"),
        "duration": round(picked.get("duration", 0.0), 3),
        "_source": slot,
    }
```

Notes:

- The timeline emitter already computes `absolute_time = adjusted_in_time + cue.t`
  ([automation_pipeline.py:9293](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L9293)),
  so cues attached to entry N-1 with the right `t` automatically resolve to
  the correct global time at the cut.
- The dedup pass operates per-entry; cross-entry dedup is unnecessary
  because no other rule places cues on entry N-1 near `prev_dur`.
- Signature cues for `impact` role lose the +30–80 ms wobble — title
  punches now hit on the title's animation start.

### 3.2 Replace Howler with a Web Audio bus + narration sidechain duck

Single new hook `useSfxBus.ts` that owns:

- one `AudioContext`
- buffers for every unique cue URL (decoded once)
- a `sfxBus → masterGain → destination` chain
- a `narrationGain` tap on the narration `<audio>` element via
  `createMediaElementSource`, with a momentary dip whenever a cue fires

Sketch:

```ts
// useSfxBus.ts (replaces useSoundScheduler internals; same external API)
const ctx = new AudioContext();
const sfxBus = ctx.createGain();      // master SFX bus
const narrSrc = ctx.createMediaElementSource(narrationAudioEl);
const narrGain = ctx.createGain();    // ducked by sidechain
narrSrc.connect(narrGain).connect(ctx.destination);
sfxBus.connect(ctx.destination);

// Decode every unique URL into an AudioBuffer at preload time
const buffers = new Map<string, AudioBuffer>();
async function preload(url: string) {
  const r = await fetch(url, { mode: 'cors' });
  const ab = await r.arrayBuffer();
  buffers.set(url, await ctx.decodeAudioData(ab));
}

// Schedule a cue precisely on the AudioContext clock with a ~100ms lookahead
function scheduleCue(cue: SoundCue, contextTimeAtMaster0: number) {
  const buf = buffers.get(cue.url);
  if (!buf) return;
  const when = contextTimeAtMaster0 + cue.absolute_time!;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // Per-cue gain w/ optional LUFS normalization (see §3.3)
  const g = ctx.createGain();
  g.gain.value = cue.volume;            // base volume from planner
  src.connect(g).connect(sfxBus);
  src.start(when);

  // Sidechain duck on narration: −4 dB for the cue's duration + 200 ms tail
  const duckStart = when - 0.02;
  const duckEnd = when + buf.duration + 0.20;
  const duckedDb = -4;
  const duckedGain = Math.pow(10, duckedDb / 20); // ≈0.63
  narrGain.gain.cancelScheduledValues(duckStart);
  narrGain.gain.setTargetAtTime(duckedGain, duckStart, 0.04); // 40ms attack
  narrGain.gain.setTargetAtTime(1.0,        duckEnd,   0.10); // 100ms release
}

// Driver loop: every 25 ms, schedule cues whose absolute_time is within 100 ms
// ahead of the master clock. Mark them scheduled so the next tick skips them.
```

This change alone:

- Drops scheduling jitter from ~150 ms to ≤5 ms (sample-accurate Web Audio).
- Makes every SFX automatically "carve a hole" in the narration without
  sounding loud — the dip is sub-perceptual on a single cue but the SFX
  arrives in clean air.
- Gives you one knob (`sfxBus.gain`) for a master SFX volume slider in the
  player UI, instead of mutating per-Howl volume.
- Lets future BG-music ducking ride the same path: also ramp
  `bgMusicGain.gain` by −2 dB on impacts.

API stays the same (`useSoundScheduler` becomes a thin shim around
`useSfxBus` if you want to keep the export for callers).

---

## 4. The next-tier fixes (cheap, high-ROI, ship after §3)

### 4.1 Per-file LUFS normalization (M2)

Offline pass when ingesting a sound into the catalog:

```bash
ffmpeg -i {url} -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -
```

Parse the JSON, store `lufs_i` and `peak_db` on each entry of
`sounds_metadata.json`. At playback time:

```ts
const targetByRole: Record<string, number> = {
  transition_whoosh: -16,  // hits hard
  impact:            -14,
  ui_chime:          -20,  // sweeter, quieter
  ui_click:          -22,
  data_reveal:       -18,
  ui_positive:       -18,
  ui_negative:       -18,
};
const gainDb = targetByRole[cue.role] - cue.lufs_i; // raise quiet, drop loud
g.gain.value = cue.volume * Math.pow(10, gainDb / 20);
```

Permanent fix to "some sounds boom, some are silent". One-time cost
(≤ 1 min for the whole catalog) and the metadata travels with the asset.

### 4.2 Narration-anchored placement (T6, S4)

Promote the emphasis-anchor logic. New rule placed *before* Rule 2:

```python
# Rule 1.5: narration-anchored signature cue.
# Scan words[] within (start_time, end_time) for high-value triggers:
#   - sentiment-flip words: but, however, instead, suddenly
#   - emphasis words:       imagine, introducing, finally, now, watch
#   - numerals (any digit)
#   - sentence-final ! or ?
# Pick the earliest match within the shot; use it as the placement time
# for whichever signature role this shot type calls for.
EMPHASIS_LEX = {
    "but", "however", "instead", "suddenly", "imagine",
    "introducing", "finally", "now", "watch", "boom", "crash",
}
def _narration_anchor(words, shot_start, shot_end) -> Optional[Tuple[float, str]]:
    for w in words:
        ws = float(w.get("start", 0))
        if ws < shot_start or ws > shot_end:
            continue
        text = str(w.get("word", "")).strip().lower().rstrip(".,;:")
        if not text:
            continue
        if any(ch.isdigit() for ch in text):
            return (ws - shot_start, "numeral")
        if text in EMPHASIS_LEX:
            return (ws - shot_start, "emphasis")
        if text.endswith(("!", "?")):
            return (ws - shot_start, "sentence_end")
    return None
```

When this returns a time, override the static placement in `SHOT_TYPE_CUE`
and (separately) override the role too: `numeral → data_reveal`,
`emphasis → ui_chime`, `negative-flip word → ui_negative`.

### 4.3 Director `audio_intent` field (S3)

In `director_prompts.py`, extend the per-shot schema with one optional
field:

```
audio_intent: one of {"reveal","punch","negative","positive","ambient"} | null
```

Add 3–4 lines to the Director system prompt: *"When a shot's content
delivers a beat the viewer should feel, set `audio_intent` accordingly:
'punch' for impact/title hits, 'reveal' for new info/data, 'negative' for
problems/contrast/wait, 'positive' for solutions/wins, 'ambient' for
sustained mood."*

In `sound_planner.py`, before the `SHOT_TYPE_CUE` lookup, check
`director_shot.get("audio_intent")` and map to a role:

```python
INTENT_TO_ROLE = {
    "punch":    ("impact",       0.0,  0.70),
    "reveal":   ("data_reveal",  None, 0.65),  # None → use anchor
    "negative": ("ui_negative",  None, 0.60),
    "positive": ("ui_positive",  None, 0.65),
    "ambient":  None,  # signal: no signature cue, leave room
}
```

Cost: ~30 prompt tokens per shot. Reward: cues land where the *content* is
beat-worthy, not where the shot-type table says they should be.

### 4.4 Topic palette via embeddings or LLM tags (S1)

Replace `TOPIC_SYNONYMS` with one of:

- **Cheap path**: at `script_plan` time, ask the LLM for 5 thematic tags +
  mood (`["fitness", "discipline", "energy", "training", "morning"]`,
  `mood: "motivational"`). Use those as `topic_keywords` for
  `resolve_for_topic`.
- **Cheaper path**: pre-embed every catalog `description` once
  (offline, store in `sounds_metadata.json`). Embed each video's
  `script_text` once at run time. Score by cosine, take top-K per role.

Either replaces the brittle synonym table with something that works for
arbitrary topics.

### 4.5 Density: per-minute budget + anti-repeat window (S2, S5)

```python
# In tier_config: replace constants with per-minute rates
sound_max_cues_per_video = max(6, min(30, round(audio_duration_sec / 60 * 4)))

# In _dedup_and_space: track last-used file_id per role, suppress repeats
# within a 3-cue window of the same role.
```

---

## 5. Suggested execution order

Each step is independent and reversible.

1. **§3.1 — Pre-roll transition whooshes + drop natural-offset on impacts.**
   ~30 lines in [sound_planner.py](../../ai_service/app/ai-video-gen-main/sound_planner.py).
   Single biggest "this sounds wrong" cause. Test by re-rendering one
   existing video with the same seed and A/B-ing the audio.
2. **§3.2 — Web Audio bus + narration sidechain duck.** New
   `useSfxBus.ts`; replace [useSoundScheduler.ts](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useSoundScheduler.ts)
   internals, keep the external API. Biggest "doesn't sit in the mix" fix.
3. **§4.1 — Per-file LUFS normalization.** Offline metadata pass +
   gain math at cue-play time. Permanent fix to volume randomness.
4. **§4.2 — Narration-anchored placement.** Promote `_find_emphasis_anchor`
   from fallback to first-class; add the lexicon-based scan over `words[]`.
5. **§4.3 — Director `audio_intent`.** One optional schema field; 3 prompt
   lines; ~10 lines of planner code. Big quality jump for content where
   shot-type alone underspecifies the beat.
6. **§4.4 — Topic palette upgrade.** Replace `TOPIC_SYNONYMS` with
   embeddings or LLM tags. Optional but unlocks variety on niche topics.
7. **§4.5 — Per-minute budget + anti-repeat.** Pure config + ~20 lines.
8. **Polish** — tail fades on stop (M3), shelf EQ on the SFX bus (M4),
   BG-music ducking on the same sidechain (M5).

If you ship only step 1 and step 2, the difference is already audible
side-by-side; steps 3–4 are what make it feel like a deliberate sound
design pass instead of a sample library on a shuffle.
