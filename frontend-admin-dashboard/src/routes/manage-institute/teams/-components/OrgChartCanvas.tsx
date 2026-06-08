import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Trash,
    PencilSimple,
    UsersThree,
    User,
    ArrowLineUp,
    X,
    Info,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import {
    createTeam,
    deleteTeam,
    fetchTeamChart,
    listTeams,
    removeTeamMember,
    updateTeam,
    updateTeamMember,
    type OrgChartNode,
    type OrgTeam,
} from '../-services/org-team-services';
import { fetchEligibleOrgUsers, type InstituteUser } from '../-services/institute-users-service';
import { AddPersonDialog } from './AddPersonDialog';
import './org-chart-tree.css';

interface Props {
    instituteId: string;
}

const HINT_DISMISSED_KEY = 'org-chart-hint-dismissed';

/**
 * Org Chart tab. Hybrid model:
 *   - flat list of teams (no sub-teams)
 *   - inside each team, a user-to-user reporting tree via parent_user_id
 *
 * Single-page UI: team picker at top, drag-drop tree below. Designed to be
 * usable by non-technical admins — plain-English copy, generous tap
 * targets, dismissible help banner, drop zones only during drag, and
 * confirmation dialogs that explain what's going to happen.
 */
export function OrgChartCanvas({ instituteId }: Props) {
    const queryClient = useQueryClient();
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [newTeamOpen, setNewTeamOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);

    // Drag state.
    const [dragMappingId, setDragMappingId] = useState<string | null>(null);
    const [dragOverMappingId, setDragOverMappingId] = useState<string | null>(null);
    const [dragOverRoot, setDragOverRoot] = useState(false);

    useEffect(() => {
        setHintDismissed(localStorage.getItem(HINT_DISMISSED_KEY) === '1');
    }, []);

    const teamsQuery = useQuery({
        queryKey: ['org-teams', instituteId],
        enabled: !!instituteId,
        queryFn: () => listTeams(instituteId),
    });

    const usersQuery = useQuery({
        queryKey: ['eligible-org-users', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchEligibleOrgUsers(instituteId),
        staleTime: 60_000,
    });

    // Default-select the first team once loaded; auto-rotate if the
    // currently-selected team disappears (e.g. after Delete team).
    useEffect(() => {
        const teams = teamsQuery.data ?? [];
        if (teams.length === 0) {
            if (selectedTeamId !== null) setSelectedTeamId(null);
            return;
        }
        const firstTeam = teams[0];
        if (firstTeam && (!selectedTeamId || !teams.some((t) => t.id === selectedTeamId))) {
            setSelectedTeamId(firstTeam.id);
        }
    }, [teamsQuery.data, selectedTeamId]);

    const chartQuery = useQuery({
        queryKey: ['org-team-chart', selectedTeamId],
        enabled: !!selectedTeamId,
        queryFn: () => fetchTeamChart(selectedTeamId!),
    });

    const userById = useMemo(() => {
        const m = new Map<string, InstituteUser>();
        (usersQuery.data ?? []).forEach((u) => m.set(u.id, u));
        return m;
    }, [usersQuery.data]);

    const selectedTeam = (teamsQuery.data ?? []).find((t) => t.id === selectedTeamId) ?? null;

    // Users already in the current team — exclude from the Add Person picker
    // (one membership per (team, user)).
    const placedUserIdsInTeam = useMemo(() => {
        const ids = new Set<string>();
        const walk = (n: OrgChartNode) => {
            ids.add(n.user_id);
            n.children?.forEach(walk);
        };
        (chartQuery.data ?? []).forEach(walk);
        return ids;
    }, [chartQuery.data]);

    // For the Reports-to picker in Add Person and for cycle previews.
    const peopleInTeam = useMemo(() => {
        const out: { mappingId: string; userId: string; name: string; depth: number }[] = [];
        const walk = (n: OrgChartNode, depth: number) => {
            const u = userById.get(n.user_id);
            out.push({
                mappingId: n.mapping_id,
                userId: n.user_id,
                name: u?.full_name || `User ${n.user_id.slice(0, 6)}`,
                depth,
            });
            n.children?.forEach((c) => walk(c, depth + 1));
        };
        (chartQuery.data ?? []).forEach((n) => walk(n, 0));
        return out;
    }, [chartQuery.data, userById]);

    // ── Mutations ────────────────────────────────────────────────

    const moveMutation = useMutation({
        mutationFn: ({ mappingId, parentUserId }: { mappingId: string; parentUserId: string | null }) =>
            updateTeamMember(selectedTeamId!, mappingId, {
                change_parent: true,
                parent_user_id: parentUserId,
            }),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ['org-team-chart', selectedTeamId] });
            const target = vars.parentUserId
                ? userById.get(vars.parentUserId)?.full_name ?? 'that manager'
                : 'top of team';
            toast.success(`Moved under ${target}`);
        },
        onError: (e) => {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not move this person');
        },
    });

    const removeMutation = useMutation({
        mutationFn: (mappingId: string) => removeTeamMember(selectedTeamId!, mappingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-team-chart', selectedTeamId] });
            queryClient.invalidateQueries({ queryKey: ['org-teams', instituteId] });
            toast.success('Removed from team');
        },
        onError: () => toast.error('Could not remove this person'),
    });

    const deleteTeamMutation = useMutation({
        mutationFn: (teamId: string) => deleteTeam(teamId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-teams', instituteId] });
            toast.success('Team deleted');
        },
        onError: () => toast.error('Could not delete this team'),
    });

    // ── Drop handlers ────────────────────────────────────────────

    function handleDropOnPerson(targetUserId: string) {
        if (!dragMappingId) return;
        const dragged = peopleInTeam.find((p) => p.mappingId === dragMappingId);
        if (!dragged) return;
        if (dragged.userId === targetUserId) {
            // Dropped on self: no-op.
            resetDrag();
            return;
        }
        moveMutation.mutate({ mappingId: dragMappingId, parentUserId: targetUserId });
        resetDrag();
    }

    function handleDropOnRoot() {
        if (!dragMappingId) return;
        moveMutation.mutate({ mappingId: dragMappingId, parentUserId: null });
        resetDrag();
    }

    function resetDrag() {
        setDragMappingId(null);
        setDragOverMappingId(null);
        setDragOverRoot(false);
    }

    const isTeamLoading = teamsQuery.isLoading;
    const teams = teamsQuery.data ?? [];

    // ── First-time, empty institute ─────────────────────────────

    if (!isTeamLoading && teams.length === 0) {
        return (
            <>
                <NoTeamsHero onCreate={() => setNewTeamOpen(true)} />
                <NewTeamDialog
                    open={newTeamOpen}
                    onOpenChange={setNewTeamOpen}
                    instituteId={instituteId}
                    onCreated={(team) => {
                        queryClient.invalidateQueries({ queryKey: ['org-teams', instituteId] });
                        setSelectedTeamId(team.id);
                    }}
                />
            </>
        );
    }

    return (
        <div className="flex h-full flex-col">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2">
                <span className="text-caption font-medium text-neutral-500">Showing team</span>
                <select
                    className="min-w-44 rounded-md border border-neutral-300 px-3 py-1.5 text-body"
                    value={selectedTeamId ?? ''}
                    onChange={(e) => setSelectedTeamId(e.target.value || null)}
                >
                    {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name} ({t.member_count})
                        </option>
                    ))}
                </select>

                {selectedTeam && (
                    <>
                        <button
                            type="button"
                            onClick={() => setRenameOpen(true)}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-caption text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"
                            title="Rename this team"
                        >
                            <PencilSimple size={12} /> Rename
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        `Delete "${selectedTeam.name}" and remove all ${selectedTeam.member_count} members from it? Their memberships in other teams are not affected.`
                                    )
                                ) {
                                    deleteTeamMutation.mutate(selectedTeam.id);
                                }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-caption text-danger-600 hover:bg-danger-50"
                            title="Delete this team"
                        >
                            <Trash size={12} /> Delete team
                        </button>
                    </>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <MyButton buttonType="secondary" scale="small" onClick={() => setNewTeamOpen(true)}>
                        <Plus size={14} className="mr-1" /> New team
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={() => setAddOpen(true)}
                        disable={!selectedTeamId}
                    >
                        <Plus size={14} className="mr-1" /> Add person
                    </MyButton>
                </div>
            </div>

            {/* ── Help banner (dismissible) ──────────────────────── */}
            {!hintDismissed && (
                <div className="flex items-start gap-2 border-b border-info-100 bg-primary-50 px-3 py-2 text-subtitle text-primary-800">
                    <Info size={16} className="mt-0.5 shrink-0 text-primary-600" />
                    <div className="flex-1">
                        Drag a person card onto another card to change who they report to. Drop onto the
                        “Top of team” zone (visible while dragging) to remove their manager.
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            localStorage.setItem(HINT_DISMISSED_KEY, '1');
                            setHintDismissed(true);
                        }}
                        className="rounded p-0.5 hover:bg-primary-100"
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ── Top-of-team drop zone (only while dragging) ───── */}
            {dragMappingId && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverRoot(true);
                    }}
                    onDragLeave={() => setDragOverRoot(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnRoot();
                    }}
                    className={cn(
                        'mx-3 mt-3 flex items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 text-subtitle transition-colors',
                        dragOverRoot
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-neutral-300 text-neutral-500'
                    )}
                >
                    <ArrowLineUp size={16} />
                    Drop here to make this person top of {selectedTeam?.name ?? 'the team'} (no manager)
                </div>
            )}

            {/* ── Canvas ─────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-auto bg-neutral-50 p-6">
                {chartQuery.isLoading ? (
                    <div className="text-subtitle text-neutral-500">Loading {selectedTeam?.name}…</div>
                ) : chartQuery.isError ? (
                    <div className="text-subtitle text-danger-600">
                        Could not load this team. Try refreshing.
                    </div>
                ) : (chartQuery.data ?? []).length === 0 ? (
                    <EmptyTeam
                        teamName={selectedTeam?.name ?? 'this team'}
                        onAdd={() => setAddOpen(true)}
                    />
                ) : (
                    <div className="org-tree mx-auto">
                        <ul>
                            {chartQuery.data!.map((node) => (
                                <PersonNode
                                    key={node.mapping_id}
                                    node={node}
                                    userById={userById}
                                    dragMappingId={dragMappingId}
                                    dragOverMappingId={dragOverMappingId}
                                    onDragStart={setDragMappingId}
                                    onDragEnd={resetDrag}
                                    onDragOverNode={setDragOverMappingId}
                                    onDropOnNode={handleDropOnPerson}
                                    onRemove={(m) => {
                                        const u = userById.get(m.user_id);
                                        const name = u?.full_name || 'this person';
                                        if (
                                            window.confirm(
                                                `Remove ${name} from ${selectedTeam?.name}? Their memberships in other teams are not affected.`
                                            )
                                        ) {
                                            removeMutation.mutate(m.mapping_id);
                                        }
                                    }}
                                />
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* ── Dialogs ────────────────────────────────────────── */}
            <NewTeamDialog
                open={newTeamOpen}
                onOpenChange={setNewTeamOpen}
                instituteId={instituteId}
                onCreated={(team) => {
                    queryClient.invalidateQueries({ queryKey: ['org-teams', instituteId] });
                    setSelectedTeamId(team.id);
                }}
            />
            {selectedTeam && (
                <RenameTeamDialog
                    open={renameOpen}
                    onOpenChange={setRenameOpen}
                    team={selectedTeam}
                    onRenamed={() => {
                        queryClient.invalidateQueries({ queryKey: ['org-teams', instituteId] });
                    }}
                />
            )}
            {selectedTeamId && (
                <AddPersonDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    teamId={selectedTeamId}
                    teamName={selectedTeam?.name ?? 'the team'}
                    eligibleUsers={(usersQuery.data ?? []).filter(
                        (u) => !placedUserIdsInTeam.has(u.id)
                    )}
                    peopleInTeam={peopleInTeam}
                    onAdded={() => {
                        queryClient.invalidateQueries({ queryKey: ['org-team-chart', selectedTeamId] });
                        queryClient.invalidateQueries({ queryKey: ['org-teams', instituteId] });
                    }}
                />
            )}
        </div>
    );
}

