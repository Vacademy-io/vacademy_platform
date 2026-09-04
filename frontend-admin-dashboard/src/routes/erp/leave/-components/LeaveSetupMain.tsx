import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Minus, PencilSimple, Plus } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { MyTable, type TableData } from '@/components/design-system/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHrRole } from '@/hooks/use-hr-role';
import { formatDate } from '@/lib/formatters';
import type { LeavePolicyDTO, LeaveTypeDTO } from '@/routes/erp/-shared/hr-types';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
    HrNoAccessCard,
} from '@/routes/erp/people/-components/HrStates';
import { useLeavePolicies, useLeaveTypes } from '@/routes/erp/leave/-hooks/use-leave';
import { LeavePolicyDialog } from './LeavePolicyDialog';
import { LeaveTypeDialog } from './LeaveTypeDialog';
import { ACCRUAL_TYPE_LABELS, GENDER_LABELS, formatDays, humanizeToken } from './leave-meta';

const BoolCell = ({ value }: { value: boolean | undefined }) =>
    value ? (
        <Check size={16} className="text-success-600" aria-label="Yes" />
    ) : (
        <Minus size={16} className="text-neutral-300" aria-label="No" />
    );

const RecordStatusChip = ({ status }: { status: string | null | undefined }) => {
    const normalized = (status ?? 'ACTIVE').toUpperCase();
    return (
        <StatusChip
            text={humanizeToken(normalized)}
            textSize="text-caption"
            status={normalized === 'ACTIVE' ? 'SUCCESS' : 'INFO'}
            showIcon={false}
        />
    );
};

const asTableData = <T,>(rows: T[]): TableData<T> => ({
    content: rows,
    total_pages: 1,
    page_no: 0,
    page_size: rows.length,
    total_elements: rows.length,
    last: true,
});

/**
 * Leave configuration, in the order it has to be done: define the kinds of leave
 * your institute grants, then write the policy that says how much of each an
 * employee gets and how it arrives. The tabs are that sequence — a policy can't
 * reference a leave type that doesn't exist yet.
 */
