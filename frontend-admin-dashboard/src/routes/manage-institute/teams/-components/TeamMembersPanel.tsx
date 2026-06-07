import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Trash, Pencil, PlusCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import {
    listTeamMembers,
    removeTeamMember,
    updateTeamMember,
    type TeamMember,
} from '../-services/org-team-services';
import { fetchEligibleOrgUsers } from '../-services/institute-users-service';

interface Props {
    instituteId: string;
    teamId: string | null;
    teamName?: string | null;
    onAddMember: () => void;
    onMoveTeam: () => void;
    onEditTeam: () => void;
    onAddSubTeam: () => void;
}

/**
 * Right pane of the Org Chart tab. Resolves user_id → full_name via the
 * institute-users query so non-technical admins see real people, not UUIDs.
 * role_label is inline-editable. is_team_head toggles via the crown icon.
 */
export function TeamMembersPanel({
    instituteId,
    teamId,
    teamName,
    onAddMember,
    onMoveTeam,
    onEditTeam,
    onAddSubTeam,
}: Props) {
    const queryClient = useQueryClient();

    const membersQuery = useQuery({
        queryKey: ['org-team-members', teamId],
        enabled: !!teamId,
        queryFn: () => listTeamMembers(teamId!),
    });

    // One batch lookup against the institute roster, shared across rows.
    const usersQuery = useQuery({
        queryKey: ['eligible-org-users', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchEligibleOrgUsers(instituteId),
        staleTime: 60_000,
    });

    const userById = useMemo(() => {
        const map = new Map<string, { full_name: string; email: string | null }>();
        (usersQuery.data ?? []).forEach((u) =>
            map.set(u.id, { full_name: u.full_name, email: u.email })
        );
        return map;
    }, [usersQuery.data]);

    const removeMutation = useMutation({
        mutationFn: (mappingId: string) => removeTeamMember(teamId!, mappingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-team-members', teamId] });
            queryClient.invalidateQueries({ queryKey: ['org-chart', instituteId] });
            toast.success('Member removed');
        },
        onError: () => toast.error('Could not remove member'),
    });

    if (!teamId) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                <div className="text-h3 text-neutral-700">No team selected</div>
                <p className="max-w-sm text-subtitle text-neutral-500">
                    Pick a team from the left to see who's in it, or use{' '}
                    <span className="font-medium">+ New team</span> to create your first one.
                </p>
            </div>
        );
    }

    const members = membersQuery.data ?? [];
    const head = members.find((m) => m.is_team_head);
    const headName = head ? userById.get(head.user_id)?.full_name ?? head.user_id : null;

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-neutral-200 p-4">
                <div className="min-w-0">
                    <div className="truncate text-h3 font-medium text-neutral-900">
                        {teamName ?? 'Team'}
                    </div>
                    <div className="text-caption text-neutral-500">
                        {members.length === 0
                            ? 'No one is in this team yet'
                            : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                        {headName && (
                            <>
                                {' · '}
                                <span className="text-warning-600">
                                    Head: {headName}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <MyButton buttonType="secondary" scale="small" onClick={onEditTeam}>
                        <Pencil size={14} className="mr-1" /> Rename
                    </MyButton>
                    <MyButton buttonType="secondary" scale="small" onClick={onMoveTeam}>
                        Move
                    </MyButton>
                    <MyButton buttonType="secondary" scale="small" onClick={onAddSubTeam}>
                        <PlusCircle size={14} className="mr-1" /> Sub-team
                    </MyButton>
                    <MyButton buttonType="primary" scale="small" onClick={onAddMember}>
                        + Add person
                    </MyButton>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {membersQuery.isLoading ? (
                    <div className="text-subtitle text-neutral-500">Loading members…</div>
                ) : members.length === 0 ? (
                    <EmptyMembers onAddMember={onAddMember} />
                ) : (
                    <ul className="divide-y divide-neutral-100">
                        {members.map((m) => (
                            <MemberRow
                                key={m.mapping_id}
                                teamId={teamId}
                                instituteId={instituteId}
                                member={m}
                                displayName={userById.get(m.user_id)?.full_name ?? null}
                                displayEmail={userById.get(m.user_id)?.email ?? null}
                                onRemove={() => removeMutation.mutate(m.mapping_id)}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function EmptyMembers({ onAddMember }: { onAddMember: () => void }) {
    return (
        <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary-50">
                <PlusCircle size={22} className="text-primary-600" />
            </div>
            <div className="text-h4 font-medium text-neutral-900">No one in this team yet</div>
            <p className="mb-3 text-subtitle text-neutral-500">
                Add the people who belong here, then mark one of them as the team head.
            </p>
            <MyButton buttonType="primary" onClick={onAddMember}>
                + Add the first person
            </MyButton>
        </div>
    );
}

function MemberRow({
    teamId,
    instituteId,
    member,
    displayName,
    displayEmail,
    onRemove,
}: {
    teamId: string;
    instituteId: string;
    member: TeamMember;
    displayName: string | null;
    displayEmail: string | null;
    onRemove: () => void;
}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [draftLabel, setDraftLabel] = useState(member.role_label ?? '');

    const updateMutation = useMutation({
        mutationFn: (payload: { role_label?: string; is_team_head?: boolean }) =>
            updateTeamMember(teamId, member.mapping_id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-team-members', teamId] });
            queryClient.invalidateQueries({ queryKey: ['org-chart', instituteId] });
        },
        onError: () => toast.error('Could not update member'),
    });

    const name = displayName ?? `User ${member.user_id.slice(0, 6)}`;

    return (
        <li className="flex items-center gap-3 py-3">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-body font-medium text-neutral-900">{name}</span>
                    {member.is_team_head && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-1.5 py-0.5 text-caption text-warning-700">
                            <Crown size={11} weight="fill" /> Head
                        </span>
                    )}
                </div>
                <div className="truncate text-caption text-neutral-500">
                    {displayEmail ?? member.role_name}
                </div>
            </div>

            <div className="w-44 min-w-0">
                {editing ? (
                    <div className="flex items-center gap-1">
                        <input
                            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-body"
                            value={draftLabel}
                            onChange={(e) => setDraftLabel(e.target.value)}
                            autoFocus
                            placeholder="Friendly label"
                        />
                        <button
                            type="button"
                            className="rounded bg-primary-500 px-2 py-1 text-caption text-white hover:bg-primary-600"
                            onClick={() => {
                                updateMutation.mutate({ role_label: draftLabel });
                                setEditing(false);
                            }}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="w-full truncate text-left text-body text-neutral-700 hover:text-primary-600"
                    >
                        {member.role_label || <span className="italic text-neutral-400">Add label</span>}
                    </button>
                )}
            </div>

            <button
                type="button"
                onClick={() => updateMutation.mutate({ is_team_head: !member.is_team_head })}
                aria-label={member.is_team_head ? 'Remove as team head' : 'Make team head'}
                className="rounded p-1.5 hover:bg-neutral-100"
                title={member.is_team_head ? 'Currently the team head' : 'Make team head'}
            >
                <Crown
                    weight={member.is_team_head ? 'fill' : 'regular'}
                    size={18}
                    className={member.is_team_head ? 'text-warning-500' : 'text-neutral-400'}
                />
            </button>

            <button
                type="button"
                onClick={onRemove}
                className="rounded p-1.5 text-neutral-400 hover:bg-danger-50 hover:text-danger-600"
                aria-label="Remove from team"
                title="Remove from team"
            >
                <Trash size={16} />
            </button>
        </li>
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
