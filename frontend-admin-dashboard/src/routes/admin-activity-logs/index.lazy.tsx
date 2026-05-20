import { createLazyFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Notebook } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import {
    useActivityLogs,
    type AdminActivityLog,
} from '@/services/admin-activity-logs/getActivityLogs';
import { ActivityLogFilters } from './-components/ActivityLogFilters';
import { ActivityLogTable } from './-components/ActivityLogTable';
import { PayloadDrawer } from './-components/PayloadDrawer';

export const Route = createLazyFileRoute('/admin-activity-logs/')({
    component: AdminActivityLogsPage,
});

function AdminActivityLogsPage() {
    return (
        <LayoutContainer>
            <AdminActivityLogsView />
        </LayoutContainer>
    );
}

function AdminActivityLogsView() {
    const { setNavHeading } = useNavHeadingStore();
    const search = useSearch({ from: '/admin-activity-logs/' });
    const navigate = useNavigate({ from: '/admin-activity-logs/' });
    const [selectedLog, setSelectedLog] = useState<AdminActivityLog | null>(null);

    useEffect(() => {
        setNavHeading(<h1 className="text-md font-medium">Admin Activity Logs</h1>);
    }, [setNavHeading]);

    const filters = useMemo(
        () => ({
            page: search.page ?? 0,
            size: search.size ?? 20,
            entityType: search.entityType,
            action: search.action,
            actorId: search.actorId,
            startDate: search.startDate,
            endDate: search.endDate,
        }),
        [search]
    );

    const { data, isLoading, isFetching, isError, refetch } = useActivityLogs(filters);

    const updateSearch = (next: Partial<typeof search>) => {
        navigate({
            search: (prev) => ({ ...prev, ...next, page: next.page ?? 0 }),
            replace: true,
        });
    };

    return (
        <>
            <Helmet>
                <title>Admin Activity Logs</title>
                <meta
                    name="description"
                    content="Audit trail of administrative actions across the institute."
                />
            </Helmet>

            {/* Page header */}
            <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                        <Notebook className="size-5" weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
                            Admin Activity Logs
                        </h1>
                        <p className="mt-0.5 text-sm text-gray-600">
                            Forensic record of admin actions — who did what, when, and on which
                            resource.
                        </p>
                    </div>
                </div>
                {data?.totalElements != null && (
                    <div className="mt-2 text-xs text-gray-500 sm:mt-0">
                        {data.totalElements.toLocaleString()} total{' '}
                        {data.totalElements === 1 ? 'entry' : 'entries'}
                    </div>
                )}
            </header>

            <ActivityLogFilters
                value={filters}
                onChange={updateSearch}
                onRefresh={() => refetch()}
                isFetching={isFetching}
            />

            <div className="mt-4">
                <ActivityLogTable
                    page={data}
                    isLoading={isLoading}
                    isError={isError}
                    onRowClick={setSelectedLog}
                    onPageChange={(page) => updateSearch({ page })}
                />
            </div>

            <PayloadDrawer
                log={selectedLog}
                open={!!selectedLog}
                onClose={() => setSelectedLog(null)}
            />
        </>
    );
}
