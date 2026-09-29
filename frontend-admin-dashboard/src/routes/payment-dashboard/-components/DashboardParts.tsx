import type { ReactNode } from 'react';
import { Info, TrendDown, TrendUp } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** A titled dashboard panel with an optional explanation, subtitle and header action. */
export function SectionCard({
    title,
    info,
    subtitle,
    action,
    children,
    className,
    bodyClassName,
}: {
    title: string;
    info?: string;
    subtitle?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <Card className={cn('flex flex-col rounded-xl border-neutral-200 shadow-sm', className)}>
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-subtitle font-semibold text-neutral-800">
                        {title}
                        {info && <InfoTip text={info} />}
                    </h3>
                    {subtitle && <p className="mt-0.5 text-caption text-neutral-500">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className={cn('flex-1 px-5 pb-4 pt-3', bodyClassName)}>{children}</div>
        </Card>
    );
}

export function InfoTip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-neutral-400" aria-label={text}>
                    <Info size={15} />
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-caption">{text}</TooltipContent>
        </Tooltip>
    );
}

/**
 * ▲ / ▼ against the comparison period. `goodWhenUp` flips the colour for figures where a fall is
 * the good news (overdue money).
 */
export function DeltaPill({
    change,
    goodWhenUp = true,
}: {
    change: number | null;
    goodWhenUp?: boolean;
}) {
    if (change === null) return null;
    const up = change >= 0;
    const good = up === goodWhenUp;
    const Icon = up ? TrendUp : TrendDown;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-caption font-semibold',
                good ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-600'
            )}
        >
            <Icon size={12} weight="bold" />
            {Math.abs(change) >= 100 ? Math.round(Math.abs(change)) : Math.abs(change).toFixed(1)}%
        </span>
    );
}

/** A thin trend line for a KPI tile — shape only, no axes. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
    if (values.length < 2 || values.every((v) => v === 0)) return null;
    const w = 72;
    const h = 26;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
        <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            className={cn('shrink-0 text-primary-500', className)}
            aria-hidden
        >
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function KpiTile({
    label,
    info,
    value,
    delta,
    caption,
    trend,
}: {
    label: string;
    info: string;
    value: string;
    delta?: ReactNode;
    caption: string;
    trend?: number[];
}) {
    return (
        <Card className="flex flex-col rounded-xl border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-caption font-medium text-neutral-600">
                {label}
                <InfoTip text={info} />
            </div>
            <div className="mt-2 text-h3 font-bold tabular-nums text-neutral-900">{value}</div>
            <div className="mt-2 flex min-h-7 items-end justify-between gap-2">
                <span>{delta}</span>
                {trend && <Sparkline values={trend} />}
            </div>
            <div className="mt-1 text-caption text-neutral-500">{caption}</div>
        </Card>
    );
}

/** Ranked horizontal bars: a label, a proportional track and the value. */
export function BarList({
    rows,
    formatValue,
    barClassName = 'bg-primary-500',
    emptyText,
}: {
    rows: { key: string; label: string; value: number; detail?: string; barClassName?: string }[];
    formatValue: (v: number) => string;
    barClassName?: string;
    emptyText: string;
}) {
    const max = Math.max(0, ...rows.map((r) => r.value));
    const total = rows.reduce((s, r) => s + r.value, 0);
    if (rows.length === 0 || total <= 0) {
        return <p className="py-6 text-center text-caption text-neutral-500">{emptyText}</p>;
    }
    return (
        <div className="divide-y divide-neutral-100">
            {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-12 items-center gap-3 py-2.5 text-body">
                    <span className="col-span-5 truncate text-neutral-700" title={r.label}>
                        {r.label}
                    </span>
                    <span className="col-span-4 h-2 overflow-hidden rounded-full bg-neutral-100">
                        {/* Width is the row's share of the largest — data, so inline style. */}
                        <span
                            className={cn(
                                'block h-full rounded-full',
                                r.barClassName ?? barClassName
                            )}
                            style={{
                                width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`,
                            }}
                        />
                    </span>
                    <span className="col-span-3 text-right tabular-nums">
                        <span className="font-semibold text-neutral-800">
                            {formatValue(r.value)}
                        </span>
                        <span className="ml-1 text-caption text-neutral-400">
                            {Math.round((r.value / total) * 100)}%
                        </span>
                        {r.detail && (
                            <span className="block text-caption text-neutral-400">{r.detail}</span>
                        )}
                    </span>
                </div>
            ))}
        </div>
    );
}
