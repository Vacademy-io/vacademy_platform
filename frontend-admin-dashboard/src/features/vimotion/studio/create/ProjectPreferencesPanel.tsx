/**
 * Project-level preferences editor (P1.5).
 *
 * Controlled component — owns no state; parent holds `ProjectPreferences` and
 * gets `onChange` deltas. Every field is optional; leaving a row on "Auto"
 * sends null/omits it so the LLM decides per project. These preferences are
 * fed verbatim into every wizard step's LLM prompt (see AI_VIDEO_STUDIO.md §13.2).
 */
import { useState } from 'react';
import { CaretDown, CaretRight, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
    BgmPolicy,
    CaptionPreset,
    CutAggressiveness,
    ProjectPreferences,
    SfxPolicy,
    TransitionStyle,
} from '../services/studio-api';

interface ProjectPreferencesPanelProps {
    value: ProjectPreferences;
    onChange: (next: ProjectPreferences) => void;
}

const CUT_OPTS: Array<{ id: CutAggressiveness; label: string }> = [
    { id: 'light', label: 'Light' },
    { id: 'medium', label: 'Medium' },
    { id: 'aggressive', label: 'Aggressive' },
];
const CAPTION_OPTS: Array<{ id: CaptionPreset; label: string }> = [
    { id: 'hormozi', label: 'Hormozi' },
    { id: 'karaoke', label: 'Karaoke' },
    { id: 'pop', label: 'Pop' },
    { id: 'clean', label: 'Clean' },
    { id: 'none', label: 'No captions' },
];
const POLICY_OPTS: Array<{ id: BgmPolicy; label: string }> = [
    { id: 'auto', label: 'Auto' },
    { id: 'always', label: 'Always' },
    { id: 'never', label: 'Never' },
];
const TRANSITION_OPTS: Array<{ id: TransitionStyle; label: string }> = [
    { id: 'cuts_only', label: 'Cuts only' },
    { id: 'smooth', label: 'Smooth' },
    { id: 'energetic', label: 'Energetic' },
];

export function ProjectPreferencesPanel({
    value,
    onChange,
}: ProjectPreferencesPanelProps) {
    const [open, setOpen] = useState(false);
    const [colorInput, setColorInput] = useState('');

    const set = <K extends keyof ProjectPreferences>(
        key: K,
        v: ProjectPreferences[K]
    ) => onChange({ ...value, [key]: v });

    // A null toggle: clicking the active chip again clears it back to Auto.
    const toggle = <K extends keyof ProjectPreferences>(
        key: K,
        v: NonNullable<ProjectPreferences[K]>
    ) => set(key, (value[key] === v ? null : v) as ProjectPreferences[K]);

    const addColor = () => {
        const c = colorInput.trim();
        if (!c) return;
        const existing = value.color_scheme_hints ?? [];
        if (existing.length >= 8 || existing.includes(c)) return;
        set('color_scheme_hints', [...existing, c]);
        setColorInput('');
    };

    const removeColor = (c: string) =>
        set(
            'color_scheme_hints',
            (value.color_scheme_hints ?? []).filter((x) => x !== c)
        );

    return (
        <div className="rounded-lg border border-neutral-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <span className="text-sm font-semibold text-neutral-900">
                    Style preferences
                    <span className="ml-2 font-normal text-neutral-500">
                        optional — the AI decides what you leave on Auto
                    </span>
                </span>
                {open ? (
                    <CaretDown className="size-4 text-neutral-500" />
                ) : (
                    <CaretRight className="size-4 text-neutral-500" />
                )}
            </button>

            {open && (
                <div className="space-y-4 border-t border-neutral-200 px-4 py-4">
                    <Row label="Cut aggressiveness">
                        <ChipRow>
                            {CUT_OPTS.map((o) => (
                                <PrefChip
                                    key={o.id}
                                    active={value.cut_aggressiveness === o.id}
                                    onClick={() => toggle('cut_aggressiveness', o.id)}
                                >
                                    {o.label}
                                </PrefChip>
                            ))}
                        </ChipRow>
                    </Row>

                    <Row label="Captions">
                        <ChipRow>
                            {CAPTION_OPTS.map((o) => (
                                <PrefChip
                                    key={o.id}
                                    active={value.caption_preset === o.id}
                                    onClick={() => toggle('caption_preset', o.id)}
                                >
                                    {o.label}
                                </PrefChip>
                            ))}
                        </ChipRow>
                    </Row>

                    <Row label="Background music">
                        <ChipRow>
                            {POLICY_OPTS.map((o) => (
                                <PrefChip
                                    key={o.id}
                                    active={value.bgm_policy === o.id}
                                    onClick={() => toggle('bgm_policy', o.id)}
                                >
                                    {o.label}
                                </PrefChip>
                            ))}
                        </ChipRow>
                    </Row>

                    <Row label="Sound effects">
                        <ChipRow>
                            {POLICY_OPTS.map((o) => (
                                <PrefChip
                                    key={o.id}
                                    active={value.sfx_policy === o.id}
                                    onClick={() =>
                                        toggle('sfx_policy', o.id as SfxPolicy)
                                    }
                                >
                                    {o.label}
                                </PrefChip>
                            ))}
                        </ChipRow>
                    </Row>

                    <Row label="Transitions">
                        <ChipRow>
                            {TRANSITION_OPTS.map((o) => (
                                <PrefChip
                                    key={o.id}
                                    active={value.transition_style === o.id}
                                    onClick={() => toggle('transition_style', o.id)}
                                >
                                    {o.label}
                                </PrefChip>
                            ))}
                        </ChipRow>
                    </Row>

                    <Row label="Tone">
                        <input
                            value={value.tone ?? ''}
                            onChange={(e) =>
                                set('tone', e.target.value || null)
                            }
                            maxLength={120}
                            placeholder="energetic, calm, professional…"
                            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        />
                    </Row>

                    <Row label="Color hints">
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    value={colorInput}
                                    onChange={(e) => setColorInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addColor();
                                        }
                                    }}
                                    placeholder="indigo, midnight blue…"
                                    className="h-9 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                                />
                                <button
                                    type="button"
                                    onClick={addColor}
                                    disabled={(value.color_scheme_hints ?? []).length >= 8}
                                    className="h-9 rounded-md bg-neutral-100 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                            {(value.color_scheme_hints ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {(value.color_scheme_hints ?? []).map((c) => (
                                        <span
                                            key={c}
                                            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-700"
                                        >
                                            {c}
                                            <button
                                                type="button"
                                                onClick={() => removeColor(c)}
                                                className="text-neutral-400 hover:text-neutral-700"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Row>

                    <Row label="Notes">
                        <textarea
                            value={value.notes ?? ''}
                            onChange={(e) =>
                                set('notes', e.target.value || null)
                            }
                            rows={2}
                            maxLength={4000}
                            placeholder="Anything else the AI should keep in mind across the whole video…"
                            className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        />
                    </Row>
                </div>
            )}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start sm:gap-3">
            <span className="pt-1 text-sm font-medium text-neutral-700">
                {label}
            </span>
            <div>{children}</div>
        </div>
    );
}

function ChipRow({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function PrefChip({
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
                'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            )}
        >
            {children}
        </button>
    );
}
