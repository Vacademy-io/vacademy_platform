import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Area,
    AreaChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import { ChartLineUp, DownloadSimple, TrendUp, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { isRealCurrency } from '@/utils/payment-currency';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import type { PaymentLogsRequest } from '@/types/payment-logs';
import { fetchAllPaymentLogs } from '../-utils/exportPaymentLogsCsv';
import {
    computePaymentAnalytics,
    type AmountSlice,
    type PaymentAnalytics,
} from '../-utils/paymentAnalytics';
import {
    fetchCollectionSummary,
    type CollectionSummary,
} from '@/routes/dashboard/-services/collection-summary-service';
import { GatewayBadge } from './GatewayBadge';

// ─── Range control ────────────────────────────────────────────────────────────

type DashRangeKey = '7d' | '30d' | '90d' | 'all';
const RANGES: { key: DashRangeKey; label: string; days: number | null }[] = [
    { key: '7d', label: '7 days', days: 7 },
    { key: '30d', label: '30 days', days: 30 },
    { key: '90d', label: '90 days', days: 90 },
    { key: 'all', label: 'All time', days: null },
];

const toLocalIso = (d: Date): string => d.toISOString().slice(0, 19);

const rangeWindow = (key: DashRangeKey): { start?: string; end?: string } => {
    const cfg = RANGES.find((r) => r.key === key);
    if (!cfg || cfg.days == null) return {};
    const end = new Date();
    const start = new Date(end.getTime() - cfg.days * 24 * 60 * 60 * 1000);
    return { start: toLocalIso(start), end: toLocalIso(end) };
};

// ─── Formatting ────────────────────────────────────────────────────────────────

const makeMoney =
    (currency: string) =>
    (n: number, compact = false): string => {
        const notation = compact && Math.abs(n) >= 100000 ? 'compact' : 'standard';
        if (isRealCurrency(currency)) {
            try {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 0,
                    notation,
                }).format(n);
            } catch {
                /* fall through */
            }
        }
        return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, notation }).format(n);
    };

// Token-based chart palette (semantic ramps only — no raw hex).
const CHART_PALETTE = [
    'hsl(var(--primary-500))',
    'hsl(var(--info-500))',
    'hsl(var(--success-500))',
    'hsl(var(--warning-500))',
    'hsl(var(--danger-500))',
    'hsl(var(--primary-300))',
    'hsl(var(--info-300))',
];

const AGING_TONE: Record<string, string> = {
    neutral: 'text-neutral-600',
    warning: 'text-warning-600',
    strong: 'text-warning-700',
    danger: 'text-danger-600',
};

// ─── Small building blocks ──────────────────────────────────────────────────────

function SectionCard({
    title,
    subtitle,
    right,
    children,
    className,
}: {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <Card className={cn('flex flex-col p-5', className)}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-subtitle font-semibold text-neutral-800">{title}</h3>
                    {subtitle && <p className="text-caption text-neutral-500">{subtitle}</p>}
                </div>
                {right}
            </div>
            {children}
        </Card>
    );
}

function MetricCard({
    label,
    value,
    meta,
    isLoading,
}: {
    label: string;
    value: string;
    meta: string;
    isLoading?: boolean;
}) {
    return (
        <Card className="p-4">
            <div className="text-caption font-medium uppercase tracking-wide text-neutral-500">
                {label}
            </div>
            {isLoading ? (
                <Skeleton className="mt-2 h-8 w-28" />
            ) : (
                <div className="mt-1 text-h2 font-semibold tabular-nums text-neutral-800">
                    {value}
                </div>
            )}
            <div className="mt-1 text-caption text-neutral-500">{isLoading ? ' ' : meta}</div>
        </Card>
    );
}

