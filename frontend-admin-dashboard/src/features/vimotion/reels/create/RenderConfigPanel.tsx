/**
 * Collapsible "Customize render" panel that lives above the EnrichedCard
 * list inside `PreviewTray`. Surfaces the slice of `RenderRequest` that
 * users actually care about at render time — aspect, pace, captions,
 * audio.
 *
 * One config applies to whichever candidate the user renders next. This
 * mirrors how the scan request works (set once, applied to all cards) and
 * matches Opus / Vizard / Klap's mental model.
 *
 * Fields NOT surfaced (intentional):
 *   - layout                     only `full_speaker_with_overlays` works today
 *   - branding                   institute-level; configured elsewhere
 *   - visual_preferences         LLM director doesn't read these yet
 *   - audio_strategy=tts_overdub schema-only; not implemented backend-side
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Film, Music, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
    Aspect,
    AudioStrategy,
    CaptionPreset,
    Layout,
    PaceConfig,
    SilenceTrim,
} from '../services/reels-api';

/**
 * Shape the panel produces — a subset of `RenderRequest`. PreviewTray
 * merges this with `input_asset_id` + `candidate_id` before POSTing.
 */
export interface RenderConfigValue {
    aspect: Aspect;
    layout: Layout;
    background_video_url: string | null;
    pace: Required<PaceConfig>;
    audio_strategy: AudioStrategy;
    background_music_url: string | null;
    ducking: boolean;
    captions: {
        enabled: boolean;
        preset: CaptionPreset;
    };
}

/** Defaults that mirror what the FE used to hardcode in `handleRender`. */
export const DEFAULT_RENDER_CONFIG: RenderConfigValue = {
    aspect: '9:16',
    layout: 'full_speaker_with_overlays',
    background_video_url: null,
    pace: {
        silence_trim: 'on',
        speed_multiplier: 1.0,
        word_trim: true,
    },
    audio_strategy: 'keep_speaker',
    background_music_url: null,
    ducking: true,
    captions: {
        enabled: true,
        preset: 'hormozi',
    },
};

/** Layouts the FE surfaces in the picker. The schema knows about more
 *  options (split, lower_third, book_quote) but only these are shipped.
 *  `pip_corner_speaker` ships in its rectangular form here; alpha-matte
 *  cutout PiP is a Phase 2d follow-up. New layouts get appended as they
 *  ship. */
const SHIPPED_LAYOUTS: Array<{ id: Layout; label: string; hint: string }> = [
    {
        id: 'full_speaker_with_overlays',
        label: 'Full speaker',
        hint: 'Speaker fills the frame · overlays + captions on top',
    },
    {
        id: 'stacked_speaker_with_broll',
        label: 'Stacked',
        hint: 'Speaker top half · b-roll video bottom half',
    },
    {
        id: 'pip_corner_speaker',
        label: 'PiP corner',
        hint: 'Speaker in a bottom-right window · b-roll fills the frame',
    },
];

interface RenderConfigPanelProps {
    value: RenderConfigValue;
    onChange: (next: RenderConfigValue) => void;
    /** Disabled while a render is in-flight — prevents config edits from
     *  diverging from what was actually submitted. */
    disabled?: boolean;
}

export function RenderConfigPanel({
    value,
    onChange,
    disabled = false,
}: RenderConfigPanelProps) {
    const [expanded, setExpanded] = useState(false);

    // Compact summary of the current config (shown while collapsed) — gives
    // the user enough signal to know whether they need to crack the panel
    // open before clicking Render.
    const summary = formatSummary(value);

    return (
        <div
            className={cn(
                'rounded-xl border border-neutral-200 bg-white',
                disabled && 'opacity-60 pointer-events-none'
            )}
        >
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
                aria-expanded={expanded}
                aria-controls="render-config-fields"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <Settings className="size-4 shrink-0 text-neutral-500" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                            Customize render
                        </p>
                        <p className="truncate text-xs text-neutral-500">{summary}</p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="size-4 shrink-0 text-neutral-500" />
                ) : (
                    <ChevronDown className="size-4 shrink-0 text-neutral-500" />
                )}
            </button>

            {expanded && (
                <div
                    id="render-config-fields"
                    className="grid gap-5 border-t border-neutral-100 px-5 py-4 sm:grid-cols-2"
                >
                    <AspectGroup
                        value={value.aspect}
                        onChange={(aspect) => onChange({ ...value, aspect })}
                    />
                    <LayoutGroup
                        layout={value.layout}
                        bgvUrl={value.background_video_url}
                        onChange={(patch) => onChange({ ...value, ...patch })}
                    />
                    <PaceGroup
                        value={value.pace}
                        onChange={(pace) => onChange({ ...value, pace })}
                    />
                    <CaptionsGroup
                        value={value.captions}
                        onChange={(captions) => onChange({ ...value, captions })}
                    />
                    <AudioGroup
                        strategy={value.audio_strategy}
                        bgmUrl={value.background_music_url}
                        ducking={value.ducking}
                        onChange={(patch) => onChange({ ...value, ...patch })}
                    />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

function AspectGroup({
    value,
    onChange,
}: {
    value: Aspect;
    onChange: (next: Aspect) => void;
}) {
    const options: Array<{ id: Aspect; label: string; hint: string }> = [
        { id: '9:16', label: '9:16', hint: 'Vertical · TikTok / Reels / Shorts' },
        { id: '16:9', label: '16:9', hint: 'Horizontal · YouTube' },
        { id: '1:1', label: '1:1', hint: 'Square · feed / carousel' },
    ];
    return (
        <Fieldset label="Aspect">
            <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                    <Chip
                        key={o.id}
                        active={value === o.id}
                        onClick={() => onChange(o.id)}
                        title={o.hint}
                    >
                        {o.label}
                    </Chip>
                ))}
            </div>
        </Fieldset>
    );
}

