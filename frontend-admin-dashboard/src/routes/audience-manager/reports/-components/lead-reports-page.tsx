/**
 * Lead Reports — the read-only analytics dashboard for /audience-manager/reports.
 *
 * Sections (top to bottom):
 *   1. Page header — title + subtitle + applied range + refresh.
 *   2. Filter bar — date range (from/to), defaults to last 30 days.
 *   3. KPI cards — total leads · conversion rate · avg response time · TAT met %.
 *   4. Top visualisations — Status donut + Daily trend (side by side).
 *   5. Source + Tier breakdowns.
 *   6. Counsellor performance — sortable table with colour-coded rate cells.
 *
 * Data flows from /admin-core-service/v1/reports/{leads/summary,counselor-performance}; the page
 * never writes anything so it can't affect any business logic — purely visual aggregation.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ChartLineUp,
    Users,
    ClockCounterClockwise,
    CheckCircle,
    Funnel,
    Megaphone,
    Flame,
    ArrowsClockwise,
    CaretUp,
    CaretDown,
    Trophy,
    WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import {
    fetchLeadReportSummary,
    fetchCounselorPerformance,
    type CounselorPerformance,
    type CounselorRow,
} from '../-services/get-lead-reports';

// ── Helpers ────────────────────────────────────────────────────────────

const DEFAULT_DAYS = 30;
const toDateInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const computeDefaultRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (DEFAULT_DAYS - 1));
    return { from: toDateInput(start), to: toDateInput(now) };
};

function fmtMinutes(mins: number | null | undefined): string {
    if (mins == null || Number.isNaN(mins)) return '—';
    const totalMins = Math.max(0, Math.round(mins));
    const days = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const m = totalMins % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${m}m`;
    return `${m}m`;
}
function fmtPct(p: number | null | undefined): string {
    if (p == null || Number.isNaN(p)) return '—';
    return `${p.toFixed(1)}%`;
}
function fmtNumber(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString();
}

/** Tier → static Tailwind bg-class. Static enumeration so Tailwind keeps the classes. */
function tierBgClass(tier: string): string {
    switch (tier) {
        case 'HOT':
            return 'bg-red-500';
        case 'WARM':
            return 'bg-amber-500';
        case 'COLD':
            return 'bg-blue-500';
        default:
            return 'bg-neutral-400';
    }
}

/** Conversion rate buckets — green ≥15%, amber 5–14.99%, red <5%. */
function convRateClass(rate: number | null | undefined): string {
    if (rate == null) return 'text-neutral-400';
    if (rate >= 15) return 'text-green-700 font-semibold';
    if (rate >= 5) return 'text-amber-700 font-medium';
    return 'text-red-600 font-medium';
}
/** TAT met buckets — green ≥80%, amber 50–79.99%, red <50%. */
function tatMetClass(rate: number | null | undefined): string {
    if (rate == null) return 'text-neutral-400';
    if (rate >= 80) return 'text-green-700 font-semibold';
    if (rate >= 50) return 'text-amber-700 font-medium';
    return 'text-red-600 font-medium';
}

/** Deterministic avatar palette from a name — keeps the same colour for the same counsellor. */
const AVATAR_PALETTES = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
    'bg-red-100 text-red-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
] as const;
function avatarPalette(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTES[h % AVATAR_PALETTES.length]!;
}

// ── Main page ──────────────────────────────────────────────────────────

