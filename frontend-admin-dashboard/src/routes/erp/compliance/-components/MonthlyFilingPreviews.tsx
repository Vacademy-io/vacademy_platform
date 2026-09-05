import { useQuery } from '@tanstack/react-query';
import { getInstituteId } from '@/constants/helper';
import { MoneyCell } from '@/components/design-system/money-cell';
import { ERP_KEY } from '@/routes/erp/-shared/hr-service';
import {
    fetchEsiReturn,
    fetchPfEcr,
    fetchPtReturn,
    fetchWpsExport,
} from '@/routes/erp/-shared/hr-service';
import type { MonthValue } from '@/components/design-system/month-picker';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
} from '@/routes/erp/people/-components/HrStates';
import { ComplianceSkipped, ComplianceStat, ComplianceWarnings } from './compliance-shared';

/** Shared frame: loading / error / empty, then the caller's summary + table. */
const PreviewFrame = ({
    isLoading,
    isError,
    onRetry,
    isEmpty,
    emptyText,
    children,
}: {
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    isEmpty: boolean;
    emptyText: string;
    children: React.ReactNode;
}) => {
    if (isLoading) return <HrLoadingRows rows={5} />;
    if (isError) {
        return <HrErrorState message="Could not build this filing." onRetry={onRetry} />;
    }
    if (isEmpty) return <HrEmptyState title="Nothing to file" description={emptyText} />;
    return <>{children}</>;
};

