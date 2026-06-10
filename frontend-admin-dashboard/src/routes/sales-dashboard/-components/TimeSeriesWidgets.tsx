import { useQuery } from '@tanstack/react-query';
import { fetchNewVsExisting, fetchReassignmentSeries } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId: string | undefined;
    from: number | undefined;
    to: number | undefined;
}

interface SeriesPoint {
    date: string;
    primary?: number | null;
    secondary?: number | null;
}

const CHART_HEIGHT = 160;
const BAR_WIDTH = 24;
const BAR_GAP = 6;

export function NewVsExistingLeadsWidget({ instituteId, teamId, from, to }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-new-vs-existing', instituteId, teamId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchNewVsExisting(instituteId, teamId, from, to),
    });

    return (
        <ChartShell
            title="New vs existing leads"
            legend={[
                { label: 'New', color: 'bg-primary-500' },
                { label: 'Existing', color: 'bg-neutral-400' },
            ]}
            isLoading={isLoading}
            isEmpty={!data || data.length === 0}
            emptyLabel="No activity in this window."
        >
            <StackedBars
                points={data ?? []}
                primaryLabel="New"
                secondaryLabel="Existing"
                primaryColor="fill-primary-500"
                secondaryColor="fill-neutral-400"
            />
        </ChartShell>
    );
}

export function ReassignmentVolumeWidget({
    instituteId,
    from,
    to,
}: {
    instituteId: string;
    from: number | undefined;
    to: number | undefined;
}) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-reassignments', instituteId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchReassignmentSeries(instituteId, from, to),
    });

    return (
        <ChartShell
            title="Reassignment volume"
            subtitle="Leads transferred per day"
            isLoading={isLoading}
            isEmpty={!data || data.length === 0}
            emptyLabel="No reassignments in this window."
        >
            <SingleBars points={data ?? []} label="Reassigns" color="fill-warning-500" />
        </ChartShell>
    );
}

// ─── Shell ────────────────────────────────────────────────────

