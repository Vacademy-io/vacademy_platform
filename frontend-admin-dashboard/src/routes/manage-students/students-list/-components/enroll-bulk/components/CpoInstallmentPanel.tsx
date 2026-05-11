import { useEffect, useMemo, useState } from 'react';
import { useCPOFullDetails } from '@/routes/financial-management/fee-plans/-services/cpo-service';
import type { CPOFeeType, CPOInstallment } from '@/routes/financial-management/fee-plans/-types/cpo-types';

interface InstallmentRow {
    id: string;
    feeTypeName: string;
    installmentNumber: number;
    amount: number;
    dueDate: string | null;
    status: string;
}

export interface CpoInstallmentValue {
    mode: 'OFFLINE' | 'SKIP';
    /** Amount admin will record as paid now. Only meaningful when mode='OFFLINE'. */
    amount: number | null;
}

interface Props {
    cpoId: string | null;
    value: CpoInstallmentValue | undefined;
    onChange: (value: CpoInstallmentValue) => void;
}

const flattenInstallments = (feeTypes: CPOFeeType[] | undefined): InstallmentRow[] => {
    if (!Array.isArray(feeTypes)) return [];
    const rows: InstallmentRow[] = [];
    for (const ft of feeTypes) {
        const afv = ft.assigned_fee_value;
        if (!afv) continue;
        const installments: CPOInstallment[] = afv.installments ?? [];
        if (installments.length === 0) {
            rows.push({
                id: `${ft.id}:lump`,
                feeTypeName: ft.name,
                installmentNumber: 1,
                amount: Number(afv.amount ?? 0),
                dueDate: null,
                status: afv.status,
            });
            continue;
        }
        for (const inst of installments) {
            rows.push({
                id: inst.id,
                feeTypeName: ft.name,
                installmentNumber: inst.installment_number,
                amount: Number(inst.amount ?? 0),
                dueDate: inst.due_date ?? null,
                status: inst.status,
            });
        }
    }
    return rows;
};

const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
};

const fmtAmount = (n: number) =>
    Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