const TableShell = ({
    headers,
    children,
}: {
    headers: string[];
    children: React.ReactNode;
}) => (
    <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-body">
            <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase text-neutral-500">
                    {headers.map((h, i) => (
                        <th
                            key={h}
                            className={`px-3 py-2 font-medium ${i === 0 ? 'text-start' : 'text-end'}`}
                        >
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    </div>
);

export const EcrPreview = ({ period }: { period: MonthValue }) => {
    const query = useQuery({
        queryKey: [...ERP_KEY, 'ecr', period.year, period.month],
        queryFn: () => fetchPfEcr(period.month, period.year),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.rows ?? [];

    return (
        <PreviewFrame
            isLoading={query.isLoading}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            isEmpty={rows.length === 0 && !data?.skipped?.length}
            emptyText="No PF contributions were recorded for this month."
        >
            <div className="flex flex-col gap-4">
                <ComplianceWarnings warnings={data?.warnings} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ComplianceStat label="Members" value={data?.memberCount ?? rows.length} />
                    <ComplianceStat label="EPF wages" value={data?.totalEpfWages} isMoney />
                    <ComplianceStat label="EPF contribution" value={data?.totalEpfContri} isMoney />
                    <ComplianceStat label="EPS contribution" value={data?.totalEpsContri} isMoney />
                </div>
                <ComplianceSkipped skipped={data?.skipped} />
                <TableShell
                    headers={['Member', 'UAN', 'EPF wages', 'Employee', 'EPS', 'Diff', 'NCP']}
                >
                    {rows.map((r, i) => (
                        <tr
                            key={`${r.uan ?? r.employeeCode ?? i}`}
                            className="border-b border-neutral-100 last:border-0"
                        >
                            <td className="px-3 py-2 text-neutral-700">
                                {r.memberName || r.employeeCode || '—'}
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                {r.uan || '—'}
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.epfWages ?? null} />
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.epfContriRemitted ?? null} />
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.epsContriRemitted ?? null} />
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.epfEpsDiffRemitted ?? null} />
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                {r.ncpDays ?? 0}
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </div>
        </PreviewFrame>
    );
};

export const EsiPreview = ({ period }: { period: MonthValue }) => {
    const query = useQuery({
        queryKey: [...ERP_KEY, 'esi', period.year, period.month],
        queryFn: () => fetchEsiReturn(period.month, period.year),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.rows ?? [];

    return (
        <PreviewFrame
            isLoading={query.isLoading}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            isEmpty={rows.length === 0 && !data?.skipped?.length}
            emptyText="No employees were within the ESI wage ceiling this month."
        >
            <div className="flex flex-col gap-4">
                <ComplianceWarnings warnings={data?.warnings} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ComplianceStat label="Insured persons" value={data?.ipCount ?? rows.length} />
                    <ComplianceStat label="Total wages" value={data?.totalWages} isMoney />
                    <ComplianceStat label="IP contribution" value={data?.totalIpContribution} isMoney />
                    <ComplianceStat
                        label="Employer contribution"
                        value={data?.totalEmployerContribution}
                        isMoney
                    />
                </div>
                <ComplianceSkipped skipped={data?.skipped} />
                <TableShell headers={['Employee', 'IP number', 'Days', 'Wage', 'IP', 'Employer']}>
                    {rows.map((r, i) => (
                        <tr
                            key={`${r.ipNumber ?? r.employeeCode ?? i}`}
                            className="border-b border-neutral-100 last:border-0"
                        >
                            <td className="px-3 py-2 text-neutral-700">
                                {r.name || r.employeeCode || '—'}
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                {r.ipNumber || '—'}
                            </td>
                            <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                {r.daysWorked ?? '—'}
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.monthlyWage ?? null} />
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.ipContribution ?? null} />
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.employerContribution ?? null} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </div>
        </PreviewFrame>
    );
};

export const PtPreview = ({ period }: { period: MonthValue }) => {
    const query = useQuery({
        queryKey: [...ERP_KEY, 'pt', period.year, period.month],
        queryFn: () => fetchPtReturn(period.month, period.year),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.rows ?? [];

    return (
        <PreviewFrame
            isLoading={query.isLoading}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            isEmpty={rows.length === 0}
            emptyText="No professional tax was deducted this month."
        >
            <div className="flex flex-col gap-4">
                <ComplianceWarnings warnings={data?.warnings} />
                <div className="grid gap-3 sm:grid-cols-3">
                    <ComplianceStat label="State" value={data?.stateCode ?? '—'} />
                    <ComplianceStat label="Employees" value={data?.employeeCount ?? rows.length} />
                    <ComplianceStat label="Total PT" value={data?.grandTotalPt} isMoney />
                </div>

                {data?.slabs?.length ? (
                    <div className="flex flex-col gap-2">
                        <span className="text-caption uppercase text-neutral-500">Slab summary</span>
                        <TableShell headers={['Slab amount', 'Employees', 'Total']}>
                            {data.slabs.map((s, i) => (
                                <tr key={i} className="border-b border-neutral-100 last:border-0">
                                    <td className="px-3 py-2">
                                        <MoneyCell value={s.ptAmount ?? null} className="text-start" />
                                    </td>
                                    <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                        {s.employeeCount ?? '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <MoneyCell value={s.totalAmount ?? null} />
                                    </td>
                                </tr>
                            ))}
                        </TableShell>
                    </div>
                ) : null}

                <TableShell headers={['Employee', 'Gross', 'PT']}>
                    {rows.map((r, i) => (
                        <tr
                            key={`${r.employeeCode ?? i}`}
                            className="border-b border-neutral-100 last:border-0"
                        >
                            <td className="px-3 py-2 text-neutral-700">
                                {r.name || r.employeeCode || '—'}
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.grossSalary ?? null} />
                            </td>
                            <td className="px-3 py-2">
                                <MoneyCell value={r.ptAmount ?? null} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </div>
        </PreviewFrame>
    );
};

export const WpsPreview = ({ period }: { period: MonthValue }) => {
    const query = useQuery({
        queryKey: [...ERP_KEY, 'wps', period.year, period.month],
        queryFn: () => fetchWpsExport(period.month, period.year),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const isSaudi = (data?.format ?? '').toUpperCase().includes('SAUDI');
    const rows = isSaudi ? (data?.saudiRows ?? []) : (data?.edrRows ?? []);

    return (
        <PreviewFrame
            isLoading={query.isLoading}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            isEmpty={rows.length === 0 && !data?.skipped?.length}
            emptyText="No approved payroll entries for this month."
        >
            <div className="flex flex-col gap-4">
                <ComplianceWarnings warnings={data?.warnings} />
                <div className="grid gap-3 sm:grid-cols-3">
                    <ComplianceStat label="Employees" value={data?.employeeCount ?? rows.length} />
                    <ComplianceStat
                        label="Total net pay"
                        value={data?.totalNetPay}
                        currency={data?.currency}
                        isMoney
                    />
                    <ComplianceStat label="Establishment" value={data?.establishmentId ?? '—'} />
                </div>
                <ComplianceSkipped skipped={data?.skipped} />

                {isSaudi ? (
                    <TableShell headers={['Employee', 'IBAN', 'Basic', 'Other', 'Deductions', 'Net']}>
                        {(data?.saudiRows ?? []).map((r, i) => (
                            <tr
                                key={`${r.employeeCode ?? i}`}
                                className="border-b border-neutral-100 last:border-0"
                            >
                                <td className="px-3 py-2 text-neutral-700">
                                    {r.employeeName || r.employeeCode || '—'}
                                </td>
                                <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                    {r.iban || '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.basicSalary ?? null} currency={r.currency} />
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.otherEarnings ?? null} currency={r.currency} />
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.deductions ?? null} currency={r.currency} />
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.netSalary ?? null} currency={r.currency} />
                                </td>
                            </tr>
                        ))}
                    </TableShell>
                ) : (
                    <TableShell headers={['Employee', 'IBAN', 'Days', 'Fixed', 'Variable', 'Net']}>
                        {(data?.edrRows ?? []).map((r, i) => (
                            <tr
                                key={`${r.employeeCode ?? i}`}
                                className="border-b border-neutral-100 last:border-0"
                            >
                                <td className="px-3 py-2 text-neutral-700">
                                    {r.employeeName || r.employeeCode || '—'}
                                </td>
                                <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                    {r.iban || '—'}
                                </td>
                                <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                    {r.daysInPeriod ?? '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.fixedIncome ?? null} currency={r.currency} />
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell
                                        value={r.variableIncome ?? null}
                                        currency={r.currency}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.netPay ?? null} currency={r.currency} />
                                </td>
                            </tr>
                        ))}
                    </TableShell>
                )}
            </div>
        </PreviewFrame>
    );
};
