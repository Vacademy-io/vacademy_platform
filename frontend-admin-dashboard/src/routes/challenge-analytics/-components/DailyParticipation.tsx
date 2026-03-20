import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    Legend,
    Area,
    AreaChart,
    ComposedChart,
} from 'recharts';
import { ChartLine, ArrowUp, ArrowDown, Minus, Warning } from '@phosphor-icons/react';
import type { DailyParticipationResponse, DayParticipation } from '@/types/challenge-analytics';

interface DailyParticipationProps {
    data: DailyParticipationResponse | undefined;
    isLoading: boolean;
}

const chartConfig = {
    outgoing: {
        label: 'Outgoing Messages',
        color: '#3B82F6',
    },
    incoming: {
        label: 'Incoming Messages',
        color: '#10B981',
    },
    response_rate: {
        label: 'Response Rate',
        color: '#F59E0B',
    },
};

export function DailyParticipation({ data, isLoading }: DailyParticipationProps) {
    const [activeView, setActiveView] = useState<'chart' | 'table'>('chart');

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] animate-pulse rounded bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    if (!data || !data.daily_participation || !data.daily_participation.days.length) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center gap-2">
                    <ChartLine className="h-5 w-5 text-primary" weight="fill" />
                    <CardTitle className="text-base font-semibold">Daily Participation Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center text-gray-500">
                        No participation data available for the selected period
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { daily_participation } = data;
    const { days, summary, total_days, total_messages_sent, total_messages_received } = daily_participation;

    // Prepare chart data
    const chartData = days.map((day) => ({
        name: `Day ${day.day_number}`,
        day_label: day.day_label,
        outgoing: day.outgoing.total_messages,
        incoming: day.incoming.total_messages,
        outgoing_users: day.outgoing.unique_users,
        incoming_users: day.incoming.unique_users,
        response_rate: day.response_rate,
    }));

    // Calculate trend
    const getTrend = (index: number, days: DayParticipation[]) => {
        if (index === 0) return 'neutral';
        const current = days[index]?.response_rate || 0;
        const previous = days[index - 1]?.response_rate || 0;
        if (current > previous) return 'up';
        if (current < previous) return 'down';
        return 'neutral';
    };

    const getDropOffClass = (responseRate: number) => {
        if (responseRate === 0) return 'bg-red-100 text-red-700 border-red-200';
        if (responseRate < 30) return 'bg-amber-100 text-amber-700 border-amber-200';
        if (responseRate < 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-green-100 text-green-700 border-green-200';
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2">
                            <ChartLine className="h-5 w-5 text-blue-600" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Daily Participation Metrics</CardTitle>
                            <p className="text-xs text-gray-500">Message activity and response rates by day</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                                <span className="text-xs text-gray-500">Days</span>
                                <p className="font-semibold text-blue-700">{total_days}</p>
                            </div>
                            <div className="rounded-lg bg-purple-50 px-3 py-2">
                                <span className="text-xs text-gray-500">Sent</span>
                                <p className="font-semibold text-purple-700">{total_messages_sent.toLocaleString()}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 px-3 py-2">
                                <span className="text-xs text-gray-500">Received</span>
                                <p className="font-semibold text-emerald-700">{total_messages_received.toLocaleString()}</p>
                            </div>
                            <div className="rounded-lg bg-amber-50 px-3 py-2">
                                <span className="text-xs text-gray-500">Response</span>
                                <p className="font-semibold text-amber-700">{summary.overall_response_rate.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'chart' | 'table')}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="chart">Charts</TabsTrigger>
                        <TabsTrigger value="table">Day Details</TabsTrigger>
                    </TabsList>

                    <TabsContent value="chart" className="mt-0">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Response Rate Trend */}
                            <div>
                                <h4 className="mb-3 text-sm font-medium text-gray-700">Response Rate Trend</h4>
                                <div className="h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="rounded-lg border bg-white px-3 py-2 shadow-lg">
                                                                <p className="font-medium">{label}</p>
                                                                <p className="text-sm text-gray-600">
                                                                    {payload[0]?.payload?.day_label}
                                                                </p>
                                                                <p className="font-semibold text-amber-600">
                                                                    Response Rate: {payload[0]?.value}%
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="response_rate"
                                                stroke="#F59E0B"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorResponse)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Messages Stacked Bar */}
                            <div>
                                <h4 className="mb-3 text-sm font-medium text-gray-700">Messages by Day</h4>
                                <div className="h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="rounded-lg border bg-white px-3 py-2 shadow-lg">
                                                                <p className="font-medium">{label}</p>
                                                                <p className="text-sm text-gray-600">
                                                                    {payload[0]?.payload?.day_label}
                                                                </p>
                                                                <div className="mt-1 space-y-1">
                                                                    <p className="text-sm text-blue-600">
                                                                        Outgoing: {payload[0]?.value} msgs
                                                                    </p>
                                                                    <p className="text-sm text-emerald-600">
                                                                        Incoming: {payload[1]?.value} msgs
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Bar dataKey="outgoing" name="Outgoing" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="incoming" name="Incoming" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Combined Line + Bar Chart */}
                        <div className="mt-6">
                            <h4 className="mb-3 text-sm font-medium text-gray-700">Complete Overview</h4>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                                        <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="rounded-lg border bg-white px-3 py-2 shadow-lg">
                                                            <p className="font-medium">{label}</p>
                                                            <p className="mb-2 text-sm text-gray-600">
                                                                {payload[0]?.payload?.day_label}
                                                            </p>
                                                            <div className="space-y-1 text-sm">
                                                                <p className="text-blue-600">
                                                                    Outgoing: {payload[0]?.payload?.outgoing} ({payload[0]?.payload?.outgoing_users} users)
                                                                </p>
                                                                <p className="text-emerald-600">
                                                                    Incoming: {payload[0]?.payload?.incoming} ({payload[0]?.payload?.incoming_users} users)
                                                                </p>
                                                                <p className="font-medium text-amber-600">
                                                                    Response: {payload[0]?.payload?.response_rate}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                        <Bar yAxisId="left" dataKey="outgoing" name="Outgoing" fill="#3B82F6" barSize={20} radius={[2, 2, 0, 0]} />
                                        <Bar yAxisId="left" dataKey="incoming" name="Incoming" fill="#10B981" barSize={20} radius={[2, 2, 0, 0]} />
                                        <Line yAxisId="right" type="monotone" dataKey="response_rate" name="Response %" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="table" className="mt-0">
                        <div className="overflow-hidden rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">Day</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">Label</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-700">Outgoing</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-700">Incoming</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-700">Response Rate</th>
                                        <th className="px-4 py-3 text-center font-medium text-gray-700">Trend</th>
                                        <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {days.map((day, index) => {
                                        const trend = getTrend(index, days);
                                        const isDropOff = day.response_rate < 30 || day.outgoing.total_messages === 0;

                                        return (
                                            <tr key={day.day_number} className={`border-t hover:bg-gray-50 ${isDropOff ? 'bg-red-50/50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                        {day.day_number}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium">{day.day_label}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="text-blue-700">{day.outgoing.total_messages}</div>
                                                    <div className="text-xs text-gray-500">{day.outgoing.unique_users} users</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="text-emerald-700">{day.incoming.total_messages}</div>
                                                    <div className="text-xs text-gray-500">{day.incoming.unique_users} users</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getDropOffClass(day.response_rate)}`}>
                                                        {day.response_rate.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {trend === 'up' && <ArrowUp className="inline h-4 w-4 text-green-500" weight="bold" />}
                                                    {trend === 'down' && <ArrowDown className="inline h-4 w-4 text-red-500" weight="bold" />}
                                                    {trend === 'neutral' && <Minus className="inline h-4 w-4 text-gray-400" weight="bold" />}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {day.outgoing.total_messages === 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                                            <Warning className="h-3 w-3" weight="fill" />
                                                            No messages
                                                        </span>
                                                    ) : isDropOff ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                                            <Warning className="h-3 w-3" weight="fill" />
                                                            Low engagement
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-green-600">✓ Good</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Template Details Expandable */}
                        <div className="mt-4">
                            <h4 className="mb-2 text-sm font-medium text-gray-700">Template Breakdown</h4>
                            <div className="space-y-2">
                                {days.filter(d => d.outgoing.templates.length > 0 || d.incoming.templates.length > 0).slice(0, 5).map((day) => (
                                    <div key={day.day_number} className="rounded-lg border p-3">
                                        <div className="font-medium text-gray-800">Day {day.day_number} - {day.day_label}</div>
                                        <div className="mt-2 grid gap-4 md:grid-cols-2">
                                            {day.outgoing.templates.length > 0 && (
                                                <div>
                                                    <span className="text-xs font-medium text-blue-600">Outgoing Templates:</span>
                                                    <ul className="mt-1 space-y-0.5">
                                                        {day.outgoing.templates.map((t, i) => (
                                                            <li key={i} className="text-xs text-gray-600">
                                                                • {t.template_identifier} ({t.total_messages} msgs)
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {day.incoming.templates.length > 0 && (
                                                <div>
                                                    <span className="text-xs font-medium text-emerald-600">Incoming Templates:</span>
                                                    <ul className="mt-1 space-y-0.5">
                                                        {day.incoming.templates.map((t, i) => (
                                                            <li key={i} className="text-xs text-gray-600">
                                                                • {t.template_identifier} ({t.total_messages} msgs)
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
