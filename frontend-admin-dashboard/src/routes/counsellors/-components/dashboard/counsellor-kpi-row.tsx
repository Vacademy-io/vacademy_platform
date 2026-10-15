import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { Alarm, ArrowRight, ChatCircleText, Timer, Trophy, UserPlus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    formatCount,
    formatMinutes,
    formatRate,
    type CounsellorDashboardTotals,
} from '../../-utils/dashboard-stats';

type Tone = 'primary' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CHIP: Record<Tone, string> = {
    primary: 'bg-primary-50 text-primary-500',
    info: 'bg-info-50 text-info-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
};

function KpiTile({
    icon: IconCmp,
    tone,
    label,
    value,
    detail,
    loading,
    highlight,
    onClick,
    actionLabel,
}: {
    icon: Icon;
    tone: Tone;
    label: string;
    value: string;
    detail: ReactNode;
    loading: boolean;
    /** Draws the tile in the tone's colour — used when the number needs action. */
    highlight?: boolean;
    onClick?: () => void;
    actionLabel?: string;
}) {
    // Size token sits outside cn(): tailwind-merge reads text-caption/text-body/… as a text
    // colour and drops it when a text-colour class follows, so it would never apply.
    const body = (
        <>
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        TONE_CHIP[tone]
                    )}
                >
                    <IconCmp size={18} weight="duotone" />
                </span>
                <span className="min-w-0 truncate text-caption font-semibold text-neutral-600">
                    {label}
                </span>
            </div>
            {loading ? (
                <Skeleton className="h-8 w-20" />
            ) : (
                <span
                    className={`text-h2 ${cn(
                        'font-semibold tabular-nums',
                        highlight && tone === 'danger' ? 'text-danger-600' : 'text-neutral-900'
                    )}`}
                >
                    {value}
                </span>
            )}
            <span className="text-caption text-neutral-500">{loading ? ' ' : detail}</span>
            {onClick && actionLabel ? (
                <span className="mt-auto flex items-center gap-1 text-caption font-semibold text-primary-500">
                    {actionLabel} <ArrowRight size={12} weight="bold" />
                </span>
            ) : null}
        </>
    );
    const frame = cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-4 text-left',
        highlight && tone === 'danger' ? 'border-danger-200' : 'border-neutral-200'
    );
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(frame, 'transition-colors hover:border-primary-300')}
            >
                {body}
            </button>
        );
    }
    return <div className={frame}>{body}</div>;
}

/**
 * The five numbers a manager checks first. Period-based figures (new leads,
 * converted, first response) follow the page's period selector; the
 * follow-up and assigned-lead figures are "right now".
 */
export function CounsellorKpiRow({
    totals,
    assignedLeads,
    assignedLoading,
    statsLoading,
    periodName,
    periodIncomplete,
    onOpenFollowUps,
}: {
    totals: CounsellorDashboardTotals;
    assignedLeads: number;
    assignedLoading: boolean;
    statsLoading: boolean;
    /** Lower-case period name for labels ("this month"). */
    periodName: string;
    /** Custom period without both dates yet — period tiles wait for them. */
    periodIncomplete: boolean;
    onOpenFollowUps: () => void;
}) {
    const { t } = useTranslation('counsellorsIndex');
    // What a period tile says when it has no number to show.
    const periodMissing = periodIncomplete ? t('kpi.pickDates') : t('kpi.noData');
    const waiting =
        totals.newLeads != null && totals.contacted != null
            ? Math.max(0, totals.newLeads - totals.contacted)
            : null;
    const overdue = totals.overdueFollowups;
    // Red when something is overdue, green when the queue is clean, neutral when unknown.
    const overdueTone: Tone = overdue == null ? 'info' : overdue > 0 ? 'danger' : 'success';

    return (
        <div className="flex flex-col gap-2">
            <p className="text-caption text-neutral-500">
                {t('kpi.periodCaption', { period: periodName })}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <KpiTile
                    icon={ChatCircleText}
                    tone="primary"
                    label={t('kpi.assignedLeads')}
                    value={formatCount(assignedLeads)}
                    detail={t('kpi.assignedLeadsDetail')}
                    loading={assignedLoading}
                />
                <KpiTile
                    icon={UserPlus}
                    tone="info"
                    label={t('kpi.newLeads')}
                    value={formatCount(totals.newLeads)}
                    detail={
                        waiting != null ? (
                            <>
                                {t('kpi.contacted', { count: totals.contacted ?? 0 })}
                                {waiting > 0 ? (
                                    <span className="text-warning-700">
                                        {' · '}
                                        {t('kpi.notContacted', { count: waiting })}
                                    </span>
                                ) : null}
                            </>
                        ) : (
                            periodMissing
                        )
                    }
                    loading={statsLoading}
                />
                <KpiTile
                    icon={Trophy}
                    tone="success"
                    label={t('kpi.converted')}
                    value={formatCount(totals.converted)}
                    detail={
                        totals.conversionRate != null
                            ? t('kpi.convertedDetail', { rate: formatRate(totals.conversionRate) })
                            : periodMissing
                    }
                    loading={statsLoading}
                />
                <KpiTile
                    icon={Alarm}
                    tone={overdueTone}
                    highlight={overdueTone === 'danger'}
                    label={t('kpi.overdue')}
                    value={formatCount(totals.overdueFollowups)}
                    detail={
                        totals.dueTodayFollowups != null
                            ? t('kpi.dueToday', { count: totals.dueTodayFollowups })
                            : t('kpi.noData')
                    }
                    loading={statsLoading}
                    onClick={onOpenFollowUps}
                    actionLabel={t('kpi.openFollowUps')}
                />
                <KpiTile
                    icon={Timer}
                    tone="info"
                    label={t('kpi.firstResponse')}
                    value={formatMinutes(totals.avgResponseMinutes)}
                    detail={periodIncomplete ? periodMissing : t('kpi.firstResponseDetail')}
                    loading={statsLoading}
                />
            </div>
        </div>
    );
}
