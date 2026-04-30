/**
* useSoundScheduler — plays per-shot sound effect cues live during playback.
*
* Web Audio implementation (replaces an earlier Howler-based version).
*
* Contract:
*   1. The backend Sound Planner emits `sound_cues` on each timeline entry.
*   2. Every cue carries `absolute_time` (global seconds on the master clock)
*      and `url` (S3 public URL to the audio file).
*   3. This hook decodes every unique URL once into an AudioBuffer, then on
*      each tick walks unfired cues and schedules the ones inside a 300 ms
*      lookahead window using `source.start(ctx.currentTime + delta)` — so
*      cues fire sample-accurately on the AudioContext clock instead of the
*      jittery JS clock.
*   4. Optional sidechain duck: when `narrationAudioRef` is provided, the
*      narration `<audio>` element is tapped via `createMediaElementSource`
*      and routed through a `narrationGain`. Each scheduled cue ramps that
*      gain down by ~4 dB for the cue duration (40 ms attack / 100 ms
*      release), so SFX arrive in clean air without sounding loud.
*
* Why Web Audio (vs Howler):
*   - Sample-accurate scheduling. Howler fires when the JS clock crosses a
*     trigger inside a ±150 ms window; here cues fire on the AudioContext's
*     own clock with sub-5 ms accuracy.
*   - A shared `sfxBus` GainNode means a single master SFX volume knob, and
*     a single duck source for the narration tap.
*   - No global mute/unmute side-effects — pause behaviour ramps the bus
*     gain instead of muting Howler globally.
*
* Seek semantics:
*   When the user seeks the master timeline, the scheduler recomputes which
*   cues are "already played" (any cue whose trigger is before the new time
*   is marked played so it never fires again this session). Seeking forward
*   skips cues; seeking backward does NOT replay past cues — one-shot only.
*
* Kill switch:
*   When `enabled` is false or the cues array is empty, the hook does nothing
*   (no AudioContext, no fetches, no narration tap).
*
* iOS / autoplay: AudioContext starts suspended. We `ctx.resume()` whenever
*   `isPlaying` becomes true — by then the user has clicked the play button,
*   so the resume is allowed.
*
* createMediaElementSource caveat: it can only be called ONCE per audio
*   element. If the same element is later passed in, we skip the tap. The
*   audio element MUST have `crossOrigin="anonymous"` (already set in both
*   AIContentPlayer and AIVideoPlayer) or the tap would silently mute the
*   narration due to CORS tainting.
*/

import { useEffect, useMemo, useRef, useCallback } from 'react';
import type { SoundCue } from '../types';

export interface UseSoundSchedulerOptions {
  /** All sound cues for the video, pre-merged across entries. Each cue MUST
  *  carry an `absolute_time` (global master-clock seconds). */
  cues: SoundCue[] | undefined;
  /** Master clock in seconds — same source the rest of the player uses. */
  masterClockSec: number;
  /** Whether playback is currently running. Pauses all sound on false. */
  isPlaying: boolean;
  /** Scheduler kill switch. When false, no sounds play regardless of cues. */
  enabled?: boolean;
  /** Multiplier applied to every cue's per-cue volume (0.0–1.0).
  *  Use this for a master SFX volume slider. Default 1.0. */
  masterVolume?: number;
  /** Optional ref to the narration <audio> element. When provided, the
  *  scheduler taps it via createMediaElementSource and ducks it during
  *  every cue. When omitted, SFX still play through the bus but the
  *  narration is left flat. */
  narrationAudioRef?: React.RefObject<HTMLAudioElement | null>;
}

const DUCK_DB = -4;
const DUCK_GAIN = Math.pow(10, DUCK_DB / 20); // ≈ 0.631
const DUCK_ATTACK_TC = 0.04; // setTargetAtTime time-constant ≈ 40 ms attack
const DUCK_RELEASE_TC = 0.10; // ≈ 100 ms release after the cue ends
const DUCK_TAIL_S = 0.20; // hold duck this long after cue ends
const LOOKAHEAD_S = 0.30; // schedule cues this far ahead of the master clock
const SEEK_THRESHOLD_S = 1.0; // clock jump bigger than this = seek

