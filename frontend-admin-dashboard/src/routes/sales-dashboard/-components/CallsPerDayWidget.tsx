import { useQuery } from '@tanstack/react-query';
import { fetchCallsPerDay } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId?: string | undefined;
    /** When set, scope to this single counsellor (used by the counsellors
     *  detail drawer). Otherwise team / caller RBAC applies. */
    counsellorUserId?: string | undefined;
    from?: number | undefined;
    to?: number | undefined;
}

/**
 * Daily call volume for the in-scope counsellors. Drives the
 * "how active is my team" view — CSO sees how many calls each day went out
 * across their reports (or just themselves if they're a leaf member).
 *
 * Visual: vertical bars, one per day, height-scaled to the peak.
 */
export function CallsPerDayWidget({
    instituteId,
    teamId,
    counsellorUserId,
    from,
    to,
}: Props) {
    const { data, isLoading } = useQuery({
        queryKey: [
            'sales-dashboard-calls-per-day',
            instituteId,
            teamId,
            counsellorUserId,
            from,
            to,
        ],
        enabled: !!instituteId,
        queryFn: () => fetchCallsPerDay(instituteId, teamId, counsellorUserId, from, to),
    });

    const series = data ?? [];
    const max = Math.max(1, ...series.map((p) => p.primary ?? 0));
    const totalCalls = series.reduce((s, p) => s + (p.primary ?? 0), 0);

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                    <h3 className="text-h4 font-medium text-neutral-900">Calls per day</h3>
                    <p className="text-caption text-neutral-500">
                        Calls placed by your team (filtered by date range)
                    </p>
                </div>
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption font-medium text-primary-700">
                    {totalCalls} total
                </span>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : series.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No calls in this window.</div>
            ) : (
                <div
                    className="flex items-end gap-1 overflow-x-auto pb-2"
                    // Container needs a baseline height so the bars don't
                    // collapse when there's only one or two of them.
                    style={{ minHeight: 120 }}
                >
                    {series.map((p) => (
                        <div key={p.date} className="flex flex-col items-center gap-1">
                            <div
                                className="w-3 rounded-sm bg-success-500"
                                // Data-driven bar height (0..80px) — clamp to
                                // 2px so single-call days are still visible.
                                style={{
                                    height: `${Math.max(
                                        2,
                                        ((p.primary ?? 0) / max) * 80
                                    )}px`,
                                }}
                                title={`${p.date}: ${p.primary} call${p.primary === 1 ? '' : 's'}`}
                            />
                            <span className="text-caption text-neutral-500">
                                {p.date.slice(5)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
