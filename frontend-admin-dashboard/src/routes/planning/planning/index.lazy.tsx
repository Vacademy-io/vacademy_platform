import { createLazyFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useListPlanningLogs } from '../-services/listPlanningLogs';
import { Table as TableIcon, List } from 'lucide-react';
import PlanningLogsTable from '../-components/PlanningLogsTable';
import PlanningLogsTimeline from '../-components/PlanningLogsTimeline';
import PlanningFilters from '../-components/PlanningFilters';
import type { ListPlanningLogsRequest } from '../-types/types';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';
import { Route as PlanningRoute } from './index';

export const Route = createLazyFileRoute('/planning/planning/')({
    component: PlanningLogsList,
});

type ViewMode = 'table' | 'timeline';

function PlanningLogsList() {
    const { packageSessionId } = PlanningRoute.useSearch();
    const navigate = useNavigate();
    const [pageNo, setPageNo] = useState(0);
    const [pageSize] = useState(10);
    const [viewMode, setViewMode] = useState<ViewMode>('timeline');
    const [filters, setFilters] = useState<ListPlanningLogsRequest>({
        log_types: ['planning'], // Auto-filter by planning type
        statuses: ['ACTIVE'],
        ...(packageSessionId ? { entity_ids: [packageSessionId] } : {}),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchQuery, setSearchQuery] = useState('');
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(`Plannings`);
    }, [setNavHeading]);

    const { data, isLoading, error } = useListPlanningLogs({
        pageNo,
        pageSize,
        filters,
    });

    const handleFilterChange = (newFilters: ListPlanningLogsRequest) => {
        // Always maintain the planning log type filter
        setFilters({ ...newFilters, log_types: ['planning'] });
        setPageNo(0); // Reset to first page when filters change
    };

    const handlePageChange = (newPage: number) => {
        setPageNo(newPage);
    };

    const handleCreateClick = () => {
        navigate({ to: '/planning/planning/create' });
    };

    const toggleViewMode = () => {
        setViewMode((prev) => (prev === 'table' ? 'timeline' : 'table'));
    };

    return (
        <LayoutContainer>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Plannings</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleViewMode}
                            className="flex items-center gap-2"
                        >
                            {viewMode === 'table' ? (
                                <>
                                    <List className="size-4" />
                                    Timeline View
                                </>
                            ) : (
                                <>
                                    <TableIcon className="size-4" />
                                    Table View
                                </>
                            )}
                        </Button>
                        <MyButton onClick={handleCreateClick} className="flex items-center gap-2">
                            Create Planning
                        </MyButton>
                    </div>
                </div>

                <PlanningFilters
                    filters={filters}
                    onChange={handleFilterChange}
                    hideLogTypeFilter={true}
                    logType="planning"
                />

                {isLoading ? (
                    <div className="py-8 text-center">
                        <p className="text-muted-foreground">Loading plannings...</p>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center">
                        <p className="text-destructive">Failed to load plannings</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <PlanningLogsTable
                        data={data?.content || []}
                        totalPages={data?.totalPages || 0}
                        currentPage={pageNo}
                        onPageChange={handlePageChange}
                        searchQuery={searchQuery}
                        logType="planning"
                    />
                ) : (
                    <PlanningLogsTimeline
                        data={data?.content || []}
                        totalPages={data?.totalPages || 0}
                        currentPage={pageNo}
                        onPageChange={handlePageChange}
                        searchQuery={searchQuery}
                        logType="planning"
                    />
                )}
            </div>
        </LayoutContainer>
    );
}