// ─── Person node + card ─────────────────────────────────────────

function PersonNode({
    node,
    userById,
    dragMappingId,
    dragOverMappingId,
    onDragStart,
    onDragEnd,
    onDragOverNode,
    onDropOnNode,
    onRemove,
}: {
    node: OrgChartNode;
    userById: Map<string, InstituteUser>;
    dragMappingId: string | null;
    dragOverMappingId: string | null;
    onDragStart: (mappingId: string) => void;
    onDragEnd: () => void;
    onDragOverNode: (mappingId: string | null) => void;
    onDropOnNode: (userId: string) => void;
    onRemove: (node: OrgChartNode) => void;
}) {
    const hasChildren = (node.children?.length ?? 0) > 0;
    return (
        <li>
            <PersonCard
                node={node}
                user={userById.get(node.user_id)}
                dragging={dragMappingId === node.mapping_id}
                dragOver={dragOverMappingId === node.mapping_id}
                onDragStart={() => onDragStart(node.mapping_id)}
                onDragEnd={onDragEnd}
                onDragOverNode={() => onDragOverNode(node.mapping_id)}
                onDragLeaveNode={() => onDragOverNode(null)}
                onDropOnNode={() => onDropOnNode(node.user_id)}
                onRemove={() => onRemove(node)}
            />
            {hasChildren && (
                <ul>
                    {node.children.map((c) => (
                        <PersonNode
                            key={c.mapping_id}
                            node={c}
                            userById={userById}
                            dragMappingId={dragMappingId}
                            dragOverMappingId={dragOverMappingId}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onDragOverNode={onDragOverNode}
                            onDropOnNode={onDropOnNode}
                            onRemove={onRemove}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

function PersonCard({
    node,
    user,
    dragging,
    dragOver,
    onDragStart,
    onDragEnd,
    onDragOverNode,
    onDragLeaveNode,
    onDropOnNode,
    onRemove,
}: {
    node: OrgChartNode;
    user: InstituteUser | undefined;
    dragging: boolean;
    dragOver: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOverNode: () => void;
    onDragLeaveNode: () => void;
    onDropOnNode: () => void;
    onRemove: () => void;
}) {
    const name = user?.full_name || `User ${node.user_id.slice(0, 6)}`;
    const systemRole = (user?.roles ?? []).find((r) => r) ?? null;

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', node.mapping_id);
                onDragStart();
            }}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
                e.preventDefault();
                onDragOverNode();
            }}
            onDragLeave={onDragLeaveNode}
            onDrop={(e) => {
                e.preventDefault();
                onDropOnNode();
            }}
            className={cn(
                'group inline-flex w-60 cursor-grab flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-all active:cursor-grabbing',
                dragging && 'opacity-50',
                dragOver && 'border-primary-500 ring-2 ring-primary-200',
                !dragOver &&
                    !dragging &&
                    'border-neutral-200 hover:border-primary-200 hover:shadow-md'
            )}
        >
            <div className="h-1 bg-primary-500" />
            <div className="flex items-start gap-2.5 px-3 py-2.5">
                <Avatar name={name} />
                <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-body font-semibold text-neutral-900">{name}</div>
                    {node.role_label && (
                        <div className="mt-0.5 truncate text-caption italic text-neutral-700">
                            {node.role_label}
                        </div>
                    )}
                    {(systemRole || user?.email) && (
                        <div className="mt-0.5 truncate text-caption text-neutral-500">
                            {systemRole ?? user?.email}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="rounded p-1 text-neutral-400 opacity-0 transition-opacity hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
                    title="Remove from this team"
                    aria-label="Remove from this team"
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                >
                    <Trash size={14} />
                </button>
            </div>
        </div>
    );
}

function Avatar({ name }: { name: string }) {
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return (
        <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-h4 font-semibold text-primary-700"
            aria-hidden="true"
        >
            {initial || <User size={16} />}
        </div>
    );
}

// ─── Empty states ───────────────────────────────────────────────

function NoTeamsHero({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary-50">
                <UsersThree size={28} className="text-primary-600" />
            </div>
            <h2 className="text-h2 font-medium text-neutral-900">Create your first team</h2>
            <p className="max-w-md text-subtitle text-neutral-500">
                Group your institute into teams like Sales, Counselling, or Engineering. Each team
                can have its own reporting structure. People can belong to more than one team.
            </p>
            <MyButton buttonType="primary" onClick={onCreate}>
                + New team
            </MyButton>
        </div>
    );
}

function EmptyTeam({ teamName, onAdd }: { teamName: string; onAdd: () => void }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary-50">
                <UsersThree size={22} className="text-primary-600" />
            </div>
            <h2 className="text-h3 font-medium text-neutral-900">{teamName} is empty</h2>
            <p className="text-subtitle text-neutral-500">
                Add the first person, then add more and arrange who reports to whom by dragging cards.
            </p>
            <MyButton buttonType="primary" onClick={onAdd}>
                + Add the first person
            </MyButton>
        </div>
    );
}

// ─── Light-weight inline dialogs (rename / new team) ────────────

function NewTeamDialog({
    open,
    onOpenChange,
    instituteId,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    instituteId: string;
    onCreated: (team: OrgTeam) => void;
}) {
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setName('');
            setSubmitting(false);
        }
    }, [open]);

    async function handleCreate() {
        if (!name.trim()) {
            toast.error('Give the team a name');
            return;
        }
        setSubmitting(true);
        try {
            const team = await createTeam({ institute_id: instituteId, name: name.trim() });
            toast.success(`Created “${team.name}”`);
            onCreated(team);
            onOpenChange(false);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not create team');
        } finally {
            setSubmitting(false);
        }
    }

    if (!open) return null;
    return (
        <Modal title="New team" subtitle="Teams are flat — there are no sub-teams in this design." onClose={() => onOpenChange(false)}>
            <label className="mb-1 block text-caption font-medium text-neutral-700">Team name</label>
            <input
                autoFocus
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                placeholder='e.g. "Sales", "Counselling", "Engineering"'
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <ModalFooter>
                <MyButton buttonType="secondary" onClick={() => onOpenChange(false)} disable={submitting}>
                    Cancel
                </MyButton>
                <MyButton buttonType="primary" onClick={handleCreate} disable={submitting}>
                    {submitting ? 'Creating…' : 'Create team'}
                </MyButton>
            </ModalFooter>
        </Modal>
    );
}

