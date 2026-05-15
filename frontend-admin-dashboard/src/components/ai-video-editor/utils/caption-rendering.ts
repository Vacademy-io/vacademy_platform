/**
 * Caption rendering utilities for the video editor canvas.
 *
 * Algorithm + CSS are deliberate 1:1 mirrors of the render server
 * (`ai_service/app/ai-video-gen-main/generate_video.py`) so that the
 * editor's on-canvas caption preview is byte-for-byte identical to what
 * the MP4 will contain.
 *
 * THREE IMPLEMENTATIONS MUST STAY IN LOCKSTEP:
 *   1. This file (editor preview).
 *   2. `useCaptions.ts:buildPhrases` (admin / learner video player preview).
 *   3. `generate_video.py:_build_caption_segments` (render server, Python).
 *
 * Changing the algorithm here means changing all three.
 */
import type { CSSProperties } from 'react';
import type { WordTimestamp } from '@/components/ai-video-player/types';

// ─── Phrase building (mirrors generate_video.py:_build_caption_segments) ────

const WORDS_PER_PHRASE = 10;
const MIN_PHRASE_DURATION = 2.0;
const MAX_PHRASE_DURATION = 5.0;

export interface CaptionPhrase {
    startTime: number;
    endTime: number;
    text: string;
    words: WordTimestamp[];
}

export function buildPhrases(words: WordTimestamp[]): CaptionPhrase[] {
    if (words.length === 0) return [];

    const phrases: CaptionPhrase[] = [];
    let current: WordTimestamp[] = [];
    let phraseStart = 0;

    for (let i = 0; i < words.length; i++) {
        const w = words[i]!;
        if (current.length === 0) phraseStart = w.start;
        current.push(w);

        const duration = w.end - phraseStart;
        const wordCount = current.length;
        const text = w.word.trim();

        const shouldBreak =
            /[.!?]$/.test(text) ||
            wordCount >= WORDS_PER_PHRASE ||
            duration >= MAX_PHRASE_DURATION ||
            (/[,;:]$/.test(text) && wordCount >= 5 && duration >= MIN_PHRASE_DURATION) ||
            (i < words.length - 1 && words[i + 1]!.start - w.end > 0.5);

        if (shouldBreak || i === words.length - 1) {
            phrases.push({
                startTime: phraseStart,
                endTime: w.end,
                text: current.map((x) => x.word).join(' '),
                words: [...current],
            });
            current = [];
        }
    }
    return phrases;
}

// ─── Active phrase lookup (mirrors generate_video.py:_active_caption_at) ────

const LEAD_S = 0.1;
const TAIL_S = 0.3;

export function activePhraseAt(phrases: CaptionPhrase[], t: number): CaptionPhrase | null {
    for (const p of phrases) {
        if (t >= p.startTime - LEAD_S && t <= p.endTime + TAIL_S) return p;
    }
    return null;
}

// ─── Editor caption settings (mirrors RenderSettings caption fields) ─────────

/** Caption position. Mirrors RenderSettings.captionPosition. */
export type CaptionPosition = 'top' | 'bottom';

/**
 * Editor-side caption settings. Field names mirror RenderSettings so they map
 * 1:1 to the render dialog and downstream `caption_*` API fields.
 *
 * `sizePx` is "px at the 1920w native canvas" — identical contract to the
 * render server's `_CAPTION_SIZE_PX` lookup in external_video_generation.py.
 * The overlay scales by (canvasW / 1920) on render, matching
 * generate_video.py:850-854.
 */
export interface CaptionEditorSettings {
    enabled: boolean;
    position: CaptionPosition;
    /** "px at 1920w canvas" — 36 (S) / 48 (M) / 64 (L). */
    sizePx: number;
    textColor: string;
    bgColor: string;
    /** 0..1 (RenderSettings uses 0..100; we keep 0..1 internally for direct rgba use). */
    bgOpacity: number;
}

export const CAPTION_SIZE_S = 36;
export const CAPTION_SIZE_M = 48;
export const CAPTION_SIZE_L = 64;

export const DEFAULT_CAPTION_EDITOR_SETTINGS: CaptionEditorSettings = {
    enabled: true,
    position: 'bottom',
    sizePx: CAPTION_SIZE_M,
    textColor: '#ffffff',
    bgColor: '#000000',
    bgOpacity: 0.6,
};

/** Snap any pixel size to the nearest S/M/L bucket. Used when round-tripping
 *  the editor's freeform `sizePx` back to the render dialog's S/M/L toggle. */
export function snapSizeToBucket(px: number): 'S' | 'M' | 'L' {
    const d = (a: number, b: number) => Math.abs(a - b);
    const dS = d(px, CAPTION_SIZE_S);
    const dM = d(px, CAPTION_SIZE_M);
    const dL = d(px, CAPTION_SIZE_L);
    if (dS <= dM && dS <= dL) return 'S';
    if (dL <= dM) return 'L';
    return 'M';
}

// ─── CSS emission (mirrors generate_video.py:1629-1641) ─────────────────────

/**
 * Caption container CSS for the editor canvas.
 *
 * Returns the same style block that generate_video.py emits per frame, with
 * canvas-relative scaling applied so output matches the rendered MP4 at
 * any orientation:
 *   - Landscape (canvasW=1920): font sizes match S/M/L exactly.
 *   - Portrait  (canvasW=1080): font scales by 1080/1920 ≈ 0.5625 (same
 *     ratio applied by generate_video.py:850-854 since canvasW is the
 *     native render width here too).
 *
 * Position: bottom uses `height * 0.074`, top uses `height * 0.037` — the
 * exact numbers from generate_video.py:1623-1627.
 */
export function captionContainerCss(
    settings: CaptionEditorSettings,
    canvasW: number,
    canvasH: number
): CSSProperties {
    const scale = canvasW / 1920;
    // Mirrors `caption_settings["font_size"] = max(12, int(base * scale))`.
    const fontSize = Math.max(12, Math.floor(settings.sizePx * scale));
    const position: CSSProperties =
        settings.position === 'top'
            ? { top: `${Math.floor(canvasH * 0.037)}px`, bottom: 'auto' }
            : { bottom: `${Math.floor(canvasH * 0.074)}px`, top: 'auto' };
    const bg = settings.bgColor.replace(/^#/, '');
    const r = parseInt(bg.slice(0, 2), 16);
    const g = parseInt(bg.slice(2, 4), 16);
    const b = parseInt(bg.slice(4, 6), 16);
    const a = Math.round(settings.bgOpacity * 100) / 100;
    return {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '85%',
        padding: '10px 20px',
        borderRadius: '8px',
        background: `rgba(${r},${g},${b},${a})`,
        textAlign: 'center',
        fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
        fontSize: `${fontSize}px`,
        fontWeight: 400,
        color: settings.textColor,
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.5,
        letterSpacing: '0.02em',
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        ...position,
    };
}

export const CAPTION_INNER_CSS: CSSProperties = {
    display: 'inline-block',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
};
