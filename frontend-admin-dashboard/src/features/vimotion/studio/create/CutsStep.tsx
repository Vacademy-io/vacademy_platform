/**
 * Wizard Step 2 — CUTS.
 *
 * On entry, plans this step. For free→premium tiers the plan is purely
 * DETERMINISTIC (no LLM cost): detect_silences + detect_fillers run over the
 * confirmed arrangement's kept ranges and return cut spans. The user toggles
 * each suggested cut, can add manual cuts, then confirms.
 *
 * Each detected operation looks like
 *   { tool: 'detect_silences'|'detect_fillers', params: { cuts: [{handle,t_start,t_end,kind,...}] } }
 * We flatten them into one reviewable list and rebuild accepted-only
 * operations on confirm. Manual cuts ride in `manual_operations`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Scissors, SpeakerSimpleSlash, WaveSine, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWizardStep } from '../hooks/useWizardStep';
import type {
    ConfirmedStepPlan,
    OperationSpec,
    WizardStepPlan,
} from '../services/studio-api';

interface Cut {
    handle: string;
    t_start: number;
    t_end: number;
    kind: 'silence' | 'filler' | 'user';
    word?: string;
    duration_s?: number;
    accepted: boolean;
    source: 'detect_silences' | 'detect_fillers' | 'manual';
}

interface CutsStepProps {
    apiKey: string;
    instituteId: string | undefined;
    projectId: string;
    videoHandles: string[];
    onConfirmed: () => void;
}

function fmt(t: number): string {
    const m = Math.floor(t / 60);
    const s = Math.round(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function flatten(plan: WizardStepPlan | undefined): Cut[] {
    const out: Cut[] = [];
    for (const op of plan?.operations ?? []) {
        const source = op.tool as Cut['source'];
        if (source !== 'detect_silences' && source !== 'detect_fillers') continue;
        const cuts = (op.params?.cuts as Array<Record<string, unknown>>) ?? [];
        for (const c of cuts) {
            out.push({
                handle: String(c.handle ?? ''),
                t_start: Number(c.t_start ?? 0),
                t_end: Number(c.t_end ?? 0),
                kind: (c.kind as Cut['kind']) ?? 'silence',
                word: typeof c.word === 'string' ? c.word : undefined,
                duration_s:
                    typeof c.duration_s === 'number' ? c.duration_s : undefined,
                accepted: true,
                source,
            });
        }
    }
    out.sort((a, b) =>
        a.handle === b.handle ? a.t_start - b.t_start : a.handle.localeCompare(b.handle)
    );
    return out;
}

export function CutsStep({
    apiKey,
    instituteId,
    projectId,
    videoHandles,
    onConfirmed,
}: CutsStepProps) {
    const { plan, confirm } = useWizardStep({
        apiKey,
        instituteId,
        projectId,
        step: 'cuts',
    });

    const [cuts, setCuts] = useState<Cut[]>([]);
    const [notes, setNotes] = useState<string | null>(null);
    const plannedRef = useRef(false);

    useEffect(() => {
        if (plannedRef.current || !apiKey) return;
        plannedRef.current = true;
        plan.mutate(
            {},
            {
                onSuccess: (p) => {
                    setCuts(flatten(p));
                    setNotes(p.notes ?? null);
                },
                onError: (e) =>
                    toast.error(
                        e instanceof Error ? e.message : 'Could not analyze cuts.'
                    ),
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const toggle = (i: number) =>
        setCuts((prev) =>
            prev.map((c, idx) => (idx === i ? { ...c, accepted: !c.accepted } : c))
        );
    const remove = (i: number) =>
        setCuts((prev) => prev.filter((_, idx) => idx !== i));

    const addManual = (handle: string, start: number, end: number) => {
        setCuts((prev) => [
            ...prev,
            {
                handle,
                t_start: start,
                t_end: end,
                kind: 'user',
                accepted: true,
                source: 'manual',
            },
        ]);
    };

    const acceptedCount = useMemo(
        () => cuts.filter((c) => c.accepted).length,
        [cuts]
    );

    const doConfirm = () => {
        const accepted = cuts.filter((c) => c.accepted);
        const byTool = (tool: Cut['source']) =>
            accepted
                .filter((c) => c.source === tool)
                .map((c) => ({
                    handle: c.handle,
                    t_start: c.t_start,
                    t_end: c.t_end,
                    kind: c.kind,
                    ...(c.word ? { word: c.word } : {}),
                }));

        const operations: OperationSpec[] = [];
        const sil = byTool('detect_silences');
        const fil = byTool('detect_fillers');
        if (sil.length)
            operations.push({ tool: 'detect_silences', params: { cuts: sil } });
        if (fil.length)
            operations.push({ tool: 'detect_fillers', params: { cuts: fil } });

        const manual = accepted
            .filter((c) => c.source === 'manual')
            .map((c) => ({
                handle: c.handle,
                t_start: c.t_start,
                t_end: c.t_end,
                kind: 'user',
            }));
        const manualOps: OperationSpec[] = manual.length
            ? [{ tool: 'manual_cut', params: { cuts: manual } }]
            : [];

        const confirmed: ConfirmedStepPlan = {
            step: 'cuts',
            operations,
            decisions: operations.map((_, i) => ({
                operation_index: i,
                action: 'accepted',
            })),
            manual_operations: manualOps,
            operation_order: null,
            skipped: operations.length === 0 && manualOps.length === 0,
        };
        confirm.mutate(confirmed, {
            onSuccess: () => {
                toast.success(
                    acceptedCount > 0
                        ? `${acceptedCount} cut(s) saved.`
                        : 'No cuts — moving on.'
                );
                onConfirmed();
            },
            onError: (e) =>
                toast.error(e instanceof Error ? e.message : 'Could not save cuts.'),
        });
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-lg font-semibold text-neutral-900">Cuts</h2>
                <p className="mt-1 text-sm text-neutral-600">
                    We scanned your clips for dead air and filler words. Uncheck
                    anything you want to keep, add your own cuts, then continue.
                </p>
            </header>

            {plan.isPending && !cuts.length ? (
                <AnalyzingState />
            ) : (
                <>
                    {notes && (
                        <div className="flex items-start gap-2 rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">
                            <Scissors weight="fill" className="mt-0.5 size-4 shrink-0" />
                            <span>{notes}</span>
                        </div>
                    )}

                    {cuts.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
                            Nothing to trim — your clips are tight. Add a manual
                            cut below or continue.
                        </div>
                    ) : (
                        <ul className="space-y-1.5">
                            {cuts.map((cut, i) => (
                                <li
                                    key={`${cut.handle}-${cut.t_start}-${i}`}
                                    className={cn(
                                        'flex items-center gap-3 rounded-md border px-3 py-2',
                                        cut.accepted
                                            ? 'border-neutral-200 bg-white'
                                            : 'border-neutral-200 bg-neutral-50 opacity-60'
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={cut.accepted}
                                        onChange={() => toggle(i)}
                                        className="size-4 accent-neutral-900"
                                    />
                                    <CutKindBadge kind={cut.kind} />
                                    <span className="font-mono text-caption text-neutral-500">
                                        {cut.handle}
                                    </span>
                                    <span className="flex-1 text-sm text-neutral-700">
                                        {fmt(cut.t_start)} – {fmt(cut.t_end)}
                                        {cut.word ? ` · “${cut.word}”` : ''}
                                        {cut.duration_s
                                            ? ` · ${cut.duration_s}s`
                                            : ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => remove(i)}
                                        className="text-neutral-400 hover:text-rose-600"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <ManualCutAdder
                        videoHandles={videoHandles}
                        onAdd={addManual}
                    />
                </>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <span className="text-sm text-neutral-500">
                    {acceptedCount} cut(s) selected
                </span>
                <button
                    type="button"
                    onClick={doConfirm}
                    disabled={confirm.isPending}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {confirm.isPending ? 'Saving…' : 'Confirm & continue'}
                </button>
            </div>
        </div>
    );
}

function CutKindBadge({ kind }: { kind: Cut['kind'] }) {
    const map = {
        silence: { label: 'Silence', Icon: SpeakerSimpleSlash, cls: 'bg-sky-50 text-sky-700' },
        filler: { label: 'Filler', Icon: WaveSine, cls: 'bg-amber-50 text-amber-700' },
        user: { label: 'Manual', Icon: Scissors, cls: 'bg-neutral-100 text-neutral-700' },
    }[kind];
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium',
                map.cls
            )}
        >
            <map.Icon weight="fill" className="size-3" />
            {map.label}
        </span>
    );
}

function ManualCutAdder({
    videoHandles,
    onAdd,
}: {
    videoHandles: string[];
    onAdd: (handle: string, start: number, end: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const [handle, setHandle] = useState(videoHandles[0] ?? '');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    if (videoHandles.length === 0) return null;

    const submit = () => {
        const s = Number(start);
        const e = Number(end);
        if (!handle || Number.isNaN(s) || Number.isNaN(e) || e <= s || s < 0) {
            toast.error('Enter a valid handle and start < end.');
            return;
        }
        onAdd(handle, s, e);
        setStart('');
        setEnd('');
        setOpen(false);
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
                <Plus className="size-4" /> Add a manual cut
            </button>
        );
    }

    return (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <label className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500">Clip</span>
                <select
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                    {videoHandles.map((h) => (
                        <option key={h} value={h}>
                            {h}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500">Start (s)</span>
                <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="h-9 w-24 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500">End (s)</span>
                <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="h-9 w-24 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
            </label>
            <button
                type="button"
                onClick={submit}
                className="h-9 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800"
            >
                Add
            </button>
            <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-md px-3 text-sm text-neutral-600 hover:bg-neutral-100"
            >
                Cancel
            </button>
        </div>
    );
}

function AnalyzingState() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 py-12">
            <Scissors weight="duotone" className="size-8 animate-pulse text-neutral-400" />
            <p className="text-sm text-neutral-600">
                Scanning for silences and filler words…
            </p>
        </div>
    );
}
