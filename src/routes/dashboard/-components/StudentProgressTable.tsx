import { MyTable } from "@/components/design-system/table";
import { ColumnDef } from "@tanstack/react-table";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis } from "@/helpers/formatTimeFromMiliseconds";
import dayjs from "dayjs";

interface StudentProgress {
    date: string;
    time_spent: string;
    time_spent_batch: string;
    raw_date: string; // For sorting purposes
    status: string;
}

export const StudentProgressTable = ({ userActivity }: { userActivity: UserActivityArray }) => {
    // Transform API data for the table
    const tableData: StudentProgress[] = userActivity.map(item => {
        const userTime = item.time_spent_by_user_millis;
        const batchAvg = item.avg_time_spent_by_batch_millis;
        
        // Determine status based on comparison with batch average
        let status = "Average";
        if (userTime > batchAvg * 1.2) status = "Above";
        else if (userTime < batchAvg * 0.8) status = "Below";
        
        return {
            raw_date: item.activity_date,
            date: dayjs(item.activity_date).format("MMM DD"),
            time_spent: formatTimeFromMillis(userTime),
            time_spent_batch: formatTimeFromMillis(batchAvg),
            status
        };
    });
    
    // Sort by date, newest first
    tableData.sort((a, b) => new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime());

    const columns: ColumnDef<StudentProgress>[] = [
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => (
                <div className="text-xs md:text-sm font-medium text-neutral-900">
                    {row.getValue("date")}
                </div>
            ),
        },
        {
            accessorKey: "time_spent",
            header: "Your Time",
            cell: ({ row }) => (
                <div className="text-xs md:text-sm text-neutral-700">
                    {row.getValue("time_spent")}
                </div>
            ),
        },
        {
            accessorKey: "time_spent_batch",
            header: "Batch Avg",
            cell: ({ row }) => (
                <div className="text-xs md:text-sm text-neutral-500">
                    {row.getValue("time_spent_batch")}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                const statusConfig = {
                    "Above": { bg: "bg-primary-50", text: "text-primary-700", border: "border-primary-200" },
                    "Below": { bg: "bg-neutral-50", text: "text-neutral-600", border: "border-neutral-200" },
                    "Average": { bg: "bg-neutral-50", text: "text-neutral-600", border: "border-neutral-200" }
                };
                const config = statusConfig[status as keyof typeof statusConfig];
                
                return (
                    <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
                        {status}
                    </div>
                );
            },
        }
    ];

    return (
        <div className="overflow-hidden">
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
            />
        </div>
    )
}