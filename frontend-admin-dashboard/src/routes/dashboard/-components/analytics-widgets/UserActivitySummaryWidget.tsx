import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsActivityToday } from '../../-services/dashboard-services';
import { Users, Pulse, Database, Clock, ArrowUp, Globe, type Icon } from '@phosphor-icons/react';
import { AnalyticsErrorDisplay } from './AnalyticsErrorDisplay';

interface UserActivitySummaryWidgetProps {
    instituteId: string;
}

interface StatTile {
    icon: Icon;
    label: string;
    value: number;
    suffix?: string;
    iconColor: string;
    iconBg: string;
}

export default function UserActivitySummaryWidget({ instituteId }: UserActivitySummaryWidgetProps) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['analytics-activity-today', instituteId],
        queryFn: () => fetchAnalyticsActivityToday(instituteId),
        staleTime: 60_000,
        gcTime: 120_000,
        refetchInterval: 60_000,
        retry: false,
    });

    const stats: StatTile[] = [
        {
            icon: Users,
            label: 'Unique Users',
            value: data?.unique_active_users || 0,
            iconColor: 'text-blue-600',
            iconBg: 'bg-blue-50',
        },
        {
            icon: Pulse,
            label: 'Sessions',
            value: data?.total_sessions || 0,
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50',
        },
        {
            icon: Database,
            label: 'API Calls',
            value: data?.total_api_calls || 0,
            iconColor: 'text-violet-600',
            iconBg: 'bg-violet-50',
        },
        {
            icon: Clock,
            label: 'Activity Time',
            value: Math.round((data?.total_activity_time_minutes || 0) / 60),
            suffix: 'h',
            iconColor: 'text-orange-600',
            iconBg: 'bg-orange-50',
        },
        {
            icon: ArrowUp,
            label: 'Avg Session',
            value: Math.round(data?.average_session_duration_minutes || 0),
            suffix: 'm',
            iconColor: 'text-primary-600',
            iconBg: 'bg-primary-50',
        },
        {
            icon: Globe,
            label: 'Peak Hour',
            value: data?.peak_activity_hour || 0,
            suffix: ':00',
            iconColor: 'text-indigo-600',
            iconBg: 'bg-indigo-50',
        },
    ];

    return (
        <Card className="flex h-full flex-col bg-white shadow-sm">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Pulse size={14} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold">
                            Today&apos;s Activity
                        </CardTitle>
                        <CardDescription className="line-clamp-1 text-[11px] text-neutral-500 sm:text-xs">
                            Real-time summary of user engagement
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <div className="flex flex-1 flex-col px-4 pb-4">
                {isLoading ? (
                    <div className="grid flex-1 grid-cols-2 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-md" />
                        ))}
                    </div>
                ) : error ? (
                    <AnalyticsErrorDisplay
                        error={error}
                        widgetName="activity summary"
                        onRetry={() => refetch()}
                        fallbackIcon={Pulse}
                    />
                ) : (
                    <div className="grid flex-1 grid-cols-2 gap-2">
                        {stats.map((s) => {
                            const Icon = s.icon;
                            return (
                                <div
                                    key={s.label}
                                    className="flex items-center gap-2 rounded-md border border-neutral-100 bg-white p-2 transition-colors hover:border-neutral-200"
                                >
                                    <span
                                        className={`flex size-7 shrink-0 items-center justify-center rounded-md ${s.iconBg} ${s.iconColor}`}
                                    >
                                        <Icon size={14} weight="duotone" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="line-clamp-1 text-[10px] uppercase tracking-wide text-neutral-500">
                                            {s.label}
                                        </div>
                                        <div className="text-sm font-semibold tabular-nums text-neutral-900">
                                            {s.value.toLocaleString('en-IN')}
                                            {s.suffix && (
                                                <span className="ml-0.5 text-[10px] font-medium text-neutral-500">
                                                    {s.suffix}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Card>
    );
}
