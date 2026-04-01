import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useMembershipAnalytics } from '../-hooks/useMembershipAnalytics';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Users, Clock, Calendar, UserPlus, ArrowsClockwise } from '@phosphor-icons/react';

interface MembershipAnalyticsProps {
    packageSessionIds: string[] | undefined;
    onCardClick?: (range: { start: Date; end: Date }) => void;
}

const chartConfig = {
    newUsers: {
        label: "New Users",
        color: "#6366f1",
    },
    retainers: {
        label: "Retainers",
        color: "#f59e0b",
    },
};

interface StatBreakdown {
    total: number;
    newUsers: number;
    retainers: number;
}

function StatsCardContent({ stats }: { stats: StatBreakdown }) {
    return (
        <div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="mb-2 text-xs text-gray-500">Total users</p>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <UserPlus size={14} className="text-indigo-500" />
                    <span className="text-sm font-semibold text-indigo-600">{stats.newUsers}</span>
                    <span className="text-xs text-gray-500">New</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <ArrowsClockwise size={14} className="text-amber-500" />
                    <span className="text-sm font-semibold text-amber-600">{stats.retainers}</span>
                    <span className="text-xs text-gray-500">Retainer</span>
                </div>
            </div>
        </div>
    );
}

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
                        <StatsCardContent stats={stats.last24Hours} />
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
                        <StatsCardContent stats={stats.last7Days} />
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
                        <StatsCardContent stats={stats.last30Days} />
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Stats Chart — Stacked Bar */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Weekly User Trends</CardTitle>
                    <p className="text-xs text-gray-500">User registrations over the last 7 days</p>
                </CardHeader>
                <CardContent>
                    <div className="h-[220px] w-full">
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
                                    content={<ChartTooltipContent />}
                                />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                />
                                <Bar
                                    dataKey="newUsers"
                                    name="New Users"
                                    stackId="a"
                                    fill="#6366f1"
                                    radius={[0, 0, 0, 0]}
                                    barSize={40}
                                />
                                <Bar
                                    dataKey="retainers"
                                    name="Retainers"
                                    stackId="a"
                                    fill="#f59e0b"
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