export function LeadReportsPage() {
    const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Lead Reports</h1>);
    }, [setNavHeading]);

    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';

    const defaults = useMemo(() => computeDefaultRange(), []);
    const [fromDate, setFromDate] = useState(defaults.from);
    const [toDate, setToDate] = useState(defaults.to);
    const [applied, setApplied] = useState(defaults);

    const summaryQuery = useQuery({
        queryKey: ['lead-report-summary', instituteId, applied.from, applied.to],
        queryFn: () => fetchLeadReportSummary(instituteId, applied.from, applied.to),
        enabled: !!instituteId,
        staleTime: 60_000,
    });
    const counsellorQuery = useQuery({
        queryKey: ['counselor-performance', instituteId, applied.from, applied.to],
        queryFn: () => fetchCounselorPerformance(instituteId, applied.from, applied.to),
        enabled: !!instituteId,
        staleTime: 60_000,
    });

    const apply = () => setApplied({ from: fromDate, to: toDate });
    const reset = () => {
        setFromDate(defaults.from);
        setToDate(defaults.to);
        setApplied(defaults);
    };
    const refresh = () => {
        summaryQuery.refetch();
        counsellorQuery.refetch();
    };

    const summary = summaryQuery.data;
    const performance = counsellorQuery.data;
    const isLoading = summaryQuery.isLoading || counsellorQuery.isLoading;
    const isRefreshing = summaryQuery.isFetching || counsellorQuery.isFetching;

    return (
        <div className="flex flex-col gap-6 bg-neutral-50 p-6 min-h-full">
            {/* Page header */}
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                        Lead Reports
                    </h1>
                    <p className="text-sm text-neutral-600">
                        Pipeline health, response times, and counsellor performance at a glance.
                    </p>
                </div>
                <Button
                    onClick={refresh}
                    size="sm"
                    variant="outline"
                    disabled={!instituteId || isRefreshing}
                    className="gap-2"
                >
                    <ArrowsClockwise
                        size={14}
                        className={cn(isRefreshing && 'animate-spin')}
                    />
                    Refresh
                </Button>
            </header>

            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="rep-from" className="text-xs text-neutral-600">
                        From
                    </Label>
                    <Input
                        id="rep-from"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-44"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="rep-to" className="text-xs text-neutral-600">
                        To
                    </Label>
                    <Input
                        id="rep-to"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-44"
                    />
                </div>
                <Button onClick={apply} size="sm" disabled={!instituteId}>
                    Apply
                </Button>
                <Button onClick={reset} size="sm" variant="ghost">
                    Reset
                </Button>
                {summary && (
                    <span className="ml-auto text-xs text-neutral-500">
                        Showing leads from{' '}
                        <strong className="text-neutral-700">
                            {summary.from_date.slice(0, 10)}
                        </strong>{' '}
                        to{' '}
                        <strong className="text-neutral-700">
                            {summary.to_date.slice(0, 10)}
                        </strong>
                    </span>
                )}
            </div>

            {!instituteId && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Pick an institute to view reports.
                </div>
            )}

            <Tabs defaultValue="overview" className="flex flex-col gap-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="overview" className="gap-2">
                        <ChartLineUp size={14} weight="bold" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="counsellor" className="gap-2">
                        <Users size={14} weight="bold" />
                        Counsellor Performance
                        {performance && performance.summary.total_counselors > 0 && (
                            <span className="ml-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                                {performance.summary.total_counselors}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="flex flex-col gap-6">
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Total Leads"
                    value={fmtNumber(summary?.totals.total_leads)}
                    sub={
                        summary
                            ? `${summary.totals.active_leads} active · ${summary.totals.lost_leads} lost`
                            : undefined
                    }
                    icon={<Users size={20} weight="bold" />}
                    tone="primary"
                    loading={isLoading && !summary}
                />
                <KpiCard
                    label="Conversion Rate"
                    value={fmtPct(summary?.totals.conversion_rate)}
                    sub={
                        summary
                            ? `${summary.totals.converted_leads} of ${summary.totals.total_leads} converted`
                            : undefined
                    }
                    icon={<CheckCircle size={20} weight="bold" />}
                    tone="success"
                    loading={isLoading && !summary}
                />
                <KpiCard
                    label="Avg Response Time"
                    value={fmtMinutes(summary?.totals.avg_response_minutes)}
                    sub={
                        summary
                            ? `${summary.totals.responded_leads ?? 0} leads responded`
                            : undefined
                    }
                    icon={<ClockCounterClockwise size={20} weight="bold" />}
                    tone="info"
                    loading={isLoading && !summary}
                />
                <KpiCard
                    label="TAT Met"
                    value={fmtPct(summary?.totals.tat_met_rate)}
                    sub={
                        summary?.totals.tat_met_count != null
                            ? `${summary.totals.tat_met_count} within TAT`
                            : 'TAT disabled in settings'
                    }
                    icon={<Funnel size={20} weight="bold" />}
                    tone={
                        summary?.totals.tat_met_rate == null
                            ? 'default'
                            : summary.totals.tat_met_rate >= 80
                              ? 'success'
                              : summary.totals.tat_met_rate >= 50
                                ? 'warning'
                                : 'danger'
                    }
                    loading={isLoading && !summary}
                />
            </div>

            {/* Status donut + Daily trend side by side */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Funnel size={18} className="text-neutral-500" />
                        <h2 className="text-base font-semibold text-neutral-900">
                            Status distribution
                        </h2>
                    </div>
                    {summary && summary.by_status.length > 0 ? (
                        <StatusDonut data={summary.by_status} total={summary.totals.total_leads} />
                    ) : (
                        <EmptyHint />
                    )}
                </section>

                <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ChartLineUp size={18} className="text-neutral-500" />
                            <h2 className="text-base font-semibold text-neutral-900">
                                Daily trend
                            </h2>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-neutral-600">
                            <span className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-blue-500" /> Submitted
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-green-600" /> Converted
                            </span>
                        </div>
                    </div>
                    {summary ? <TrendChart points={summary.trend_by_day} /> : <EmptyHint />}
                </section>
            </div>

            {/* Source + Tier breakdowns */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BreakdownCard title="By Source" icon={<Megaphone size={16} />}>
                    {summary && summary.by_source.length > 0 ? (
                        summary.by_source.map((b) => (
                            <BreakdownBar
                                key={b.source_type}
                                label={b.source_type}
                                count={b.total}
                                total={summary.totals.total_leads}
                                converted={b.converted}
                                colorClass="bg-primary-500"
                            />
                        ))
                    ) : (
                        <EmptyHint />
                    )}
                </BreakdownCard>
                <BreakdownCard title="By Tier" icon={<Flame size={16} />}>
                    {summary && summary.by_tier.length > 0 ? (
                        summary.by_tier.map((b) => (
                            <BreakdownBar
                                key={b.tier}
                                label={b.tier.charAt(0) + b.tier.slice(1).toLowerCase()}
                                count={b.count}
                                total={summary.totals.total_leads}
                                colorClass={tierBgClass(b.tier)}
                            />
                        ))
                    ) : (
                        <EmptyHint />
                    )}
                </BreakdownCard>
            </div>

                </TabsContent>

                <TabsContent value="counsellor" className="flex flex-col gap-6">
            {/* Counsellor performance */}
            <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Users size={18} className="text-neutral-500" />
                        <h2 className="text-base font-semibold text-neutral-900">
                            Counsellor performance
                        </h2>
                    </div>
                    {performance && (
                        <span className="text-xs text-neutral-500">
                            {performance.summary.total_counselors} counsellor
                            {performance.summary.total_counselors === 1 ? '' : 's'}
                            {performance.summary.avg_response_minutes != null && (
                                <>
                                    {' '}
                                    · avg resp{' '}
                                    <strong className="text-neutral-700">
                                        {fmtMinutes(performance.summary.avg_response_minutes)}
                                    </strong>
                                </>
                            )}
                            {performance.summary.avg_conversion_rate != null && (
                                <>
                                    {' '}
                                    · avg conv.{' '}
                                    <strong className="text-neutral-700">
                                        {fmtPct(performance.summary.avg_conversion_rate)}
                                    </strong>
                                </>
                            )}
                        </span>
                    )}
                </div>
                <CounsellorTable performance={performance} loading={counsellorQuery.isLoading} />
            </section>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Sub-components ─────────────────────────────────────────────────────

interface KpiCardProps {
    label: string;
    value: string;
    sub?: string;
    icon?: ReactNode;
    tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
    loading?: boolean;
}
function KpiCard({ label, value, sub, icon, tone = 'default', loading }: KpiCardProps) {
    const toneToIconClass: Record<NonNullable<KpiCardProps['tone']>, string> = {
        default: 'bg-neutral-100 text-neutral-600',
        primary: 'bg-blue-100 text-blue-600',
        success: 'bg-green-100 text-green-700',
        warning: 'bg-amber-100 text-amber-700',
        danger: 'bg-red-100 text-red-600',
        info: 'bg-indigo-100 text-indigo-600',
    };
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {label}
                </span>
                {icon && (
                    <div
                        className={cn(
                            'flex size-10 items-center justify-center rounded-lg',
                            toneToIconClass[tone]
                        )}
                    >
                        {icon}
                    </div>
                )}
            </div>
            {loading ? (
                <span className="h-8 w-24 animate-pulse rounded bg-neutral-100" />
            ) : (
                <span className="text-3xl font-bold tracking-tight text-neutral-900">{value}</span>
            )}
            {sub && <span className="text-xs text-neutral-500">{sub}</span>}
        </div>
    );
}

function BreakdownCard({
    title,
    icon,
    children,
}: {
    title: string;
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
                <span className="text-neutral-500">{icon}</span>
                <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    );
}

interface BreakdownBarProps {
    label: string;
    count: number;
    total: number;
    converted?: number;
    colorHex?: string;
    colorClass?: string;
}
function BreakdownBar({ label, count, total, converted, colorHex, colorClass }: BreakdownBarProps) {
    const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
    const cpct = converted != null && total > 0 ? Math.min(100, (converted / total) * 100) : 0;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="truncate text-neutral-700">{label}</span>
                <span className="font-medium text-neutral-900">
                    {count}
                    {converted != null && (
                        <span className="ml-2 text-xs text-green-700">({converted} conv.)</span>
                    )}
                </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                {colorHex ? (
                    /* Per-institute catalog colour + dynamic width — inline style is the
                       right call here, isolated to this rule. */
                    <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: colorHex }}
                    />
                ) : (
                    /* Width is data-driven; colour comes from a Tailwind utility class. */
                    <div
                        className={cn(
                            'absolute inset-y-0 left-0 rounded-full',
                            colorClass ?? 'bg-primary-500'
                        )}
                        style={{ width: `${pct}%` }}
                    />
                )}
                {converted != null && (
                    /* Overlay width is dynamic; isolated to this rule. */
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-green-600"
                        style={{ width: `${cpct}%` }}
                    />
                )}
            </div>
        </div>
    );
}

