import { createLazyFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    MagnifyingGlass,
    User,
    UsersThree,
    ChatCircleText,
    ArrowsClockwise,
    Crown,
    ChartLineUp,
    Phone,
    SquaresFour,
    List as ListIcon,
} from '@phosphor-icons/react';
import { CounsellorLeadsTab } from './-components/CounsellorLeadsTab';
import { CounsellorActivityTab } from './-components/CounsellorActivityTab';
import { CounsellorCallsTab } from './-components/CounsellorCallsTab';
import { ReassignDialog } from './-components/ReassignDialog';
import { FeatureDisabledNotice } from './-components/FeatureDisabledNotice';
import { MyPagination } from '@/components/design-system/pagination';
import { ConversionBySourceWidget } from '@/routes/sales-dashboard/-components/ConversionBySourceWidget';
import { CallsPerDayWidget } from '@/routes/sales-dashboard/-components/CallsPerDayWidget';
import { CounsellorRatingBadge } from '@/components/counsellor/CounsellorRatingBadge';
import { useCounsellorRatingBatch } from '@/components/counsellor/useCounsellorRating';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import {
    fetchCounsellorLeads,
    fetchMyTeam,
    fetchTeamCounsellors,
    setCounsellorStatus,
    type WorkbenchCounsellor,
    type WorkbenchLead,
} from './-services/counsellor-workbench-services';

export const Route = createLazyFileRoute('/counsellors/')({
    component: RouteComponent,
});

type DetailTab = 'leads' | 'activity' | 'calls' | 'performance';
type StatusFilter = 'all' | 'active' | 'inactive';
type ViewMode = 'cards' | 'list';

const VIEW_MODE_KEY = 'counsellors-view-mode';

function isCounsellorsPageEnabled(): boolean {
    // Must resolve through getActiveRoleDisplaySettingsKey so custom-role users
    // read the toggle from their own role's settings, not the teacher default.
    const ds = getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey());
    // Toggled from Display Settings → CRM → Leads sub-tabs, same place as
    // Lead List / Recent Leads / Follow-ups. Off by default per
    // SUB_ITEMS_HIDDEN_BY_DEFAULT in admin-defaults.
    const leadsTab = ds?.sidebar?.find((t) => t.id === 'leads');
    const sub = leadsTab?.subTabs?.find((s) => s.id === 'counsellors');
    return sub?.visible === true;
}

/**
 * Exported so the `/counsellors/$userId` lazy route can mount the same
 * gate-then-page wrapper without duplicating the feature-disabled check.
 */
export function CounsellorsRouteWrapper() {
    if (!isCounsellorsPageEnabled()) {
        return (
            <FeatureDisabledNotice
                title="Counsellors page is not enabled"
                settingsLabel="Counsellor workbench"
            />
        );
    }
    return <WorkbenchPage />;
}

function RouteComponent() {
    return <CounsellorsRouteWrapper />;
}

/**
 * Shared by both `/counsellors` (no drawer) and `/counsellors/$userId` (drawer
 * open for that user). Reading the URL param with `{ strict: false }` lets the
 * SAME component render at either route without throwing in the no-param case.
 *
 * URL is the source of truth for which drawer is open — opening / closing the
 * drawer navigates, and a hard refresh on `/counsellors/<id>` reopens the
 * drawer for that user. Makes the URL shareable: paste it to a colleague and
 * they land directly on that counsellor's leads + activity.
 */
