import { useQuery } from '@tanstack/react-query';
import { Users, TrendUp, Clock, CheckCircle, WarningCircle, Funnel } from '@phosphor-icons/react';
import { fetchKpi } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    teamId: string | undefined;
    from: number | undefined;
    to: number | undefined;
}

export function KpiBand({ instituteId, teamId, from, to }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-kpi', instituteId, teamId, from, to],
        enabled: !!instituteId,
        queryFn: () => fetchKpi(instituteId, teamId, from, to),
    });

    const tiles = [
        { icon: <Funnel size={18} />, label: 'Total leads', value: data?.total_leads, accent: 'text-primary-700' },
        { icon: <Clock size={18} />, label: 'Open', value: data?.open_leads, accent: 'text-info-700' },
        { icon: <CheckCircle size={18} />, label: 'Conversions', value: data?.conversions, accent: 'text-success-700' },
        {
            icon: <TrendUp size={18} />,
            label: 'Conv. rate',
            value: data ? `${Number(data.conversion_rate).toFixed(1)}%` : null,
            accent: 'text-success-700',
        },
        { icon: <Users size={18} />, label: 'Active counsellors', value: data?.active_counsellors, accent: 'text-primary-700' },
        {
            icon: <WarningCircle size={18} />,
            label: 'Overdue followups',
            value: data?.overdue_followups,
            accent: 'text-warning-700',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {tiles.map((t) => (
                <div
                    key={t.label}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
                >
                    <div className={`flex size-9 items-center justify-center rounded-md bg-neutral-100 ${t.accent}`}>
                        {t.icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-caption text-neutral-500">{t.label}</div>
                        <div className={`text-h3 font-medium ${t.accent}`}>
                            {isLoading ? '—' : t.value ?? 0}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