export function useSoundScheduler({
  cues,
  masterClockSec,
  isPlaying,
  enabled = true,
  masterVolume = 1.0,
  narrationAudioRef,
}: UseSoundSchedulerOptions): { resetPlayed: () => void } {
  const ctxRef = useRef<AudioContext | null>(null);
  const sfxBusRef = useRef<GainNode | null>(null);
  const narrationSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const narrationGainRef = useRef<GainNode | null>(null);
  const narrationElRef = useRef<HTMLAudioElement | null>(null);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  /** Set<cue.id> of cues already scheduled this session. Reset on seek. */
  const scheduledRef = useRef<Set<string>>(new Set());
  const lastClockRef = useRef<number>(masterClockSec);

  // ── 1. Lazy AudioContext + sfxBus ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (ctxRef.current) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const sfxBus = ctx.createGain();
    sfxBus.gain.value = Math.max(0, Math.min(1, masterVolume));
    sfxBus.connect(ctx.destination);
    ctxRef.current = ctx;
    sfxBusRef.current = sfxBus;
  }, [enabled, masterVolume]);

  // ── 2. On first play: resume AudioContext, then tap narration ──────────
  // Both must happen at the same instant. createMediaElementSource reroutes
  // the narration <audio> element away from the browser's default audio
  // path and through this AudioContext; if the context is `suspended` when
  // the routing happens, the user hears NOTHING from the narration.
  //
  // We gate on `isPlaying === true` so the resume + tap fire just after the
  // user's play-button click (a valid user gesture for autoplay policy).
  // The tap is one-shot per element; if it fails (StrictMode double-mount,
  // already-tapped) we record the element so we don't retry every render.
  useEffect(() => {
    if (!enabled) return;
    if (!isPlaying) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.warn('[useSoundScheduler] AudioContext.resume failed:', err);
      });
    }

    const el = narrationAudioRef?.current ?? null;
    if (!el) return;
    if (narrationElRef.current === el) return; // already attempted on this element
    if (narrationSourceRef.current) return; // already tapped a different element

    try {
      const src = ctx.createMediaElementSource(el);
      const g = ctx.createGain();
      g.gain.value = 1.0;
      src.connect(g).connect(ctx.destination);
      narrationSourceRef.current = src;
      narrationGainRef.current = g;
      narrationElRef.current = el;
    } catch (err) {
      // createMediaElementSource throws if this element was tapped
      // already (StrictMode or another player). Record the element so
      // subsequent renders short-circuit instead of re-throwing.
      console.warn('[useSoundScheduler] narration tap failed:', err);
      narrationElRef.current = el;
    }
  }, [isPlaying, enabled, narrationAudioRef]);

  // ── 3. Decode unique cue URLs into AudioBuffers ─────────────────────────
  const uniqueUrls = useMemo(() => {
    if (!enabled || !cues || cues.length === 0) return [] as string[];
    const s = new Set<string>();
    for (const c of cues) if (c.url) s.add(c.url);
    return Array.from(s);
  }, [cues, enabled]);

  useEffect(() => {
    if (!enabled || uniqueUrls.length === 0) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    let cancelled = false;
    const buffers = buffersRef.current;
    // Drop buffers for URLs no longer referenced (new video loaded).
    for (const url of Array.from(buffers.keys())) {
      if (!uniqueUrls.includes(url)) buffers.delete(url);
    }
    (async () => {
      for (const url of uniqueUrls) {
        if (cancelled) return;
        if (buffers.has(url)) continue;
        try {
          const r = await fetch(url, { mode: 'cors' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const ab = await r.arrayBuffer();
          if (cancelled) return;
          const buf = await ctx.decodeAudioData(ab);
          if (cancelled) return;
          buffers.set(url, buf);
        } catch (err) {
          console.warn(`[useSoundScheduler] decode failed for ${url}:`, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uniqueUrls, enabled]);

  // ── 4. Master volume changes → ramp sfxBus ─────────────────────────────
  useEffect(() => {
    const sfxBus = sfxBusRef.current;
    const ctx = ctxRef.current;
    if (!sfxBus || !ctx) return;
    const target = Math.max(0, Math.min(1, masterVolume));
    const t = ctx.currentTime;
    sfxBus.gain.cancelScheduledValues(t);
    sfxBus.gain.setTargetAtTime(target, t, 0.02);
  }, [masterVolume]);

  // ── 5. Reset scheduled-set when cue list changes (new video) ───────────
  useEffect(() => {
    scheduledRef.current.clear();
  }, [cues]);

  // ── 6. Tick: schedule cues inside the lookahead window ─────────────────
  useEffect(() => {
    if (!enabled || !cues || cues.length === 0) {
      lastClockRef.current = masterClockSec;
      return;
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const prev = lastClockRef.current;
    const now = masterClockSec;
    lastClockRef.current = now;

    // Detect a seek: clock jumped backwards OR forwards by > threshold.
    const isSeek = Math.abs(now - prev) > SEEK_THRESHOLD_S || now < prev;
    if (isSeek) {
      const fresh = new Set<string>();
      for (const c of cues) {
        const absT = c.absolute_time ?? 0;
        if (absT < now) fresh.add(c.id);
      }
      scheduledRef.current = fresh;
      return;
    }

    if (!isPlaying) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        /* ignore — will retry next tick */
      });
    }

    const sfxBus = sfxBusRef.current;
    if (!sfxBus) return;
    const narrGain = narrationGainRef.current;

    for (const c of cues) {
      const absT = c.absolute_time ?? 0;
      const delta = absT - now;
      if (delta < -0.05 || delta > LOOKAHEAD_S) continue;
      if (scheduledRef.current.has(c.id)) continue;
      const buf = buffersRef.current.get(c.url);
      if (!buf) continue;

      const startAt = ctx.currentTime + Math.max(0, delta);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      const cueVol = Math.max(0, Math.min(1, c.volume));
      g.gain.value = cueVol;
      src.connect(g).connect(sfxBus);
      try {
        src.start(startAt);
      } catch {
        // start() can throw if the context closed mid-tick. Drop.
      }
      scheduledRef.current.add(c.id);

      // Sidechain duck: dip narration −4 dB for the cue + 200 ms tail.
      if (narrGain) {
        const cueLen = buf.duration;
        const duckStart = Math.max(ctx.currentTime, startAt - 0.02);
        const duckEnd = startAt + cueLen + DUCK_TAIL_S;
        try {
          narrGain.gain.cancelScheduledValues(duckStart);
          narrGain.gain.setTargetAtTime(DUCK_GAIN, duckStart, DUCK_ATTACK_TC);
          narrGain.gain.setTargetAtTime(1.0, duckEnd, DUCK_RELEASE_TC);
        } catch {
          /* ok */
        }
      }
    }
  }, [masterClockSec, isPlaying, cues, enabled]);

  // ── 7. Pause/play behavior on the bus ──────────────────────────────────
  // On pause, fast-fade the sfxBus to silence so any in-flight cue doesn't
  // ring across the pause; restore the narration gain to 1.0. On resume,
  // ramp the bus back to masterVolume.
  useEffect(() => {
    if (!enabled) return;
    const ctx = ctxRef.current;
    const sfxBus = sfxBusRef.current;
    if (!ctx || !sfxBus) return;
    const t = ctx.currentTime;
    if (!isPlaying) {
      sfxBus.gain.cancelScheduledValues(t);
      sfxBus.gain.setTargetAtTime(0.0001, t, 0.02);
      const narrGain = narrationGainRef.current;
      if (narrGain) {
        narrGain.gain.cancelScheduledValues(t);
        narrGain.gain.setTargetAtTime(1.0, t, DUCK_RELEASE_TC);
      }
    } else {
      sfxBus.gain.cancelScheduledValues(t);
      sfxBus.gain.setTargetAtTime(
        Math.max(0, Math.min(1, masterVolume)),
        t,
        0.02,
      );
    }
  }, [isPlaying, enabled, masterVolume]);

  // ── 8. Cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx) {
        try {
          ctx.close();
        } catch {
          /* already closed */
        }
      }
      ctxRef.current = null;
      sfxBusRef.current = null;
      narrationSourceRef.current = null;
      narrationGainRef.current = null;
      narrationElRef.current = null;
      buffersRef.current.clear();
      scheduledRef.current.clear();
    };
  }, []);

  const resetPlayed = useCallback(() => {
    scheduledRef.current.clear();
  }, []);

  return { resetPlayed };
}

/**
* Flatten an `entries` array into a single cue list with `absolute_time`
* populated. Prefers the backend-provided `absolute_time`; falls back to
* computing it from the entry's `inTime + cue.t` if the backend predates
* the field (older timelines).
*
* Hosted as a named export so both AIContentPlayer and AIVideoPlayer can
* build their cue list the same way.
*/
export function collectCuesFromEntries<
  T extends {
    inTime?: number;
    start?: number;
    sound_cues?: SoundCue[];
  },
>(entries: T[]): SoundCue[] {
  const out: SoundCue[] = [];
  for (const entry of entries) {
    const entryStart = entry.inTime ?? entry.start ?? 0;
    const raw = entry.sound_cues;
    if (!raw || raw.length === 0) continue;
    for (const c of raw) {
      const absT = c.absolute_time ?? entryStart + (c.t ?? 0);
      out.push({
        ...c,
        absolute_time: absT,
      });
    }
  }
  return out;
}