export function WorkbenchPage() {
    const { setNavHeading } = useNavHeadingStore();
    const instituteId = getInstituteId();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    // Both routes can render this — `userId` is the param when at the
    // /counsellors/$userId subroute, undefined when at /counsellors.
    const params = useParams({ strict: false }) as { userId?: string };
    const urlUserId = params?.userId;

    useEffect(() => {
        setNavHeading('Counsellors');
    }, [setNavHeading]);

    // UI state. Search + statusFilter feed the server query so the page
    // count stays meaningful (no "page 2 of 5 with zero results").
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return 'cards';
        return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'cards';
    });
    function changeViewMode(next: ViewMode) {
        setViewMode(next);
        localStorage.setItem(VIEW_MODE_KEY, next);
    }
    // Debounce so we don't fire a server request on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Open-drawer state holds the FULL counsellor object — not just the id —
    // because the displayed list is now server-paginated, so a `find` against
    // the current page would lose the drawer if the manager paginated away
    // (or if a status flip caused the row to drop out of the active filter).
    const [openCounsellor, setOpenCounsellor] = useState<WorkbenchCounsellor | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>('leads');
    const [reassignOpen, setReassignOpen] = useState(false);
    const [reassignLeads, setReassignLeads] = useState<WorkbenchLead[]>([]);
    const [reassignFromUserId, setReassignFromUserId] = useState<string | null>(null);
    const [reassignFromName, setReassignFromName] = useState<string | null>(null);
    // True when the reassign dialog is opened from the "Mark inactive"
    // action — submit then atomically reassigns AND flips pool memberships
    // INACTIVE in one backend transaction. Cancelling leaves the counsellor
    // ACTIVE (no partial state).
    const [reassignMarkInactive, setReassignMarkInactive] = useState(false);
    // Holds the user_id of the counsellor we're currently fetching open
    // leads for, so the "Mark inactive" button can show a spinner.
    const [pendingMarkInactiveId, setPendingMarkInactiveId] = useState<string | null>(null);

    const teamQuery = useQuery({
        queryKey: ['workbench-my-team', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchMyTeam(instituteId!),
    });

    // Page size adapts to the current view: a 12-cell grid (3×4 / 4×3) for
    // cards, 20 rows for the list. Page state resets to 0 when the inputs
    // that re-shape the page count change.
    const pageSize = viewMode === 'cards' ? 12 : 20;
    const [page, setPage] = useState(0);
    useEffect(() => {
        setPage(0);
    }, [search, statusFilter, viewMode]);

    const counsellorsQuery = useQuery({
        queryKey: [
            'workbench-counsellors',
            instituteId,
            teamQuery.data?.team_id,
            search,
            statusFilter,
            page,
            pageSize,
        ],
        enabled: !!instituteId && !!teamQuery.data?.team_id,
        queryFn: () =>
            fetchTeamCounsellors(instituteId!, teamQuery.data!.team_id, {
                search,
                status: statusFilter,
                page,
                size: pageSize,
            }),
        placeholderData: (prev) => prev,
    });

    // Candidates for the reassign dialog's target dropdown need the WHOLE
    // team subtree, not just the current page. Separate query so the display
    // list can paginate while reassign still picks across everyone. Cached
    // by react-query so we don't re-fetch on every row click.
    const candidatesQuery = useQuery({
        queryKey: ['workbench-counsellors-candidates', instituteId, teamQuery.data?.team_id],
        enabled: !!instituteId && !!teamQuery.data?.team_id,
        queryFn: () =>
            fetchTeamCounsellors(instituteId!, teamQuery.data!.team_id, {
                size: 500,
            }),
    });

    const counsellors = counsellorsQuery.data?.content ?? [];
    const totalCounsellors = counsellorsQuery.data?.totalElements ?? 0;
    const totalPages = Math.max(1, counsellorsQuery.data?.totalPages ?? 1);
    const candidates = candidatesQuery.data?.content ?? [];

    // Warm the rating cache only for the visible page — full-list warming
    // would scale poorly once the roster grows past a few pages.
    useCounsellorRatingBatch(
        instituteId,
        counsellors.map((c) => c.user_id)
    );

    // URL → drawer sync. When the URL carries a userId, find that counsellor
    // in the full candidate list (settings-side size=500 fetch) and pin the
    // drawer to them. Falls back to the current page if the candidate set
    // hasn't loaded yet. Skip when the in-memory state already matches the
    // URL — otherwise typing in the search box would yank focus around.
    useEffect(() => {
        if (!urlUserId) {
            if (openCounsellor !== null) setOpenCounsellor(null);
            return;
        }
        if (openCounsellor?.user_id === urlUserId) return;
        const found =
            candidates.find((c) => c.user_id === urlUserId) ??
            counsellors.find((c) => c.user_id === urlUserId) ??
            null;
        if (found) {
            setOpenCounsellor(found);
            setDetailTab('leads');
        }
    }, [urlUserId, candidates, counsellors, openCounsellor]);

    /**
     * Open the drawer for a counsellor — drives URL state, not local state.
     * URL change wakes the effect above which then sets openCounsellor.
     */
    function openDrawer(c: WorkbenchCounsellor) {
        setDetailTab('leads');
        void navigate({
            to: '/counsellors/$userId',
            params: { userId: c.user_id },
        });
    }

    function closeDrawer() {
        void navigate({ to: '/counsellors' });
    }

    // ACTIVE direction: legacy direct flip — no leads to move, no dialog
    // needed. (For INACTIVE we go through the reassign-first flow below.)
    const setActiveMutation = useMutation({
        mutationFn: (userId: string) =>
            setCounsellorStatus(userId, instituteId!, 'ACTIVE'),
        onSuccess: () => {
            // BOTH lists need to refetch:
            //   * `workbench-counsellors`           — the paginated display list
            //   * `workbench-counsellors-candidates` — the size=500 query that
            //     feeds the reassign dialog's target dropdown. Without this,
            //     a counsellor just marked back to ACTIVE stays filtered out
            //     of the target list (the dropdown is gated on `is_active`)
            //     until the user hard-refreshes — which is the bug you saw
            //     after flipping someone inactive → active.
            queryClient.invalidateQueries({ queryKey: ['workbench-counsellors', instituteId] });
            queryClient.invalidateQueries({
                queryKey: ['workbench-counsellors-candidates', instituteId],
            });
            toast.success('Marked active');
        },
        onError: (e) => {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not change status');
        },
    });

    /**
     * Reassign-first INACTIVE flow:
     * 1. Pre-fetch the counsellor's open leads (read-only, no state change).
     * 2. Open the reassign dialog with markInactive=true.
     * 3. Manager picks a target (or RR / MANUAL) and confirms — backend
     *    atomically reassigns AND flips pool memberships INACTIVE in one
     *    transaction. Cancelling leaves the counsellor ACTIVE.
     */
    async function startMarkInactive(userId: string, displayName: string) {
        if (!instituteId) return;
        setPendingMarkInactiveId(userId);
        try {
            // Reassign-first needs ALL of the counsellor's leads (so each gets
            // routed in one batch) — pass no status filter rather than 'OPEN',
            // which the backend matched against conversion_status exactly and so
            // never returned anything, leaving the dialog empty. Bumping size to
            // 500 is the existing safety cap — beyond that we'd want a multi-page
            // accumulator; flag if a counsellor routinely sits on more than ~500
            // leads.
            const leads = await fetchCounsellorLeads(instituteId, userId, undefined, 0, 500);
            setReassignFromUserId(userId);
            setReassignFromName(displayName);
            setReassignLeads(leads?.content ?? []);
            setReassignMarkInactive(true);
            setReassignOpen(true);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not load open leads');
        } finally {
            setPendingMarkInactiveId(null);
        }
    }

    function handleStatusToggle(userId: string, displayName: string, currentlyActive: boolean) {
        if (currentlyActive) {
            void startMarkInactive(userId, displayName);
        } else {
            setActiveMutation.mutate(userId);
        }
    }

    function handleLeadReassign(lead: WorkbenchLead) {
        setReassignFromUserId(lead.assigned_counselor_id);
        setReassignFromName(lead.assigned_counselor_name);
        setReassignLeads([lead]);
        setReassignMarkInactive(false);
        setReassignOpen(true);
    }

    function handleReassignComplete() {
        // Reassign-and-mark-inactive flips pool memberships, so the
        // candidates list (which gates the reassign dropdown on is_active)
        // also needs to refetch — otherwise the just-inactivated counsellor
        // would still appear as a valid target on the next dialog open.
        queryClient.invalidateQueries({ queryKey: ['workbench-counsellors', instituteId] });
        queryClient.invalidateQueries({
            queryKey: ['workbench-counsellors-candidates', instituteId],
        });
        queryClient.invalidateQueries({ queryKey: ['workbench-leads', instituteId] });
    }

    function handleReassignDialogOpenChange(next: boolean) {
        setReassignOpen(next);
        if (!next) setReassignMarkInactive(false);
    }

    if (!instituteId) return null;

    if (teamQuery.isError) {
        const msg =
            (teamQuery.error as { response?: { data?: { ex?: string } } })?.response?.data?.ex ??
            'Could not resolve your team.';
        return (
            <LayoutContainer>
                <div className="rounded border border-warning-200 bg-warning-50 p-6 text-subtitle text-warning-700">
                    {msg} Configure the leads team under{' '}
                    <a href="/settings" className="underline">
                        Settings → Lead Workbench
                    </a>{' '}
                    to get started.
                </div>
            </LayoutContainer>
        );
    }

    // Stat chips count over ALL counsellors, not just the current page.
    // Fall back to current page values until the all-candidates query
    // resolves, so the chips don't flash zeros on first load.
    const statSource = candidates.length > 0 ? candidates : counsellors;
    const activeCount = statSource.filter((c) => c.is_active).length;
    const totalOpenLeads = statSource.reduce((sum, c) => sum + c.open_leads_count, 0);

    return (
        <LayoutContainer>
            {/* ── Page header ────────────────────────────────────── */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="text-caption text-neutral-500">
                        {teamQuery.data?.ancestor_names.join(' › ') || 'Leads team'}
                    </div>
                    <h1 className="text-h1 font-medium text-neutral-900">
                        {teamQuery.data?.team_name ?? 'Counsellors'}
                    </h1>
                    <p className="mt-1 text-subtitle text-neutral-500">
                        Click any card to see that person’s leads and recent activity.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <StatChip
                        icon={UsersThree}
                        label="Counsellors"
                        value={totalCounsellors}
                    />
                    <StatChip icon={Crown} label="Active" value={activeCount} tone="success" />
                    <StatChip
                        icon={ChatCircleText}
                        label="Open leads"
                        value={totalOpenLeads}
                        tone="primary"
                    />
                </div>
            </div>

            {/* ── Search + filter bar ────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-64 flex-1 sm:flex-none">
                    <MagnifyingGlass
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                        className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-body"
                        placeholder="Search by name or email…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <div className="flex overflow-hidden rounded-md border border-neutral-300">
                    {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                'px-3 py-1.5 text-caption font-medium capitalize',
                                statusFilter === s
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white text-neutral-700 hover:bg-neutral-50'
                            )}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <div
                    className="ml-auto flex overflow-hidden rounded-md border border-neutral-300"
                    role="group"
                    aria-label="View mode"
                >
                    <button
                        type="button"
                        onClick={() => changeViewMode('cards')}
                        title="Card view"
                        aria-pressed={viewMode === 'cards'}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium',
                            viewMode === 'cards'
                                ? 'bg-primary-500 text-white'
                                : 'bg-white text-neutral-700 hover:bg-neutral-50'
                        )}
                    >
                        <SquaresFour size={14} /> Cards
                    </button>
                    <button
                        type="button"
                        onClick={() => changeViewMode('list')}
                        title="List view"
                        aria-pressed={viewMode === 'list'}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium',
                            viewMode === 'list'
                                ? 'bg-primary-500 text-white'
                                : 'bg-white text-neutral-700 hover:bg-neutral-50'
                        )}
                    >
                        <ListIcon size={14} /> List
                    </button>
                </div>
            </div>

            {/* ── Counsellor cards grid ──────────────────────────── */}
            {counsellorsQuery.isLoading ? (
                <div className="rounded-md border border-neutral-200 bg-white p-8 text-center text-subtitle text-neutral-500">
                    Loading counsellors…
                </div>
            ) : counsellors.length === 0 ? (
                <div className="rounded-md border border-neutral-200 bg-white p-8 text-center text-subtitle text-neutral-500">
                    {totalCounsellors === 0 && !search && statusFilter === 'all'
                        ? 'No counsellors in this team yet. Add them under Manage Institute → Teams → Org Chart.'
                        : 'No one matches your filters.'}
                </div>
            ) : viewMode === 'list' ? (
                <CounsellorTable
                    counsellors={counsellors}
                    instituteId={instituteId}
                    statusPendingId={
                        pendingMarkInactiveId ??
                        (setActiveMutation.isPending
                            ? setActiveMutation.variables ?? null
                            : null)
                    }
                    onOpen={(uid) => {
                        const c = counsellors.find((x) => x.user_id === uid);
                        if (c) openDrawer(c);
                    }}
                    onToggleStatus={(uid, isActive) => {
                        const c = counsellors.find((x) => x.user_id === uid);
                        // isActive here is the NEXT state requested.
                        handleStatusToggle(uid, c?.full_name ?? uid, !isActive);
                    }}
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {counsellors.map((c) => (
                        <CounsellorCard
                            key={c.user_id}
                            counsellor={c}
                            instituteId={instituteId}
                            onOpen={() => openDrawer(c)}
                            onToggleStatus={() =>
                                handleStatusToggle(c.user_id, c.full_name ?? c.user_id, c.is_active)
                            }
                            statusLoading={
                                pendingMarkInactiveId === c.user_id ||
                                (setActiveMutation.isPending &&
                                    setActiveMutation.variables === c.user_id)
                            }
                        />
                    ))}
                </div>
            )}

            {totalCounsellors > pageSize && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-caption text-neutral-500">
                        Showing {page * pageSize + 1}–
                        {Math.min((page + 1) * pageSize, totalCounsellors)} of {totalCounsellors}
                        {counsellorsQuery.isFetching ? ' · loading…' : ''}
                    </span>
                    <MyPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                    />
                </div>
            )}

            {/* ── Detail slide-over panel (Radix Sheet, portaled) ── */}
            <DetailDrawer
                open={!!openCounsellor}
                onOpenChange={(o) => {
                    if (!o) closeDrawer();
                }}
                counsellor={openCounsellor}
                tab={detailTab}
                onTabChange={setDetailTab}
                instituteId={instituteId}
                onReassign={handleLeadReassign}
            />

            <ReassignDialog
                open={reassignOpen}
                onOpenChange={handleReassignDialogOpenChange}
                instituteId={instituteId}
                fromUserId={reassignFromUserId}
                fromUserName={reassignFromName}
                openLeads={reassignLeads}
                candidates={candidates}
                markInactive={reassignMarkInactive}
                onComplete={handleReassignComplete}
            />
        </LayoutContainer>
    );
}

