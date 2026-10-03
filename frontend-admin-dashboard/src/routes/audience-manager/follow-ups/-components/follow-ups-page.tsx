import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarBlank, DownloadSimple, ListBullets, MagnifyingGlass } from '@phosphor-icons/react';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getCurrentInstituteId, getUserRoleForInstitute } from '@/lib/auth/instituteUtils';
import { getUserId } from '@/utils/userDetails';
import { fetchRecentLeads } from '../../list/-services/get-recent-leads';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadProfiles } from '@/hooks/use-lead-profiles';
import { useLatestNotesBatch } from '@/hooks/use-latest-notes-batch';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { useLeadCounsellorOptions } from '@/hooks/use-lead-counsellor-options';
import { CounsellorFilter } from '@/components/shared/leads/counsellor-filter';
import { AddLeadNoteDialog } from '@/components/shared/add-lead-note-dialog';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import {
    CompleteFollowUpPopover,
    LeadEmptyState,
    LeadTable,
    usePlaceCall,
    useUpdateLeadTier,
    recentLeadToVM,
    startBackgroundExport,
    useIsExporting,
    type LeadActionHandlers,
    type LeadTableExtraColumn,
} from '@/components/shared/leads';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { LeadPagination } from '@/components/shared/leads';
import { FollowUpStatTiles } from './follow-up-stat-tiles';
import { bucketWindow, effectiveDueMs, type FollowUpBucket } from './follow-up-buckets';
import { FollowUpsCalendarView } from './follow-ups-calendar-view';
import { useFollowUpsViewState } from './use-follow-ups-view-state';

/**
 * Follow-ups — at-a-glance task list of leads needing counsellor action.
 *
 * **Deliberately minimal toolbar.** A counsellor on shift should land here and
 * instantly see today's workload — four big bucket cards (Pending / Today /
 * Upcoming / All) drive everything. No tier, status, audience, date or column
 * controls live here on purpose; that's the Recent Leads / Lead List job. The
 * toolbar holds only what a queue needs: a name/phone/email search, an export
 * of the current view, and — for admins — the **counsellor filter** so a
 * manager can drill into one rep's queue.
 *
 * Counsellors are server-locked to their own assignment via
 * `assigned_counselor_id = currentUserId`; admins can switch with the filter.
 *
 * Data comes from `POST /audience/leads` with `follow_up_pending` plus the
 * bucket's due window, so the server does the bucketing: the four card counts
 * are `totalElements` of four `size:1` probes and the list is one real page.
 * Nothing is classified client-side, which is why the counts survive past the
 * first page.
 */

const ALL_COUNSELLORS_VALUE = '__ALL_COUNSELLORS__';
const PAGE_SIZE = 20;
// Matches Recent Leads. Both pages hit the same endpoint, so keeping the pacing
// identical keeps the load a keystroke puts on the server predictable.
const SEARCH_DEBOUNCE_MS = 500;
// The calendar view can jump to any day in the bucket, so it takes the bucket whole.
const CALENDAR_FETCH_SIZE = 500;
const EMPTY_COUNTS: Record<FollowUpBucket, number> = {
    overdue: 0,
    today: 0,
    upcoming: 0,
    all: 0,
};
/** Bucket window as the API's snake-case params. */
const toWindowParams = (b: FollowUpBucket, now: Date = new Date()) => {
    const w = bucketWindow(b, now);
    return { follow_up_from: w.from, follow_up_to: w.to };
};
// Hidden on this surface to keep triage focused — easy to surface again in v2.
const HIDDEN_COLUMNS = new Set(['score', 'source']);
// Static cache keys every mutation on this page must refresh.
const INVALIDATE_KEYS: string[][] = [['follow-ups'], ['lead-profiles-batch']];

export const FollowUpsPage = () => {
    const { t } = useTranslation('audienceManagerFollowUpsPage');
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('navHeading')}</h1>);
    }, [setNavHeading, t]);
    return (
        <StudentSidebarProvider>
            <FollowUpsContent />
        </StudentSidebarProvider>
    );
};

