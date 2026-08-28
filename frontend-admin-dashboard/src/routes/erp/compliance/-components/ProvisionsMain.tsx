import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DownloadSimple, Sparkle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyInput } from '@/components/design-system/input';
import { MoneyCell } from '@/components/design-system/money-cell';
import {
    MonthPicker,
    currentMonthValue,
    formatMonthValue,
    type MonthValue,
} from '@/components/design-system/month-picker';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/design-system/status-chips';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getInstituteId } from '@/constants/helper';
import {
    HR_COMPLIANCE_EOSB_DOWNLOAD,
    HR_COMPLIANCE_GRATUITY_DOWNLOAD,
} from '@/constants/urls';
import { reportApiError } from '@/lib/report-api-error';
import { useHrRole } from '@/hooks/use-hr-role';
import {
    downloadComplianceFile,
    fetchBonusComputation,
    fetchEosbProvision,
    fetchGratuityProvision,
    fetchTaxConfiguration,
    hrKeys,
    materializeBonus,
    resolveComplianceCountry,
} from '@/routes/erp/-shared/hr-service';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
    HrNoAccessCard,
} from '@/routes/erp/people/-components/HrStates';
import { ComplianceStat, financialYearOf, recentFinancialYears } from './compliance-shared';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Long-service liabilities and the annual bonus.
 *
 * Gratuity (India) and EOSB (Gulf) are the same idea under two statutes, so the
 * institute's configured country decides which tab exists — showing both would
 * imply an institute owes both, which no institute does.
 */
