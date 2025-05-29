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
        <div className="flex flex-col gap-6">
            <div className="flex flex-col">
                <p className="text-subtitle font-semibold">Past 7 days Learning Insights</p>
                <p className="text-body font-semibold">Avg. time spent: <span className="text-primary-500">{avgTimeSpent}</span></p>
            </div>

            <div>
                {/* graph */}
                <LineChartComponent userActivity={userActivity} />
            </div>

            <div>
                {/* table */}
                <StudentProgressTable userActivity={userActivity} />
            </div>
        </div>
    )
}