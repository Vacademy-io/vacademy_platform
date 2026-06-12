/**
 * Editor playback engine — singleton controller that owns one AudioContext,
 * schedules narration + audio tracks + per-entry audio against the master
 * clock, and advances `currentTime` via a requestAnimationFrame loop reading
 * `AudioContext.currentTime` (drift-free).
 *
 * The iframe's gsap.globalTimeline is driven by the existing `vx-seek` bridge
 * in EditorCanvas — as `currentTime` advances each frame, every active
 * EntryLayer posts a seek to its iframe, so visuals follow audio.
 *
 * Scrubbing while playing pauses playback so the user's manual seek doesn't
 * race the rAF loop. The TimelineScrubber wires this via the `pauseIfPlaying`
 * export.
 */
import { useSyncExternalStore } from 'react';
import { useVideoEditorStore } from '../stores/video-editor-store';
import { decodeForContext } from './audio-decode-cache';
import type { AudioTrack, Entry } from '@/components/ai-video-player/types';

interface ScheduledSource {
    source: AudioBufferSourceNode;
    gain: GainNode;
}

let audioCtx: AudioContext | null = null;
let sources: ScheduledSource[] = [];
let rafId: number | null = null;
let playStartCtxTime = 0;
let playStartCurrentTime = 0;
let isPlayingState = false;
/** Bumped every play()/pause()/stop() so in-flight decoding from a prior
 *  session can detect that it should not append its source. */
let playGeneration = 0;

const listeners = new Set<() => void>();
function emit() {
    for (const l of listeners) l();
}

