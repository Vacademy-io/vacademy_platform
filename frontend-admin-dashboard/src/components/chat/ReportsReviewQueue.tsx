import { useEffect, useState, useCallback } from 'react';
import { Flag, Robot, SpinnerGap, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    listAdminReports,
    reviewReport,
    type ChatReportResponse,
    type ReportStatus,
} from '@/services/chat/chatApi';

const STATUS_FILTERS: { label: string; value?: ReportStatus }[] = [
    { label: 'Open', value: 'OPEN' },
    { label: 'Reviewing', value: 'REVIEWING' },
    { label: 'Actioned', value: 'ACTIONED' },
    { label: 'Dismissed', value: 'DISMISSED' },
    { label: 'All', value: undefined },
];

const PAGE_SIZE = 20;

const isSystemReason = (reason: string): boolean => {
    const r = reason.toUpperCase();
    return r.includes('SYSTEM') || r.includes('AUTO_MODERATION') || r.includes('AUTO');
};

const statusBadgeClass = (status: string): string => {
    switch (status.toUpperCase()) {
        case 'OPEN':
            return 'bg-warning-50 text-warning-600';
        case 'REVIEWING':
            return 'bg-info-50 text-info-600';
        case 'ACTIONED':
            return 'bg-danger-50 text-danger-600';
        case 'DISMISSED':
            return 'bg-neutral-100 text-neutral-500';
        default:
            return 'bg-neutral-100 text-neutral-500';
    }
};

const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString(undefined, {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
          });
};

export function ReportsReviewQueue() {
    const [status, setStatus] = useState<ReportStatus | undefined>('OPEN');
    const [reports, setReports] = useState<ChatReportResponse[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const load = useCallback(
        async (nextStatus: ReportStatus | undefined, nextPage: number) => {
            setIsLoading(true);
            setIsError(false);
            try {
                const res = await listAdminReports(nextStatus, nextPage, PAGE_SIZE);
                setReports(res.content);
                setTotalPages(res.totalPages);
            } catch {
                setIsError(true);
                setReports([]);
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        void load(status, page);
    }, [status, page, load]);

    const handleStatusFilter = (next?: ReportStatus) => {
        setPage(0);
        setStatus(next);
    };

    const handleReview = async (report: ChatReportResponse, nextStatus: ReportStatus) => {
        setUpdatingId(report.id);
        try {
            await reviewReport(report.id, nextStatus);
            toast.success(`Report marked ${nextStatus.toLowerCase()}.`);
            await load(status, page);
        } catch {
            toast.error('Failed to update the report.');
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="flex h-full flex-col bg-white">
            {/* Filters */}
            <div className="flex shrink-0 flex-wrap gap-2 border-b border-neutral-200 px-4 py-3">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f.label}
                        type="button"
                        onClick={() => handleStatusFilter(f.value)}
                        className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            status === f.value
                                ? 'border-primary-500 bg-primary-50 text-primary-600'
                                : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <SpinnerGap size={24} className="animate-spin text-primary-500" />
                    </div>
                )}

                {!isLoading && isError && (
                    <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
                        <Warning size={20} className="text-danger-500" />
                        <span className="text-sm text-danger-700">
                            Could not load reports. Please try again.
                        </span>
                    </div>
                )}

                {!isLoading && !isError && reports.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Flag size={36} weight="duotone" className="mb-3 text-neutral-300" />
                        <p className="text-sm text-neutral-500">No reports in this view.</p>
                    </div>
                )}

                {!isLoading &&
                    !isError &&
                    reports.map((report) => {
                        const system = isSystemReason(report.reason);
                        return (
                            <div
                                key={report.id}
                                className="mb-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                            >
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        {system ? (
                                            <Robot
                                                size={16}
                                                weight="duotone"
                                                className="text-warning-500"
                                            />
                                        ) : (
                                            <Flag
                                                size={16}
                                                weight="duotone"
                                                className="text-danger-500"
                                            />
                                        )}
                                        <span className="text-sm font-medium text-neutral-700">
                                            {report.reason}
                                        </span>
                                        {system && (
                                            <span className="rounded-full bg-warning-50 px-2 py-0.5 text-caption font-semibold uppercase text-warning-600">
                                                Auto
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-caption font-semibold uppercase',
                                            statusBadgeClass(report.status)
                                        )}
                                    >
                                        {report.status}
                                    </span>
                                </div>

                                {report.details && (
                                    <p className="mb-2 text-xs text-neutral-500">{report.details}</p>
                                )}

                                {report.reportedMessage?.content && (
                                    <div className="mb-2 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
                                        <div className="mb-1 text-caption font-medium text-neutral-500">
                                            {report.reportedMessage.senderName ||
                                                report.reportedMessage.senderRole ||
                                                'Message'}
                                        </div>
                                        <div className="whitespace-pre-wrap break-words text-sm text-neutral-700">
                                            {report.reportedMessage.content}
                                        </div>
                                    </div>
                                )}

                                {report.reportedMessage?.attachmentUrl && (
                                    <a
                                        href={report.reportedMessage.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mb-2 inline-block"
                                    >
                                        <img
                                            src={report.reportedMessage.attachmentUrl}
                                            alt="reported attachment"
                                            className="max-h-40 rounded-md object-cover"
                                        />
                                    </a>
                                )}

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-caption text-neutral-400">
                                        Reporter: {report.reporterId.slice(0, 8)}… ·{' '}
                                        {formatDate(report.createdAt)}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {report.status.toUpperCase() !== 'REVIEWING' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={updatingId === report.id}
                                                onClick={() => handleReview(report, 'REVIEWING')}
                                                className="h-7 px-2 text-xs"
                                            >
                                                Mark reviewing
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={updatingId === report.id}
                                            onClick={() => handleReview(report, 'DISMISSED')}
                                            className="h-7 px-2 text-xs"
                                        >
                                            Dismiss
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={updatingId === report.id}
                                            onClick={() => handleReview(report, 'ACTIONED')}
                                            className="h-7 bg-danger-500 px-2 text-xs hover:bg-danger-600"
                                        >
                                            {updatingId === report.id ? (
                                                <SpinnerGap size={13} className="animate-spin" />
                                            ) : (
                                                'Action'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Pagination */}
            {!isLoading && !isError && totalPages > 1 && (
                <div className="flex shrink-0 items-center justify-center gap-3 border-t border-neutral-200 py-3">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="text-xs text-neutral-500">
                        Page {page + 1} of {totalPages}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
