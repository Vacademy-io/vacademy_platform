import { useEffect, useState, useRef } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader, ErrorBoundary } from '@/components/core/dashboard-loader';
import RootErrorComponent from '@/components/core/deafult-error';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Package } from '@phosphor-icons/react';
import { usePackageFilters } from '../-hooks/usePackageFilters';
import { usePackageTable, useBatchesSummary } from '../-hooks/usePackageTable';
import { PackageFilters } from './package-filters';
import { getPackageTableColumns, PACKAGE_TABLE_COLUMN_WIDTHS } from './package-table';
import { PackageSessionSidebar } from './package-session-sidebar';
import { PackageSessionDTO } from '../-types/package-types';

export function PackageManagementSection() {
    const { setNavHeading } = useNavHeadingStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<{ id: string; name: string } | null>(
        null
    );
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Package Management</h1>);
    }, [setNavHeading]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                tableRef.current &&
                !tableRef.current.contains(event.target as Node) &&
                isSidebarOpen
            ) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const {
        columnFilters,
        appliedFilters,
        clearFilters,
        searchInput,
        searchFilter,
        page,
        getActiveFiltersState,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        handlePageChange,
        handleSort,
    } = usePackageFilters();

    const { packageData, isLoading, error } = usePackageTable(appliedFilters);
    const { summaryData, isLoading: summaryLoading } = useBatchesSummary(appliedFilters.statuses);

    const handlePackageClick = (packageInfo: { id: string; name: string }) => {
        setSelectedPackage(packageInfo);
        setIsSidebarOpen(true);
    };

    const columns = getPackageTableColumns({ onPackageClick: handlePackageClick });

    if (error) return <RootErrorComponent />;

    const EmptyState = () => (
        <div className="animate-fadeIn flex flex-col items-center justify-center px-3 py-8 text-center">
            <div className="mb-3 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 p-3 shadow-inner">
                <Package className="size-12 opacity-50" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-neutral-700">No Packages Found</h3>
            <p className="mb-4 max-w-md text-xs leading-relaxed text-neutral-500">
                No packages match your current filters. Try adjusting your search criteria.
            </p>
            <button
                onClick={handleClearFilters}
                className="group flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 transition-all duration-200 hover:scale-105 hover:bg-neutral-200"
            >
                Clear Filters
            </button>
        </div>
    );

    return (
        <ErrorBoundary>
            <section className="animate-fadeIn flex max-w-full flex-col gap-3 overflow-visible">
                <div className="flex flex-col gap-3">
                    <PackageFilters
                        summaryData={summaryData}
                        searchInput={searchInput}
                        searchFilter={searchFilter}
                        columnFilters={columnFilters}
                        clearFilters={clearFilters}
                        appliedFilters={appliedFilters}
                        totalElements={packageData?.total_elements || 0}
                        getActiveFiltersState={getActiveFiltersState}
                        onSearchChange={handleSearchInputChange}
                        onSearchEnter={handleSearchEnter}
                        onClearSearch={handleClearSearch}
                        onFilterChange={handleFilterChange}
                        onFilterClick={handleFilterClick}
                        onClearFilters={handleClearFilters}
                        onSort={handleSort}
                    />

                    {isLoading || summaryLoading ? (
                        <div className="flex w-full flex-col items-center gap-2 py-6">
                            <DashboardLoader />
                            <p className="animate-pulse text-xs text-neutral-500">
                                Loading packages...
                            </p>
                        </div>
                    ) : !packageData || packageData.content.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="animate-slideInRight flex flex-col gap-2">
                            <div className="overflow-hidden rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 shadow-sm">
                                <div className="max-w-full" ref={tableRef}>
                                    <SidebarProvider
                                        style={{ ['--sidebar-width' as string]: '450px' }}
                                        defaultOpen={false}
                                        open={isSidebarOpen}
                                        onOpenChange={setIsSidebarOpen}
                                    >
                                        <MyTable<PackageSessionDTO>
                                            data={{
                                                content: packageData.content,
                                                total_pages: packageData.total_pages,
                                                page_no: packageData.page_number,
                                                page_size: packageData.page_size,
                                                total_elements: packageData.total_elements,
                                                last: packageData.last,
                                            }}
                                            columns={columns}
                                            isLoading={isLoading}
                                            error={error}
                                            columnWidths={PACKAGE_TABLE_COLUMN_WIDTHS}
                                            currentPage={page}
                                        />
                                        <PackageSessionSidebar selectedPackage={selectedPackage} />
                                    </SidebarProvider>
                                </div>
                            </div>

                            <div className="flex flex-col justify-between gap-2 rounded-lg border border-neutral-200/50 bg-gradient-to-r from-neutral-50/50 to-white px-3 py-2 lg:flex-row lg:items-center">
                                <div className="text-sm text-neutral-500">
                                    Showing {packageData.page_size * packageData.page_number + 1} -{' '}
                                    {Math.min(
                                        packageData.page_size * (packageData.page_number + 1),
                                        packageData.total_elements
                                    )}{' '}
                                    of {packageData.total_elements} packages
                                </div>
                                <div className="flex justify-center lg:justify-end">
                                    <MyPagination
                                        currentPage={page}
                                        totalPages={packageData.total_pages}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </ErrorBoundary>
    );
}
