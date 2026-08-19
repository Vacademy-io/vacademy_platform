import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DownloadSimple, EnvelopeSimple, Plus, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import type { SelectOption } from '@/components/design-system/SelectChips';
import type {
    PaymentLogEntry,
    PaymentLogsRequest,
    PaymentLogsResponse,
    PackageSessionFilter,
    BatchForSession,
} from '@/types/payment-logs';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { fetchBillingSummary, fetchOutstandingLearners } from '@/services/payment-logs';
import { ManageColumnsPopover } from '@/components/shared/leads/manage-columns-popover';
import { useLeadColumnPrefs } from '@/components/shared/leads/use-lead-column-prefs';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { PaymentFilters } from './PaymentFilters';
import { PaymentControlBar, type SegmentKey, type StatusSegment } from './PaymentControlBar';
import { DueLearnersTable } from './DueLearnersTable';
import { PaymentLogsTable } from './PaymentLogsTable';
import { PaymentKpiCards, type RecordStatusKey, type SummaryStatusKey } from './PaymentKpiCards';
import { PaymentDetailSheet } from './PaymentDetailSheet';
import { SendRemindersModal } from './SendRemindersModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { DateRangeDropdown } from './DateRangeDropdown';
import { exportEntriesToCsv, fetchAllPaymentLogs } from '../-utils/exportPaymentLogsCsv';
import {
    classifyEntry,
    computeBillingFromEntries,
    computePaymentSummary,
    summarizeBucketAmount,
} from '../-utils/paymentSummary';
import { ALL_TIME_RANGE, type DateRangeValue } from '../-utils/dateRange';

const PAGE_SIZE = 20;

/** Where this table's column layout is remembered, per browser. */
const COLUMN_PREFS_KEY = 'manage-payments:hidden-columns';

/** Columns hidden until someone asks for them — the tracking trio is a niche reconciliation aid. */
const DEFAULT_HIDDEN_COLUMNS = ['tracking_id', 'tracking_source', 'order_status'];

/** Header actions (Send reminders / Record payment) are hidden until the flows are ready. */
const SHOW_HEADER_ACTIONS = false;

interface ActiveChip {
    id: string;
    label: string;
    onRemove: () => void;
}