export const ProvisionsMain = () => {
    const { isHrAdmin } = useHrRole();
    const [asOfDate, setAsOfDate] = useState<string>(todayIso());

    const { data: taxConfig } = useQuery({
        queryKey: hrKeys.taxConfig(),
        queryFn: fetchTaxConfiguration,
        enabled: !!getInstituteId() && isHrAdmin,
        staleTime: 10 * 60 * 1000,
    });

    if (!isHrAdmin) return <HrNoAccessCard />;

    const country = resolveComplianceCountry(taxConfig) ?? 'IND';
    const isGulf = country === 'ARE' || country === 'SAU';

    return (
        <div className="flex flex-col gap-5">
            <p className="text-body text-neutral-500">
                What the institute would owe its people for long service, and the statutory bonus
                for the year. These are provisions for the books — nothing here pays anyone until
                you materialize it into payroll.
            </p>

            <Tabs defaultValue={isGulf ? 'eosb' : 'gratuity'} className="flex flex-col gap-4">
                <TabsList className="w-fit">
                    {isGulf ? (
                        <TabsTrigger value="eosb">End of service (EOSB)</TabsTrigger>
                    ) : (
                        <TabsTrigger value="gratuity">Gratuity</TabsTrigger>
                    )}
                    {!isGulf && <TabsTrigger value="bonus">Statutory bonus</TabsTrigger>}
                </TabsList>

                {!isGulf && (
                    <TabsContent value="gratuity" className="mt-0">
                        <GratuityTab asOfDate={asOfDate} onAsOfDateChange={setAsOfDate} />
                    </TabsContent>
                )}
                {isGulf && (
                    <TabsContent value="eosb" className="mt-0">
                        <EosbTab asOfDate={asOfDate} onAsOfDateChange={setAsOfDate} />
                    </TabsContent>
                )}
                {!isGulf && (
                    <TabsContent value="bonus" className="mt-0">
                        <BonusTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

const AsOfControl = ({
    asOfDate,
    onAsOfDateChange,
    onDownload,
}: {
    asOfDate: string;
    onAsOfDateChange: (v: string) => void;
    onDownload: () => Promise<void>;
}) => (
    <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex w-64 flex-col gap-1.5">
            <span className="text-caption text-neutral-600">As of date</span>
            <MyInput
                inputType="date"
                input={asOfDate}
                onChangeFunction={(e) => onAsOfDateChange(e.target.value)}
                inputPlaceholder=""
                className="w-full"
            />
        </div>
        <MyButton
            buttonType="secondary"
            scale="medium"
            onAsyncClick={onDownload}
            loadingText="Preparing…"
        >
            <DownloadSimple size={16} />
            Download CSV
        </MyButton>
    </div>
);

const GratuityTab = ({
    asOfDate,
    onAsOfDateChange,
}: {
    asOfDate: string;
    onAsOfDateChange: (v: string) => void;
}) => {
    const query = useQuery({
        queryKey: hrKeys.gratuity(asOfDate),
        queryFn: () => fetchGratuityProvision(asOfDate),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.rows ?? [];

    const handleDownload = async () => {
        try {
            await downloadComplianceFile(
                HR_COMPLIANCE_GRATUITY_DOWNLOAD,
                { asOfDate },
                `gratuity_provision_${asOfDate}.csv`
            );
            toast.success('Gratuity provision downloaded');
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-compliance',
                fallbackMessage: 'Could not download the gratuity provision.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <AsOfControl
                asOfDate={asOfDate}
                onAsOfDateChange={onAsOfDateChange}
                onDownload={handleDownload}
            />
            {query.isLoading ? (
                <HrLoadingRows rows={5} />
            ) : query.isError ? (
                <HrErrorState
                    message="Could not compute the gratuity provision."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    title="No employees to provision for"
                    description="Nobody on the roster has service recorded as of this date."
                />
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ComplianceStat label="Employees" value={data?.employee_count ?? rows.length} />
                        <ComplianceStat
                            label="Total liability"
                            value={data?.total_accrued_liability}
                            currency={data?.currency}
                            isMoney
                        />
                        <ComplianceStat
                            label="Vested"
                            value={data?.vested_accrued_liability}
                            currency={data?.currency}
                            isMoney
                        />
                        <ComplianceStat
                            label="Monthly run-rate"
                            value={data?.total_monthly_run_rate}
                            currency={data?.currency}
                            isMoney
                        />
                    </div>
                    <Card className="overflow-x-auto p-0">
                        <table className="w-full text-body">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase text-neutral-500">
                                    <th className="px-4 py-2 text-start font-medium">Employee</th>
                                    <th className="px-4 py-2 text-end font-medium">Years</th>
                                    <th className="px-4 py-2 text-end font-medium">Monthly basic</th>
                                    <th className="px-4 py-2 text-end font-medium">Liability</th>
                                    <th className="px-4 py-2 text-end font-medium">Run-rate</th>
                                    <th className="px-4 py-2 text-end font-medium">Vested</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r.employee_id}
                                        className="border-b border-neutral-100 last:border-0"
                                    >
                                        <td className="px-4 py-2.5 text-neutral-700">
                                            {r.employee_name || r.employee_code || '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-neutral-600">
                                            {r.rounded_years ?? '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.monthly_basic ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.accrued_liability ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.monthly_run_rate ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-end">
                                            <StatusChip
                                                text={r.vested ? 'Vested' : 'Not yet'}
                                                status={r.vested ? 'SUCCESS' : 'INFO'}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}
        </div>
    );
};

const EosbTab = ({
    asOfDate,
    onAsOfDateChange,
}: {
    asOfDate: string;
    onAsOfDateChange: (v: string) => void;
}) => {
    const query = useQuery({
        queryKey: hrKeys.eosb(asOfDate),
        queryFn: () => fetchEosbProvision(asOfDate),
        enabled: !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.rows ?? [];

    const handleDownload = async () => {
        try {
            await downloadComplianceFile(
                HR_COMPLIANCE_EOSB_DOWNLOAD,
                { asOfDate },
                `eosb_provision_${asOfDate}.csv`
            );
            toast.success('EOSB provision downloaded');
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-compliance',
                fallbackMessage: 'Could not download the EOSB provision.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <AsOfControl
                asOfDate={asOfDate}
                onAsOfDateChange={onAsOfDateChange}
                onDownload={handleDownload}
            />
            <p className="text-caption text-neutral-500">
                Statutory liability is what an employee could claim today; the accounting accrual is
                what the books should already carry. They differ before an employee qualifies.
            </p>
            {query.isLoading ? (
                <HrLoadingRows rows={5} />
            ) : query.isError ? (
                <HrErrorState
                    message="Could not compute the EOSB provision."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    title="No employees to provision for"
                    description="Nobody on the roster has service recorded as of this date."
                />
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ComplianceStat label="Employees" value={data?.employee_count ?? rows.length} />
                        <ComplianceStat
                            label="Statutory liability"
                            value={data?.total_statutory_liability}
                            currency={data?.currency}
                            isMoney
                        />
                        <ComplianceStat
                            label="Accounting accrual"
                            value={data?.total_accounting_accrual}
                            currency={data?.currency}
                            isMoney
                        />
                        <ComplianceStat
                            label="Monthly run-rate"
                            value={data?.total_monthly_run_rate}
                            currency={data?.currency}
                            isMoney
                        />
                    </div>
                    <Card className="overflow-x-auto p-0">
                        <table className="w-full text-body">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase text-neutral-500">
                                    <th className="px-4 py-2 text-start font-medium">Employee</th>
                                    <th className="px-4 py-2 text-end font-medium">Years</th>
                                    <th className="px-4 py-2 text-end font-medium">Monthly basic</th>
                                    <th className="px-4 py-2 text-end font-medium">Statutory</th>
                                    <th className="px-4 py-2 text-end font-medium">Accrual</th>
                                    <th className="px-4 py-2 text-end font-medium">Eligible</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r.employee_id}
                                        className="border-b border-neutral-100 last:border-0"
                                    >
                                        <td className="px-4 py-2.5 text-neutral-700">
                                            {r.employee_name || r.employee_code || '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-neutral-600">
                                            {r.service_years ?? '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.monthly_basic ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.statutory_liability ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.accounting_accrual ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-end">
                                            <StatusChip
                                                text={r.statutory_eligible ? 'Eligible' : 'Not yet'}
                                                status={r.statutory_eligible ? 'SUCCESS' : 'INFO'}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}
        </div>
    );
};

const BonusTab = () => {
    const [financialYear, setFinancialYear] = useState(() => financialYearOf());
    const [bonusPct, setBonusPct] = useState('8.33');
    const [payoutPeriod, setPayoutPeriod] = useState<MonthValue>(() => currentMonthValue());

    const pct = Number(bonusPct);
    const pctValid = Number.isFinite(pct) && pct >= 8.33 && pct <= 20;

    const query = useQuery({
        queryKey: hrKeys.bonus(financialYear, pct),
        queryFn: () => fetchBonusComputation(financialYear, pct),
        enabled: !!getInstituteId() && pctValid,
        staleTime: 5 * 60 * 1000,
    });
    const data = query.data;
    const rows = data?.rows ?? [];
    const eligibleRows = rows.filter((r) => r.eligible !== false);

    const handleMaterialize = async () => {
        try {
            const result = await materializeBonus({
                financialYear,
                bonusPct: pct,
                month: payoutPeriod.month,
                year: payoutPeriod.year,
            });
            toast.success(
                `${result.created_count ?? 0} bonus adjustments created for ${formatMonthValue(payoutPeriod)}` +
                    (result.skipped_existing_count
                        ? ` · ${result.skipped_existing_count} already existed`
                        : '')
            );
            void query.refetch();
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-compliance',
                fallbackMessage: 'Could not create the bonus adjustments.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                    <span className="text-caption text-neutral-600">Financial year</span>
                    <MyDropdown
                        currentValue={financialYear}
                        dropdownList={recentFinancialYears()}
                        handleChange={(v) => setFinancialYear(String(v))}
                    />
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                    <span className="text-caption text-neutral-600">Rate (%)</span>
                    <MyInput
                        inputType="number"
                        input={bonusPct}
                        onChangeFunction={(e) => setBonusPct(e.target.value)}
                        inputPlaceholder="8.33"
                        className="w-full"
                    />
                </div>
                <span className="pb-2 text-caption text-neutral-500">
                    The Act allows 8.33% to 20%.
                </span>
            </div>

            {!pctValid ? (
                <HrEmptyState
                    title="Enter a rate between 8.33 and 20"
                    description="The Payment of Bonus Act sets those as the minimum and maximum."
                />
            ) : query.isLoading ? (
                <HrLoadingRows rows={5} />
            ) : query.isError ? (
                <HrErrorState
                    message="Could not compute the bonus."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    title="Nobody to compute"
                    description="No employees were on the roster during this financial year."
                />
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ComplianceStat label="Eligible employees" value={data?.eligible_count ?? eligibleRows.length} />
                        <ComplianceStat
                            label="Total bonus"
                            value={data?.total_bonus}
                            currency={data?.currency}
                            isMoney
                        />
                        <ComplianceStat label="Applied rate" value={`${data?.bonus_pct ?? pct}%`} />
                    </div>

                    <Card className="flex flex-wrap items-end justify-between gap-3 p-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-subtitle font-medium text-neutral-700">
                                Pay this bonus
                            </span>
                            <span className="text-caption text-neutral-500">
                                Creates one BONUS-scoped adjustment per eligible employee. A bonus
                                payroll run for that month pays and taxes them.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MonthPicker
                                value={payoutPeriod}
                                onChange={setPayoutPeriod}
                                label="Payout"
                            />
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onAsyncClick={handleMaterialize}
                                loadingText="Creating…"
                                disabled={eligibleRows.length === 0}
                            >
                                <Sparkle size={16} />
                                Materialize
                            </MyButton>
                        </div>
                    </Card>

                    <Card className="overflow-x-auto p-0">
                        <table className="w-full text-body">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase text-neutral-500">
                                    <th className="px-4 py-2 text-start font-medium">Employee</th>
                                    <th className="px-4 py-2 text-end font-medium">Monthly basic</th>
                                    <th className="px-4 py-2 text-end font-medium">Months</th>
                                    <th className="px-4 py-2 text-end font-medium">Wage base</th>
                                    <th className="px-4 py-2 text-end font-medium">Bonus</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r.employee_id}
                                        className={`border-b border-neutral-100 last:border-0 ${
                                            r.eligible === false ? 'opacity-60' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-2.5 text-neutral-700">
                                            {r.employee_name || r.employee_code || '—'}
                                            {r.eligible === false && r.ineligible_reason && (
                                                <span className="ms-2 text-caption text-neutral-500">
                                                    {r.ineligible_reason}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.monthly_basic ?? null}
                                                currency={r.currency}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-neutral-600">
                                            {r.eligible_months ?? '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.bonus_wage_base ?? null}
                                                currency={r.currency}
                                                dashOnZero
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <MoneyCell
                                                value={r.computed_bonus ?? null}
                                                currency={r.currency}
                                                dashOnZero
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}
        </div>
    );
};
