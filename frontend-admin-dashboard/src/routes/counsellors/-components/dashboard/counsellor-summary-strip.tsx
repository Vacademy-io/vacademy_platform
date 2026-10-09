import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
    formatCount,
    formatMinutes,
    formatRate,
    type CounsellorStats,
} from '../../-utils/dashboard-stats';

/**
 * One-line snapshot of a single counsellor, shown at the top of the detail
 * drawer (above the existing tabs) so a manager sees where this person
 * stands before digging into leads, calls or targets.
 */
export function CounsellorSummaryStrip({
    assignedLeads,
    stats,
    periodName,
}: {
    assignedLeads: number;
    stats: CounsellorStats | undefined;
    periodName: string;
}) {
    const { t } = useTranslation('counsellorsIndex');
    const overdue = stats?.overdueFollowups ?? null;
    // Size token sits outside cn(): tailwind-merge reads text-caption/text-body/… as a text
    // colour and drops it when a text-colour class follows, so it would never apply.
    const cells: { label: string; value: string; sub?: string; danger?: boolean }[] = [
        { label: t('summary.assignedLeads'), value: formatCount(assignedLeads) },
        {
            label: t('summary.overdue'),
            value: formatCount(overdue),
            danger: overdue != null && overdue > 0,
            sub:
                stats?.oldestOverdueDays != null && stats.oldestOverdueDays > 0
                    ? t('summary.oldest', { count: stats.oldestOverdueDays })
                    : t('summary.followUps'),
        },
        {
            label: t('summary.dueToday'),
            value: formatCount(stats?.dueTodayFollowups),
            sub: t('summary.followUps'),
        },
        {
            label: t('summary.newLeads'),
            value: formatCount(stats?.newLeads),
            sub: periodName,
        },
        {
            label: t('summary.converted'),
            value: formatCount(stats?.converted),
            sub: stats?.conversionRate != null ? formatRate(stats.conversionRate) : undefined,
        },
        {
            label: t('summary.firstResponse'),
            value: formatMinutes(stats?.avgResponseMinutes),
            sub: t('summary.firstResponseSub'),
        },
    ];
    return (
        <div className="grid grid-cols-3 gap-px border-b border-neutral-200 bg-neutral-100 sm:grid-cols-6">
            {cells.map((c) => (
                <div key={c.label} className="flex min-w-0 flex-col gap-0.5 bg-white px-4 py-3">
                    <span className="truncate text-caption text-neutral-500">{c.label}</span>
                    <span
                        className={`text-title ${cn(
                            'font-semibold tabular-nums',
                            c.danger ? 'text-danger-600' : 'text-neutral-900'
                        )}`}
                    >
                        {c.value}
                    </span>
                    {c.sub ? (
                        <span className="truncate text-caption text-neutral-400">{c.sub}</span>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
