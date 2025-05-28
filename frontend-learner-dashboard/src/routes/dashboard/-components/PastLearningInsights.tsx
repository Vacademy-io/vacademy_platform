import { LineChartComponent } from "./LineChartComponent"
import { StudentProgressTable } from "./StudentProgressTable"

export const PastLearningInsights = () => {
    return(
        <div className="flex flex-col gap-6">
            <div className="flex flex-col">
                <p className="text-subtitle font-semibold">Past 7 days Learning Insights</p>
                <p className="text-body font-semibold">Avg. time spent: <span className="text-primary-500">10 mins</span></p>
            </div>

            <div>
                {/* graph */}
                <LineChartComponent />
            </div>

            <div>
                {/* table */}
                <StudentProgressTable />
            </div>
        </div>
    )
}