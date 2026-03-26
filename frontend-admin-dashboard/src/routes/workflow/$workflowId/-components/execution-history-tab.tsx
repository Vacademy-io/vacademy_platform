import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getExecutionSummaryQuery } from '@/services/workflow-service';
import { ExecutionSummaryCards } from './execution-summary-cards';
import { ExecutionDetailDrawer } from './execution-detail-drawer';
import { CaretLeft, CaretRight, FunnelSimple } from '@phosphor-icons/react';
import { BASE_URL } from '@/constants/urls';

interface ExecutionRow {
    id: string;
    idempotency_key: string;
    status: string;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    workflow_id: string;
    workflow_name: string;
    workflow_schedule_id?: string;
}

interface Props {
    workflowId: string;
    instituteId: string;
    onViewOnDiagram?: (executionId: string) => void;
}

const STATUS_FILTERS = ['ALL', 'COMPLETED', 'FAILED', 'PROCESSING', 'PENDING'] as const;

const statusBadgeColor: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
};

export function ExecutionHistoryTab({ workflowId, instituteId, onViewOnDiagram }: Props) {
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [page, setPage] = useState(0);
    const pageSize = 10;

    // Date range: default last 7 days
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 16);
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 16));

    const startIso = startDate ? new Date(startDate).toISOString() : undefined;
    const endIso = endDate ? new Date(endDate).toISOString() : undefined;

    // Fetch execution list
    const { data: executionData, isLoading } = useQuery({
        queryKey: ['WORKFLOW_EXECUTIONS', workflowId, statusFilter, startIso, endIso, page],
        queryFn: async () => {
            const body: Record<string, unknown> = {
                institute_id: instituteId,
                workflow_ids: [workflowId],
                sort_columns: { startedAt: 'desc' },
            };
            if (statusFilter !== 'ALL') body.statuses = [statusFilter];
            if (startIso) body.start_date = startIso;
            if (endIso) body.end_date = endIso;

            const resp = await authenticatedAxiosInstance.post(
                `${BASE_URL}/admin-core-service/v1/workflow-execution/list?pageNo=${page}&pageSize=${pageSize}`,
                body
            );
            return resp.data as {
                content: ExecutionRow[];
                total_elements: number;
                total_pages: number;
                page_number: number;
            };
        },
        staleTime: 30_000,
    });

    // Fetch summary
    const { data: summary } = useQuery(
        getExecutionSummaryQuery(workflowId, startIso, endIso)
    );

    // Drawer state
    const [selectedExecution, setSelectedExecution] = useState<ExecutionRow | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Reset page when filter changes
    useEffect(() => setPage(0), [statusFilter, startDate, endDate]);

    const executions = executionData?.content ?? [];
    const totalPages = executionData?.total_pages ?? 0;

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            {summary && <ExecutionSummaryCards summary={summary} />}

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
                <FunnelSimple size={16} className="text-muted-foreground" />
                {STATUS_FILTERS.map((s) => (
                    <Button
                        key={s}
                        variant={statusFilter === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(s)}
                        className="h-7 text-xs"
                    >
                        {s}
                    </Button>
                ))}
                <div className="flex-1" />
                <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-7 text-xs border rounded px-2"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-7 text-xs border rounded px-2"
                />
            </div>

            {/* Execution table */}
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2 font-medium">Started</th>
                            <th className="text-left px-4 py-2 font-medium">Completed</th>
                            <th className="text-left px-4 py-2 font-medium">Status</th>
                            <th className="text-left px-4 py-2 font-medium">Duration</th>
                            <th className="text-left px-4 py-2 font-medium">Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                    Loading...
                                </td>
                            </tr>
                        ) : executions.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                    No executions found
                                </td>
                            </tr>
                        ) : (
                            executions.map((ex) => {
                                const duration =
                                    ex.started_at && ex.completed_at
                                        ? new Date(ex.completed_at).getTime() - new Date(ex.started_at).getTime()
                                        : null;
                                return (
                                    <tr
                                        key={ex.id}
                                        className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                                        onClick={() => {
                                            setSelectedExecution(ex);
                                            setDrawerOpen(true);
                                        }}
                                    >
                                        <td className="px-4 py-2 text-xs">
                                            {ex.started_at ? new Date(ex.started_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-xs">
                                            {ex.completed_at ? new Date(ex.completed_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <Badge className={`${statusBadgeColor[ex.status] ?? 'bg-gray-100'} text-[10px]`}>
                                                {ex.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-2 text-xs">
                                            {duration !== null
                                                ? duration < 1000
                                                    ? `${duration}ms`
                                                    : `${(duration / 1000).toFixed(1)}s`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-red-600 truncate max-w-[200px]">
                                            {ex.error_message ?? ''}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        Page {page + 1} of {totalPages} ({executionData?.total_elements ?? 0} total)
                    </span>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                            <CaretLeft size={14} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                        >
                            <CaretRight size={14} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Detail drawer */}
            <ExecutionDetailDrawer
                execution={selectedExecution}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                onViewOnDiagram={onViewOnDiagram}
            />
        </div>
    );
}
