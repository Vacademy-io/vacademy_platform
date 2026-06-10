import { useQuery } from '@tanstack/react-query';
import { fetchConversionBySource } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId?: string | undefined;
    /** When set, scope to this single counsellor's leads (used by the
     *  counsellors detail drawer). Otherwise team / caller RBAC applies. */
    counsellorUserId?: string | undefined;
    from?: number | undefined;
    to?: number | undefined;
}

/**
 * Where the conversions are coming from. Each row = one lead source with
 * inbound volume, converted count, and a conversion-rate %.
 *
 * Rendered as a list so the row-by-row comparison stays scannable; the
 * percentage doubles as the bar width so the eye can spot the
 * best-converting source without reading numbers.
 */
export function ConversionBySourceWidget({
    instituteId,
    teamId,
    counsellorUserId,
    from,
    to,
}: Props) {
    const { data, isLoading } = useQuery({
        queryKey: [
            'sales-dashboard-source-conversion',
            instituteId,
            teamId,
            counsellorUserId,
            from,
            to,
        ],
        enabled: !!instituteId,
        queryFn: () => fetchConversionBySource(instituteId, teamId, counsellorUserId, from, to),
    });

    const rows = data ?? [];
    const totalLeads = rows.reduce((s, r) => s + r.leads, 0);

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">Conversion by source</h3>
                <p className="text-caption text-neutral-500">
                    Where the converted leads came from
                </p>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : rows.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No leads in this window.</div>
            ) : (
                <ul className="space-y-2">
                    {rows.map((r) => {
                        const widthPct = totalLeads > 0 ? (r.leads / totalLeads) * 100 : 0;
                        return (
                            <li key={r.source} className="space-y-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-body font-medium capitalize text-neutral-900">
                                        {r.source.toLowerCase()}
                                    </span>
                                    <span className="text-caption text-neutral-500">
                                        {r.conversions} / {r.leads} ·{' '}
                                        <span className="font-semibold text-neutral-700">
                                            {r.conversion_rate.toFixed(1)}%
                                        </span>
                                    </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded bg-neutral-100">
                                    <div
                                        className="h-full bg-primary-500"
                                        // Dynamic % bar — width is data-driven, not stylistic.
                                        style={{ width: `${Math.max(2, widthPct)}%` }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
