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
import { decodeFromUrl } from './audio-decode-cache';
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
}

function scheduleBuffer({
    ctx,
    buffer,
    timelineStart,
    playheadStart,
    volume,
    fadeIn,
    fadeOut,
}: ScheduleArgs): ScheduledSource | null {
    // Where in the buffer we start reading (s)
    const offset = playheadStart - timelineStart;
    if (offset >= buffer.duration) return null; // already past end
    const realOffset = Math.max(0, offset);
    const realCtxStart = ctx.currentTime + Math.max(0, -offset);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
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

    if (fadeOut > 0) {
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
    playheadStart: number
) {
    try {
        const buffer = await decodeFromUrl(ctx, url);
        if (isStale(ctx, gen)) return;
        const scheduled = scheduleBuffer({
            ctx,
            buffer,
            timelineStart: 0,
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
        const buffer = await decodeFromUrl(ctx, track.url);
        if (isStale(ctx, gen)) return;
        const scheduled = scheduleBuffer({
            ctx,
            buffer,
            timelineStart: track.delay ?? 0,
            playheadStart,
            volume: track.volume ?? 1,
            fadeIn: track.fadeIn ?? 0,
            fadeOut: track.fadeOut ?? 0,
        });
        if (scheduled) sources.push(scheduled);
    } catch {
        /* ignore */
    }
}

async function schedulePerEntryAudio(
    ctx: AudioContext,
    gen: number,
    entries: Entry[],
    playheadStart: number
) {
    // Per-entry `audio_url` is mostly used in user_driven mode but some
    // time_driven shots also carry one. Schedule each so it begins at the
    // entry's inTime (or `start`) and offsets correctly when starting mid-way.
    for (const e of entries) {
        if (!e.audio_url) continue;
        const timelineStart = e.inTime ?? e.start ?? 0;
        try {
            const buffer = await decodeFromUrl(ctx, e.audio_url);
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

    // Schedule audio sources in parallel
    const promises: Promise<void>[] = [];
    if (state.audioUrl) promises.push(scheduleNarration(ctx, gen, state.audioUrl, startAt));
    for (const track of state.audioTracks) promises.push(scheduleTrack(ctx, gen, track, startAt));
    promises.push(schedulePerEntryAudio(ctx, gen, state.entries, startAt));
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
