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
        <div className="space-y-3 md:space-y-4">
            {/* Compact Header Section */}
            <div className="bg-white border border-neutral-200 rounded-lg p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base md:text-lg font-medium text-neutral-900">Learning Analytics</h2>
                            <p className="text-xs md:text-sm text-neutral-500">Past 7 days performance</p>
                        </div>
                    </div>
                    
                    {/* Compact Stats */}
                    <div className="bg-primary-50/50 border border-primary-200 rounded-lg p-2.5 md:p-3 min-w-0 sm:max-w-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full flex-shrink-0"></div>
                            <div className="min-w-0">
                                <p className="text-xs text-neutral-500 font-medium">Avg. Study Time</p>
                                <p className="text-lg md:text-xl font-light text-neutral-900">{avgTimeSpent}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Chart Section */}
            <div className="bg-white border border-neutral-200 rounded-lg p-3 md:p-4">
                <LineChartComponent userActivity={userActivity} />
            </div>

            {/* Compact Table Section */}
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                {/* Compact Header */}
                <div className="p-3 md:p-4 border-b border-neutral-200 bg-neutral-50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-neutral-200 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm md:text-base font-medium text-neutral-900">Daily Progress</h3>
                                <p className="text-xs text-neutral-500">Learning session breakdown</p>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-primary-50 rounded border border-primary-200">
                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                            <span className="text-xs font-medium text-primary-700">Live</span>
                        </div>
                    </div>
                </div>
                
                {/* Compact Table Container */}
                <div className="p-3 md:p-4">
                    <StudentProgressTable userActivity={userActivity} />
                </div>
            </div>
        </div>
    )
}