/**
 * Reports Center — Overview tab.
 *
 * The original Lead Reports page content (KPI cards · status donut · daily
 * trend · source/tier breakdowns), now scoped by the shell's shared filters
 * (date range + team + counsellor). The counsellor performance table moved
 * to its own Counsellors tab.
 *
 * Data: GET /v1/reports/leads/summary (read-only — purely visual aggregation).
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
    CaretRight,
    ChartLineUp,
    CheckCircle,
    ClockCounterClockwise,
    Flame,
    Funnel,
    Megaphone,
    Users,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { fetchLeadReportSummary } from '../-services/get-lead-reports';
import {
    ALL_STATUSES_VALUE,
    CUSTOM_DATE_VALUE,
} from '../../recent-leads/-components/recent-leads-search';
import {
    BreakdownBar,
    BreakdownCard,
    EmptyHint,
    KpiCard,
    ReportErrorState,
    ReportTabSkeleton,
    fmtMinutes,
    fmtNumber,
    fmtPct,
    tierBgClass,
    type ReportTabProps,
} from './report-shared';

/** Where every drill-through on this tab lands. */
const RECENT_LEADS_ROUTE = '/audience-manager/recent-leads' as const;

export function OverviewTab({
    instituteId,
    fromDate,
    toDate,
    teamId,
    counsellorUserId,
    audienceId,
}: ReportTabProps) {
    const navigate = useNavigate();

    const summaryQuery = useQuery({
        queryKey: [
            'lead-report-summary',
            instituteId,
            fromDate,
            toDate,
            teamId,
            counsellorUserId,
            audienceId,
        ],
        queryFn: () =>
            fetchLeadReportSummary(
                instituteId,
                fromDate,
                toDate,
                teamId,
                counsellorUserId,
                audienceId
            ),
        enabled: !!instituteId,
        staleTime: 60_000,
        retry: false,
    });

    const summary = summaryQuery.data;
    const isLoading = summaryQuery.isLoading;

    if (isLoading) return <ReportTabSkeleton />;
    if (summaryQuery.isError) {
        return (
            <ReportErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
        );
    }

    return (
        <div className="flex flex-col gap-6">
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
                    onClick={() =>
                        // Total = every status incl. Converted, so override the
                        // recent-leads default "Active leads" filter to match.
                        navigate({
                            to: RECENT_LEADS_ROUTE,
                            search: {
                                status: ALL_STATUSES_VALUE,
                                range: CUSTOM_DATE_VALUE,
                                // Empty inputs would fail the route's yyyy-MM-dd
                                // schema — omit them instead.
                                from: fromDate || undefined,
                                to: toDate || undefined,
                            },
                        })
                    }
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
                        <StatusDonut
                            data={summary.by_status}
                            total={summary.totals.total_leads}
                            onSelectStatus={(statusKey) =>
                                navigate({
                                    to: RECENT_LEADS_ROUTE,
                                    search: { status: statusKey },
                                })
                            }
                        />
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
                                onClick={() =>
                                    navigate({
                                        to: RECENT_LEADS_ROUTE,
                                        search: { source: b.source_type },
                                    })
                                }
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
        </div>
    );
}

// ── Status donut chart ─────────────────────────────────────────────────

interface StatusDonutProps {
    data: Array<{ status_key: string; label: string; color: string | null; count: number }>;
    total: number;
    /** Drill-through — legend rows navigate to the filtered Recent Leads list. */
    onSelectStatus?: (statusKey: string) => void;
}
function StatusDonut({ data, total, onSelectStatus }: StatusDonutProps) {
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
                    <span className="text-2xl font-bold text-neutral-900">{fmtNumber(total)}</span>
                    <span className="text-xs text-neutral-500">leads</span>
                </div>
            </div>
            <ul className="flex w-full flex-col gap-1">
                {data.map((d) => {
                    const pct = total > 0 ? (d.count / total) * 100 : 0;
                    return (
                        <li key={d.status_key}>
                            <button
                                type="button"
                                onClick={() => onSelectStatus?.(d.status_key)}
                                disabled={!onSelectStatus}
                                className={cn(
                                    'group flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left text-sm',
                                    onSelectStatus && 'cursor-pointer hover:bg-neutral-50'
                                )}
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
                                    {onSelectStatus && (
                                        <CaretRight
                                            size={12}
                                            className="self-center text-neutral-300 transition-colors group-hover:text-neutral-500"
                                        />
                                    )}
                                </div>
                            </button>
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
