import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, MagnifyingGlass } from '@phosphor-icons/react';
import type {
    AdminActivityLog,
    AdminActivityLogPage,
} from '@/services/admin-activity-logs/getActivityLogs';

interface Props {
    page: AdminActivityLogPage | undefined;
    isLoading: boolean;
    isError: boolean;
    onRowClick: (log: AdminActivityLog) => void;
    onPageChange: (page: number) => void;
}

const ACTION_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    CREATE: 'default',
    UPDATE: 'secondary',
    DELETE: 'destructive',
    CANCEL: 'destructive',
    ENROLL: 'default',
};

const formatAbsoluteTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
};

const formatRelativeTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
};

// Patterns where we know the trailing portion is the entity name and should
// be bolded. The first capture group is the verb-and-noun prefix; the second
// is the name(s). Falls through to plain text if nothing matches — safe for
// descriptions that don't have a distinct named target (e.g. "deleted 3
// course(s)", "cancelled live session booking", "updated naming settings").
const NAMED_DESCRIPTION_PATTERNS: RegExp[] = [
    /^((?:created|updated|deleted) course )(.+)$/i,
    /^(created booking )(.+)$/i,
    /^(scheduled live session )(.+)$/i,
    /^((?:re-)?enrolled learner )(.+)$/i,
    /^(switched WhatsApp provider to )(.+)$/i,
    /^((?:updated|removed) WhatsApp credentials for )(.+)$/i,
];

const renderActivitySentence = (row: AdminActivityLog): React.ReactNode => {
    const description =
        row.description && row.description.trim().length > 0
            ? row.description
            : `${row.action.toLowerCase()}d a ${row.entity_type
                  .toLowerCase()
                  .replace(/_/g, ' ')}`;

    for (const re of NAMED_DESCRIPTION_PATTERNS) {
        const m = description.match(re);
        if (m) {
            return (
                <>
                    {m[1]}
                    <span className="font-semibold text-gray-900">{m[2]}</span>
                </>
            );
        }
    }
    return description;
};

const getActorLabel = (row: AdminActivityLog): string =>
    row.actor_name || row.actor_email || row.actor_id || 'Unknown user';

const statusTone = (status: number | null | undefined): string => {
    if (status == null) return 'bg-gray-300';
    if (status >= 200 && status < 300) return 'bg-emerald-500';
    if (status >= 400 && status < 500) return 'bg-amber-500';
    return 'bg-red-500';
};

export function ActivityLogTable({ page, isLoading, isError, onRowClick, onPageChange }: Props) {
    if (isError) {
        return (
            <Card className="border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">
                    Failed to load activity logs. Try refreshing.
                </p>
            </Card>
        );
    }

    const rows = page?.content ?? [];
    const currentPage = page?.number ?? 0;
    const totalPages = page?.totalPages ?? 0;
    const totalElements = page?.totalElements ?? 0;

    return (
        <TooltipProvider delayDuration={150}>
            <Card className="overflow-hidden border-gray-200 shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                            <TableHead className="w-40 pl-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                When
                            </TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Activity
                            </TableHead>
                            <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Action
                            </TableHead>
                            <TableHead className="w-28 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <Tooltip>
                                    <TooltipTrigger className="inline-flex items-center gap-1">
                                        Latency
                                        <Info className="size-3.5 text-gray-400" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                        API call wall-time on the server. Includes business
                                        logic + DB writes; excludes the audit-row write itself
                                        (~1–3 ms).
                                    </TooltipContent>
                                </Tooltip>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && rows.length === 0 ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <TableRow key={`skeleton-${i}`}>
                                    <TableCell colSpan={4} className="px-4">
                                        <Skeleton className="h-6 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-12">
                                    <EmptyState />
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={() => onRowClick(row)}
                                    className="cursor-pointer transition-colors hover:bg-gray-50"
                                >
                                    <TableCell className="pl-4 align-top">
                                        <Tooltip>
                                            <TooltipTrigger className="text-xs text-gray-600">
                                                {formatRelativeTime(row.created_at)}
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                {formatAbsoluteTime(row.created_at)}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex items-start gap-2">
                                            <span
                                                className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${statusTone(
                                                    row.response_status
                                                )}`}
                                                title={
                                                    row.response_status != null
                                                        ? `HTTP ${row.response_status}`
                                                        : ''
                                                }
                                            />
                                            <div className="text-sm text-gray-800">
                                                <span className="font-semibold text-gray-900">
                                                    {getActorLabel(row)}
                                                </span>{' '}
                                                {renderActivitySentence(row)}
                                                {row.actor_email &&
                                                    row.actor_name &&
                                                    row.actor_email !== row.actor_name && (
                                                        <div className="mt-0.5 text-xs text-gray-500">
                                                            {row.actor_email}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <Badge variant={ACTION_VARIANT[row.action] || 'outline'}>
                                            {row.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-4 align-top text-right text-xs tabular-nums text-gray-600">
                                        {row.response_time_ms != null
                                            ? `${row.response_time_ms} ms`
                                            : '—'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/30 px-4 py-2.5 text-xs text-gray-600">
                    <span>
                        {totalElements === 0
                            ? 'No results'
                            : `Page ${currentPage + 1} of ${totalPages} · ${totalElements.toLocaleString()} total`}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage <= 0 || isLoading}
                            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage + 1 >= totalPages || isLoading}
                            onClick={() => onPageChange(currentPage + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Card>
        </TooltipProvider>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center gap-2 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <MagnifyingGlass className="size-5" />
            </span>
            <p className="text-sm font-medium text-gray-700">No audit entries</p>
            <p className="text-xs text-gray-500">
                Nothing matches the current filters. Try clearing them or widen the date range.
            </p>
        </div>
    );
}
