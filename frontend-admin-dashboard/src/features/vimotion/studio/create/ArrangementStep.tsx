/**
 * Wizard Step 1 — ARRANGEMENT.
 *
 * On entry, asks the backend to PLAN this step (1 LLM call → pick_segments +
 * arrange_sequence operations). Renders the proposal as two editable lists:
 *   • Kept segments (from pick_segments) — remove any
 *   • Final order (from arrange_sequence) — remove / move up-down
 * A "refine with a prompt" box re-runs the LLM. Confirm persists the
 * (possibly edited) plan and advances the wizard.
 *
 * The plan service always returns SOMETHING (deterministic fallback when the
 * LLM is unavailable), so this UI never dead-ends.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowUp,
    ArrowDown,
    FilmStrip,
    Image as ImageIcon,
    Sparkle,
    X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWizardStep } from '../hooks/useWizardStep';
import type {
    ConfirmedStepPlan,
    OperationSpec,
    WizardStepPlan,
} from '../services/studio-api';

interface Segment {
    handle: string;
    t_start: number;
    t_end: number;
    reason?: string;
}
interface OrderItem {
    handle: string;
    t_start?: number;
    t_end?: number;
    still_duration_s?: number;
    crossfade_s?: number;
}

interface ArrangementStepProps {
    apiKey: string;
    instituteId: string | undefined;
    projectId: string;
    imageHandles: Set<string>;
    onConfirmed: () => void;
}

function fmt(t: number): string {
    const m = Math.floor(t / 60);
    const s = Math.round(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function readSegments(plan: WizardStepPlan | undefined): Segment[] {
    const op = plan?.operations.find((o) => o.tool === 'pick_segments');
    const raw = (op?.params?.segments as Segment[]) ?? [];
    return raw.map((s) => ({ ...s }));
}
function readOrder(plan: WizardStepPlan | undefined): OrderItem[] {
    const op = plan?.operations.find((o) => o.tool === 'arrange_sequence');
    const raw = (op?.params?.order as OrderItem[]) ?? [];
    return raw.map((o) => ({ ...o }));
}

export function ArrangementStep({
    apiKey,
    instituteId,
    projectId,
    imageHandles,
    onConfirmed,
}: ArrangementStepProps) {
    const { plan, refine, confirm } = useWizardStep({
        apiKey,
        instituteId,
        projectId,
        step: 'arrangement',
    });

    const [segments, setSegments] = useState<Segment[]>([]);
    const [order, setOrder] = useState<OrderItem[]>([]);
    const [notes, setNotes] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [refinePrompt, setRefinePrompt] = useState('');
    // Ref (not state) so React 18 StrictMode's double-effect-invoke can't
    // fire two plan calls (= two LLM charges) before a state update flushes.
    const plannedRef = useRef(false);

    // Plan once on mount.
    useEffect(() => {
        if (plannedRef.current || !apiKey) return;
        plannedRef.current = true;
        plan.mutate(
            {},
            {
                onSuccess: (p) => applyPlan(p),
                onError: (e) =>
                    toast.error(
                        e instanceof Error ? e.message : 'Could not plan arrangement.'
                    ),
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const applyPlan = (p: WizardStepPlan) => {
        setSegments(readSegments(p));
        setOrder(readOrder(p));
        setNotes(p.notes ?? null);
        setDirty(false);
    };

    const runRefine = () => {
        const prompt = refinePrompt.trim();
        if (!prompt) return;
        refine.mutate(prompt, {
            onSuccess: (p) => {
                applyPlan(p);
                setRefinePrompt('');
                toast.success('Updated the arrangement.');
            },
            onError: (e) =>
                toast.error(e instanceof Error ? e.message : 'Refine failed.'),
        });
    };

    const removeSegment = (i: number) => {
        setSegments((prev) => prev.filter((_, idx) => idx !== i));
        setDirty(true);
    };
    const removeOrderItem = (i: number) => {
        setOrder((prev) => prev.filter((_, idx) => idx !== i));
        setDirty(true);
    };
    const move = (i: number, dir: -1 | 1) => {
        setOrder((prev) => {
            const j = i + dir;
            if (j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            const tmp = next[i]!;
            next[i] = next[j]!;
            next[j] = tmp;
            return next;
        });
        setDirty(true);
    };

    const doConfirm = () => {
        const operations: OperationSpec[] = [];
        if (segments.length) {
            operations.push({ tool: 'pick_segments', params: { segments } });
        }
        if (order.length) {
            operations.push({ tool: 'arrange_sequence', params: { order } });
        }
        const confirmed: ConfirmedStepPlan = {
            step: 'arrangement',
            operations,
            decisions: operations.map((_, i) => ({
                operation_index: i,
                action: dirty ? 'edited' : 'accepted',
            })),
            manual_operations: [],
            operation_order: null,
            skipped: operations.length === 0,
        };
        confirm.mutate(confirmed, {
            onSuccess: () => {
                toast.success('Arrangement saved.');
                onConfirmed();
            },
            onError: (e) =>
                toast.error(e instanceof Error ? e.message : 'Could not save.'),
        });
    };

    const busy = plan.isPending || refine.isPending;
    const canConfirm = !confirm.isPending && (order.length > 0 || segments.length > 0);

    const orderEmpty = useMemo(() => order.length === 0, [order]);

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-lg font-semibold text-neutral-900">
                    Arrangement
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                    The AI picked the parts worth keeping and put them in order.
                    Tweak below, refine with a prompt, or just continue.
                </p>
            </header>

            {busy && !segments.length && !order.length ? (
                <PlanningState />
            ) : (
                <>
                    {notes && (
                        <div className="flex items-start gap-2 rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">
                            <Sparkle weight="fill" className="mt-0.5 size-4 shrink-0" />
                            <span>{notes}</span>
                        </div>
                    )}

                    {/* Final order */}
                    <section>
                        <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                            Final order
                            <span className="ml-2 font-normal text-neutral-500">
                                {order.length} {order.length === 1 ? 'clip' : 'clips'}
                            </span>
                        </h3>
                        {orderEmpty ? (
                            <p className="rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                                No clips in the sequence. Refine with a prompt to
                                rebuild it.
                            </p>
                        ) : (
                            <ol className="space-y-1.5">
                                {order.map((item, i) => (
                                    <li
                                        key={`${item.handle}-${i}`}
                                        className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
                                    >
                                        <span className="w-5 text-caption text-neutral-400">
                                            {i + 1}
                                        </span>
                                        <HandleBadge
                                            handle={item.handle}
                                            isImage={imageHandles.has(item.handle)}
                                        />
                                        <span className="flex-1 text-sm text-neutral-700">
                                            {item.t_start !== undefined &&
                                            item.t_end !== undefined
                                                ? `${fmt(item.t_start)} – ${fmt(item.t_end)}`
                                                : 'still'}
                                            {item.crossfade_s
                                                ? ` · ${item.crossfade_s}s xfade`
                                                : ''}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => move(i, -1)}
                                            disabled={i === 0}
                                            className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                                        >
                                            <ArrowUp className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => move(i, 1)}
                                            disabled={i === order.length - 1}
                                            className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                                        >
                                            <ArrowDown className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeOrderItem(i)}
                                            className="text-neutral-400 hover:text-rose-600"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    {/* Kept segments (informational — what was selected) */}
                    {segments.length > 0 && (
                        <section>
                            <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                                Kept segments
                                <span className="ml-2 font-normal text-neutral-500">
                                    why these parts
                                </span>
                            </h3>
                            <ul className="space-y-1.5">
                                {segments.map((seg, i) => (
                                    <li
                                        key={`${seg.handle}-${i}`}
                                        className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
                                    >
                                        <HandleBadge handle={seg.handle} isImage={false} />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-sm text-neutral-700">
                                                {fmt(seg.t_start)} – {fmt(seg.t_end)}
                                            </span>
                                            {seg.reason && (
                                                <p className="text-caption text-neutral-500">
                                                    {seg.reason}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeSegment(i)}
                                            className="text-neutral-400 hover:text-rose-600"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Refine */}
                    <section className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-900">
                            Refine with a prompt
                        </label>
                        <div className="flex gap-2">
                            <input
                                value={refinePrompt}
                                onChange={(e) => setRefinePrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        runRefine();
                                    }
                                }}
                                placeholder="e.g. tighter intro, lead with the demo, drop the tangent at the end"
                                className="h-10 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                            />
                            <button
                                type="button"
                                onClick={runRefine}
                                disabled={refine.isPending || !refinePrompt.trim()}
                                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-100 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
                            >
                                <Sparkle className="size-4" />
                                {refine.isPending ? 'Refining…' : 'Refine'}
                            </button>
                        </div>
                    </section>
                </>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-neutral-200 pt-4">
                <button
                    type="button"
                    onClick={doConfirm}
                    disabled={!canConfirm}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {confirm.isPending ? 'Saving…' : 'Confirm & continue'}
                </button>
            </div>
        </div>
    );
}

function HandleBadge({ handle, isImage }: { handle: string; isImage: boolean }) {
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-700">
            {isImage ? (
                <ImageIcon weight="duotone" className="size-3" />
            ) : (
                <FilmStrip weight="duotone" className="size-3" />
            )}
            <span className="font-mono">{handle}</span>
        </span>
    );
}

function PlanningState() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 py-12">
            <Sparkle weight="duotone" className="size-8 animate-pulse text-neutral-400" />
            <p className="text-sm text-neutral-600">
                The AI is planning your arrangement…
            </p>
        </div>
    );
}
