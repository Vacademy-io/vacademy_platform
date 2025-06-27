import { DashboardLoader } from "@/components/core/dashboard-loader";
import { usePastLearningInsights } from "../-hooks/usePastLearningInsights";
import { LineChartComponent } from "./LineChartComponent";
import { StudentProgressTable } from "./StudentProgressTable";
import { useEffect, useState } from "react";
import { getStoredDetails } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis } from "@/helpers/formatTimeFromMiliseconds";

export const PastLearningInsights = () => {
    const {mutate: pastLearningInsights, isPending} = usePastLearningInsights();
    const [userActivity, setUserActivity] = useState<UserActivityArray>([]);
    const [avgTimeSpent, setAvgTimeSpent] = useState<string>("0");

    useEffect(() => {
        const fetchUserActivity = async () => {
            const {student} = await getStoredDetails();
            pastLearningInsights({
                user_id: student.user_id,
                start_date: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString(),
                end_date: new Date().toISOString()
            },
            {
                onSuccess: (data) => {
                    console.log("data: ", data);
                    setUserActivity(data);
                    
                    // Calculate average time spent
                    if (data.length > 0) {
                        const totalMillis = data.reduce((acc, curr) => acc + curr.time_spent_by_user_millis, 0);
                        const avgMillis = totalMillis / data.length;
                        setAvgTimeSpent(formatTimeFromMillis(avgMillis));
                    }
                },
                onError: (error) => {
                    console.error(error);
                }
            })
        }
        fetchUserActivity();
    }, []);

    if(isPending) return <DashboardLoader />

    return(
        <div className="flex flex-col gap-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Clean Header Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                
                <div className="relative z-10 w-full">
                    {/* Main Content Section */}
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-primary-50 rounded-lg flex-shrink-0">
                            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Learning Analytics</h2>
                            <p className="text-sm text-gray-500">Comprehensive performance insights from the past 7 days</p>
                        </div>
                    </div>
                    
                    {/* Stats Card Section - Separate Row */}
                    <div className="flex justify-end">
                        <div className="w-full sm:w-auto sm:max-w-sm">
                            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <div className="text-right">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Average Study Time</p>
                                        <p className="text-xl font-semibold text-gray-900">{avgTimeSpent}</p>
                                        <p className="text-xs text-gray-500 mt-1">Daily average</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Section */}
            <div>
                <LineChartComponent userActivity={userActivity} />
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-200 rounded-lg text-gray-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
            <div>
                                <h3 className="text-base font-semibold text-gray-900">Daily Progress Details</h3>
                                <p className="text-sm text-gray-500">Detailed breakdown of your learning sessions</p>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-green-50 rounded-lg border border-green-200">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs font-medium text-green-700">Live Data</span>
                        </div>
                    </div>
                </div>
                
                {/* Table Container */}
                <div className="p-4">
                <StudentProgressTable userActivity={userActivity} />
                </div>
            </div>
        </div>
    )
}