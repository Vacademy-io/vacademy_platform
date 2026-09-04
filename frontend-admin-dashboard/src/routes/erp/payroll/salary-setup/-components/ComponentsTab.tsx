import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Info, Minus, PencilSimple, Plus, Warning } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { MyTable, type TableData } from '@/components/design-system/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getInstituteId } from '@/constants/helper';
import { fetchSalaryComponents, hrKeys } from '@/routes/erp/-shared/hr-service';
import type { SalaryComponentDTO } from '@/routes/erp/-shared/hr-types';
import { ComponentDialog } from './ComponentDialog';
import { COMPONENT_CATEGORY_LABELS, ComponentTypeChip } from './salary-meta';

const GL_TOOLTIP =
    'Where this component posts in the accounting journal; blank uses the default for its type';

const BoolCell = ({ value }: { value: boolean | undefined }) =>
    value ? (
        <Check size={16} className="text-success-600" aria-label="Yes" />
    ) : (
        <Minus size={16} className="text-neutral-300" aria-label="No" />
    );

/**
 * The institute's salary component catalogue.
 *
 * Read-only for HR staff; only HR admins get the add/edit affordances (the
 * backend enforces the same, so hiding them just avoids a guaranteed 403).
 */
export const ComponentsTab = ({ isHrAdmin }: { isHrAdmin: boolean }) => {
    const instituteId = getInstituteId();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SalaryComponentDTO | null>(null);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: hrKeys.salaryComponents(),
        queryFn: fetchSalaryComponents,
        enabled: !!instituteId,
    });

    const rows = useMemo(
        () =>
            [...(data ?? [])].sort(
                (a, b) =>
                    (a.display_order ?? 0) - (b.display_order ?? 0) ||
                    (a.name ?? '').localeCompare(b.name ?? '')
            ),
        [data]
    );

    const openCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (component: SalaryComponentDTO) => {
        setEditing(component);
        setDialogOpen(true);
    };

    const columns = useMemo<ColumnDef<SalaryComponentDTO>[]>(
        () => [
            {
                id: 'name',
                header: 'Component',
                accessorKey: 'name',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-body text-neutral-700">
                            {row.original.name ?? '—'}
                        </span>
                        {row.original.description && (
                            <span className="truncate text-caption text-neutral-500">
                                {row.original.description}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'code',
                header: 'Code',
                accessorKey: 'code',
                cell: ({ row }) => (
                    <span className="font-mono text-caption text-neutral-600">
                        {row.original.code ?? '—'}
                    </span>
                ),
            },
            {
                id: 'type',
                header: 'Type',
                cell: ({ row }) => <ComponentTypeChip type={row.original.type} />,
            },
            {
                id: 'category',
                header: 'Category',
                cell: ({ row }) => (
                    <span className="text-body text-neutral-600">
                        {COMPONENT_CATEGORY_LABELS[(row.original.category ?? '').toUpperCase()] ??
                            row.original.category ??
                            '—'}
                    </span>
                ),
            },
            {
                id: 'is_taxable',
                header: 'Taxable',
                cell: ({ row }) => <BoolCell value={row.original.is_taxable} />,
            },
            {
                id: 'is_statutory',
                header: 'Statutory',
                cell: ({ row }) => <BoolCell value={row.original.is_statutory} />,
            },
            {
                id: 'gl_account_code',
                header: () => (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex cursor-help items-center gap-1">
                                    GL account
                                    <Info size={14} className="text-neutral-400" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                                {GL_TOOLTIP}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ),
                cell: ({ row }) =>
                    row.original.gl_account_code ? (
                        <span className="font-mono text-caption text-neutral-600">
                            {row.original.gl_account_code}
                        </span>
                    ) : (
                        <span className="text-caption text-neutral-400">Default</span>
                    ),
            },
            {
                id: 'is_active',
                header: 'State',
                cell: ({ row }) => (
                    <StatusChip
                        text={row.original.is_active === false ? 'Inactive' : 'Active'}
                        textSize="text-caption"
                        status={row.original.is_active === false ? 'INFO' : 'SUCCESS'}
                        showIcon={false}
                    />
                ),
            },
            ...(isHrAdmin
                ? [
                      {
                          id: 'actions',
                          header: '',
                          cell: ({ row }) => (
                              <MyButton
                                  buttonType="text"
                                  scale="small"
                                  layoutVariant="icon"
                                  aria-label={`Edit ${row.original.name ?? 'component'}`}
                                  onClick={() => openEdit(row.original)}
                              >
                                  <PencilSimple size={16} />
                              </MyButton>
                          ),
                      } as ColumnDef<SalaryComponentDTO>,
                  ]
                : []),
        ],
        [isHrAdmin]
    );

    const tableData: TableData<SalaryComponentDTO> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-2xl text-body text-neutral-600">
                    Every line that can appear on a payslip. Codes are what the payroll engine
                    matches on, so treat them as identifiers rather than labels.
                </p>
                {isHrAdmin && (
                    <MyButton buttonType="primary" scale="medium" onClick={openCreate}>
                        <Plus size={16} />
                        Add component
                    </MyButton>
                )}
            </div>

            {isError ? (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-6">
                        <div className="flex items-center gap-2 text-body text-danger-600">
                            <Warning size={18} />
                            Could not load salary components.
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onAsyncClick={async () => {
                                await refetch();
                            }}
                            loadingText="Retrying…"
                        >
                            Retry
                        </MyButton>
                    </CardContent>
                </Card>
            ) : !isLoading && rows.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-6">
                        <p className="text-subtitle text-neutral-700">No components yet</p>
                        <p className="max-w-xl text-body text-neutral-600">
                            Start with the earnings you actually pay — BASIC and HRA are usually
                            first. Statutory deductions (TDS, PF, ESI, PT) are created by payroll
                            itself, so you don&apos;t need to add them.
                        </p>
                        {isHrAdmin && (
                            <MyButton buttonType="primary" scale="medium" onClick={openCreate}>
                                <Plus size={16} />
                                Add component
                            </MyButton>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <MyTable<SalaryComponentDTO>
                    data={tableData}
                    columns={columns}
                    isLoading={isLoading}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            <ComponentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                component={editing}
                existingCodes={rows.map((row) => (row.code ?? '').toUpperCase())}
            />
        </div>
    );
};
