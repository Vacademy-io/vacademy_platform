import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { MagnifyingGlass, User } from '@phosphor-icons/react';
import { addTeamMember } from '../-services/org-team-services';
import { type InstituteUser } from '../-services/institute-users-service';

interface PersonInTeam {
    mappingId: string;
    userId: string;
    name: string;
    depth: number;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamId: string;
    teamName: string;
    /** Institute users not already in this team. */
    eligibleUsers: InstituteUser[];
    /** People already in this team, flattened from the chart (for the "Reports to" picker). */
    peopleInTeam: PersonInTeam[];
    onAdded: () => void;
}

/**
 * Two-step add: pick a person from the institute, then optionally pick who
 * they report to. Leaving "Reports to" blank places them at the top of the
 * team. Drag-drop in the chart can change this later.
 */
export function AddPersonDialog({
    open,
    onOpenChange,
    teamId,
    teamName,
    eligibleUsers,
    peopleInTeam,
    onAdded,
}: Props) {
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState<InstituteUser | null>(null);
    const [parentUserId, setParentUserId] = useState<string>('');
    const [roleLabel, setRoleLabel] = useState('');

    useEffect(() => {
        if (open) {
            setSearch('');
            setPicked(null);
            setParentUserId('');
            setRoleLabel('');
        }
    }, [open]);

    const filtered = useMemo(() => {
        if (!search.trim()) return eligibleUsers;
        const q = search.trim().toLowerCase();
        return eligibleUsers.filter(
            (u) =>
                u.full_name.toLowerCase().includes(q) ||
                (u.email ?? '').toLowerCase().includes(q)
        );
    }, [eligibleUsers, search]);

    const addMutation = useMutation({
        mutationFn: () => {
            if (!picked) throw new Error('No user selected');
            return addTeamMember(teamId, {
                user_id: picked.id,
                parent_user_id: parentUserId || null,
                role_label: roleLabel.trim() || undefined,
            });
        },
        onSuccess: () => {
            const where = parentUserId
                ? peopleInTeam.find((p) => p.userId === parentUserId)?.name ?? 'their manager'
                : 'top of team';
            toast.success(`Added ${picked?.full_name ?? 'member'} under ${where}`);
            onAdded();
            onOpenChange(false);
        },
        onError: (e) => {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not add this person');
        },
    });

    function handleSubmit() {
        if (!picked) return;
        addMutation.mutate();
    }

    const submitting = addMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-h3">
                        Add a person to {teamName}
                    </DialogTitle>
                    <p className="text-subtitle text-neutral-500">
                        {picked
                            ? 'Optionally pick a manager and a label for this position.'
                            : 'Pick someone from your institute.'}
                    </p>
                </DialogHeader>

                {!picked ? (
                    <>
                        <div className="relative">
                            <MagnifyingGlass
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                            />
                            <input
                                autoFocus
                                className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-body"
                                placeholder="Search by name or email…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="max-h-72 overflow-auto rounded-md border border-neutral-200">
                            {filtered.length === 0 ? (
                                <div className="p-6 text-center text-subtitle text-neutral-500">
                                    {eligibleUsers.length === 0
                                        ? 'Everyone in the institute is already in this team.'
                                        : 'No one matches that search.'}
                                </div>
                            ) : (
                                <ul>
                                    {filtered.map((u) => (
                                        <li key={u.id}>
                                            <button
                                                type="button"
                                                onClick={() => setPicked(u)}
                                                className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-50"
                                            >
                                                <Avatar name={u.full_name} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-body font-medium text-neutral-900">
                                                        {u.full_name || 'Unnamed'}
                                                    </div>
                                                    <div className="truncate text-caption text-neutral-500">
                                                        {u.email ?? (u.roles ?? [])[0] ?? ''}
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                            <Avatar name={picked.full_name} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-body font-medium text-neutral-900">
                                    {picked.full_name || 'Unnamed'}
                                </div>
                                <div className="truncate text-caption text-neutral-500">
                                    {picked.email ?? (picked.roles ?? [])[0] ?? ''}
                                </div>
                            </div>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => {
                                    setPicked(null);
                                    setParentUserId('');
                                    setRoleLabel('');
                                }}
                            >
                                Change
                            </MyButton>
                        </div>

                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                Reports to <span className="text-neutral-400">(optional)</span>
                            </label>
                            <select
                                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                                value={parentUserId}
                                onChange={(e) => setParentUserId(e.target.value)}
                            >
                                <option value="">No manager — top of team</option>
                                {peopleInTeam.map((p) => (
                                    <option key={p.mappingId} value={p.userId}>
                                        {'  '.repeat(p.depth)}
                                        {p.depth > 0 ? '↳ ' : ''}
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-caption text-neutral-500">
                                You can drag-and-drop in the chart to change this later.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                Position label{' '}
                                <span className="text-neutral-400">(optional)</span>
                            </label>
                            <input
                                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                                placeholder="e.g. Sales Head, Counsellor Lead"
                                value={roleLabel}
                                onChange={(e) => setRoleLabel(e.target.value)}
                                maxLength={100}
                            />
                            <p className="mt-1 text-caption text-neutral-500">
                                Shown under their name in the chart. Their system role
                                stays unchanged.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <MyButton
                        buttonType="secondary"
                        onClick={() => onOpenChange(false)}
                        disable={submitting}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        onClick={handleSubmit}
                        disable={!picked || submitting}
                    >
                        {submitting ? 'Adding…' : 'Add to team'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Avatar({ name }: { name: string }) {
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-h4 font-semibold text-primary-700">
            {initial || <User size={16} />}
        </div>
    );
}
