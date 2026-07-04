import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowsClockwise, UsersThree, User, PencilSimple } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CounsellorOption } from '@/hooks/use-lead-counsellor-options';
import { assignLeads } from '@/routes/counsellors/-services/counsellor-workbench-services';

type Mode = 'ROUND_ROBIN' | 'SINGLE' | 'MANUAL';

export interface BulkAssignLead {
    userId: string;
    name: string;
}

interface BulkAssignCounsellorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    /** The selected leads to assign. */
    leads: BulkAssignLead[];
    /** Scoped counsellor list (id + name) — the assignable targets. */
    counsellorOptions: CounsellorOption[];
    /** Fired after a successful commit (refetch + clear selection). */
    onSuccess?: () => void;
}

const MODES: { key: Mode; label: string; icon: React.ReactNode; hint: string }[] = [
    {
        key: 'ROUND_ROBIN',
        label: 'Round-robin',
        icon: <ArrowsClockwise className="size-4" />,
        hint: 'Distribute evenly across the selected counsellors.',
    },
    {
        key: 'SINGLE',
        label: 'Single person',
        icon: <User className="size-4" />,
        hint: 'Assign every selected lead to one counsellor.',
    },
    {
        key: 'MANUAL',
        label: 'Manual',
        icon: <PencilSimple className="size-4" />,
        hint: 'Pick a counsellor per lead below.',
    },
];

/**
 * Bulk-assign the selected leads to counsellor(s), mirroring the counsellor
 * re-assign flow: ROUND_ROBIN (across chosen counsellors), SINGLE (all to one),
 * or MANUAL (per-lead). The proposed per-lead mapping is always shown and
 * editable, and is committed verbatim — so what you see is what gets applied.
 */
