import { Card } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { LineChart, CartesianGrid, XAxis, YAxis, Line } from "recharts";
import dayjs from "dayjs";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis, millisToMinutes } from "@/helpers/formatTimeFromMiliseconds";

const chartConfig = {
    avg_daily_time_minutes: {
        label: "Your Time",
        color: "hsl(var(--primary))", 
    },
    avg_daily_time_minutes_batch: {
        label: "Batch Average",
        color: "hsl(var(--muted-foreground))", 
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
        <div>
            {/* Compact Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 md:mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-primary-50 rounded flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm md:text-base font-medium text-neutral-900">Activity Trend</h3>
                        <p className="text-xs text-neutral-500">7-day performance</p>
                    </div>
                </div>
                
                {/* Compact Legend */}
                <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                        <span className="text-neutral-600 font-medium">Your Time</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                        <span className="text-neutral-600 font-medium">Batch Avg</span>
                    </div>
                </div>
            </div>

            {/* Responsive Chart Container */}
            <div className="w-full h-48 sm:h-56 md:h-64 lg:h-72">
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <LineChart
                        data={chartData}
                        margin={{
                            left: 10,
                            right: 10,
                            bottom: 20,
                            top: 10,
                        }}
                        className="w-full h-full"
                    >
                        <CartesianGrid 
                            vertical={false} 
                            strokeDasharray="3 3" 
                            stroke="hsl(var(--border))"
                            opacity={0.3}
                        />
                        <XAxis
                            dataKey="activity_date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            tickFormatter={(value) => dayjs(value).format("MMM DD")}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={40}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            width={50}
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            tickFormatter={(value) => {
                                const milliseconds = value * 60 * 1000;
                                return formatTimeFromMillis(milliseconds, 'minutes');
                            }}
                        />
                        <ChartTooltip 
                            cursor={{ 
                                stroke: 'hsl(var(--primary))', 
                                strokeDasharray: '4 4', 
                                strokeWidth: 1,
                                opacity: 0.5
                            }}
                            content={({active, payload, label}) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white border border-neutral-200 rounded-lg p-2.5 shadow-sm">
                                            <p className="text-xs font-medium text-neutral-900 mb-1">
                                                {dayjs(label).format("MMM DD, YYYY")}
                                            </p>
                                            {payload.map((entry, index) => {
                                                const dataKey = entry.dataKey;
                                                const originalMillis = dataKey === "avg_daily_time_minutes" 
                                                    ? payload[0].payload.time_spent_by_user_millis
                                                    : payload[0].payload.avg_time_spent_by_batch_millis;
                                                
                                                return (
                                                    <div key={`item-${index}`} className="flex items-center gap-2">
                                                        <div 
                                                            className="w-2 h-2 rounded-full" 
                                                            style={{ backgroundColor: entry.color }}
                                                        />
                                                        <span className="text-xs text-neutral-700">
                                                            {entry.name}: <span className="font-medium">{formatTimeFromMillis(originalMillis, 'full')}</span>
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
                        
                        {/* Batch Average Line (Background) */}
                        <Line
                            dataKey="avg_daily_time_minutes_batch"
                            type="monotone"
                            name="Batch Average"
                            stroke="hsl(var(--muted-foreground))"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{
                                fill: "hsl(var(--muted-foreground))",
                                r: 3,
                                strokeWidth: 0,
                            }}
                            activeDot={{
                                r: 4,
                                stroke: "hsl(var(--muted-foreground))",
                                strokeWidth: 2,
                                fill: "white"
                            }}
                        />
                        
                        {/* User Time Line (Foreground) */}
                        <Line
                            dataKey="avg_daily_time_minutes"
                            type="monotone"
                            name="Your Time"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            dot={{
                                fill: "hsl(var(--primary))",
                                r: 3,
                                strokeWidth: 0,
                            }}
                            activeDot={{
                                r: 5,
                                stroke: "hsl(var(--primary))",
                                strokeWidth: 2,
                                fill: "white"
                            }}
                        />
                    </LineChart>
                </ChartContainer>
            </div>
        </div>
    )
}