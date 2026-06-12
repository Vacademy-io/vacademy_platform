import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CaretRight } from '@phosphor-icons/react';
import { Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchFunnel } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId: string | undefined;
    from: number | undefined;
    to: number | undefined;
}

/**
 * Tapered conversion funnel — same recharts `FunnelChart` pattern that
 * /challenge-analytics → ChurnAnalysis uses, so the visual identity is
 * consistent across dashboards. Recharts renders each stage as a real
 * trapezoid whose width interpolates between its count and the next stage's,
 * which is the "this is actually a funnel" shape the previous CSS-band
 * version couldn't produce.
 *
 * Backend supplies a per-stage colour from the institute's status palette;
 * unknown / missing colours fall back to a sequential green→amber→red ramp
 * so the eye reads "good at the top, attrition at the bottom" by default.
 */
// prettier-ignore
const FALLBACK_COLORS = ['#10B981', '#22C55E', '#84CC16', '#EAB308', '#F59E0B', '#F97316', '#EF4444']; // design-lint-ignore: recharts fill props need concrete colors (green→red ramp)

export function ConversionFunnelWidget({ instituteId, teamId, from, to }: Props) {
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-funnel', instituteId, teamId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchFunnel(instituteId, teamId, from, to),
    });

    const stages = data ?? [];

    // Recharts needs `name` + `value` keys; we also carry the original count
    // so the tooltip + side-rail can use it. Filter zero stages out — a
    // recharts Funnel with 0-value cells renders as a flat sliver that
    // breaks the taper.
    const funnelData = stages
        .filter((s) => s.count > 0)
        .map((s, idx) => ({
            name: s.label,
            value: s.count,
            statusKey: s.status_key,
            fill: s.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
        }));

    // Per-stage drop-off vs the previous stage — useful in the right rail.
    // Computed off the FULL stages list (including zeros) so the percentages
    // don't lie about a stage that was filtered for rendering.
    const dropoffs = stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1]?.count ?? 0 : null;
        if (prev == null || prev <= 0) return null;
        return Math.round(((prev - s.count) / prev) * 100);
    });

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">Conversion funnel</h3>
                <p className="text-caption text-neutral-500">Pipeline by status</p>
            </div>
            {isLoading ? (
                <div className="flex h-64 items-center justify-center text-subtitle text-neutral-500">
                    Loading…
                </div>
            ) : stages.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-subtitle text-neutral-500">
                    No data yet.
                </div>
            ) : funnelData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-subtitle text-neutral-500">
                    Every stage is empty in this window.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                    {/* Funnel itself */}
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <Tooltip content={<FunnelTooltip />} />
                                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                                    <LabelList
                                        position="right"
                                        fill="#4b5563" // design-lint-ignore: recharts SVG fill needs a concrete color (neutral-600)
                                        stroke="none"
                                        dataKey="name"
                                        fontSize={12}
                                    />
                                    <LabelList
                                        position="center"
                                        fill="#ffffff" // design-lint-ignore: recharts SVG fill needs a concrete color (white)
                                        stroke="none"
                                        dataKey="value"
                                        fontSize={13}
                                        fontWeight={600}
                                    />
                                    {funnelData.map((entry) => (
                                        <Cell key={entry.statusKey} fill={entry.fill} />
                                    ))}
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Per-stage drop-off rail — keeps the "where am I losing
                        people" answer one glance away. Each row drills through
                        to Recent Leads filtered to that status. */}
                    <ul className="space-y-1 md:w-48">
                        {stages.map((s, i) => {
                            // `noUncheckedIndexedAccess` makes array reads
                            // `T | undefined`; `dropoffs` is built off the
                            // same stages list so `dropoffs[i]` is in
                            // range, but TS can't prove it — coerce the
                            // missing case to null so DropoffChip's
                            // `number | null` prop stays honest.
                            const dropPct = dropoffs[i] ?? null;
                            return (
                                <li key={s.status_key}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate({
                                                to: '/audience-manager/recent-leads',
                                                search: { status: s.status_key },
                                            })
                                        }
                                        className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left text-caption hover:bg-neutral-50"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="inline-block size-2.5 shrink-0 rounded-sm"
                                            style={{
                                                backgroundColor:
                                                    s.color ||
                                                    FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                                            }}
                                        />
                                        <span className="flex-1 truncate text-neutral-700">
                                            {s.label}
                                        </span>
                                        <span className="font-medium text-neutral-900">
                                            {s.count}
                                        </span>
                                        <DropoffChip pct={dropPct} />
                                        <CaretRight
                                            size={12}
                                            className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500"
                                        />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
}

function FunnelTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ payload?: { name?: string; value?: number; statusKey?: string }; value?: number }>;
}) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-md">
            <p className="text-body font-medium text-neutral-900">{item?.payload?.name}</p>
            <p className="text-caption text-neutral-600">
                <span className="font-semibold text-neutral-900">
                    {item?.value?.toLocaleString()}
                </span>{' '}
                lead{item?.value === 1 ? '' : 's'}
            </p>
        </div>
    );
}

function DropoffChip({ pct }: { pct: number | null }) {
    if (pct == null)
        return <span className="w-14 text-right text-neutral-400">—</span>;
    if (pct === 0)
        return <span className="w-14 text-right font-medium text-success-700">held</span>;
    if (pct < 0)
        return (
            <span className="w-14 text-right font-medium text-info-700">
                +{Math.abs(pct)}%
            </span>
        );
    return (
        <span
            className={`w-14 text-right font-medium ${
                pct > 50 ? 'text-danger-700' : 'text-warning-700'
            }`}
        >
            −{pct}%
        </span>
    );
}
