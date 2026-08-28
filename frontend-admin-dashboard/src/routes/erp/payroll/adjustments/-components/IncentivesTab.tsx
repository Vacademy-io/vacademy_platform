import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { ArrowRight, Calculator, Sparkle, UserMinus } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MoneyCell } from '@/components/design-system/money-cell';
import {
    MonthPicker,
    currentMonthValue,
    formatMonthValue,
    previousMonthValue,
    type MonthValue,
} from '@/components/design-system/month-picker';
import { MyTable, type TableData } from '@/components/design-system/table';
import { Card } from '@/components/ui/card';
import { useHrRole } from '@/hooks/use-hr-role';
import { reportApiError } from '@/lib/report-api-error';
import type { IncentiveMaterializeResultDTO, IncentiveRowDTO } from '@/routes/erp/-shared/hr-types';
import { HrEmptyState, HrErrorState } from '@/routes/erp/people/-components/HrStates';
import {
    MAX_COMMISSION_PCT,
    hasUsableTerms,
    useIncentivePreview,
    useMaterializeIncentives,
    type IncentiveTerms,
} from '../-hooks/use-crm-incentives';
import { NoProfileNote, VariablePayStat, formatCount } from './variable-pay-shared';

/**
 * Variable Pay → Incentives.
 *
 * Sales incentive on collected revenue, per counsellor. The screen insists on two
 * months rather than one: the EARNING month is where the revenue was collected,
 * and the PAYOUT month is the payroll that actually pays it — you pay August's
 * incentive in September. Collapsing them into one control is how an institute
 * ends up paying the wrong month's number, so both pickers are visible and the
 * sentence between them spells the direction out.
 */

/** A number the user is still typing: blank and half-typed values are not errors yet. */
const parseAmount = (text: string): number | undefined => {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : undefined;
};

