import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import { Plus, TreeStructure } from '@phosphor-icons/react';
import { fetchOrgChart, type OrgTeamNode } from '../-services/org-team-services';
import { OrgChartTree } from './OrgChartTree';
import { TeamMembersPanel } from './TeamMembersPanel';
import { TeamFormDialog } from './TeamFormDialog';
import { MoveTeamDialog } from './MoveTeamDialog';
import { AddMemberDialog } from './AddMemberDialog';

interface Props {
    instituteId: string;
}

type CreateMode = { open: boolean; parentId: string | null; parentName: string | null };

/**
 * Org Chart tab — two-pane layout with a friendly empty state when the
 * institute has no teams yet.
 *
 * Visual hierarchy:
 *   - Left: collapsible team tree
 *   - Right: members panel (or empty hero when no team is picked)
 *   - Dialogs: create / edit / move team, and add a member
 */
export function OrgChartTab({ instituteId }: Props) {
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [create, setCreate] = useState<CreateMode>({
        open: false,
        parentId: null,
        parentName: null,
    });
    const [editOpen, setEditOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [addMemberOpen, setAddMemberOpen] = useState(false);

    const chartQuery = useQuery({
        queryKey: ['org-chart', instituteId],
        queryFn: () => fetchOrgChart(instituteId),
        enabled: !!instituteId,
    });

    const flat = useMemo(() => flatten(chartQuery.data ?? []), [chartQuery.data]);
    const selectedTeam = flat.find((t) => t.id === selectedTeamId) ?? null;

    const isEmpty = chartQuery.data && chartQuery.data.length === 0;

    return (
        <div className="flex h-[calc(100vh-260px)] overflow-hidden rounded-md border border-neutral-200 bg-white">
            {/* Left rail */}
            <div className="flex w-[320px] flex-col border-r border-neutral-200">
                <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-3">
                    <div className="text-subtitle font-medium text-neutral-800">Teams</div>
                    {!isEmpty && (
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={() =>
                                setCreate({ open: true, parentId: null, parentName: null })
                            }
                        >
                            <Plus size={14} className="mr-1" /> New team
                        </MyButton>
                    )}
                </div>
                <div className="flex-1 overflow-auto">
                    {chartQuery.isLoading ? (
                        <div className="p-4 text-subtitle text-neutral-500">Loading…</div>
                    ) : chartQuery.isError ? (
                        <div className="p-4 text-subtitle text-danger-600">
                            Could not load the chart. Try refreshing.
                        </div>
                    ) : isEmpty ? (
                        <div className="p-4 text-subtitle text-neutral-500">
                            No teams yet — use the button on the right to create your first one.
                        </div>
                    ) : (
                        <OrgChartTree
                            roots={chartQuery.data ?? []}
                            selectedTeamId={selectedTeamId}
                            onSelect={setSelectedTeamId}
                        />
                    )}
                </div>
            </div>

            {/* Right pane */}
            <div className="flex-1 overflow-hidden">
                {isEmpty ? (
                    <EmptyChartHero
                        onCreate={() =>
                            setCreate({ open: true, parentId: null, parentName: null })
                        }
                    />
                ) : (
                    <TeamMembersPanel
                        instituteId={instituteId}
                        teamId={selectedTeamId}
                        teamName={selectedTeam?.name ?? null}
                        onAddMember={() => setAddMemberOpen(true)}
                        onMoveTeam={() => setMoveOpen(true)}
                        onEditTeam={() => setEditOpen(true)}
                        onAddSubTeam={() =>
                            setCreate({
                                open: true,
                                parentId: selectedTeamId,
                                parentName: selectedTeam?.name ?? null,
                            })
                        }
                    />
                )}
            </div>

            <TeamFormDialog
                open={create.open}
                onOpenChange={(open) =>
                    setCreate((c) => ({ ...c, open, parentId: open ? c.parentId : null }))
                }
                instituteId={instituteId}
                defaultParentId={create.parentId}
                defaultParentName={create.parentName}
                onSaved={() => chartQuery.refetch()}
            />
            <TeamFormDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                instituteId={instituteId}
                team={selectedTeam}
                onSaved={() => chartQuery.refetch()}
            />
            <MoveTeamDialog
                open={moveOpen}
                onOpenChange={setMoveOpen}
                team={selectedTeam}
                flatTeams={flat}
                onMoved={() => chartQuery.refetch()}
            />
            <AddMemberDialog
                open={addMemberOpen}
                onOpenChange={setAddMemberOpen}
                teamId={selectedTeamId}
                teamName={selectedTeam?.name ?? null}
                onAdded={() => chartQuery.refetch()}
            />
        </div>
    );
}

function EmptyChartHero({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary-50">
                <TreeStructure size={28} className="text-primary-600" />
            </div>
            <div className="text-h2 font-medium text-neutral-900">
                Build your organization chart
            </div>
            <p className="max-w-md text-subtitle text-neutral-500">
                Group your team however you work — by department, by region, by function. You
                can always rename, move, or add sub-teams later. Students cannot be added here.
            </p>
            <MyButton buttonType="primary" onClick={onCreate}>
                + Create your first team
            </MyButton>
            <p className="mt-2 text-caption text-neutral-400">
                Tip: start with a top-level team like “Sales” or “Operations”, then add sub-teams
                inside it.
            </p>
        </div>
    );
}

function flatten(roots: OrgTeamNode[]): OrgTeamNode[] {
    const out: OrgTeamNode[] = [];
    const walk = (n: OrgTeamNode) => {
        out.push(n);
        n.children?.forEach(walk);
    };
    roots.forEach(walk);
    return out;
}
