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
import { useTranslation } from 'react-i18next';

// NOTE: this module exports plain, module-scope-evaluated `ColumnDef[]` arrays
// (not functions), and their `header`/`cell` slots are always invoked by
// TanStack Table's `flexRender`, which renders them as real React components
// (`<Comp {...props} />`). That gives every header/cell definition below a
// valid hook context, so translated strings are pulled via small named
// components using `useTranslation('assessmentStudentColumns')` rather than
// the i18next singleton — this keeps the labels reactive to language
// switches and keeps every call site of the exported arrays unchanged.

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
    const { t } = useTranslation('assessmentStudentColumns');
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
                    title={t('tooltip.instantSubmit')}
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

// Translated sortable "Name" header — replaces the near-identical inline
// header render function that used to be duplicated across every column
// array below (all of them sort the same `full_name` field with the same
// dropdown UI, so they now share this one wrapper for the translated label).
const NameHeaderCell = (props: { table: { options: { meta?: CustomTableMeta } } }) => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <SortableHeader props={props} label={t('columns.name')} sortKey="full_name" />;
};

const AttemptDateHeaderCell = (props: { table: { options: { meta?: CustomTableMeta } } }) => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <SortableHeader props={props} label={t('columns.attemptDate')} sortKey="attempt_date" />;
};

const DurationHeaderCell = (props: { table: { options: { meta?: CustomTableMeta } } }) => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <SortableHeader props={props} label={t('columns.duration')} sortKey="duration" />;
};

const ScoreHeaderCell = (props: { table: { options: { meta?: CustomTableMeta } } }) => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <SortableHeader props={props} label={t('columns.score')} sortKey="score" />;
};

// Simple translated-text headers (no sort dropdown). Defined as components
// (rather than plain strings) so they can call useTranslation() — TanStack
// Table's flexRender renders every header/cell definition as a real React
// component, so this is a valid hook context.
const DetailsHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.details')}</>;
};

const StartTimeHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.startTime')}</>;
};

const EndTimeHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.endTime')}</>;
};

const EvaluationStatusHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.evaluationStatus')}</>;
};

const ResultStatusHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.resultStatus')}</>;
};

const EnrollmentNumberHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.enrollmentNumber')}</>;
};

const GenderHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.gender')}</>;
};

const ResponseTimeHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.responseTime')}</>;
};

const PhoneNumberHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.phoneNumber')}</>;
};

const EmailIdHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.emailId')}</>;
};

const CityHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.city')}</>;
};

const StateHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.state')}</>;
};

const SubmissionHeaderCell = () => {
    const { t } = useTranslation('assessmentStudentColumns');
    return <>{t('columns.submission')}</>;
};

// "Released" / "Pending" / "N/A" result-status badge, translated. Extracted
// into a component (previously inline JSX in the `cell` render function) so
// it can call useTranslation().
const ResultStatusBadgeCell = ({ row }: { row: Row<StudentTable> }) => {
    const { t } = useTranslation('assessmentStudentColumns');
    const status = row.original.result_status;

    if (status === 'RELEASED') {
        return (
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                {t('status.released')}
            </span>
        );
    } else if (status === 'PENDING') {
        return (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                {t('status.pending')}
            </span>
        );
    } else {
        return <span className="text-gray-400">{t('status.notAvailable')}</span>;
    }
};

