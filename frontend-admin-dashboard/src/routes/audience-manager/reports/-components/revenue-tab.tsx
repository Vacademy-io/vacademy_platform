/**
 * Reports Center — Revenue tab.
 *
 * Collected revenue from CONVERTED leads (GET /v1/reports/revenue): KPI strip, a daily revenue
 * trend, and per-source / per-counsellor breakdown tables. Revenue counts a payment only once the
 * lead it came from is converted, so totals here are "money won", not gross billing.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CurrencyCircleDollar, Megaphone, Receipt, TrendUp, Users } from '@phosphor-icons/react';
import {
    fetchRevenue,
    revenueQueryKey,
    type RevenueCounsellorRow,
    type RevenueSourceRow,
} from '../-services/get-revenue-reports';
import {
    EmptyHint,
    ExportWithColumnPickerButton,
    KpiCard,
    ReportErrorState,
    ReportSection,
    ReportTabSkeleton,
    SortableHeader,
    fmtCurrency,
    fmtNumber,
    type ReportTabProps,
} from './report-shared';

type SourceSortKey = 'source_type' | 'revenue' | 'paying_leads' | 'payments' | 'avg_deal_value';
type CounsellorSortKey = 'name' | 'revenue' | 'paying_leads' | 'payments' | 'avg_deal_value';

export function RevenueTab({
    instituteId,
    fromDate,
    toDate,
    teamId,
    counsellorUserId,
}: ReportTabProps) {
    const params = { instituteId, fromDate, toDate, teamId, counsellorUserId };
    const query = useQuery({
        queryKey: revenueQueryKey(params),
        queryFn: () => fetchRevenue(params),
        enabled: !!instituteId,
        staleTime: 60_000,
        retry: false,
    });

    const [srcSort, setSrcSort] = useState<SourceSortKey>('revenue');
    const [srcDir, setSrcDir] = useState<'asc' | 'desc'>('desc');
    const [cslSort, setCslSort] = useState<CounsellorSortKey>('revenue');
    const [cslDir, setCslDir] = useState<'asc' | 'desc'>('desc');

    const currency = query.data?.currency ?? 'INR';

    const sources = useMemo(
        () => sortRows(query.data?.by_source ?? [], srcSort, srcDir),
        [query.data, srcSort, srcDir]
    );
    const counsellors = useMemo(
        () => sortRows(query.data?.by_counsellor ?? [], cslSort, cslDir),
        [query.data, cslSort, cslDir]
    );

    if (query.isLoading) return <ReportTabSkeleton />;
    if (query.isError)
        return <ReportErrorState error={query.error} onRetry={() => query.refetch()} />;

    const totals = query.data?.totals ?? null;
    const trend = query.data?.trend ?? [];
    const peakRevenue = Math.max(1, ...trend.map((d) => d.revenue));

    const toggleSrc = (k: SourceSortKey) => {
        if (srcSort === k) setSrcDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSrcSort(k);
            setSrcDir(k === 'source_type' ? 'asc' : 'desc');
        }
    };
    const toggleCsl = (k: CounsellorSortKey) => {
        if (cslSort === k) setCslDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setCslSort(k);
            setCslDir(k === 'name' ? 'asc' : 'desc');
        }
    };


    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Revenue"
                    value={fmtCurrency(totals?.revenue ?? 0, currency)}
                    icon={<CurrencyCircleDollar size={18} />}
                    tone="success"
                    sub="Collected from converted leads"
                />
                <KpiCard
                    label="Paying leads"
                    value={fmtNumber(totals?.paying_leads ?? 0)}
                    icon={<Users size={18} />}
                    tone="primary"
                />
                <KpiCard
                    label="Avg deal value"
                    value={fmtCurrency(totals?.avg_deal_value ?? null, currency)}
                    icon={<TrendUp size={18} />}
                    tone="info"
                />
                <KpiCard
                    label="Payments"
                    value={fmtNumber(totals?.payments ?? 0)}
                    icon={<Receipt size={18} />}
                />
            </div>

            <ReportSection title="Daily revenue" icon={<TrendUp size={18} />}>
                {trend.length === 0 || trend.every((d) => d.revenue === 0) ? (
                    <EmptyHint message="No revenue in this range." />
                ) : (
                    <div className="flex h-40 items-end gap-0.5 overflow-x-auto">
                        {trend.map((d) => (
                            <div
                                key={d.date}
                                className="group flex flex-1 flex-col items-center gap-1"
                            >
                                <div className="relative flex w-full flex-1 items-end">
                                    <div
                                        className="w-full rounded-t bg-green-500/80 transition-colors group-hover:bg-green-600"
                                        style={{
                                            height: `${Math.max(2, (d.revenue / peakRevenue) * 100)}%`,
                                        }}
                                        title={`${d.date}: ${fmtCurrency(d.revenue, currency)} (${d.payments} payments)`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-xs text-neutral-400">
                    Revenue is recognized on the payment date for leads whose profile is converted.
                </p>
            </ReportSection>

            <ReportSection
                title="Revenue by source"
                icon={<Megaphone size={18} />}
                actions={
                    <ExportWithColumnPickerButton
                        filename={`revenue-by-source_${fromDate}_${toDate}.csv`}
                        disabled={sources.length === 0}
                        getHeadersAndRows={() => ({
                            headers: ['Source', 'Revenue', 'Paying leads', 'Payments', 'Avg deal value'],
                            rows: sources.map((r) => [
                                r.source_type,
                                r.revenue,
                                r.paying_leads,
                                r.payments,
                                r.avg_deal_value,
                            ]),
                        })}
                    />
                }
            >
                {sources.length === 0 ? (
                    <EmptyHint message="No revenue in this range." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                                    <SortableHeader
                                        label="Source"
                                        sortKey="source_type"
                                        current={srcSort}
                                        dir={srcDir}
                                        onClick={toggleSrc}
                                        align="left"
                                    />
                                    <SortableHeader
                                        label="Revenue"
                                        sortKey="revenue"
                                        current={srcSort}
                                        dir={srcDir}
                                        onClick={toggleSrc}
                                    />
                                    <SortableHeader
                                        label="Paying leads"
                                        sortKey="paying_leads"
                                        current={srcSort}
                                        dir={srcDir}
                                        onClick={toggleSrc}
                                    />
                                    <SortableHeader
                                        label="Payments"
                                        sortKey="payments"
                                        current={srcSort}
                                        dir={srcDir}
                                        onClick={toggleSrc}
                                    />
                                    <SortableHeader
                                        label="Avg deal value"
                                        sortKey="avg_deal_value"
                                        current={srcSort}
                                        dir={srcDir}
                                        onClick={toggleSrc}
                                    />
                                </tr>
                            </thead>
                            <tbody>
                                {sources.map((r) => (
                                    <tr
                                        key={r.source_type}
                                        className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                                    >
                                        <td className="py-2.5 pr-3 font-medium text-neutral-900">
                                            {r.source_type}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right font-semibold text-green-700">
                                            {fmtCurrency(r.revenue, currency)}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-neutral-800">
                                            {fmtNumber(r.paying_leads)}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-neutral-800">
                                            {fmtNumber(r.payments)}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-neutral-800">
                                            {fmtCurrency(r.avg_deal_value, currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </ReportSection>

            <ReportSection
                title="Revenue by counsellor"
                icon={<Users size={18} />}
                actions={
                    <ExportWithColumnPickerButton
                        filename={`revenue-by-counsellor_${fromDate}_${toDate}.csv`}
                        disabled={counsellors.length === 0}
                        getHeadersAndRows={() => ({
                            headers: ['Counsellor', 'Revenue', 'Paying leads', 'Payments', 'Avg deal value'],
                            rows: counsellors.map((r) => [
                                r.name ?? r.user_id,
                                r.revenue,
                                r.paying_leads,
                                r.payments,
                                r.avg_deal_value,
                            ]),
                        })}
                    />
                }
            >
                {counsellors.length === 0 ? (
                    <EmptyHint message="No counsellor-attributed revenue in this range." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                                    <SortableHeader
                                        label="Counsellor"
                                        sortKey="name"
                                        current={cslSort}
                                        dir={cslDir}
                                        onClick={toggleCsl}
                                        align="left"
                                    />
                                    <SortableHeader
                                        label="Revenue"
                                        sortKey="revenue"
                                        current={cslSort}
                                        dir={cslDir}
                                        onClick={toggleCsl}
                                    />
                                    <SortableHeader
                                        label="Paying leads"
                                        sortKey="paying_leads"
                                        current={cslSort}
                                        dir={cslDir}
                                        onClick={toggleCsl}
                                    />
                                    <SortableHeader
                                        label="Payments"
                                        sortKey="payments"
                                        current={cslSort}
                                        dir={cslDir}
                                        onClick={toggleCsl}
                                    />
                                    <SortableHeader
                                        label="Avg deal value"
                                        sortKey="avg_deal_value"
                                        current={cslSort}
                                        dir={cslDir}
                                        onClick={toggleCsl}
                                    />
                                </tr>
                            </thead>
                            <tbody>
                                {counsellors.map((r) => (
                                    <tr
                                        key={r.user_id}
                                        className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                                    >
                                        <td className="py-2.5 pr-3 font-medium text-neutral-900">
                                            {r.name ?? r.user_id}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right font-semibold text-green-700">
                                            {fmtCurrency(r.revenue, currency)}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-neutral-800">
                                            {fmtNumber(r.paying_leads)}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-neutral-800">
                                            {fmtNumber(r.payments)}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-neutral-800">
                                            {fmtCurrency(r.avg_deal_value, currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </ReportSection>
        </div>
    );
}

/** Generic null-aware sort shared by both tables. */
function sortRows<T extends RevenueSourceRow | RevenueCounsellorRow, K extends keyof T>(
    rows: T[],
    key: K,
    dir: 'asc' | 'desc'
): T[] {
    const list = [...rows];
    list.sort((a, b) => {
        const av = a[key] as unknown;
        const bv = b[key] as unknown;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number')
            return dir === 'asc' ? av - bv : bv - av;
        const s = String(av).localeCompare(String(bv));
        return dir === 'asc' ? s : -s;
    });
    return list;
}
