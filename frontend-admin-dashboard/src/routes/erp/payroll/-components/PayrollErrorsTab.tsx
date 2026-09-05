import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, Info } from '@phosphor-icons/react';
import { MyTable, type TableData } from '@/components/design-system/table';
import type { PayrollEntryError } from '@/routes/erp/-shared/hr-types';
import { HrEmptyState, HrErrorState } from '@/routes/erp/people/-components/HrStates';

/** Backend stage names are SCREAMING_SNAKE; nobody reads those in a table. */
const STAGE_LABELS: Record<string, string> = {
    SALARY_STRUCTURE: 'Salary structure',
    ATTENDANCE: 'Attendance',
    COMPONENTS: 'Components',
    TAX: 'Tax',
    STATUTORY: 'Statutory',
    LOANS: 'Loans',
    REIMBURSEMENTS: 'Reimbursements',
    ADJUSTMENTS: 'Adjustments',
    PERSIST: 'Saving the entry',
};

const prettyStage = (stage: string | undefined) => {
    if (!stage) return '—';
    const key = stage.toUpperCase();
    return STAGE_LABELS[key] ?? stage.replace(/_/g, ' ').toLowerCase();
};

interface PayrollErrorsTabProps {
    errors: PayrollEntryError[];
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
}

/**
 * The employees this run could not compute.
 *
 * Processing is per-employee and does not abort on the first failure, so a run can
 * succeed and still be incomplete — these employees are simply absent from the
 * register rather than present with a zero. That is the single most important thing
 * to say on this tab, and it is said in plain text above the table rather than left
 * to be inferred from a count badge.
 */
export const PayrollErrorsTab = ({
    errors,
    isLoading,
    isError,
    onRetry,
}: PayrollErrorsTabProps) => {
    const columns = useMemo<ColumnDef<PayrollEntryError>[]>(
        () => [
            {
                id: 'employeeId',
                header: 'Employee id',
                cell: ({ row }) => (
                    <span className="truncate font-mono text-caption text-neutral-600">
                        {row.original.employeeId ?? '—'}
                    </span>
                ),
            },
            {
                id: 'errorStage',
                header: 'Failed at',
                cell: ({ row }) => (
                    <span className="text-body capitalize text-neutral-700">
                        {prettyStage(row.original.errorStage)}
                    </span>
                ),
            },
            {
                id: 'errorMessage',
                header: 'What went wrong',
                cell: ({ row }) => (
                    <span className="text-body text-danger-600">
                        {row.original.errorMessage ?? 'No message recorded.'}
                    </span>
                ),
            },
        ],
        []
    );

    if (isError) {
        return <HrErrorState message="Could not load the errors for this run." onRetry={onRetry} />;
    }

    if (!isLoading && errors.length === 0) {
        return (
            <HrEmptyState
                icon={<CheckCircle size={32} weight="fill" className="text-success-500" />}
                title="Every employee processed cleanly."
                description="Nothing failed in this run — the register covers everyone it was meant to."
            />
        );
    }

    const tableData: TableData<PayrollEntryError> = {
        content: errors,
        total_pages: 1,
        page_no: 0,
        page_size: errors.length,
        total_elements: errors.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 p-3">
                <Info size={18} className="mt-1 shrink-0 text-warning-600" />
                <p className="text-caption text-warning-600">
                    These employees are simply <span className="font-semibold">absent</span> from
                    this run — no payslip, nothing paid. Fix the underlying data (usually a missing
                    salary structure), then Reject the run and process it again to include them.
                </p>
            </div>

            <MyTable<PayrollEntryError>
                data={tableData}
                columns={columns}
                isLoading={isLoading}
                error={null}
                currentPage={0}
                scrollable
            />
        </div>
    );
};