export const LeaveSetupMain = () => {
    const { isHrAdmin, isHrStaff } = useHrRole();
    const [typeDialogOpen, setTypeDialogOpen] = useState(false);
    const [editingType, setEditingType] = useState<LeaveTypeDTO | null>(null);
    const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<LeavePolicyDTO | null>(null);

    const typesQuery = useLeaveTypes();
    const policiesQuery = useLeavePolicies();

    const types = useMemo(
        () =>
            [...(typesQuery.data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        [typesQuery.data]
    );
    const policies = useMemo(
        () =>
            [...(policiesQuery.data ?? [])].sort((a, b) =>
                (a.leave_type_name ?? '').localeCompare(b.leave_type_name ?? '')
            ),
        [policiesQuery.data]
    );

    const typeNameById = useMemo(() => {
        const map = new Map<string, string>();
        types.forEach((type) => {
            if (type.id) map.set(type.id, type.name || type.code || 'Leave');
        });
        return map;
    }, [types]);

    const openCreateType = () => {
        setEditingType(null);
        setTypeDialogOpen(true);
    };
    const openEditType = (type: LeaveTypeDTO) => {
        setEditingType(type);
        setTypeDialogOpen(true);
    };
    const openCreatePolicy = () => {
        setEditingPolicy(null);
        setPolicyDialogOpen(true);
    };
    const openEditPolicy = (policy: LeavePolicyDTO) => {
        setEditingPolicy(policy);
        setPolicyDialogOpen(true);
    };

    const typeColumns = useMemo<ColumnDef<LeaveTypeDTO>[]>(
        () => [
            {
                id: 'name',
                header: 'Leave type',
                size: 200,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-body font-semibold text-foreground">
                            {row.original.name || '—'}
                        </span>
                        {row.original.description && (
                            <span className="truncate text-caption text-muted-foreground">
                                {row.original.description}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'code',
                header: 'Code',
                size: 110,
                cell: ({ row }) => (
                    <span className="font-mono text-caption text-muted-foreground">
                        {row.original.code || '—'}
                    </span>
                ),
            },
            {
                id: 'is_paid',
                header: 'Paid',
                size: 80,
                cell: ({ row }) => <BoolCell value={row.original.is_paid} />,
            },
            {
                id: 'carry_forward',
                header: 'Carry forward',
                size: 140,
                cell: ({ row }) =>
                    row.original.is_carry_forward ? (
                        <span className="text-body tabular-nums text-foreground">
                            {row.original.max_carry_forward === undefined ||
                            row.original.max_carry_forward === null
                                ? 'Uncapped'
                                : `Up to ${row.original.max_carry_forward}`}
                        </span>
                    ) : (
                        <BoolCell value={false} />
                    ),
            },
            {
                id: 'is_encashable',
                header: 'Encashable',
                size: 110,
                cell: ({ row }) => <BoolCell value={row.original.is_encashable} />,
            },
            {
                id: 'requires_document',
                header: 'Document',
                size: 110,
                cell: ({ row }) => <BoolCell value={row.original.requires_document} />,
            },
            {
                id: 'min_days',
                header: 'Min days',
                size: 100,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-muted-foreground">
                        {formatDays(row.original.min_days)}
                    </span>
                ),
            },
            {
                id: 'max_consecutive_days',
                header: 'Max consecutive',
                size: 140,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-muted-foreground">
                        {row.original.max_consecutive_days ?? '—'}
                    </span>
                ),
            },
            {
                id: 'applicable_gender',
                header: 'Applies to',
                size: 110,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {GENDER_LABELS[(row.original.applicable_gender ?? 'ALL').toUpperCase()] ??
                            humanizeToken(row.original.applicable_gender)}
                    </span>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                size: 110,
                cell: ({ row }) => <RecordStatusChip status={row.original.status} />,
            },
            ...(isHrAdmin
                ? [
                      {
                          id: 'actions',
                          header: '',
                          size: 70,
                          cell: ({ row }) => (
                              <MyButton
                                  buttonType="text"
                                  scale="small"
                                  layoutVariant="icon"
                                  type="button"
                                  aria-label={`Edit ${row.original.name ?? 'leave type'}`}
                                  onClick={() => openEditType(row.original)}
                              >
                                  <PencilSimple size={16} />
                              </MyButton>
                          ),
                      } as ColumnDef<LeaveTypeDTO>,
                  ]
                : []),
        ],
        [isHrAdmin]
    );

    const policyColumns = useMemo<ColumnDef<LeavePolicyDTO>[]>(
        () => [
            {
                id: 'leave_type',
                header: 'Leave type',
                size: 190,
                cell: ({ row }) => (
                    <span className="truncate text-body font-semibold text-foreground">
                        {row.original.leave_type_name ||
                            (row.original.leave_type_id
                                ? typeNameById.get(row.original.leave_type_id) ?? '—'
                                : '—')}
                    </span>
                ),
            },
            {
                id: 'annual_quota',
                header: 'Annual quota',
                size: 120,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-foreground">
                        {formatDays(row.original.annual_quota)}
                    </span>
                ),
            },
            {
                id: 'accrual_type',
                header: 'Accrual',
                size: 120,
                cell: ({ row }) => (
                    <span className="text-body text-foreground">
                        {ACCRUAL_TYPE_LABELS[(row.original.accrual_type ?? '').toUpperCase()] ??
                            (humanizeToken(row.original.accrual_type) || '—')}
                    </span>
                ),
            },
            {
                id: 'accrual_amount',
                header: 'Per period',
                size: 110,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-muted-foreground">
                        {formatDays(row.original.accrual_amount)}
                    </span>
                ),
            },
            {
                id: 'pro_rata_enabled',
                header: 'Pro-rata',
                size: 100,
                cell: ({ row }) => <BoolCell value={row.original.pro_rata_enabled} />,
            },
            {
                id: 'applicable_after_days',
                header: 'Applicable after',
                size: 140,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.applicable_after_days
                            ? `${row.original.applicable_after_days} days`
                            : 'From joining'}
                    </span>
                ),
            },
            {
                id: 'effective',
                header: 'Effective',
                size: 190,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.effective_from
                            ? `${formatDate(row.original.effective_from)} → ${
                                  row.original.effective_to
                                      ? formatDate(row.original.effective_to)
                                      : 'open'
                              }`
                            : '—'}
                    </span>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                size: 110,
                cell: ({ row }) => <RecordStatusChip status={row.original.status} />,
            },
            ...(isHrAdmin
                ? [
                      {
                          id: 'actions',
                          header: '',
                          size: 70,
                          cell: ({ row }) => (
                              <MyButton
                                  buttonType="text"
                                  scale="small"
                                  layoutVariant="icon"
                                  type="button"
                                  aria-label={`Edit the ${
                                      row.original.leave_type_name ?? 'leave'
                                  } policy`}
                                  onClick={() => openEditPolicy(row.original)}
                              >
                                  <PencilSimple size={16} />
                              </MyButton>
                          ),
                      } as ColumnDef<LeavePolicyDTO>,
                  ]
                : []),
        ],
        [isHrAdmin, typeNameById]
    );

    if (!isHrStaff) return <HrNoAccessCard />;

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-body text-muted-foreground">
                What kinds of leave your institute grants, and how much of each an employee gets.
                Requests and balances both read this configuration, so a change here affects future
                accruals and approvals — never leave that has already been approved.
            </p>

            <Tabs defaultValue="types" className="flex flex-col gap-2">
                <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
                    <TabsTrigger value="types">Leave types</TabsTrigger>
                    <TabsTrigger value="policies">Policies</TabsTrigger>
                </TabsList>

                <TabsContent value="types" className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <p className="max-w-2xl text-body text-muted-foreground">
                            The kinds of leave themselves — their rules, not their quota. Codes are
                            what balances and payroll match on, so treat them as identifiers rather
                            than labels.
                        </p>
                        {isHrAdmin && (
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                type="button"
                                onClick={openCreateType}
                            >
                                <Plus size={16} /> Add leave type
                            </MyButton>
                        )}
                    </div>

                    {typesQuery.isLoading ? (
                        <HrLoadingRows rows={4} />
                    ) : typesQuery.isError ? (
                        <HrErrorState
                            message="Couldn't load leave types."
                            onRetry={() => void typesQuery.refetch()}
                        />
                    ) : types.length === 0 ? (
                        <HrEmptyState
                            title="No leave types yet"
                            description="Start with the leave you actually grant — casual, sick and earned leave are the usual three. Unpaid leave is worth adding too: payroll treats it as loss of pay."
                        >
                            {isHrAdmin && (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    type="button"
                                    onClick={openCreateType}
                                >
                                    <Plus size={16} /> Add leave type
                                </MyButton>
                            )}
                        </HrEmptyState>
                    ) : (
                        <MyTable<LeaveTypeDTO>
                            data={asTableData(types)}
                            columns={typeColumns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            scrollable
                        />
                    )}
                </TabsContent>

                <TabsContent value="policies" className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <p className="max-w-2xl text-body text-muted-foreground">
                            How much of each leave type an employee gets, and on what rhythm the
                            scheduled accrual credits it. A leave type with no active policy grants
                            nobody anything.
                        </p>
                        {isHrAdmin && (
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                type="button"
                                onClick={openCreatePolicy}
                            >
                                <Plus size={16} /> Add policy
                            </MyButton>
                        )}
                    </div>

                    {policiesQuery.isLoading ? (
                        <HrLoadingRows rows={4} />
                    ) : policiesQuery.isError ? (
                        <HrErrorState
                            message="Couldn't load leave policies."
                            onRetry={() => void policiesQuery.refetch()}
                        />
                    ) : policies.length === 0 ? (
                        <HrEmptyState
                            title="No policies yet"
                            description={
                                types.length === 0
                                    ? 'Create a leave type first — a policy has to attach to one.'
                                    : 'Give each leave type a quota and an accrual rhythm. Until then the accrual run has nothing to credit.'
                            }
                        >
                            {isHrAdmin && types.length > 0 && (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    type="button"
                                    onClick={openCreatePolicy}
                                >
                                    <Plus size={16} /> Add policy
                                </MyButton>
                            )}
                        </HrEmptyState>
                    ) : (
                        <MyTable<LeavePolicyDTO>
                            data={asTableData(policies)}
                            columns={policyColumns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            scrollable
                        />
                    )}
                </TabsContent>
            </Tabs>

            {isHrAdmin && (
                <>
                    <LeaveTypeDialog
                        open={typeDialogOpen}
                        onOpenChange={setTypeDialogOpen}
                        leaveType={editingType}
                        existingCodes={types.map((type) => (type.code ?? '').toUpperCase())}
                    />
                    <LeavePolicyDialog
                        open={policyDialogOpen}
                        onOpenChange={setPolicyDialogOpen}
                        policy={editingPolicy}
                        leaveTypes={types}
                    />
                </>
            )}
        </div>
    );
};
