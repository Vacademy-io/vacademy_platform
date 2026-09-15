import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { CaretLeft, CaretRight, DownloadSimple } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { downloadItemTrackingCsv, getItemTracking } from '../-services/engagement-service';
import type { EngagementItemDTO, EngagementTrackingRow } from '../-types/types';

const PAGE_SIZE = 20;

/**
 * Who did what on one task.
 *
 * Learner names are hydrated server-side from auth_service; when that lookup fails
 * the row falls back to a shortened id rather than showing nothing, so the table is
 * still usable.
 */
export function ItemTrackingDialog({
    item,
    open,
    onOpenChange,
}: {
    item: EngagementItemDTO | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [page, setPage] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setPage(0);
            setExportError(null);
        }
    }, [open, item?.id]);

    const { data, isFetching } = useQuery({
        queryKey: ['engagement-item-tracking', item?.id, page],
        queryFn: () => getItemTracking(item!.id, page, PAGE_SIZE),
        enabled: open && Boolean(item?.id),
        placeholderData: keepPreviousData,
    });

    const gradable = item?.itemType === 'QUESTION_OF_DAY' || item?.itemType === 'QUIZ';
    const accuracy =
        data && data.completedCount > 0
            ? Math.round((data.correctCount / data.completedCount) * 100)
            : null;
    const totalPages = data?.totalPages ?? 1;

    async function handleExport() {
        if (!item) return;
        setExporting(true);
        setExportError(null);
        try {
            await downloadItemTrackingCsv(item.id, item.title);
        } catch {
            setExportError('Could not build the export just now.');
        } finally {
            setExporting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="truncate text-start">
                        {item?.title ?? 'Task'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3">
                            <Stat label="Completed" value={String(data?.completedCount ?? 0)} />
                            {gradable && (
                                <Stat label="Correct" value={String(data?.correctCount ?? 0)} />
                            )}
                            {gradable && accuracy !== null && (
                                <Stat label="Accuracy" value={`${accuracy}%`} />
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={exporting || (data?.totalRows ?? 0) === 0}
                            onClick={handleExport}
                        >
                            <DownloadSimple size={16} />
                            {exporting ? 'Preparing…' : 'Export CSV'}
                        </Button>
                    </div>

                    {exportError && (
                        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
                            {exportError}
                        </p>
                    )}

                    {(data?.totalRows ?? 0) === 0 && !isFetching ? (
                        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                            Nobody has attempted this yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-neutral-200">
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                                    <tr>
                                        <th className="px-3 py-2 text-start">Learner</th>
                                        <th className="px-3 py-2 text-start">Username</th>
                                        <th className="px-3 py-2 text-start">Status</th>
                                        {gradable && (
                                            <th className="px-3 py-2 text-start">Result</th>
                                        )}
                                        <th className="px-3 py-2 text-start">Points</th>
                                        <th className="px-3 py-2 text-start">Time</th>
                                        <th className="px-3 py-2 text-start">Completed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {(data?.rows ?? []).map((row) => (
                                        <TrackingRow
                                            key={row.userId}
                                            row={row}
                                            gradable={gradable}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-neutral-500">
                        <span>
                            {data?.totalRows ?? 0} learner
                            {(data?.totalRows ?? 0) === 1 ? '' : 's'}
                            {isFetching ? ' · loading…' : ''}
                        </span>
                        {totalPages > 1 && (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 0}
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                >
                                    <CaretLeft size={14} />
                                </Button>
                                <span className="tabular-nums">
                                    {page + 1} / {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page + 1 >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <CaretRight size={14} />
                                </Button>
                            </span>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function TrackingRow({ row, gradable }: { row: EngagementTrackingRow; gradable: boolean }) {
    return (
        <tr>
            <td className="px-3 py-2">
                <span className="block text-neutral-900">
                    {row.fullName ?? `${row.userId.slice(0, 8)}…`}
                </span>
                {row.email && <span className="block text-xs text-neutral-500">{row.email}</span>}
            </td>
            <td className="px-3 py-2 text-neutral-600">{row.username ?? '—'}</td>
            <td className="px-3 py-2">
                <span className="text-neutral-700">{row.status}</span>
                {row.isLate && (
                    <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        late
                    </span>
                )}
            </td>
            {gradable && (
                <td className="px-3 py-2">
                    {row.isCorrect === true ? 'Correct' : row.isCorrect === false ? 'Wrong' : '—'}
                </td>
            )}
            <td className="px-3 py-2 tabular-nums">{row.pointsAwarded}</td>
            <td className="px-3 py-2 tabular-nums text-neutral-500">
                {row.timeSpentMs ? `${Math.round(row.timeSpentMs / 1000)}s` : '—'}
            </td>
            <td className="px-3 py-2 text-neutral-500">
                {row.completedAt
                    ? new Date(row.completedAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                      })
                    : '—'}
            </td>
        </tr>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-neutral-200 px-4 py-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
        </div>
    );
}
