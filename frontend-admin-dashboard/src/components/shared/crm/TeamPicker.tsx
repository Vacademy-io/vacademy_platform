import { useQuery } from '@tanstack/react-query';
import { UsersThree } from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { fetchMyTeam } from '@/routes/counsellors/-services/counsellor-workbench-services';
import { listTeams } from '@/routes/manage-institute/teams/-services/org-team-services';

// Sentinel for "no team filter" — widgets receive `undefined`, which keeps
// the backend's default scoping (caller's RBAC descendants / leads subtree).
const ALL_TEAMS_VALUE = '__ALL_TEAMS__';

interface TeamPickerProps {
    instituteId: string;
    value: string | undefined;
    onChange: (teamId: string | undefined) => void;
}

/**
 * Compact team-scope picker shared by the CRM analytics surfaces
 * (Sales Dashboard header, Reports Center filter bar).
 *
 * Resolves the caller's home team in the leads subtree via
 * GET /v1/counsellor-workbench/me/team. When that call fails (caller isn't
 * in the leads team — e.g. a plain admin) the picker hides entirely and the
 * consuming page keeps its current behavior (teamId = undefined).
 *
 * Team names for the caller's descendant teams come from the org-team list
 * endpoint; descendants whose names can't be resolved (e.g. the caller lacks
 * permission to list teams) are simply omitted, leaving "All my teams" +
 * the home team as the minimum option set.
 */
export function TeamPicker({ instituteId, value, onChange }: TeamPickerProps) {
    // Same query key the Counsellor Workbench uses so the cache is shared.
    const myTeamQuery = useQuery({
        queryKey: ['workbench-my-team', instituteId],
        enabled: !!instituteId,
        retry: false,
        staleTime: 5 * 60 * 1000,
        queryFn: () => fetchMyTeam(instituteId),
    });
    const myTeam = myTeamQuery.data;

    const teamsQuery = useQuery({
        queryKey: ['org-teams', instituteId],
        enabled: !!instituteId && !!myTeam,
        retry: false,
        staleTime: 5 * 60 * 1000,
        queryFn: () => listTeams(instituteId),
    });

    // Loading or failed (caller outside the leads team) → no picker.
    if (!myTeam) return null;

    const nameById = new Map((teamsQuery.data ?? []).map((t) => [t.id, t.name]));
    const descendantOptions = (myTeam.descendant_team_ids ?? [])
        .filter((id) => id !== myTeam.team_id)
        .map((id) => ({ id, name: nameById.get(id) }))
        .filter((o): o is { id: string; name: string } => !!o.name)
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Select
            value={value ?? ALL_TEAMS_VALUE}
            onValueChange={(v) => onChange(v === ALL_TEAMS_VALUE ? undefined : v)}
        >
            <SelectTrigger className="h-9 w-48 bg-white" aria-label="Filter by team">
                <UsersThree className="mr-1.5 size-4 shrink-0 text-neutral-400" />
                <SelectValue placeholder="All my teams" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL_TEAMS_VALUE}>All my teams</SelectItem>
                <SelectItem value={myTeam.team_id}>{myTeam.team_name} (my team)</SelectItem>
                {descendantOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                        {o.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