/** Horizontal ranked bars (gateways, courses, method mix). */
function RankedBars({
    slices,
    money,
    colorAt,
    renderLabel,
}: {
    slices: AmountSlice[];
    money: (n: number, compact?: boolean) => string;
    colorAt: (i: number) => string;
    renderLabel?: (slice: AmountSlice) => React.ReactNode;
}) {
    const max = Math.max(1, ...slices.map((s) => s.amount));
    if (!slices.length) {
        return <div className="py-8 text-center text-caption text-neutral-400">No data</div>;
    }
    return (
        <div className="space-y-3">
            {slices.map((s, i) => (
                <div key={s.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-body">
                        <div className="min-w-0">
                            {renderLabel ? (
                                renderLabel(s)
                            ) : (
                                <span className="truncate font-medium text-neutral-700">
                                    {s.label}
                                </span>
                            )}
                        </div>
                        <div className="shrink-0 text-right">
                            <span className="font-semibold tabular-nums text-neutral-800">
                                {money(s.amount, true)}
                            </span>
                            <span className="ml-1.5 text-caption text-neutral-400">{s.count}</span>
                        </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.max(3, (s.amount / max) * 100)}%`,
                                backgroundColor: colorAt(i),
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main dashboard ─────────────────────────────────────────────────────────────

export function PaymentDashboard() {
    const instituteId = getCurrentInstituteId();
    const [range, setRange] = useState<DashRangeKey>('30d');
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);

    const requestFilters: Omit<PaymentLogsRequest, 'institute_id'> = useMemo(() => {
        const w = rangeWindow(range);
        const filters: Omit<PaymentLogsRequest, 'institute_id'> = {
            sort_columns: { createdAt: 'DESC' },
        };
        if (w.start) filters.start_date_in_utc = w.start;
        if (w.end) filters.end_date_in_utc = w.end;
        return filters;
    }, [range]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['payment-analytics', requestFilters],
        queryFn: () => fetchAllPaymentLogs(requestFilters),
        staleTime: 60_000,
    });

    const entries = useMemo(() => data?.entries ?? [], [data]);
    const analytics: PaymentAnalytics = useMemo(() => computePaymentAnalytics(entries), [entries]);

    // Real collections trend (backend aggregate) for the same window.
    const { data: collection } = useQuery<CollectionSummary>({
        queryKey: ['collection-summary-dash', instituteId, range],
        queryFn: () =>
            fetchCollectionSummary({
                institute_id: instituteId || '',
                ...rangeWindow(range),
            }),
        enabled: !!instituteId,
        staleTime: 60_000,
        retry: false,
    });

    const currency = analytics.primaryCurrency || collection?.currency || '';
    const money = useMemo(() => makeMoney(currency), [currency]);

    const trendData = useMemo(
        () => (collection?.daily ?? []).map((p) => ({ ...p, label: p.date.slice(5) })),
        [collection]
    );

    const rangeLabel = RANGES.find((r) => r.key === range)?.label.toLowerCase() ?? '';
    const isEmpty = !isLoading && entries.length === 0;

    const handleExport = () => {
        toast.info('Use “Export” on the Manage Payments page to download the underlying records.');
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-body text-neutral-500">
                    Overview of collections and outstanding dues · last {rangeLabel}
                </p>
                <div className="flex items-center gap-3">
                    <div
                        role="group"
                        aria-label="Dashboard time range"
                        className="flex shrink-0 items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
                    >
                        {RANGES.map((r) => (
                            <button
                                key={r.key}
                                type="button"
                                onClick={() => setRange(r.key)}
                                aria-pressed={range === r.key}
                                className={cn(
                                    'cursor-pointer rounded-md px-2.5 py-1 text-caption font-medium transition-colors',
                                    range === r.key
                                        ? 'bg-primary-500 text-white shadow-sm'
                                        : 'text-neutral-600 hover:bg-neutral-100'
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        className="gap-2"
                        onClick={handleExport}
                    >
                        <DownloadSimple size={16} />
                        Export
                    </MyButton>
                </div>
            </div>

            {isError ? (
                <Card className="p-10 text-center">
                    <p className="text-body font-medium text-neutral-700">
                        Couldn’t load payment analytics
                    </p>
                    <p className="mt-1 text-caption text-neutral-500">
                        Please try again in a moment.
                    </p>
                </Card>
            ) : isEmpty ? (
                <Card className="flex flex-col items-center gap-2 p-12 text-center">
                    <ChartLineUp size={26} className="text-neutral-300" weight="duotone" />
                    <p className="text-body font-medium text-neutral-700">
                        No payments in this period
                    </p>
                    <p className="text-caption text-neutral-500">
                        Try a wider time range to see collection trends.
                    </p>
                </Card>
            ) : (
                <>
                    {/* Metric row */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <MetricCard
                            label="Collected"
                            value={money(analytics.collected.amount, true)}
                            meta={`${analytics.collected.count.toLocaleString()} payments`}
                            isLoading={isLoading}
                        />
                        <MetricCard
                            label="Outstanding"
                            value={money(analytics.outstanding.amount, true)}
                            meta={`${analytics.outstanding.count.toLocaleString()} pending`}
                            isLoading={isLoading}
                        />
                        <MetricCard
                            label="Success rate"
                            value={
                                analytics.successRate == null
                                    ? '—'
                                    : `${(analytics.successRate * 100).toFixed(1)}%`
                            }
                            meta={`${analytics.failed.count.toLocaleString()} failed attempts`}
                            isLoading={isLoading}
                        />
                        <MetricCard
                            label="Total payments"
                            value={analytics.totalEntries.toLocaleString()}
                            meta={`in the last ${rangeLabel}`}
                            isLoading={isLoading}
                        />
                    </div>

                    {/* Collections trend */}
                    <SectionCard
                        title="Collections trend"
                        subtitle={`Paid volume per day · last ${rangeLabel}`}
                        right={
                            <span className="flex size-8 items-center justify-center rounded-lg bg-success-100 text-success-600">
                                <TrendUp size={16} weight="duotone" />
                            </span>
                        }
                    >
                        <div className="h-56 w-full">
                            {isLoading ? (
                                <Skeleton className="size-full rounded-md" />
                            ) : trendData.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-caption text-neutral-400">
                                    No collections in this period
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={trendData}
                                        margin={{ top: 6, right: 6, bottom: 0, left: -12 }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="dashCollectionFill"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="hsl(var(--success-500))"
                                                    stopOpacity={0.28}
                                                />
                                                <stop
                                                    offset="100%"
                                                    stopColor="hsl(var(--success-500))"
                                                    stopOpacity={0.02}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="hsl(var(--border))"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="label"
                                            tick={{
                                                fontSize: 10,
                                                fill: 'hsl(var(--muted-foreground))',
                                            }}
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={24}
                                        />
                                        <YAxis
                                            tick={{
                                                fontSize: 10,
                                                fill: 'hsl(var(--muted-foreground))',
                                            }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={48}
                                            tickFormatter={(v: number) =>
                                                v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                                            }
                                        />
                                        <Tooltip
                                            cursor={{
                                                stroke: 'hsl(var(--success-500))',
                                                strokeWidth: 1,
                                                strokeOpacity: 0.3,
                                            }}
                                            contentStyle={{
                                                borderRadius: 8,
                                                border: '1px solid hsl(var(--border))',
                                                fontSize: 12,
                                            }}
                                            formatter={(v: number) => [money(v), 'Collected']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="hsl(var(--success-500))"
                                            strokeWidth={2}
                                            fill="url(#dashCollectionFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </SectionCard>

                    {/* Method mix + Gateway breakdown */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <SectionCard
                            title="Method mix"
                            subtitle="Share of successful payments by gateway"
                        >
                            <MethodMixDonut slices={analytics.methodMix} money={money} />
                        </SectionCard>
                        <SectionCard
                            title="Collections by gateway"
                            subtitle="Paid volume settled through each gateway"
                        >
                            <RankedBars
                                slices={analytics.gatewayBreakdown}
                                money={money}
                                colorAt={(i) => CHART_PALETTE[i % CHART_PALETTE.length]!}
                                renderLabel={(s) => (
                                    <GatewayBadge vendor={s.label} showLabel size="sm" />
                                )}
                            />
                        </SectionCard>
                    </div>

                    {/* Funnel + Aging */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <SectionCard
                            title="Collection funnel"
                            subtitle="From invoiced records to money captured"
                        >
                            <FunnelBars analytics={analytics} money={money} />
                        </SectionCard>
                        <SectionCard
                            title="Outstanding by age"
                            subtitle={`${money(analytics.outstanding.amount, true)} across ${analytics.outstanding.count} pending`}
                        >
                            <div className="grid grid-cols-2 gap-3">
                                {analytics.aging.map((b) => (
                                    <div
                                        key={b.label}
                                        className="rounded-lg border border-neutral-200 p-3"
                                    >
                                        <div
                                            className={cn(
                                                'text-caption font-medium',
                                                AGING_TONE[b.tone]
                                            )}
                                        >
                                            {b.label}
                                        </div>
                                        <div className="mt-1 text-subtitle font-semibold tabular-nums text-neutral-800">
                                            {money(b.amount, true)}
                                        </div>
                                        <div className="text-caption text-neutral-500">
                                            {b.count} {b.count === 1 ? 'payment' : 'payments'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    </div>

                    {/* Top courses + Payment type */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <SectionCard
                            title={`Top ${courseTerm.toLowerCase()}s by revenue`}
                            subtitle="Collected in this period"
                        >
                            <RankedBars
                                slices={analytics.topCourses}
                                money={money}
                                colorAt={(i) => CHART_PALETTE[i % CHART_PALETTE.length]!}
                            />
                        </SectionCard>
                        <SectionCard title="Payment type mix" subtitle="All records by type">
                            <div className="space-y-2.5">
                                {analytics.paymentTypeMix.map((s, i) => {
                                    const total = analytics.totalEntries || 1;
                                    const pct = Math.round((s.count / total) * 100);
                                    return (
                                        <div key={s.label} className="flex items-center gap-3">
                                            <span
                                                className="size-2.5 shrink-0 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        CHART_PALETTE[i % CHART_PALETTE.length],
                                                }}
                                            />
                                            <span className="flex-1 truncate text-body text-neutral-700">
                                                {s.label}
                                            </span>
                                            <span className="text-body font-medium tabular-nums text-neutral-800">
                                                {s.count}
                                            </span>
                                            <span className="w-10 text-right text-caption text-neutral-400">
                                                {pct}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </SectionCard>
                    </div>

                    {/* Honesty note about what isn't shown yet */}
                    <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-caption text-neutral-500">
                        <Info size={15} className="mt-px shrink-0 text-neutral-400" />
                        <span>
                            Every figure here is derived from your payment records. Bank settlement
                            timelines and gateway-reported decline reasons aren’t available from the
                            current API, so those panels are intentionally omitted rather than
                            estimated.
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Method-mix donut ───────────────────────────────────────────────────────────

function MethodMixDonut({
    slices,
    money,
}: {
    slices: AmountSlice[];
    money: (n: number, compact?: boolean) => string;
}) {
    const totalCount = slices.reduce((a, s) => a + s.count, 0);
    if (!slices.length || totalCount === 0) {
        return <div className="py-8 text-center text-caption text-neutral-400">No data</div>;
    }
    const chartData = slices.map((s) => ({ name: s.label, value: s.count, amount: s.amount }));

    return (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <div className="relative size-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={44}
                            outerRadius={64}
                            paddingAngle={2}
                            stroke="none"
                        >
                            {chartData.map((_, i) => (
                                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                borderRadius: 8,
                                border: '1px solid hsl(var(--border))',
                                fontSize: 12,
                            }}
                            formatter={(v: number, _n, item) => [
                                `${v} · ${money((item?.payload as { amount: number }).amount, true)}`,
                                (item?.payload as { name: string }).name,
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-subtitle font-semibold text-neutral-800">
                        {totalCount}
                    </span>
                    <span className="text-2xs text-neutral-400">payments</span>
                </div>
            </div>
            <div className="w-full space-y-1.5">
                {slices.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-2 text-body">
                        <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                        />
                        <span className="flex-1 truncate text-neutral-700">{s.label}</span>
                        <span className="font-medium tabular-nums text-neutral-800">
                            {Math.round((s.count / totalCount) * 100)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Funnel ─────────────────────────────────────────────────────────────────────

function FunnelBars({
    analytics,
    money,
}: {
    analytics: PaymentAnalytics;
    money: (n: number, compact?: boolean) => string;
}) {
    const stages = analytics.funnel;
    const top = Math.max(1, stages[0]?.amount ?? 1);
    const colors = ['hsl(var(--info-500))', 'hsl(var(--primary-500))', 'hsl(var(--success-500))'];

    return (
        <div className="space-y-3">
            {stages.map((st, i) => {
                const prev = i > 0 ? stages[i - 1]!.amount : null;
                const drop =
                    prev && prev > 0 ? (((prev - st.amount) / prev) * 100).toFixed(1) : null;
                return (
                    <div key={st.label}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-body">
                            <span className="font-medium text-neutral-700">{st.label}</span>
                            <span className="flex items-center gap-2">
                                {drop && Number(drop) > 0 && (
                                    <span className="text-caption text-danger-600">−{drop}%</span>
                                )}
                                <span className="font-semibold tabular-nums text-neutral-800">
                                    {money(st.amount, true)}
                                </span>
                            </span>
                        </div>
                        <div className="h-6 overflow-hidden rounded-md bg-neutral-100">
                            <div
                                className="flex h-full items-center rounded-md px-2 text-2xs font-medium text-white"
                                style={{
                                    width: `${Math.max(6, (st.amount / top) * 100)}%`,
                                    backgroundColor: colors[i % colors.length],
                                }}
                            >
                                {st.count}
                            </div>
                        </div>
                        <div className="mt-0.5 text-caption text-neutral-400">{st.hint}</div>
                    </div>
                );
            })}
        </div>
    );
}
