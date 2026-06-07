import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { MagnifyingGlass, Crown, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { addTeamMember } from '../-services/org-team-services';
import { fetchEligibleOrgUsers, type InstituteUser } from '../-services/institute-users-service';
import { getInstituteId } from '@/constants/helper';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamId: string | null;
    teamName?: string | null;
    onAdded?: () => void;
}

/**
 * Friendly "Add a person to this team" dialog. The picker is a searchable
 * list of institute members — non-technical users never see (or type) a
 * user_id. The role label defaults to a sensible suggestion based on the
 * picked person's system role, but the admin can override.
 */
export function AddMemberDialog({ open, onOpenChange, teamId, teamName, onAdded }: Props) {
    const instituteId = getInstituteId();
    const [search, setSearch] = useState('');
    const [pickedUser, setPickedUser] = useState<InstituteUser | null>(null);
    const [roleLabel, setRoleLabel] = useState('');
    const [makeHead, setMakeHead] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const usersQuery = useQuery({
        queryKey: ['eligible-org-users', instituteId],
        enabled: !!instituteId && open,
        queryFn: () => fetchEligibleOrgUsers(instituteId!),
        staleTime: 60_000,
    });

    const filtered = useMemo(() => {
        const all = usersQuery.data ?? [];
        if (!search.trim()) return all;
        const q = search.trim().toLowerCase();
        return all.filter(
            (u) =>
                u.full_name.toLowerCase().includes(q) ||
                (u.email ?? '').toLowerCase().includes(q)
        );
    }, [usersQuery.data, search]);

    function reset() {
        setSearch('');
        setPickedUser(null);
        setRoleLabel('');
        setMakeHead(false);
        setSubmitting(false);
    }

    async function handleAdd() {
        if (!teamId || !pickedUser) {
            toast.error('Pick a person from the list first');
            return;
        }
        const systemRole = pickRoleName(pickedUser);
        setSubmitting(true);
        try {
            await addTeamMember(teamId, {
                user_id: pickedUser.id,
                role_name: systemRole,
                role_label: roleLabel.trim() || undefined,
                is_team_head: makeHead,
            });
            toast.success(`${pickedUser.full_name || 'Member'} added to ${teamName ?? 'team'}`);
            onAdded?.();
            onOpenChange(false);
            reset();
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not add this person');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                onOpenChange(o);
                if (!o) reset();
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-h3">
                        Add a person to {teamName ?? 'this team'}
                    </DialogTitle>
                    <p className="text-subtitle text-neutral-500">
                        Pick someone from your institute. Students cannot be added here.
                    </p>
                </DialogHeader>

                {!pickedUser ? (
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
                        <div className="max-h-[300px] overflow-auto rounded-md border border-neutral-200">
                            {usersQuery.isLoading ? (
                                <div className="p-4 text-subtitle text-neutral-500">
                                    Loading institute members…
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="p-6 text-center text-subtitle text-neutral-500">
                                    No one matches that search.
                                </div>
                            ) : (
                                <ul>
                                    {filtered.map((u) => (
                                        <li key={u.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPickedUser(u);
                                                    setRoleLabel(
                                                        suggestedLabel(pickRoleName(u))
                                                    );
                                                }}
                                                className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-50"
                                            >
                                                <Avatar name={u.full_name} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-body font-medium text-neutral-900">
                                                        {u.full_name || 'Unnamed'}
                                                    </div>
                                                    <div className="truncate text-caption text-neutral-500">
                                                        {u.email ?? pickRoleName(u)}
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
                            <Avatar name={pickedUser.full_name} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-body font-medium text-neutral-900">
                                    {pickedUser.full_name || 'Unnamed'}
                                </div>
                                <div className="truncate text-caption text-neutral-500">
                                    {pickedUser.email ?? pickRoleName(pickedUser)}
                                </div>
                            </div>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => {
                                    setPickedUser(null);
                                    setRoleLabel('');
                                    setMakeHead(false);
                                }}
                            >
                                Change
                            </MyButton>
                        </div>

                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                What should we call their role here?
                            </label>
                            <input
                                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                                placeholder='e.g. "Org head", "Manager", "Advisor"'
                                value={roleLabel}
                                onChange={(e) => setRoleLabel(e.target.value)}
                            />
                            <p className="mt-1 text-caption text-neutral-500">
                                This is just a friendly label shown on the org chart. It does not
                                change their permissions.
                            </p>
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 p-3 hover:bg-neutral-50">
                            <input
                                type="checkbox"
                                className="size-4"
                                checked={makeHead}
                                onChange={(e) => setMakeHead(e.target.checked)}
                            />
                            <Crown
                                size={16}
                                weight={makeHead ? 'fill' : 'regular'}
                                className={makeHead ? 'text-warning-500' : 'text-neutral-400'}
                            />
                            <div>
                                <div className="text-body text-neutral-900">
                                    Make them the head of this team
                                </div>
                                <div className="text-caption text-neutral-500">
                                    Only one person can be the head. If someone else is the head,
                                    they will be replaced.
                                </div>
                            </div>
                            {makeHead && (
                                <Check size={16} className="ml-auto text-success-600" />
                            )}
                        </label>
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
                        onClick={handleAdd}
                        disable={submitting || !pickedUser}
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
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-h4 font-medium text-primary-700">
            {initial}
        </div>
    );
}

function pickRoleName(user: InstituteUser): string {
    const roles = (user.roles ?? []).map((r) => r.toUpperCase());
    if (roles.includes('ADMIN')) return 'ADMIN';
    if (roles.includes('COUNSELLOR')) return 'COUNSELLOR';
    if (roles.includes('TEACHER')) return 'TEACHER';
    return roles[0] ?? 'ADMIN';
}

function suggestedLabel(role: string): string {
    switch (role) {
        case 'ADMIN':
            return 'Org head';
        case 'COUNSELLOR':
            return 'Counsellor';
        case 'TEACHER':
            return 'Teacher';
        default:
            return '';
    }
}
