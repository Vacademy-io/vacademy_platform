import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    CaretDown,
    CaretRight,
    UsersThree,
    Crown,
    MagnifyingGlass,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { fetchOrgChartWithMembers, type OrgTeamNode, type TeamMember } from '../-services/org-team-services';
import { fetchEligibleOrgUsers, type InstituteUser } from '../-services/institute-users-service';

interface Props {
    instituteId: string;
}

/**
 * Full org-chart visualization. One DB round-trip (chart-with-members) gives
 * us the whole tree + every team's members; we resolve user_id → name/email
 * once via the institute-users batch and render people inline under their teams.
 *
 * Each team row shows: caret, team icon, name, member count, head badge.
 * Below it (when expanded): people in this team, then sub-teams.
 *
 * Search filters by team name OR member name/email — matched teams and the
 * ancestor chain leading to them stay open and visible.
 */
export function OrgChartFullTree({ instituteId }: Props) {
    const [query, setQuery] = useState('');

    const chartQuery = useQuery({
        queryKey: ['org-chart-with-members', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchOrgChartWithMembers(instituteId),
    });

    // Batch user lookup so people rows show real names + emails, not user_ids.
    const usersQuery = useQuery({
        queryKey: ['eligible-org-users', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchEligibleOrgUsers(instituteId),
        staleTime: 60_000,
    });

    const userById = useMemo(() => {
        const m = new Map<string, InstituteUser>();
        (usersQuery.data ?? []).forEach((u) => m.set(u.id, u));
        return m;
    }, [usersQuery.data]);

    const trimmedQuery = query.trim().toLowerCase();

    // Compute which team IDs survive the search. A team passes if its name
    // matches OR any of its members' name/email matches. Ancestors of any
    // matched team are forced open so the search hit is visible.
    const matchInfo = useMemo(() => {
        if (!trimmedQuery) return { match: null as Set<string> | null, forceOpen: new Set<string>() };
        const tree = chartQuery.data ?? [];
        const match = new Set<string>();
        const forceOpen = new Set<string>();
        const walk = (node: OrgTeamNode, ancestors: string[]): boolean => {
            const nameMatch = node.name.toLowerCase().includes(trimmedQuery);
            const memberMatch = (node.members ?? []).some((m) => {
                const u = userById.get(m.user_id);
                return (
                    (u?.full_name ?? '').toLowerCase().includes(trimmedQuery) ||
                    (u?.email ?? '').toLowerCase().includes(trimmedQuery) ||
                    (m.role_label ?? '').toLowerCase().includes(trimmedQuery)
                );
            });
            let anyChildMatched = false;
            for (const c of node.children ?? []) {
                if (walk(c, [...ancestors, node.id])) anyChildMatched = true;
            }
            const matched = nameMatch || memberMatch || anyChildMatched;
            if (matched) {
                match.add(node.id);
                ancestors.forEach((a) => forceOpen.add(a));
            }
            return matched;
        };
        tree.forEach((n) => walk(n, []));
        return { match, forceOpen };
    }, [chartQuery.data, trimmedQuery, userById]);

    const isLoading = chartQuery.isLoading || usersQuery.isLoading;

    if (isLoading) {
        return <div className="p-4 text-subtitle text-neutral-500">Loading org chart…</div>;
    }
    if (chartQuery.isError) {
        return (
            <div className="p-4 text-subtitle text-danger-600">
                Could not load the chart. Try refreshing.
            </div>
        );
    }
    const tree = chartQuery.data ?? [];
    if (tree.length === 0) {
        return (
            <div className="p-6 text-center text-subtitle text-neutral-500">
                No teams yet. Create your first team from the Cards view to start building the chart.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-neutral-200 p-3">
                <div className="relative max-w-md">
                    <MagnifyingGlass
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                        className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-body"
                        placeholder="Search teams or people…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
                <ul role="tree" className="space-y-1">
                    {tree.map((node) => (
                        <TreeRow
                            key={node.id}
                            node={node}
                            depth={0}
                            userById={userById}
                            matchSet={matchInfo.match}
                            forceOpen={matchInfo.forceOpen}
                            highlightTerm={trimmedQuery}
                        />
                    ))}
                </ul>
            </div>
        </div>
    );
}

function TreeRow({
    node,
    depth,
    userById,
    matchSet,
    forceOpen,
    highlightTerm,
}: {
    node: OrgTeamNode;
    depth: number;
    userById: Map<string, InstituteUser>;
    matchSet: Set<string> | null;
    forceOpen: Set<string>;
    highlightTerm: string;
}) {
    // First two levels open by default to make structure visible at a glance.
    const defaultOpen = depth < 2;
    const [openOverride, setOpenOverride] = useState<boolean | null>(null);
    const forcedOpen = forceOpen.has(node.id);
    const open = openOverride ?? (forcedOpen || defaultOpen);

    const hasMembers = (node.members ?? []).length > 0;
    const hasChildren = (node.children ?? []).length > 0;
    const expandable = hasMembers || hasChildren;
    const filteredOut = matchSet !== null && !matchSet.has(node.id);

    if (filteredOut) return null;

    return (
        <li role="treeitem" aria-expanded={expandable ? open : undefined}>
            <div
                className="group flex items-center gap-2 rounded-md py-1.5 hover:bg-neutral-50"
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
                {expandable ? (
                    <button
                        type="button"
                        onClick={() => setOpenOverride(!open)}
                        aria-label={open ? 'Collapse' : 'Expand'}
                        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                        {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
                    </button>
                ) : (
                    <span className="w-[18px]" aria-hidden="true" />
                )}
                <UsersThree
                    size={18}
                    className={cn('text-primary-600', filteredOut && 'opacity-50')}
                />
                <span className="truncate text-body font-medium text-neutral-900">
                    <Highlighted text={node.name} term={highlightTerm} />
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                    {node.member_count}
                </span>
            </div>

            {open && (
                <ul role="group" className="mt-0.5 space-y-0.5">
                    {/* Members of this team first, then sub-teams. */}
                    {(node.members ?? []).map((m) => (
                        <PersonRow
                            key={m.mapping_id}
                            member={m}
                            user={userById.get(m.user_id)}
                            depth={depth + 1}
                            highlightTerm={highlightTerm}
                            matchSet={matchSet}
                        />
                    ))}
                    {(node.children ?? []).map((child) => (
                        <TreeRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            userById={userById}
                            matchSet={matchSet}
                            forceOpen={forceOpen}
                            highlightTerm={highlightTerm}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

function PersonRow({
    member,
    user,
    depth,
    highlightTerm,
    matchSet,
}: {
    member: TeamMember;
    user: InstituteUser | undefined;
    depth: number;
    highlightTerm: string;
    matchSet: Set<string> | null;
}) {
    const name = user?.full_name || `User ${member.user_id.slice(0, 6)}`;
    const email = user?.email ?? '';
    // When searching, hide person rows that don't match — keeps the tree tight.
    if (matchSet !== null && highlightTerm) {
        const hits =
            name.toLowerCase().includes(highlightTerm) ||
            email.toLowerCase().includes(highlightTerm) ||
            (member.role_label ?? '').toLowerCase().includes(highlightTerm);
        if (!hits) return null;
    }
    return (
        <li>
            <div
                className="flex items-center gap-2 rounded-md py-1 hover:bg-neutral-50"
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
                <span className="w-[18px]" aria-hidden="true" />
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-body text-neutral-900">
                        <Highlighted text={name} term={highlightTerm} />
                        {member.is_team_head && (
                            <span
                                className="inline-flex items-center gap-0.5 rounded-full bg-warning-50 px-1.5 py-0.5 text-caption text-warning-700"
                                title="Team head"
                            >
                                <Crown size={10} weight="fill" /> Head
                            </span>
                        )}
                    </div>
                    {(member.role_label || email) && (
                        <div className="truncate text-caption text-neutral-500">
                            {member.role_label}
                            {member.role_label && email ? ' · ' : ''}
                            {email}
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}

function Avatar({ name }: { name: string }) {
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-medium text-primary-700">
            {initial}
        </div>
    );
}

function Highlighted({ text, term }: { text: string; term: string }) {
    if (!term) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(term);
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-warning-100 px-0.5 text-warning-800">
                {text.slice(idx, idx + term.length)}
            </mark>
            {text.slice(idx + term.length)}
        </>
    );
}
