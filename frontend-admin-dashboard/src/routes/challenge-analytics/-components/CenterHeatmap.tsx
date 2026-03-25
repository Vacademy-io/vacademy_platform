import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
    Bar,
    BarChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    PieChart,
    Pie,
    Legend,
    Tooltip,
} from 'recharts';
import { MapPin, TrendUp } from '@phosphor-icons/react';
import type { CenterHeatmapResponse, CenterHeatmapItem } from '@/types/challenge-analytics';

interface CenterHeatmapProps {
    data: CenterHeatmapResponse | undefined;
    isLoading: boolean;
}

const COLORS = [
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#F59E0B', // amber-500
    '#EF4444', // red-500
    '#EC4899', // pink-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
];

const chartConfig = {
    unique_users: {
        label: 'Unique Users',
        color: 'hsl(var(--primary))',
    },
    engagement_percentage: {
        label: 'Engagement %',
        color: 'hsl(142, 76%, 36%)',
    },
};

export function CenterHeatmap({ data, isLoading }: CenterHeatmapProps) {
    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] animate-pulse rounded bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    if (!data || !data.center_heatmap || data.center_heatmap.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center gap-2">
                    <MapPin className="text-primary size-5" weight="fill" />
                    <CardTitle className="text-base font-semibold">
                        Center Interaction Heatmap
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center text-gray-500">
                        No center data available for the selected period
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { center_heatmap, total_unique_users, total_campaigns, total_responses } = data;

    // Prepare bar chart data - sorted by unique users
    const barData = center_heatmap
        .sort((a, b) => b.unique_users - a.unique_users)
        .slice(0, 10)
        .map((item) => ({
            name:
                item.campaign_name.length > 15
                    ? item.campaign_name.substring(0, 15) + '...'
                    : item.campaign_name,
            fullName: item.campaign_name,
            unique_users: item.unique_users,
            total_responses: item.total_responses,
            avg_responses: item.avg_responses_per_user,
            campaign_type: item.campaign_type,
        }));

    // Prepare pie chart data
    const pieData = center_heatmap
        .sort((a, b) => b.unique_users - a.unique_users)
        .slice(0, 8)
        .map((item, index) => ({
            name: item.campaign_name,
            value: item.unique_users,
            fill: COLORS[index % COLORS.length],
        }));

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 rounded-lg p-2">
                            <MapPin className="text-primary size-5" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Center Interaction Heatmap
                            </CardTitle>
                            <p className="text-xs text-gray-500">
                                User engagement by campaign/center
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500">Campaigns:</span>
                            <span className="font-semibold">{total_campaigns}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500">Total Users:</span>
                            <span className="text-primary font-semibold">
                                {total_unique_users.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Bar Chart */}
                    <div className="h-[320px]">
                        <h4 className="mb-3 text-sm font-medium text-gray-700">
                            Users by Center/Campaign
                        </h4>
                        <ChartContainer config={chartConfig} className="h-[280px] w-full">
                            <BarChart
                                data={barData}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    horizontal={true}
                                    vertical={false}
                                />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fontSize: 11 }}
                                    width={75}
                                />
                                <ChartTooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0]?.payload;
                                            return (
                                                <div className="rounded-lg border bg-white px-3 py-2 shadow-lg">
                                                    <p className="font-medium">{data?.fullName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {data?.campaign_type}
                                                    </p>
                                                    <p className="mt-1 text-sm">
                                                        Users: <strong>{data?.unique_users}</strong>
                                                    </p>
                                                    <p className="text-sm">
                                                        Responses:{' '}
                                                        <strong>{data?.total_responses}</strong>
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="unique_users"
                                    fill="var(--color-unique_users)"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                >
                                    {barData.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>

                    {/* Pie Chart */}
                    <div className="h-[320px]">
                        <h4 className="mb-3 text-sm font-medium text-gray-700">
                            User Distribution
                        </h4>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) =>
                                        `${name.substring(0, 10)}${name.length > 10 ? '...' : ''}: ${(percent * 100).toFixed(0)}%`
                                    }
                                    labelLine={false}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [value.toLocaleString(), 'Users']}
                                />
                                <Legend
                                    layout="vertical"
                                    align="right"
                                    verticalAlign="middle"
                                    wrapperStyle={{ fontSize: '11px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Center Details Table */}
                <div className="mt-6">
                    <h4 className="mb-3 text-sm font-medium text-gray-700">
                        Campaign/Center Performance Details
                    </h4>
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                                        Campaign/Center
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                                        Type
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                                        Users
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                                        Responses
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                                        Avg/User
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {center_heatmap.map((item, index) => (
                                    <tr
                                        key={item.audience_id}
                                        className="border-t hover:bg-gray-50"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="size-3 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            COLORS[index % COLORS.length],
                                                    }}
                                                />
                                                <div>
                                                    <span className="font-medium">
                                                        {item.campaign_name}
                                                    </span>
                                                    {item.description && (
                                                        <p className="text-xs text-gray-500">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                {item.campaign_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {item.unique_users.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            {item.total_responses.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                <TrendUp className="size-3" />
                                                {item.avg_responses_per_user.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    item.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-700'
                                                        : item.status === 'COMPLETED'
                                                          ? 'bg-blue-100 text-blue-700'
                                                          : 'bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
