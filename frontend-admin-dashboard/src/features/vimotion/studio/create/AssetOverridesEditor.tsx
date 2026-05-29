/**
 * Per-asset overrides editor (P1.5).
 *
 * Controlled — parent owns the `AssetOverrides` for one picked asset. Renders
 * inside the expanded asset card. Lets the user pre-empt the wizard with
 * known constraints: clip to a range, exclude ranges, use only audio/video,
 * tag the primary speaker face, or leave a per-asset note.
 *
 * `durationS` (if known from the indexed asset) bounds the range inputs and
 * is shown as a hint. Validation mirrors the backend AssetOverrides validator
 * (0 <= start < end; audio_only XOR video_only).
 */
import { Plus, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { AssetKind, AssetOverrides } from '../services/studio-api';

interface AssetOverridesEditorProps {
    kind: AssetKind;
    durationS?: number | null;
    value: AssetOverrides;
    onChange: (next: AssetOverrides) => void;
}

const EMPTY: AssetOverrides = {};

export function AssetOverridesEditor({
    kind,
    durationS,
    value,
    onChange,
}: AssetOverridesEditorProps) {
    // Images have no timeline — only notes apply.
    const isVideo = kind === 'video';

    const set = <K extends keyof AssetOverrides>(
        key: K,
        v: AssetOverrides[K]
    ) => onChange({ ...value, [key]: v });

    const rangeStart = value.initial_range_s?.[0];
    const rangeEnd = value.initial_range_s?.[1];

    const setRange = (which: 0 | 1, raw: string) => {
        const n = raw === '' ? undefined : Number(raw);
        const cur = value.initial_range_s ?? [0, durationS ?? 0];
        const next: [number, number] = [...cur] as [number, number];
        if (n === undefined) {
            // Clearing either bound drops the whole range override.
            set('initial_range_s', null);
            return;
        }
        next[which] = n;
        set('initial_range_s', next);
    };

    const rangeInvalid =
        rangeStart !== undefined &&
        rangeEnd !== undefined &&
        !(rangeEnd > rangeStart && rangeStart >= 0);

    const addExclude = () =>
        set('exclude_ranges_s', [...(value.exclude_ranges_s ?? []), [0, 0]]);

    const setExclude = (i: number, which: 0 | 1, raw: string) => {
        const n = raw === '' ? 0 : Number(raw);
        const list = (value.exclude_ranges_s ?? []).map(
            (r) => [...r] as [number, number]
        );
        const row = list[i];
        if (!row) return;
        row[which] = n;
        set('exclude_ranges_s', list);
    };

    const removeExclude = (i: number) =>
        set(
            'exclude_ranges_s',
            (value.exclude_ranges_s ?? []).filter((_, idx) => idx !== i)
        );

    const setStream = (stream: 'audio_only' | 'video_only', on: boolean) => {
        // Mutually exclusive — turning one on clears the other.
        if (on) {
            onChange({
                ...value,
                audio_only: stream === 'audio_only',
                video_only: stream === 'video_only',
            });
        } else {
            set(stream, false);
        }
    };

    return (
        <div className="space-y-3 border-t border-neutral-200 pt-3">
            {isVideo && (
                <>
                    {/* Initial range */}
                    <div>
                        <span className="mb-1 block text-caption font-medium text-neutral-600">
                            Use only this range (seconds)
                            {durationS ? ` — full length ${Math.round(durationS)}s` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                            <NumInput
                                placeholder="start"
                                value={rangeStart}
                                onChange={(v) => setRange(0, v)}
                            />
                            <span className="text-caption text-neutral-400">to</span>
                            <NumInput
                                placeholder="end"
                                value={rangeEnd}
                                onChange={(v) => setRange(1, v)}
                            />
                            {(rangeStart !== undefined || rangeEnd !== undefined) && (
                                <button
                                    type="button"
                                    onClick={() => set('initial_range_s', null)}
                                    className="text-caption text-neutral-400 hover:text-neutral-700"
                                >
                                    clear
                                </button>
                            )}
                        </div>
                        {rangeInvalid && (
                            <p className="mt-1 text-caption text-rose-600">
                                End must be greater than start, start ≥ 0.
                            </p>
                        )}
                    </div>

                    {/* Exclude ranges */}
                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-caption font-medium text-neutral-600">
                                Always exclude these ranges
                            </span>
                            <button
                                type="button"
                                onClick={addExclude}
                                className="inline-flex items-center gap-1 text-caption text-neutral-600 hover:text-neutral-900"
                            >
                                <Plus className="size-3" /> Add
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {(value.exclude_ranges_s ?? []).map((r, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <NumInput
                                        placeholder="start"
                                        value={r[0]}
                                        onChange={(v) => setExclude(i, 0, v)}
                                    />
                                    <span className="text-caption text-neutral-400">to</span>
                                    <NumInput
                                        placeholder="end"
                                        value={r[1]}
                                        onChange={(v) => setExclude(i, 1, v)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeExclude(i)}
                                        className="text-neutral-400 hover:text-rose-600"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stream */}
                    <div>
                        <span className="mb-1 block text-caption font-medium text-neutral-600">
                            Use stream
                        </span>
                        <div className="flex gap-1.5">
                            <StreamChip
                                active={!value.audio_only && !value.video_only}
                                onClick={() =>
                                    onChange({
                                        ...value,
                                        audio_only: false,
                                        video_only: false,
                                    })
                                }
                            >
                                Both
                            </StreamChip>
                            <StreamChip
                                active={!!value.audio_only}
                                onClick={() =>
                                    setStream('audio_only', !value.audio_only)
                                }
                            >
                                Audio only
                            </StreamChip>
                            <StreamChip
                                active={!!value.video_only}
                                onClick={() =>
                                    setStream('video_only', !value.video_only)
                                }
                            >
                                Video only
                            </StreamChip>
                        </div>
                    </div>

                    {/* Speaker face */}
                    <div>
                        <span className="mb-1 block text-caption font-medium text-neutral-600">
                            Primary speaker tag (for reframing)
                        </span>
                        <input
                            value={value.primary_speaker_face_id ?? ''}
                            onChange={(e) =>
                                set(
                                    'primary_speaker_face_id',
                                    e.target.value || null
                                )
                            }
                            placeholder="e.g. host, alice"
                            className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-caption text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        />
                    </div>
                </>
            )}

            {/* Notes — applies to both video + image */}
            <div>
                <span className="mb-1 block text-caption font-medium text-neutral-600">
                    Note for the AI
                </span>
                <textarea
                    value={value.notes ?? ''}
                    onChange={(e) => set('notes', e.target.value || null)}
                    rows={2}
                    maxLength={2000}
                    placeholder={
                        isVideo
                            ? 'e.g. the partnership bit starts ~7:30 — emphasize it'
                            : 'e.g. use this as the closing logo'
                    }
                    className="w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-caption text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
            </div>
        </div>
    );
}

/** True when the overrides object carries any non-default value (drives the
 *  "edited" badge on the asset card). */
export function hasOverrides(o: AssetOverrides | undefined): boolean {
    if (!o) return false;
    return (
        !!o.initial_range_s ||
        (o.exclude_ranges_s?.length ?? 0) > 0 ||
        !!o.audio_only ||
        !!o.video_only ||
        !!o.primary_speaker_face_id ||
        !!o.notes
    );
}

export { EMPTY as EMPTY_OVERRIDES };

function NumInput({
    value,
    placeholder,
    onChange,
}: {
    value: number | undefined;
    placeholder: string;
    onChange: (raw: string) => void;
}) {
    return (
        <input
            type="number"
            min={0}
            step="0.1"
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-24 rounded-md border border-neutral-300 bg-white px-2 text-caption text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
    );
}

function StreamChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex h-7 items-center rounded-full px-2.5 text-caption font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            )}
        >
            {children}
        </button>
    );
}