export function BulkAssignCounsellorDialog({
    open,
    onOpenChange,
    instituteId,
    leads,
    counsellorOptions,
    onSuccess,
}: BulkAssignCounsellorDialogProps) {
    const [mode, setMode] = useState<Mode>('ROUND_ROBIN');
    const [singleTarget, setSingleTarget] = useState<string>('');
    // Round-robin participants — all counsellors pre-checked; admin can deselect.
    const [rrChecked, setRrChecked] = useState<Set<string>>(new Set());
    // Per-lead manual overrides (userId -> counsellor id).
    const [overrides, setOverrides] = useState<Record<string, string>>({});

    // (Re)initialise when the dialog opens or the counsellor list loads.
    useEffect(() => {
        if (open) {
            setMode('ROUND_ROBIN');
            setSingleTarget('');
            setRrChecked(new Set(counsellorOptions.map((c) => c.id)));
            setOverrides({});
        }
    }, [open, counsellorOptions]);

    const activeCandidates = useMemo(
        () => counsellorOptions.filter((c) => rrChecked.has(c.id)),
        [counsellorOptions, rrChecked]
    );

    // Base target for a lead at position `index` before manual overrides.
    const baseTarget = (index: number): string => {
        if (mode === 'SINGLE') return singleTarget;
        if (mode === 'ROUND_ROBIN') {
            return activeCandidates.length > 0
                ? (activeCandidates[index % activeCandidates.length]?.id ?? '')
                : '';
        }
        return ''; // MANUAL: no base, admin picks per row
    };

    const targetFor = (lead: BulkAssignLead, index: number): string =>
        overrides[lead.userId] ?? baseTarget(index);

    const toggleRrCandidate = (id: string, checked: boolean) =>
        setRrChecked((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });

    const setOverride = (userId: string, toUserId: string) =>
        setOverrides((prev) => ({ ...prev, [userId]: toUserId }));

    // "Reshuffle" clears manual edits so round-robin recomputes cleanly.
    const reshuffle = () => setOverrides({});

    const mutation = useMutation({
        mutationFn: () => {
            const assignments = leads.map((lead, index) => ({
                user_id: lead.userId,
                to_user_id: targetFor(lead, index),
            }));
            return assignLeads({
                institute_id: instituteId,
                user_ids: leads.map((l) => l.userId),
                mode: 'MANUAL', // commit the exact resolved plan
                assignments,
            });
        },
        onSuccess: (res) => {
            toast.success(`Assigned ${res.total_leads} lead(s) to counsellors`);
            onOpenChange(false);
            onSuccess?.();
        },
        onError: (err: unknown) => {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Failed to assign counsellors';
            toast.error(message);
        },
    });

    const handleAssign = () => {
        if (leads.length === 0) return;
        if (mode === 'SINGLE' && !singleTarget) {
            toast.error('Select a counsellor');
            return;
        }
        if (mode === 'ROUND_ROBIN' && activeCandidates.length === 0) {
            toast.error('Select at least one counsellor for round-robin');
            return;
        }
        const missing = leads.some((lead, index) => !targetFor(lead, index));
        if (missing) {
            toast.error('Pick a counsellor for every lead');
            return;
        }
        mutation.mutate();
    };

    const footer = (
        <div className="flex w-full items-center justify-between">
            <span className="text-caption text-neutral-500">{leads.length} lead(s) selected</span>
            <div className="flex gap-2">
                <MyButton buttonType="secondary" scale="small" onClick={() => onOpenChange(false)}>
                    Cancel
                </MyButton>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    disable={mutation.isPending}
                    onClick={handleAssign}
                >
                    {mutation.isPending ? 'Assigning…' : `Assign ${leads.length} lead(s)`}
                </MyButton>
            </div>
        </div>
    );

    return (
        <MyDialog
            heading="Assign counsellor"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="w-full max-w-2xl"
            footer={footer}
        >
            <div className="flex flex-col gap-4">
                {/* Mode picker */}
                <div className="grid grid-cols-3 gap-2">
                    {MODES.map((m) => (
                        <button
                            key={m.key}
                            type="button"
                            onClick={() => setMode(m.key)}
                            className={cn(
                                'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                                mode === m.key
                                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                                    : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                            )}
                        >
                            {m.icon}
                            <span className="text-body font-medium">{m.label}</span>
                        </button>
                    ))}
                </div>
                <p className="text-caption text-neutral-500">
                    {MODES.find((m) => m.key === mode)?.hint}
                </p>

                {/* SINGLE: one counsellor */}
                {mode === 'SINGLE' && (
                    <Select value={singleTarget} onValueChange={setSingleTarget}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a counsellor" />
                        </SelectTrigger>
                        <SelectContent>
                            {counsellorOptions.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.full_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* ROUND_ROBIN: participant checkboxes (all pre-checked) */}
                {mode === 'ROUND_ROBIN' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-body font-medium text-neutral-700">
                            <UsersThree className="size-4 text-neutral-500" />
                            Counsellors in rotation
                        </div>
                        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                            {counsellorOptions.length === 0 && (
                                <span className="text-caption text-neutral-400">
                                    No counsellors available.
                                </span>
                            )}
                            {counsellorOptions.map((c) => (
                                <label
                                    key={c.id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-body hover:bg-neutral-100"
                                >
                                    <Checkbox
                                        checked={rrChecked.has(c.id)}
                                        onCheckedChange={(checked) =>
                                            toggleRrCandidate(c.id, checked === true)
                                        }
                                    />
                                    {c.full_name}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Per-lead preview — always shown, editable. */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-body font-medium text-neutral-700">
                            Assignment preview
                        </span>
                        {mode === 'ROUND_ROBIN' && Object.keys(overrides).length > 0 && (
                            <MyButton buttonType="text" scale="small" onClick={reshuffle}>
                                <ArrowsClockwise className="size-3.5" />
                                Reshuffle
                            </MyButton>
                        )}
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-200">
                        <table className="w-full text-left text-body">
                            <thead className="sticky top-0 bg-neutral-50">
                                <tr>
                                    <th className="px-3 py-2 font-medium text-neutral-600">Lead</th>
                                    <th className="px-3 py-2 font-medium text-neutral-600">
                                        Counsellor
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {leads.map((lead, index) => {
                                    const value = targetFor(lead, index);
                                    return (
                                        <tr key={lead.userId}>
                                            <td className="truncate px-3 py-2 text-neutral-800">
                                                {lead.name}
                                            </td>
                                            <td className="px-3 py-2">
                                                <Select
                                                    value={value || undefined}
                                                    onValueChange={(v) => setOverride(lead.userId, v)}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Select counsellor" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {counsellorOptions.map((c) => (
                                                            <SelectItem key={c.id} value={c.id}>
                                                                {c.full_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </MyDialog>
    );
}