function EmptyHint() {
    return (
        <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
            No data in this range.
        </div>
    );
}

// ── Status donut chart ─────────────────────────────────────────────────

interface StatusDonutProps {
    data: Array<{ status_key: string; label: string; color: string | null; count: number }>;
    total: number;
}
function StatusDonut({ data, total }: StatusDonutProps) {
    const SIZE = 180;
    const THICKNESS = 26;
    const RADIUS = (SIZE - THICKNESS) / 2;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const CX = SIZE / 2;
    const CY = SIZE / 2;

    let offset = 0;
    const segments = data.map((d, i) => {
        const len = total > 0 ? (d.count / total) * CIRCUMFERENCE : 0;
        const seg = { ...d, dash: len, dashOffset: -offset, index: i };
        offset += len;
        return seg;
    });

    return (
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:gap-6">
            <div className="relative shrink-0">
                <svg
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="size-44"
                    role="img"
                    aria-label="Status distribution donut"
                >
                    {/* Track */}
                    <circle
                        cx={CX}
                        cy={CY}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={THICKNESS}
                        className="stroke-neutral-100"
                    />
                    {/* Segments */}
                    {segments.map((s) =>
                        s.color ? (
                            /* Per-institute catalog colour is data-driven; SVG stroke must be
                               a colour value, so this is the right place for the dynamic prop. */
                            <circle
                                key={s.status_key}
                                cx={CX}
                                cy={CY}
                                r={RADIUS}
                                fill="none"
                                stroke={s.color}
                                strokeWidth={THICKNESS}
                                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                                strokeDashoffset={s.dashOffset}
                                transform={`rotate(-90 ${CX} ${CY})`}
                            />
                        ) : (
                            <circle
                                key={s.status_key}
                                cx={CX}
                                cy={CY}
                                r={RADIUS}
                                fill="none"
                                strokeWidth={THICKNESS}
                                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                                strokeDashoffset={s.dashOffset}
                                transform={`rotate(-90 ${CX} ${CY})`}
                                className="stroke-primary-500"
                            />
                        )
                    )}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-neutral-900">
                        {fmtNumber(total)}
                    </span>
                    <span className="text-xs text-neutral-500">leads</span>
                </div>
            </div>
            <ul className="flex w-full flex-col gap-2">
                {data.map((d) => {
                    const pct = total > 0 ? (d.count / total) * 100 : 0;
                    return (
                        <li
                            key={d.status_key}
                            className="flex items-center justify-between gap-3 text-sm"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                {/* Catalog colour from API — isolated dynamic style. */}
                                <span
                                    className="size-3 shrink-0 rounded-sm"
                                    style={{ backgroundColor: d.color ?? undefined }}
                                />
                                <span className="truncate text-neutral-700">{d.label}</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-medium text-neutral-900">{d.count}</span>
                                <span className="text-xs text-neutral-500">
                                    {pct.toFixed(1)}%
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ── Daily trend (area-filled line chart) ───────────────────────────────

interface TrendChartProps {
    points: Array<{ date: string; submitted: number; converted: number }>;
}
function TrendChart({ points }: TrendChartProps) {
    if (points.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
                No data
            </div>
        );
    }
    const W = 700;
    const H = 180;
    const PAD = 32;
    const maxY = Math.max(1, ...points.map((p) => Math.max(p.submitted, p.converted)));
    const stepX = (W - PAD * 2) / Math.max(1, points.length - 1);
    const yFor = (v: number) => H - PAD - (v / maxY) * (H - PAD * 2);
    const xFor = (i: number) => PAD + i * stepX;
    const line = (key: 'submitted' | 'converted') =>
        points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p[key])}`).join(' ');
    const area = (key: 'submitted' | 'converted') =>
        `${line(key)} L ${xFor(points.length - 1)} ${H - PAD} L ${xFor(0)} ${H - PAD} Z`;
    const ticks = Array.from(
        new Set([0, Math.floor(points.length / 2), points.length - 1].filter((i) => i >= 0))
    );

    return (
        <div className="overflow-x-auto">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-44 w-full"
                preserveAspectRatio="none"
                role="img"
                aria-label="Daily submitted and converted leads"
            >
                {/* gridlines */}
                <line
                    x1={PAD}
                    y1={H - PAD}
                    x2={W - PAD}
                    y2={H - PAD}
                    className="stroke-neutral-200"
                />
                <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="stroke-neutral-200" />
                {[0.25, 0.5, 0.75].map((f) => (
                    <line
                        key={f}
                        x1={PAD}
                        y1={PAD + f * (H - PAD * 2)}
                        x2={W - PAD}
                        y2={PAD + f * (H - PAD * 2)}
                        className="stroke-neutral-100"
                    />
                ))}
                {/* Area fills — translucent solids via Tailwind opacity modifier (no hex). */}
                <path d={area('submitted')} className="fill-blue-500/20" />
                <path d={area('converted')} className="fill-green-600/20" />
                {/* Lines */}
                <path
                    d={line('submitted')}
                    strokeWidth="2"
                    fill="none"
                    className="stroke-blue-500"
                />
                <path
                    d={line('converted')}
                    strokeWidth="2"
                    fill="none"
                    className="stroke-green-600"
                />
                {/* Points */}
                {points.map((p, i) => (
                    <g key={p.date}>
                        <circle
                            cx={xFor(i)}
                            cy={yFor(p.submitted)}
                            r={3}
                            className="fill-blue-500"
                        />
                        <circle
                            cx={xFor(i)}
                            cy={yFor(p.converted)}
                            r={3}
                            className="fill-green-600"
                        />
                    </g>
                ))}
                {/* X labels */}
                {ticks.map((i) => (
                    <text
                        key={i}
                        x={xFor(i)}
                        y={H - 10}
                        fontSize="10"
                        textAnchor="middle"
                        className="fill-neutral-400"
                    >
                        {points[i]?.date.slice(5)}
                    </text>
                ))}
                {/* Y bounds */}
                <text
                    x={PAD - 5}
                    y={PAD + 5}
                    fontSize="10"
                    textAnchor="end"
                    className="fill-neutral-400"
                >
                    {maxY}
                </text>
                <text
                    x={PAD - 5}
                    y={H - PAD}
                    fontSize="10"
                    textAnchor="end"
                    className="fill-neutral-400"
                >
                    0
                </text>
            </svg>
        </div>
    );
}

// ── Sortable counsellor performance table ──────────────────────────────

type SortKey =
    | 'counselor_name'
    | 'leads_assigned'
    | 'leads_responded'
    | 'conversions'
    | 'conversion_rate'
    | 'avg_response_minutes'
    | 'tat_met_rate'
    | 'open_leads'
    | 'overdue_leads';

interface CounsellorTableProps {
    performance: CounselorPerformance | undefined;
    loading: boolean;
}
function CounsellorTable({ performance, loading }: CounsellorTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>('leads_assigned');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const sortedRows: CounselorRow[] = useMemo(() => {
        if (!performance) return [];
        const rows = [...performance.rows];
        rows.sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            // Nulls sink to the bottom regardless of direction.
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'asc' ? av - bv : bv - av;
            }
            const s = String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? s : -s;
        });
        return rows;
    }, [performance, sortKey, sortDir]);

    // Top performer = highest conversions (then highest conv. rate); only highlighted when ≥ 2 rows.
    const topRow = useMemo(() => {
        if (!performance || performance.rows.length < 2) return null;
        return [...performance.rows].sort((a, b) => {
            if (b.conversions !== a.conversions) return b.conversions - a.conversions;
            return (b.conversion_rate ?? 0) - (a.conversion_rate ?? 0);
        })[0];
    }, [performance]);

    if (loading) {
        return (
            <div className="py-8 text-center text-sm text-neutral-400">Loading counsellors…</div>
        );
    }
    if (!performance || performance.rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-neutral-400">
                <Users size={28} />
                No counsellor activity in this range.
            </div>
        );
    }

    const toggleSort = (k: SortKey) => {
        if (sortKey === k) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(k);
            setSortDir(k === 'counselor_name' ? 'asc' : 'desc');
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <SortableHeader
                            label="Counsellor"
                            sortKey="counselor_name"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                            align="left"
                        />
                        <SortableHeader
                            label="Assigned"
                            sortKey="leads_assigned"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="Responded"
                            sortKey="leads_responded"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="Conversions"
                            sortKey="conversions"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="Conv. rate"
                            sortKey="conversion_rate"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="Avg response"
                            sortKey="avg_response_minutes"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="TAT met"
                            sortKey="tat_met_rate"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="Open"
                            sortKey="open_leads"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                        <SortableHeader
                            label="Overdue"
                            sortKey="overdue_leads"
                            current={sortKey}
                            dir={sortDir}
                            onClick={toggleSort}
                        />
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((r) => {
                        const isTop =
                            topRow != null &&
                            r.counselor_id === topRow.counselor_id &&
                            r.conversions > 0;
                        return (
                            <tr
                                key={r.counselor_id}
                                className={cn(
                                    'border-b border-neutral-100 last:border-0 hover:bg-neutral-50',
                                    isTop && 'bg-amber-50/40'
                                )}
                            >
                                <td className="py-2.5 pr-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                'flex size-8 items-center justify-center rounded-full text-xs font-semibold',
                                                avatarPalette(r.counselor_name)
                                            )}
                                        >
                                            {(r.counselor_name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-neutral-900">
                                                {r.counselor_name}
                                            </span>
                                            {isTop && (
                                                <span className="flex items-center gap-1 text-xs text-amber-700">
                                                    <Trophy size={11} weight="fill" />
                                                    Top performer
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="py-2.5 pr-3 text-right text-neutral-800">
                                    {r.leads_assigned}
                                </td>
                                <td className="py-2.5 pr-3 text-right text-neutral-800">
                                    {r.leads_responded}
                                </td>
                                <td className="py-2.5 pr-3 text-right text-neutral-800">
                                    {r.conversions}
                                </td>
                                <td
                                    className={cn(
                                        'py-2.5 pr-3 text-right',
                                        convRateClass(r.conversion_rate)
                                    )}
                                >
                                    {fmtPct(r.conversion_rate)}
                                </td>
                                <td className="py-2.5 pr-3 text-right text-neutral-800">
                                    {fmtMinutes(r.avg_response_minutes)}
                                </td>
                                <td
                                    className={cn(
                                        'py-2.5 pr-3 text-right',
                                        tatMetClass(r.tat_met_rate)
                                    )}
                                >
                                    {fmtPct(r.tat_met_rate)}
                                </td>
                                <td className="py-2.5 pr-3 text-right text-neutral-800">
                                    {r.open_leads}
                                </td>
                                <td className="py-2.5 pr-3 text-right">
                                    {r.overdue_leads > 0 ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-red-600">
                                            <WarningCircle size={12} weight="fill" />
                                            {r.overdue_leads}
                                        </span>
                                    ) : (
                                        <span className="text-neutral-400">0</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

interface SortableHeaderProps {
    label: string;
    sortKey: SortKey;
    current: SortKey;
    dir: 'asc' | 'desc';
    onClick: (k: SortKey) => void;
    align?: 'left' | 'right';
}
function SortableHeader({
    label,
    sortKey,
    current,
    dir,
    onClick,
    align = 'right',
}: SortableHeaderProps) {
    const active = current === sortKey;
    return (
        <th
            className={cn(
                'cursor-pointer select-none py-2 pr-3 transition-colors hover:text-neutral-700',
                align === 'right' ? 'text-right' : 'text-left',
                active && 'text-neutral-700'
            )}
            onClick={() => onClick(sortKey)}
        >
            <span
                className={cn(
                    'inline-flex items-center gap-0.5',
                    align === 'right' && 'justify-end'
                )}
            >
                {label}
                {active &&
                    (dir === 'asc' ? <CaretUp size={10} /> : <CaretDown size={10} />)}
            </span>
        </th>
    );
}
