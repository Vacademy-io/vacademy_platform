import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
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
import {
    MapPin,
    TrendUp,
    Users,
    ChatCircle,
    Warning,
    Download,
    ArrowUp,
    ArrowDown,
} from '@phosphor-icons/react';
import type { CenterHeatmapResponse, CenterHeatmapItem } from '@/types/challenge-analytics';

interface CenterHeatmapProps {
    data: CenterHeatmapResponse | undefined;
    isLoading: boolean;
}

const COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#A855F7',
];

const EXCLUDED_TYPES = new Set([
    'REFERRAL', 'SOCIAL MEDIA', 'SOCIAL_MEDIA',
    'OPT_OUT', 'OPT OUT', 'ORGANIC', 'WEBSITE',
]);

function isPhysicalCenter(item: CenterHeatmapItem) {
    return !EXCLUDED_TYPES.has((item.campaign_type || '').toUpperCase().trim());
}

const chartConfig = {
    unique_users: { label: 'Enrolled Users', color: 'hsl(var(--primary))' },
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
                    <CardTitle className="text-base font-semibold">Center Performance Report</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center text-gray-500">
                        No center data available for the selected period
                    </div>
                </CardContent>
            </Card>
        );
    }

    const centers = data.center_heatmap
        .filter(isPhysicalCenter)
        .sort((a, b) => b.unique_users - a.unique_users);

    const totalEnrolled = centers.reduce((s, c) => s + c.unique_users, 0);
    const totalInteractions = centers.reduce((s, c) => s + c.total_responses, 0);
    const totalOptOuts = centers.reduce((s, c) => s + (c.opted_out_users ?? 0), 0);
    const maxUsers = Math.max(...centers.map((c) => c.unique_users), 1);

    // Chart data
    const barData = centers.slice(0, 10).map((item) => ({
        name: item.campaign_name.length > 14 ? item.campaign_name.substring(0, 14) + '…' : item.campaign_name,
        fullName: item.campaign_name,
        unique_users: item.unique_users,
        total_responses: item.total_responses,
        opted_out: item.opted_out_users ?? 0,
    }));

    const pieData = centers.slice(0, 8).map((item, index) => ({
        name: item.campaign_name,
        value: item.unique_users,
        fill: COLORS[index % COLORS.length],
    }));

    const exportToCSV = () => {
        const headers = ['Center', 'Enrolled Users', 'Total Interactions', 'Avg/User', 'Opt-Outs', 'Opt-Out %', 'Status'];
        const rows = centers.map((c) => {
            const optOutRate = c.unique_users > 0
                ? ((c.opted_out_users ?? 0) / c.unique_users * 100).toFixed(1) + '%'
                : '0%';
            return [c.campaign_name, c.unique_users, c.total_responses, c.avg_responses_per_user.toFixed(1), c.opted_out_users ?? 0, optOutRate, c.status];
        });
        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `center_performance_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-4">
            {/* KPI summary */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                    { label: 'Active Centers', value: centers.length, icon: MapPin, color: 'blue' },
                    { label: 'Total Enrolled', value: totalEnrolled.toLocaleString(), icon: Users, color: 'emerald' },
                    { label: 'Total Interactions', value: totalInteractions.toLocaleString(), icon: ChatCircle, color: 'violet' },
                    { label: 'Total Opt-Outs', value: totalOptOuts.toLocaleString(), icon: Warning, color: 'red' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <div className={`rounded-lg bg-${color}-100 p-2`}>
                                    <Icon className={`size-4 text-${color}-600`} weight="fill" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{label}</p>
                                    <p className="text-xl font-bold text-gray-800">{value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts row */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 rounded-lg p-2">
                            <MapPin className="text-primary size-5" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Center Distribution</CardTitle>
                            <p className="text-xs text-gray-500">Users by center — visual overview</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Bar chart */}
                        <div>
                            <h4 className="mb-3 text-sm font-medium text-gray-700">Users by Center</h4>
                            <ChartContainer config={chartConfig} className="h-[280px] w-full">
                                <BarChart
                                    data={barData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                                    <ChartTooltip
                                        content={({ active, payload }) => {
                                            if (active && payload?.length) {
                                                const d = payload[0]?.payload;
                                                return (
                                                    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg">
                                                        <p className="font-medium">{d?.fullName}</p>
                                                        <p className="mt-1 text-sm">Enrolled: <strong>{d?.unique_users}</strong></p>
                                                        <p className="text-sm">Interactions: <strong>{d?.total_responses}</strong></p>
                                                        <p className="text-sm">Opt-Outs: <strong>{d?.opted_out}</strong></p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="unique_users" radius={[0, 4, 4, 0]} barSize={20}>
                                        {barData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </div>

                        {/* Pie chart */}
                        <div>
                            <h4 className="mb-3 text-sm font-medium text-gray-700">User Distribution</h4>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, percent }) =>
                                            `${name.substring(0, 8)}${name.length > 8 ? '…' : ''}: ${(percent * 100).toFixed(0)}%`
                                        }
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Users']} />
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
                </CardContent>
            </Card>

            {/* Performance table */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Center Performance Details</CardTitle>
                            <p className="text-xs text-gray-500">Enrollment, interactions & opt-outs per center</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                            <Download className="size-4" />
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700">Center</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        <span className="flex items-center justify-end gap-1"><Users className="size-3.5" />Enrolled</span>
                                    </th>
                                    <th className="hidden px-4 py-3 text-left font-medium text-gray-700 md:table-cell">Share</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        <span className="flex items-center justify-end gap-1"><ChatCircle className="size-3.5" />Interactions</span>
                                    </th>
                                    <th className="hidden px-4 py-3 text-right font-medium text-gray-700 sm:table-cell">Avg/User</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        <span className="flex items-center justify-end gap-1"><Warning className="size-3.5" />Opt-Outs</span>
                                    </th>
                                    <th className="hidden px-4 py-3 text-right font-medium text-gray-700 lg:table-cell">Opt-Out %</th>
                                    <th className="hidden px-4 py-3 text-left font-medium text-gray-700 lg:table-cell">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {centers.map((item, index) => {
                                    const sharePercent = totalEnrolled > 0
                                        ? (item.unique_users / totalEnrolled * 100).toFixed(1) : '0';
                                    const optOutRate = item.unique_users > 0
                                        ? ((item.opted_out_users ?? 0) / item.unique_users * 100).toFixed(1) : '0';
                                    const barWidth = Math.round((item.unique_users / maxUsers) * 100);
                                    const dotColor = COLORS[index % COLORS.length];

                                    return (
                                        <tr key={item.audience_id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                                                    <span className="font-medium text-gray-800">{item.campaign_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                                {item.unique_users.toLocaleString()}
                                            </td>
                                            <td className="hidden px-4 py-3 md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                                                        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: dotColor }} />
                                                    </div>
                                                    <span className="text-xs text-gray-500">{sharePercent}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-violet-700">
                                                {item.total_responses.toLocaleString()}
                                            </td>
                                            <td className="hidden px-4 py-3 text-right sm:table-cell">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                    <TrendUp className="size-3" />
                                                    {item.avg_responses_per_user.toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {(item.opted_out_users ?? 0) > 0 ? (
                                                    <span className="font-medium text-red-600">{(item.opted_out_users ?? 0).toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-gray-400">0</span>
                                                )}
                                            </td>
                                            <td className="hidden px-4 py-3 text-right lg:table-cell">
                                                {(item.opted_out_users ?? 0) > 0 ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                                        <ArrowUp className="size-3" />{optOutRate}%
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                        <ArrowDown className="size-3" />0%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="hidden px-4 py-3 lg:table-cell">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    item.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                                                    : item.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="border-t bg-gray-50">
                                <tr>
                                    <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-700">{totalEnrolled.toLocaleString()}</td>
                                    <td className="hidden px-4 py-3 md:table-cell" />
                                    <td className="px-4 py-3 text-right font-bold text-violet-700">{totalInteractions.toLocaleString()}</td>
                                    <td className="hidden px-4 py-3 sm:table-cell" />
                                    <td className="px-4 py-3 text-right font-bold text-red-600">{totalOptOuts.toLocaleString()}</td>
                                    <td className="hidden px-4 py-3 lg:table-cell" />
                                    <td className="hidden px-4 py-3 lg:table-cell" />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
