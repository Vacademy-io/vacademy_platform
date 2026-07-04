/**
 * Reports Center — the tabbed analytics hub for /audience-manager/reports.
 *
 * Layout (top to bottom):
 *   1. Page header — title + subtitle + refresh.
 *   2. SHARED FILTER BAR — date range (presets + from/to), team scope
 *      (TeamPicker, hides for callers outside the leads team) and counsellor
 *      scope (workbench roster, hides when the roster isn't visible to the
 *      caller). The applied filter set feeds EVERY tab via props.
 *   3. Tabs — Overview | Sources | Funnel | Dispositions | Calling | Activity |
 *      Follow-ups | Counsellors | Manager.
 *      The active tab lives in the URL (?tab=sources) via the route's
 *      validateSearch, so reloads/deep-links restore the same report.
 *
 * The Calling tab is lazy-imported from -components/calling/CallingTab (built
 * independently — exact path/signature is an inter-agent contract).
 *
 * Every tab is read-only; this page never writes anything.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
    ArrowsClockwise,
    ArrowsLeftRight,
    CalendarCheck,
    ChartLineUp,
    CurrencyCircleDollar,
    Funnel,
    ListChecks,
    Megaphone,
    Phone,
    Stack,
    Table,
    TrendUp,
    User,
    Users,
    UsersThree,
    Sparkle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { TeamPicker } from '@/components/shared/crm/TeamPicker';
import {
    fetchMyTeam,
    fetchTeamCounsellors,
} from '@/routes/counsellors/-services/counsellor-workbench-services';
import { handleFetchCampaignsList } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import type { ReportTab } from '../index';
import { OverviewTab } from './overview-tab';
import { SourcesTab } from './sources-tab';
import { FunnelTab } from './funnel-tab';
import { DispositionsTab } from './dispositions-tab';
import { ManagerTab } from './manager-tab';
import { ActivityTab } from './activity-tab';
import { FollowupsTab } from './followups-tab';
import { CounsellorsTab } from './counsellors-tab';
import { RevenueTab } from './revenue-tab';
import { CohortTab } from './cohort-tab';
import { ForecastTab } from './forecast-tab';
import { CustomReportTab } from './custom-report-tab';
import { ReportTabSkeleton, type ReportTabProps } from './report-shared';
import { useCallIntelligenceEnabled } from '@/components/shared/leads';

// Inter-agent contract: the Calling tab module lives at exactly this path and
// default-exports CallingTab(props: ReportTabProps). Built by a sibling agent.
const CallingTab = lazy(() => import('./calling/CallingTab'));
const CrmIntelligenceReportTab = lazy(() => import('./crm-intelligence-report-tab'));

// ── Date helpers ───────────────────────────────────────────────────────

const DEFAULT_DAYS = 30;
const toDateInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const computeRange = (days: number) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    return { from: toDateInput(start), to: toDateInput(now) };
};

/** Quick presets — last N days (inclusive of today). */
const PRESETS = [
    { key: '7', label: '7d', days: 7 },
    { key: '30', label: '30d', days: 30 },
    { key: '90', label: '90d', days: 90 },
] as const;

// Sentinel for "no counsellor filter" — the backend keeps its default RBAC scoping.
const ALL_COUNSELLORS_VALUE = '__ALL_COUNSELLORS__';
// Sentinel for "no campaign filter" — reports span every campaign.
const ALL_AUDIENCES_VALUE = '__ALL_AUDIENCES__';

// Tabs whose queries join audience_response and therefore filter cleanly by
// campaign. The campaign picker only appears on these; the others (Calling,
// CRM Intelligence, Revenue, Cohort, Forecast, Builder) build on call/payment
// data with no clean campaign link, so a picker there would mislead.
const CAMPAIGN_FILTERABLE_TABS = new Set<string>([
    'overview',
    'sources',
    'funnel',
    'dispositions',
    'activity',
    'followups',
    'counsellors',
    'manager',
]);

// ── Main page ──────────────────────────────────────────────────────────