export const IncentivesTab = () => {
    const { isHrAdmin } = useHrRole();

    const [earningMonth, setEarningMonth] = useState<MonthValue>(() => previousMonthValue());
    const [payoutMonth, setPayoutMonth] = useState<MonthValue>(() => currentMonthValue());
    const [commissionText, setCommissionText] = useState('5');
    const [fixedText, setFixedText] = useState('');
    const [materializeResult, setMaterializeResult] =
        useState<IncentiveMaterializeResultDTO | null>(null);

    const commissionValue = parseAmount(commissionText);
    const fixedValue = parseAmount(fixedText);

    const commissionError =
        commissionValue !== undefined &&
        (commissionValue < 0 || commissionValue > MAX_COMMISSION_PCT)
            ? `Enter 0–${MAX_COMMISSION_PCT}%`
            : null;
    const fixedError = fixedValue !== undefined && fixedValue < 0 ? 'Cannot be negative' : null;

    const terms: IncentiveTerms = useMemo(
        () => ({
            commissionPct: commissionValue,
            fixedPerConversion: fixedValue,
        }),
        [commissionValue, fixedValue]
    );

    const termsUsable = hasUsableTerms(terms) && !commissionError && !fixedError;

    const previewQuery = useIncentivePreview(earningMonth, terms);
    const materializeMutation = useMaterializeIncentives(earningMonth, payoutMonth);

    const preview = previewQuery.data;
    const allRows = useMemo(() => preview?.rows ?? [], [preview]);
    const linkedRows = useMemo(
        () => allRows.filter((row) => row.no_employee_profile !== true),
        [allRows]
    );
    const unlinkedRows = useMemo(
        () => allRows.filter((row) => row.no_employee_profile === true),
        [allRows]
    );

    /**
     * Clamp on blur, not on keystroke: clamping as the user types turns "55" into
     * "5" mid-word and makes the field feel broken. The value is still validated
     * while typing, and the server clamps again regardless of what is sent.
     */
    const clampCommission = () => {
        const value = parseAmount(commissionText);
        if (value === undefined) return;
        const clamped = Math.min(Math.max(value, 0), MAX_COMMISSION_PCT);
        if (clamped !== value) setCommissionText(String(clamped));
    };

    const runPreview = async () => {
        setMaterializeResult(null);
        const result = await previewQuery.refetch();
        if (result.error) {
            reportApiError(result.error, {
                feature: 'erp-incentives',
                tags: { action: 'preview' },
                fallbackMessage: 'Could not compute incentives for this month.',
            });
            return;
        }
        toast.success(
            `${formatCount(result.data?.counsellor_count)} counsellor(s) in ${formatMonthValue(earningMonth)}`
        );
    };

    const handleMaterialize = async () => {
        try {
            const result = await materializeMutation.mutateAsync(terms);
            setMaterializeResult(result);
            toast.success(
                `${result.created_count ?? 0} incentive adjustment(s) created on ${formatMonthValue(payoutMonth)} payroll` +
                    (result.skipped_count ? ` · ${result.skipped_count} skipped` : '')
            );
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-incentives',
                tags: { action: 'materialize' },
                fallbackMessage: 'Could not create the incentive adjustments.',
            });
        }
    };

    const columns = useMemo<ColumnDef<IncentiveRowDTO>[]>(
        () => [
            {
                id: 'counsellor',
                header: 'Counsellor',
                cell: ({ row }) => (
                    <span className="text-body text-neutral-700">
                        {row.original.counsellor_name || row.original.counsellor_user_id || '—'}
                    </span>
                ),
            },
            {
                id: 'revenue',
                header: 'Revenue collected',
                cell: ({ row }) => <MoneyCell value={row.original.revenue ?? null} dashOnZero />,
            },
            {
                id: 'paying_leads',
                header: 'Paying leads',
                cell: ({ row }) => (
                    <span className="block text-end tabular-nums text-neutral-600">
                        {formatCount(row.original.paying_leads)}
                    </span>
                ),
            },
            {
                id: 'payments',
                header: 'Payments',
                cell: ({ row }) => (
                    <span className="block text-end tabular-nums text-neutral-600">
                        {formatCount(row.original.payments)}
                    </span>
                ),
            },
            {
                id: 'commission_component',
                header: 'Commission',
                cell: ({ row }) => (
                    <MoneyCell value={row.original.commission_component ?? null} dashOnZero />
                ),
            },
            {
                id: 'fixed_component',
                header: 'Per conversion',
                cell: ({ row }) => (
                    <MoneyCell value={row.original.fixed_component ?? null} dashOnZero />
                ),
            },
            {
                id: 'incentive',
                header: 'Incentive',
                cell: ({ row }) => (
                    <MoneyCell value={row.original.incentive ?? null} tone="earning" dashOnZero />
                ),
            },
        ],
        []
    );

    const tableData: TableData<IncentiveRowDTO> = {
        content: linkedRows,
        total_pages: 1,
        page_no: 0,
        page_size: linkedRows.length,
        total_elements: linkedRows.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-body text-neutral-600">
                Sales incentive per counsellor, computed from revenue actually collected in a month
                — paid leads of converted enquiries, not pipeline. Set a commission percentage, a
                flat amount per conversion, or both; materializing writes a CRM_INCENTIVE adjustment
                that the payout month&apos;s regular payroll run pays.
            </p>

            <Card className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-caption text-neutral-600">
                            Earning month (revenue collected)
                        </span>
                        <MonthPicker
                            value={earningMonth}
                            onChange={setEarningMonth}
                            disableFuture
                        />
                    </div>
                    <div className="flex w-40 flex-col gap-1.5">
                        <span className="text-caption text-neutral-600">Commission (%)</span>
                        <MyInput
                            inputType="number"
                            input={commissionText}
                            onChangeFunction={(e) => setCommissionText(e.target.value)}
                            onBlur={clampCommission}
                            inputPlaceholder="5"
                            error={commissionError}
                            className="w-full"
                        />
                    </div>
                    <div className="flex w-48 flex-col gap-1.5">
                        <span className="text-caption text-neutral-600">
                            Fixed per conversion (optional)
                        </span>
                        <MyInput
                            inputType="number"
                            input={fixedText}
                            onChangeFunction={(e) => setFixedText(e.target.value)}
                            inputPlaceholder="0"
                            error={fixedError}
                            className="w-full"
                        />
                    </div>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        className="mt-6"
                        onAsyncClick={runPreview}
                        loadingText="Computing…"
                        disabled={!termsUsable}
                    >
                        <Calculator size={16} />
                        {preview ? 'Recompute preview' : 'Preview incentives'}
                    </MyButton>
                </div>
                <p className="text-caption text-neutral-500">
                    Commission runs 0–{MAX_COMMISSION_PCT}% of collected revenue; the fixed amount
                    is paid once per paying lead. At least one of the two must be set, or every
                    counsellor computes to nothing.
                </p>
            </Card>

            {!termsUsable ? (
                <HrEmptyState
                    title="Set a commission or a per-conversion amount"
                    description="Incentives are revenue × commission, plus a flat amount per conversion. With neither set there is nothing to compute."
                />
            ) : previewQuery.isError ? (
                <HrErrorState
                    message="Could not compute incentives for this month."
                    onRetry={() => void previewQuery.refetch()}
                />
            ) : !preview ? (
                <HrEmptyState
                    title="Nothing computed yet"
                    description={`Preview reads every payment collected in ${formatMonthValue(earningMonth)} and attributes it to the counsellor who converted the lead. It is a heavy query, so it runs only when you ask for it.`}
                />
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <VariablePayStat
                            label="Counsellors"
                            value={preview.counsellor_count ?? allRows.length}
                        />
                        <VariablePayStat
                            label="Revenue collected"
                            value={preview.total_revenue}
                            isMoney
                        />
                        <VariablePayStat
                            label="Paying leads"
                            value={preview.total_paying_leads ?? 0}
                        />
                        <VariablePayStat
                            label="Total incentive"
                            value={preview.total_incentive}
                            isMoney
                        />
                    </div>

                    {linkedRows.length === 0 ? (
                        <HrEmptyState
                            title="No counsellor can be paid for this month"
                            description={`Nothing was collected in ${formatMonthValue(earningMonth)}, or every counsellor who collected is missing an employee record.`}
                        />
                    ) : (
                        <MyTable<IncentiveRowDTO>
                            data={tableData}
                            columns={columns}
                            isLoading={previewQuery.isFetching}
                            error={null}
                            currentPage={0}
                            scrollable
                        />
                    )}

                    {unlinkedRows.length > 0 && (
                        <Card className="flex flex-col gap-3 border-warning-200 bg-warning-50 p-4">
                            <div className="flex items-center gap-2 text-warning-700">
                                <UserMinus size={18} />
                                <span className="text-subtitle font-medium">
                                    {unlinkedRows.length} counsellor(s) will be skipped
                                </span>
                            </div>
                            <p className="text-body text-neutral-600">
                                These people collected revenue but are not linked to an employee
                                record — there is nobody to raise a payroll adjustment against, so
                                materializing leaves them out. Their incentive is included in the
                                total above so the number is honest.
                            </p>
                            <ul className="flex flex-col gap-2">
                                {unlinkedRows.map((row) => (
                                    <li
                                        key={row.counsellor_user_id ?? row.counsellor_name}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-3 py-2"
                                    >
                                        <span className="flex flex-col">
                                            <span className="text-body text-neutral-700">
                                                {row.counsellor_name ||
                                                    row.counsellor_user_id ||
                                                    '—'}
                                            </span>
                                            <NoProfileNote />
                                        </span>
                                        <MoneyCell value={row.incentive ?? null} dashOnZero />
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}

                    {isHrAdmin && (
                        <Card className="flex flex-col gap-3 p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-subtitle font-medium text-neutral-700">
                                    Pay this incentive
                                </span>
                                <span className="max-w-2xl text-caption text-neutral-500">
                                    One CRM_INCENTIVE adjustment per linked counsellor, on the
                                    payout month&apos;s regular payroll run. Running it twice for
                                    the same payout period is safe — the second run creates nothing.
                                </span>
                            </div>

                            <div className="flex flex-wrap items-end gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-caption text-neutral-600">Earned in</span>
                                    <span className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-body font-medium text-neutral-700">
                                        {formatMonthValue(earningMonth)}
                                    </span>
                                </div>
                                <ArrowRight
                                    size={18}
                                    className="mb-3 text-neutral-400 rtl:rotate-180"
                                />
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-caption text-neutral-600">
                                        Paid on payroll for
                                    </span>
                                    <MonthPicker value={payoutMonth} onChange={setPayoutMonth} />
                                </div>
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    onAsyncClick={handleMaterialize}
                                    loadingText="Creating…"
                                    disabled={linkedRows.length === 0}
                                >
                                    <Sparkle size={16} />
                                    Materialize
                                </MyButton>
                            </div>

                            <p className="text-caption text-neutral-500">
                                {formatMonthValue(earningMonth)} incentive will be paid in the{' '}
                                {formatMonthValue(payoutMonth)} payroll run.
                                {earningMonth.month === payoutMonth.month &&
                                earningMonth.year === payoutMonth.year
                                    ? ' Both months are the same — check that is what you meant.'
                                    : ''}
                            </p>

                            {materializeResult && (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <VariablePayStat
                                        label="Adjustments created"
                                        value={materializeResult.created_count ?? 0}
                                    />
                                    <VariablePayStat
                                        label="Skipped"
                                        value={materializeResult.skipped_count ?? 0}
                                    />
                                    <VariablePayStat
                                        label="Total paid out"
                                        value={materializeResult.total_amount}
                                        isMoney
                                    />
                                </div>
                            )}
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};