/** The redesigned transactions screen: KPIs, control bar, filters slide-over, table, detail panel. */
export function TransactionsView() {
    // Pagination
    const [currentPage, setCurrentPage] = useState(0);

    // Free-text search — debounced before it reaches the API.
    const [searchValue, setSearchValue] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchValue.trim());
            setCurrentPage(0);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchValue]);

    // Filters. The date window lives in the toolbar (not the slide-over) so changing the period
    // is one click; start/end are the UTC instants it resolves to.
    const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_TIME_RANGE);
    const { start: startDate, end: endDate } = dateRange;
    // Status is one control — the KPI tiles and the segmented switch drive this single bucket, and
    // it filters the loaded rows locally (see classifyEntry).
    const [statusBucket, setStatusBucket] = useState<RecordStatusKey>('total');
    // 'balances' answers "who owes money", which the payment records cannot: an unpaid balance
    // normally has no row to filter to. It swaps the table rather than narrowing it.
    const [view, setView] = useState<'records' | 'balances'>('records');
    const [selectedUserPlanStatuses, setSelectedUserPlanStatuses] = useState<SelectOption[]>([]);
    const [selectedPaymentSources, setSelectedPaymentSources] = useState<SelectOption[]>([]);
    const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<SelectOption[]>([]);
    const [packageSessionFilter, setPackageSessionFilter] = useState<PackageSessionFilter>({});

    // Overlays
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [remindersOpen, setRemindersOpen] = useState(false);
    const [recordOpen, setRecordOpen] = useState(false);
    const [detailEntry, setDetailEntry] = useState<PaymentLogEntry | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);

    const batchesForSessions: BatchForSession[] = useMemo(() => {
        const batches = instituteDetails?.batches_for_sessions;
        return batches && Array.isArray(batches) ? (batches as unknown as BatchForSession[]) : [];
    }, [instituteDetails]);

    const hasOrgAssociatedBatches = useMemo(
        () => batchesForSessions.some((batch) => batch.is_org_associated === true),
        [batchesForSessions]
    );

    const requestFilters: Omit<PaymentLogsRequest, 'institute_id'> = useMemo(() => {
        const filters: Omit<PaymentLogsRequest, 'institute_id'> = {
            sort_columns: { createdAt: 'DESC' },
        };
        if (startDate) filters.start_date_in_utc = startDate;
        if (endDate) filters.end_date_in_utc = endDate;
        if (selectedUserPlanStatuses.length > 0)
            filters.user_plan_statuses = selectedUserPlanStatuses.map((s) => s.value);
        if (selectedPaymentSources.length > 0)
            filters.sources = selectedPaymentSources.map((s) => s.value) as ('USER' | 'SUB_ORG')[];
        if (selectedPaymentTypes.length > 0)
            filters.payment_types = selectedPaymentTypes.map((t) => t.value);
        if (debouncedSearch) filters.search_string = debouncedSearch;

        if (
            packageSessionFilter.packageSessionIds &&
            packageSessionFilter.packageSessionIds.length > 0
        ) {
            filters.package_session_ids = packageSessionFilter.packageSessionIds;
        } else if (packageSessionFilter.packageSessionId) {
            filters.package_session_ids = [packageSessionFilter.packageSessionId];
        } else if (packageSessionFilter.packageId) {
            const resolvedIds = batchesForSessions
                .filter(
                    (batch) =>
                        batch.package_dto.id === packageSessionFilter.packageId &&
                        (!packageSessionFilter.levelId ||
                            batch.level.id === packageSessionFilter.levelId) &&
                        (!packageSessionFilter.sessionId ||
                            batch.session.id === packageSessionFilter.sessionId)
                )
                .map((batch) => batch.id);
            if (resolvedIds.length > 0) filters.package_session_ids = resolvedIds;
        }
        return filters;
    }, [
        startDate,
        endDate,
        selectedUserPlanStatuses,
        selectedPaymentSources,
        selectedPaymentTypes,
        debouncedSearch,
        packageSessionFilter,
        batchesForSessions,
    ]);

    const {
        data: allData,
        isLoading: isLoadingPayments,
        error: paymentsError,
        refetch: refetchPaymentLogs,
    } = useQuery({
        queryKey: ['payment-logs-all', requestFilters],
        queryFn: () => fetchAllPaymentLogs(requestFilters),
        staleTime: 30000,
    });

    // Everything the API returned for the current filters — the KPI tiles always describe this set,
    // so the numbers don't collapse to whichever tile is selected.
    const allEntries = useMemo(() => allData?.entries ?? [], [allData]);

    const paymentSummary = useMemo(() => computePaymentSummary(allEntries), [allEntries]);

    // What the table shows: the same set narrowed to the selected KPI bucket.
    const filteredEntries = useMemo(
        () =>
            statusBucket === 'total'
                ? allEntries
                : allEntries.filter((entry) => classifyEntry(entry) === statusBucket),
        [allEntries, statusBucket]
    );

    /**
     * What learners were billed, paid, and still owe. Payment records can't answer this: a
     * part-paid instalment plan leaves one PAID row and no trace of the balance, and an enrolment
     * that never paid leaves no row at all. Same window and course scope as the table.
     */
    const { data: billingSummary } = useQuery({
        queryKey: [
            'payment-billing-summary',
            startDate,
            endDate,
            requestFilters.package_session_ids,
        ],
        queryFn: () =>
            fetchBillingSummary({
                start_date_in_utc: startDate ? startDate.slice(0, 19) : undefined,
                end_date_in_utc: endDate ? endDate.slice(0, 19) : undefined,
                package_session_ids: requestFilters.package_session_ids,
            }),
        staleTime: 60_000,
        retry: false,
    });

    /**
     * Prefer the server figures; without them (older backend, failed request) derive what we can
     * from the rows on screen — that still prices each enrolment properly, it just can't see
     * enrolments that have never paid anything.
     */
    const entryBilling = useMemo(() => computeBillingFromEntries(allEntries), [allEntries]);
    const billing = billingSummary
        ? {
              totalBilled: billingSummary.total_billed,
              collected: billingSummary.collected,
              due: billingSummary.due,
              currency: billingSummary.currency || '',
              planCount: billingSummary.plan_count,
              settledPlanCount: billingSummary.settled_plan_count,
          }
        : entryBilling.planCount > 0
          ? entryBilling
          : null;

    const pagedData: PaymentLogsResponse | undefined = useMemo(() => {
        if (!allData) return undefined;
        const total = filteredEntries.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages - 1);
        const start = page * PAGE_SIZE;
        const content = filteredEntries.slice(start, start + PAGE_SIZE);
        return {
            content,
            totalPages,
            totalElements: total,
            size: PAGE_SIZE,
            number: page,
            numberOfElements: content.length,
            first: page === 0,
            last: page >= totalPages - 1,
            empty: total === 0,
            pageable: {},
            sort: {},
        } as unknown as PaymentLogsResponse;
    }, [allData, filteredEntries, currentPage]);

    const packageSessionsMap = useMemo(() => {
        const map: Record<string, string> = {};
        batchesForSessions.forEach((batch) => {
            map[batch.id] =
                `${batch.package_dto.package_name} - ${batch.session.session_name} - ${batch.level.level_name}`;
        });
        return map;
    }, [batchesForSessions]);

    // Column layout, remembered per browser. Date & Time and Amount stay pinned: they are the row.
    const { hiddenColumns, toggleColumn, resetColumns } = useLeadColumnPrefs(
        COLUMN_PREFS_KEY,
        DEFAULT_HIDDEN_COLUMNS
    );

    const columnToggles = useMemo(() => {
        const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
        const toggles = [{ id: 'user_info', label: 'User' }];
        if (hasOrgAssociatedBatches) toggles.push({ id: 'org_name', label: 'Organization Name' });
        toggles.push(
            { id: 'current_payment_status', label: 'Payment' },
            { id: 'vendor', label: 'Payment Method' },
            { id: 'user_plan_status', label: 'Plan Status' },
            { id: 'enroll_invite', label: `${courseTerm}/Membership` },
            { id: 'transaction_id', label: 'Transaction ID' },
            { id: 'payment_plan', label: 'Payment Plan' },
            { id: 'tracking_id', label: 'Tracking ID' },
            { id: 'tracking_source', label: 'Tracking Source' },
            { id: 'order_status', label: 'Order Status' },
            { id: 'tracking_actions', label: 'Actions' }
        );
        return toggles;
    }, [hasOrgAssociatedBatches]);

    // Paging only applies while the balances list is on screen; leaving it at 0 otherwise keeps
    // the count in the segmented switch from refetching every time the records table is paged.
    const balancesPage = view === 'balances' ? currentPage : 0;
    const {
        data: outstanding,
        isLoading: isLoadingOutstanding,
        error: outstandingError,
    } = useQuery({
        queryKey: [
            'payment-outstanding-learners',
            startDate,
            endDate,
            requestFilters.package_session_ids,
            balancesPage,
        ],
        queryFn: () =>
            fetchOutstandingLearners(
                {
                    start_date_in_utc: startDate ? startDate.slice(0, 19) : undefined,
                    end_date_in_utc: endDate ? endDate.slice(0, 19) : undefined,
                    package_session_ids: requestFilters.package_session_ids,
                },
                balancesPage,
                PAGE_SIZE
            ),
        staleTime: 60_000,
        retry: false,
    });

    /** 'due' opens the balances list; everything else narrows the payment records. */
    const handleSegmentSelect = (key: SegmentKey) => {
        setCurrentPage(0);
        if (key === 'due') {
            setView('balances');
            return;
        }
        setView('records');
        // Clicking the active tile again clears back to "all".
        setStatusBucket(key === statusBucket ? 'total' : key);
    };

    const handleSummarySelect = (key: SummaryStatusKey) => handleSegmentSelect(key);

    // Segmented switch. The first four narrow the payment records; the last swaps in the learners
    // who still owe money, counted from the balances query rather than from the records.
    const segments: StatusSegment[] = [
        { key: 'total', label: 'All', count: allEntries.length },
        { key: 'paid', label: 'Paid', count: paymentSummary.paid.count },
        { key: 'pending', label: 'Pending', count: paymentSummary.pending.count },
        { key: 'failed', label: 'Failed', count: paymentSummary.failed.count },
        { key: 'due', label: 'Due', count: outstanding?.totalElements ?? 0 },
    ];

    // Detailed-filter count for the Filters button badge. Status lives in the segmented switch and
    // the date window in the toolbar dropdown, so neither is counted here.
    const detailedFilterCount =
        selectedPaymentTypes.length +
        selectedUserPlanStatuses.length +
        selectedPaymentSources.length +
        (packageSessionFilter.packageSessionIds?.length ||
            (packageSessionFilter.packageId ? 1 : 0));

    // Removable chips for the active detailed filters.
    const activeChips: ActiveChip[] = useMemo(() => {
        const chips: ActiveChip[] = [];
        selectedPaymentTypes.forEach((t) =>
            chips.push({
                id: `type-${t.value}`,
                label: `Type: ${t.label}`,
                onRemove: () =>
                    setSelectedPaymentTypes((prev) => prev.filter((x) => x.value !== t.value)),
            })
        );
        selectedUserPlanStatuses.forEach((s) =>
            chips.push({
                id: `plan-${s.value}`,
                label: `Plan: ${s.label}`,
                onRemove: () =>
                    setSelectedUserPlanStatuses((prev) => prev.filter((x) => x.value !== s.value)),
            })
        );
        selectedPaymentSources.forEach((s) =>
            chips.push({
                id: `source-${s.value}`,
                label: `Source: ${s.label}`,
                onRemove: () =>
                    setSelectedPaymentSources((prev) => prev.filter((x) => x.value !== s.value)),
            })
        );
        if (packageSessionFilter.packageId || packageSessionFilter.packageSessionIds?.length)
            chips.push({
                id: 'course',
                label: 'Course / session',
                onRemove: () => setPackageSessionFilter({}),
            });
        return chips;
    }, [
        selectedPaymentTypes,
        selectedUserPlanStatuses,
        selectedPaymentSources,
        packageSessionFilter,
    ]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDateRangeChange = (range: DateRangeValue) => {
        setDateRange(range);
        setCurrentPage(0);
    };

    const handleClearFilters = () => {
        setDateRange(ALL_TIME_RANGE);
        setStatusBucket('total');
        setView('records');
        setSelectedUserPlanStatuses([]);
        setSelectedPaymentSources([]);
        setSelectedPaymentTypes([]);
        setPackageSessionFilter({});
        setCurrentPage(0);
    };

    const handleExportCsv = async () => {
        try {
            if (filteredEntries.length === 0) {
                toast.info('No payment records to export.');
                return;
            }
            const count = exportEntriesToCsv(filteredEntries, instituteDetails?.institute_name);
            toast.success(`Exported ${count.toLocaleString()} payment records.`);
        } catch (error) {
            console.error('Failed to export payment logs:', error);
            toast.error('Failed to export payment logs. Please try again.');
        }
    };

    const openDetail = (entry: PaymentLogEntry) => {
        setDetailEntry(entry);
        setDetailOpen(true);
    };

    // Subline: "N payments · ₹X collected · M need attention".
    const collectedAmount = summarizeBucketAmount(paymentSummary.paid.amountByCurrency).display;
    const needAttention = paymentSummary.pending.count + paymentSummary.failed.count;

    return (
        <StudentSidebarProvider>
            <div className="space-y-4">
                {/* Toolbar: date window (one click, no filter panel) + live subline + actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <DateRangeDropdown value={dateRange} onChange={handleDateRangeChange} />
                        <p className="text-body text-neutral-500">
                            {isLoadingPayments ? (
                                'Loading payments…'
                            ) : (
                                <>
                                    <span className="font-medium text-neutral-700">
                                        {allEntries.length.toLocaleString()}
                                    </span>{' '}
                                    payments
                                    {collectedAmount && (
                                        <>
                                            {' · '}
                                            <span className="font-medium text-neutral-700">
                                                {collectedAmount}
                                            </span>{' '}
                                            collected
                                        </>
                                    )}
                                    {needAttention > 0 && <> · {needAttention} need attention</>}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onAsyncClick={handleExportCsv}
                            loadingText="Exporting…"
                            className="gap-2"
                            disable={filteredEntries.length === 0}
                        >
                            <DownloadSimple size={16} />
                            Export
                        </MyButton>
                        {SHOW_HEADER_ACTIONS && (
                            <>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => setRemindersOpen(true)}
                                    className="gap-2"
                                >
                                    <EnvelopeSimple size={16} />
                                    Send reminders
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={() => setRecordOpen(true)}
                                    className="gap-2"
                                >
                                    <Plus size={16} />
                                    Record payment
                                </MyButton>
                            </>
                        )}
                    </div>
                </div>

                {/* KPI tiles — Total / Collected / Due / Failed (same row as the dashboard) */}
                <PaymentKpiCards
                    summary={paymentSummary}
                    billing={billing}
                    totalCount={allEntries.length}
                    isLoading={isLoadingPayments}
                    truncated={allData?.truncated}
                    activeKey={view === 'balances' ? 'due' : statusBucket}
                    onSelect={handleSummarySelect}
                />

                {/* Control bar */}
                <PaymentControlBar
                    searchValue={searchValue}
                    onSearchChange={(value) => {
                        setSearchValue(value);
                        setCurrentPage(0);
                    }}
                    segments={segments}
                    activeStatus={view === 'balances' ? 'due' : statusBucket}
                    onStatusSelect={handleSegmentSelect}
                    filterCount={detailedFilterCount}
                    onOpenFilters={() => setFiltersOpen(true)}
                    actions={
                        <ManageColumnsPopover
                            columns={columnToggles}
                            hiddenColumns={hiddenColumns}
                            onToggle={toggleColumn}
                            onReset={resetColumns}
                        />
                    }
                />

                {/* Active filter chips */}
                {activeChips.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {activeChips.map((chip) => (
                            <span
                                key={chip.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 py-1 pl-3 pr-1.5 text-caption text-neutral-600"
                            >
                                {chip.label}
                                <button
                                    type="button"
                                    onClick={() => {
                                        chip.onRemove();
                                        setCurrentPage(0);
                                    }}
                                    className="flex size-4 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                                    aria-label={`Remove ${chip.label}`}
                                >
                                    <X size={11} weight="bold" />
                                </button>
                            </span>
                        ))}
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="text-caption font-semibold text-primary-600 hover:text-primary-700"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Table — payment records, or the learners who owe money */}
                {view === 'balances' ? (
                    <DueLearnersTable
                        data={outstanding}
                        isLoading={isLoadingOutstanding}
                        error={outstandingError as Error}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                    />
                ) : (
                    <PaymentLogsTable
                        data={pagedData}
                        isLoading={isLoadingPayments}
                        error={paymentsError as Error}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        packageSessions={packageSessionsMap}
                        hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                        hiddenColumns={hiddenColumns}
                        onRefresh={() => refetchPaymentLogs()}
                        onViewDetails={openDetail}
                    />
                )}

                {/* Filters slide-over */}
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                        <SheetHeader className="text-left">
                            <SheetTitle>Filters</SheetTitle>
                        </SheetHeader>
                        <div className="mt-5">
                            <PaymentFilters
                                panelOnly
                                searchValue={searchValue}
                                onSearchChange={setSearchValue}
                                startDate={startDate}
                                endDate={endDate}
                                hideDateFilters
                                onStartDateChange={(date) =>
                                    handleDateRangeChange({
                                        ...dateRange,
                                        start: date,
                                        preset: 'custom',
                                    })
                                }
                                onEndDateChange={(date) =>
                                    handleDateRangeChange({
                                        ...dateRange,
                                        end: date,
                                        preset: 'custom',
                                    })
                                }
                                selectedUserPlanStatuses={selectedUserPlanStatuses}
                                onUserPlanStatusesChange={(statuses) => {
                                    setSelectedUserPlanStatuses(statuses);
                                    setCurrentPage(0);
                                }}
                                selectedPaymentSources={selectedPaymentSources}
                                onPaymentSourcesChange={(sources) => {
                                    setSelectedPaymentSources(sources);
                                    setCurrentPage(0);
                                }}
                                selectedPaymentTypes={selectedPaymentTypes}
                                onPaymentTypesChange={(types) => {
                                    setSelectedPaymentTypes(types);
                                    setCurrentPage(0);
                                }}
                                hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                                packageSessionFilter={packageSessionFilter}
                                onPackageSessionFilterChange={(filter) => {
                                    setPackageSessionFilter(filter);
                                    setCurrentPage(0);
                                }}
                                batchesForSessions={batchesForSessions}
                                onQuickFilterSelect={(range) =>
                                    handleDateRangeChange({ ...range, preset: 'custom' })
                                }
                                onClearFilters={handleClearFilters}
                            />
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Payment detail slide-over */}
                <PaymentDetailSheet
                    entry={detailEntry}
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                />

                {/* Header action modals */}
                {SHOW_HEADER_ACTIONS && (
                    <>
                        <SendRemindersModal
                            open={remindersOpen}
                            onOpenChange={setRemindersOpen}
                            pendingCount={paymentSummary.pending.count}
                            failedCount={paymentSummary.failed.count}
                        />
                        <RecordPaymentModal open={recordOpen} onOpenChange={setRecordOpen} />
                    </>
                )}
            </div>
        </StudentSidebarProvider>
    );
}
