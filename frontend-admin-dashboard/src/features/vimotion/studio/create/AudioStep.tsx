/**
 * Wizard Step 4 — AUDIO (P7).
 *
 * On entry, plans this step: `propose_bgm` (LLM, one music bed for the whole
 * video) + `propose_sfx` (deterministic whoosh-at-cuts config honoring the
 * project's sfx_policy). The user toggles/edits both cards, can paste their
 * own music URL (which wins over generation), refines with a prompt, then
 * confirms.
 *
 * Confirm follows the captions precedent (OverlaysStep): the bgm + sfx config
 * ops ALWAYS ride along — `enabled` records the on/off choice the build's
 * ASSEMBLE_AUDIO stage reads. A custom URL goes to `manual_operations` as
 * `manual_bgm` (build uses it as-is, no generation).
 */
import { useEffect, useRef, useState } from 'react';
import { MagicWand, MusicNotes, Waveform } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useWizardStep } from '../hooks/useWizardStep';
import type {
    ConfirmedStepPlan,
    OperationSpec,
    SfxPlacement,
    WizardStepPlan,
} from '../services/studio-api';

interface AudioStepProps {
    apiKey: string;
    instituteId: string | undefined;
    projectId: string;
    onConfirmed: () => void;
}

const VOLUME_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 0.08, label: 'Subtle' },
    { value: 0.12, label: 'Balanced' },
    { value: 0.2, label: 'Prominent' },
];

const PLACEMENT_OPTIONS: Array<{ value: SfxPlacement; label: string }> = [
    { value: 'segment_boundaries', label: 'At segment changes' },
    { value: 'all_cuts', label: 'At every cut' },
];

/** Snap an arbitrary proposed volume onto the closest select option. */
function snapVolume(v: unknown): number {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0.12;
    return VOLUME_OPTIONS.reduce(
        (best, opt) => (Math.abs(opt.value - n) < Math.abs(best - n) ? opt.value : best),
        VOLUME_OPTIONS[1]!.value
    );
}

interface BgmState {
    enabled: boolean;
    mood: string;
    musicPrompt: string;
    volume: number;
}

interface SfxState {
    enabled: boolean;
    placement: SfxPlacement;
}

function extractBgm(plan: WizardStepPlan | undefined): BgmState | null {
    const op = plan?.operations?.find((o) => o.tool === 'propose_bgm');
    if (!op) return null;
    const p = op.params ?? {};
    return {
        enabled: Boolean(p.enabled),
        mood: typeof p.mood === 'string' ? p.mood : '',
        musicPrompt: typeof p.music_prompt === 'string' ? p.music_prompt : '',
        volume: snapVolume(p.volume),
    };
}

function extractSfx(plan: WizardStepPlan | undefined): SfxState | null {
    const op = plan?.operations?.find((o) => o.tool === 'propose_sfx');
    if (!op) return null;
    const p = op.params ?? {};
    return {
        enabled: Boolean(p.enabled),
        placement: p.placement === 'all_cuts' ? 'all_cuts' : 'segment_boundaries',
    };
}