export const CpoInstallmentPanel = ({ cpoId, value, onChange }: Props) => {
    const { data, isLoading, isError } = useCPOFullDetails(cpoId, !!cpoId);

    const installments = useMemo(() => flattenInstallments(data?.fee_types), [data]);
    const totalAmount = useMemo(
        () => installments.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0),
        [installments]
    );
    const nextDueRow = useMemo(() => {
        const unpaid = installments.filter((r) => r.status !== 'PAID');
        if (unpaid.length === 0) return null;
        const today = new Date();
        const dueByDate = [...unpaid].sort((a, b) => {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            return da - db;
        });
        const upcomingOrToday = dueByDate.find(
            (r) => !r.dueDate || new Date(r.dueDate).getTime() <= today.getTime()
        );
        return upcomingOrToday ?? dueByDate[0];
    }, [installments]);

    const mode: 'OFFLINE' | 'SKIP' = value?.mode ?? 'SKIP';
    const amount = value?.amount ?? null;
    const [amountInput, setAmountInput] = useState<string>('');

    // Initial prefill: when we first know the next-due amount, populate the input only if
    // the parent hasn't set a value yet. After that the input stays a controlled string and
    // syncs back to the parent on each change.
    useEffect(() => {
        if (amount == null && nextDueRow) {
            setAmountInput(String(nextDueRow.amount));
        } else if (amount != null) {
            setAmountInput(String(amount));
        }
    }, [nextDueRow, amount]);

    const setMode = (next: 'OFFLINE' | 'SKIP') => {
        if (next === 'SKIP') {
            onChange({ mode: 'SKIP', amount: null });
            return;
        }
        const parsed = Number(amountInput);
        const seed =
            Number.isFinite(parsed) && parsed > 0
                ? parsed
                : nextDueRow
                  ? nextDueRow.amount
                  : totalAmount;
        onChange({ mode: 'OFFLINE', amount: seed });
        setAmountInput(String(seed));
    };

    const onAmountChange = (raw: string) => {
        setAmountInput(raw);
        if (raw === '') {
            onChange({ mode: 'OFFLINE', amount: null });
            return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            onChange({ mode: 'OFFLINE', amount: null });
            return;
        }
        onChange({ mode: 'OFFLINE', amount: parsed });
    };

    if (!cpoId) return null;

    return (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                    Payment Schedule (CPO)
                </p>
                <span className="text-[11px] text-neutral-600">
                    Total Course Fee:{' '}
                    <span className="font-semibold text-neutral-800">{fmtAmount(totalAmount)}</span>
                </span>
            </div>

            {isLoading && (
                <p className="py-2 text-center text-[11px] text-neutral-500">
                    Loading installments…
                </p>
            )}
            {isError && (
                <p className="py-2 text-center text-[11px] text-red-600">
                    Could not load CPO details. Continue without recording an initial payment.
                </p>
            )}
            {!isLoading && !isError && installments.length === 0 && (
                <p className="py-2 text-center text-[11px] text-neutral-500">
                    No installments configured on this fee plan.
                </p>
            )}

            {installments.length > 0 && (
                <div className="mb-3 max-h-44 overflow-y-auto rounded border border-orange-100 bg-white">
                    <table className="w-full text-left text-[11px]">
                        <thead className="sticky top-0 bg-orange-50 text-[10px] uppercase text-neutral-500">
                            <tr>
                                <th className="px-2 py-1 font-medium">#</th>
                                <th className="px-2 py-1 font-medium">Fee Type</th>
                                <th className="px-2 py-1 font-medium">Due</th>
                                <th className="px-2 py-1 text-right font-medium">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-50">
                            {installments.map((row) => {
                                const isNextDue = nextDueRow?.id === row.id;
                                const isPaid = row.status === 'PAID';
                                return (
                                    <tr
                                        key={row.id}
                                        className={
                                            isPaid
                                                ? 'text-neutral-400 line-through'
                                                : isNextDue
                                                  ? 'bg-orange-50/70 font-medium text-neutral-800'
                                                  : 'text-neutral-700'
                                        }
                                    >
                                        <td className="px-2 py-1">{row.installmentNumber}</td>
                                        <td className="px-2 py-1">{row.feeTypeName}</td>
                                        <td className="px-2 py-1">{formatDate(row.dueDate)}</td>
                                        <td className="px-2 py-1 text-right">
                                            {fmtAmount(row.amount)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Initial payment recording */}
            <div className="rounded-md border border-neutral-200 bg-white p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Record initial payment (optional)
                </p>
                <div className="mb-2 flex flex-col gap-1.5 text-[11px] text-neutral-700">
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="radio"
                            name={`cpo-mode-${cpoId}`}
                            checked={mode === 'SKIP'}
                            onChange={() => setMode('SKIP')}
                            className="h-3.5 w-3.5"
                        />
                        <span>
                            <strong>Skip — enroll only.</strong> Learner will pay each installment
                            online from their dashboard.
                        </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="radio"
                            name={`cpo-mode-${cpoId}`}
                            checked={mode === 'OFFLINE'}
                            onChange={() => setMode('OFFLINE')}
                            className="h-3.5 w-3.5"
                        />
                        <span>
                            <strong>Record offline payment.</strong> Apply admin-collected cash now;
                            allocated FIFO against unpaid installments.
                        </span>
                    </label>
                </div>

                {mode === 'OFFLINE' && (
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[140px]">
                            <label className="mb-1 block text-[10px] font-medium text-neutral-500">
                                Amount to record (₹)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={amountInput}
                                onChange={(e) => onAmountChange(e.target.value)}
                                className="w-full rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-primary-300"
                            />
                            <p className="mt-1 text-[10px] text-neutral-500">
                                Total: {fmtAmount(totalAmount)}
                                {nextDueRow ? (
                                    <>
                                        {' · '}
                                        next installment: {fmtAmount(nextDueRow.amount)}
                                    </>
                                ) : null}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
