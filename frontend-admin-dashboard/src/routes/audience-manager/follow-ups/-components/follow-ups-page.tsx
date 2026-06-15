import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarBlank, ListBullets } from '@phosphor-icons/react';
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
import { fetchCounselors } from '@/routes/settings/leads/pools/-components/schedule/shared';
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
    type LeadActionHandlers,
    type LeadTableExtraColumn,
} from '@/components/shared/leads';
import { FollowUpStatTiles } from './follow-up-stat-tiles';
import {
    bucketCounts,
    effectiveDueMs,
    filterToBucket,
    isPendingFollowUp,
    type FollowUpBucket,
} from './follow-up-buckets';
import { FollowUpsCalendarView } from './follow-ups-calendar-view';
import { useFollowUpsViewState } from './use-follow-ups-view-state';

/**
 * Follow-ups — at-a-glance task list of leads needing counsellor action.
 *
 * **Deliberately minimal toolbar.** A counsellor on shift should land here and
 * instantly see today's workload — three big bucket cards (Pending / Today /
 * Upcoming / All) drive everything. No search, tier, status, audience, date or
 * column controls live here on purpose; that's the Recent Leads / Lead List
 * job. The single additional control is the **counsellor filter** (admin
 * only) so a manager can drill into one rep's queue.
 *
 * Counsellors are server-locked to their own assignment via
 * `assigned_counselor_id = currentUserId`; admins can switch with the filter.
 *
 * UI-only: data comes from the existing `POST /audience/leads` endpoint.
 * Bucket classification + the "pending follow-up" filter run client-side on
 * the fetched page. When a backend follow-up endpoint with accurate counts
 * ships later, swap-in is trivial because the bucket vocabulary doesn't change.
 */

const ALL_COUNSELLORS_VALUE = '__ALL_COUNSELLORS__';
// Fetch a generous page so bucket classification on the client has enough rows
// without a paged round-trip. v2 will swap this for a server-side follow-up
// endpoint with accurate global counts.
const FETCH_PAGE_SIZE = 200;
// Hidden on this surface to keep triage focused — easy to surface again in v2.
const HIDDEN_COLUMNS = new Set(['score', 'source']);
// Static cache keys every mutation on this page must refresh.
const INVALIDATE_KEYS: string[][] = [['follow-ups'], ['lead-profiles-batch']];

export const FollowUpsPage = () => {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Follow-ups</h1>);
    }, [setNavHeading]);
    return (
        <StudentSidebarProvider>
            <FollowUpsContent />
        </StudentSidebarProvider>
    );
};

