/**
 * Compact AI plan card for the credits popover Overview. Renders NOTHING unless
 * the institute has a plan in effect (LIVE, trial/active/grace) — institutes
 * without a plan, or with a platform Shadow trial, see no change.
 */
import { useTranslation } from 'react-i18next';
import { SealCheck } from '@phosphor-icons/react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatDate, formatNumber } from '@/lib/formatters';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { allowancePct, isPlanInEffect, useAiPlanQuery } from './aiPlan';

export function PlanSummaryCard() {
    const { t } = useTranslation('aiCreditsUsage');
    const instituteId = getCurrentInstituteId();
    const { data } = useAiPlanQuery(instituteId);
    if (!isPlanInEffect(data)) return null;

    const pct = allowancePct(data);
    const ends = data.plan.period_end ? formatDate(data.plan.period_end) : null;
    const includedCount = data.features.filter((f) => f.mode === 'INCLUDED').length;

    return (
        <div className="rounded-xl border border-purple-100 bg-white p-2.5">
            <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                    <SealCheck className="size-4 shrink-0 text-purple-500" weight="fill" />
                    <span className="truncate text-xs font-semibold text-neutral-800">
                        {data.plan.name}
                    </span>
                    {data.plan.status === 'GRACE' && (
                        <span className="rounded bg-warning-50 px-1 py-0.5 text-2xs font-semibold text-warning-700">
                            {t('plan.grace')}
                        </span>
                    )}
                </span>
                {ends && (
                    <span className="shrink-0 text-2xs text-neutral-500">
                        {t('plan.periodEnds', { date: ends })}
                    </span>
                )}
            </div>
            {data.allowance.credits > 0 && (
                <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-2xs text-neutral-500">
                        <span>{t('plan.allowance')}</span>
                        <span className="font-medium text-neutral-700">
                            {t('plan.allowanceLeft', {
                                remaining: formatNumber(data.allowance.remaining, {
                                    maximumFractionDigits: 1,
                                }),
                                total: formatNumber(data.allowance.credits, {
                                    maximumFractionDigits: 0,
                                }),
                            })}
                        </span>
                    </div>
                    <Progress
                        value={pct ?? 0}
                        className={cn(
                            'h-1.5 bg-neutral-100',
                            (pct ?? 0) >= 100
                                ? '[&>div]:bg-danger-500'
                                : (pct ?? 0) >= 80
                                  ? '[&>div]:bg-warning-500'
                                  : '[&>div]:bg-purple-500'
                        )}
                    />
                </div>
            )}
            {includedCount > 0 && (
                <p className="mt-1.5 text-2xs text-neutral-500">
                    {t('plan.includedCount', { count: includedCount })}
                </p>
            )}
        </div>
    );
}
