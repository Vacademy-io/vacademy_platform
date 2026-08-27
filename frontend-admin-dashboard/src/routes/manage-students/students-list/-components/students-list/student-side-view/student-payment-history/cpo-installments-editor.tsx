import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    useApplyCpoDiscount,
    useModifyInstallment,
    useRecordOfflinePayment,
    useUserCpoUserPlans,
    useUserPlanInstallments,
} from '@/routes/manage-students/students-list/-services/cpoSideViewService';
import type {
    CpoInstallmentRow,
    CpoSideViewInstallmentsResponse,
    CpoUserPlanSummary,
    DiscountType,
    ModifyInstallmentRequest,
    RecordOfflinePaymentRequest,
} from '@/routes/manage-students/students-list/-types/cpo-side-view-types';

const fmt = (n: number | null | undefined) =>
    Number.isFinite(n as number) ? `₹${(n as number).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

const isoDate = (s: string | null | undefined) => {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
};

const statusPill = (status: string, t: TFunction) => {
    const tone =
        status === 'PAID'
            ? 'bg-green-100 text-green-700'
            : status === 'PARTIAL_PAID'
              ? 'bg-blue-100 text-blue-700'
              : status === 'OVERDUE'
                ? 'bg-red-100 text-red-700'
                : status === 'WAIVED'
                  ? 'bg-neutral-100 text-neutral-500'
                  : 'bg-orange-100 text-orange-700';
    const statusLabels: Record<string, string> = {
        PAID: t('status.paid'),
        PARTIAL_PAID: t('status.partialPaid'),
        OVERDUE: t('status.overdue'),
        WAIVED: t('status.waived'),
    };
    const label = statusLabels[status] ?? status;
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${tone}`}>
            {label}
        </span>
    );
};

// -------------------------------------------------------------- Row editor

interface RowProps {
    row: CpoInstallmentRow;
    index: number;
    userPlanId: string;
    userId: string;
}

