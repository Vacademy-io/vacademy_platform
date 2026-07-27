import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { PaymentFilters } from './-components/PaymentFilters';
import { PaymentLogsTable } from './-components/PaymentLogsTable';
import { SettingsQuickAccessButton } from '@/components/settings/quick-access/SettingsQuickAccessButton';
import { SettingsTabs } from '@/routes/settings/-constants/terms';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import type { SelectOption } from '@/components/design-system/SelectChips';
import type {
    PaymentLogsRequest,
    PaymentLogsResponse,
    PackageSessionFilter,
    BatchForSession,
} from '@/types/payment-logs';
import { DownloadSimple } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { exportEntriesToCsv, fetchAllPaymentLogs } from './-utils/exportPaymentLogsCsv';
import { computePaymentSummary } from './-utils/paymentSummary';
import { PaymentSummaryCards } from './-components/PaymentSummaryCards';
import { toast } from 'sonner';

export const Route = createLazyFileRoute('/manage-payments/')({
    component: () => (
        <LayoutContainer>
            <ManagePaymentsLayoutPage />
        </LayoutContainer>
    ),
});

function ManagePaymentsLayoutPage() {
    const { setNavHeading } = useNavHeadingStore();

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(20);

    // Free-text search (name / email / phone / amount). The input updates `searchValue` instantly;
    // `debouncedSearch` is what we actually send to the API, so we don't fire a request per keystroke.
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
    const [selectedPaymentSources, setSelectedPaymentSources] = useState<SelectOption[]>([]); // New filter
    const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<SelectOption[]>([]);
    const [packageSessionFilter, setPackageSessionFilter] = useState<PackageSessionFilter>({});
    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <h1 className="text-lg">Manage Payments</h1>
                <SettingsQuickAccessButton
                    settingsKey={SettingsTabs.PaymentGateways}
                    label="Payment settings"
                />
            </div>
        );
    }, [setNavHeading]);    // Get institute details from Zustand store (already loaded on app init)
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);

    // Extract batches for sessions from institute data
    const batchesForSessions: BatchForSession[] = useMemo(() => {
        const batches = instituteDetails?.batches_for_sessions;
        // Cast the Zustand store batch type to the payment logs batch type
        // The store type is compatible, just missing optional fields
        return batches && Array.isArray(batches) ? (batches as unknown as BatchForSession[]) : [];
    }, [instituteDetails]);

    // Check if institute has any org-associated batches
    const hasOrgAssociatedBatches = useMemo(() => {
        return batchesForSessions.some((batch) => batch.is_org_associated === true);
    }, [batchesForSessions]);

    // Build request filters
    const requestFilters: Omit<PaymentLogsRequest, 'institute_id'> = useMemo(() => {
        const filters: Omit<PaymentLogsRequest, 'institute_id'> = {
            sort_columns: {
                createdAt: 'DESC',
            },
        };

        if (startDate) {
            filters.start_date_in_utc = startDate;
        }

        if (endDate) {
            filters.end_date_in_utc = endDate;
        }

        if (selectedPaymentStatuses.length > 0) {
            filters.payment_statuses = selectedPaymentStatuses.map((s) => s.value);
        }

        if (selectedUserPlanStatuses.length > 0) {
            filters.user_plan_statuses = selectedUserPlanStatuses.map((s) => s.value);
        }

        if (selectedPaymentSources.length > 0) {
            filters.sources = selectedPaymentSources.map((s) => s.value) as ('USER' | 'SUB_ORG')[];
        }

        if (selectedPaymentTypes.length > 0) {
            filters.payment_types = selectedPaymentTypes.map((t) => t.value);
        }

        if (debouncedSearch) {
            filters.search_string = debouncedSearch;
        }

        if (packageSessionFilter.packageSessionIds && packageSessionFilter.packageSessionIds.length > 0) {
            filters.package_session_ids = packageSessionFilter.packageSessionIds;
        } else if (packageSessionFilter.packageSessionId) {
            filters.package_session_ids = [packageSessionFilter.packageSessionId];
        } else if (packageSessionFilter.packageId) {
            // Resolve all matching batches for the selected package and optional level/session
            const resolvedIds = batchesForSessions
                .filter((batch) =>
                    batch.package_dto.id === packageSessionFilter.packageId &&
                    (!packageSessionFilter.levelId || batch.level.id === packageSessionFilter.levelId) &&
                    (!packageSessionFilter.sessionId || batch.session.id === packageSessionFilter.sessionId)
                )
                .map((batch) => batch.id);

            if (resolvedIds.length > 0) {
                filters.package_session_ids = resolvedIds;
            }
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
    ]);

    // Fetch ALL rows matching the current server-side filters (dates, statuses, types, course,
    // source). Search (name/email/phone/amount) and pagination are then applied client-side over
    // this one dataset, so it powers the KPI cards, the table, AND the CSV export consistently.
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

    // The API already applies search + all filters (via requestFilters), so the returned rows ARE
    // the searched/filtered set. Pagination is applied client-side over this set.
    const filteredEntries = useMemo(() => allData?.entries ?? [], [allData]);

    // KPI cards reflect the searched + filtered set.
    const paymentSummary = useMemo(
        () => computePaymentSummary(filteredEntries),
        [filteredEntries]
    );

    // Client-side pagination over the searched/filtered set, shaped for the table.
    const pagedData: PaymentLogsResponse | undefined = useMemo(() => {
        if (!allData) return undefined;
        const total = filteredEntries.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(currentPage, totalPages - 1);
        const start = page * pageSize;
        const content = filteredEntries.slice(start, start + pageSize);
        return {
            content,
            totalPages,
            totalElements: total,
            size: pageSize,
            number: page,
            numberOfElements: content.length,
            first: page === 0,
            last: page >= totalPages - 1,
            empty: total === 0,
            pageable: {},
            sort: {},
        } as unknown as PaymentLogsResponse;
    }, [allData, filteredEntries, currentPage, pageSize]);

    // Build package sessions map
    const packageSessionsMap = useMemo(() => {
        const map: Record<string, string> = {};
        batchesForSessions.forEach((batch) => {
            const packageName = batch.package_dto.package_name;
            const sessionName = batch.session.session_name;
            const levelName = batch.level.level_name;
            map[batch.id] = `${packageName} - ${sessionName} - ${levelName}`;
        });
        return map;
    }, [batchesForSessions]);

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle quick filter selection
    const handleQuickFilterSelect = (range: { start: string; end: string }) => {
        setStartDate(range.start);
        setEndDate(range.end);
        setCurrentPage(0);
    };

    // Handle clear all filters
    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedPaymentStatuses([]);
        setSelectedUserPlanStatuses([]);
        setSelectedPaymentSources([]); // Clear new filter
        setSelectedPaymentTypes([]);
        setPackageSessionFilter({});
        setCurrentPage(0);
    };

    // Download the currently shown (searched + filtered) payment logs as CSV.
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

    // Note: Stats are calculated from current page only, not all filtered results
    // To get accurate stats across all pages, we would need a separate summary API endpoint

    return (
        <>
            <Helmet>
                <title>Manage Payments</title>
                <meta name="description" content="Manage payments and billing for your institute" />
            </Helmet>

            <div className="space-y-6 p-6">
                {/* Summary KPI cards — reflect the current search + filters */}
                <PaymentSummaryCards
                    summary={paymentSummary}
                    totalCount={filteredEntries.length}
                    isLoading={isLoadingPayments}
                    truncated={allData?.truncated}
                />

                {/* Filters */}
                <PaymentFilters
                    searchValue={searchValue}
                    onSearchChange={(value) => {
                        setSearchValue(value);
                        setCurrentPage(0);
                    }}
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
                    exportSlot={
                        filteredEntries.length > 0 ? (
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onAsyncClick={handleExportCsv}
                                loadingText="Exporting…"
                                className="gap-2"
                            >
                                <DownloadSimple size={16} />
                                Download CSV
                            </MyButton>
                        ) : null
                    }
                />                {/* Payment Logs Table */}
                <PaymentLogsTable
                    data={pagedData}
                    isLoading={isLoadingPayments}
                    error={paymentsError as Error}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    packageSessions={packageSessionsMap}
                    hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                    onRefresh={() => refetchPaymentLogs()}
                />
            </div>
        </>
    );
}
