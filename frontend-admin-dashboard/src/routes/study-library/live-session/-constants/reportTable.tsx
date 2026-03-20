import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle } from '@phosphor-icons/react';

export interface ReportTableData {
    index: number;
    username: string;
    attendanceStatus: string | null;
}
export interface RegistrationTableData {
    index: number;
    username: string;
    phoneNumber: string;
    email: string;
}

export const reportColumns: ColumnDef<ReportTableData>[] = [
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
export const registrationColumns: ColumnDef<RegistrationTableData>[] = [
    {
        accessorKey: 'index',
        header: 'Sr. No.',
    },
    {
        accessorKey: 'username',
        header: 'Members Name',
    },
    {
        accessorKey: 'phoneNumber',
        header: 'Members Phone Number',
    },
    {
        accessorKey: 'email',
        header: 'Members Email',
    },
];

export const REPORT_WIDTH: Record<string, string> = {
    index: 'w-[20px]',
    username: 'w-[120px]',
    attendanceStatus: 'w-[150px]',
};
export const REGISTRATION_WIDTH: Record<string, string> = {
    index: 'w-[20px]',
    username: 'w-[150px]',
    phoneNumber: 'w-[150px]',
    email: 'w-[150px]',
};