// Layouts that consume the user-supplied background_video_url field.
// Adding a new bgv-dependent layout is a one-line append here.
const LAYOUTS_REQUIRING_BGV: ReadonlySet<Layout> = new Set([
    'stacked_speaker_with_broll',
    'pip_corner_speaker',
]);

function LayoutGroup({
    layout,
    bgvUrl,
    onChange,
}: {
    layout: Layout;
    bgvUrl: string | null;
    onChange: (patch: {
        layout?: Layout;
        background_video_url?: string | null;
    }) => void;
}) {
    const wantsBgv = LAYOUTS_REQUIRING_BGV.has(layout);
    const fillCopy =
        layout === 'pip_corner_speaker'
            ? 'Plays muted + looped behind the speaker. Without a URL, falls back to full-speaker.'
            : 'Plays muted + looped in the bottom half. Without a URL, falls back to full-speaker.';
    return (
        <Fieldset label="Layout">
            <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                    {SHIPPED_LAYOUTS.map((opt) => (
                        <Chip
                            key={opt.id}
                            active={layout === opt.id}
                            onClick={() => onChange({ layout: opt.id })}
                            title={opt.hint}
                        >
                            {opt.label}
                        </Chip>
                    ))}
                </div>
                {wantsBgv && (
                    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
                            <Film className="size-3" />
                            B-roll video URL
                        </label>
                        <input
                            type="url"
                            inputMode="url"
                            placeholder="https://… (mp4, webm)"
                            value={bgvUrl ?? ''}
                            onChange={(e) =>
                                onChange({
                                    background_video_url: e.target.value.trim() || null,
                                })
                            }
                            className="block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
                        />
                        <p className="text-[11px] text-neutral-500">{fillCopy}</p>
                    </div>
                )}
            </div>
        </Fieldset>
    );
}


