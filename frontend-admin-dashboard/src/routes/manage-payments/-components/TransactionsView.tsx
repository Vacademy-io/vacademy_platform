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
import { PaymentFilters } from './PaymentFilters';
import { PaymentControlBar, type StatusSegment } from './PaymentControlBar';
import { PaymentLogsTable } from './PaymentLogsTable';
import { PaymentSummaryCards, type SummaryStatusKey } from './PaymentSummaryCards';
import { PaymentDetailSheet } from './PaymentDetailSheet';
import { SendRemindersModal } from './SendRemindersModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { exportEntriesToCsv, fetchAllPaymentLogs } from '../-utils/exportPaymentLogsCsv';
import { computePaymentSummary, summarizeBucketAmount } from '../-utils/paymentSummary';

const PAGE_SIZE = 20;

/** Header actions (Send reminders / Record payment) are hidden until the flows are ready. */
const SHOW_HEADER_ACTIONS = false;

/** Map a KPI card / segment to the payment_status value(s) it filters the table down to. */
const STATUS_FOR_KEY: Record<Exclude<SummaryStatusKey, 'total'>, string> = {
    paid: 'PAID',
    pending: 'PAYMENT_PENDING',
    failed: 'FAILED',
};

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

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<SelectOption[]>([]);
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
        if (selectedPaymentStatuses.length > 0)
            filters.payment_statuses = selectedPaymentStatuses.map((s) => s.value);
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
        selectedPaymentStatuses,
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

    const filteredEntries = useMemo(() => allData?.entries ?? [], [allData]);

    const paymentSummary = useMemo(() => computePaymentSummary(filteredEntries), [filteredEntries]);

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

    // Which KPI/segment is reflected in the current status filter (only when exactly one is selected).
    const activeSummaryKey: SummaryStatusKey = useMemo(() => {
        if (selectedPaymentStatuses.length !== 1) return 'total';
        const value = selectedPaymentStatuses[0]!.value;
        const match = (
            Object.entries(STATUS_FOR_KEY) as [Exclude<SummaryStatusKey, 'total'>, string][]
        ).find(([, v]) => v === value);
        return match ? match[0] : 'total';
    }, [selectedPaymentStatuses]);

    const handleSummarySelect = (key: SummaryStatusKey) => {
        setCurrentPage(0);
        if (key === 'total' || key === activeSummaryKey) {
            setSelectedPaymentStatuses([]);
            return;
        }
        setSelectedPaymentStatuses([{ value: STATUS_FOR_KEY[key], label: key }]);
    };

    // Segmented status switch — counts come from the same summary the KPI cards use.
    const segments: StatusSegment[] = [
        { key: 'total', label: 'All', count: filteredEntries.length },
        { key: 'paid', label: 'Paid', count: paymentSummary.paid.count },
        { key: 'pending', label: 'Pending', count: paymentSummary.pending.count },
        { key: 'failed', label: 'Failed', count: paymentSummary.failed.count },
    ];

    // Detailed-filter count for the Filters button badge (status lives in the segmented switch).
    const detailedFilterCount =
        selectedPaymentTypes.length +
        selectedUserPlanStatuses.length +
        selectedPaymentSources.length +
        (startDate ? 1 : 0) +
        (endDate ? 1 : 0) +
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
        if (startDate || endDate)
            chips.push({
                id: 'date',
                label: 'Date range',
                onRemove: () => {
                    setStartDate('');
                    setEndDate('');
                },
            });
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
        startDate,
        endDate,
        packageSessionFilter,
    ]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleQuickFilterSelect = (range: { start: string; end: string }) => {
        setStartDate(range.start);
        setEndDate(range.end);
        setCurrentPage(0);
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedPaymentStatuses([]);
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
                {/* Header: subline + primary actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-body text-neutral-500">
                        {isLoadingPayments ? (
                            'Loading payments…'
                        ) : (
                            <>
                                <span className="font-medium text-neutral-700">
                                    {filteredEntries.length.toLocaleString()}
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

                {/* KPI tiles */}
                <PaymentSummaryCards
                    summary={paymentSummary}
                    totalCount={filteredEntries.length}
                    isLoading={isLoadingPayments}
                    truncated={allData?.truncated}
                    activeKey={activeSummaryKey}
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
                    activeStatus={activeSummaryKey}
                    onStatusSelect={handleSummarySelect}
                    filterCount={detailedFilterCount}
                    onOpenFilters={() => setFiltersOpen(true)}
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

                {/* Table */}
                <PaymentLogsTable
                    data={pagedData}
                    isLoading={isLoadingPayments}
                    error={paymentsError as Error}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    packageSessions={packageSessionsMap}
                    hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                    onRefresh={() => refetchPaymentLogs()}
                    onViewDetails={openDetail}
                />

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
                                onStartDateChange={(date) => {
                                    setStartDate(date);
                                    setCurrentPage(0);
                                }}
                                onEndDateChange={(date) => {
                                    setEndDate(date);
                                    setCurrentPage(0);
                                }}
                                selectedPaymentStatuses={selectedPaymentStatuses}
                                onPaymentStatusesChange={(statuses) => {
                                    setSelectedPaymentStatuses(statuses);
                                    setCurrentPage(0);
                                }}
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
                                onQuickFilterSelect={handleQuickFilterSelect}
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
