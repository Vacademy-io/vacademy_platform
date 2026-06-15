import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CaretRight, Clock, WarningCircle } from '@phosphor-icons/react';
import {
    fetchMissedFollowups,
    fetchUpcomingFollowups,
    type FollowupRow,
} from '../-services/sales-dashboard-services';

/** Recent Leads sla_filter value each card drills through to. */
type FollowupSla = 'FOLLOW_UP_DUE' | 'FOLLOW_UP_OVERDUE';

interface Props {
    instituteId: string;
    teamId: string | undefined;
}

export function UpcomingFollowupsWidget({ instituteId, teamId }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-upcoming-followups', instituteId, teamId],
        enabled: !!instituteId,
        queryFn: () => fetchUpcomingFollowups(instituteId, teamId),
    });
    return (
        <FollowupCard
            title="Upcoming followups"
            subtitle="Next 48 hours"
            icon={<Clock size={18} className="text-primary-600" />}
            isLoading={isLoading}
            rows={data ?? []}
            tone="info"
            sla="FOLLOW_UP_DUE"
        />
    );
}

export function MissedFollowupsWidget({ instituteId, teamId }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-missed-followups', instituteId, teamId],
        enabled: !!instituteId,
        queryFn: () => fetchMissedFollowups(instituteId, teamId),
    });
    return (
        <FollowupCard
            title="Missed followups"
            subtitle="Past due"
            icon={<WarningCircle size={18} className="text-danger-600" />}
            isLoading={isLoading}
            rows={data ?? []}
            tone="danger"
            sla="FOLLOW_UP_OVERDUE"
        />
    );
}

function FollowupCard({
    title,
    subtitle,
    icon,
    isLoading,
    rows,
    tone,
    sla,
}: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isLoading: boolean;
    rows: FollowupRow[];
    tone: 'info' | 'danger';
    sla: FollowupSla;
}) {
    const navigate = useNavigate();
    return (
        <section className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                {icon}
                <div>
                    <h3 className="text-h4 font-medium text-neutral-900">{title}</h3>
                    <p className="text-caption text-neutral-500">{subtitle}</p>
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="text-subtitle text-neutral-500">Loading…</div>
                ) : rows.length === 0 ? (
                    <div className="text-subtitle text-neutral-500">All clear.</div>
                ) : (
                    <ul className="space-y-1.5">
                        {rows.map((r) => (
                            <li key={r.followup_id}>
                                {/* Drill-through → Recent Leads in this SLA bucket,
                                    narrowed to the row's counsellor when known. */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate({
                                            to: '/audience-manager/recent-leads',
                                            search: {
                                                sla,
                                                counsellor: r.counsellor_user_id ?? undefined,
                                            },
                                        })
                                    }
                                    className={`group flex w-full cursor-pointer items-center justify-between rounded-md border px-2 py-1.5 text-left ${
                                        tone === 'danger'
                                            ? 'border-danger-100 bg-danger-50 hover:bg-danger-100'
                                            : 'border-neutral-100 hover:bg-neutral-50'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-body text-neutral-900">
                                            {r.lead_name ?? r.lead_id?.slice(0, 8)}
                                        </div>
                                        <div className="truncate text-caption text-neutral-500">
                                            {r.counsellor_name ?? r.counsellor_user_id?.slice(0, 8)}{' '}
                                            · {timeLabel(r)}
                                        </div>
                                    </div>
                                    <CaretRight
                                        size={12}
                                        className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

function timeLabel(r: FollowupRow) {
    if (r.minutes_until_due == null) return r.status;
    const m = Math.round(r.minutes_until_due);
    if (m >= 0) {
        if (m < 60) return `in ${m}m`;
        return `in ${Math.round(m / 60)}h`;
    }
    const overdue = Math.abs(m);
    if (overdue < 60) return `${overdue}m overdue`;
    return `${Math.round(overdue / 60)}h overdue`;
}
