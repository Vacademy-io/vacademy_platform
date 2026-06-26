/**
 * Reports Center — Revenue Forecast tab.
 *
 * Projected revenue for the next 30 / 60 / 90 days (GET /v1/reports/revenue-forecast). Leads carry
 * no stored deal value, so each horizon blends two transparent signals — a trailing run-rate and a
 * pipeline-weighted estimate (open leads × historical conversion rate × avg deal value). The
 * assumptions panel shows every input. This tab ignores the page date filter: it always uses a
 * fixed trailing-history window.
 */
import { useQuery } from '@tanstack/react-query';
import { ChartLineUp, Info, TrendUp } from '@phosphor-icons/react';
import { fetchRevenueForecast, forecastQueryKey } from '../-services/get-revenue-reports';
import {
    EmptyHint,
    ReportErrorState,
    ReportSection,
    ReportTabSkeleton,
    fmtCurrency,
    fmtNumber,
    fmtPct,
    type ReportTabProps,
} from './report-shared';

export function ForecastTab({ instituteId, fromDate, toDate, teamId, counsellorUserId }: ReportTabProps) {
    // fromDate/toDate are part of the shared key but the forecast endpoint ignores them.
    const params = { instituteId, fromDate, toDate, teamId, counsellorUserId };
    const query = useQuery({
        queryKey: forecastQueryKey(params),
        queryFn: () => fetchRevenueForecast(params),
        enabled: !!instituteId,
        staleTime: 60_000,
        retry: false,
    });

    if (query.isLoading) return <ReportTabSkeleton />;
    if (query.isError) return <ReportErrorState error={query.error} onRetry={() => query.refetch()} />;

    const currency = query.data?.currency ?? 'INR';
    const horizons = query.data?.horizons ?? [];
    const a = query.data?.assumptions ?? null;

    return (
        <div className="flex flex-col gap-6">
            <ReportSection title="Revenue forecast" icon={<TrendUp size={18} />}>
                {horizons.length === 0 ? (
                    <EmptyHint message="Not enough history to forecast yet." />
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {horizons.map((h) => (
                            <div
                                key={h.days}
                                className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
                            >
                                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    Next {h.days} days
                                </span>
                                <span className="text-3xl font-bold tracking-tight text-green-700">
                                    {fmtCurrency(h.blended_revenue, currency)}
                                </span>
                                <span className="text-xs text-neutral-500">Blended estimate</span>
                                <div className="mt-1 flex flex-col gap-1.5 border-t border-neutral-100 pt-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Run-rate</span>
                                        <span className="font-medium text-neutral-800">
                                            {fmtCurrency(h.run_rate_revenue, currency)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Pipeline-weighted</span>
                                        <span className="font-medium text-neutral-800">
                                            {fmtCurrency(h.pipeline_revenue, currency)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ReportSection>

            {a && (
                <ReportSection title="How this is calculated" icon={<Info size={18} />}>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        <Assumption label={`Revenue (last ${a.trailing_days}d)`} value={fmtCurrency(a.trailing_revenue, currency)} />
                        <Assumption label="Avg daily revenue" value={fmtCurrency(a.avg_daily_revenue, currency)} />
                        <Assumption label={`Leads (last ${a.trailing_days}d)`} value={fmtNumber(a.trailing_leads)} />
                        <Assumption label={`Conversions (last ${a.trailing_days}d)`} value={fmtNumber(a.trailing_conversions)} />
                        <Assumption label="Historical conv. rate" value={fmtPct(a.historical_conversion_rate)} />
                        <Assumption label="Avg deal value" value={fmtCurrency(a.avg_deal_value, currency)} />
                        <Assumption label="Open pipeline leads" value={fmtNumber(a.open_pipeline_leads)} />
                    </div>
                    <p className="flex items-start gap-1.5 text-xs text-neutral-400">
                        <ChartLineUp size={13} className="mt-0.5 shrink-0" />
                        Run-rate = average daily revenue × horizon. Pipeline-weighted = open leads ×
                        historical conversion rate × avg deal value, ramped in by horizon. Blended is
                        the average of the two. The forecast uses a fixed trailing window, not the page
                        date filter.
                    </p>
                </ReportSection>
            )}
        </div>
    );
}

function Assumption({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
            <span className="text-xs text-neutral-500">{label}</span>
            <span className="text-sm font-semibold text-neutral-900">{value}</span>
        </div>
    );
}
