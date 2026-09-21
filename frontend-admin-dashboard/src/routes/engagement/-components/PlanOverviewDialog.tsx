import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPlanOverview } from '../-services/engagement-service';

/**
 * Who is keeping up, who is slipping — across the whole plan.
 *
 * The per-task table answers "how did this question go"; this answers "which
 * learners do I need to nudge". Missed counts only tasks whose window has already
 * closed, so a learner who joined yesterday is not marked as missing a fortnight.
 */
export function PlanOverviewDialog({
    planId,
    open,
    onOpenChange,
}: {
    planId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation('engagement');
    const { data, isLoading } = useQuery({
        queryKey: ['engagement-plan-overview', planId],
        queryFn: () => getPlanOverview(planId),
        enabled: open,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="truncate text-start">
                        {data?.title ?? t('overview.title')}
                    </DialogTitle>
                </DialogHeader>

                {isLoading && <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />}

                {data && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                            <Stat label={t('overview.learners')} value={String(data.learners)} />
                            <Stat
                                label={t('overview.active')}
                                value={String(data.learnersActive)}
                                hint={t('overview.activeHint')}
                            />
                            <Stat
                                label={t('overview.slipping')}
                                value={String(data.learnersSlipping)}
                                hint={t('overview.slippingHint')}
                                tone={data.learnersSlipping > 0 ? 'warn' : 'ok'}
                            />
                            <Stat
                                label={t('overview.tasksClosed')}
                                value={`${data.tasksClosed} / ${data.tasksTotal}`}
                            />
                        </div>

                        {data.rows.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                                {t('overview.noLearners')}
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-neutral-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                                        <tr>
                                            <th className="px-3 py-2 text-start">
                                                {t('overview.learner')}
                                            </th>
                                            <th className="px-3 py-2 text-start">
                                                {t('overview.done')}
                                            </th>
                                            <th className="px-3 py-2 text-start">
                                                {t('overview.correct')}
                                            </th>
                                            <th className="px-3 py-2 text-start">
                                                {t('overview.missed')}
                                            </th>
                                            <th className="px-3 py-2 text-start">
                                                {t('overview.points')}
                                            </th>
                                            <th className="px-3 py-2 text-start">
                                                {t('overview.lastActive')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {data.rows.map((r) => (
                                            <tr
                                                key={r.userId}
                                                className={r.missed >= 3 ? 'bg-amber-50/60' : ''}
                                            >
                                                <td className="px-3 py-2">
                                                    <span className="block text-neutral-900">
                                                        {r.fullName ?? `${r.userId.slice(0, 8)}…`}
                                                    </span>
                                                    {r.username && (
                                                        <span className="block text-xs text-neutral-500">
                                                            {r.username}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    {r.completed}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    {r.correct}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    {r.missed >= 3 ? (
                                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                                                            {r.missed}
                                                        </span>
                                                    ) : (
                                                        r.missed
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    {r.pointsEarned}
                                                </td>
                                                <td className="px-3 py-2 text-neutral-500">
                                                    {r.lastCompletedAt
                                                        ? new Date(
                                                              r.lastCompletedAt
                                                          ).toLocaleDateString(undefined, {
                                                              dateStyle: 'medium',
                                                          })
                                                        : t('overview.never')}
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

function Stat({
    label,
    value,
    hint,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'neutral' | 'warn' | 'ok';
}) {
    const cls =
        tone === 'warn'
            ? 'border-amber-200 bg-amber-50'
            : tone === 'ok'
              ? 'border-success-100 bg-success-50'
              : 'border-neutral-200';
    return (
        <div className={`rounded-lg border px-4 py-2 ${cls}`}>
            <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
            {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
    );
}
