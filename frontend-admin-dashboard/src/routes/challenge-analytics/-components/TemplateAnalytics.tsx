import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ChartBar,
    PaperPlaneTilt,
    ChatCircle,
    Users,
    CaretDown,
    CaretUp,
} from '@phosphor-icons/react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ComposedChart,
    Line,
} from 'recharts';
import type { DailyParticipationResponse } from '@/types/challenge-analytics';

interface TemplateAnalyticsProps {
    data: DailyParticipationResponse | undefined;
    isLoading: boolean;
}

const COLORS = {
    outgoing: '#3B82F6',
    incoming: '#10B981',
    users: '#8B5CF6',
    responseRate: '#F59E0B',
};

export function TemplateAnalytics({ data, isLoading }: TemplateAnalyticsProps) {
    const [expandedDays, setExpandedDays] = useState<number[]>([]);
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

    const toggleDay = (dayNumber: number) => {
        setExpandedDays((prev) =>
            prev.includes(dayNumber) ? prev.filter((d) => d !== dayNumber) : [...prev, dayNumber]
        );
    };

    // Prepare chart data
    const chartData = useMemo(() => {
        if (!data?.daily_participation?.days) return [];
        return data.daily_participation.days.map((day) => ({
            name: `Day ${day.day_number}`,
            day_label: day.day_label,
            outgoing_users: day.outgoing.unique_users,
            outgoing_messages: day.outgoing.total_messages,
            incoming_users: day.incoming.unique_users,
            incoming_messages: day.incoming.total_messages,
            response_rate: day.response_rate,
            templates_count: day.outgoing.templates.length + day.incoming.templates.length,
        }));
    }, [data]);

    // Flatten all templates for detailed view
    const allTemplates = useMemo(() => {
        if (!data?.daily_participation?.days) return [];
        return data.daily_participation.days.flatMap((day) => [
            ...day.outgoing.templates.map((t) => ({
                ...t,
                day_number: day.day_number,
                day_label: day.day_label,
                type: 'outgoing' as const,
            })),
            ...day.incoming.templates.map((t) => ({
                ...t,
                day_number: day.day_number,
                day_label: day.day_label,
                type: 'incoming' as const,
            })),
        ]);
    }, [data]);

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] animate-pulse rounded bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    if (!data?.daily_participation?.days || data.daily_participation.days.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center gap-2">
                    <ChartBar className="h-5 w-5 text-blue-500" weight="fill" />
                    <CardTitle className="text-base font-semibold">Template Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[200px] items-center justify-center text-gray-500">
                        No template data available
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { daily_participation } = data;
    const summary = daily_participation.summary;

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2">
                            <ChartBar className="h-5 w-5 text-blue-600" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Day-wise Template Analytics
                            </CardTitle>
                            <p className="text-xs text-gray-500">
                                Messages and engagement by day and template
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === 'chart' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('chart')}
                        >
                            Chart View
                        </Button>
                        <Button
                            variant={viewMode === 'table' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('table')}
                        >
                            Table View
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Summary Stats */}
                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">Total Days</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-blue-700">
                            {daily_participation.total_days}
                        </p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
                        <div className="flex items-center gap-2">
                            <PaperPlaneTilt className="h-4 w-4 text-indigo-600" weight="fill" />
                            <span className="text-xs font-medium text-gray-500">Messages Sent</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-indigo-700">
                            {daily_participation.total_messages_sent}
                        </p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4">
                        <div className="flex items-center gap-2">
                            <ChatCircle className="h-4 w-4 text-emerald-600" weight="fill" />
                            <span className="text-xs font-medium text-gray-500">Responses</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-emerald-700">
                            {daily_participation.total_messages_received}
                        </p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 p-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-600" weight="fill" />
                            <span className="text-xs font-medium text-gray-500">Users Reached</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-purple-700">
                            {summary.total_unique_users_reached}
                        </p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">Response Rate</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-amber-700">
                            {summary.overall_response_rate}%
                        </p>
                    </div>
                </div>

                {viewMode === 'chart' ? (
                    <Tabs defaultValue="messages">
                        <TabsList className="mb-4">
                            <TabsTrigger value="messages">Messages by Day</TabsTrigger>
                            <TabsTrigger value="users">Users by Day</TabsTrigger>
                            <TabsTrigger value="combined">Combined View</TabsTrigger>
                        </TabsList>

                        <TabsContent value="messages" className="mt-0">
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0]?.payload;
                                                    return (
                                                        <div className="rounded-lg border bg-white px-4 py-3 shadow-lg">
                                                            <p className="font-semibold">{label}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {data?.day_label}
                                                            </p>
                                                            <div className="mt-2 space-y-1">
                                                                <p className="text-sm">
                                                                    <span
                                                                        className="mr-2 inline-block h-2 w-2 rounded-full"
                                                                        style={{
                                                                            backgroundColor:
                                                                                COLORS.outgoing,
                                                                        }}
                                                                    ></span>
                                                                    Outgoing: {data?.outgoing_messages}
                                                                </p>
                                                                <p className="text-sm">
                                                                    <span
                                                                        className="mr-2 inline-block h-2 w-2 rounded-full"
                                                                        style={{
                                                                            backgroundColor:
                                                                                COLORS.incoming,
                                                                        }}
                                                                    ></span>
                                                                    Incoming: {data?.incoming_messages}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend />
                                        <Bar
                                            dataKey="outgoing_messages"
                                            name="Outgoing Messages"
                                            fill={COLORS.outgoing}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="incoming_messages"
                                            name="Incoming Messages"
                                            fill={COLORS.incoming}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </TabsContent>

                        <TabsContent value="users" className="mt-0">
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0]?.payload;
                                                    return (
                                                        <div className="rounded-lg border bg-white px-4 py-3 shadow-lg">
                                                            <p className="font-semibold">{label}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {data?.day_label}
                                                            </p>
                                                            <div className="mt-2 space-y-1">
                                                                <p className="text-sm">
                                                                    <span
                                                                        className="mr-2 inline-block h-2 w-2 rounded-full"
                                                                        style={{
                                                                            backgroundColor:
                                                                                COLORS.outgoing,
                                                                        }}
                                                                    ></span>
                                                                    Unique Users (Out):{' '}
                                                                    {data?.outgoing_users}
                                                                </p>
                                                                <p className="text-sm">
                                                                    <span
                                                                        className="mr-2 inline-block h-2 w-2 rounded-full"
                                                                        style={{
                                                                            backgroundColor:
                                                                                COLORS.incoming,
                                                                        }}
                                                                    ></span>
                                                                    Unique Users (In):{' '}
                                                                    {data?.incoming_users}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend />
                                        <Bar
                                            dataKey="outgoing_users"
                                            name="Unique Users (Outgoing)"
                                            fill={COLORS.outgoing}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="incoming_users"
                                            name="Unique Users (Incoming)"
                                            fill={COLORS.incoming}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </TabsContent>

                        <TabsContent value="combined" className="mt-0">
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={{ fontSize: 11 }}
                                            domain={[0, 100]}
                                            unit="%"
                                        />
                                        <Tooltip />
                                        <Legend />
                                        <Bar
                                            yAxisId="left"
                                            dataKey="outgoing_messages"
                                            name="Messages Sent"
                                            fill={COLORS.outgoing}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar
                                            yAxisId="left"
                                            dataKey="incoming_messages"
                                            name="Responses"
                                            fill={COLORS.incoming}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="response_rate"
                                            name="Response Rate (%)"
                                            stroke={COLORS.responseRate}
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    /* Table View - Day-wise breakdown with expandable templates */
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700">
                                        Day
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        Outgoing Users
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        Outgoing Messages
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        Incoming Users
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        Incoming Messages
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                                        Response Rate
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium text-gray-700">
                                        Templates
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {daily_participation.days.map((day) => (
                                    <>
                                        <tr
                                            key={day.day_number}
                                            className="border-t hover:bg-gray-50 cursor-pointer"
                                            onClick={() => toggleDay(day.day_number)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {expandedDays.includes(day.day_number) ? (
                                                        <CaretUp className="h-4 w-4 text-gray-500" />
                                                    ) : (
                                                        <CaretDown className="h-4 w-4 text-gray-500" />
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-800">
                                                            Day {day.day_number}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {day.day_label}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-blue-600">
                                                {day.outgoing.unique_users}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {day.outgoing.total_messages}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-emerald-600">
                                                {day.incoming.unique_users}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {day.incoming.total_messages}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        day.response_rate > 20
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : day.response_rate > 0
                                                              ? 'bg-amber-100 text-amber-700'
                                                              : 'bg-gray-100 text-gray-600'
                                                    }`}
                                                >
                                                    {day.response_rate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                                    {day.outgoing.templates.length +
                                                        day.incoming.templates.length}
                                                </span>
                                            </td>
                                        </tr>
                                        {expandedDays.includes(day.day_number) && (
                                            <tr key={`${day.day_number}-templates`}>
                                                <td colSpan={7} className="bg-gray-50 px-4 py-3">
                                                    <div className="space-y-3">
                                                        {/* Outgoing Templates */}
                                                        {day.outgoing.templates.length > 0 && (
                                                            <div>
                                                                <p className="mb-2 text-xs font-semibold text-blue-600 flex items-center gap-1">
                                                                    <PaperPlaneTilt className="h-3 w-3" />
                                                                    Outgoing Templates
                                                                </p>
                                                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                                                    {day.outgoing.templates.map(
                                                                        (template, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="rounded-lg border bg-white p-3"
                                                                            >
                                                                                <p className="font-medium text-gray-800 text-sm truncate">
                                                                                    {
                                                                                        template.template_identifier
                                                                                    }
                                                                                </p>
                                                                                {template.sub_template_label !==
                                                                                    template.template_identifier && (
                                                                                    <p className="text-xs text-gray-500 truncate">
                                                                                        {
                                                                                            template.sub_template_label
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                                <div className="mt-2 flex gap-4 text-xs">
                                                                                    <span className="text-blue-600">
                                                                                        {
                                                                                            template.unique_users
                                                                                        }{' '}
                                                                                        users
                                                                                    </span>
                                                                                    <span className="text-gray-600">
                                                                                        {
                                                                                            template.total_messages
                                                                                        }{' '}
                                                                                        messages
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Incoming Templates */}
                                                        {day.incoming.templates.length > 0 && (
                                                            <div>
                                                                <p className="mb-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                                                    <ChatCircle className="h-3 w-3" />
                                                                    Incoming Templates (Responses)
                                                                </p>
                                                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                                                    {day.incoming.templates.map(
                                                                        (template, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="rounded-lg border bg-white p-3"
                                                                            >
                                                                                <p className="font-medium text-gray-800 text-sm truncate">
                                                                                    {
                                                                                        template.template_identifier
                                                                                    }
                                                                                </p>
                                                                                {template.sub_template_label !==
                                                                                    template.template_identifier && (
                                                                                    <p className="text-xs text-gray-500 truncate">
                                                                                        {
                                                                                            template.sub_template_label
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                                <div className="mt-2 flex gap-4 text-xs">
                                                                                    <span className="text-emerald-600">
                                                                                        {
                                                                                            template.unique_users
                                                                                        }{' '}
                                                                                        users
                                                                                    </span>
                                                                                    <span className="text-gray-600">
                                                                                        {
                                                                                            template.total_messages
                                                                                        }{' '}
                                                                                        messages
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
