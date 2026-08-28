import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CurrencyCircleDollar } from '@phosphor-icons/react';
import { MoneyCell } from '@/components/design-system/money-cell';
import { MyTable } from '@/components/design-system/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import type {
    ComponentType,
    EmployeeSalaryComponentDTO,
    EmployeeSalaryStructureDTO,
} from '@/routes/erp/-shared/hr-types';
import { useSalaryStructures } from '../-hooks/use-hr-people';
import { DetailField, humanizeToken } from './EmployeeFields';
import { HrEmptyState, HrErrorState, HrLoadingRows } from './HrStates';

/**
 * What this employee is paid, as of now, plus every superseded revision.
 *
 * Read-only on purpose: assigning or revising a structure belongs to the Salary
 * screens (it needs templates, CTC arithmetic and an effective date), and putting
 * a second write path here would be two sources of truth for the same record.
 */

const GROUPS: Array<{
    type: ComponentType;
    label: string;
    tone: 'earning' | 'deduction' | 'default';
}> = [
    { type: 'EARNING', label: 'Earnings', tone: 'earning' },
    { type: 'DEDUCTION', label: 'Deductions', tone: 'deduction' },
    { type: 'EMPLOYER_CONTRIBUTION', label: 'Employer contributions', tone: 'default' },
];

/**
 * The structure in force. `status === 'ACTIVE'` is the backend's own marker; the
 * fallbacks cover older rows that only carry an open-ended effective window.
 */
const pickCurrent = (
    structures: EmployeeSalaryStructureDTO[]
): EmployeeSalaryStructureDTO | undefined => {
    const active = structures.find((s) => (s.status ?? '').toUpperCase() === 'ACTIVE');
    if (active) return active;
    const openEnded = structures.filter((s) => !s.effective_to);
    const pool = openEnded.length > 0 ? openEnded : structures;
    return [...pool].sort((a, b) =>
        (b.effective_from ?? '').localeCompare(a.effective_from ?? '')
    )[0];
};

function ComponentGroupTable({
    label,
    rows,
    currency,
    tone,
}: {
    label: string;
    rows: EmployeeSalaryComponentDTO[];
    currency: string;
    tone: 'earning' | 'deduction' | 'default';
}) {
    const columns = useMemo<ColumnDef<EmployeeSalaryComponentDTO>[]>(
        () => [
            {
                id: 'component',
                header: 'Component',
                size: 240,
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-body text-foreground">
                            {row.original.component_name || row.original.component_code || '—'}
                        </span>
                        {row.original.is_overridden && (
                            <span className="text-caption text-warning-600">
                                Overridden for this employee
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'calculation',
                header: 'Calculation',
                size: 180,
                cell: ({ row }) => {
                    const type = humanizeToken(row.original.calculation_type);
                    const pct = row.original.percentage_value;
                    return (
                        <span className="text-caption text-muted-foreground">
                            {type || '—'}
                            {pct !== null && pct !== undefined && pct !== '' ? ` · ${pct}%` : ''}
                        </span>
                    );
                },
            },
            {
                id: 'monthly',
                header: 'Monthly',
                size: 140,
                cell: ({ row }) => (
                    <MoneyCell
                        value={row.original.monthly_amount}
                        currency={currency}
                        tone={tone}
                        dashOnZero
                    />
                ),
            },
            {
                id: 'annual',
                header: 'Annual',
                size: 140,
                cell: ({ row }) => (
                    <MoneyCell value={row.original.annual_amount} currency={currency} dashOnZero />
                ),
            },
        ],
        [currency, tone]
    );

    if (rows.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <h4 className="text-body font-semibold text-foreground">{label}</h4>
            <div className="overflow-hidden rounded-lg border border-border">
                <MyTable<EmployeeSalaryComponentDTO>
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
                    enableColumnPinning={false}
                    scrollable
                />
            </div>
        </div>
    );
}

export function EmployeeSalaryTab({ employeeId }: { employeeId: string }) {
    const { data, isLoading, isError, refetch } = useSalaryStructures(employeeId);
    // Memoized so the derived current/history values below don't recompute (and
    // resort) on every render just because `data ?? []` made a fresh array.
    const structures = useMemo(() => data ?? [], [data]);

    const current = useMemo(() => pickCurrent(structures), [structures]);
    const history = useMemo(
        () =>
            structures
                .filter((s) => s.id !== current?.id)
                .sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? '')),
        [structures, current?.id]
    );

    if (isLoading) return <HrLoadingRows rows={3} />;

    if (isError) {
        return (
            <HrErrorState
                message="Couldn't load this employee's salary structure."
                onRetry={() => refetch()}
            />
        );
    }

    if (!current) {
        return (
            <HrEmptyState
                icon={<CurrencyCircleDollar size={36} className="text-muted-foreground" />}
                title="No salary structure assigned yet"
                description="Assign one from ERP → Salary. Until then this employee is skipped by payroll runs."
            />
        );
    }

    const currency = current.currency || 'INR';
    const components = current.components ?? [];

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-title">
                        {current.template_name || 'Current salary structure'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <DetailField
                            label="CTC (annual)"
                            value={
                                <MoneyCell
                                    value={current.ctc_annual}
                                    currency={currency}
                                    className="text-start"
                                />
                            }
                        />
                        <DetailField
                            label="CTC (monthly)"
                            value={
                                <MoneyCell
                                    value={current.ctc_monthly}
                                    currency={currency}
                                    className="text-start"
                                />
                            }
                        />
                        <DetailField
                            label="Gross (monthly)"
                            value={
                                <MoneyCell
                                    value={current.gross_monthly}
                                    currency={currency}
                                    className="text-start"
                                />
                            }
                        />
                        <DetailField
                            label="Net (monthly)"
                            value={
                                <MoneyCell
                                    value={current.net_monthly}
                                    currency={currency}
                                    className="text-start"
                                />
                            }
                        />
                        <DetailField
                            label="Effective from"
                            value={current.effective_from ? formatDate(current.effective_from) : ''}
                        />
                        <DetailField label="Currency" value={currency.toUpperCase()} />
                        <DetailField label="Status" value={humanizeToken(current.status)} />
                        <DetailField
                            label="Revision reason"
                            value={current.revision_reason}
                            className="sm:col-span-2 lg:col-span-1"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-title">Component breakdown</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {components.length === 0 ? (
                        <HrEmptyState
                            title="This structure has no components"
                            description="Add components to the salary template so payroll can compute a payslip."
                        />
                    ) : (
                        GROUPS.map((group) => (
                            <ComponentGroupTable
                                key={group.type}
                                label={group.label}
                                rows={components.filter((c) => c.component_type === group.type)}
                                currency={currency}
                                tone={group.tone}
                            />
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-title">Revision history</CardTitle>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <p className="text-body text-muted-foreground">
                            No earlier structures — this is the first one assigned.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {history.map((structure) => (
                                <li
                                    key={structure.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-body text-foreground">
                                            {structure.template_name || 'Salary structure'}
                                        </span>
                                        <span className="text-caption text-muted-foreground">
                                            {structure.effective_from
                                                ? formatDate(structure.effective_from)
                                                : '—'}
                                            {' → '}
                                            {structure.effective_to
                                                ? formatDate(structure.effective_to)
                                                : 'open'}
                                            {structure.revision_reason
                                                ? ` · ${structure.revision_reason}`
                                                : ''}
                                        </span>
                                    </div>
                                    <MoneyCell
                                        value={structure.ctc_annual}
                                        currency={structure.currency || currency}
                                        className="text-body"
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