const InstallmentRowEditor = ({ row, index, userPlanId, userId }: RowProps) => {
    const { t } = useTranslation('manageStudentsCpoInstallmentsEditor');
    const { mutateAsync: modify, isPending } = useModifyInstallment(userPlanId, userId);

    const [startDate, setStartDate] = useState<string>(isoDate(row.start_date));
    const [dueDate, setDueDate] = useState<string>(isoDate(row.due_date));
    const [amount, setAmount] = useState<string>(
        row.manual_amount_override?.new_amount != null
            ? String(row.manual_amount_override.new_amount)
            : '',
    );
    const [discType, setDiscType] = useState<DiscountType | ''>(
        row.installment_discount?.type ?? '',
    );
    const [discValue, setDiscValue] = useState<string>(
        row.installment_discount?.value != null ? String(row.installment_discount.value) : '',
    );
    const [discReason, setDiscReason] = useState<string>(row.installment_discount?.reason ?? '');

    // Reset locals when the row data refreshes
    useEffect(() => {
        setStartDate(isoDate(row.start_date));
        setDueDate(isoDate(row.due_date));
        setAmount(
            row.manual_amount_override?.new_amount != null
                ? String(row.manual_amount_override.new_amount)
                : '',
        );
        setDiscType(row.installment_discount?.type ?? '');
        setDiscValue(row.installment_discount?.value != null ? String(row.installment_discount.value) : '');
        setDiscReason(row.installment_discount?.reason ?? '');
    }, [row]);

    const dirty = useMemo(() => {
        const sameStart = startDate === isoDate(row.start_date);
        const sameDue = dueDate === isoDate(row.due_date);
        const currentAmt =
            row.manual_amount_override?.new_amount != null
                ? String(row.manual_amount_override.new_amount)
                : '';
        const sameAmount = amount === currentAmt;
        const currentDiscType = row.installment_discount?.type ?? '';
        const currentDiscValue =
            row.installment_discount?.value != null ? String(row.installment_discount.value) : '';
        const currentDiscReason = row.installment_discount?.reason ?? '';
        const sameDisc =
            discType === currentDiscType &&
            discValue === currentDiscValue &&
            discReason === currentDiscReason;
        return !(sameStart && sameDue && sameAmount && sameDisc);
    }, [row, startDate, dueDate, amount, discType, discValue, discReason]);

    const save = async () => {
        const body: ModifyInstallmentRequest = {
            start_date: startDate || null,
            due_date: dueDate || null,
            amount: amount === '' ? null : Number(amount),
            clear_amount_override: amount === '' && row.manual_amount_override != null,
            discount: discType
                ? {
                      type: discType,
                      value: discValue === '' ? 0 : Number(discValue),
                      reason: discReason || null,
                  }
                : null,
            clear_discount: discType === '' && row.installment_discount != null,
        };
        try {
            await modify({ sfpId: row.id, body });
            toast.success(t('row.updateSuccessToast'));
        } catch (e: any) {
            toast.error(e?.response?.data?.message || t('row.updateErrorToast'));
        }
    };

    return (
        <tr>
            <td className="px-2 py-1 align-middle">{index + 1}</td>
            <td className="px-2 py-1 align-middle">
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-32 rounded border border-neutral-200 px-1 py-0.5 text-2xs outline-none focus:border-primary-300"
                />
            </td>
            <td className="px-2 py-1 align-middle">
                <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-32 rounded border border-neutral-200 px-1 py-0.5 text-2xs outline-none focus:border-primary-300"
                />
            </td>
            <td className="px-2 py-1 text-right align-middle text-neutral-500">{fmt(row.original_amount)}</td>
            <td className="px-2 py-1 text-right align-middle">
                <input
                    type="number"
                    step="any"
                    placeholder={String(row.amount_expected)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-24 rounded border border-neutral-200 px-1 py-0.5 text-end text-2xs outline-none focus:border-primary-300"
                />
            </td>
            <td className="px-2 py-1 align-middle">
                <div className="flex items-center gap-1">
                    <select
                        value={discType}
                        onChange={(e) => setDiscType(e.target.value as DiscountType | '')}
                        className="rounded border border-neutral-200 px-1 py-0.5 text-2xs"
                    >
                        <option value="">{t('row.discountOptionNone')}</option>
                        <option value="PERCENTAGE">{t('row.discountOptionPercentage')}</option>
                        <option value="FLAT">{t('row.discountOptionFlat')}</option>
                    </select>
                    <input
                        type="number"
                        step="any"
                        disabled={!discType}
                        value={discValue}
                        onChange={(e) => setDiscValue(e.target.value)}
                        placeholder="0"
                        className="w-16 rounded border border-neutral-200 px-1 py-0.5 text-end text-2xs disabled:bg-neutral-50"
                    />
                </div>
                {discType && (
                    <input
                        type="text"
                        value={discReason}
                        onChange={(e) => setDiscReason(e.target.value)}
                        placeholder={t('row.reasonPlaceholder')}
                        className="mt-1 w-full rounded border border-neutral-200 px-1 py-0.5 text-2xs"
                    />
                )}
            </td>
            <td className="px-2 py-1 text-right align-middle text-neutral-500">{fmt(row.amount_paid)}</td>
            <td className="px-2 py-1 align-middle">{statusPill(row.status, t)}</td>
            <td className="px-2 py-1 align-middle">
                <button
                    type="button"
                    disabled={!dirty || isPending}
                    onClick={save}
                    className={`rounded px-2 py-0.5 text-2xs font-medium ${
                        dirty
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                    }`}
                >
                    {isPending ? '…' : t('row.save')}
                </button>
            </td>
        </tr>
    );
};

// ----------------------------------------------------------- CPO discount

interface DiscountEditorProps {
    userPlanId: string;
    userId: string;
    current: CpoSideViewInstallmentsResponse['cpo_discount'];
}

const CpoDiscountEditor = ({ userPlanId, userId, current }: DiscountEditorProps) => {
    const { t } = useTranslation('manageStudentsCpoInstallmentsEditor');
    const { mutateAsync, isPending } = useApplyCpoDiscount(userPlanId, userId);
    const [type, setType] = useState<DiscountType | ''>(current?.type ?? '');
    const [value, setValue] = useState<string>(current?.value != null ? String(current.value) : '');
    const [reason, setReason] = useState<string>(current?.reason ?? '');

    useEffect(() => {
        setType(current?.type ?? '');
        setValue(current?.value != null ? String(current.value) : '');
        setReason(current?.reason ?? '');
    }, [current]);

    const apply = async () => {
        try {
            if (!type) {
                await mutateAsync({ remove: true });
                toast.success(t('cpoDiscount.removeSuccessToast'));
            } else {
                await mutateAsync({
                    discount: {
                        type,
                        value: value === '' ? 0 : Number(value),
                        reason: reason || null,
                    },
                });
                toast.success(t('cpoDiscount.applySuccessToast'));
            }
        } catch (e: any) {
            toast.error(e?.response?.data?.message || t('cpoDiscount.applyErrorToast'));
        }
    };

    return (
        <div className="rounded border border-neutral-200 bg-white p-2.5">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-neutral-500">
                {t('cpoDiscount.heading')}
            </p>
            <div className="flex flex-wrap items-end gap-2">
                <div>
                    <label className="block text-2xs text-neutral-500">{t('cpoDiscount.typeLabel')}</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as DiscountType | '')}
                        className="rounded border border-neutral-200 px-2 py-1 text-2xs"
                    >
                        <option value="">{t('cpoDiscount.discountOptionNone')}</option>
                        <option value="PERCENTAGE">{t('cpoDiscount.discountOptionPercentage')}</option>
                        <option value="FLAT">{t('cpoDiscount.discountOptionFlat')}</option>
                    </select>
                </div>
                <div>
                    <label className="block text-2xs text-neutral-500">{t('cpoDiscount.valueLabel')}</label>
                    <input
                        type="number"
                        step="any"
                        min={0}
                        disabled={!type}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-24 rounded border border-neutral-200 px-2 py-1 text-2xs disabled:bg-neutral-50"
                    />
                </div>
                <div className="flex-1 min-w-36">
                    <label className="block text-2xs text-neutral-500">{t('cpoDiscount.reasonLabel')}</label>
                    <input
                        type="text"
                        disabled={!type}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('cpoDiscount.reasonPlaceholder')}
                        className="w-full rounded border border-neutral-200 px-2 py-1 text-2xs disabled:bg-neutral-50"
                    />
                </div>
                <button
                    type="button"
                    disabled={isPending}
                    onClick={apply}
                    className="rounded bg-primary-500 px-3 py-1 text-2xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                >
                    {isPending ? t('cpoDiscount.applying') : type ? t('cpoDiscount.apply') : t('cpoDiscount.remove')}
                </button>
            </div>
        </div>
    );
};

