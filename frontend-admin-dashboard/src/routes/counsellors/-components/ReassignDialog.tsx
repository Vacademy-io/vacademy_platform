import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { CounsellorRatingBadge } from '@/components/counsellor/CounsellorRatingBadge';
import { toast } from 'sonner';
import {
    commitReassign,
    previewReassign,
    type ReassignMode,
    type ReassignResult,
    type WorkbenchCounsellor,
    type WorkbenchLead,
} from '../-services/counsellor-workbench-services';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    instituteId: string;
    fromUserId: string | null;
    fromUserName: string | null;
    /** Open-leads pre-populated by the inactive-toggle response (or empty when invoked from a single lead row). */
    openLeads: WorkbenchLead[];
    /** All counsellors in the team subtree — for the SINGLE picker and the MANUAL overrides. */
    candidates: WorkbenchCounsellor[];
    onComplete?: () => void;
}

/**
 * Reassign dialog with three modes:
 *   SINGLE       — pick one target; backend moves all openLeads there.
 *   ROUND_ROBIN  — backend spreads openLeads across active counsellors.
 *   MANUAL       — preview row-by-row, override each target inline.
 *
 * The MANUAL flow fires /reassign/preview first to render the proposed
 * mapping, then sends MANUAL with the (possibly-edited) assignments back.
 */