function PaceGroup({
    value,
    onChange,
}: {
    value: Required<PaceConfig>;
    onChange: (next: Required<PaceConfig>) => void;
}) {
    const trims: Array<{ id: SilenceTrim; label: string; hint: string }> = [
        { id: 'off', label: 'Off', hint: 'Keep all silences' },
        { id: 'gentle', label: 'Gentle', hint: 'Trim >600ms gaps' },
        { id: 'on', label: 'On', hint: 'Trim >400ms gaps · default' },
        { id: 'aggressive', label: 'Aggressive', hint: 'Trim >250ms gaps' },
    ];
    const speeds = [1.0, 1.1, 1.2] as const;
    return (
        <Fieldset label="Pace">
            <div className="space-y-2.5">
                <div>
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
                        Silence trim
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {trims.map((t) => (
                            <Chip
                                key={t.id}
                                active={value.silence_trim === t.id}
                                onClick={() => onChange({ ...value, silence_trim: t.id })}
                                title={t.hint}
                            >
                                {t.label}
                            </Chip>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
                        Speed
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {speeds.map((s) => (
                            <Chip
                                key={s}
                                active={value.speed_multiplier === s}
                                onClick={() => onChange({ ...value, speed_multiplier: s })}
                            >
                                {s.toFixed(1)}×
                            </Chip>
                        ))}
                    </div>
                </div>
                <Toggle
                    label="Drop low-importance words"
                    description="Tighter cuts using the AI cut plan"
                    checked={value.word_trim}
                    onChange={(word_trim) => onChange({ ...value, word_trim })}
                />
            </div>
        </Fieldset>
    );
}

function CaptionsGroup({
    value,
    onChange,
}: {
    value: { enabled: boolean; preset: CaptionPreset };
    onChange: (next: { enabled: boolean; preset: CaptionPreset }) => void;
}) {
    const presets: Array<{ id: CaptionPreset; label: string; hint: string }> = [
        { id: 'hormozi', label: 'Hormozi', hint: 'Bold yellow keywords · default' },
        { id: 'karaoke', label: 'Karaoke', hint: 'Word-by-word fill (Phase 2b)' },
        { id: 'pop', label: 'Pop', hint: 'Punchy single-word style (Phase 2b)' },
        { id: 'clean', label: 'Clean', hint: 'Minimal pill style (Phase 2b)' },
    ];
    return (
        <Fieldset label="Captions">
            <div className="space-y-2.5">
                <Toggle
                    label="Show captions"
                    description="Word-by-word reveal animation"
                    checked={value.enabled}
                    onChange={(enabled) => onChange({ ...value, enabled })}
                />
                {value.enabled && (
                    <div>
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
                            Preset
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {presets.map((p) => (
                                <Chip
                                    key={p.id}
                                    active={value.preset === p.id}
                                    onClick={() => onChange({ ...value, preset: p.id })}
                                    title={p.hint}
                                >
                                    {p.label}
                                </Chip>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Fieldset>
    );
}

function AudioGroup({
    strategy,
    bgmUrl,
    ducking,
    onChange,
}: {
    strategy: AudioStrategy;
    bgmUrl: string | null;
    ducking: boolean;
    onChange: (patch: {
        audio_strategy?: AudioStrategy;
        background_music_url?: string | null;
        ducking?: boolean;
    }) => void;
}) {
    const wantsBgm = strategy === 'keep_speaker_plus_bgm';
    return (
        <Fieldset label="Audio">
            <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                    <Chip
                        active={strategy === 'keep_speaker'}
                        onClick={() => onChange({ audio_strategy: 'keep_speaker' })}
                    >
                        Speaker only
                    </Chip>
                    <Chip
                        active={wantsBgm}
                        onClick={() => onChange({ audio_strategy: 'keep_speaker_plus_bgm' })}
                    >
                        + Background music
                    </Chip>
                </div>
                {wantsBgm && (
                    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
                            <Music className="size-3" />
                            Background music URL
                        </label>
                        <input
                            type="url"
                            inputMode="url"
                            placeholder="https://… (mp3, m4a, ogg)"
                            value={bgmUrl ?? ''}
                            onChange={(e) =>
                                onChange({
                                    background_music_url: e.target.value.trim() || null,
                                })
                            }
                            className="block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
                        />
                        <Toggle
                            label="Duck music under speech"
                            description="Drops bgm volume ~10dB while the speaker is talking"
                            checked={ducking}
                            onChange={(d) => onChange({ ducking: d })}
                        />
                    </div>
                )}
            </div>
        </Fieldset>
    );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Fieldset({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-600">
                {label}
            </p>
            {children}
        </div>
    );
}

function Chip({
    active,
    onClick,
    title,
    children,
}: {
    active: boolean;
    onClick: () => void;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            )}
        >
            {children}
        </button>
    );
}

function Toggle({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-2.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 size-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
            />
            <div className="min-w-0">
                <p className="text-sm text-neutral-900">{label}</p>
                {description && (
                    <p className="text-xs text-neutral-500">{description}</p>
                )}
            </div>
        </label>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSummary(c: RenderConfigValue): string {
    const parts: string[] = [c.aspect];
    if (c.layout === 'stacked_speaker_with_broll') {
        parts.push(c.background_video_url ? 'stacked + b-roll' : 'stacked (no URL)');
    } else if (c.layout === 'pip_corner_speaker') {
        parts.push(c.background_video_url ? 'pip + b-roll' : 'pip (no URL)');
    }
    if (c.pace.silence_trim !== 'on') parts.push(`silence: ${c.pace.silence_trim}`);
    if (c.pace.speed_multiplier !== 1.0) parts.push(`${c.pace.speed_multiplier.toFixed(1)}×`);
    if (!c.pace.word_trim) parts.push('no word-trim');
    if (!c.captions.enabled) parts.push('no captions');
    else if (c.captions.preset !== 'hormozi') parts.push(`captions: ${c.captions.preset}`);
    if (c.audio_strategy === 'keep_speaker_plus_bgm') {
        parts.push(c.background_music_url ? 'bgm + ducking' : 'bgm (no URL)');
    }
    return parts.join(' · ');
}
