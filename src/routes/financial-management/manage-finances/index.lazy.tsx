import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { CreditCard } from '@phosphor-icons/react';
import { ManageFinancesFilters } from './-components/ManageFinancesFilters';
import { ManageFinancesTable } from './-components/ManageFinancesTable';
import { fetchManageFinancesLogs, getManageFinancesQueryKey } from '@/services/manage-finances';
import { FeeSearchFilterDTO } from '@/types/manage-finances';

export const Route = createLazyFileRoute('/financial-management/manage-finances/')({
    component: () => (
        <LayoutContainer>
            <ManageFinancesLayoutPage />
        </LayoutContainer>
    ),
});

function ManageFinancesLayoutPage() {
    const { setNavHeading } = useNavHeadingStore();

    const [filter, setFilter] = useState<FeeSearchFilterDTO>({
        page: 0,
        size: 20,
        sortBy: 'dueDate',
        sortDirection: 'DESC',
        filters: {}
    });

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Manage Finances</h1>);
    }, [setNavHeading]);

    const {
        data: financesData,
        isLoading,
        error,
    } = useQuery({
        queryKey: getManageFinancesQueryKey(filter),
        queryFn: () => fetchManageFinancesLogs(filter),
        staleTime: 30000,
    });

    const handlePageChange = (page: number) => {
        setFilter(prev => ({ ...prev, page }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearFilters = () => {
        setFilter(prev => ({
            ...prev,
            page: 0,
            filters: {}
        }));
    };

    return (
        <>
            <Helmet>
                <title>Manage Finances</title>
                <meta name="description" content="Manage transaction history and student fee payments" />
            </Helmet>

            <div className="space-y-6 p-6">
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
                                    {financesData?.totalElements.toLocaleString() || 0}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Across all filtered results
                                </p>
                            </div>
                        </div>
                        {financesData && financesData.totalElements > 0 && (
                            <div className="text-right">
                                <p className="text-sm text-gray-600">
                                    Showing page {financesData.number + 1} of{' '}
                                    {financesData.totalPages}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {financesData.size} records on this page
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                <ManageFinancesFilters
                    filter={filter}
                    onFilterChange={setFilter}
                    onClearFilters={handleClearFilters}
                />

                <ManageFinancesTable
                    data={financesData}
                    isLoading={isLoading}
                    error={error as Error}
                    currentPage={filter.page}
                    onPageChange={handlePageChange}
                />
            </div>
        </>
    );
}

