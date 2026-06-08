/**
 * Wizard Step 3 — OVERLAYS.
 *
 * On entry, asks the LLM (premium+) to propose titles + short text callouts
 * anchored to the confirmed arrangement's segments. The user accepts / edits /
 * rejects each, can refine with a prompt, and can author manual overlays.
 *
 * Each proposed operation looks like
 *   { tool: 'propose_titles',        params: { titles:   [{segment_idx,title,...}] } }
 *   { tool: 'propose_text_overlays', params: { overlays: [{segment_idx,text,...}] } }
 * We flatten them into one reviewable list and rebuild accepted-only operations
 * on confirm. Manual overlays ride in `manual_operations` as a single
 * `manual_overlay` op carrying titles[]/overlays[] (the build's COMPOSE_HTML
 * stage reads overlays by PARAM SHAPE, not tool name).
 *
 * `segment_idx` indexes the arrangement order (0-based); labels are derived
 * from the project's confirmed arrangement (warm in the query cache after the
 * arrangement step confirmed).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Article,
    ClosedCaptioning,
    MagicWand,
    Plus,
    Sparkle,
    TextT,
    X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWizardStep } from '../hooks/useWizardStep';
import {
    getStudioProject,
    type CaptionPreset,
    type ConfirmedStepPlan,
    type OperationSpec,
    type ProjectResponse,
    type TextOverlayPosition,
    type TextOverlayStyle,
    type TitlePlacement,
    type WizardStepPlan,
} from '../services/studio-api';

const CAPTION_PRESETS: Array<{ value: CaptionPreset; label: string }> = [
    { value: 'clean', label: 'Clean' },
    { value: 'karaoke', label: 'Karaoke' },
    { value: 'hormozi', label: 'Hormozi' },
    { value: 'pop', label: 'Pop' },
];

interface OverlayRow {
    kind: 'title' | 'text';
    segment_idx: number;
    // title fields
    title?: string;
    subtitle?: string;
    placement?: TitlePlacement;
    duration_s?: number;
    // text fields
    text?: string;
    position?: TextOverlayPosition;
    style?: TextOverlayStyle;
    t_offset_s?: number;
    dur_s?: number;
    accepted: boolean;
    source: 'ai' | 'manual';
}

interface Segment {
    idx: number;
    label: string;
}

interface OverlaysStepProps {
    apiKey: string;
    instituteId: string | undefined;
    projectId: string;
    onConfirmed: () => void;
}

function fmt(t: number): string {
    const m = Math.floor(t / 60);
    const s = Math.round(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Ordered segments from the confirmed arrangement — mirrors the backend's
 * extract_order (arrange_sequence order preferred, else pick_segments). */
function deriveSegments(project: ProjectResponse | undefined): Segment[] {
    const arr = (project?.confirmed_plan as Record<string, unknown> | undefined)
        ?.arrangement as { operations?: Array<Record<string, unknown>> } | undefined;
    const ops = arr?.operations ?? [];
    let order: Array<Record<string, unknown>> = [];
    for (const op of ops) {
        if (op.tool === 'arrange_sequence') {
            order = ((op.params as Record<string, unknown>)?.order as Array<
                Record<string, unknown>
            >) ?? [];
        }
    }
    if (!order.length) {
        for (const op of ops) {
            if (op.tool === 'pick_segments') {
                order = ((op.params as Record<string, unknown>)?.segments as Array<
                    Record<string, unknown>
                >) ?? [];
            }
        }
    }
    return order.map((it, i) => {
        const handle = typeof it.handle === 'string' ? it.handle : '';
        const ts = typeof it.t_start === 'number' ? it.t_start : undefined;
        const te = typeof it.t_end === 'number' ? it.t_end : undefined;
        const range = ts != null && te != null ? ` ${fmt(ts)}–${fmt(te)}` : '';
        return { idx: i, label: handle ? `${i + 1}. ${handle}${range}` : `Segment ${i + 1}` };
    });
}

function extractCaptions(
    plan: WizardStepPlan | undefined
): { enabled: boolean; preset: CaptionPreset } | null {
    for (const op of plan?.operations ?? []) {
        if (op.tool === 'propose_captions') {
            const p = op.params ?? {};
            const preset = (typeof p.preset === 'string' ? p.preset : 'clean') as CaptionPreset;
            return { enabled: Boolean(p.enabled), preset };
        }
    }
    return null;
}

