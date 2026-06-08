import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from '@phosphor-icons/react';
import { fetchInsights } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId: string | undefined;
}

const TONE: Record<string, string> = {
    INFO: 'border-info-200 bg-primary-50 text-primary-700',
    SUCCESS: 'border-success-200 bg-success-50 text-success-700',
    WARN: 'border-warning-200 bg-warning-50 text-warning-700',
    DANGER: 'border-danger-200 bg-danger-50 text-danger-700',
};

export function InsightsStrip({ instituteId, teamId }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-insights', instituteId, teamId],
        enabled: !!instituteId,
        queryFn: () => fetchInsights(instituteId, teamId),
    });

    if (isLoading) {
        return <div className="text-subtitle text-neutral-500">Generating insights…</div>;
    }
    if (!data || data.length === 0) {
        return null;
    }

    return (
        <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-h4 font-medium text-neutral-900">
                <Lightbulb size={18} className="text-warning-500" />
                Insights
            </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {data.map((i) => (
                    <article
                        key={i.key}
                        className={`rounded-md border p-3 ${TONE[i.severity] ?? TONE.INFO}`}
                    >
                        <div className="text-body font-medium">{i.headline}</div>
                        {i.detail && <div className="mt-1 text-caption opacity-80">{i.detail}</div>}
                    </article>
                ))}
            </div>
        </section>
    );
}