// ─── Stat chip ────────────────────────────────────────────────

function StatChip({
    icon: Icon,
    label,
    value,
    tone = 'neutral',
}: {
    icon: typeof UsersThree;
    label: string;
    value: number;
    tone?: 'neutral' | 'primary' | 'success';
}) {
    const toneClass =
        tone === 'primary'
            ? 'bg-primary-50 text-primary-700'
            : tone === 'success'
            ? 'bg-success-50 text-success-700'
            : 'bg-neutral-100 text-neutral-700';
    return (
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${toneClass}`}>
            <Icon size={16} />
            <span className="text-caption">
                <span className="font-semibold">{value}</span>{' '}
                <span className="opacity-70">{label}</span>
            </span>
        </div>
    );
}

// ─── Counsellor card ──────────────────────────────────────────

function CounsellorCard({
    counsellor,
    instituteId,
    onOpen,
    onToggleStatus,
    statusLoading,
}: {
    counsellor: WorkbenchCounsellor;
    instituteId: string;
    onOpen: () => void;
    onToggleStatus: () => void;
    statusLoading: boolean;
}) {
    const name = counsellor.full_name || 'Unnamed';
    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'group relative flex flex-col items-stretch overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-md',
                counsellor.is_active ? 'border-neutral-200' : 'border-neutral-200 opacity-75'
            )}
        >
            <div
                className={cn(
                    'h-1',
                    counsellor.is_active ? 'bg-primary-500' : 'bg-neutral-300'
                )}
            />
            <div className="flex items-start gap-3 px-4 py-3">
                <Avatar name={name} large />
                <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-body font-semibold text-neutral-900">
                        {name}
                    </div>
                    {counsellor.role_label ? (
                        <div className="truncate text-caption italic text-neutral-700">
                            {counsellor.role_label}
                        </div>
                    ) : (
                        counsellor.email && (
                            <div className="truncate text-caption text-neutral-500">
                                {counsellor.email}
                            </div>
                        )
                    )}
                </div>
                <CounsellorRatingBadge instituteId={instituteId} userId={counsellor.user_id} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-2.5 text-caption">
                <div>
                    <div className="text-neutral-500">Open leads</div>
                    <div className="text-body font-semibold text-neutral-900">
                        {counsellor.open_leads_count}
                    </div>
                </div>
                <div>
                    <div className="text-neutral-500">Team</div>
                    <div className="truncate text-body font-medium text-neutral-700">
                        {counsellor.team_name ?? '—'}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
                <span
                    className={cn(
                        'flex items-center gap-1.5 text-caption font-medium',
                        counsellor.is_active ? 'text-success-700' : 'text-neutral-500'
                    )}
                >
                    <span
                        className={cn(
                            'inline-block size-1.5 rounded-full',
                            counsellor.is_active ? 'bg-success-500' : 'bg-neutral-400'
                        )}
                    />
                    {counsellor.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        // INACTIVE direction goes through the reassign dialog,
                        // which is the explicit confirmation. ACTIVE direction
                        // is a direct flip, so keep the confirm prompt there.
                        if (counsellor.is_active) {
                            onToggleStatus();
                        } else if (window.confirm(`Mark ${name} active again?`)) {
                            onToggleStatus();
                        }
                    }}
                    disabled={statusLoading}
                    className={cn(
                        'rounded-md px-2.5 py-1 text-caption font-medium transition-colors',
                        counsellor.is_active
                            ? 'text-danger-600 hover:bg-danger-50'
                            : 'text-success-700 hover:bg-success-50'
                    )}
                >
                    {statusLoading
                        ? '…'
                        : counsellor.is_active
                        ? 'Mark inactive'
                        : 'Mark active'}
                </button>
            </div>
        </button>
    );
}

// ─── List view ────────────────────────────────────────────────

function CounsellorTable({
    counsellors,
    instituteId,
    statusPendingId,
    onOpen,
    onToggleStatus,
}: {
    counsellors: WorkbenchCounsellor[];
    instituteId: string;
    statusPendingId: string | null;
    onOpen: (userId: string) => void;
    onToggleStatus: (userId: string, isActive: boolean) => void;
}) {
    return (
        <div className="overflow-auto rounded-md border border-neutral-200 bg-white">
            <table className="w-full text-body">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase tracking-wide text-neutral-500">
                    <tr>
                        <th className="px-3 py-2.5 text-left">Counsellor</th>
                        <th className="px-3 py-2.5 text-left">Team</th>
                        <th className="px-3 py-2.5 text-right">Rating</th>
                        <th className="px-3 py-2.5 text-right">Open leads</th>
                        <th className="px-3 py-2.5 text-left">Status</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {counsellors.map((c) => {
                        const name = c.full_name || 'Unnamed';
                        const pending = statusPendingId === c.user_id;
                        return (
                            <tr
                                key={c.user_id}
                                className={cn(
                                    'cursor-pointer border-t border-neutral-100 hover:bg-neutral-50',
                                    !c.is_active && 'opacity-75'
                                )}
                                onClick={() => onOpen(c.user_id)}
                            >
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar name={name} />
                                        <div className="min-w-0 leading-tight">
                                            <div className="truncate text-body font-medium text-neutral-900">
                                                {name}
                                            </div>
                                            <div className="truncate text-caption text-neutral-500">
                                                {c.email ?? c.role_label ?? '—'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-2.5 text-neutral-700">
                                    {c.team_name ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <span className="inline-flex">
                                        <CounsellorRatingBadge
                                            instituteId={instituteId}
                                            userId={c.user_id}
                                            size="sm"
                                        />
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-right text-body font-semibold text-neutral-900">
                                    {c.open_leads_count}
                                </td>
                                <td className="px-3 py-2.5">
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-1.5 text-caption font-medium',
                                            c.is_active ? 'text-success-700' : 'text-neutral-500'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'size-1.5 rounded-full',
                                                c.is_active ? 'bg-success-500' : 'bg-neutral-400'
                                            )}
                                        />
                                        {c.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // INACTIVE goes through the
                                            // reassign dialog (its own
                                            // confirmation); ACTIVE keeps the
                                            // direct confirm prompt.
                                            if (c.is_active) {
                                                onToggleStatus(c.user_id, !c.is_active);
                                            } else if (
                                                window.confirm(`Mark ${name} active again?`)
                                            ) {
                                                onToggleStatus(c.user_id, !c.is_active);
                                            }
                                        }}
                                        disabled={pending}
                                        className={cn(
                                            'rounded-md px-2.5 py-1 text-caption font-medium transition-colors',
                                            c.is_active
                                                ? 'text-danger-600 hover:bg-danger-50'
                                                : 'text-success-700 hover:bg-success-50'
                                        )}
                                    >
                                        {pending
                                            ? '…'
                                            : c.is_active
                                            ? 'Mark inactive'
                                            : 'Mark active'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Detail drawer ────────────────────────────────────────────

function DetailDrawer({
    open,
    onOpenChange,
    counsellor,
    tab,
    onTabChange,
    instituteId,
    onReassign,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    counsellor: WorkbenchCounsellor | null;
    tab: DetailTab;
    onTabChange: (t: DetailTab) => void;
    instituteId: string;
    onReassign: (lead: WorkbenchLead) => void;
}) {
    // Sheet handles focus trap, Escape, overlay click — we just supply the
    // content. `counsellor` can be null briefly during the close animation
    // (state cleared as the sheet starts to fade out); the early-return
    // keeps the closing frame clean.
    if (!counsellor) return null;
    const name = counsellor.full_name || 'Unnamed';
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
            >
                <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4">
                    <Avatar name={name} large />
                    <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-h3 font-medium text-neutral-900">
                            {name}
                        </div>
                        <div className="truncate text-caption text-neutral-500">
                            {counsellor.email ?? counsellor.role_label ?? '—'}
                        </div>
                    </div>
                    <CounsellorRatingBadge
                        instituteId={instituteId}
                        userId={counsellor.user_id}
                        size="lg"
                    />
                    {/* SheetContent renders its own close button (X) at top-right. */}
                </div>

                <Tabs
                    value={tab}
                    onValueChange={(v) => onTabChange(v as DetailTab)}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <TabsList className="m-3 gap-2">
                        <TabsTrigger value="leads">
                            <ChatCircleText size={14} className="mr-1.5" /> Leads (
                            {counsellor.open_leads_count})
                        </TabsTrigger>
                        <TabsTrigger value="activity">
                            <ArrowsClockwise size={14} className="mr-1.5" /> Activity
                        </TabsTrigger>
                        <TabsTrigger value="calls">
                            <Phone size={14} className="mr-1.5" /> Calls
                        </TabsTrigger>
                        <TabsTrigger value="performance">
                            <ChartLineUp size={14} className="mr-1.5" /> Performance
                        </TabsTrigger>
                    </TabsList>
                    <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
                        {tab === 'leads' && (
                            <CounsellorLeadsTab
                                instituteId={instituteId}
                                counsellorUserId={counsellor.user_id}
                                onReassign={onReassign}
                            />
                        )}
                        {tab === 'activity' && (
                            <CounsellorActivityTab
                                instituteId={instituteId}
                                counsellorUserId={counsellor.user_id}
                            />
                        )}
                        {tab === 'calls' && (
                            <CounsellorCallsTab
                                instituteId={instituteId}
                                counsellorUserId={counsellor.user_id}
                            />
                        )}
                        {tab === 'performance' && (
                            <div className="space-y-4">
                                <ConversionBySourceWidget
                                    instituteId={instituteId}
                                    counsellorUserId={counsellor.user_id}
                                />
                                <CallsPerDayWidget
                                    instituteId={instituteId}
                                    counsellorUserId={counsellor.user_id}
                                />
                            </div>
                        )}
                    </div>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}

// ─── Avatar ───────────────────────────────────────────────────

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700',
                large ? 'size-11 text-h3' : 'size-9 text-h4'
            )}
            aria-hidden="true"
        >
            {initial || <User size={16} />}
        </div>
    );
}