function flatten(plan: WizardStepPlan | undefined): OverlayRow[] {
    const out: OverlayRow[] = [];
    for (const op of plan?.operations ?? []) {
        if (op.tool === 'propose_titles') {
            const titles = (op.params?.titles as Array<Record<string, unknown>>) ?? [];
            for (const t of titles) {
                out.push({
                    kind: 'title',
                    segment_idx: Number(t.segment_idx ?? 0),
                    title: String(t.title ?? ''),
                    subtitle: typeof t.subtitle === 'string' ? t.subtitle : undefined,
                    placement: (t.placement as TitlePlacement) ?? 'center',
                    duration_s: typeof t.duration_s === 'number' ? t.duration_s : 3,
                    accepted: true,
                    source: 'ai',
                });
            }
        } else if (op.tool === 'propose_text_overlays') {
            const overlays = (op.params?.overlays as Array<Record<string, unknown>>) ?? [];
            for (const o of overlays) {
                out.push({
                    kind: 'text',
                    segment_idx: Number(o.segment_idx ?? 0),
                    text: String(o.text ?? ''),
                    position: (o.position as TextOverlayPosition) ?? 'bottom',
                    style: (o.style as TextOverlayStyle) ?? 'plain',
                    t_offset_s: typeof o.t_offset_s === 'number' ? o.t_offset_s : 0,
                    dur_s: typeof o.dur_s === 'number' ? o.dur_s : 3,
                    accepted: true,
                    source: 'ai',
                });
            }
        }
    }
    return out;
}

