import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, ClipboardText, XCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { StatusChip } from '@/components/design-system/status-chips';
import { formatDate } from '@/lib/formatters';
import { useHrRole } from '@/hooks/use-hr-role';
import { humanizeToken } from '@/routes/erp/people/-components/EmployeeFields';
import { SingleFilterChip } from '@/routes/erp/people/-components/SingleFilterChip';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
    HrNoAccessCard,
} from '@/routes/erp/people/-components/HrStates';
import type { RegularizationDTO } from '@/routes/erp/-shared/hr-types';
import { useRegularizations } from '../-hooks/use-attendance';
import {
    AttendanceStatusChip,
    REGULARIZATION_STATUSES,
    formatClockTime,
    regularizationTone,
    type RegularizationStatus,
} from './attendance-meta';
import {
    RegularizationActionDialog,
    type RegularizationDecision,
} from './RegularizationActionDialog';

/**
 * The queue of "my attendance is wrong" requests.
 *
 * Opens on PENDING because that is the only state with work in it — the approved
 * and rejected lists are history, and landing on "all" would bury three requests
 * that need a decision under three hundred that don't.
 */
export const RegularizationsMain = () => {
    const { isHrAdmin, isHrStaff } = useHrRole();
    const [status, setStatus] = useState<RegularizationStatus>('PENDING');
    const [pending, setPending] = useState<{
        request: RegularizationDTO;
        decision: RegularizationDecision;
    } | null>(null);

    const query = useRegularizations(status);
    const rows = useMemo(() => query.data ?? [], [query.data]);

    const columns = useMemo<ColumnDef<RegularizationDTO>[]>(() => {
        const base: ColumnDef<RegularizationDTO>[] = [
            {
                id: 'employee',
                header: 'Employee',
                size: 200,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="truncate text-body font-semibold text-foreground">
                            {row.original.employee_name || 'Employee'}
                        </span>
                        {row.original.employee_code && (
                            <span className="text-caption text-muted-foreground">
                                {row.original.employee_code}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'date',
                header: 'Date',
                size: 120,
                cell: ({ row }) => (
                    <span className="text-body text-foreground">
                        {row.original.attendance_date
                            ? formatDate(row.original.attendance_date)
                            : '—'}
                    </span>
                ),
            },
            {
                id: 'change',
                header: 'Requested change',
                size: 240,
                cell: ({ row }) => (
                    <div className="flex flex-wrap items-center gap-2">
                        <AttendanceStatusChip status={row.original.original_status} />
                        <span className="text-caption text-muted-foreground">→</span>
                        <AttendanceStatusChip status={row.original.requested_status} />
                    </div>
                ),
            },
            {
                id: 'times',
                header: 'Times',
                size: 200,
                cell: ({ row }) => (
                    <div className="flex flex-col text-caption tabular-nums">
                        <span className="text-muted-foreground">
                            was {formatClockTime(row.original.original_check_in)}–
                            {formatClockTime(row.original.original_check_out)}
                        </span>
                        <span className="text-foreground">
                            asks {formatClockTime(row.original.requested_check_in)}–
                            {formatClockTime(row.original.requested_check_out)}
                        </span>
                    </div>
                ),
            },
            {
                id: 'reason',
                header: 'Reason',
                size: 240,
                cell: ({ row }) => (
                    <span className="truncate text-body text-muted-foreground">
                        {row.original.reason || '—'}
                    </span>
                ),
            },
        ];

        if (status !== 'PENDING') {
            base.push({
                id: 'outcome',
                header: 'Outcome',
                size: 180,
                cell: ({ row }) => (
                    <div className="flex flex-col gap-1">
                        <StatusChip
                            text={humanizeToken(row.original.approval_status) || 'Pending'}
                            textSize="text-caption"
                            status={regularizationTone(row.original.approval_status)}
                            showIcon={false}
                        />
                        {row.original.remarks && (
                            <span className="truncate text-caption text-muted-foreground">
                                {row.original.remarks}
                            </span>
                        )}
                    </div>
                ),
            });
        }

        if (isHrAdmin && status === 'PENDING') {
            base.push({
                id: 'actions',
                header: 'Decision',
                size: 180,
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            onClick={() =>
                                setPending({ request: row.original, decision: 'APPROVED' })
                            }
                        >
                            <CheckCircle size={15} className="text-success-600" /> Approve
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="text"
                            scale="small"
                            onClick={() =>
                                setPending({ request: row.original, decision: 'REJECTED' })
                            }
                        >
                            <XCircle size={15} className="text-danger-600" /> Reject
                        </MyButton>
                    </div>
                ),
            });
        }

        return base;
    }, [isHrAdmin, status]);

    if (!isHrStaff) return <HrNoAccessCard />;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
                <h2 className="text-h2-semibold text-foreground">Regularizations</h2>
                <p className="max-w-3xl text-body text-muted-foreground">
                    Corrections employees have asked for on their own attendance — a missed
                    check-in, a day marked absent that wasn&apos;t. Approving one rewrites the
                    attendance record for that day, so the corrected day is what payroll pays
                    against.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <SingleFilterChip
                    label="Status"
                    options={REGULARIZATION_STATUSES.map((option) => ({
                        id: option,
                        label: humanizeToken(option),
                    }))}
                    value={status}
                    onChange={(next) => setStatus((next as RegularizationStatus) ?? 'PENDING')}
                />
                <span className="text-caption text-muted-foreground">
                    {rows.length} {rows.length === 1 ? 'request' : 'requests'}{' '}
                    {humanizeToken(status).toLowerCase()}
                </span>
            </div>

            {query.isLoading ? (
                <HrLoadingRows rows={4} />
            ) : query.isError ? (
                <HrErrorState
                    message="Couldn't load regularization requests."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    icon={<ClipboardText size={36} className="text-muted-foreground" />}
                    title={
                        status === 'PENDING'
                            ? 'Nothing waiting for a decision'
                            : `No ${humanizeToken(status).toLowerCase()} requests`
                    }
                    description={
                        status === 'PENDING'
                            ? 'Requests appear here when an employee asks for a correction to their attendance.'
                            : 'Switch the status filter to see the other requests.'
                    }
                />
            ) : (
                <MyTable<RegularizationDTO>
                    data={{
                        content: rows,
                        total_pages: 1,
                        page_no: 0,
                        page_size: rows.length,
                        total_elements: rows.length,
                        last: true,
                    }}
                    columns={columns}
                    isLoading={false}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            {!isHrAdmin && (
                <p className="text-caption text-muted-foreground">
                    You can review requests but not decide them — approving or rejecting needs an HR
                    Admin role in this institute.
                </p>
            )}

            <RegularizationActionDialog
                open={!!pending}
                onOpenChange={(open) => !open && setPending(null)}
                request={pending?.request ?? null}
                decision={pending?.decision ?? 'APPROVED'}
            />
        </div>
    );
};
