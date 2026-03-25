import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useListPlanningLogs } from '../-services/listPlanningLogs';
import { Filter, Table as TableIcon, List } from 'lucide-react';
import PlanningLogsTable from '../-components/PlanningLogsTable';
import PlanningLogsTimeline from '../-components/PlanningLogsTimeline';
import PlanningFilters from '../-components/PlanningFilters';
import type { ListPlanningLogsRequest } from '../-types/types';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';

const routeApi = getRouteApi('/planning/activity-logs/');

export const Route = createLazyFileRoute('/planning/activity-logs/')({
    component: ActivityLogsList,
});

type ViewMode = 'table' | 'timeline';

function ActivityLogsList() {
    const { packageSessionId } = routeApi.useSearch();
    const navigate = useNavigate();
    const [pageNo, setPageNo] = useState(0);
    const [pageSize] = useState(10);
    const [viewMode, setViewMode] = useState<ViewMode>('timeline');
    const [filters, setFilters] = useState<ListPlanningLogsRequest>({
        log_types: ['diary_log'], // Auto-filter by diary_log type,
        interval_types: ['daily'],
        statuses: ['ACTIVE'],
        ...(packageSessionId ? { entity_ids: [packageSessionId] } : {}),
    });
    const [searchQuery, setSearchQuery] = useState('');
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(`Activity Logs`);
    }, [setNavHeading]);

    const { data, isLoading, error } = useListPlanningLogs({
        pageNo,
        pageSize,
        filters,
    });

    const handleFilterChange = (newFilters: ListPlanningLogsRequest) => {
        // Always maintain the diary_log type filter and daily interval
        setFilters({ ...newFilters, log_types: ['diary_log'], interval_types: ['daily'] });
        setPageNo(0); // Reset to first page when filters change
    };

    const handlePageChange = (newPage: number) => {
        setPageNo(newPage);
    };

    const handleCreateClick = () => {
        navigate({ to: '/planning/activity-logs/create' });
    };

    const toggleViewMode = () => {
        setViewMode((prev) => (prev === 'table' ? 'timeline' : 'table'));
    };

    return (
        <LayoutContainer>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Activity Logs</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleViewMode}
                            className="flex items-center gap-2"
                        >
                            {viewMode === 'table' ? (
                                <>
                                    <List className="h-4 w-4" />
                                    Timeline View
                                </>
                            ) : (
                                <>
                                    <TableIcon className="h-4 w-4" />
                                    Table View
                                </>
                            )}
                        </Button>
                        <MyButton onClick={handleCreateClick} className="flex items-center gap-2">
                            Create Activity Log
                        </MyButton>
                    </div>
                </div>

                <PlanningFilters
                    filters={filters}
                    onChange={handleFilterChange}
                    hideLogTypeFilter={true}
                    logType="diary_log"
                />

                {isLoading ? (
                    <div className="py-8 text-center">
                        <p className="text-muted-foreground">Loading activity logs...</p>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center">
                        <p className="text-destructive">Failed to load activity logs</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <PlanningLogsTable
                        data={data?.content || []}
                        totalPages={data?.totalPages || 0}
                        currentPage={pageNo}
                        onPageChange={handlePageChange}
                        searchQuery={searchQuery}
                        logType="diary_log"
                    />
                ) : (
                    <PlanningLogsTimeline
                        data={data?.content || []}
                        totalPages={data?.totalPages || 0}
                        currentPage={pageNo}
                        onPageChange={handlePageChange}
                        searchQuery={searchQuery}
                        logType="diary_log"
                    />
                )}
            </div>
        </LayoutContainer>
    );
}
