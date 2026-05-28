/**
 * Caption style presets.
 *
 * Each preset is a fully-specified `Partial<CaptionEditorSettings>` (every field
 * the preset cares about — `enabled` and `position` are intentionally NOT in
 * the preset because they're orthogonal to "style"). `applyPreset` overlays the
 * preset over the current settings, preserving `enabled` and `position` so
 * picking a preset doesn't unexpectedly hide captions or flip top↔bottom.
 *
 * The rendered output reads the resolved field values, never the `preset`
 * label — the label is informational only. `detectPreset` derives the label
 * by structural compare so the chip UI stays accurate even after the user
 * tweaks one field past a preset (returns `'custom'`).
 *
 * Presets MUST stay in lockstep with the render server's defaults in
 * `generate_video.py:_load_caption_settings` so the editor preview and the
 * MP4 output match byte-for-byte.
 */
import {
    CaptionEditorSettings,
    CaptionPreset,
    DEFAULT_CAPTION_EDITOR_SETTINGS,
    CAPTION_SIZE_M,
    CAPTION_SIZE_L,
    CAPTION_SIZE_S,
} from './caption-rendering';

/** Subset of CaptionEditorSettings that a preset cares about. `enabled` and
 *  `position` are orthogonal to "style" and are preserved across preset picks. */
export type CaptionPresetFields = Pick<
    CaptionEditorSettings,
    | 'sizePx'
    | 'textColor'
    | 'bgColor'
    | 'bgOpacity'
    | 'style'
    | 'fontFamily'
    | 'fontWeight'
    | 'textStrokeWidth'
    | 'textStrokeColor'
    | 'highlightColor'
>;

/**
 * Optional palette hint from `meta.palette`. Used by the 'branded' preset to
 * derive text + stroke colors from the institute's brand palette.
 */
export interface CaptionPresetPalette {
    text?: string;
    primary?: string;
    accent?: string;
}

/** Named preset config — concrete field values for each of the five canonical styles. */
export const CAPTION_PRESETS: Record<
    Exclude<CaptionPreset, 'custom' | 'branded'>,
    CaptionPresetFields
> = {
    youtube: {
        sizePx: CAPTION_SIZE_M,
        textColor: '#ffffff',
        bgColor: '#000000',
        bgOpacity: 0.6,
        style: 'phrase',
        // 'system' (not 'inter') so this preset matches the pre-feature
        // default rendering exactly — otherwise a fresh state with
        // `fontFamily:'system'` would detect as 'custom' and the chip row
        // would mis-show "Custom" on first load.
        fontFamily: 'system',
        fontWeight: 400,
        textStrokeWidth: 0,
        textStrokeColor: '#000000',
        highlightColor: '#fbbf24',
    },
    tiktok: {
        sizePx: CAPTION_SIZE_L,
        textColor: '#ffffff',
        bgColor: '#000000',
        bgOpacity: 0,
        style: 'phrase',
        fontFamily: 'montserrat',
        fontWeight: 900,
        textStrokeWidth: 5,
        textStrokeColor: '#000000',
        highlightColor: '#fbbf24',
    },
    karaoke: {
        // 64 (L bucket) not 56 — the render dialog's CaptionSize toggle only
        // emits S/M/L, so an off-bucket value can't round-trip through the
        // dialog without snapping. Pick the closest bucket so picking
        // Karaoke in either UI produces the same final settings.
        sizePx: CAPTION_SIZE_L,
        textColor: '#ffffff',
        bgColor: '#000000',
        bgOpacity: 0,
        style: 'karaoke',
        fontFamily: 'inter',
        fontWeight: 600,
        textStrokeWidth: 4,
        textStrokeColor: '#000000',
        highlightColor: '#fbbf24',
    },
    cinema: {
        sizePx: CAPTION_SIZE_S,
        textColor: '#e5e7eb',
        bgColor: '#000000',
        bgOpacity: 0,
        style: 'phrase',
        fontFamily: 'inter',
        fontWeight: 400,
        textStrokeWidth: 0,
        textStrokeColor: '#000000',
        highlightColor: '#fbbf24',
    },
};

/** Human-friendly labels for the preset chip row. */
export const CAPTION_PRESET_LABELS: Record<CaptionPreset, string> = {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    karaoke: 'Karaoke',
    cinema: 'Cinema',
    branded: 'Branded',
    custom: 'Custom',
};

/**
 * Resolve the 'branded' preset using the active video's palette. Falls back
 * to YouTube defaults when the palette is empty or missing — never blanks the
 * captions.
 */
function brandedPreset(palette: CaptionPresetPalette | undefined): CaptionPresetFields {
    const base = CAPTION_PRESETS.youtube;
    if (!palette) return base;
    const text = palette.text ?? base.textColor;
    const stroke = palette.primary ?? palette.accent ?? base.textStrokeColor;
    return {
        ...base,
        textColor: text,
        bgOpacity: 0,
        textStrokeWidth: 3,
        textStrokeColor: stroke,
        highlightColor: palette.primary ?? palette.accent ?? base.highlightColor,
    };
}

/**
 * Apply a preset to the current settings, preserving `enabled` and `position`.
 * Returns a fully-resolved CaptionEditorSettings; caller passes to the store
 * via `setCaptionSettings`.
 */
export function applyCaptionPreset(
    name: CaptionPreset,
    current: CaptionEditorSettings,
    palette?: CaptionPresetPalette
): CaptionEditorSettings {
    if (name === 'custom') {
        return { ...current, preset: 'custom' };
    }
    const fields: CaptionPresetFields =
        name === 'branded' ? brandedPreset(palette) : CAPTION_PRESETS[name];
    return {
        ...current,
        ...fields,
        preset: name,
    };
}