const FollowUpsContent = () => {
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

    const [bucket, setBucket] = useState<FollowUpBucket>('today');

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

    // Counsellor option list — admin only.
    const counsellorOptionsQuery = useQuery({
        queryKey: ['counsellor-options', instituteId],
        queryFn: fetchCounselors,
        enabled: !!instituteId && isAdmin,
        staleTime: 5 * 60 * 1000,
    });
    const counsellorOptions = counsellorOptionsQuery.data ?? [];

    // Non-admins are locked server-side; admins drill in via the filter.
    const effectiveCounsellorId = isAdmin
        ? counsellorFilter === ALL_COUNSELLORS_VALUE
            ? undefined
            : counsellorFilter
        : currentUserId || undefined;

    const { data, isLoading, error } = useQuery({
        queryKey: ['follow-ups', instituteId, effectiveCounsellorId],
        queryFn: () =>
            fetchRecentLeads({
                institute_id: instituteId ?? '',
                assigned_counselor_id: effectiveCounsellorId,
                // A converted lead is no longer a pending follow-up.
                conversion_status_filter: 'EXCLUDE_CONVERTED',
                page: 0,
                size: FETCH_PAGE_SIZE,
            }),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

    // Build VMs, filter to pending follow-ups, classify into buckets, sort by
    // soonest-due so the top of the list is always the most urgent task.
    const allVms = useMemo(() => (data?.content ?? []).map(recentLeadToVM), [data]);
    const pendingVms = useMemo(() => allVms.filter(isPendingFollowUp), [allVms]);
    const counts = useMemo(() => bucketCounts(pendingVms), [pendingVms]);
    const bucketVms = useMemo(() => filterToBucket(pendingVms, bucket), [pendingVms, bucket]);
    const sortedVms = useMemo(
        () => [...bucketVms].sort((a, b) => effectiveDueMs(a) - effectiveDueMs(b)),
        [bucketVms]
    );

    // Profiles + notes for the visible vms. On the calendar view the user can
    // jump to any day, so we need profiles/notes for ALL pending VMs (not just
    // the current bucket's sorted slice) — otherwise selecting a day outside
    // the active bucket would render without profile/notes data.
    const userIds = useMemo(() => {
        const source = view === 'calendar' ? pendingVms : sortedVms;
        return source.map((vm) => vm.userId ?? '').filter((id): id is string => !!id);
    }, [view, pendingVms, sortedVms]);
    const { profiles: leadProfiles } = useLeadProfiles(userIds, showOps);
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
                if (!vm.responseId) return { allowed: false, reason: 'Lead has no submission id' };
                const phone = vm.phone && vm.phone !== '-' ? vm.phone : '';
                if (!phone) return { allowed: false, reason: 'Lead has no phone on file' };
                if (placeCall.isPending)
                    return { allowed: false, reason: 'Another call is starting…' };
                return { allowed: true };
            },
        }),
        [setSelectedStudent, updateTier, isAdmin, placeCall]
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
                header: 'Action',
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
        []
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
                title="Couldn't load follow-ups"
                description="Something went wrong fetching follow-ups. Try again."
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
                        title={emptyTitle(isAdmin, bucket, counts)}
                        description={emptyDescription(isAdmin, bucket, counts)}
                    />
                }
            />
        );
    }

    // Subline copy (counts-aware so a counsellor sees workload immediately).
    const sublineRole = isAdmin ? 'Team has' : 'You have';
    const sublineNoun = counts.today === 1 ? 'task' : 'tasks';
    const subline =
        counts.today === 0 && counts.overdue === 0
            ? `${isAdmin ? 'Team is' : "You're"} all caught up`
            : `${sublineRole} ${counts.today} ${sublineNoun} due today${
                  counts.overdue > 0 ? ` · ${counts.overdue} overdue` : ''
              }`;

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Heading row + (admin) counsellor filter */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">
                        {isAdmin ? 'Follow-ups' : 'My Follow-ups'}
                    </h1>
                    <p
                        className={`mt-0.5 text-sm ${
                            counts.overdue > 0 ? 'text-danger-600' : 'text-neutral-500'
                        }`}
                    >
                        {subline} · {format(new Date(), 'EEEE, MMM d')}
                    </p>
                </div>
                {isAdmin && (
                    <CounsellorFilter
                        value={counsellorFilter}
                        onChange={setCounsellorFilter}
                        allValue={ALL_COUNSELLORS_VALUE}
                        options={counsellorOptions}
                        isLoading={counsellorOptionsQuery.isLoading}
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
                        List
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="gap-1.5">
                        <CalendarBlank className="size-4" />
                        Calendar
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Showing N {bucket} — list view only */}
            {view === 'list' && (
                <div className="flex items-center justify-end gap-1 text-body text-muted-foreground">
                    Showing{' '}
                    <span className="font-semibold text-card-foreground">{sortedVms.length}</span>{' '}
                    {bucket === 'all' ? 'follow-ups' : `${bucketLabel(bucket)} follow-ups`}
                </div>
            )}

            {/* View body — calendar or list */}
            <SidebarProvider
                style={{ ['--sidebar-width' as string]: '565px' }}
                defaultOpen={false}
                open={isSidebarOpen}
                onOpenChange={setIsSidebarOpen}
            >
                <div className="min-w-0 flex-1">{viewBody}</div>
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

const bucketLabel = (b: FollowUpBucket): string => {
    switch (b) {
        case 'overdue':
            return 'overdue';
        case 'today':
            return 'due today';
        case 'upcoming':
            return 'upcoming';
        default:
            return '';
    }
};

const emptyTitle = (
    isAdmin: boolean,
    bucket: FollowUpBucket,
    counts: Record<FollowUpBucket, number>
): string => {
    if (counts.all === 0)
        return isAdmin ? 'No pending follow-ups across the team' : 'All caught up';
    if (bucket === 'overdue') return 'No overdue follow-ups';
    if (bucket === 'today') return 'Nothing due today';
    if (bucket === 'upcoming') return 'No upcoming follow-ups in the next 7 days';
    return 'No follow-ups';
};

const emptyDescription = (
    isAdmin: boolean,
    bucket: FollowUpBucket,
    counts: Record<FollowUpBucket, number>
): string => {
    // When the active bucket is empty but other buckets have items, nudge the
    // user to switch — that's what the cards above are for.
    if (bucket === 'today' && counts.overdue > 0) {
        return `You have ${counts.overdue} overdue ${
            counts.overdue === 1 ? 'task' : 'tasks'
        } — switch to "Pending" above.`;
    }
    if (bucket === 'today' && counts.upcoming > 0) {
        return `Switch to "Upcoming" above to see what's due next.`;
    }
    return isAdmin
        ? 'The team is all caught up on follow-ups for this view.'
        : 'You have no pending follow-ups in this view.';
};
