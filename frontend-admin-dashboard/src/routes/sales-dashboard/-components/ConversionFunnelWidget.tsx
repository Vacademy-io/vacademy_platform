import { useQuery } from '@tanstack/react-query';
import { fetchFunnel } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId: string | undefined;
    from: number | undefined;
    to: number | undefined;
}

export function ConversionFunnelWidget({ instituteId, teamId, from, to }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-funnel', instituteId, teamId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchFunnel(instituteId, teamId, from, to),
    });

    const stages = data ?? [];
    const max = Math.max(1, ...stages.map((s) => s.count));

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">Conversion funnel</h3>
                <p className="text-caption text-neutral-500">Pipeline by status</p>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : stages.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No data yet.</div>
            ) : (
                <ul className="space-y-2">
                    {stages.map((s) => (
                        <li key={s.status_key} className="flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className={`inline-block size-2 rounded-full ${
                                    s.color ? '' : 'bg-neutral-500'
                                }`}
                                // Dynamic per-stage color comes from the
                                // backend (status palette); fall back to a
                                // design-token class above when absent.
                                style={s.color ? { backgroundColor: s.color } : undefined}
                            />
                            <span className="w-32 truncate text-subtitle text-neutral-700">{s.label}</span>
                            <div
                                className="h-3 rounded bg-primary-100"
                                style={{ width: `${(s.count / max) * 100}%`, minWidth: 2 }}
                                aria-label={`${s.label}: ${s.count}`}
                            />
                            <span className="ml-auto text-caption text-neutral-600">{s.count}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