function ensureCtx(): AudioContext {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        // Browsers require a user gesture; this call only succeeds inside the
        // click handler that triggered play(). Fail-safe: ignore the rejection.
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

function stopAllSources() {
    for (const s of sources) {
        try {
            s.source.stop();
        } catch {
            /* already stopped */
        }
        try {
            s.source.disconnect();
            s.gain.disconnect();
        } catch {
            /* ignore */
        }
    }
    sources = [];
}

function stopRaf() {
    if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function setPlaying(next: boolean) {
    if (isPlayingState === next) return;
    isPlayingState = next;
    emit();
}

interface ScheduleArgs {
    ctx: AudioContext;
    buffer: AudioBuffer;
    /** Where the buffer's t=0 sits on the master timeline (seconds). */
    timelineStart: number;
    /** Where playback started on the master timeline (seconds). */
    playheadStart: number;
    volume: number;
    fadeIn: number;
    fadeOut: number;
    /** Repeat the buffer until playback stops (bg music). The read offset
     *  wraps modulo the buffer length so scrubbing deep into the timeline
     *  still hears the right point in the loop. fadeOut is ignored — a
     *  looping track has no natural end inside the buffer. */
    loop?: boolean;
}

function scheduleBuffer({
    ctx,
    buffer,
    timelineStart,
    playheadStart,
    volume,
    fadeIn,
    fadeOut,
    loop = false,
}: ScheduleArgs): ScheduledSource | null {
    // Where in the buffer we start reading (s)
    const offset = playheadStart - timelineStart;
    if (!loop && offset >= buffer.duration) return null; // already past end
    const realOffset = loop ? Math.max(0, offset) % buffer.duration : Math.max(0, offset);
    const realCtxStart = ctx.currentTime + Math.max(0, -offset);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const gain = ctx.createGain();

    if (fadeIn > 0 && realOffset < fadeIn) {
        // Continue an in-progress fade-in if we started mid-fade
        const fadeRemaining = fadeIn - realOffset;
        const startVol = volume * (realOffset / fadeIn);
        gain.gain.setValueAtTime(startVol, realCtxStart);
        gain.gain.linearRampToValueAtTime(volume, realCtxStart + fadeRemaining);
    } else {
        gain.gain.setValueAtTime(volume, realCtxStart);
    }

    if (fadeOut > 0 && !loop) {
        const fadeStartOffset = buffer.duration - fadeOut;
        if (fadeStartOffset > realOffset) {
            const fadeStartCtx = realCtxStart + (fadeStartOffset - realOffset);
            gain.gain.setValueAtTime(volume, fadeStartCtx);
            gain.gain.linearRampToValueAtTime(0, fadeStartCtx + fadeOut);
        }
    }

    src.connect(gain).connect(ctx.destination);
    try {
        src.start(realCtxStart, realOffset);
    } catch {
        return null;
    }
    return { source: src, gain };
}

function isStale(ctx: AudioContext, gen: number): boolean {
    return audioCtx !== ctx || gen !== playGeneration || !isPlayingState;
}

async function scheduleNarration(
    ctx: AudioContext,
    gen: number,
    url: string,
    playheadStart: number,
    narrationStart: number
) {
    try {
        const buffer = await decodeForContext(ctx, url);
        if (isStale(ctx, gen)) return;
        const scheduled = scheduleBuffer({
            ctx,
            buffer,
            // The master narration MP3 has NO leading intro silence — its t=0
            // sits at master-timeline `audio_start_at` (the intro duration).
            // The render server compensates via ffmpeg `adelay` and the player
            // delays the <audio> element; the editor must do the same or
            // narration plays `audio_start_at` seconds too early when an intro
            // exists.
            timelineStart: narrationStart,
            playheadStart,
            volume: 1,
            fadeIn: 0,
            fadeOut: 0,
        });
        if (scheduled) sources.push(scheduled);
    } catch {
        // Audio unavailable / CORS — silently degrade to silent playback
    }
}

async function scheduleTrack(
    ctx: AudioContext,
    gen: number,
    track: AudioTrack,
    playheadStart: number
) {
    try {
        const buffer = await decodeForContext(ctx, track.url);
        if (isStale(ctx, gen)) return;
        const scheduled = scheduleBuffer({
            ctx,
            buffer,
            timelineStart: track.delay ?? 0,
            playheadStart,
            volume: track.volume ?? 1,
            fadeIn: track.fadeIn ?? 0,
            fadeOut: track.fadeOut ?? 0,
            loop: track.loop ?? false,
        });
        if (scheduled) sources.push(scheduled);
    } catch {
        /* ignore */
    }
}

/**
 * Whether per-entry clips should drive narration (and the master MP3 be
 * muted). Incremental "entry owns its audio clip": this is true ONLY when the
 * timeline is explicitly flagged fully-migrated (`meta.entries_own_audio`) AND
 * at least one narration clip is actually present. Until then the master MP3
 * stays authoritative and per-entry narration clips are skipped to avoid
 * double-play — the per-entry refs the BE writes on regen/silence ride along
 * as the future source of truth without changing what you hear today.
 */
function entriesOwnAudio(entries: Entry[], entriesOwnFlag: boolean | undefined): boolean {
    if (!entriesOwnFlag) return false;
    return entries.some((e) => e.audio?.policy === 'narration_only' && !!e.audio.clip_url);
}

async function schedulePerEntryAudio(
    ctx: AudioContext,
    gen: number,
    entries: Entry[],
    playheadStart: number,
    ownAudio: boolean
) {
    // Resolve each entry's audio source under the dual-read model:
    //  - new `entry.audio` ref: 'silent' → nothing; 'intrinsic' → always
    //    layered (source-clip/Veo audio over a muted master window);
    //    'narration_only' → only when `ownAudio` (else the master MP3 carries it).
    //  - legacy `entry.audio_url` (no ref): scheduled as before — this is the
    //    user_driven path where there is no master MP3.
    for (const e of entries) {
        let clipUrl: string | undefined;
        const ref = e.audio;
        if (ref) {
            if (ref.policy === 'silent') continue;
            if (ref.policy === 'intrinsic') clipUrl = ref.clip_url;
            else if (ownAudio)
                clipUrl = ref.clip_url; // narration_only
            else continue; // narration_only but master is authoritative
        } else if (e.audio_url) {
            clipUrl = e.audio_url;
        }
        if (!clipUrl) continue;
        const timelineStart = e.inTime ?? e.start ?? 0;
        try {
            const buffer = await decodeForContext(ctx, clipUrl);
            if (isStale(ctx, gen)) return;
            const scheduled = scheduleBuffer({
                ctx,
                buffer,
                timelineStart,
                playheadStart,
                volume: 1,
                fadeIn: 0,
                fadeOut: 0,
            });
            if (scheduled) sources.push(scheduled);
        } catch {
            /* ignore individual failures */
        }
    }
}

/**
 * Schedule per-entry sound-effect cues (Sound Planner output). Each cue carries
 * `absolute_time` — the global master-clock second, already offset by any intro
 * by the backend — and a one-shot `url`. We reuse `scheduleBuffer` with
 * `timelineStart = absolute_time` so a future cue fires sample-accurately on the
 * AudioContext clock; cues whose start is before the playhead are skipped
 * (forward-only one-shot, matching the read-only player's seek semantics).
 *
 * No sidechain ducking here — the read-only player dips narration −4 dB during
 * cues, but the editor keeps preview simple: SFX layer on top at their own
 * volume. (Decode is shared via the audio-decode cache.)
 */
async function scheduleSoundCues(
    ctx: AudioContext,
    gen: number,
    entries: Entry[],
    playheadStart: number
) {
    for (const e of entries) {
        const cues = e.sound_cues;
        if (!cues || cues.length === 0) continue;
        const entryStart = e.inTime ?? e.start ?? 0;
        for (const cue of cues) {
            if (!cue.url) continue;
            const absT = cue.absolute_time ?? entryStart + (cue.t ?? 0);
            if (absT < playheadStart - 0.05) continue; // already past — don't replay
            try {
                const buffer = await decodeForContext(ctx, cue.url);
                if (isStale(ctx, gen)) return;
                const scheduled = scheduleBuffer({
                    ctx,
                    buffer,
                    timelineStart: absT,
                    playheadStart,
                    volume: Math.max(0, Math.min(1, cue.volume ?? 1)),
                    fadeIn: 0,
                    fadeOut: 0,
                });
                if (scheduled) sources.push(scheduled);
            } catch {
                /* ignore individual cue failures (CORS / unreachable) */
            }
        }
    }
}

export async function play() {
    const state = useVideoEditorStore.getState();
    const ctx = ensureCtx();

    stopAllSources();
    stopRaf();
    const gen = ++playGeneration;

    const startAt = Math.max(0, state.currentTime);
    playStartCtxTime = ctx.currentTime;
    playStartCurrentTime = startAt;
    setPlaying(true);

    // Kick off the rAF clock immediately so the playhead moves even before
    // audio buffers finish decoding (first play of the session may have a
    // network roundtrip).
    const totalDuration = state.meta.total_duration ?? Number.POSITIVE_INFINITY;
    const tick = () => {
        if (!isPlayingState || !audioCtx || gen !== playGeneration) return;
        const elapsed = audioCtx.currentTime - playStartCtxTime;
        const t = playStartCurrentTime + elapsed;
        if (totalDuration > 0 && t >= totalDuration) {
            useVideoEditorStore.getState().seek(totalDuration);
            pause();
            return;
        }
        useVideoEditorStore.getState().seek(t);
        rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Schedule audio sources in parallel. When entries own their audio (fully
    // migrated), the master narration MP3 is muted and per-entry narration
    // clips drive playback; otherwise the master plays and per-entry narration
    // clips are skipped (only intrinsic/legacy per-entry audio layers).
    const ownAudio = entriesOwnAudio(state.entries, state.meta.entries_own_audio);
    const narrationStart = state.meta.audio_start_at ?? 0;
    const promises: Promise<void>[] = [];
    if (state.audioUrl && !ownAudio)
        promises.push(scheduleNarration(ctx, gen, state.audioUrl, startAt, narrationStart));
    for (const track of state.audioTracks) promises.push(scheduleTrack(ctx, gen, track, startAt));
    promises.push(schedulePerEntryAudio(ctx, gen, state.entries, startAt, ownAudio));
    // Sound-effect cues (Sound Planner). Each cue carries an absolute master-
    // clock time; the editor previously never played them (only the read-only
    // player's useSoundScheduler did), so SFX were silent in the editor.
    promises.push(scheduleSoundCues(ctx, gen, state.entries, startAt));
    await Promise.all(promises);
}

export function pause() {
    stopAllSources();
    stopRaf();
    playGeneration++;
    setPlaying(false);
}

/** Convenience for components that scrub — only pauses if currently playing. */
export function pauseIfPlaying() {
    if (isPlayingState) pause();
}

export function stop() {
    pause();
    useVideoEditorStore.getState().seek(0);
}

export function getIsPlaying(): boolean {
    return isPlayingState;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** React hook — re-renders when isPlaying flips. */
export function useIsPlaying(): boolean {
    return useSyncExternalStore(subscribe, getIsPlaying, getIsPlaying);
}
