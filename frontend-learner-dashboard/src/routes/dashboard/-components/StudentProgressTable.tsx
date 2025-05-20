import { MyTable } from "@/components/design-system/table"
import { ColumnDef } from "@tanstack/react-table"

interface StudentProgress {
    date: string;
    time_spent: number;
    time_spent_batch: number;
}

export const StudentProgressTable = () => {
    const columns: ColumnDef<StudentProgress>[] = [
        {
            accessorKey: "date",
            header: "Date",
        },
        {
            accessorKey: "time_spent",
            header: "Time Spent",
        },
        {
            accessorKey: "time_spent_batch",
            header: "Time Spent by Batch(Avg)",
        }
    ];

    return (
        <MyTable
            data={{
                content: [{
                    date: "2024-01-01",
                    time_spent: 10,
                    time_spent_batch: 10,
                },
                {
                    date: "2024-01-02",
                    time_spent: 20,
                    time_spent_batch: 20,
                },
                {
                    date: "2024-01-03",
                    time_spent: 30,
                    time_spent_batch: 30,
                },
                ],
                total_pages: 1,
                page_no: 0,
                page_size: 7,
                total_elements: 7,
                last: true
            }}
            columns={columns}
            isLoading={false}
            error={null}
            currentPage={0}
        />
    )
}