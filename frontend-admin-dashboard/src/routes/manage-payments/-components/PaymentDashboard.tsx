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
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import type { PaymentLogsRequest } from '@/types/payment-logs';
import { exportEntriesToCsv, fetchAllPaymentLogs } from '../-utils/exportPaymentLogsCsv';
import {
    computePaymentAnalytics,
    type AmountSlice,
    type PaymentAnalytics,
} from '../-utils/paymentAnalytics';
import { computeBillingFromEntries, computePaymentSummary } from '../-utils/paymentSummary';
import {
    formatRangeLabel,
    rangeToLocalIsoWindow,
    resolvePreset,
    type DateRangeValue,
} from '../-utils/dateRange';
import {
    fetchCollectionSummary,
    type CollectionSummary,
} from '@/routes/dashboard/-services/collection-summary-service';
import {
    fetchBillingSummary,
    fetchOutstandingLearners,
    type OutstandingLearner,
} from '@/services/payment-logs';
import { GatewayBadge } from './GatewayBadge';
import { PaymentKpiCards } from './PaymentKpiCards';
import { DateRangeDropdown } from './DateRangeDropdown';

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
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    // Same date control as Manage Payments, so a window picked on one screen means the same thing
    // on the other. Opens on the last 30 days.
    const [range, setRange] = useState<DateRangeValue>(() => resolvePreset('30d'));
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);

    const requestFilters: Omit<PaymentLogsRequest, 'institute_id'> = useMemo(() => {
        const w = rangeToLocalIsoWindow(range);
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
    // The KPI row is computed with the very same function Manage Payments uses.
    const summary = useMemo(() => computePaymentSummary(entries), [entries]);

    // Real collections trend (backend aggregate) for the same window. The window has to be spelled
    // with the request's own field names — spreading a {start,end} pair here silently charted all
    // time no matter which range was picked.
    const { data: collection } = useQuery<CollectionSummary>({
        queryKey: ['collection-summary-dash', instituteId, range],
        queryFn: () => {
            const w = rangeToLocalIsoWindow(range);
            return fetchCollectionSummary({
                institute_id: instituteId || '',
                start_date_in_utc: w.start,
                end_date_in_utc: w.end,
            });
        },
        enabled: !!instituteId,
        staleTime: 60_000,
        retry: false,
    });

    /**
     * Billed / collected / due, straight from the enrolments — the same figures Manage Payments
     * shows. Payment records can only report money that was actually raised, so an instalment plan
     * looks fully collected until this is asked for.
     */
    const { data: billingSummary } = useQuery({
        queryKey: ['payment-billing-summary-dash', range],
        queryFn: () => {
            const w = rangeToLocalIsoWindow(range);
            return fetchBillingSummary({ start_date_in_utc: w.start, end_date_in_utc: w.end });
        },
        staleTime: 60_000,
        retry: false,
    });
    // Same fallback as Manage Payments: derive billing from the rows when the endpoint is absent.
    const entryBilling = useMemo(() => computeBillingFromEntries(entries), [entries]);
    const billing = billingSummary
        ? {
              totalBilled: billingSummary.total_billed,
              collected: billingSummary.collected,
              due: billingSummary.due,
              currency: billingSummary.currency || '',
              planCount: billingSummary.plan_count,
              settledPlanCount: billingSummary.settled_plan_count,
          }
        : entryBilling.planCount > 0
          ? entryBilling
          : null;

    /**
     * Who the Due figure is made of. Without this the dashboard could report lakhs outstanding and
     * offer no way to see whose money it is.
     */
    const { data: outstanding } = useQuery({
        queryKey: ['payment-outstanding-dash', range],
        queryFn: () => {
            const w = rangeToLocalIsoWindow(range);
            return fetchOutstandingLearners(
                { start_date_in_utc: w.start, end_date_in_utc: w.end },
                0,
                6
            );
        },
        staleTime: 60_000,
        retry: false,
    });
    const debtors: OutstandingLearner[] = outstanding?.content ?? [];

    const currency = analytics.primaryCurrency || collection?.currency || '';
    const money = useMemo(() => makeMoney(currency), [currency]);

    const trendData = useMemo(
        () => (collection?.daily ?? []).map((p) => ({ ...p, label: p.date.slice(5) })),
        [collection]
    );

    const rangeLabel =
        range.preset === 'custom' ? formatRangeLabel(range) : formatRangeLabel(range).toLowerCase();
    const isEmpty = !isLoading && entries.length === 0;

    const handleExport = () => {
        if (entries.length === 0) {
            toast.info('No payment records to export for this period.');
            return;
        }
        try {
            const count = exportEntriesToCsv(entries, instituteDetails?.institute_name);
            toast.success(`Exported ${count.toLocaleString()} payment records.`);
        } catch (error) {
            console.error('Failed to export payment logs:', error);
            toast.error('Failed to export payment logs. Please try again.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar: the date window first, because it governs every number below it */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <DateRangeDropdown value={range} onChange={setRange} />
                    <p className="text-body text-neutral-500">
                        Collections and outstanding dues · {rangeLabel}
                    </p>
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

            {/* KPI row — the same five tiles as Manage Payments, from the same component */}
            <PaymentKpiCards
                summary={summary}
                billing={billing}
                totalCount={entries.length}
                isLoading={isLoading}
                truncated={data?.truncated}
            />

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
                        Pick a wider date range to see collection trends.
                    </p>
                </Card>
            ) : (
                <>
                    {/* Collections trend */}
                    <SectionCard
                        title="Collections trend"
                        subtitle={`Paid volume per day · ${rangeLabel}`}
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
                            subtitle="Payment records: raised, attempted, captured"
                        >
                            <FunnelBars analytics={analytics} money={money} />
                        </SectionCard>
                        <SectionCard
                            title="Who owes money"
                            subtitle={
                                outstanding
                                    ? `${outstanding.totalElements.toLocaleString()} ${
                                          outstanding.totalElements === 1 ? 'learner' : 'learners'
                                      } with a balance`
                                    : 'Outstanding balances by learner'
                            }
                            right={
                                <a
                                    href="/manage-payments"
                                    className="text-caption font-semibold text-primary-600 hover:text-primary-700"
                                >
                                    See all
                                </a>
                            }
                        >
                            {debtors.length === 0 ? (
                                <div className="py-8 text-center text-caption text-neutral-400">
                                    Nothing outstanding in this period
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {debtors.map((learner) => (
                                        <div
                                            key={learner.user_id}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-body font-medium text-neutral-700">
                                                    {learner.full_name || learner.email || '—'}
                                                </div>
                                                <div className="truncate text-caption text-neutral-500">
                                                    {[learner.course_name, learner.payment_type]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <div className="font-semibold tabular-nums text-warning-700">
                                                    {money(learner.due, true)}
                                                </div>
                                                <div className="text-caption text-neutral-400">
                                                    of {money(learner.billed, true)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                            Total / Collected / Due come from the enrolments themselves — what the
                            courses were billed at, what has been paid, and the balance, so the
                            three always reconcile. Payment pending and Failed count transactions at
                            the gateway instead, which is why an institute can show a large Due with
                            zero pending: those learners never started a payment, they simply owe
                            the rest of their fee. Every panel below this row counts payment records
                            too. Bank settlement timelines and gateway-reported decline reasons
                            aren’t available from the current API, so those panels are omitted
                            rather than estimated.
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
