import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useMembershipAnalytics } from '../-hooks/useMembershipAnalytics';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Users, Clock, Calendar } from '@phosphor-icons/react';

interface MembershipAnalyticsProps {
    packageSessionIds: string[] | undefined;
    onCardClick?: (range: { start: Date; end: Date }) => void;
}

const chartConfig = {
    users: {
        label: "Users",
        color: "hsl(var(--primary))",
    },
};

export function MembershipAnalytics({ packageSessionIds, onCardClick }: MembershipAnalyticsProps) {
    const { stats, graphData, dateRanges, isLoading } = useMembershipAnalytics(packageSessionIds);

    if (isLoading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card
                    className="cursor-pointer shadow-sm transition-all hover:border-primary-200 hover:bg-gray-50 hover:shadow-md"
                    onClick={() => onCardClick?.(dateRanges.last24h)}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Last 24 Hours
                        </CardTitle>
                        <Clock className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.last24Hours}</div>
                        <p className="text-xs text-gray-500">New users joined</p>
                    </CardContent>
                </Card>
                <Card
                    className="cursor-pointer shadow-sm transition-all hover:border-primary-200 hover:bg-gray-50 hover:shadow-md"
                    onClick={() => onCardClick?.(dateRanges.last7d)}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Last 7 Days
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.last7Days}</div>
                        <p className="text-xs text-gray-500">New users joined</p>
                    </CardContent>
                </Card>
                <Card
                    className="cursor-pointer shadow-sm transition-all hover:border-primary-200 hover:bg-gray-50 hover:shadow-md"
                    onClick={() => onCardClick?.(dateRanges.last30d)}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Last 30 Days
                        </CardTitle>
                        <Users className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.last30Days}</div>
                        <p className="text-xs text-gray-500">New users joined</p>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Stats Chart */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Weekly User Trends</CardTitle>
                    <p className="text-xs text-gray-500">User registrations over the last 7 days</p>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <BarChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    tick={{ fontSize: 12, fill: '#888' }}
                                />
                                <ChartTooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Bar
                                    dataKey="users"
                                    fill="var(--color-users)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                />
                            </BarChart>
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
