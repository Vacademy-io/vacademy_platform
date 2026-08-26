/**
 * Call Queue — this institute's own AI calls waiting to go out.
 *
 * AI calls do not all dial at once: a bulk campaign or a workflow burst queues, and
 * calls leave the queue as capacity frees up. This page is where that becomes
 * visible — how many are waiting, roughly how long they will take, which are on a
 * call right now, and what can be called off.
 *
 * <b>No capacity figures are shown.</b> How many simultaneous lines exist, and how
 * many this institute may hold, are internal operating facts; the API does not return
 * them to an institute and this page must not imply them. The wait is expressed as
 * time, which is the part that concerns the person reading it.
 *
 * Institute-scoped end to end — every endpoint behind it validates the caller against
 * the institute server-side.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowsClockwise, Prohibit, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
    cancelAllQueued,
    cancelQueuedItem,
    fetchQueueItems,
    fetchQueueSummary,
    type QueueFilter,
    type QueueItem,
    type QueueStatus,
} from '../-services/ai-call-queue-service';

/** Poll cadence. The drainer ticks every 2s server-side; this is a human-facing view. */
const REFETCH_MS = 10_000;
const PAGE_SIZE = 25;

const STATUS_FILTERS: Array<{ key: QueueFilter; label: string }> = [
    { key: 'QUEUED', label: 'Waiting' },
    // Distinct from Dialled on purpose: a queue row reads DIALED from the instant the
    // provider accepts it until the end of time, so "Dialled" alone mixes a call that is
    // talking right now with one that ended this morning.
    { key: 'LIVE', label: 'On call now' },
    { key: 'DIALED', label: 'Dialled' },
    { key: 'FAILED', label: 'Failed' },
    { key: 'EXPIRED', label: 'Expired' },
    { key: 'CANCELLED', label: 'Cancelled' },
    { key: '', label: 'All' },
];

