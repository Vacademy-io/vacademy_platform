import { ReactNode } from 'react';
import { MetricInfo } from '../metricInfo';

export function MetricCard({
    label,
    value,
    sub,
    icon,
    info,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: ReactNode;
    info?: string;
}) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-caption font-medium text-neutral-600">{label}</p>
                        {info && <MetricInfo text={info} />}
                    </div>
                    <p className="text-h3 font-bold text-primary-500">{value}</p>
                    {sub && <p className="text-caption text-neutral-500">{sub}</p>}
                </div>
                <div className="rounded-full bg-primary-50 p-2.5 text-primary-500">{icon}</div>
            </div>
        </div>
    );
}

export function SectionCard({
    title,
    subtitle,
    action,
    children,
}: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-subtitle font-semibold text-primary-500">{title}</h3>
                    {subtitle && <p className="mt-1 text-caption text-neutral-600">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}
