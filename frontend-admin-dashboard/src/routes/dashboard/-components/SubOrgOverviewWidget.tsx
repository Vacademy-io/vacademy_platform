import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowRight,
    Buildings,
    CheckCircle,
    GraduationCap,
    UsersThree,
    type Icon,
} from '@phosphor-icons/react';
import { getSubOrgsWithDetails } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface Tile {
    label: string;
    Icon: Icon;
    iconBg: string;
    iconColor: string;
    valueNode: ReactNode;
}

/**
 * Sub-organization (VLE) network snapshot for the admin dashboard: total
 * sub-orgs, active plans, learners enrolled under them and seat capacity.
 * All numbers derive from the same enriched list the Manage VLEs screen uses
 * (shared react-query cache key), so the two never disagree.
 *
 * Per-role visibility is handled by Display Settings (widget id
 * `subOrgOverview`) — no role is hardcoded here. Hides itself entirely for
 * institutes with no sub-orgs, so it never shows a page of zeros.
 */
export default function SubOrgOverviewWidget() {
    const navigate = useNavigate();
    const instituteId = getCurrentInstituteId();

    const { data, isLoading, isError } = useQuery({
        // Same key as the Manage VLEs list — one fetch feeds both screens.
        queryKey: ['sub-orgs-with-details', instituteId],
        queryFn: () => getSubOrgsWithDetails(instituteId),
        staleTime: 60_000,
        enabled: !!instituteId,
        retry: false,
    });

    if (isError) return null;

    const rows = data?.content ?? [];
    const total = rows.length;
    // Institutes that don't use sub-orgs shouldn't see an all-zero card.
    if (!isLoading && total === 0) return null;

    const active = rows.filter((r) => (r.plan_status || '').toUpperCase() === 'ACTIVE').length;
    const learners = rows.reduce((sum, r) => sum + (r.used_seats ?? 0), 0);
    const capacity = rows.reduce((sum, r) => sum + (r.total_seats ?? 0), 0);

    const singular = getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg);
    const plural = getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg);

    const tiles: Tile[] = [
        {
            label: `Total ${plural}`,
            Icon: Buildings,
            iconBg: 'bg-primary-50',
            iconColor: 'text-primary-600',
            valueNode: isLoading ? <Skeleton className="h-5 w-8" /> : total,
        },
        {
            label: 'Active',
            Icon: CheckCircle,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            valueNode: isLoading ? <Skeleton className="h-5 w-8" /> : active,
        },
        {
            label: 'Learners',
            Icon: GraduationCap,
            iconBg: 'bg-sky-50',
            iconColor: 'text-sky-600',
            valueNode: isLoading ? <Skeleton className="h-5 w-8" /> : learners,
        },
        {
            label: 'Seats',
            Icon: UsersThree,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            valueNode: isLoading ? (
                <Skeleton className="h-5 w-12" />
            ) : capacity > 0 ? (
                `${learners}/${capacity}`
            ) : (
                '—'
            ),
        },
    ];

    const go = () => navigate({ to: '/manage-custom-teams' });

    return (
        <Card className="flex flex-col self-start bg-white shadow-sm">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                            <Buildings size={14} weight="duotone" />
                        </span>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold">
                                {plural} snapshot
                            </CardTitle>
                            <CardDescription className="line-clamp-1 text-xs text-neutral-500">
                                Your {singular.toLowerCase()} network at a glance
                            </CardDescription>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={go}
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                        Open
                        <ArrowRight size={12} weight="bold" />
                    </button>
                </div>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
                {tiles.map((t) => {
                    const TileIcon = t.Icon;
                    return (
                        <button
                            key={t.label}
                            type="button"
                            onClick={go}
                            className="group flex flex-col items-center justify-center gap-1.5 rounded-md border border-neutral-200 p-3 text-center transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                        >
                            <span
                                className={`flex size-8 items-center justify-center rounded-full ${t.iconBg} ${t.iconColor}`}
                            >
                                <TileIcon size={14} weight="bold" />
                            </span>
                            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                {t.label}
                            </span>
                            <span className="text-base font-semibold tabular-nums text-neutral-900">
                                {t.valueNode}
                            </span>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}