// Only shown for MANUAL evaluation assessments (spliced in by
// getAllColumnsForTable): whether the attempt has a submitted answer-sheet
// file, with an on-behalf upload when it doesn't.
export const assessmentSubmissionFileColumn: ColumnDef<StudentTable> = {
    id: 'submission_file',
    header: SubmissionHeaderCell,
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
        header: DetailsHeaderCell,
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'package_session_id',
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
        cell: ({ row }) => <CreateClickableCell row={row} columnId="package_session_id" />,
    },
    {
        accessorKey: 'attempt_date',
        header: AttemptDateHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="attempt_date" />,
    },
    {
        accessorKey: 'start_time',
        header: StartTimeHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="start_time" />,
    },
    {
        accessorKey: 'end_time',
        header: EndTimeHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="end_time" />,
    },
    {
        accessorKey: 'duration',
        header: DurationHeaderCell,
        cell: ({ row }) => <DurationCell row={row} />,
    },
    {
        accessorKey: 'score',
        header: ScoreHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="score" />,
    },

    {
        accessorKey: 'evaluation_status',
        header: EvaluationStatusHeaderCell,
        // Chip + (manual evaluation only) an eye button to open the evaluated copy.
        cell: ({ row }) => <EvaluationStatusCell row={row} />,
    },
    {
        accessorKey: 'result_status',
        header: ResultStatusHeaderCell,
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
        header: DetailsHeaderCell,
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'start_time',
        header: StartTimeHeaderCell,
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
        header: DetailsHeaderCell,
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
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
        header: DetailsHeaderCell,
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'attempt_date',
        header: AttemptDateHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="attempt_date" />,
    },
    {
        accessorKey: 'start_time',
        header: StartTimeHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="start_time" />,
    },
    {
        accessorKey: 'end_time',
        header: EndTimeHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="end_time" />,
    },
    {
        accessorKey: 'duration',
        header: DurationHeaderCell,
        cell: ({ row }) => <DurationCell row={row} />,
    },
    {
        accessorKey: 'score',
        header: ScoreHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="score" />,
    },
    {
        accessorKey: 'result_status',
        header: ResultStatusHeaderCell,
        cell: ({ row }) => <ResultStatusBadgeCell row={row} />,
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
        header: DetailsHeaderCell,
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'start_time',
        header: StartTimeHeaderCell,
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
        header: DetailsHeaderCell,
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
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
        header: NameHeaderCell,
    },
    {
        accessorKey: 'package_session_id',
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
    },
    {
        accessorKey: 'institute_enrollment_id',
        header: EnrollmentNumberHeaderCell,
    },
    {
        accessorKey: 'gender',
        header: GenderHeaderCell,
    },
    {
        accessorKey: 'responseTime',
        header: ResponseTimeHeaderCell,
    },
];

export const assessmentStatusStudentQuestionResponseExternal: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
    },
    {
        accessorKey: 'gender',
        header: GenderHeaderCell,
    },
    {
        accessorKey: 'responseTime',
        header: ResponseTimeHeaderCell,
    },
];

export const studentInternalOrCloseQuestionWise: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
    },
    {
        accessorKey: 'package_session_id',
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
    },
    {
        accessorKey: 'registration_id',
        header: EnrollmentNumberHeaderCell,
    },
    {
        accessorKey: 'response_time_in_seconds',
        header: ResponseTimeHeaderCell,
    },
];

export const studentExternalQuestionWise: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
    },
    {
        accessorKey: 'response_time_in_seconds',
        header: ResponseTimeHeaderCell,
    },
];

export const step3ParticipantsListColumn: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
    },
    {
        accessorKey: 'package_session_id',
        header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
    },
    {
        accessorKey: 'institute_enrollment_id',
        header: EnrollmentNumberHeaderCell,
    },
    {
        accessorKey: 'gender',
        header: GenderHeaderCell,
    },
    {
        accessorKey: 'mobile_number',
        header: PhoneNumberHeaderCell,
    },
    {
        accessorKey: 'email',
        header: EmailIdHeaderCell,
    },
    {
        accessorKey: 'city',
        header: CityHeaderCell,
    },
    {
        accessorKey: 'region',
        header: StateHeaderCell,
    },
];

export const step3ParticipantsListIndividualStudentColumn: ColumnDef<StudentTable>[] = [
    {
        accessorKey: 'full_name',
        header: NameHeaderCell,
    },
    {
        accessorKey: 'mobile_number',
        header: PhoneNumberHeaderCell,
    },
    {
        accessorKey: 'email',
        header: EmailIdHeaderCell,
    },
];
