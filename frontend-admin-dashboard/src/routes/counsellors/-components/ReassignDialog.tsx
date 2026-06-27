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
    /**
     * When true the dialog confirms a reassign-AND-mark-inactive in one step:
     * the backend flips the source counsellor's pool memberships INACTIVE
     * inside the same transaction as the assignment commit. Cancelling the
     * dialog leaves the counsellor untouched (no inactive flip happens).
     */
    markInactive?: boolean;
    onComplete?: () => void;
    /**
     * Take the counsellor offline WITHOUT reassigning — leaves their leads
     * assigned to them as-is. Only surfaced in the markInactive flow when
     * there are leads (with none, the primary button already just flips
     * inactive). The parent owns the status call + dialog close.
     */
    onMarkInactiveWithoutReassign?: () => Promise<void> | void;
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
    markInactive = false,
    onComplete,
    onMarkInactiveWithoutReassign,
}: Props) {
    const [mode, setMode] = useState<ReassignMode>('SINGLE');
    const [target, setTarget] = useState<string>('');
    const [preview, setPreview] = useState<ReassignResult | null>(null);
    const [perRowOverrides, setPerRowOverrides] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [skipping, setSkipping] = useState(false);

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
            setSkipping(false);
        }
    }, [open]);

    async function skipReassignAndMarkInactive() {
        if (!onMarkInactiveWithoutReassign) return;
        setSkipping(true);
        try {
            await onMarkInactiveWithoutReassign();
        } finally {
            setSkipping(false);
        }
    }

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
            let result;
            // Every commit scopes to `openLeads` (the lead set the dialog was
            // opened with). For per-row reassign that's a single lead — the
            // backend's `lead_ids` whitelist keeps SINGLE/RR mode from
            // sweeping up the source counsellor's whole pipeline.
            const scopeIds = openLeads.map((l) => l.lead_id);
            // Reassign-first edge case: marking inactive with no open leads —
            // backend short-circuits before evaluating mode-specific args, so
            // we send a no-op SINGLE request without a target. The flip still
            // happens server-side.
            if (markInactive && openLeads.length === 0) {
                result = await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'SINGLE',
                    mark_inactive: true,
                });
            } else if (mode === 'SINGLE') {
                if (!target) {
                    toast.error('Pick a counsellor to receive the leads');
                    setSubmitting(false);
                    return;
                }
                result = await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'SINGLE',
                    target_user_id: target,
                    lead_ids: scopeIds,
                    mark_inactive: markInactive,
                });
            } else if (mode === 'ROUND_ROBIN') {
                result = await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'ROUND_ROBIN',
                    lead_ids: scopeIds,
                    mark_inactive: markInactive,
                });
            } else {
                if (!preview) {
                    toast.error('Generate a preview first');
                    setSubmitting(false);
                    return;
                }
                result = await commitReassign({
                    institute_id: instituteId,
                    from_user_id: fromUserId,
                    mode: 'MANUAL',
                    assignments: Object.entries(perRowOverrides).map(([lead_id, to_user_id]) => ({
                        lead_id,
                        to_user_id,
                    })),
                    // MANUAL already encodes the lead set via `assignments`,
                    // but pass the scope explicitly anyway so the backend
                    // never broadens beyond the dialog's intent.
                    lead_ids: scopeIds,
                    mark_inactive: markInactive,
                });
            }
            // Toast varies by whether the counsellor was also taken offline,
            // so the manager gets a single clear confirmation of what
            // actually happened in the same transaction.
            const n = openLeads.length;
            if (markInactive && result.marked_inactive) {
                toast.success(
                    n > 0
                        ? `Reassigned ${n} lead${n === 1 ? '' : 's'} and marked inactive`
                        : 'Marked inactive'
                );
            } else {
                toast.success(`Reassigned ${n} lead${n === 1 ? '' : 's'}`);
            }
            onComplete?.();
            onOpenChange(false);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Reassign failed');
        } finally {
            setSubmitting(false);
        }
    }

    const openLeadsById = useMemo(() => {
        const m = new Map<string, WorkbenchLead>();
        openLeads.forEach((l) => m.set(l.lead_id, l));
        return m;
    }, [openLeads]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* The dialog now fills most of the screen for the manual flow
                (which can list dozens of leads), but we cap it at 85vh so the
                header / mode picker / footer stay anchored while the body
                scrolls inside. `flex flex-col` + `min-h-0` on the body is the
                Tailwind dance that lets an inner scroll-container actually
                shrink — without min-h-0 the body grows to its content height
                and overflows the viewport instead of scrolling. */}
            <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-5xl flex-col gap-0 p-0">
                <DialogHeader className="border-b border-neutral-200 px-6 py-4">
                    <DialogTitle>
                        {markInactive
                            ? `Mark ${fromUserName ?? 'counsellor'} inactive`
                            : `Reassign ${openLeads.length} lead${openLeads.length === 1 ? '' : 's'}${fromUserName ? ` from ${fromUserName}` : ''}`}
                    </DialogTitle>
                    {markInactive && (
                        <p className="mt-1 text-caption text-neutral-500">
                            {openLeads.length === 0
                                ? `${fromUserName ?? 'They'} have no assigned leads — confirming will just take them offline.`
                                : `Reassign their ${openLeads.length} assigned lead${openLeads.length === 1 ? '' : 's'} first. They'll be taken offline atomically when you confirm.`}
                        </p>
                    )}
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                    {/* Skip the mode picker entirely when there's nothing to
                        move — the dialog is then just a confirmation for the
                        atomic inactive flip. */}
                    {!(markInactive && openLeads.length === 0) && (
                        <ModeChoice mode={mode} onChange={(m) => {
                            setMode(m);
                            if (m === 'MANUAL') loadPreview('ROUND_ROBIN');
                        }} />
                    )}

                    {!(markInactive && openLeads.length === 0) && mode === 'SINGLE' && (
                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                {openLeads.length === 1 ? 'Move to' : 'Move all to'}
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
                            openLeadsById={openLeadsById}
                            onReshufflePreview={() => loadPreview('ROUND_ROBIN')}
                        />
                    )}
                </div>

                <DialogFooter className="border-t border-neutral-200 px-6 py-4">
                    <MyButton
                        buttonType="secondary"
                        onClick={() => onOpenChange(false)}
                        disable={submitting || skipping}
                    >
                        Cancel
                    </MyButton>
                    {/* Take the counsellor offline but leave their leads where
                        they are — only meaningful when there ARE leads (with
                        none, the primary button already just flips inactive). */}
                    {markInactive && openLeads.length > 0 && onMarkInactiveWithoutReassign && (
                        <MyButton
                            buttonType="secondary"
                            onClick={skipReassignAndMarkInactive}
                            disable={submitting || skipping}
                        >
                            {skipping ? 'Marking inactive…' : 'Mark inactive without reassigning'}
                        </MyButton>
                    )}
                    <MyButton buttonType="primary" onClick={submit} disable={submitting || skipping}>
                        {submitting
                            ? markInactive
                                ? 'Working…'
                                : 'Reassigning…'
                            : markInactive
                            ? openLeads.length === 0
                                ? 'Confirm mark inactive'
                                : 'Reassign and mark inactive'
                            : 'Confirm reassign'}
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
    openLeadsById,
    onReshufflePreview,
}: {
    instituteId: string;
    preview: ReassignResult | null;
    overrides: Record<string, string>;
    setOverrides: (next: Record<string, string>) => void;
    candidates: WorkbenchCounsellor[];
    openLeadsById: Map<string, WorkbenchLead>;
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
        // Only the table body needs to scroll independently — the parent
        // dialog body provides the vertical scroll. The sticky header keeps
        // the "Lead | Target counsellor" labels visible while the manager
        // scrolls through dozens of rows. `overflow-x-auto` survives narrow
        // viewports without forcing the parent into double-scroll.
        <div className="overflow-x-auto rounded border border-neutral-200">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-2">
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
                    {preview.assignments.map((a) => {
                        const full = openLeadsById.get(a.lead_id);
                        const name = full?.lead_name ?? a.lead_name ?? '—';
                        const email = full?.lead_email;
                        const phone = full?.lead_phone;
                        return (
                        <tr key={a.lead_id} className="border-t border-neutral-100">
                            <td className="px-3 py-2.5 text-neutral-900">
                                <div className="font-medium">{name}</div>
                                {(email || phone) && (
                                    <div className="text-caption text-neutral-500">
                                        {email}
                                        {email && phone ? ' · ' : ''}
                                        {phone}
                                    </div>
                                )}
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
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
