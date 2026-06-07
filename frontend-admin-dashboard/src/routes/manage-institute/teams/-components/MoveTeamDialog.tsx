import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { ArrowRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { updateTeam, type OrgTeamNode } from '../-services/org-team-services';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team: OrgTeamNode | null;
    /** Flat list of all teams (from chart) so the picker can show every option except cycle-creating ones. */
    flatTeams: OrgTeamNode[];
    onMoved?: () => void;
}

/**
 * Friendly "Move this team somewhere else" dialog. Visually shows
 * "current parent → new parent" so non-technical users immediately see what's
 * going to change. Cycle-creating choices are filtered out client-side and
 * also rejected server-side as a belt-and-braces guard.
 */
export function MoveTeamDialog({ open, onOpenChange, team, flatTeams, onMoved }: Props) {
    const [newParentId, setNewParentId] = useState<string | ''>('');
    const [moving, setMoving] = useState(false);

    if (!team) return null;

    const descendantIds = collectDescendantIds(team);
    const eligibleParents = flatTeams.filter(
        (t) => t.id !== team.id && !descendantIds.has(t.id)
    );
    const currentParent = flatTeams.find((t) => t.id === team.parent_id) ?? null;
    const newParent = newParentId ? flatTeams.find((t) => t.id === newParentId) ?? null : null;

    async function handleMove() {
        setMoving(true);
        try {
            await updateTeam(team!.id, {
                move_parent: true,
                parent_id: newParentId === '' ? null : newParentId,
            });
            toast.success(`Moved “${team!.name}”`);
            onMoved?.();
            onOpenChange(false);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not move this team');
        } finally {
            setMoving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-h3">Move “{team.name}”</DialogTitle>
                    <p className="text-subtitle text-neutral-500">
                        Pick where this team should sit. It keeps all its members and sub-teams.
                    </p>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <Crumb label="Currently inside" value={currentParent?.name ?? 'Top level'} />
                        <ArrowRight size={16} className="text-neutral-400" />
                        <Crumb
                            label="Will move to"
                            value={newParentId === '' ? 'Top level' : newParent?.name ?? '—'}
                            highlight
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            New location
                        </label>
                        <select
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                            value={newParentId}
                            onChange={(e) => setNewParentId(e.target.value)}
                        >
                            <option value="">Make it a top-level team</option>
                            {eligibleParents.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-caption text-neutral-500">
                            We hide options that would create a circular loop, so you can't pick a
                            bad one.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <MyButton buttonType="secondary" onClick={() => onOpenChange(false)} disable={moving}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" onClick={handleMove} disable={moving}>
                        {moving ? 'Moving…' : 'Move team'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Crumb({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="min-w-0 flex-1">
            <div className="text-caption uppercase tracking-wide text-neutral-500">{label}</div>
            <div
                className={`truncate text-body font-medium ${
                    highlight ? 'text-primary-700' : 'text-neutral-900'
                }`}
            >
                {value}
            </div>
        </div>
    );
}

function collectDescendantIds(node: OrgTeamNode): Set<string> {
    const out = new Set<string>();
    const walk = (n: OrgTeamNode) => {
        out.add(n.id);
        n.children?.forEach(walk);
    };
    walk(node);
    return out;
}
