import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DownloadSimple, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MoneyCell } from '@/components/design-system/money-cell';
import { Card } from '@/components/ui/card';
import { getInstituteId } from '@/constants/helper';
import { HR_COMPLIANCE_FORM16_DOWNLOAD } from '@/constants/urls';
import { reportApiError } from '@/lib/report-api-error';
import {
    ERP_KEY,
    downloadComplianceFile,
    fetchForm16,
    fetchForm24Q,
} from '@/routes/erp/-shared/hr-service';
import { EmployeePicker } from '@/routes/erp/-shared/EmployeePicker';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
} from '@/routes/erp/people/-components/HrStates';
import { ComplianceStat, ComplianceWarnings } from './compliance-shared';

export const Form16Preview = ({ financialYear }: { financialYear: string }) => {
    const [employeeId, setEmployeeId] = useState<string>('');

    const query = useQuery({
        queryKey: [...ERP_KEY, 'form16', employeeId, financialYear],
        queryFn: () => fetchForm16(employeeId, financialYear),
        enabled: !!getInstituteId() && !!employeeId,
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;

    const handleDownload = async () => {
        try {
            await downloadComplianceFile(
                HR_COMPLIANCE_FORM16_DOWNLOAD,
                { employeeId, financialYear },
                `form16_${data?.employeeCode || employeeId}_${financialYear}.pdf`
            );
            toast.success('Form 16 downloaded');
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-compliance',
                fallbackMessage: 'Could not download Form 16.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <span className="text-caption uppercase text-neutral-500">Employee</span>
                <EmployeePicker
                    value={employeeId}
                    onChange={setEmployeeId}
                    portal={false}
                    placeholder="Choose an employee"
                />
            </div>

            {!employeeId ? (
                <HrEmptyState
                    title="Pick an employee"
                    description="Form 16 Part B is issued per employee for the financial year."
                />
            ) : query.isLoading ? (
                <HrLoadingRows rows={4} />
            ) : query.isError ? (
                <HrErrorState
                    message="Could not build Form 16 for this employee."
                    onRetry={() => void query.refetch()}
                />
            ) : (
                <>
                    <ComplianceWarnings warnings={data?.warnings} />
                    {data?.lastComputedMonth !== undefined && data.lastComputedMonth < 12 && (
                        <p className="rounded-md bg-warning-50 px-3 py-2 text-caption text-warning-700">
                            The financial year is incomplete — annual figures are projections until
                            March payroll is processed.
                        </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ComplianceStat label="Gross salary" value={data?.grossSalaryPaid} isMoney />
                        <ComplianceStat label="Total exemptions" value={data?.totalExemptions} isMoney />
                        <ComplianceStat label="Taxable income" value={data?.taxableIncome} isMoney />
                        <ComplianceStat label="TDS deducted" value={data?.totalTdsDeducted} isMoney />
                    </div>

                    <Card className="flex flex-col gap-2 p-4 text-body">
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Regime</span>
                            <span className="text-neutral-700">{data?.regime || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-neutral-500">PAN</span>
                            <span className="tabular-nums text-neutral-700">
                                {data?.employeePan || '—'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Deductor TAN</span>
                            <span className="tabular-nums text-neutral-700">
                                {data?.deductorTan || '—'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Total tax liability</span>
                            <MoneyCell value={data?.totalTaxLiability ?? null} className="w-auto" />
                        </div>
                    </Card>

                    {data?.monthlyDetails?.length ? (
                        <div className="overflow-x-auto rounded-md border border-neutral-200">
                            <table className="w-full text-body">
                                <thead>
                                    <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase text-neutral-500">
                                        <th className="px-3 py-2 text-start font-medium">Month</th>
                                        <th className="px-3 py-2 text-end font-medium">
                                            Income paid
                                        </th>
                                        <th className="px-3 py-2 text-end font-medium">TDS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.monthlyDetails.map((m, i) => (
                                        <tr
                                            key={`${m.month}-${m.year}-${i}`}
                                            className="border-b border-neutral-100 last:border-0"
                                        >
                                            <td className="px-3 py-2 text-neutral-700">
                                                {m.monthName || `${m.month}/${m.year}`}
                                            </td>
                                            <td className="px-3 py-2">
                                                <MoneyCell value={m.incomePaid ?? null} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <MoneyCell value={m.tdsDeducted ?? null} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onAsyncClick={handleDownload}
                        loadingText="Preparing…"
                    >
                        <DownloadSimple size={16} />
                        Download PDF
                    </MyButton>
                </>
            )}
        </div>
    );
};

export const Form24QPreview = ({
    financialYear,
    quarter,
}: {
    financialYear: string;
    quarter: string;
}) => {
    const query = useQuery({
        queryKey: [...ERP_KEY, '24q', financialYear, quarter],
        queryFn: () => fetchForm24Q(financialYear, quarter),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.deducteeRows ?? [];

    if (query.isLoading) return <HrLoadingRows rows={5} />;
    if (query.isError) {
        return (
            <HrErrorState
                message="Could not build the Form 24Q data."
                onRetry={() => void query.refetch()}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <ComplianceWarnings warnings={data?.warnings} />

            {/* The reconciliation signal: what was withheld vs what was actually deposited. */}
            <Card
                className={
                    data?.mismatch
                        ? 'flex flex-col gap-2 border-danger-200 bg-danger-50 p-4'
                        : 'flex flex-col gap-2 border-success-200 bg-success-50 p-4'
                }
            >
                <div
                    className={`flex items-center gap-2 ${data?.mismatch ? 'text-danger-600' : 'text-success-700'}`}
                >
                    {data?.mismatch ? <WarningCircle size={18} /> : <CheckCircle size={18} />}
                    <span className="text-subtitle font-medium">
                        {data?.mismatch
                            ? 'TDS deducted does not match the challans recorded'
                            : 'TDS deducted matches the challans recorded'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-6 text-body">
                    <span className="text-neutral-600">
                        Deducted:{' '}
                        <MoneyCell
                            value={data?.totalTdsDeducted ?? null}
                            className="inline-block w-auto"
                        />
                    </span>
                    <span className="text-neutral-600">
                        Deposited:{' '}
                        <MoneyCell
                            value={data?.totalChallanAmount ?? null}
                            className="inline-block w-auto"
                        />
                    </span>
                </div>
                {data?.mismatch && (
                    <p className="text-caption text-neutral-600">
                        Record the missing challan in the Challans register, or check whether a
                        deposit was made against a different quarter.
                    </p>
                )}
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
                <ComplianceStat label="Deductees" value={rows.length} />
                <ComplianceStat label="Challans" value={data?.challans?.length ?? 0} />
                <ComplianceStat label="Deductor TAN" value={data?.deductor?.tan ?? '—'} />
            </div>

            <div className="overflow-x-auto rounded-md border border-neutral-200">
                <table className="w-full text-body">
                    <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase text-neutral-500">
                            <th className="px-3 py-2 text-start font-medium">Employee</th>
                            <th className="px-3 py-2 text-end font-medium">PAN</th>
                            <th className="px-3 py-2 text-end font-medium">Month</th>
                            <th className="px-3 py-2 text-end font-medium">Income paid</th>
                            <th className="px-3 py-2 text-end font-medium">TDS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr
                                key={`${r.employeeId ?? i}-${r.month}`}
                                className="border-b border-neutral-100 last:border-0"
                            >
                                <td className="px-3 py-2 text-neutral-700">
                                    {r.name || r.employeeCode || '—'}
                                </td>
                                <td className="px-3 py-2 text-end tabular-nums text-neutral-600">
                                    {r.pan || '—'}
                                </td>
                                <td className="px-3 py-2 text-end text-neutral-600">
                                    {r.monthName || r.month || '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.incomePaid ?? null} />
                                </td>
                                <td className="px-3 py-2">
                                    <MoneyCell value={r.tdsDeducted ?? null} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