export function ReassignDialog({
    open,
    onOpenChange,
    instituteId,
    fromUserId,
    fromUserName,
    openLeads,
    candidates,
    onComplete,
}: Props) {
    const [mode, setMode] = useState<ReassignMode>('SINGLE');
    const [target, setTarget] = useState<string>('');
    const [preview, setPreview] = useState<ReassignResult | null>(null);
    const [perRowOverrides, setPerRowOverrides] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const targets = useMemo(
        () => candidates.filter((c) => c.user_id !== fromUserId && c.is_active),
        [candidates, fromUserId]
    );

    useEffect(() => {
        if (open) {
            setMode('SINGLE');
            setTarget('');
            setPreview(null);
            setPerRowOverrides({});
            setSubmitting(false);
        }
    }, [open]);

    async function loadPreview(nextMode: ReassignMode) {
        if (!fromUserId) return;
        try {
            const r = await previewReassign({
                institute_id: instituteId,
                from_user_id: fromUserId,
                mode: nextMode,
            });
            setPreview(r);
            const seed: Record<string, string> = {};
            r.assignments.forEach((a) => (seed[a.lead_id] = a.to_user_id));
            setPerRowOverrides(seed);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Preview failed');
        }
    }

    async function submit() {
        if (!fromUserId) return;
        setSubmitting(true);
        try {
            if (mode === 'SINGLE') {
                if (!target) {
                    toast.error('Pick a counsellor to receive the leads');
                    setSubmitting(false);
                    return;
                }
                await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'SINGLE',
                    target_user_id: target,
                });
            } else if (mode === 'ROUND_ROBIN') {
                await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'ROUND_ROBIN',
                });
            } else {
                if (!preview) {
                    toast.error('Generate a preview first');
                    setSubmitting(false);
                    return;
                }
                await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'MANUAL',
                    assignments: Object.entries(perRowOverrides).map(([lead_id, to_user_id]) => ({
                        lead_id,
                        to_user_id,
                    })),
                });
            }
            toast.success(`Reassigned ${openLeads.length} lead${openLeads.length === 1 ? '' : 's'}`);
            onComplete?.();
            onOpenChange(false);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Reassign failed');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Reassign {openLeads.length} lead{openLeads.length === 1 ? '' : 's'}
                        {fromUserName ? ` from ${fromUserName}` : ''}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <ModeChoice mode={mode} onChange={(m) => {
                        setMode(m);
                        if (m === 'MANUAL') loadPreview('ROUND_ROBIN');
                    }} />

                    {mode === 'SINGLE' && (
                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                Move all to
                            </label>
                            <select
                                className="w-full rounded border border-neutral-300 px-3 py-2"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            >
                                <option value="">— Select a counsellor —</option>
                                {targets.map((t) => (
                                    <option key={t.user_id} value={t.user_id}>
                                        {t.full_name ?? t.user_id}
                                        {t.rating != null ? ` · rating ${Math.round(t.rating)}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {mode === 'ROUND_ROBIN' && (
                        <p className="rounded border border-info-200 bg-primary-50 px-3 py-2 text-subtitle text-neutral-700">
                            Leads will be distributed evenly across {targets.length} active counsellor
                            {targets.length === 1 ? '' : 's'} in the team subtree.
                        </p>
                    )}

                    {mode === 'MANUAL' && (
                        <ManualPreviewTable
                            instituteId={instituteId}
                            preview={preview}
                            overrides={perRowOverrides}
                            setOverrides={setPerRowOverrides}
                            candidates={targets}
                            onReshufflePreview={() => loadPreview('ROUND_ROBIN')}
                        />
                    )}
                </div>

                <DialogFooter>
                    <MyButton buttonType="secondary" onClick={() => onOpenChange(false)} disable={submitting}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" onClick={submit} disable={submitting}>
                        {submitting ? 'Reassigning…' : 'Confirm reassign'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModeChoice({ mode, onChange }: { mode: ReassignMode; onChange: (m: ReassignMode) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {(['SINGLE', 'ROUND_ROBIN', 'MANUAL'] as ReassignMode[]).map((m) => (
                <button
                    key={m}
                    type="button"
                    onClick={() => onChange(m)}
                    className={`rounded border p-2 text-left text-subtitle ${
                        mode === m
                            ? 'border-primary-400 bg-primary-50 text-primary-700'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                >
                    <div className="font-medium">{labelFor(m)}</div>
                    <div className="text-caption text-neutral-500">{descriptionFor(m)}</div>
                </button>
            ))}
        </div>
    );
}

function labelFor(m: ReassignMode) {
    return m === 'SINGLE' ? 'Move to one' : m === 'ROUND_ROBIN' ? 'Round-robin' : 'Custom (preview)';
}
function descriptionFor(m: ReassignMode) {
    return m === 'SINGLE'
        ? 'All leads → one target'
        : m === 'ROUND_ROBIN'
        ? 'Spread across actives'
        : 'Per-lead override';
}

function ManualPreviewTable({
    instituteId,
    preview,
    overrides,
    setOverrides,
    candidates,
    onReshufflePreview,
}: {
    instituteId: string;
    preview: ReassignResult | null;
    overrides: Record<string, string>;
    setOverrides: (next: Record<string, string>) => void;
    candidates: WorkbenchCounsellor[];
    onReshufflePreview: () => void;
}) {
    if (!preview) {
        return <div className="p-4 text-subtitle text-neutral-500">Generating preview…</div>;
    }
    if (preview.assignments.length === 0) {
        return (
            <div className="rounded border border-dashed border-neutral-300 p-6 text-center text-subtitle text-neutral-500">
                No open leads to reassign.
            </div>
        );
    }
    return (
        <div className="overflow-auto rounded border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
                <span className="text-caption text-neutral-500">
                    {preview.assignments.length} leads · adjust targets inline
                </span>
                <MyButton buttonType="secondary" scale="small" onClick={onReshufflePreview}>
                    Reshuffle
                </MyButton>
            </div>
            <table className="w-full text-body">
                <thead className="bg-neutral-50 text-caption uppercase tracking-wide text-neutral-500">
                    <tr>
                        <th className="px-3 py-2 text-left">Lead</th>
                        <th className="px-3 py-2 text-left">Target counsellor</th>
                    </tr>
                </thead>
                <tbody>
                    {preview.assignments.map((a) => (
                        <tr key={a.lead_id} className="border-t border-neutral-100">
                            <td className="px-3 py-2.5 text-neutral-900">
                                {a.lead_name ?? a.lead_id.slice(0, 8)}
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <select
                                        className="flex-1 rounded border border-neutral-300 px-2 py-1"
                                        value={overrides[a.lead_id] ?? a.to_user_id}
                                        onChange={(e) =>
                                            setOverrides({
                                                ...overrides,
                                                [a.lead_id]: e.target.value,
                                            })
                                        }
                                    >
                                        {candidates.map((c) => (
                                            <option key={c.user_id} value={c.user_id}>
                                                {c.full_name ?? c.user_id}
                                            </option>
                                        ))}
                                    </select>
                                    <CounsellorRatingBadge
                                        instituteId={instituteId}
                                        userId={overrides[a.lead_id] ?? a.to_user_id}
                                        size="sm"
                                    />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
