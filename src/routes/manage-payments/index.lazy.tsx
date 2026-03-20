import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { PaymentFilters } from './-components/PaymentFilters';
import { PaymentLogsTable } from './-components/PaymentLogsTable';
import { ActiveFiltersDisplay } from '@/components/common/filters/ActiveFiltersDisplay';
import { fetchPaymentLogs, getPaymentLogsQueryKey } from '@/services/payment-logs';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import type { SelectOption } from '@/components/design-system/SelectChips';
import type {
    PaymentLogsRequest,
    PackageSessionFilter,
    BatchForSession,
} from '@/types/payment-logs';
import { Card } from '@/components/ui/card';
import { CreditCard } from '@phosphor-icons/react';

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

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<SelectOption[]>([]);
    const [selectedUserPlanStatuses, setSelectedUserPlanStatuses] = useState<SelectOption[]>([]);
    const [selectedPaymentSources, setSelectedPaymentSources] = useState<SelectOption[]>([]); // New filter
    const [packageSessionFilter, setPackageSessionFilter] = useState<PackageSessionFilter>({}); useEffect(() => {
        setNavHeading(<h1 className="text-lg">Manage Payments</h1>);
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
        packageSessionFilter,
    ]);

    // Fetch payment logs
    const {
        data: paymentLogsData,
        isLoading: isLoadingPayments,
        error: paymentsError,
        refetch: refetchPaymentLogs,
    } = useQuery({
        queryKey: getPaymentLogsQueryKey(currentPage, pageSize, requestFilters),
        queryFn: () => fetchPaymentLogs(currentPage, pageSize, requestFilters),
        staleTime: 30000,
    });

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
        setPackageSessionFilter({});
        setCurrentPage(0);
    };

    // Handle clearing individual filters
    const handleClearFilter = (filterType: string, value?: string) => {
        switch (filterType) {
            case 'all':
                handleClearFilters();
                break;
            case 'startDate':
                setStartDate('');
                setCurrentPage(0);
                break;
            case 'endDate':
                setEndDate('');
                setCurrentPage(0);
                break;
            case 'paymentStatus':
                setSelectedPaymentStatuses((prev) =>
                    prev.filter((status) => status.value !== value)
                );
                setCurrentPage(0);
                break;
            case 'userPlanStatus':
                setSelectedUserPlanStatuses((prev) =>
                    prev.filter((status) => status.value !== value)
                );
                setCurrentPage(0);
                break;
            case 'paymentSource':
                setSelectedPaymentSources((prev) =>
                    prev.filter((source) => source.value !== value)
                );
                setCurrentPage(0);
                break;
            case 'packageSession':
                if (value) {
                    setPackageSessionFilter(prev => ({
                        ...prev,
                        packageSessionIds: prev.packageSessionIds?.filter(id => id !== value)
                    }));
                } else {
                    setPackageSessionFilter({});
                }
                setCurrentPage(0);
                break;
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
                {/* Statistics Card - Only showing total count which is accurate across all pages */}
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="rounded-lg bg-primary-100 p-4">
                                <CreditCard
                                    size={32}
                                    className="text-primary-600"
                                    weight="duotone"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">
                                    Total Payment Records
                                </p>
                                <p className="mt-1 text-3xl font-bold text-gray-900">
                                    {paymentLogsData?.totalElements.toLocaleString() || 0}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Across all filtered results
                                </p>
                            </div>
                        </div>
                        {paymentLogsData && paymentLogsData.totalElements > 0 && (
                            <div className="text-right">
                                <p className="text-sm text-gray-600">
                                    Showing page {paymentLogsData.number + 1} of{' '}
                                    {paymentLogsData.totalPages}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {paymentLogsData.numberOfElements} records on this page
                                </p>
                            </div>
                        )}
                    </div>
                </Card>                {/* Active Filters Display */}
                <ActiveFiltersDisplay
                    startDate={startDate}
                    endDate={endDate}
                    selectedPaymentStatuses={selectedPaymentStatuses}
                    selectedUserPlanStatuses={selectedUserPlanStatuses}
                    selectedPaymentSources={selectedPaymentSources}
                    packageSessionFilter={packageSessionFilter}
                    batchesForSessions={batchesForSessions}
                    onClearFilter={handleClearFilter}
                />

                {/* Filters */}
                <PaymentFilters
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
                    hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                    packageSessionFilter={packageSessionFilter}
                    onPackageSessionFilterChange={(filter) => {
                        setPackageSessionFilter(filter);
                        setCurrentPage(0);
                    }}
                    batchesForSessions={batchesForSessions}
                    onQuickFilterSelect={handleQuickFilterSelect}
                    onClearFilters={handleClearFilters}
                />                {/* Payment Logs Table */}
                <PaymentLogsTable
                    data={paymentLogsData}
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