function ChartShell({
    title,
    subtitle,
    legend,
    isLoading,
    isEmpty,
    emptyLabel,
    children,
}: {
    title: string;
    subtitle?: string;
    legend?: { label: string; color: string }[];
    isLoading: boolean;
    isEmpty: boolean;
    emptyLabel: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-h4 font-medium text-neutral-900">{title}</h3>
                    {subtitle && (
                        <p className="text-caption text-neutral-500">{subtitle}</p>
                    )}
                </div>
                {legend && (
                    <ul className="flex flex-wrap items-center gap-3">
                        {legend.map((l) => (
                            <li
                                key={l.label}
                                className="inline-flex items-center gap-1.5 text-caption text-neutral-600"
                            >
                                <span className={`inline-block size-2 rounded-sm ${l.color}`} />
                                {l.label}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {isLoading ? (
                <div className="flex h-40 items-center justify-center text-subtitle text-neutral-500">
                    Loading…
                </div>
            ) : isEmpty ? (
                <div className="flex h-40 items-center justify-center text-subtitle text-neutral-500">
                    {emptyLabel}
                </div>
            ) : (
                children
            )}
        </section>
    );
}

// ─── Stacked (two-series) chart ───────────────────────────────

function StackedBars({
    points,
    primaryLabel,
    secondaryLabel,
    primaryColor,
    secondaryColor,
}: {
    points: SeriesPoint[];
    primaryLabel: string;
    secondaryLabel: string;
    /** Tailwind `fill-…` token. */
    primaryColor: string;
    /** Tailwind `fill-…` token. */
    secondaryColor: string;
}) {
    const max = Math.max(1, ...points.map((p) => (p.primary ?? 0) + (p.secondary ?? 0)));
    const ticks = niceTicks(max);
    const niceMax = ticks[ticks.length - 1] ?? max;
    const innerHeight = CHART_HEIGHT;
    const width = points.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex">
                <YAxis ticks={ticks} max={niceMax} />
                <div className="flex flex-col">
                    <svg
                        width={Math.max(width, 1)}
                        height={innerHeight}
                        className="overflow-visible"
                        role="img"
                        aria-label={`${primaryLabel} and ${secondaryLabel} per day`}
                    >
                        <Gridlines
                            ticks={ticks}
                            max={niceMax}
                            height={innerHeight}
                            width={width}
                        />
                        {points.map((p, i) => {
                            const x = i * (BAR_WIDTH + BAR_GAP);
                            const newCount = p.primary ?? 0;
                            const exCount = p.secondary ?? 0;
                            const newH = (newCount / niceMax) * innerHeight;
                            const exH = (exCount / niceMax) * innerHeight;
                            return (
                                <g key={p.date}>
                                    {/* Existing on bottom, New stacked on top */}
                                    <rect
                                        x={x}
                                        y={innerHeight - exH}
                                        width={BAR_WIDTH}
                                        height={exH}
                                        className={secondaryColor}
                                        rx={2}
                                    >
                                        <title>
                                            {fmtDateLong(p.date)} · {secondaryLabel}: {exCount}
                                        </title>
                                    </rect>
                                    <rect
                                        x={x}
                                        y={innerHeight - exH - newH}
                                        width={BAR_WIDTH}
                                        height={newH}
                                        className={primaryColor}
                                        rx={2}
                                    >
                                        <title>
                                            {fmtDateLong(p.date)} · {primaryLabel}: {newCount}
                                        </title>
                                    </rect>
                                </g>
                            );
                        })}
                    </svg>
                    <XAxis points={points} />
                </div>
            </div>
        </div>
    );
}

// ─── Single-series chart ──────────────────────────────────────

function SingleBars({
    points,
    label,
    color,
}: {
    points: SeriesPoint[];
    label: string;
    /** Tailwind `fill-…` token. */
    color: string;
}) {
    const max = Math.max(1, ...points.map((p) => p.primary ?? 0));
    const ticks = niceTicks(max);
    const niceMax = ticks[ticks.length - 1] ?? max;
    const innerHeight = CHART_HEIGHT;
    const width = points.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex">
                <YAxis ticks={ticks} max={niceMax} />
                <div className="flex flex-col">
                    <svg
                        width={Math.max(width, 1)}
                        height={innerHeight}
                        className="overflow-visible"
                        role="img"
                        aria-label={`${label} per day`}
                    >
                        <Gridlines
                            ticks={ticks}
                            max={niceMax}
                            height={innerHeight}
                            width={width}
                        />
                        {points.map((p, i) => {
                            const x = i * (BAR_WIDTH + BAR_GAP);
                            const count = p.primary ?? 0;
                            const h = (count / niceMax) * innerHeight;
                            return (
                                <g key={p.date}>
                                    <rect
                                        x={x}
                                        y={innerHeight - h}
                                        width={BAR_WIDTH}
                                        height={h}
                                        className={color}
                                        rx={2}
                                    >
                                        <title>
                                            {fmtDateLong(p.date)} · {label}: {count}
                                        </title>
                                    </rect>
                                </g>
                            );
                        })}
                    </svg>
                    <XAxis points={points} />
                </div>
            </div>
        </div>
    );
}

// ─── Axes + gridlines ─────────────────────────────────────────

function YAxis({ ticks, max }: { ticks: number[]; max: number }) {
    return (
        <div
            className="mr-2 flex flex-col justify-between pr-1 text-right text-caption text-neutral-400"
            style={{ height: CHART_HEIGHT, minWidth: 28 }}
        >
            {[...ticks].reverse().map((t) => (
                <span key={t}>{t}</span>
            ))}
            {ticks.length === 0 && <span>{max}</span>}
        </div>
    );
}

function Gridlines({
    ticks,
    max,
    height,
    width,
}: {
    ticks: number[];
    max: number;
    height: number;
    width: number;
}) {
    return (
        <g aria-hidden="true">
            {ticks.map((t) => {
                const y = height - (t / max) * height;
                return (
                    <line
                        key={t}
                        x1={0}
                        x2={width}
                        y1={y}
                        y2={y}
                        className="stroke-neutral-100"
                        strokeWidth={1}
                    />
                );
            })}
        </g>
    );
}

function XAxis({ points }: { points: SeriesPoint[] }) {
    // With many points the labels overlap; thin them out so every Nth shows.
    const step = points.length > 14 ? Math.ceil(points.length / 7) : 1;
    return (
        <div
            className="flex pt-1"
            style={{ gap: `${BAR_GAP}px` }}
            aria-hidden="true"
        >
            {points.map((p, i) => (
                <span
                    key={p.date}
                    className="text-center text-caption text-neutral-500"
                    style={{ width: BAR_WIDTH, minWidth: BAR_WIDTH }}
                >
                    {i % step === 0 ? fmtDateShort(p.date) : ''}
                </span>
            ))}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Generate "nice" Y-axis ticks (3 evenly-spaced values from 0 to a rounded
 * max). Avoids weird upper bounds like "23" by snapping up to 5/10/25/50/etc.
 */
function niceTicks(rawMax: number): number[] {
    if (rawMax <= 0) return [0, 1];
    const exp = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const mantissa = rawMax / exp;
    let niceMantissa: number;
    if (mantissa <= 1) niceMantissa = 1;
    else if (mantissa <= 2) niceMantissa = 2;
    else if (mantissa <= 5) niceMantissa = 5;
    else niceMantissa = 10;
    const niceMax = niceMantissa * exp;
    return [0, niceMax / 2, niceMax];
}

function fmtDateShort(iso: string): string {
    // iso comes from the backend as YYYY-MM-DD. Render "May 22" so the
    // user doesn't have to mentally translate "05-22".
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
}

function fmtDateLong(iso: string): string {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
}