export function OverlaysStep({
    apiKey,
    instituteId,
    projectId,
    onConfirmed,
}: OverlaysStepProps) {
    const { plan, refine, confirm } = useWizardStep({
        apiKey,
        instituteId,
        projectId,
        step: 'overlays',
    });

    const [rows, setRows] = useState<OverlayRow[]>([]);
    const [notes, setNotes] = useState<string | null>(null);
    const [refinePrompt, setRefinePrompt] = useState('');
    const [captionsEnabled, setCaptionsEnabled] = useState(false);
    const [captionPreset, setCaptionPreset] = useState<CaptionPreset>('clean');
    const plannedRef = useRef(false);

    // Segments for labels + the manual adder. Cache is warm from the arrangement
    // confirm; this query hits it (or refetches the project) for the order.
    const projectQuery = useQuery({
        queryKey: ['studio-project', instituteId, projectId],
        queryFn: () => getStudioProject(apiKey, projectId),
        enabled: !!apiKey,
    });
    const segments = useMemo(
        () => deriveSegments(projectQuery.data),
        [projectQuery.data]
    );

    useEffect(() => {
        if (plannedRef.current || !apiKey) return;
        plannedRef.current = true;
        plan.mutate(
            {},
            {
                onSuccess: (p) => {
                    setRows(flatten(p));
                    setNotes(p.notes ?? null);
                    const cap = extractCaptions(p);
                    if (cap) {
                        setCaptionsEnabled(cap.enabled);
                        setCaptionPreset(cap.preset);
                    }
                },
                onError: (e) =>
                    toast.error(
                        e instanceof Error ? e.message : 'Could not propose overlays.'
                    ),
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const doRefine = () => {
        const prompt = refinePrompt.trim();
        if (!prompt) return;
        refine.mutate(prompt, {
            onSuccess: (p) => {
                setRows(flatten(p));
                setNotes(p.notes ?? null);
                const cap = extractCaptions(p);
                if (cap) {
                    setCaptionsEnabled(cap.enabled);
                    setCaptionPreset(cap.preset);
                }
                setRefinePrompt('');
            },
            onError: (e) =>
                toast.error(e instanceof Error ? e.message : 'Refine failed.'),
        });
    };

    const patch = (i: number, next: Partial<OverlayRow>) =>
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
    const remove = (i: number) =>
        setRows((prev) => prev.filter((_, idx) => idx !== i));

    const addManual = (row: OverlayRow) => setRows((prev) => [...prev, row]);

    const acceptedCount = useMemo(
        () => rows.filter((r) => r.accepted).length,
        [rows]
    );

    const doConfirm = () => {
        const accepted = rows.filter((r) => r.accepted && (r.title?.trim() || r.text?.trim()));

        const titlesOf = (src: OverlayRow['source']) =>
            accepted
                .filter((r) => r.source === src && r.kind === 'title')
                .map((r) => ({
                    segment_idx: r.segment_idx,
                    title: (r.title ?? '').trim(),
                    ...(r.subtitle?.trim() ? { subtitle: r.subtitle.trim() } : {}),
                    duration_s: r.duration_s ?? 3,
                    placement: r.placement ?? 'center',
                }));
        const textsOf = (src: OverlayRow['source']) =>
            accepted
                .filter((r) => r.source === src && r.kind === 'text')
                .map((r) => ({
                    segment_idx: r.segment_idx,
                    text: (r.text ?? '').trim(),
                    t_offset_s: r.t_offset_s ?? 0,
                    dur_s: r.dur_s ?? 3,
                    position: r.position ?? 'bottom',
                    style: r.style ?? 'plain',
                }));

        const operations: OperationSpec[] = [];
        // Captions config always rides along (records the on/off + preset choice;
        // the build's ASSEMBLE_WORDS stage reads `enabled`).
        operations.push({
            tool: 'propose_captions',
            params: { enabled: captionsEnabled, preset: captionPreset },
        });
        const aiTitles = titlesOf('ai');
        const aiTexts = textsOf('ai');
        if (aiTitles.length)
            operations.push({ tool: 'propose_titles', params: { titles: aiTitles } });
        if (aiTexts.length)
            operations.push({ tool: 'propose_text_overlays', params: { overlays: aiTexts } });

        const manualTitles = titlesOf('manual');
        const manualTexts = textsOf('manual');
        const manualParams: Record<string, unknown> = {};
        if (manualTitles.length) manualParams.titles = manualTitles;
        if (manualTexts.length) manualParams.overlays = manualTexts;
        const manualOps: OperationSpec[] =
            manualTitles.length || manualTexts.length
                ? [{ tool: 'manual_overlay', params: manualParams }]
                : [];

        const confirmed: ConfirmedStepPlan = {
            step: 'overlays',
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
                        ? `${acceptedCount} overlay(s) saved.`
                        : 'No overlays — moving on.'
                );
                onConfirmed();
            },
            onError: (e) =>
                toast.error(e instanceof Error ? e.message : 'Could not save overlays.'),
        });
    };

    const planning = plan.isPending && !rows.length;

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-lg font-semibold text-neutral-900">Overlays</h2>
                <p className="mt-1 text-sm text-neutral-600">
                    Add titles and short on-screen text over your clips. Accept,
                    edit, or remove the suggestions, refine with a prompt, or add
                    your own — then continue.
                </p>
            </header>

            {planning ? (
                <ProposingState />
            ) : (
                <>
                    {notes && (
                        <div className="flex items-start gap-2 rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">
                            <Sparkle weight="fill" className="mt-0.5 size-4 shrink-0" />
                            <span>{notes}</span>
                        </div>
                    )}

                    {/* Captions */}
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                            <input
                                type="checkbox"
                                checked={captionsEnabled}
                                onChange={(e) => setCaptionsEnabled(e.target.checked)}
                                className="size-4 accent-neutral-900"
                            />
                            <ClosedCaptioning weight="fill" className="size-4 text-neutral-500" />
                            Captions
                        </label>
                        <span className="text-caption text-neutral-500">
                            Karaoke captions from the spoken transcript.
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-caption text-neutral-500">Style</span>
                            <select
                                value={captionPreset}
                                onChange={(e) => setCaptionPreset(e.target.value as CaptionPreset)}
                                disabled={!captionsEnabled}
                                className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-caption text-neutral-700 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
                            >
                                {CAPTION_PRESETS.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Refine with a prompt */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-64">
                            <MagicWand className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                value={refinePrompt}
                                onChange={(e) => setRefinePrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && doRefine()}
                                placeholder="Refine, e.g. “add a name title on the intro”"
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

                    {rows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
                            No overlays suggested. Add a title or text overlay
                            below, or continue without any.
                        </div>
                    ) : (
                        <ul className="space-y-1.5">
                            {rows.map((row, i) => (
                                <OverlayRowItem
                                    key={`${row.kind}-${i}`}
                                    row={row}
                                    segments={segments}
                                    onToggle={() => patch(i, { accepted: !row.accepted })}
                                    onPatch={(next) => patch(i, next)}
                                    onRemove={() => remove(i)}
                                />
                            ))}
                        </ul>
                    )}

                    <ManualOverlayAdder segments={segments} onAdd={addManual} />
                </>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <span className="text-sm text-neutral-500">
                    {acceptedCount} overlay(s) selected
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

function OverlayKindBadge({ kind }: { kind: OverlayRow['kind'] }) {
    const map = {
        title: { label: 'Title', Icon: Article, cls: 'bg-violet-50 text-violet-700' },
        text: { label: 'Text', Icon: TextT, cls: 'bg-teal-50 text-teal-700' },
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

function SegmentSelect({
    value,
    segments,
    onChange,
}: {
    value: number;
    segments: Segment[];
    onChange: (idx: number) => void;
}) {
    if (segments.length === 0) {
        return (
            <span className="font-mono text-caption text-neutral-500">
                seg {value + 1}
            </span>
        );
    }
    return (
        <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-8 max-w-40 rounded-md border border-neutral-300 bg-white px-1.5 text-caption text-neutral-700 focus:border-neutral-900 focus:outline-none"
        >
            {segments.map((s) => (
                <option key={s.idx} value={s.idx}>
                    {s.label}
                </option>
            ))}
        </select>
    );
}

function OverlayRowItem({
    row,
    segments,
    onToggle,
    onPatch,
    onRemove,
}: {
    row: OverlayRow;
    segments: Segment[];
    onToggle: () => void;
    onPatch: (next: Partial<OverlayRow>) => void;
    onRemove: () => void;
}) {
    return (
        <li
            className={cn(
                'flex flex-wrap items-center gap-2 rounded-md border px-3 py-2',
                row.accepted
                    ? 'border-neutral-200 bg-white'
                    : 'border-neutral-200 bg-neutral-50 opacity-60'
            )}
        >
            <input
                type="checkbox"
                checked={row.accepted}
                onChange={onToggle}
                className="size-4 accent-neutral-900"
            />
            <OverlayKindBadge kind={row.kind} />
            <SegmentSelect
                value={row.segment_idx}
                segments={segments}
                onChange={(idx) => onPatch({ segment_idx: idx })}
            />
            <input
                type="text"
                value={row.kind === 'title' ? row.title ?? '' : row.text ?? ''}
                onChange={(e) =>
                    onPatch(
                        row.kind === 'title'
                            ? { title: e.target.value }
                            : { text: e.target.value }
                    )
                }
                className="h-8 min-w-40 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
            />
            {row.kind === 'title' ? (
                <select
                    value={row.placement ?? 'center'}
                    onChange={(e) =>
                        onPatch({ placement: e.target.value as TitlePlacement })
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-caption text-neutral-700 focus:border-neutral-900 focus:outline-none"
                >
                    <option value="center">Center</option>
                    <option value="lower">Lower</option>
                </select>
            ) : (
                <select
                    value={row.position ?? 'bottom'}
                    onChange={(e) =>
                        onPatch({ position: e.target.value as TextOverlayPosition })
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-caption text-neutral-700 focus:border-neutral-900 focus:outline-none"
                >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                    <option value="lower_third">Lower third</option>
                </select>
            )}
            <button
                type="button"
                onClick={onRemove}
                className="text-neutral-400 hover:text-rose-600"
            >
                <X className="size-4" />
            </button>
        </li>
    );
}

function ManualOverlayAdder({
    segments,
    onAdd,
}: {
    segments: Segment[];
    onAdd: (row: OverlayRow) => void;
}) {
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<OverlayRow['kind']>('title');
    const [segmentIdx, setSegmentIdx] = useState(0);
    const [value, setValue] = useState('');

    const submit = () => {
        const text = value.trim();
        if (!text) {
            toast.error('Enter the overlay text.');
            return;
        }
        onAdd(
            kind === 'title'
                ? {
                      kind: 'title',
                      segment_idx: segmentIdx,
                      title: text,
                      placement: 'center',
                      duration_s: 3,
                      accepted: true,
                      source: 'manual',
                  }
                : {
                      kind: 'text',
                      segment_idx: segmentIdx,
                      text,
                      position: 'bottom',
                      style: 'plain',
                      t_offset_s: 0,
                      dur_s: 3,
                      accepted: true,
                      source: 'manual',
                  }
        );
        setValue('');
        setOpen(false);
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
                <Plus className="size-4" /> Add an overlay
            </button>
        );
    }

    return (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <label className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500">Type</span>
                <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as OverlayRow['kind'])}
                    className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                    <option value="title">Title</option>
                    <option value="text">Text</option>
                </select>
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500">Segment</span>
                <select
                    value={segmentIdx}
                    onChange={(e) => setSegmentIdx(Number(e.target.value))}
                    className="h-9 max-w-44 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                    {(segments.length
                        ? segments
                        : [{ idx: 0, label: 'Segment 1' }]
                    ).map((s) => (
                        <option key={s.idx} value={s.idx}>
                            {s.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption text-neutral-500">
                    {kind === 'title' ? 'Title text' : 'Overlay text'}
                </span>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    className="h-9 min-w-44 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
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

function ProposingState() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 py-12">
            <Sparkle weight="duotone" className="size-8 animate-pulse text-neutral-400" />
            <p className="text-sm text-neutral-600">
                Proposing titles and on-screen text…
            </p>
        </div>
    );
}
