import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MetricInfo } from './metricInfo';

/**
 * Shared, modern report UI primitives (KPI cards + section panels) used across
 * all Learning Reports views. Design-system tokens only; "data-dense dashboard"
 * styling with subtle hover affordances.
 */

export type MetricTone = 'primary' | 'success' | 'info' | 'warning' | 'danger';

const toneBadge: Record<MetricTone, string> = {
    primary: 'bg-primary-50 text-primary-500',
    success: 'bg-success-50 text-success-600',
    info: 'bg-info-50 text-info-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
};

export function MetricCard({
    label,
    value,
    sub,
    icon,
    info,
    tone = 'primary',
}: {
    label: string;
    value: string;
    sub?: string;
    icon?: ReactNode;
    info?: string;
    tone?: MetricTone;
}) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">
                            {label}
                        </p>
                        {info && <MetricInfo text={info} />}
                    </div>
                    <p className="text-h2 font-bold text-neutral-700">{value}</p>
                    {sub && <p className="text-caption text-neutral-500">{sub}</p>}
                </div>
                {icon && (
                    <div className={cn('shrink-0 rounded-full p-2.5', toneBadge[tone])}>{icon}</div>
                )}
            </div>
        </div>
    );
}

export function SectionCard({
    title,
    subtitle,
    icon,
    info,
    action,
    children,
    bodyClassName,
}: {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    info?: string;
    action?: ReactNode;
    children: ReactNode;
    bodyClassName?: string;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                    {icon && (
                        <div className="shrink-0 rounded-md bg-primary-50 p-1.5 text-primary-500">
                            {icon}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-subtitle font-semibold text-neutral-700">{title}</h3>
                            {info && <MetricInfo text={info} />}
                        </div>
                        {subtitle && <p className="mt-0.5 text-caption text-neutral-500">{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
            <div className={cn('p-5', bodyClassName)}>{children}</div>
        </div>
    );
}

/** Compact, branded report header strip with course/duration + actions. */
export function ReportHeader({
    title,
    chips,
    actions,
}: {
    title: string;
    chips?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                    <h3 className="text-subtitle font-semibold text-neutral-700">{title}</h3>
                    {chips && <div className="flex flex-wrap items-center gap-2">{chips}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </div>
    );
}