export function LeadReportsPage() {
    const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Reports Center</h1>);
    }, [setNavHeading]);

    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Active tab from the URL (?tab=…); 'overview' when absent.
    const search = useSearch({ from: '/audience-manager/reports/' });
    const activeTab: ReportTab = search.tab ?? 'overview';
    const setActiveTab = (tab: string) =>
        navigate({
            to: '/audience-manager/reports',
            search: { tab: tab === 'overview' ? undefined : (tab as ReportTab) },
            replace: true,
        });

    // ── Shared filters ─────────────────────────────────────────────────
    const defaults = useMemo(() => computeRange(DEFAULT_DAYS), []);
    const [fromDate, setFromDate] = useState(defaults.from);
    const [toDate, setToDate] = useState(defaults.to);
    const [applied, setApplied] = useState(defaults);
    const [teamId, setTeamId] = useState<string | undefined>(undefined);
    const [counsellorUserId, setCounsellorUserId] = useState<string | undefined>(undefined);
    const [audienceId, setAudienceId] = useState<string | undefined>(undefined);

    const activePreset = PRESETS.find((p) => {
        const r = computeRange(p.days);
        return applied.from === r.from && applied.to === r.to;
    })?.key;

    const applyPreset = (days: number) => {
        const r = computeRange(days);
        setFromDate(r.from);
        setToDate(r.to);
        setApplied(r);
    };
    const apply = () => setApplied({ from: fromDate, to: toDate });
    const reset = () => {
        setFromDate(defaults.from);
        setToDate(defaults.to);
        setApplied(defaults);
        setTeamId(undefined);
        setCounsellorUserId(undefined);
        setAudienceId(undefined);
    };

    // Team change invalidates the counsellor choice — the selected counsellor
    // may not belong to the new team's roster.
    const handleTeamChange = (next: string | undefined) => {
        setTeamId(next);
        setCounsellorUserId(undefined);
    };

    const [isRefreshing, setIsRefreshing] = useState(false);
    const refresh = async () => {
        setIsRefreshing(true);
        try {
            // Every report query key starts with one of these prefixes.
            await queryClient.invalidateQueries({
                predicate: (q) => {
                    const k = q.queryKey[0];
                    return (
                        typeof k === 'string' &&
                        (k.startsWith('crm-reports') ||
                            k === 'lead-report-summary' ||
                            k === 'counselor-performance')
                    );
                },
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    // Only forward the campaign scope to tabs that can filter by it — keeps the
    // excluded tabs' query keys stable when a campaign is selected elsewhere.
    const campaignApplies = CAMPAIGN_FILTERABLE_TABS.has(activeTab);
    const tabProps: ReportTabProps = {
        instituteId,
        fromDate: applied.from,
        toDate: applied.to,
        teamId,
        counsellorUserId,
        audienceId: campaignApplies ? audienceId : undefined,
    };

    // The CRM Intelligence report tab only exists when the feature is on.
    const callIntelligenceEnabled = useCallIntelligenceEnabled();

    return (
        <div className="flex min-h-full flex-col gap-6 bg-neutral-50 p-6">
            {/* Page header */}
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                        Reports Center
                    </h1>
                    <p className="text-sm text-neutral-600">
                        Pipeline health, sources, calling activity, funnel velocity and follow-up
                        hygiene — one place.
                    </p>
                </div>
                <Button
                    onClick={refresh}
                    size="sm"
                    variant="outline"
                    disabled={!instituteId || isRefreshing}
                    className="gap-2"
                >
                    <ArrowsClockwise size={14} className={cn(isRefreshing && 'animate-spin')} />
                    Refresh
                </Button>
            </header>

            {/* Shared filter bar — feeds every tab */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex h-9 items-center gap-1 self-end rounded-md border border-neutral-200 bg-white p-1">
                    {PRESETS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p.days)}
                            className={cn(
                                'rounded px-2.5 py-1 text-xs transition-colors',
                                activePreset === p.key
                                    ? 'bg-primary-500 text-white'
                                    : 'text-neutral-600 hover:bg-neutral-50'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="rep-from" className="text-xs text-neutral-600">
                        From
                    </Label>
                    <Input
                        id="rep-from"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="h-9 w-40"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="rep-to" className="text-xs text-neutral-600">
                        To
                    </Label>
                    <Input
                        id="rep-to"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="h-9 w-40"
                    />
                </div>
                <Button onClick={apply} size="sm" className="h-9 self-end" disabled={!instituteId}>
                    Apply
                </Button>
                <Button onClick={reset} size="sm" variant="ghost" className="h-9 self-end">
                    Reset
                </Button>
                {/* Scope filters — flow inline as equal-height items so they share the
                    date controls' baseline, and wrap together (left-aligned) when the
                    bar runs out of width instead of detaching to a right-pushed row. */}
                {campaignApplies && (
                    <>
                        <div className="hidden h-9 w-px self-end bg-neutral-200 sm:block" />
                        <CampaignScopePicker
                            instituteId={instituteId}
                            value={audienceId}
                            onChange={setAudienceId}
                        />
                    </>
                )}
                <TeamPicker instituteId={instituteId} value={teamId} onChange={handleTeamChange} />
                <CounsellorScopePicker
                    instituteId={instituteId}
                    teamId={teamId}
                    value={counsellorUserId}
                    onChange={setCounsellorUserId}
                />
            </div>

            {!instituteId && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Pick an institute to view reports.
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-6">
                <TabsList className="grid h-auto w-full max-w-6xl grid-cols-3 sm:grid-cols-5 lg:grid-cols-7">
                    <TabsTrigger value="overview" className="gap-1.5">
                        <ChartLineUp size={14} weight="bold" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="sources" className="gap-1.5">
                        <Megaphone size={14} weight="bold" />
                        Sources
                    </TabsTrigger>
                    <TabsTrigger value="funnel" className="gap-1.5">
                        <Funnel size={14} weight="bold" />
                        Funnel
                    </TabsTrigger>
                    <TabsTrigger value="dispositions" className="gap-1.5">
                        <ArrowsLeftRight size={14} weight="bold" />
                        Dispositions
                    </TabsTrigger>
                    <TabsTrigger value="calling" className="gap-1.5">
                        <Phone size={14} weight="bold" />
                        Calling
                    </TabsTrigger>
                    {callIntelligenceEnabled && (
                        <TabsTrigger value="call-intelligence" className="gap-1.5">
                            <Sparkle size={14} weight="bold" />
                            CRM Intelligence
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="activity" className="gap-1.5">
                        <ListChecks size={14} weight="bold" />
                        Activity
                    </TabsTrigger>
                    <TabsTrigger value="followups" className="gap-1.5">
                        <CalendarCheck size={14} weight="bold" />
                        Follow-ups
                    </TabsTrigger>
                    <TabsTrigger value="counsellors" className="gap-1.5">
                        <Users size={14} weight="bold" />
                        Counsellors
                    </TabsTrigger>
                    <TabsTrigger value="manager" className="gap-1.5">
                        <UsersThree size={14} weight="bold" />
                        Manager
                    </TabsTrigger>
                    <TabsTrigger value="revenue" className="gap-1.5">
                        <CurrencyCircleDollar size={14} weight="bold" />
                        Revenue
                    </TabsTrigger>
                    <TabsTrigger value="cohort" className="gap-1.5">
                        <Stack size={14} weight="bold" />
                        Cohort
                    </TabsTrigger>
                    <TabsTrigger value="forecast" className="gap-1.5">
                        <TrendUp size={14} weight="bold" />
                        Forecast
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="gap-1.5">
                        <Table size={14} weight="bold" />
                        Builder
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <OverviewTab {...tabProps} />
                </TabsContent>
                <TabsContent value="sources">
                    <SourcesTab {...tabProps} />
                </TabsContent>
                <TabsContent value="calling">
                    <Suspense fallback={<ReportTabSkeleton />}>
                        <CallingTab {...tabProps} />
                    </Suspense>
                </TabsContent>
                {callIntelligenceEnabled && (
                    <TabsContent value="call-intelligence">
                        <Suspense fallback={<ReportTabSkeleton />}>
                            <CrmIntelligenceReportTab {...tabProps} />
                        </Suspense>
                    </TabsContent>
                )}
                <TabsContent value="funnel">
                    <FunnelTab {...tabProps} />
                </TabsContent>
                <TabsContent value="dispositions">
                    <DispositionsTab {...tabProps} />
                </TabsContent>
                <TabsContent value="activity">
                    <ActivityTab {...tabProps} />
                </TabsContent>
                <TabsContent value="followups">
                    <FollowupsTab {...tabProps} />
                </TabsContent>
                <TabsContent value="counsellors">
                    <CounsellorsTab {...tabProps} />
                </TabsContent>
                <TabsContent value="manager">
                    <ManagerTab {...tabProps} />
                </TabsContent>
                <TabsContent value="revenue">
                    <RevenueTab {...tabProps} />
                </TabsContent>
                <TabsContent value="cohort">
                    <CohortTab {...tabProps} />
                </TabsContent>
                <TabsContent value="forecast">
                    <ForecastTab {...tabProps} />
                </TabsContent>
                <TabsContent value="custom">
                    <CustomReportTab {...tabProps} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Counsellor scope picker ────────────────────────────────────────────

/**
 * Counsellor filter for the shared bar. Options come from the counsellor
 * workbench roster (GET /v1/counsellor-workbench/team/{teamId}/counsellors)
 * of the selected team — or the caller's home team when no team is picked.
 *
 * Hidden entirely when the caller has no roster visibility: not in the leads
 * team (my-team lookup fails), the roster call is RBAC-denied (a leaf
 * counsellor without descendants), or the roster is empty. In all those
 * cases the backend's default scoping already pins reports to the caller.
 */
function CounsellorScopePicker({
    instituteId,
    teamId,
    value,
    onChange,
}: {
    instituteId: string;
    teamId: string | undefined;
    value: string | undefined;
    onChange: (userId: string | undefined) => void;
}) {
    // Same query key the Counsellor Workbench uses so the cache is shared.
    const myTeamQuery = useQuery({
        queryKey: ['workbench-my-team', instituteId],
        enabled: !!instituteId,
        retry: false,
        staleTime: 5 * 60 * 1000,
        queryFn: () => fetchMyTeam(instituteId),
    });
    const rosterTeamId = teamId ?? myTeamQuery.data?.team_id;

    const rosterQuery = useQuery({
        queryKey: ['report-counsellor-roster', instituteId, rosterTeamId],
        enabled: !!instituteId && !!rosterTeamId,
        retry: false,
        staleTime: 5 * 60 * 1000,
        queryFn: () => fetchTeamCounsellors(instituteId, rosterTeamId!, { size: 500 }),
    });

    const options = useMemo(
        () =>
            (rosterQuery.data?.content ?? [])
                .map((c) => ({ id: c.user_id, name: c.full_name ?? c.email ?? c.user_id }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [rosterQuery.data]
    );

    // No roster visibility → no picker (reports stay scoped to the caller).
    if (!myTeamQuery.data || rosterQuery.isError || options.length === 0) return null;

    return (
        <Select
            value={value ?? ALL_COUNSELLORS_VALUE}
            onValueChange={(v) => onChange(v === ALL_COUNSELLORS_VALUE ? undefined : v)}
        >
            <SelectTrigger className="h-9 w-48 bg-white" aria-label="Filter by counsellor">
                <User className="mr-1.5 size-4 shrink-0 text-neutral-400" />
                <SelectValue placeholder="All counsellors" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL_COUNSELLORS_VALUE}>All counsellors</SelectItem>
                {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                        {o.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

// ── Campaign (audience) scope picker ───────────────────────────────────

/**
 * Campaign filter for the shared bar. Options come from the institute's audience
 * (campaign) list — the same source the Recent Leads / Lead List pages use.
 * Scopes every campaign-filterable tab to a single campaign; "All campaigns"
 * clears it. Rendered only on tabs whose queries can honour it (see
 * CAMPAIGN_FILTERABLE_TABS).
 */
function CampaignScopePicker({
    instituteId,
    value,
    onChange,
}: {
    instituteId: string;
    value: string | undefined;
    onChange: (audienceId: string | undefined) => void;
}) {
    const campaignsQuery = useQuery({
        ...handleFetchCampaignsList({ institute_id: instituteId, page: 0, size: 200 }),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });

    const options = useMemo(
        () =>
            (campaignsQuery.data?.content ?? [])
                .map((c) => ({
                    id: c.id || c.campaign_id || c.audience_id || '',
                    name: c.campaign_name || 'Untitled campaign',
                }))
                .filter((o) => o.id !== ''),
        [campaignsQuery.data]
    );

    return (
        <Select
            value={value ?? ALL_AUDIENCES_VALUE}
            onValueChange={(v) => onChange(v === ALL_AUDIENCES_VALUE ? undefined : v)}
        >
            <SelectTrigger className="h-9 w-48 bg-white" aria-label="Filter by campaign">
                <Megaphone className="mr-1.5 size-4 shrink-0 text-neutral-400" />
                <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL_AUDIENCES_VALUE}>All campaigns</SelectItem>
                {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                        {o.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
