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
}

export const StudentProgressTable = ({ userActivity }: { userActivity: UserActivityArray }) => {
    // Transform API data for the table
    const tableData: StudentProgress[] = userActivity.map(item => ({
        raw_date: item.activity_date, // Keep original date for sorting
        date: dayjs(item.activity_date).format("DD MMM YYYY"),
        time_spent: formatTimeFromMillis(item.time_spent_by_user_millis),
        time_spent_batch: formatTimeFromMillis(item.avg_time_spent_by_batch_millis)
    }));
    
    // Sort by date, newest first
    tableData.sort((a, b) => new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime());

    const columns: ColumnDef<StudentProgress>[] = [
        {
            accessorKey: "date",
            header: "Date",
        },
        {
            accessorKey: "time_spent",
            header: "Your Time Spent",
        },
        {
            accessorKey: "time_spent_batch",
            header: "Batch Average Time",
        }
    ];

    return (
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
    )
}