const FollowUpsContent = () => {
    const { t } = useTranslation('audienceManagerFollowUpsPage');
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;
    const { setSelectedStudent } = useStudentSidebar();
    const queryClient = useQueryClient();

    // URL-driven view state (List | Calendar + month / day / counsellor).
    // Extracted into a hook to keep this component's cyclomatic complexity low.
    const {
        view,
        setView,
        monthStr,
        setMonthStr,
        selectedDateStr,
        setSelectedDateStr,
        counsellorFilter,
        setCounsellorFilter,
    } = useFollowUpsViewState(ALL_COUNSELLORS_VALUE);

    // ── Role detection ───────────────────────────────────────────────────────
    // ADMIN sees the whole team + a counsellor filter; anyone else (counsellor,
    // teacher, …) is locked to their own follow-ups.
    const isAdmin = useMemo(() => {
        const id = getCurrentInstituteId();
        if (!id) return false;
        return getUserRoleForInstitute(id) === 'ADMIN';
    }, []);
    const currentUserId = useMemo(() => getUserId() ?? '', []);

    // Seeded from the route so a sub-tab link opens on its own tile, and kept in step
    // with it: every sub-tab shares this pathname, so switching between them does not
    // remount the page. The page never writes the param back, so there is no loop.
    const { bucket: bucketParam } = useSearch({ from: '/audience-manager/follow-ups/' });
    const [bucket, setBucket] = useState<FollowUpBucket>(bucketParam ?? 'today');
    useEffect(() => {
        if (bucketParam) setBucket(bucketParam);
    }, [bucketParam]);

    const leadSettings = useLeadSettings();
    const showOps = !leadSettings.isLoading && leadSettings.enabled;
    const showScore = showOps && leadSettings.showScoreInEnquiryTable;
    const { statuses: leadStatusCatalog } = useLeadStatuses();

    const [noteTarget, setNoteTarget] = useState<{
        userId: string;
        userName: string;
        responseId?: string;
        /** Pre-select a dialog tab — 'FOLLOW_UP' for the "schedule next" flow
         *  after marking a follow-up complete. */
        initialActionType?: string;
    } | null>(null);
    const [counsellorTarget, setCounsellorTarget] = useState<{
        userId: string;
        userName: string;
    } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Counsellor options, role + hierarchy scoped by the backend: a scoped
    // caller (COUNSELLOR role) gets self + their counsellor reports; a pure
    // admin gets the institute-wide COUNSELLOR-role roster.
    const {
        options: counsellorOptions,
        scoped: isScopedCounsellor,
        isLoading: counsellorOptionsLoading,
    } = useLeadCounsellorOptions();

    // Managers (scoped with reports) and admins get the drill-in filter; a
    // leaf counsellor's single-option filter would be noise.
    const canFilterCounsellors = isAdmin || (isScopedCounsellor && counsellorOptions.length > 1);

    // Admins and scoped counsellors rely on the backend's hierarchy RBAC when
    // no explicit counsellor is picked (a scoped manager sees own + reports).
    // Any other role keeps the old client-side lock to their own follow-ups.
    const effectiveCounsellorId =
        isAdmin || isScopedCounsellor
            ? counsellorFilter === ALL_COUNSELLORS_VALUE
                ? undefined
                : counsellorFilter
            : currentUserId || undefined;

    // Search runs on the server with the rest of the filter, so it searches every
    // follow-up rather than whatever happened to be on screen. Debounced rather
    // than button-driven, same as Recent Leads — a queue is scanned, not queried.
    const [searchInput, setSearchInput] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [page, setPage] = useState(0);
    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === appliedSearch) return;
        const timer = window.setTimeout(() => setAppliedSearch(trimmed), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput, appliedSearch]);
    useEffect(() => setPage(0), [bucket, appliedSearch, effectiveCounsellorId]);

    /** One request shape for every bucket; only the window moves. */
    const baseFilter = useMemo(
        () => ({
            institute_id: instituteId ?? '',
            assigned_counselor_id: effectiveCounsellorId,
            // A converted lead is no longer a pending follow-up.
            conversion_status_filter: 'EXCLUDE_CONVERTED' as const,
            search_query: appliedSearch || undefined,
            follow_up_pending: true,
        }),
        [instituteId, effectiveCounsellorId, appliedSearch]
    );

    // Tile counts: one cheap request per bucket, size 1, read totalElements. The page used
    // to count the 200 rows it had fetched, which for a real institute meant the tiles read
    // 200 / 0 / 0 / 200 no matter what the pipeline actually held.
    //
    // Keyed under the same ['follow-ups', …] root as the list so that completing a
    // follow-up — every caller invalidates exactly ['follow-ups'] — moves the tiles
    // too. A sibling 'follow-ups-counts' root would not have been matched.
    const { data: counts = EMPTY_COUNTS, isLoading: countsLoading } = useQuery({
        queryKey: ['follow-ups', 'counts', baseFilter],
        queryFn: async () => {
            const buckets: FollowUpBucket[] = ['overdue', 'today', 'upcoming', 'all'];
            const now = new Date();
            const results = await Promise.all(
                buckets.map((b) =>
                    fetchRecentLeads({ ...baseFilter, ...toWindowParams(b, now), page: 0, size: 1 })
                )
            );
            return buckets.reduce(
                (acc, b, i) => ({ ...acc, [b]: results[i]?.totalElements ?? 0 }),
                { ...EMPTY_COUNTS }
            );
        },
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

    const { data, isLoading, error } = useQuery({
        queryKey: ['follow-ups', 'list', baseFilter, bucket, page, view],
        queryFn: () =>
            fetchRecentLeads({
                ...baseFilter,
                ...toWindowParams(bucket),
                page: view === 'calendar' ? 0 : page,
                // The calendar lets the user jump to any day, so it needs the whole bucket
                // rather than one page of it.
                size: view === 'calendar' ? CALENDAR_FETCH_SIZE : PAGE_SIZE,
            }),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });
    const totalPages = data?.totalPages ?? 0;

    // Build VMs, filter to pending follow-ups, classify into buckets, sort by
    // soonest-due so the top of the list is always the most urgent task.
    // The server has already narrowed to the bucket, so there is nothing left to classify
    // here — only the soonest-due ordering the page has always used.
    const pendingVms = useMemo(() => (data?.content ?? []).map(recentLeadToVM), [data]);
    const sortedVms = useMemo(
        () => [...pendingVms].sort((a, b) => effectiveDueMs(a) - effectiveDueMs(b)),
        [pendingVms]
    );

    // Profiles + notes for the visible vms. On the calendar view the user can
    // jump to any day, so we need profiles/notes for ALL pending VMs (not just
    // the current bucket's sorted slice) — otherwise selecting a day outside
    // the active bucket would render without profile/notes data.
    const userIds = useMemo(() => {
        const source = view === 'calendar' ? pendingVms : sortedVms;
        return source.map((vm) => vm.userId ?? '').filter((id): id is string => !!id);
    }, [view, pendingVms, sortedVms]);
    const { profiles: leadProfiles } = useLeadProfiles(userIds, showOps, instituteId);
    const { notesByUserId } = useLatestNotesBatch(userIds, showOps);

    const updateTier = useUpdateLeadTier({ invalidateKeys: INVALIDATE_KEYS });
    const placeCall = usePlaceCall({ invalidateKeys: INVALIDATE_KEYS });

    const actions: LeadActionHandlers = useMemo(
        () => ({
            onOpenDetails: (vm) => {
                // Open the compact side-view sheet, NOT the fullscreen overlay.
                setSelectedStudent(vm.toStudent(), { openOverlay: false });
                setIsSidebarOpen(true);
            },
            onAddNote: (userId, userName, responseId) =>
                setNoteTarget({ userId, userName, responseId }),
            // Counsellors can't reassign — pass undefined so the affordance hides.
            onAssignCounsellor: isAdmin
                ? (userId, userName) => setCounsellorTarget({ userId, userName })
                : undefined,
            onSetTier: (userId, _userName, tier) => updateTier.mutate({ userId, tier }),
            onCallLead: (vm, preferredNumberId) => {
                if (!vm.responseId) return;
                placeCall.mutate({
                    responseId: vm.responseId,
                    userId: vm.userId ?? undefined,
                    preferredNumberId,
                });
            },
            canCall: (vm) => {
                if (!vm.responseId)
                    return { allowed: false, reason: t('callReasons.noSubmissionId') };
                const phone = vm.phone && vm.phone !== '-' ? vm.phone : '';
                if (!phone) return { allowed: false, reason: t('callReasons.noPhone') };
                if (placeCall.isPending)
                    return { allowed: false, reason: t('callReasons.callInProgress') };
                return { allowed: true };
            },
        }),
        [setSelectedStudent, updateTier, isAdmin, placeCall, t]
    );

    // Inline "Mark complete" row action — the close flow for the follow-up the
    // row represents. Rows are leads (one row can carry several open
    // follow-ups), so the popover fetches the lead's open follow-ups on demand
    // and the user completes the pending one. "Schedule next" re-opens the
    // add-note dialog on the Follow Up tab.
    const extraColumns: LeadTableExtraColumn[] = useMemo(
        () => [
            {
                id: 'complete',
                header: t('table.actionHeader'),
                thClass: 'w-32',
                render: (vm) =>
                    vm.responseId && vm.userId ? (
                        <CompleteFollowUpPopover
                            audienceResponseId={vm.responseId}
                            userId={vm.userId}
                            invalidateKeys={INVALIDATE_KEYS}
                            onScheduleNext={() =>
                                setNoteTarget({
                                    userId: vm.userId!,
                                    userName: vm.name,
                                    responseId: vm.responseId,
                                    initialActionType: 'FOLLOW_UP',
                                })
                            }
                        />
                    ) : (
                        <span className="text-sm text-neutral-300">—</span>
                    ),
            },
        ],
        [t]
    );

    const handleStatusUpdated = () => queryClient.invalidateQueries({ queryKey: ['follow-ups'] });

    // Pre-compute the view body so the JSX below is a single expression instead
    // of a nested ternary (which CodeFactor / SonarJS flag as complexity).
    let viewBody: ReactNode;
    if (view === 'calendar') {
        viewBody = (
            <FollowUpsCalendarView
                vms={pendingVms}
                monthStr={monthStr}
                onMonthChange={setMonthStr}
                selectedDateStr={selectedDateStr}
                onSelectDate={setSelectedDateStr}
                isLoading={isLoading}
                error={error}
                profiles={leadProfiles}
                notes={notesByUserId}
                statuses={leadStatusCatalog}
                showOps={showOps}
                showScore={showScore}
                actions={actions}
                onStatusUpdated={handleStatusUpdated}
                hiddenColumns={HIDDEN_COLUMNS}
                extraColumns={extraColumns}
            />
        );
    } else if (error) {
        viewBody = (
            <LeadEmptyState
                title={t('errors.loadFailedTitle')}
                description={t('errors.loadFailedDescription')}
            />
        );
    } else {
        viewBody = (
            <LeadTable
                vms={sortedVms}
                profiles={leadProfiles}
                notes={notesByUserId}
                statuses={leadStatusCatalog}
                showOps={showOps}
                showScore={showScore}
                isLoading={isLoading}
                actions={actions}
                onStatusUpdated={handleStatusUpdated}
                hiddenColumns={HIDDEN_COLUMNS}
                extraColumns={extraColumns}
                emptyState={
                    <LeadEmptyState
                        title={buildEmptyTitle(t, isAdmin, bucket, counts, appliedSearch)}
                        description={buildEmptyDescription(
                            t,
                            isAdmin,
                            bucket,
                            counts,
                            appliedSearch
                        )}
                    />
                }
            />
        );
    }

    // Export walks the CURRENT bucket page by page rather than dumping the table, so what
    // lands in the CSV is what the filter says — not the twenty rows on screen. The walk
    // runs in the background and paces itself; see background-export.ts for why.
    const isExporting = useIsExporting('follow-ups');
    const handleExport = () => {
        const window = toWindowParams(bucket);
        startBackgroundExport({
            key: 'follow-ups',
            fileName: `follow-ups_${bucket}_${new Date().toISOString().slice(0, 10)}.csv`,
            header: [
                t('export.columns.name'),
                t('export.columns.email'),
                t('export.columns.phone'),
                t('export.columns.source'),
                t('export.columns.status'),
                t('export.columns.dueAt'),
            ],
            fetchPage: (page, size) => fetchRecentLeads({ ...baseFilter, ...window, page, size }),
            toRow: (lead) => {
                const vm = recentLeadToVM(lead);
                return [
                    vm.name,
                    vm.email,
                    vm.phone,
                    vm.audience,
                    vm.leadStatus ?? '',
                    vm.followUpDueAt ?? vm.tatDueAt ?? '',
                ];
            },
            labels: {
                progress: (done, total) =>
                    total > 0
                        ? t('export.progress', {
                              done: done.toLocaleString(),
                              total: total.toLocaleString(),
                          })
                        : t('export.running'),
                done: (count) => t('export.done', { count }),
                failed: t('export.failed'),
                alreadyRunning: t('export.alreadyRunning'),
                truncated: (count) => t('export.truncated', { count }),
                partial: (count) => t('export.partial', { count }),
            },
        });
    };

    // Subline copy (counts-aware so a counsellor sees workload immediately).
    const subline =
        counts.today === 0 && counts.overdue === 0
            ? isAdmin
                ? t('subline.teamAllCaughtUp')
                : t('subline.selfAllCaughtUp')
            : `${t('subline.tasksDueToday', {
                  count: counts.today,
                  context: isAdmin ? 'admin' : 'user',
              })}${
                  counts.overdue > 0 ? t('subline.overdueSuffix', { count: counts.overdue }) : ''
              }`;

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Heading row + (admin) counsellor filter */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">
                        {canFilterCounsellors ? t('heading.team') : t('heading.mine')}
                    </h1>
                    <p
                        className={`mt-0.5 text-sm ${
                            counts.overdue > 0 ? 'text-danger-600' : 'text-neutral-500'
                        }`}
                    >
                        {subline} · {format(new Date(), 'EEEE, MMM d')}
                    </p>
                </div>
                {canFilterCounsellors && (
                    <CounsellorFilter
                        values={
                            counsellorFilter === ALL_COUNSELLORS_VALUE ? [] : [counsellorFilter]
                        }
                        onChange={(vals) =>
                            setCounsellorFilter(
                                vals.length > 0 ? vals[vals.length - 1]! : ALL_COUNSELLORS_VALUE
                            )
                        }
                        options={counsellorOptions}
                        isLoading={counsellorOptionsLoading}
                    />
                )}
            </div>

            {/* Bucket cards — the dominant element */}
            <FollowUpStatTiles counts={counts} active={bucket} onChange={setBucket} />

            {/* View toggle: List | Calendar */}
            <Tabs
                value={view}
                onValueChange={(v) => setView(v === 'calendar' ? 'calendar' : 'list')}
            >
                <TabsList>
                    <TabsTrigger value="list" className="gap-1.5">
                        <ListBullets className="size-4" />
                        {t('tabs.list')}
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="gap-1.5">
                        <CalendarBlank className="size-4" />
                        {t('tabs.calendar')}
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Search on the left, count + export on the right — list view only.
                Same row shape as Recent Leads so the two queues read alike. */}
            {view === 'list' && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('search.placeholder')}
                            className="h-10 w-full pl-8"
                            aria-label={t('search.placeholder')}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-body text-muted-foreground">
                            {t('showing.prefix')}{' '}
                            <span className="font-semibold text-card-foreground">
                                {countsLoading ? '…' : counts[bucket].toLocaleString()}
                            </span>{' '}
                            {t('showing.suffix', {
                                count: counts[bucket],
                                context: bucket === 'all' ? undefined : bucket,
                            })}
                        </p>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            disabled={isExporting || counts[bucket] === 0}
                            onClick={handleExport}
                        >
                            <DownloadSimple className="size-4" />
                            {isExporting ? t('export.running') : t('export.action')}
                        </MyButton>
                    </div>
                </div>
            )}

            {/* View body — calendar or list */}
            <SidebarProvider
                style={{ ['--sidebar-width' as string]: '565px' }}
                defaultOpen={false}
                open={isSidebarOpen}
                onOpenChange={setIsSidebarOpen}
            >
                <div className="min-w-0 flex-1">
                    {viewBody}
                    {view === 'list' && totalPages > 1 && (
                        <div className="mt-3">
                            <LeadPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </div>
                <StudentSidebar
                    selectedTab="overview"
                    examType="EXAM"
                    isStudentList={false}
                    defaultLeadProfile
                />

                {noteTarget && (
                    <AddLeadNoteDialog
                        open={!!noteTarget}
                        onOpenChange={(o) => !o && setNoteTarget(null)}
                        userId={noteTarget.userId}
                        userName={noteTarget.userName}
                        // Without the response id the dialog's Follow Up tab is
                        // permanently disabled (canSubmit requires it).
                        audienceResponseId={noteTarget.responseId}
                        initialActionType={noteTarget.initialActionType}
                        // Scheduling a follow-up changes followUpDueAt — refresh
                        // the queue so the new task appears without a reload.
                        onSuccess={() =>
                            queryClient.invalidateQueries({ queryKey: ['follow-ups'] })
                        }
                    />
                )}
                {counsellorTarget && (
                    <AssignCounselorToLeadDialog
                        open={!!counsellorTarget}
                        onOpenChange={(o) => !o && setCounsellorTarget(null)}
                        userId={counsellorTarget.userId}
                        userName={counsellorTarget.userName}
                        invalidateKeys={[['lead-profiles-batch'], ['follow-ups']]}
                    />
                )}
            </SidebarProvider>
        </div>
    );
};

