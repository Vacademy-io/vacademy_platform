import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsActivityToday } from '../../-services/dashboard-services';
import { useTheme } from '@/providers/theme/theme-provider';
import { Users, Pulse as Activity, Database, Clock, ArrowUp, Globe } from '@phosphor-icons/react';
import { AnalyticsErrorDisplay } from './AnalyticsErrorDisplay';

// Animated number counter (reusable)
const AnimatedCounter = ({
    value,
    suffix = '',
    prefix = '',
}: {
    value: number;
    suffix?: string;
    prefix?: string;
}) => {
    return (
        <motion.span
            key={value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {prefix}
            {value.toLocaleString()}
            {suffix}
        </motion.span>
    );
};

interface UserActivitySummaryWidgetProps {
    instituteId: string;
}

export default function UserActivitySummaryWidget({ instituteId }: UserActivitySummaryWidgetProps) {
    const { primaryColor } = useTheme();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['analytics-activity-today', instituteId],
        queryFn: () => fetchAnalyticsActivityToday(instituteId),
        staleTime: 60000, // 1 minute - data considered fresh
        gcTime: 120000, // 2 minutes - keep in cache after becoming unused
        refetchInterval: 60000, // Auto-refetch every minute
    });

    console.log('UserActivitySummaryWidget - data:', data);
    console.log('UserActivitySummaryWidget - isLoading:', isLoading);
    console.log('UserActivitySummaryWidget - error:', error);

    const stats = [
        {
            icon: Users,
            label: 'Unique Users',
            value: data?.unique_active_users || 0,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            borderColor: 'border-blue-200',
        },
        {
            icon: Activity,
            label: 'Total Sessions',
            value: data?.total_sessions || 0,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            borderColor: 'border-green-200',
        },
        {
            icon: Database,
            label: 'API Calls',
            value: data?.total_api_calls || 0,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            borderColor: 'border-purple-200',
        },
        {
            icon: Clock,
            label: 'Activity Time',
            value: Math.round((data?.total_activity_time_minutes || 0) / 60),
            suffix: 'h',
            color: 'text-orange-600',
            bgColor: 'bg-orange-100',
            borderColor: 'border-orange-200',
        },
        {
            icon: ArrowUp,
            label: 'Avg Session',
            value: Math.round(data?.average_session_duration_minutes || 0),
            suffix: 'm',
            color: 'text-primary-600',
            bgColor: 'bg-primary-100',
            borderColor: 'border-primary-200',
        },
        {
            icon: Globe,
            label: 'Peak Hour',
            value: data?.peak_activity_hour || 0,
            suffix: ':00',
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100',
            borderColor: 'border-indigo-200',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            whileHover={{ y: -5 }}
            className="h-full"
        >
            <Card className="h-full border-0 bg-gradient-to-br from-white to-neutral-50 shadow-lg transition-all duration-300 hover:shadow-xl">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                            className="rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 p-2 text-white"
                        >
                            <Activity size={20} />
                        </motion.div>
                        <div>
                            <CardTitle className="text-lg font-bold text-gray-800">
                                Today's Activity
                            </CardTitle>
                            <CardDescription className="text-sm text-gray-600">
                                Real-time summary of user engagement
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {isLoading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                                    className="h-16 rounded-lg bg-gray-200"
                                />
                            ))}
                        </div>
                    ) : error ? (
                        <AnalyticsErrorDisplay
                            error={error}
                            widgetName="activity summary"
                            onRetry={() => refetch()}
                            fallbackIcon={Activity}
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                            {stats.map((stat, index) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.4, delay: index * 0.1 }}
                                    whileHover={{ scale: 1.05 }}
                                    className={`rounded-lg border p-3 ${stat.bgColor} ${stat.borderColor} transition-all duration-200 hover:shadow-md`}
                                >
                                    <div className="mb-1 flex items-center gap-2">
                                        <stat.icon size={16} className={stat.color} />
                                        <span className="text-xs font-medium text-gray-600">
                                            {stat.label}
                                        </span>
                                    </div>
                                    <div className={`text-lg font-bold ${stat.color}`}>
                                        <AnimatedCounter
                                            value={stat.value}
                                            suffix={stat.suffix || ''}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
