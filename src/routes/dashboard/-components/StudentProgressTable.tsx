import { MyTable } from "@/components/design-system/table";
import { ColumnDef } from "@tanstack/react-table";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis } from "@/helpers/formatTimeFromMiliseconds";
import dayjs from "dayjs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Clock, Target } from "lucide-react";

interface StudentProgress {
    date: string;
    time_spent: string;
    time_spent_batch: string;
    raw_date: string; // For sorting purposes
    status: string;
    user_millis: number;
    batch_millis: number;
    performance_trend: 'up' | 'down' | 'neutral';
}

export const StudentProgressTable = ({ userActivity }: { userActivity: UserActivityArray }) => {
    // Transform API data for the table
    const tableData: StudentProgress[] = userActivity.map((item, index) => {
        const userTime = item.time_spent_by_user_millis;
        const batchAvg = item.avg_time_spent_by_batch_millis;
        
        // Determine status based on comparison with batch average
        let status = "Average";
        let performance_trend: 'up' | 'down' | 'neutral' = 'neutral';
        
        if (userTime > batchAvg * 1.2) {
            status = "Above";
            performance_trend = 'up';
        } else if (userTime < batchAvg * 0.8) {
            status = "Below"; 
            performance_trend = 'down';
        }
        
        return {
            raw_date: item.activity_date,
            date: dayjs(item.activity_date).format("MMM DD"),
            time_spent: formatTimeFromMillis(userTime),
            time_spent_batch: formatTimeFromMillis(batchAvg),
            status,
            user_millis: userTime,
            batch_millis: batchAvg,
            performance_trend
        };
    });
    
    // Sort by date, newest first
    tableData.sort((a, b) => new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime());

    const columns: ColumnDef<StudentProgress>[] = [
        {
            accessorKey: "date",
            header: () => (
                <div className="flex items-center space-x-2 text-gray-700 font-semibold">
                    <Clock size={16} className="text-primary-500" />
                    <span>Date</span>
                </div>
            ),
            cell: ({ row }) => {
                const isToday = dayjs(row.original.raw_date).isSame(dayjs(), 'day');
                const isRecent = dayjs().diff(dayjs(row.original.raw_date), 'days') <= 1;
                
                return (
                    <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                            isToday ? 'bg-primary-500 animate-pulse shadow-md' : 
                            isRecent ? 'bg-primary-300' : 'bg-gray-300'
                        }`}></div>
                        <div>
                            <div className="text-sm font-semibold text-gray-900">
                                {row.getValue("date")}
                            </div>
                            <div className="text-xs text-gray-500">
                                {dayjs(row.original.raw_date).format("dddd")}
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "time_spent",
            header: () => (
                <div className="flex items-center space-x-2 text-gray-700 font-semibold">
                    <Target size={16} className="text-primary-500" />
                    <span>Your Time</span>
                </div>
            ),
            cell: ({ row }) => {
                const userTime = row.original.user_millis;
                const batchTime = row.original.batch_millis;
                const percentage = batchTime > 0 ? ((userTime / batchTime) * 100) : 100;
                
                return (
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-900">
                            {row.getValue("time_spent")}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                    percentage >= 120 ? 'bg-success-500' :
                                    percentage >= 100 ? 'bg-primary-500' :
                                    percentage >= 80 ? 'bg-info-500' :
                                    'bg-warning-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-xs text-gray-500">
                            {percentage.toFixed(0)}% of batch avg
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "time_spent_batch",
            header: () => (
                <div className="flex items-center space-x-2 text-gray-700 font-semibold">
                    <TrendingUp size={16} className="text-gray-500" />
                    <span>Batch Avg</span>
                </div>
            ),
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-700">
                        {row.getValue("time_spent_batch")}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span>Class average</span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: () => (
                <div className="flex items-center space-x-2 text-gray-700 font-semibold">
                    <span>Performance</span>
                </div>
            ),
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                const trend = row.original.performance_trend;
                
                const statusConfig = {
                    "Above": { 
                        bg: "bg-success-50", 
                        text: "text-success-700", 
                        border: "border-success-200",
                        icon: TrendingUp,
                        iconColor: "text-success-600"
                    },
                    "Below": { 
                        bg: "bg-warning-50", 
                        text: "text-warning-700", 
                        border: "border-warning-200",
                        icon: TrendingDown,
                        iconColor: "text-warning-600"
                    },
                    "Average": { 
                        bg: "bg-info-50", 
                        text: "text-info-700", 
                        border: "border-info-200",
                        icon: Minus,
                        iconColor: "text-info-600"
                    }
                };
                
                const config = statusConfig[status as keyof typeof statusConfig];
                const IconComponent = config.icon;
                
                return (
                    <div className="flex items-center space-x-3">
                        <Badge className={`${config.bg} ${config.text} ${config.border} border text-xs font-semibold px-3 py-1.5 flex items-center space-x-1.5`}>
                            <IconComponent size={12} className={config.iconColor} />
                            <span>{status}</span>
                        </Badge>
                    </div>
                );
            },
        }
    ];

    // Loading state
    if (!userActivity.length) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg animate-pulse">
                        <div className="w-16 h-4 bg-gray-200 rounded"></div>
                        <div className="w-20 h-4 bg-gray-200 rounded"></div>
                        <div className="w-20 h-4 bg-gray-200 rounded"></div>
                        <div className="w-24 h-4 bg-gray-200 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Enhanced Header with Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-gradient-to-br from-primary-50/50 to-white/80 rounded-lg p-3 sm:p-4 border border-primary-200/40">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">Total Sessions</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {tableData.filter(row => row.user_millis > 0).length}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                        Active learning days
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-success-50/50 to-white/80 rounded-lg p-3 sm:p-4 border border-success-200/40">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">Above Average</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {tableData.filter(row => row.status === "Above").length}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                        High performance days
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-info-50/50 to-white/80 rounded-lg p-3 sm:p-4 border border-info-200/40">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-info-500 rounded-full"></div>
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">Consistency</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {Math.round((tableData.filter(row => row.user_millis > 0).length / tableData.length) * 100)}%
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                        Learning frequency
                    </div>
                </div>
            </div>

            {/* Enhanced Table */}
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-sm w-full max-w-full">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>
                
                {/* Mobile-responsive table container */}
                <div className="relative w-full max-w-full overflow-hidden">
                    {/* Mobile Card View */}
                    <div className="block sm:hidden space-y-3">
                        {tableData.map((row, index) => (
                            <div key={index} className="bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        <div className={`w-3 h-3 rounded-full ${
                                            dayjs(row.raw_date).isSame(dayjs(), 'day') ? 'bg-primary-500 animate-pulse' : 
                                            dayjs().diff(dayjs(row.raw_date), 'days') <= 1 ? 'bg-primary-300' : 'bg-gray-300'
                                        }`}></div>
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900">{row.date}</div>
                                            <div className="text-xs text-gray-500">{dayjs(row.raw_date).format("dddd")}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Badge className={`${
                                            row.status === "Above" ? 'bg-success-50 text-success-700 border-success-200' :
                                            row.status === "Below" ? 'bg-warning-50 text-warning-700 border-warning-200' :
                                            'bg-info-50 text-info-700 border-info-200'
                                        } border text-xs font-semibold px-2 py-1`}>
                                            {row.status}
                                        </Badge>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600">Your Time</span>
                                        <span className="text-sm font-semibold text-gray-900">{row.time_spent}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600">Batch Avg</span>
                                        <span className="text-sm text-gray-700">{row.time_spent_batch}</span>
                                    </div>
                                    
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                            <span>Progress vs Batch</span>
                                            <span>{((row.user_millis / row.batch_millis) * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-700 ${
                                                    (row.user_millis / row.batch_millis) >= 1.2 ? 'bg-success-500' :
                                                    (row.user_millis / row.batch_millis) >= 1.0 ? 'bg-primary-500' :
                                                    (row.user_millis / row.batch_millis) >= 0.8 ? 'bg-info-500' :
                                                    'bg-warning-500'
                                                }`}
                                                style={{ width: `${Math.min((row.user_millis / row.batch_millis) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto w-full max-w-full">
                        <MyTable
                            data={{
                                content: tableData,
                                total_pages: 1,
                                page_no: 0,
                                page_size: tableData.length,
                                total_elements: tableData.length,
                                last: true
                            }}
                            columns={columns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            className="[&_table]:bg-transparent [&_table]:w-full [&_table]:max-w-full [&_thead]:bg-gradient-to-r [&_thead]:from-gray-50/80 [&_thead]:to-primary-50/30 [&_tbody_tr]:hover:bg-primary-50/30 [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-200 [&_th]:text-xs [&_th]:sm:text-sm [&_td]:text-xs [&_td]:sm:text-sm [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-2"
                        />
                    </div>
                </div>
                
                {/* Enhanced Footer */}
                <div className="border-t border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-primary-50/20 px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-600">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 sm:w-3 h-2 sm:h-3 bg-success-500 rounded-full"></div>
                                <span>Above Average</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 sm:w-3 h-2 sm:h-3 bg-info-500 rounded-full"></div>
                                <span>On Track</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 sm:w-3 h-2 sm:h-3 bg-warning-500 rounded-full"></div>
                                <span>Needs Focus</span>
                            </div>
                        </div>
                        <div className="text-gray-500 font-medium text-center sm:text-right">
                            Last 7 days • {tableData.length} entries
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};