import { useQuery } from '@tanstack/react-query';
import { fetchNewVsExisting, fetchReassignmentSeries } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId: string | undefined;
    from: number | undefined;
    to: number | undefined;
}

/**
 * Minimal stacked-bar chart built with CSS, matching the existing dashboard
 * widget pattern (no chart library in the live admin app — recharts is in
 * package.json but unused). When usage grows we can swap to recharts; for
 * now this keeps the bundle small and the visual consistent with KpiBand.
 */
export function NewVsExistingLeadsWidget({ instituteId, teamId, from, to }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-new-vs-existing', instituteId, teamId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchNewVsExisting(instituteId, teamId, from, to),
    });

    const max = data ? Math.max(1, ...data.map((p) => (p.primary ?? 0) + (p.secondary ?? 0))) : 1;

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">New vs existing leads</h3>
                <p className="text-caption text-neutral-500">
                    <span className="mr-3 inline-flex items-center gap-1">
                        <span className="inline-block size-2 rounded-sm bg-primary-500" /> New
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="inline-block size-2 rounded-sm bg-neutral-400" /> Existing
                    </span>
                </p>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : !data || data.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No activity in this window.</div>
            ) : (
                <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 120 }}>
                    {data.map((p) => {
                        const newH = ((p.primary ?? 0) / max) * 100;
                        const exH = ((p.secondary ?? 0) / max) * 100;
                        return (
                            <div key={p.date} className="flex flex-col items-center gap-1">
                                <div className="flex h-24 flex-col-reverse">
                                    <div
                                        className="w-3 bg-primary-500"
                                        style={{ height: `${newH}%` }}
                                        title={`New: ${p.primary}`}
                                    />
                                    <div
                                        className="w-3 bg-neutral-400"
                                        style={{ height: `${exH}%` }}
                                        title={`Existing: ${p.secondary}`}
                                    />
                                </div>
                                <span className="text-caption text-neutral-500">{p.date.slice(5)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export function ReassignmentVolumeWidget({ instituteId, from, to }: { instituteId: string; from: number | undefined; to: number | undefined }) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-reassignments', instituteId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchReassignmentSeries(instituteId, from, to),
    });

    const max = data ? Math.max(1, ...data.map((p) => p.primary ?? 0)) : 1;

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">Reassignment volume</h3>
                <p className="text-caption text-neutral-500">Leads transferred per day</p>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : !data || data.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No reassignments in this window.</div>
            ) : (
                <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 100 }}>
                    {data.map((p) => (
                        <div key={p.date} className="flex flex-col items-center gap-1">
                            <div
                                className="w-3 bg-warning-500"
                                style={{ height: `${((p.primary ?? 0) / max) * 80}px` }}
                                title={`${p.primary}`}
                            />
                            <span className="text-caption text-neutral-500">{p.date.slice(5)}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