// ----------------------------------------------------------- Offline payment

interface OfflineProps {
    userPlanId: string;
    userId: string;
    outstanding: number;
}

const OfflinePaymentForm = ({ userPlanId, userId, outstanding }: OfflineProps) => {
    const { t } = useTranslation('manageStudentsCpoInstallmentsEditor');
    const { mutateAsync, isPending } = useRecordOfflinePayment(userPlanId, userId);
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [generateInvoice, setGenerateInvoice] = useState<boolean>(true);

    const submit = async () => {
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error(t('offlinePayment.amountRequiredError'));
            return;
        }
        const body: RecordOfflinePaymentRequest = {
            amount: amt,
            payment_date: paymentDate,
            reference: reference || null,
            generate_invoice: generateInvoice,
        };
        try {
            await mutateAsync(body);
            toast.success(t('offlinePayment.recordedSuccessToast', { amount: fmt(amt) }));
            setOpen(false);
            setAmount('');
            setReference('');
        } catch (e: any) {
            toast.error(e?.response?.data?.message || t('offlinePayment.recordErrorToast'));
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => {
                    setAmount(outstanding > 0 ? String(outstanding) : '');
                    setOpen(true);
                }}
                className="rounded border border-primary-300 bg-primary-50 px-3 py-1 text-2xs font-medium text-primary-700 hover:bg-primary-100"
            >
                {t('offlinePayment.addPaymentButton')}
            </button>
        );
    }

    return (
        <div className="rounded border border-primary-200 bg-primary-50/40 p-2.5">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-primary-700">
                {t('offlinePayment.heading')}
            </p>
            {/* items-start so labels align at the top of each column regardless
                of per-column footer hints (which would shove the others around
                under items-end). */}
            <div className="flex flex-wrap items-start gap-2">
                <div>
                    <label className="block text-2xs text-neutral-500">{t('offlinePayment.amountLabel')}</label>
                    <input
                        type="number"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        // Select the seeded outstanding value on focus so admin
                        // types over it instead of appending to it.
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-32 rounded border border-neutral-200 px-2 py-1 text-2xs"
                    />
                </div>
                <div>
                    <label className="block text-2xs text-neutral-500">{t('offlinePayment.dateLabel')}</label>
                    <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="rounded border border-neutral-200 px-2 py-1 text-2xs"
                    />
                </div>
                <div className="flex-1 min-w-36">
                    <label className="block text-2xs text-neutral-500">{t('offlinePayment.referenceLabel')}</label>
                    <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={t('offlinePayment.referencePlaceholder')}
                        className="w-full rounded border border-neutral-200 px-2 py-1 text-2xs"
                    />
                </div>
                <label className="flex items-center gap-1 text-2xs text-neutral-700">
                    <input
                        type="checkbox"
                        checked={generateInvoice}
                        onChange={(e) => setGenerateInvoice(e.target.checked)}
                        className="h-3.5 w-3.5"
                    />
                    {t('offlinePayment.generateInvoiceLabel')}
                </label>
                <button
                    type="button"
                    disabled={isPending}
                    onClick={submit}
                    className="rounded bg-primary-500 px-3 py-1 text-2xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                >
                    {isPending ? t('offlinePayment.saving') : t('offlinePayment.saveAndAllocate')}
                </button>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded border border-neutral-200 px-3 py-1 text-2xs text-neutral-600 hover:bg-neutral-50"
                >
                    {t('offlinePayment.cancel')}
                </button>
            </div>
        </div>
    );
};

