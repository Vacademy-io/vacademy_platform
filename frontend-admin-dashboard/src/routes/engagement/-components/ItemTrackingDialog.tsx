import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getItemTracking } from '../-services/engagement-service';
import type { EngagementItemDTO } from '../-types/types';

/**
 * Who did what on one task.
 *
 * Learner ids are shown rather than names: this view reads the attempt rows only,
 * and joining names would mean a second lookup per learner. Names arrive with the
 * batch-level view.
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
    const { data, isLoading } = useQuery({
        queryKey: ['engagement-item-tracking', item?.id],
        queryFn: () => getItemTracking(item!.id),
        enabled: open && Boolean(item?.id),
    });

    const gradable = item?.itemType === 'QUESTION_OF_DAY' || item?.itemType === 'QUIZ';
    const accuracy =
        data && data.completedCount > 0
            ? Math.round((data.correctCount / data.completedCount) * 100)
            : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="truncate text-start">
                        {item?.title ?? 'Task'}
                    </DialogTitle>
                </DialogHeader>

                {isLoading && (
                    <div className="space-y-2 py-4">
                        <div className="h-10 animate-pulse rounded bg-neutral-100" />
                        <div className="h-10 animate-pulse rounded bg-neutral-100" />
                    </div>
                )}

                {!isLoading && data && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                            <Stat label="Completed" value={String(data.completedCount)} />
                            {gradable && <Stat label="Correct" value={String(data.correctCount)} />}
                            {gradable && accuracy !== null && (
                                <Stat label="Accuracy" value={`${accuracy}%`} />
                            )}
                        </div>

                        {data.rows.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                                Nobody has attempted this yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-neutral-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                                        <tr>
                                            <th className="px-3 py-2 text-start">Learner</th>
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
                                        {data.rows.map((row) => (
                                            <tr key={row.userId}>
                                                <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                                                    {row.userId.slice(0, 8)}…
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-neutral-700">
                                                        {row.status}
                                                    </span>
                                                    {row.isLate && (
                                                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                                                            late
                                                        </span>
                                                    )}
                                                </td>
                                                {gradable && (
                                                    <td className="px-3 py-2">
                                                        {row.isCorrect === true
                                                            ? 'Correct'
                                                            : row.isCorrect === false
                                                              ? 'Wrong'
                                                              : '—'}
                                                    </td>
                                                )}
                                                <td className="px-3 py-2 tabular-nums">
                                                    {row.pointsAwarded}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums text-neutral-500">
                                                    {row.timeSpentMs
                                                        ? `${Math.round(row.timeSpentMs / 1000)}s`
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-neutral-500">
                                                    {row.completedAt
                                                        ? new Date(row.completedAt).toLocaleString(
                                                              undefined,
                                                              {
                                                                  dateStyle: 'medium',
                                                                  timeStyle: 'short',
                                                              }
                                                          )
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
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
