import { Card } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { LineChart, CartesianGrid, XAxis, YAxis, Line } from "recharts";
import dayjs from "dayjs";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis, millisToMinutes } from "@/helpers/formatTimeFromMiliseconds";

const chartConfig = {
    avg_daily_time_minutes: {
        label: "Your Time Spent",
        color: "#ed7626", 
    },
    avg_daily_time_minutes_batch: {
        label: "Batch Average Time",
        color: "#f6b879", 
    },
} satisfies ChartConfig;

export interface ChartDataType {
    activity_date: string;
    avg_daily_time_minutes: number;
    avg_daily_time_minutes_batch: number;
    time_spent_by_user_millis: number;
    avg_time_spent_by_batch_millis: number;
}

export const LineChartComponent = ({ userActivity }: { userActivity: UserActivityArray }) => {
    // Transform API data to chart data format and preserve original millisecond values
    const chartData = userActivity.map(item => ({
        activity_date: item.activity_date,
        avg_daily_time_minutes: millisToMinutes(item.time_spent_by_user_millis),
        avg_daily_time_minutes_batch: millisToMinutes(item.avg_time_spent_by_batch_millis),
        time_spent_by_user_millis: item.time_spent_by_user_millis,
        avg_time_spent_by_batch_millis: item.avg_time_spent_by_batch_millis
    }));

    // Sort data by date to ensure correct order
    chartData.sort((a, b) => new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime());

    // Function to convert minutes back to milliseconds for formatting
    const formatMinutesToTime = (minutes: number) => {
        if (minutes === undefined || minutes === null) return '';
        const milliseconds = minutes * 60 * 1000;
        return formatTimeFromMillis(milliseconds, 'full');
    };

    return(
        <Card className="p-6 bg-white border border-gray-200 shadow-sm rounded-lg">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Daily Activity Overview</h3>
                        <p className="text-sm text-gray-500">Performance tracking and insights</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartConfig.avg_daily_time_minutes.color }}></div>
                        <span className="text-sm font-medium text-gray-700">Your Time</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartConfig.avg_daily_time_minutes_batch.color }}></div>
                        <span className="text-sm font-medium text-gray-700">Batch Average</span>
                    </div>
                </div>
            </div>
            <div className="relative">
            <ChartContainer config={chartConfig}>
                <LineChart
                    accessibilityLayer
                    data={chartData}
                    margin={{
                        left: 35,
                        right: 25,
                        bottom: 25,
                        top: 20,
                    }}
                    className="!h-fit !maxh-h-screen min-h-64"
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="activity_date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => dayjs(value).format("DD MMM")}
                        label={{
                            value: "Date",
                            position: "left",
                            dx: 55,
                            dy: 30,
                            style: { fontSize: "14px", fill: "#ED7424" },
                        }}
                    />
                    <YAxis
                        dataKey="avg_daily_time_minutes"
                        tickLine={false}
                        axisLine={true}
                        tickMargin={8}
                        width={60} // Increased width to accommodate longer time format
                        tickFormatter={(value) => formatMinutesToTime(value)}
                        label={{
                            value: "Time Spent",
                            position: "insideLeft",
                            angle: -90,
                            dx: -10,
                            dy: 200,
                            style: { fontSize: "14px", fill: "#ED7424" },
                        }}
                    />
                    <ChartTooltip 
                        cursor={{ stroke: '#CCC', strokeDasharray: '5 5', strokeWidth: 1 }}
                        content={({active, payload, label}) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white p-2 border border-gray-200 shadow-md rounded">
                                        <p className="text-sm font-medium">{dayjs(label).format("DD MMM YYYY")}</p>
                                        {payload.map((entry, index) => {
                                            // Get original millisecond values for more accurate formatting
                                            const dataKey = entry.dataKey;
                                            const originalMillis = dataKey === "avg_daily_time_minutes" 
                                                ? payload[0].payload.time_spent_by_user_millis
                                                : payload[0].payload.avg_time_spent_by_batch_millis;
                                            
                                            return (
                                                <div key={`item-${index}`} className="flex items-center gap-2 mt-1">
                                                    <div 
                                                        className="w-2 h-2 rounded-full" 
                                                        style={{ backgroundColor: entry.color }}
                                                    />
                                                    <span className="text-xs">
                                                        {entry.name}: {formatTimeFromMillis(originalMillis, 'full')}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    {/* Render the line elements in reverse order to ensure both are visible */}
                    <Line
                        dataKey="avg_daily_time_minutes_batch"
                        type="monotone"
                        name="Batch Average Time"
                        stroke={chartConfig.avg_daily_time_minutes_batch.color}
                        strokeWidth={3}
                        dot={{
                            fill: chartConfig.avg_daily_time_minutes_batch.color,
                            r: 4,
                        }}
                        activeDot={{
                            r: 6,
                            stroke: chartConfig.avg_daily_time_minutes_batch.color,
                            strokeWidth: 2,
                        }}
                    />
                    <Line
                        dataKey="avg_daily_time_minutes"
                        type="monotone"
                        name="Your Time Spent"
                        stroke={chartConfig.avg_daily_time_minutes.color}
                        strokeWidth={3}
                        dot={{
                            fill: chartConfig.avg_daily_time_minutes.color,
                            r: 4,
                        }}
                        activeDot={{
                            r: 6,
                            stroke: chartConfig.avg_daily_time_minutes.color,
                            strokeWidth: 2,
                        }}
                    />
                </LineChart>
            </ChartContainer>
            </div>
        </Card>
    )
}