const PRESET_COMPARE_KEYS: (keyof CaptionPresetFields)[] = [
    'sizePx',
    'textColor',
    'bgColor',
    'bgOpacity',
    'style',
    'fontFamily',
    'fontWeight',
    'textStrokeWidth',
    'textStrokeColor',
    'highlightColor',
];

function presetsEqual(a: CaptionPresetFields, b: CaptionEditorSettings): boolean {
    for (const k of PRESET_COMPARE_KEYS) {
        if (a[k] !== b[k]) return false;
    }
    return true;
}

/**
 * Derive which preset (if any) matches the current settings. Returns 'custom'
 * when the user has tweaked any field past every named preset. Used by the
 * chip-row UI to highlight the active preset.
 *
 * `branded` is derivable only when a palette is supplied (else we can't
 * compute its target field values to compare). When palette is omitted and
 * settings don't match any other preset, returns 'custom'.
 */
export function detectCaptionPreset(
    settings: CaptionEditorSettings,
    palette?: CaptionPresetPalette
): CaptionPreset {
    if (presetsEqual(CAPTION_PRESETS.youtube, settings)) return 'youtube';
    if (presetsEqual(CAPTION_PRESETS.tiktok, settings)) return 'tiktok';
    if (presetsEqual(CAPTION_PRESETS.karaoke, settings)) return 'karaoke';
    if (presetsEqual(CAPTION_PRESETS.cinema, settings)) return 'cinema';
    if (palette && presetsEqual(brandedPreset(palette), settings)) return 'branded';
    return 'custom';
}

/** The order to display preset chips in the UI. 'custom' is conditionally shown. */
export const CAPTION_PRESET_ORDER: CaptionPreset[] = [
    'youtube',
    'tiktok',
    'karaoke',
    'cinema',
    'branded',
];

// ─── Render dialog interop ──────────────────────────────────────────────────
//
// The render dialog uses a parallel shape (`RenderSettings`) with `caption*`
// prefixes and a coarser `captionSize: 'S' | 'M' | 'L'` instead of a freeform
// `sizePx`. These helpers let the dialog reuse the same preset definitions
// without duplicating the field values.

import type {
    RenderSettings,
    CaptionSize,
} from '@/routes/video-api-studio/-services/video-generation';
import { snapSizeToBucket } from './caption-rendering';

/** Apply a preset to a RenderSettings object, preserving non-caption fields
 *  (resolution, fps, watermark, captions on/off, position). */
export function applyCaptionPresetToRender(
    name: CaptionPreset,
    current: RenderSettings,
    palette?: CaptionPresetPalette
): RenderSettings {
    if (name === 'custom') {
        return { ...current, captionPreset: 'custom' };
    }
    const fields: CaptionPresetFields =
        name === 'branded' ? brandedPreset(palette) : CAPTION_PRESETS[name];
    const captionSize: CaptionSize = snapSizeToBucket(fields.sizePx);
    return {
        ...current,
        captionTextColor: fields.textColor,
        captionBgColor: fields.bgColor,
        captionBgOpacity: Math.round(fields.bgOpacity * 100),
        captionSize,
        captionStyle: fields.style,
        captionFontFamily: fields.fontFamily,
        captionFontWeight: fields.fontWeight,
        captionTextStrokeWidth: fields.textStrokeWidth,
        captionTextStrokeColor: fields.textStrokeColor,
        captionHighlightColor: fields.highlightColor,
        captionPreset: name,
    };
}

/** Derive the active preset for a RenderSettings object. Used by the dialog's
 *  chip row to show which preset is currently selected. */
export function detectCaptionPresetFromRender(
    settings: RenderSettings,
    palette?: CaptionPresetPalette
): CaptionPreset {
    // Project the render fields back into the editor's shape for comparison.
    // Note: we tolerate a ±6px size variance (the same tolerance as
    // `snapSizeToBucket`) so a preset matches even if the user picked S/M/L
    // and the preset's exact sizePx differs by < 6.
    const asEditor: CaptionEditorSettings = {
        enabled: settings.captions,
        position: settings.captionPosition,
        sizePx: bucketToSizePx(settings.captionSize),
        textColor: settings.captionTextColor,
        bgColor: settings.captionBgColor,
        bgOpacity: settings.captionBgOpacity / 100,
        style: settings.captionStyle,
        fontFamily: settings.captionFontFamily,
        fontWeight: settings.captionFontWeight,
        textStrokeWidth: settings.captionTextStrokeWidth,
        textStrokeColor: settings.captionTextStrokeColor,
        highlightColor: settings.captionHighlightColor,
        preset: settings.captionPreset,
    };
    return detectCaptionPreset(asEditor, palette);
}

function bucketToSizePx(bucket: CaptionSize): number {
    switch (bucket) {
        case 'S':
            return CAPTION_SIZE_S;
        case 'L':
            return CAPTION_SIZE_L;
        case 'M':
        default:
            return CAPTION_SIZE_M;
    }
}

// Backward-compat sanity: presets resolve to the same defaults as the
// store's `DEFAULT_CAPTION_EDITOR_SETTINGS` when the YouTube preset is
// applied — guarantees that picking YouTube after a tweak gives the user
// the exact pre-feature appearance.
void DEFAULT_CAPTION_EDITOR_SETTINGS;
