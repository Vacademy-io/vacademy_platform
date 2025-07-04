import { DashboardLoader } from "@/components/core/dashboard-loader";
import { usePastLearningInsights } from "../-hooks/usePastLearningInsights";
import { LineChartComponent } from "./LineChartComponent";
import { StudentProgressTable } from "./StudentProgressTable";
import { useEffect, useState } from "react";
import { getStoredDetails } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis } from "@/helpers/formatTimeFromMiliseconds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Zap, Target, Award, TrendingUp } from "lucide-react";

// Enhanced Loading Skeleton
const AnalyticsLoadingSkeleton = () => (
    <div className="space-y-4 sm:space-y-6">
        {/* Header Skeleton */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg sm:rounded-xl"></div>
                    <div className="space-y-2">
                        <div className="w-36 h-4 sm:w-48 sm:h-5 bg-gray-200 rounded"></div>
                        <div className="w-24 h-3 sm:w-32 sm:h-4 bg-gray-200 rounded"></div>
                    </div>
                </div>
                <div className="w-24 h-12 sm:w-32 sm:h-16 bg-gray-200 rounded-lg sm:rounded-xl"></div>
            </div>
        </div>

        {/* Chart Skeleton */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 animate-pulse">
            <div className="w-32 h-5 sm:w-40 sm:h-6 bg-gray-200 rounded mb-3 sm:mb-4"></div>
            <div className="w-full h-48 sm:h-64 bg-gray-200 rounded-lg sm:rounded-xl"></div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl sm:rounded-2xl animate-pulse">
            <div className="p-4 sm:p-6 border-b border-gray-200">
                <div className="w-36 h-5 sm:w-48 sm:h-6 bg-gray-200 rounded"></div>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                        <div className="w-16 h-3 sm:w-20 sm:h-4 bg-gray-200 rounded"></div>
                        <div className="w-12 h-3 sm:w-16 sm:h-4 bg-gray-200 rounded"></div>
                        <div className="w-12 h-3 sm:w-16 sm:h-4 bg-gray-200 rounded"></div>
                        <div className="w-12 h-3 sm:w-16 sm:h-4 bg-gray-200 rounded"></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// Enhanced Stats Card Component
const StatsCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendColor, 
    description,
    gradient 
}: {
    title: string;
    value: string;
    icon: any;
    trend?: string;
    trendColor?: string;
    description: string;
    gradient: string;
}) => (
    <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-500 group">
        {/* Background gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
        
        <CardContent className="relative p-4 sm:p-6">
            {/* Floating orb effect */}
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 sm:-translate-y-2 translate-x-1 sm:translate-x-2"></div>
            
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg sm:rounded-xl text-primary-600 group-hover:scale-110 transition-transform duration-300">
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                </div>
                {trend && (
                    <Badge className={`${trendColor} border-0 text-xs font-medium px-2 py-1`}>
                        {trend}
                    </Badge>
                )}
            </div>
            
            <div className="space-y-1 sm:space-y-2">
                <div className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                    {value}
                </div>
                <div className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-700 transition-colors">
                    {title}
                </div>
                <div className="text-xs text-gray-500">
                    {description}
                </div>
            </div>
            
            {/* Progress indicator */}
            <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary-400 to-primary-600 w-0 group-hover:w-full transition-all duration-700 ease-out"></div>
        </CardContent>
    </Card>
);

export const PastLearningInsights = () => {
    const { mutate: pastLearningInsights, isPending } = usePastLearningInsights();
    const [userActivity, setUserActivity] = useState<UserActivityArray>([]);
    const [avgTimeSpent, setAvgTimeSpent] = useState<string>("0");
    const [totalSessions, setTotalSessions] = useState<number>(0);
    const [streakDays, setStreakDays] = useState<number>(0);

    useEffect(() => {
        const fetchUserActivity = async () => {
            const { student } = await getStoredDetails();
            pastLearningInsights(
                {
                    user_id: student.user_id,
                    start_date: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString(),
                    end_date: new Date().toISOString()
                },
                {
                    onSuccess: (data) => {
                        setUserActivity(data);
                        
                        if (data.length > 0) {
                            // Calculate average time spent
                            const totalMillis = data.reduce((acc, curr) => acc + curr.time_spent_by_user_millis, 0);
                            const avgMillis = totalMillis / data.length;
                            setAvgTimeSpent(formatTimeFromMillis(avgMillis));
                            
                            // Calculate total sessions
                            const sessions = data.filter(day => day.time_spent_by_user_millis > 0).length;
                            setTotalSessions(sessions);
                            
                            // Calculate streak (consecutive days with activity)
                            let streak = 0;
                            const sortedData = [...data].sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime());
                            for (const day of sortedData) {
                                if (day.time_spent_by_user_millis > 0) {
                                    streak++;
                                } else {
                                    break;
                                }
                            }
                            setStreakDays(streak);
                        }
                    },
                    onError: (error) => {
                        console.error(error);
                    }
                }
            );
        };
        fetchUserActivity();
    }, []);

    if (isPending) return <AnalyticsLoadingSkeleton />;

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
            {/* Enhanced Header Section */}
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-white/90 via-primary-50/30 to-white/80 shadow-sm hover:shadow-lg transition-all duration-500 group">
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 left-1/3 w-20 h-20 sm:w-32 sm:h-32 bg-primary-300 rounded-full blur-3xl animate-gentle-pulse"></div>
                    <div className="absolute bottom-1/3 right-1/4 w-24 h-24 sm:w-40 sm:h-40 bg-primary-200 rounded-full blur-3xl animate-gentle-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
                
                <CardHeader className="relative pb-4 sm:pb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                            <div className="p-2 sm:p-3 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl sm:rounded-2xl shadow-sm flex-shrink-0">
                                <TrendingUp size={24} className="text-primary-600 sm:w-7 sm:h-7" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                                    Learning Analytics
                                </CardTitle>
                                <p className="text-sm sm:text-base text-gray-600 mt-1 flex items-center space-x-2">
                                    <BarChart3 size={14} className="text-primary-500 flex-shrink-0" />
                                    <span>Past 7 days performance insights</span>
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-center sm:justify-end">
                            <Badge className="bg-primary-100 text-primary-700 border-primary-200 text-xs sm:text-sm px-2 sm:px-3 py-1">
                                <Zap size={12} className="mr-1" />
                                Live Analytics
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <StatsCard
                    title="Average Study Time"
                    value={avgTimeSpent}
                    icon={Clock}
                    description="Daily learning average"
                    gradient="from-blue-500/5 to-primary-500/5"
                />
                <StatsCard
                    title="Active Sessions"
                    value={totalSessions.toString()}
                    icon={Target}
                    trend={totalSessions >= 4 ? "+12%" : ""}
                    trendColor={totalSessions >= 4 ? "bg-success-100 text-success-700" : ""}
                    description="Learning sessions this week"
                    gradient="from-green-500/5 to-emerald-500/5"
                />
                <StatsCard
                    title="Learning Streak"
                    value={`${streakDays} day${streakDays !== 1 ? 's' : ''}`}
                    icon={Award}
                    trend={streakDays >= 3 ? "🔥" : ""}
                    trendColor="bg-warning-100 text-warning-700"
                    description="Consecutive learning days"
                    gradient="from-purple-500/5 to-pink-500/5"
                />
            </div>

            {/* Enhanced Chart Section */}
            <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-500">
                <CardHeader className="border-b border-gray-100/80 pb-3 sm:pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                                <BarChart3 size={18} className="text-primary-600" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-base sm:text-lg font-semibold text-gray-900">
                                    Activity Trend
                                </CardTitle>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                    Daily study time comparison with batch average
                                </p>
                            </div>
                        </div>
                        <Badge variant="secondary" className="bg-primary-50 text-primary-700 border-primary-200 text-xs self-start sm:self-auto">
                            7 Days
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    <LineChartComponent userActivity={userActivity} />
                </CardContent>
            </Card>

            {/* Enhanced Table Section */}
            <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-500">
                <CardHeader className="border-b border-gray-100/80 bg-gradient-to-r from-gray-50/80 to-primary-50/20 pb-3 sm:pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
                                <Target size={18} className="text-gray-600" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-base sm:text-lg font-semibold text-gray-900">
                                    Daily Progress
                                </CardTitle>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                    Detailed breakdown of your learning sessions
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Badge className="bg-success-100 text-success-700 border-success-200 text-xs">
                                <div className="w-1.5 h-1.5 bg-success-500 rounded-full mr-1 animate-pulse"></div>
                                Updated
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-0">
                    <div className="p-4 sm:p-6">
                        <StudentProgressTable userActivity={userActivity} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};