export default function CallQueuePanel({ instituteId }: { instituteId: string }) {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<QueueFilter>('QUEUED');
    const [page, setPage] = useState(0);

    const summaryQuery = useQuery({
        queryKey: ['ai-call-queue-summary', instituteId],
        queryFn: () => fetchQueueSummary(instituteId),
        enabled: !!instituteId,
        refetchInterval: REFETCH_MS,
    });

    const itemsQuery = useQuery({
        queryKey: ['ai-call-queue-items', instituteId, status, page],
        queryFn: () => fetchQueueItems({ instituteId, status, page, size: PAGE_SIZE }),
        enabled: !!instituteId,
        refetchInterval: REFETCH_MS,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['ai-call-queue-summary', instituteId] });
        queryClient.invalidateQueries({ queryKey: ['ai-call-queue-items', instituteId] });
    };

    const cancelAll = useMutation({
        mutationFn: () => cancelAllQueued(instituteId, 'Cancelled from the call queue'),
        onSuccess: (r) => {
            toast.success(`${r.cancelled} queued call${r.cancelled === 1 ? '' : 's'} cancelled`);
            invalidate();
        },
        onError: () => toast.error('Could not cancel the queue'),
    });

    const cancelOne = useMutation({
        mutationFn: (id: string) =>
            cancelQueuedItem(instituteId, id, 'Cancelled from the call queue'),
        onSuccess: (r) => {
            // A false here is not a failure: the call started dialling between the
            // render and the click, and there is nothing left to take back.
            if (r.cancelled) {
                toast.success('Call removed from the queue');
            } else {
                toast.info('That call has already gone out');
            }
            invalidate();
        },
        onError: () => toast.error('Could not cancel that call'),
    });

    const summary = summaryQuery.data;
    const rows = itemsQuery.data?.content ?? [];
    const totalPages = itemsQuery.data?.totalPages ?? 0;

    return (
        <div className="flex flex-col gap-4">
            {/* Depth, what is live, and the honest wait. Deliberately no capacity
                figures and no "x of y" — the size of the calling pool is internal, and
                a denominator here would disclose it. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                    label="Waiting"
                    value={summary ? String(summary.queued) : '—'}
                    hint="calls queued"
                />
                <StatCard
                    label="On a call now"
                    value={summary ? String(summary.inFlight) : '—'}
                    hint="calls in progress"
                />
                <StatCard
                    label="Clears in"
                    value={summary ? formatEta(summary.etaMinutes) : '—'}
                    hint="estimated"
                />
            </div>

            {summary?.paused && (
                <div className="flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
                    <Warning size={16} weight="fill" />
                    Calling is paused for this institute — queued calls are held until it is
                    resumed.
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.key || 'ALL'}
                            type="button"
                            onClick={() => {
                                setStatus(f.key);
                                setPage(0);
                            }}
                            className={cn(
                                'rounded px-2.5 py-1 text-xs',
                                status === f.key
                                    ? 'bg-primary-500 text-white'
                                    : 'text-neutral-600 hover:bg-neutral-50'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => invalidate()}
                        disabled={itemsQuery.isFetching}
                    >
                        <ArrowsClockwise
                            size={14}
                            className={cn(itemsQuery.isFetching && 'animate-spin')}
                        />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-danger-600"
                        disabled={!summary?.queued || cancelAll.isPending}
                        onClick={() => cancelAll.mutate()}
                    >
                        <Prohibit size={14} />
                        Cancel all waiting
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">#</TableHead>
                            <TableHead>Lead</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Queued by</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Waits</TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {itemsQuery.isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-10 text-center text-sm text-neutral-500"
                                >
                                    Loading the queue…
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-10 text-center text-sm text-neutral-500"
                                >
                                    {status === 'QUEUED'
                                        ? 'Nothing is waiting — AI calls are going out as they are requested.'
                                        : status === 'LIVE'
                                          ? 'No AI calls are on a line right now.'
                                          : 'No calls in this state.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((item) => (
                                <QueueRow
                                    key={item.id}
                                    item={item}
                                    onCancel={() => cancelOne.mutate(item.id)}
                                    cancelling={cancelOne.isPending}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="text-xs text-neutral-600">
                        Page {page + 1} of {totalPages}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page + 1 >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}

function QueueRow({
    item,
    onCancel,
    cancelling,
}: {
    item: QueueItem;
    onCancel: () => void;
    cancelling: boolean;
}) {
    const waiting = item.status === 'QUEUED';
    return (
        <TableRow>
            {/* Position is per LANE, not per page — an institute drains at its own rate
                regardless of what other institutes have queued. */}
            <TableCell className="text-sm text-neutral-500">
                {waiting && item.aheadInLane != null ? item.aheadInLane + 1 : '—'}
            </TableCell>
            <TableCell className="text-sm text-neutral-900">
                {item.phoneNumber || item.userId || '—'}
            </TableCell>
            <TableCell className="text-sm text-neutral-700">{item.agentName || '—'}</TableCell>
            <TableCell className="text-sm text-neutral-600">{sourceLabel(item)}</TableCell>
            <TableCell>
                <div className="flex flex-col gap-0.5">
                    {/* A live call gets its OWN badge rather than the queue's DIALED,
                        which would otherwise read the same as a call that ended hours ago. */}
                    {item.live ? (
                        <Badge
                            variant="outline"
                            className="w-fit border-0 bg-success-50 text-xs text-success-600"
                        >
                            <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-success-500" />
                            On call
                            {item.callDurationSeconds
                                ? ` · ${formatDuration(item.callDurationSeconds)}`
                                : ''}
                        </Badge>
                    ) : (
                        <StatusBadge status={item.status} />
                    )}
                    {item.statusReason && (
                        <span className="text-xs text-neutral-500">{item.statusReason}</span>
                    )}
                    {/* The call's own outcome, which the queue row never records. */}
                    {!item.live && item.callStatus && item.status === 'DIALED' && (
                        <span className="text-xs text-neutral-500">
                            {prettyCallStatus(item.callStatus)}
                            {item.callDurationSeconds
                                ? ` · ${formatDuration(item.callDurationSeconds)}`
                                : ''}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-sm text-neutral-600">
                {waiting && item.etaMinutes != null ? formatEta(item.etaMinutes) : '—'}
            </TableCell>
            <TableCell>
                {waiting && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger-600"
                        disabled={cancelling}
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="text-xs text-neutral-600">{label}</div>
            <div className="mt-1 text-xl font-semibold text-neutral-900">{value}</div>
            <div className="text-xs text-neutral-500">{hint}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: QueueStatus }) {
    const tone: Record<QueueStatus, string> = {
        QUEUED: 'bg-primary-50 text-primary-600',
        DISPATCHING: 'bg-primary-50 text-primary-600',
        DIALED: 'bg-success-50 text-success-600',
        FAILED: 'bg-danger-50 text-danger-600',
        EXPIRED: 'bg-warning-50 text-warning-700',
        CANCELLED: 'bg-neutral-100 text-neutral-600',
    };
    const label: Record<QueueStatus, string> = {
        QUEUED: 'Waiting',
        DISPATCHING: 'Connecting',
        DIALED: 'Dialled',
        FAILED: 'Failed',
        EXPIRED: 'Expired',
        CANCELLED: 'Cancelled',
    };
    return (
        <Badge variant="outline" className={cn('w-fit border-0 text-xs', tone[status])}>
            {label[status]}
        </Badge>
    );
}

/** Where the call came from, in the words an admin would use. */
function sourceLabel(item: QueueItem): string {
    switch (item.source) {
        case 'MANUAL':
            return 'Manual click';
        case 'BULK':
            return 'Bulk campaign';
        case 'WORKFLOW':
            return 'Automation';
        default:
            return item.source || '—';
    }
}

/** Call length, as a person would read it off a phone. */
function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/** The call log's own status vocabulary, softened for a queue screen. */
function prettyCallStatus(status: string): string {
    switch (status) {
        case 'COMPLETED':
            return 'Completed';
        case 'NO_ANSWER':
            return 'No answer';
        case 'BUSY':
            return 'Busy';
        case 'FAILED':
            return 'Call failed';
        case 'CANCELLED':
            return 'Cancelled';
        default:
            return status;
    }
}

/** "2h 40m" reads better than "160 minutes" on a queue that runs for hours. */
function formatEta(minutes?: number | null): string {
    if (minutes == null) return '—';
    if (minutes <= 0) return 'Next up';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
