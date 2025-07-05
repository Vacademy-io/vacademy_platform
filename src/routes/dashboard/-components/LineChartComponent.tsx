import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { LineChart, CartesianGrid, XAxis, YAxis, Line, ResponsiveContainer } from "recharts";
import dayjs from "dayjs";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis, millisToMinutes } from "@/helpers/formatTimeFromMiliseconds";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, TrendingUp, Users } from "lucide-react";

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

    // Calculate performance metrics
    const totalUserTime = chartData.reduce((acc, curr) => acc + curr.avg_daily_time_minutes, 0);
    const totalBatchTime = chartData.reduce((acc, curr) => acc + curr.avg_daily_time_minutes_batch, 0);
    const avgUserTime = totalUserTime / chartData.length;
    const avgBatchTime = totalBatchTime / chartData.length;
    const performanceRatio = avgBatchTime > 0 ? (avgUserTime / avgBatchTime) : 0;
    
    const getPerformanceStatus = () => {
        if (performanceRatio >= 1.2) return { text: "Excellent", color: "bg-success-100 text-success-700 border-success-300" };
        if (performanceRatio >= 1.0) return { text: "Above Average", color: "bg-primary-100 text-primary-700 border-primary-300" };
        if (performanceRatio >= 0.8) return { text: "On Track", color: "bg-info-100 text-info-700 border-info-300" };
        return { text: "Needs Focus", color: "bg-warning-100 text-warning-700 border-warning-300" };
    };

    const performanceStatus = getPerformanceStatus();

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Enhanced Header with Performance Metrics */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg">
                        <TrendingUp size={18} className="text-primary-600" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Learning Progress Trend</h3>
                        <p className="text-xs sm:text-sm text-gray-600 flex items-center space-x-1">
                            <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                            <span>Weekly learning activity comparison</span>
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                    <Badge className={`${performanceStatus.color} border text-xs sm:text-sm font-medium px-2 sm:px-3 py-1`}>
                        {performanceStatus.text}
                    </Badge>
                    {chartData.length > 0 && (
                        <div className="hidden md:flex items-center space-x-4 bg-gray-50/80 rounded-lg px-3 sm:px-4 py-2 border border-gray-200/60">
                            <div className="flex items-center space-x-2 text-xs sm:text-sm">
                                <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-primary-500"></div>
                                <span className="text-gray-600 font-medium">
                                    Avg: {formatTimeFromMillis(avgUserTime * 60 * 1000, 'minutes')}
                                </span>
                            </div>
                            <div className="w-px h-3 sm:h-4 bg-gray-300"></div>
                            <div className="flex items-center space-x-2 text-xs sm:text-sm">
                                <Users size={12} className="text-gray-400" />
                                <span className="text-gray-600 font-medium">
                                    {formatTimeFromMillis(avgBatchTime * 60 * 1000, 'minutes')}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Enhanced Legend */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-gray-50/80 to-primary-50/20 rounded-lg sm:rounded-xl border border-gray-200/60">
                <div className="flex items-center space-x-2">
                    <div className="w-3 sm:w-4 h-0.5 sm:h-1 rounded-full bg-primary-500 shadow-sm"></div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Your Study Time</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-3 sm:w-4 h-0.5 sm:h-1 rounded-full bg-gray-400 shadow-sm" style={{ 
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)' 
                    }}></div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Batch Average</span>
                </div>
                <div className="ml-auto flex items-center space-x-1 text-xs text-gray-500">
                    <Clock size={10} className="sm:w-3 sm:h-3" />
                    <span>Real-time data</span>
                </div>
            </div>

            {/* Enhanced Chart Container */}
            <div className="relative w-full max-w-full overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50/10 via-transparent to-primary-100/10 rounded-lg sm:rounded-xl"></div>
                
                <div className="relative bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-gray-200/40 p-2 sm:p-4 overflow-hidden w-full max-w-full">
                    <ResponsiveContainer width="100%" height={280}>
                        <ChartContainer config={chartConfig} className="w-full h-full overflow-hidden">
                            <LineChart
                                data={chartData}
                                margin={{
                                    left: 0,
                                    right: 0,
                                    bottom: 20,
                                    top: 5,
                                }}
                                className="w-full h-full"
                            >
                                <defs>
                                    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                
                                <CartesianGrid 
                                    vertical={false} 
                                    strokeDasharray="3 3" 
                                    stroke="hsl(var(--border))"
                                    opacity={0.3}
                                    className="animate-gentle-pulse"
                                />
                                
                                <XAxis
                                    dataKey="activity_date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={4}
                                    tick={{ 
                                        fontSize: 9, 
                                        fill: 'hsl(var(--muted-foreground))',
                                        fontWeight: 500
                                    }}
                                    tickFormatter={(value) => dayjs(value).format("MMM DD")}
                                    interval={'preserveStartEnd'}
                                    angle={-35}
                                    textAnchor="end"
                                    height={40}
                                />
                                
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={4}
                                    width={35}
                                    tick={{ 
                                        fontSize: 8, 
                                        fill: 'hsl(var(--muted-foreground))',
                                        fontWeight: 500
                                    }}
                                    tickFormatter={(value) => {
                                        const milliseconds = value * 60 * 1000;
                                        return formatTimeFromMillis(milliseconds, 'minutes');
                                    }}
                                />
                                
                                <ChartTooltip 
                                    cursor={{ 
                                        stroke: 'hsl(var(--primary))', 
                                        strokeDasharray: '4 4', 
                                        strokeWidth: 2,
                                        opacity: 0.6
                                    }}
                                    content={({active, payload, label}) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-lg max-w-xs">
                                                    <div className="flex items-center space-x-2 mb-2 sm:mb-3">
                                                        <Calendar size={12} className="text-primary-500 flex-shrink-0" />
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                                                            {dayjs(label).format("dddd, MMM DD")}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1 sm:space-y-2">
                                                        {payload.map((entry, index) => {
                                                            const dataKey = entry.dataKey;
                                                            const originalMillis = dataKey === "avg_daily_time_minutes" 
                                                                ? payload[0]?.payload?.time_spent_by_user_millis || 0
                                                                : payload[0]?.payload?.avg_time_spent_by_batch_millis || 0;
                                                            
                                                            return (
                                                                <div key={`item-${index}`} className="flex items-center justify-between space-x-3 sm:space-x-4">
                                                                    <div className="flex items-center space-x-2">
                                                                        <div 
                                                                            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shadow-sm" 
                                                                            style={{ backgroundColor: entry.color }}
                                                                        />
                                                                        <span className="text-xs sm:text-sm text-gray-700 font-medium">
                                                                            {entry.name}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs sm:text-sm font-semibold text-gray-900">
                                                                        {formatTimeFromMillis(originalMillis, 'full')}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {/* Performance indicator in tooltip */}
                                                    {payload.length >= 2 && payload[0]?.value !== undefined && payload[1]?.value !== undefined && (
                                                        <div className="mt-2 sm:mt-3 pt-2 border-t border-gray-200">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-gray-600">Performance vs Batch:</span>
                                                                <span className={`font-semibold ${
                                                                    (payload[0].value || 0) >= (payload[1].value || 0) ? 'text-success-600' : 'text-warning-600'
                                                                }`}>
                                                                    {(payload[0].value || 0) >= (payload[1].value || 0) ? '↗ Above' : '↘ Below'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
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
                                    strokeDasharray="8 4"
                                    dot={{
                                        fill: "hsl(var(--muted-foreground))",
                                        r: 3,
                                        strokeWidth: 2,
                                        stroke: "white"
                                    }}
                                    activeDot={{
                                        r: 5,
                                        stroke: "hsl(var(--muted-foreground))",
                                        strokeWidth: 3,
                                        fill: "white",
                                        className: "animate-gentle-pulse"
                                    }}
                                />
                                
                                {/* User Time Line (Foreground) */}
                                <Line
                                    dataKey="avg_daily_time_minutes"
                                    type="monotone"
                                    name="Your Time"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    fill="url(#primaryGradient)"
                                    dot={{
                                        fill: "hsl(var(--primary))",
                                        r: 4,
                                        strokeWidth: 3,
                                        stroke: "white"
                                    }}
                                    activeDot={{
                                        r: 6,
                                        stroke: "hsl(var(--primary))",
                                        strokeWidth: 3,
                                        fill: "white",
                                        className: "animate-gentle-pulse"
                                    }}
                                />
                            </LineChart>
                        </ChartContainer>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Performance Insights */}
            {chartData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-primary-50/50 to-white/80 rounded-lg p-3 sm:p-4 border border-primary-200/40">
                        <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp size={14} className="text-primary-600" />
                            <span className="text-xs sm:text-sm font-semibold text-gray-900">Consistency</span>
                        </div>
                        <p className="text-xs text-gray-600">
                            {chartData.filter(d => d.avg_daily_time_minutes > 0).length}/{chartData.length} active days
                        </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-success-50/50 to-white/80 rounded-lg p-3 sm:p-4 border border-success-200/40">
                        <div className="flex items-center space-x-2 mb-2">
                            <Clock size={14} className="text-success-600" />
                            <span className="text-xs sm:text-sm font-semibold text-gray-900">Peak Day</span>
                        </div>
                        <p className="text-xs text-gray-600">
                            {formatTimeFromMillis(Math.max(...chartData.map(d => d.time_spent_by_user_millis)), 'minutes')}
                        </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-info-50/50 to-white/80 rounded-lg p-3 sm:p-4 border border-info-200/40">
                        <div className="flex items-center space-x-2 mb-2">
                            <Users size={14} className="text-info-600" />
                            <span className="text-xs sm:text-sm font-semibold text-gray-900">Vs Batch</span>
                        </div>
                        <p className="text-xs text-gray-600">
                            {performanceRatio > 1 ? '+' : ''}{((performanceRatio - 1) * 100).toFixed(0)}% difference
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};