import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';

export interface AttendanceReportTableData {
    index: number;
    username: string;
    attendanceStatus: string | null;
    studentId: string;
    isSelected?: boolean;
}

export const attendanceReportColumnsWithCheckbox = (
    selectedStudentIds: string[],
    onSelectStudent: (studentId: string, isSelected: boolean) => void,
    onSelectAll: () => void,
    onClearAll: () => void,
    isAllSelected: boolean,
    isIndeterminate: boolean
): ColumnDef<AttendanceReportTableData>[] => [
    {
        id: 'select',
        header: ({ table }) => (
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            onSelectAll();
                        } else {
                            onClearAll();
                        }
                    }}
                    ref={(el) => {
                        if (el) (el as HTMLInputElement).indeterminate = isIndeterminate;
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm font-medium">Select</span>
            </div>
        ),
        cell: ({ row }) => (
            <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={selectedStudentIds.includes(row.original.studentId)}
                    onCheckedChange={(checked) =>
                        onSelectStudent(row.original.studentId, checked as boolean)
                    }
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'index',
        header: 'Sr. No.',
    },
    {
        accessorKey: 'username',
        header: 'Members Name',
    },
    {
        accessorKey: 'attendanceStatus',
        header: 'Attendance Status',
        cell: ({ row }) => {
            const raw = row.original.attendanceStatus;
            const status = raw ? raw.toString().toUpperCase() : '';
            if (status === 'PRESENT') {
                return (
                    <div className="flex items-center gap-2 text-success-600">
                        <CheckCircle size={20} weight="fill" />
                        <span>Present</span>
                    </div>
                );
            }
            return (
                <div className="flex items-center gap-2 text-gray-500">
                    <XCircle size={20} weight="fill" />
                    <span>Absent</span>
                </div>
            );
        },
    },
];

export const ATTENDANCE_REPORT_WIDTH: Record<string, string> = {
    select: 'w-[80px]',
    index: 'w-[60px]',
    username: 'w-[150px]',
    attendanceStatus: 'w-[150px]',
};
