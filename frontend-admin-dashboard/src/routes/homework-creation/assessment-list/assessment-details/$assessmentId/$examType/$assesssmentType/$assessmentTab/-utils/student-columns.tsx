/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { ColumnDef, Row } from '@tanstack/react-table';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { MyDropdown } from '@/components/design-system/dropdown';
import { StudentTable } from '@/types/student-table-types';
import { AssessmentStatusOptions } from '../-components/AssessmentStatusOptions';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowSquareOut } from 'phosphor-react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StatusChips } from '@/components/design-system/chips';

interface CustomTableMeta {
    onSort?: (columnId: string, direction: string) => void;
}

const DetailsCell = ({ row }: { row: Row<StudentTable> }) => {
    const { setSelectedStudent } = useStudentSidebar();

    return (
        <SidebarTrigger
            onClick={() => {
                setSelectedStudent(row.original);
            }}
        >
            <ArrowSquareOut className="size-10 cursor-pointer text-neutral-600" />
        </SidebarTrigger>
    );
};

export const assessmentStatusStudentAttemptedColumnsInternal: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'package_session_id',
        header: 'Batch',
    },
    {
        accessorKey: 'attempt_date',
        header: 'Attempt Date',
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
    },
    {
        accessorKey: 'end_time',
        header: 'End Time',
    },
    {
        accessorKey: 'duration',
        header: 'Duration',
    },
    {
        accessorKey: 'score',
        header: 'Score',
    },
    {
        accessorKey: 'evaluation_status',
        header: 'Evaluation Status',
        cell: ({ row }) => {
            const status = row.original.status || 'evaluated';
            const statusMapping: Record<string, ActivityStatus> = {
                EVALUATED: 'evaluated',
                PENDING: 'pending',
            };

            const mappedStatus = statusMapping[status] || 'evaluated';
            return <StatusChips status={mappedStatus} />;
        },
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => (
            <AssessmentStatusOptions student={row.original} studentType="Attempted" />
        ),
    },
];

export const assessmentStatusStudentOngoingColumnsInternal: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => <AssessmentStatusOptions student={row.original} studentType="Ongoing" />,
    },
];

export const assessmentStatusStudentPendingColumnsInternal: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => <AssessmentStatusOptions student={row.original} studentType="Pending" />,
    },
];

export const assessmentStatusStudentAttemptedColumnsExternal: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'attempt_date',
        header: 'Attempt Date',
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
    },
    {
        accessorKey: 'end_time',
        header: 'End Time',
    },
    {
        accessorKey: 'duration',
        header: 'Duration',
    },
    {
        accessorKey: 'score',
        header: 'Score',
    },
    {
        accessorKey: 'evaluation_status',
        header: 'Evaluation Status',
        cell: ({ row }) => {
            const status = row.original.status || 'evaluated';
            const statusMapping: Record<string, ActivityStatus> = {
                EVALUATED: 'evaluated',
                PENDING: 'pending',
            };

            const mappedStatus = statusMapping[status] || 'evaluated';
            return <StatusChips status={mappedStatus} />;
        },
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => (
            <AssessmentStatusOptions student={row.original} studentType="Attempted" />
        ),
    },
];

export const assessmentStatusStudentOngoingColumnsExternal: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => <AssessmentStatusOptions student={row.original} studentType="Ongoing" />,
    },
];

export const assessmentStatusStudentPendingColumnsExternal: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => <AssessmentStatusOptions student={row.original} studentType="Pending" />,
    },
];

export const assessmentStatusStudentQuestionResponseInternal: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'package_session_id',
        header: 'Batch',
    },
    {
        accessorKey: 'institute_enrollment_id',
        header: 'Enrollment Number',
    },
    {
        accessorKey: 'gender',
        header: 'Gender',
    },
    {
        accessorKey: 'responseTime',
        header: 'Response Time',
    },
];

export const assessmentStatusStudentQuestionResponseExternal: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'gender',
        header: 'Gender',
    },
    {
        accessorKey: 'responseTime',
        header: 'Response Time',
    },
];

export const studentInternalOrCloseQuestionWise: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'package_session_id',
        header: 'Batch',
    },
    {
        accessorKey: 'registration_id',
        header: 'Enrollment Number',
    },
    {
        accessorKey: 'response_time_in_seconds',
        header: 'Response Time',
    },
];

export const studentExternalQuestionWise: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'response_time_in_seconds',
        header: 'Response Time',
    },
];

export const step3ParticipantsListColumn: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'package_session_id',
        header: 'Batch',
    },
    {
        accessorKey: 'institute_enrollment_id',
        header: 'Enrollment Number',
    },
    {
        accessorKey: 'gender',
        header: 'Gender',
    },
    {
        accessorKey: 'mobile_number',
        header: 'Phone Number',
    },
    {
        accessorKey: 'email',
        header: 'Email ID',
    },
    {
        accessorKey: 'city',
        header: 'City',
    },
    {
        accessorKey: 'region',
        header: 'State',
    },
];

export const step3ParticipantsListIndividualStudentColumn: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
    },
    {
        accessorKey: 'mobile_number',
        header: 'Phone Number',
    },
    {
        accessorKey: 'email',
        header: 'Email ID',
    },
];