function RenameTeamDialog({
    open,
    onOpenChange,
    team,
    onRenamed,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    team: OrgTeam;
    onRenamed: () => void;
}) {
    const [name, setName] = useState(team.name);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setName(team.name);
            setSubmitting(false);
        }
    }, [open, team]);

    async function handleSave() {
        if (!name.trim()) {
            toast.error('Team needs a name');
            return;
        }
        setSubmitting(true);
        try {
            await updateTeam(team.id, { name: name.trim() });
            toast.success('Team renamed');
            onRenamed();
            onOpenChange(false);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not rename team');
        } finally {
            setSubmitting(false);
        }
    }

    if (!open) return null;
    return (
        <Modal title={`Rename ${team.name}`} onClose={() => onOpenChange(false)}>
            <label className="mb-1 block text-caption font-medium text-neutral-700">New name</label>
            <input
                autoFocus
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <ModalFooter>
                <MyButton buttonType="secondary" onClick={() => onOpenChange(false)} disable={submitting}>
                    Cancel
                </MyButton>
                <MyButton buttonType="primary" onClick={handleSave} disable={submitting}>
                    {submitting ? 'Saving…' : 'Save'}
                </MyButton>
            </ModalFooter>
        </Modal>
    );
}

function Modal({
    title,
    subtitle,
    onClose,
    children,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-h3 font-medium text-neutral-900">{title}</h3>
                {subtitle && <p className="mb-3 text-subtitle text-neutral-500">{subtitle}</p>}
                {children}
            </div>
        </div>
    );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
    return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