// ----------------------------------------------------------- UserPlan card

interface CardProps {
    summary: CpoUserPlanSummary;
    userId: string;
}

const CpoUserPlanCard = ({ summary, userId }: CardProps) => {
    const { t } = useTranslation('manageStudentsCpoInstallmentsEditor');
    const [expanded, setExpanded] = useState(false);
    const { data, isLoading, isError } = useUserPlanInstallments(expanded ? summary.user_plan_id : null);

    return (
        <div className="rounded-xl border border-neutral-200 bg-white">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded((x) => !x)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
            >
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-800">
                        {summary.cpo_name || summary.payment_option_name || summary.cpo_id}
                    </p>
                    <p className="mt-0.5 text-2xs text-neutral-500">
                        {t('card.installmentCount', { count: summary.installment_count })}
                        {' · '}
                        {t('card.net', { amount: fmt(summary.net_total) })}
                        {' · '}
                        {t('card.paid', { amount: fmt(summary.paid_total) })}
                        {' · '}
                        <span
                            className={
                                summary.outstanding_total > 0
                                    ? 'font-medium text-orange-700'
                                    : summary.outstanding_total < 0
                                      ? 'font-medium text-blue-700'
                                      : 'text-neutral-500'
                            }
                        >
                            {t('card.outstanding', { amount: fmt(summary.outstanding_total) })}
                        </span>
                    </p>
                </div>
                <span className="ml-2 text-xs text-neutral-400">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                    {isLoading && (
                        <p className="py-2 text-center text-2xs text-neutral-500">
                            {t('card.loadingInstallments')}
                        </p>
                    )}
                    {isError && (
                        <p className="py-2 text-center text-2xs text-red-600">
                            {t('card.loadInstallmentsError')}
                        </p>
                    )}
                    {data && (
                        <>
                            <div className="overflow-x-auto rounded border border-neutral-200">
                                <table className="w-full text-start text-2xs">
                                    <thead className="bg-neutral-50 text-2xs uppercase text-neutral-500">
                                        <tr>
                                            <th className="px-2 py-1 font-medium">{t('card.tableHeaders.index')}</th>
                                            <th className="px-2 py-1 font-medium">{t('card.tableHeaders.startDate')}</th>
                                            <th className="px-2 py-1 font-medium">{t('card.tableHeaders.dueDate')}</th>
                                            <th className="px-2 py-1 text-end font-medium">{t('card.tableHeaders.default')}</th>
                                            <th className="px-2 py-1 text-end font-medium">{t('card.tableHeaders.amount')}</th>
                                            <th className="px-2 py-1 font-medium">{t('card.tableHeaders.discount')}</th>
                                            <th className="px-2 py-1 text-end font-medium">{t('card.tableHeaders.paid')}</th>
                                            <th className="px-2 py-1 font-medium">{t('card.tableHeaders.status')}</th>
                                            <th className="px-2 py-1 font-medium">&nbsp;</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {data.installments.map((row, idx) => (
                                            <InstallmentRowEditor
                                                key={row.id}
                                                row={row}
                                                index={idx}
                                                userPlanId={data.user_plan_id}
                                                userId={userId}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <CpoDiscountEditor
                                userPlanId={data.user_plan_id}
                                userId={userId}
                                current={data.cpo_discount}
                            />

                            <OfflinePaymentForm
                                userPlanId={data.user_plan_id}
                                userId={userId}
                                outstanding={data.outstanding_total}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------- Top-level

interface CpoInstallmentsEditorProps {
    userId: string;
}

/**
 * Side-view "CPO installments" section for a learner. Lists each CPO UserPlan
 * the learner is enrolled in; each card expands into a full installment editor
 * (per-installment dates / amount / discount), CPO-level discount control, and
 * an offline-payment recorder.
 */
export const CpoInstallmentsEditor = ({ userId }: CpoInstallmentsEditorProps) => {
    const { t } = useTranslation('manageStudentsCpoInstallmentsEditor');
    const { data, isLoading, isError } = useUserCpoUserPlans(userId);

    if (isLoading) {
        return <p className="py-2 text-2xs text-neutral-500">{t('loadingPlans')}</p>;
    }
    if (isError) {
        return <p className="py-2 text-2xs text-red-600">{t('loadPlansError')}</p>;
    }
    if (!data || data.length === 0) {
        return null; // not a CPO learner — silently skip the section
    }

    return (
        <div className="space-y-3">
            {data.map((s) => (
                <CpoUserPlanCard key={s.user_plan_id} summary={s} userId={userId} />
            ))}
        </div>
    );
};