export function AudioStep({ apiKey, instituteId, projectId, onConfirmed }: AudioStepProps) {
    const { plan, refine, confirm } = useWizardStep({
        apiKey,
        instituteId,
        projectId,
        step: 'audio',
    });

    const [bgm, setBgm] = useState<BgmState>({
        enabled: false,
        mood: '',
        musicPrompt: '',
        volume: 0.12,
    });
    const [sfx, setSfx] = useState<SfxState>({
        enabled: false,
        placement: 'segment_boundaries',
    });
    const [customUrl, setCustomUrl] = useState('');
    const [notes, setNotes] = useState<string | null>(null);
    const [refinePrompt, setRefinePrompt] = useState('');
    const plannedRef = useRef(false);

    const hydrate = (p: WizardStepPlan) => {
        setNotes(p.notes ?? null);
        const b = extractBgm(p);
        if (b) setBgm(b);
        const s = extractSfx(p);
        if (s) setSfx(s);
    };

    useEffect(() => {
        if (plannedRef.current || !apiKey) return;
        plannedRef.current = true;
        plan.mutate(
            {},
            {
                onSuccess: hydrate,
                onError: (e) =>
                    toast.error(e instanceof Error ? e.message : 'Could not plan the audio.'),
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const doRefine = () => {
        const prompt = refinePrompt.trim();
        if (!prompt) return;
        refine.mutate(prompt, {
            onSuccess: (p) => {
                hydrate(p);
                setRefinePrompt('');
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : 'Refine failed.'),
        });
    };

    const doConfirm = () => {
        const url = customUrl.trim();
        if (url && !/^https?:\/\//i.test(url)) {
            toast.error('Custom music must be an http(s) URL.');
            return;
        }

        // Config always rides along — `enabled` records the user's choice for
        // the build's ASSEMBLE_AUDIO stage (captions precedent).
        const operations: OperationSpec[] = [
            {
                tool: 'propose_bgm',
                params: {
                    enabled: bgm.enabled,
                    mood: bgm.mood.trim() || 'neutral ambient',
                    music_prompt: bgm.musicPrompt.trim() || bgm.mood.trim() || 'neutral ambient',
                    volume: bgm.volume,
                },
            },
            {
                tool: 'propose_sfx',
                params: {
                    enabled: sfx.enabled,
                    placement: sfx.placement,
                    volume_db: -10,
                },
            },
        ];
        const manualOps: OperationSpec[] = url
            ? [{ tool: 'manual_bgm', params: { url, volume: bgm.volume } }]
            : [];

        const confirmed: ConfirmedStepPlan = {
            step: 'audio',
            operations,
            decisions: operations.map((_, i) => ({
                operation_index: i,
                action: 'accepted',
            })),
            manual_operations: manualOps,
            operation_order: null,
            skipped: false,
        };
        confirm.mutate(confirmed, {
            onSuccess: () => {
                toast.success(
                    bgm.enabled || url || sfx.enabled
                        ? 'Soundtrack saved.'
                        : 'No music or effects — moving on.'
                );
                onConfirmed();
            },
            onError: (e) =>
                toast.error(e instanceof Error ? e.message : 'Could not save the audio step.'),
        });
    };

    const planning = plan.isPending && !plan.data;
    const usingCustom = Boolean(customUrl.trim());

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-lg font-semibold text-neutral-900">Audio</h2>
                <p className="mt-1 text-sm text-neutral-600">
                    Your clips keep their own voices — this step adds an optional music bed and
                    subtle whooshes at the cuts.
                </p>
            </header>

            {planning ? (
                <AnalyzingState />
            ) : (
                <>
                    {notes && (
                        <div className="flex items-start gap-2 rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">
                            <MusicNotes weight="fill" className="mt-0.5 size-4 shrink-0" />
                            <span>{notes}</span>
                        </div>
                    )}

                    {/* Background music */}
                    <div className="space-y-3 rounded-md border border-neutral-200 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                                <input
                                    type="checkbox"
                                    checked={bgm.enabled || usingCustom}
                                    disabled={usingCustom}
                                    onChange={(e) =>
                                        setBgm((prev) => ({ ...prev, enabled: e.target.checked }))
                                    }
                                    className="size-4 accent-neutral-900"
                                />
                                <MusicNotes weight="fill" className="size-4 text-neutral-500" />
                                Background music
                            </label>
                            <span className="text-caption text-neutral-500">
                                One generated bed under the whole video, mixed quietly.
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                                <span className="text-caption text-neutral-500">Level</span>
                                <select
                                    value={bgm.volume}
                                    onChange={(e) =>
                                        setBgm((prev) => ({
                                            ...prev,
                                            volume: Number(e.target.value),
                                        }))
                                    }
                                    disabled={!bgm.enabled && !usingCustom}
                                    className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-caption text-neutral-700 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
                                >
                                    {VOLUME_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <label className="flex min-w-40 flex-1 flex-col gap-1">
                                <span className="text-caption text-neutral-500">Mood</span>
                                <input
                                    type="text"
                                    value={bgm.mood}
                                    onChange={(e) =>
                                        setBgm((prev) => ({ ...prev, mood: e.target.value }))
                                    }
                                    disabled={!bgm.enabled || usingCustom}
                                    placeholder="e.g. uplifting corporate"
                                    className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
                                />
                            </label>
                            <label className="flex min-w-56 flex-[2] flex-col gap-1">
                                <span className="text-caption text-neutral-500">
                                    Music description
                                </span>
                                <input
                                    type="text"
                                    value={bgm.musicPrompt}
                                    onChange={(e) =>
                                        setBgm((prev) => ({
                                            ...prev,
                                            musicPrompt: e.target.value,
                                        }))
                                    }
                                    disabled={!bgm.enabled || usingCustom}
                                    placeholder="e.g. warm ambient electronic, soft pads, no vocals"
                                    className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
                                />
                            </label>
                        </div>

                        <label className="flex flex-col gap-1">
                            <span className="text-caption text-neutral-500">
                                Or use your own track (http(s) URL — skips generation)
                            </span>
                            <input
                                type="url"
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder="https://…/music.mp3"
                                className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                            />
                        </label>
                    </div>

                    {/* Sound effects */}
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                            <input
                                type="checkbox"
                                checked={sfx.enabled}
                                onChange={(e) =>
                                    setSfx((prev) => ({ ...prev, enabled: e.target.checked }))
                                }
                                className="size-4 accent-neutral-900"
                            />
                            <Waveform weight="fill" className="size-4 text-neutral-500" />
                            Sound effects
                        </label>
                        <span className="text-caption text-neutral-500">
                            A subtle whoosh marking the edit points.
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-caption text-neutral-500">Place</span>
                            <select
                                value={sfx.placement}
                                onChange={(e) =>
                                    setSfx((prev) => ({
                                        ...prev,
                                        placement: e.target.value as SfxPlacement,
                                    }))
                                }
                                disabled={!sfx.enabled}
                                className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-caption text-neutral-700 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
                            >
                                {PLACEMENT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Refine with a prompt */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-64 flex-1">
                            <MagicWand className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                value={refinePrompt}
                                onChange={(e) => setRefinePrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && doRefine()}
                                placeholder="Refine, e.g. “calmer music, more cinematic”"
                                className="h-9 w-full rounded-md border border-neutral-300 bg-white pl-8 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={doRefine}
                            disabled={refine.isPending || !refinePrompt.trim()}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {refine.isPending ? 'Refining…' : 'Refine'}
                        </button>
                    </div>
                </>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <span className="text-sm text-neutral-500">
                    {usingCustom ? 'Using your track' : bgm.enabled ? 'Music on' : 'Music off'}
                    {' · '}
                    {sfx.enabled ? 'Effects on' : 'Effects off'}
                </span>
                <button
                    type="button"
                    onClick={doConfirm}
                    disabled={confirm.isPending || planning}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {confirm.isPending ? 'Saving…' : 'Confirm & continue'}
                </button>
            </div>
        </div>
    );
}

function AnalyzingState() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 py-12">
            <MusicNotes weight="duotone" className="size-8 animate-pulse text-neutral-400" />
            <p className="text-sm text-neutral-600">Scoring your edit…</p>
        </div>
    );
}