const buildEmptyTitle = (
    t: TFunction,
    isAdmin: boolean,
    bucket: FollowUpBucket,
    counts: Record<FollowUpBucket, number>,
    search: string
): string => {
    // The search narrows the counts too, so without this branch a search that
    // matches nothing reports the whole team as caught up.
    if (search) return t('empty.title.noMatches');
    if (counts.all === 0)
        return isAdmin ? t('empty.title.teamAllCaughtUp') : t('empty.title.selfAllCaughtUp');
    if (bucket === 'overdue') return t('empty.title.noOverdue');
    if (bucket === 'today') return t('empty.title.nothingToday');
    if (bucket === 'upcoming') return t('empty.title.noUpcoming');
    return t('empty.title.default');
};

const buildEmptyDescription = (
    t: TFunction,
    isAdmin: boolean,
    bucket: FollowUpBucket,
    counts: Record<FollowUpBucket, number>,
    search: string
): string => {
    if (search) return t('empty.description.noMatches', { query: search });
    // When the active bucket is empty but other buckets have items, nudge the
    // user to switch — that's what the cards above are for.
    if (bucket === 'today' && counts.overdue > 0) {
        return t('empty.description.overdueNudge', { count: counts.overdue });
    }
    if (bucket === 'today' && counts.upcoming > 0) {
        return t('empty.description.upcomingNudge');
    }
    return isAdmin
        ? t('empty.description.teamAllCaughtUp')
        : t('empty.description.selfAllCaughtUp');
};
