/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { ColumnDef, Row } from '@tanstack/react-table';
import { CaretUp, CaretDown, WarningCircle } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { MyDropdown } from '@/components/design-system/dropdown';
import { StudentTable } from '@/types/student-table-types';
import { AssessmentStatusOptions } from '../-components/AssessmentStatusOptions';
import { SubmissionFileCell } from '../-components/SubmissionFileCell';
import { EvaluationStatusCell } from '../-components/EvaluationStatusCell';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StatusChips } from '@/components/design-system/chips';
import { useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface CustomTableMeta {
    onSort?: (columnId: string, direction: string) => void;
}

const useClickHandlers = () => {
    const clickTimeout = useRef<NodeJS.Timeout | null>(null);
    const { setSelectedStudent, selectedStudent } = useStudentSidebar();
    const { setOpen, open } = useSidebar();

    const handleClick = (columnId: string, row: Row<StudentTable>) => {
        if (clickTimeout.current) clearTimeout(clickTimeout.current);
        clickTimeout.current = setTimeout(() => {
            if (selectedStudent?.id != row.original.id) {
                setSelectedStudent(row.original);
                setOpen(true);
            } else {
                if (open == true) setOpen(false);
                else setOpen(true);
            }
        }, 250);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
        }
    };

    return { handleClick, handleDoubleClick };
};

const CreateClickableCell = ({ row, columnId }: { row: Row<StudentTable>; columnId: string }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();

    return (
        <div
            onClick={() => handleClick(columnId, row)}
            onDoubleClick={(e) => handleDoubleClick(e)}
            className="cursor-pointer"
        >
            {row.getValue(columnId)}
        </div>
    );
};

// Duration cell that flags a near-zero attempt time. A "0.00 min" duration means
// the learner submitted almost instantly — usually a non-attempt or auto-submit,
// which a teacher scanning submissions should be able to spot at a glance.
const DurationCell = ({ row }: { row: Row<StudentTable> }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();
    const value = String(row.getValue('duration') ?? '');
    const minutes = parseFloat(value);
    const isInstant = !Number.isNaN(minutes) && minutes <= 0;

    return (
        <div
            onClick={() => handleClick('duration', row)}
            onDoubleClick={(e) => handleDoubleClick(e)}
            className="flex cursor-pointer items-center gap-1"
        >
            <span>{value}</span>
            {isInstant && (
                <span
                    title="Instant submit — no measurable time spent. Possible non-attempt or auto-submit."
                    className="inline-flex items-center text-warning-600"
                >
                    <WarningCircle size={16} weight="fill" />
                </span>
            )}
        </div>
    );
};

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

// Reusable ASC/DESC sortable column header. `sortKey` is the frontend column id
// the parent's `meta.onSort` maps to a backend sort key (studentName, score,
// duration, attemptDate). Keeps the caret UI consistent across columns.
const SortableHeader = ({
    props,
    label,
    sortKey,
}: {
    props: { table: { options: { meta?: CustomTableMeta } } };
    label: string;
    sortKey: string;
}) => {
    const meta = props.table.options.meta as CustomTableMeta;
    return (
        <div className="relative">
            <MyDropdown
                dropdownList={['ASC', 'DESC']}
                onSelect={(value) => meta.onSort?.(sortKey, value)}
            >
                <button className="flex w-full cursor-pointer items-center justify-between">
                    <div>{label}</div>
                    <div>
                        <CaretUp />
                        <CaretDown />
                    </div>
                </button>
            </MyDropdown>
        </div>
    );
};

// Only shown for MANUAL evaluation assessments (spliced in by
// getAllColumnsForTable): whether the attempt has a submitted answer-sheet
// file, with an on-behalf upload when it doesn't.
export const assessmentSubmissionFileColumn: ColumnDef<StudentTable> = {
    id: 'submission_file',
    header: 'Submission',
    cell: ({ row }) => (
        <SubmissionFileCell
            attemptId={row.original.attempt_id}
            studentName={row.original.full_name}
        />
    ),
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
                        onSelect={(value) => meta.onSort?.('full_name', value)}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'package_session_id',
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
        cell: ({ row }) => <CreateClickableCell row={row} columnId="package_session_id" />,
    },
    {
        accessorKey: 'attempt_date',
        header: (props) => <SortableHeader props={props} label="Attempt Date" sortKey="attempt_date" />,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="attempt_date" />,
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="start_time" />,
    },
    {
        accessorKey: 'end_time',
        header: 'End Time',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="end_time" />,
    },
    {
        accessorKey: 'duration',
        header: (props) => <SortableHeader props={props} label="Duration" sortKey="duration" />,
        cell: ({ row }) => <DurationCell row={row} />,
    },
    {
        accessorKey: 'score',
        header: (props) => <SortableHeader props={props} label="Score" sortKey="score" />,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="score" />,
    },

    {
        accessorKey: 'evaluation_status',
        header: 'Evaluation Status',
        // Chip + (manual evaluation only) an eye button to open the evaluated copy.
        cell: ({ row }) => <EvaluationStatusCell row={row} />,
    },
    {
        accessorKey: 'result_status',
        header: 'Result Status',
        cell: ({ row }) => {
            const status = row.original.result_status;
            // API returns: "PENDING" | "RELEASED"
            const statusMapping: Record<string, string> = {
                RELEASED: 'released',
                PENDING: 'pending',
            };
            const mappedStatus = statusMapping[status] || 'pending';
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
                            <div>Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="start_time" />,
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
                            <div>Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
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
                            <div>Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'attempt_date',
        header: (props) => <SortableHeader props={props} label="Attempt Date" sortKey="attempt_date" />,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="attempt_date" />,
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="start_time" />,
    },
    {
        accessorKey: 'end_time',
        header: 'End Time',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="end_time" />,
    },
    {
        accessorKey: 'duration',
        header: (props) => <SortableHeader props={props} label="Duration" sortKey="duration" />,
        cell: ({ row }) => <DurationCell row={row} />,
    },
    {
        accessorKey: 'score',
        header: (props) => <SortableHeader props={props} label="Score" sortKey="score" />,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="score" />,
    },
    {
        accessorKey: 'result_status',
        header: 'Result Status',
        cell: ({ row }) => {
            const status = row.original.result_status;

            if (status === 'RELEASED') {
                return (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Released
                    </span>
                );
            } else if (status === 'PENDING') {
                return (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        Pending
                    </span>
                );
            } else {
                return <span className="text-gray-400">N/A</span>;
            }
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
                            <div>Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'start_time',
        header: 'Start Time',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="start_time" />,
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
                            <div>Name</div>
                            <div>
                                <CaretUp />
                                <CaretDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
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
                            <div>Name</div>
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
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
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
                            <div>Name</div>
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
                            <div>Name</div>
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
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
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
                            <div>Name</div>
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
                            <div>Name</div>
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
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
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
                            <div>Name</div>
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
