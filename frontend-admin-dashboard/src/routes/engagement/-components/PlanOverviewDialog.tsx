import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { WarningCircle } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { getLanguageSetting } from '@/services/language-settings';
import { normalizeTimezone } from '@/utils/timezone';
import { getPlanOverview } from '../-services/engagement-service';

/** A server instant as a date, in the institute's timezone and the admin's language. */
function formatDay(iso: string, locale: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const options: Intl.DateTimeFormatOptions = {
        dateStyle: 'medium',
        timeZone: normalizeTimezone(getLanguageSetting()?.timezone),
    };
    try {
        return new Intl.DateTimeFormat(locale, options).format(date);
    } catch {
        return new Intl.DateTimeFormat(undefined, options).format(date);
    }
}

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
    const { t, i18n } = useTranslation('engagement');
    const { data, isLoading, isError, isFetching, refetch } = useQuery({
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

                {isLoading && (
                    <div className="space-y-3" aria-busy="true">
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-40 w-full rounded-lg" />
                    </div>
                )}

                {/* A failed background refetch keeps the numbers that did load. */}
                {isError && !data && (
                    <Alert className="border-danger-200 bg-danger-50">
                        <WarningCircle size={18} className="text-danger-600" />
                        <AlertDescription className="space-y-3 text-danger-700">
                            <p>{t('overview.loadError')}</p>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                disable={isFetching}
                                onClick={() => void refetch()}
                            >
                                {t('overview.retry')}
                            </MyButton>
                        </AlertDescription>
                    </Alert>
                )}

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
                                                className={cn(r.missed >= 3 && 'bg-warning-50')}
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
                                                        <span className="rounded bg-warning-100 px-1.5 py-0.5 text-xs font-medium text-warning-700">
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
                                                        ? formatDay(
                                                              r.lastCompletedAt,
                                                              i18n.language
                                                          )
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
            ? 'border-warning-200 bg-warning-50'
            : tone === 'ok'
              ? 'border-success-100 bg-success-50'
              : 'border-neutral-200';
    return (
        <div className={cn('rounded-lg border px-4 py-2', cls)}>
            <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
            {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
    );
}
