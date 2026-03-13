import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Coins, WarningCircle, Receipt, Users } from '@phosphor-icons/react';
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

// Helper to format large currency values
const formatCurrencyShort = (val: number | undefined) => {
    if (val === undefined || val === null) return '₹ 0';
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} L`;
    return `₹ ${val.toLocaleString('en-IN')}`;
};

function ManageFinancesLayoutPage() {
    const { setNavHeading } = useNavHeadingStore();

    const [filter, setFilter] = useState<FeeSearchFilterDTO>({
        page: 0,
        size: 20,
        sortBy: 'studentName',
        sortDirection: 'ASC',
        filters: {},
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
        setFilter((prev) => ({ ...prev, page }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearFilters = () => {
        setFilter((prev) => ({
            ...prev,
            page: 0,
            filters: {},
        }));
    };

    // Derive pagination info from response (handle both camel/snake)
    const d = financesData as any;
    const totalRecords = d?.totalElements ?? d?.total_elements ?? 0;
    const totalPages = d?.totalPages ?? d?.total_pages ?? 0;
    const pageNumber = d?.number ?? d?.page_no ?? 0;
    const pageSize = d?.size ?? d?.page_size ?? 0;

    return (
        <>
            <Helmet>
                <title>Manage Finances</title>
                <meta
                    name="description"
                    content="Manage transaction history and student fee payments"
                />
            </Helmet>

            <div className="flex flex-col gap-6 p-6 animate-in fade-in duration-300 w-full max-w-[1400px] mx-auto">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        {
                            title: 'Total Records',
                            value: totalRecords.toLocaleString(),
                            icon: Users,
                            bgColor: 'bg-blue-50',
                            iconColor: 'text-blue-600',
                            borderColor: 'border-blue-100',
                        },
                        {
                            title: 'Current Page',
                            value: totalPages > 0 ? `${pageNumber + 1} of ${totalPages}` : '—',
                            icon: Receipt,
                            bgColor: 'bg-purple-50',
                            iconColor: 'text-purple-600',
                            borderColor: 'border-purple-100',
                        },
                        {
                            title: 'Page Size',
                            value: pageSize.toString(),
                            icon: CreditCard,
                            bgColor: 'bg-orange-50',
                            iconColor: 'text-orange-500',
                            borderColor: 'border-orange-100',
                        },
                        {
                            title: 'Filters Active',
                            value: Object.values(filter.filters).filter(
                                (v) =>
                                    v !== undefined &&
                                    v !== '' &&
                                    !(Array.isArray(v) && v.length === 0)
                            ).length.toString(),
                            icon: WarningCircle,
                            bgColor: 'bg-green-50',
                            iconColor: 'text-green-600',
                            borderColor: 'border-green-100',
                        },
                    ].map((card, idx) => (
                        <div
                            key={idx}
                            className={`bg-white border ${card.borderColor} rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden transition hover:shadow-md`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    {card.title}
                                </span>
                                <div
                                    className={`p-1.5 bg-gray-50/50 rounded-full ${card.iconColor}`}
                                >
                                    <card.icon size={18} weight="duotone" />
                                </div>
                            </div>
                            <div className="text-xl font-extrabold text-gray-800 mt-1">
                                {card.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <ManageFinancesFilters
                    filter={filter}
                    onFilterChange={setFilter}
                    onClearFilters={handleClearFilters}
                />

                {/* Table */}
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
