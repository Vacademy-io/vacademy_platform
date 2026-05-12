import { useEffect, useMemo, useState } from 'react';
import { useCPOFullDetails } from '@/routes/financial-management/fee-plans/-services/cpo-service';
import type { CPOFeeType, CPOInstallment } from '@/routes/financial-management/fee-plans/-types/cpo-types';
import type {
    CpoEnrollmentConfig,
    InstallmentOverride,
} from '@/routes/manage-students/students-list/-types/bulk-assign-types';
import type { DiscountSpec, DiscountType } from '@/routes/manage-students/students-list/-types/cpo-side-view-types';

interface InstallmentRow {
    id: string;            // aft_installment id (matches SFP.iId)
    feeTypeName: string;
    installmentNumber: number;
    amount: number;
    dueDate: string | null;
    startDate: string | null;
}

interface Props {
    cpoId: string | null;
    value: CpoEnrollmentConfig | undefined;
    onChange: (next: CpoEnrollmentConfig) => void;
}

const flattenInstallments = (feeTypes: CPOFeeType[] | undefined): InstallmentRow[] => {
    if (!Array.isArray(feeTypes)) return [];
    const rows: InstallmentRow[] = [];
    for (const ft of feeTypes) {
        const afv = ft.assigned_fee_value;
        if (!afv) continue;
        const installments: CPOInstallment[] = afv.installments ?? [];
        if (installments.length === 0) {
            // Lump-sum AFV synthesizes a single virtual row keyed off the AFV id —
            // the backend stamps SFP.iId with the AFV id in this case (see
            // StudentFeePaymentGenerationService line ~80).
            rows.push({
                id: afv.id,
                feeTypeName: ft.name,
                installmentNumber: 1,
                amount: Number(afv.amount ?? 0),
                dueDate: null,
                startDate: null,
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
                startDate: inst.start_date ?? null,
            });
        }
    }
    return rows;
};

const fmt = (n: number) =>
    Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

const isoDate = (s: string | null | undefined) => {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    // <input type="date"> wants YYYY-MM-DD
    return d.toISOString().slice(0, 10);
};

const computeDiscountAmount = (base: number, d: DiscountSpec | null | undefined): number => {
    if (!d) return 0;
    if (d.type === 'PERCENTAGE') return (base * (d.value || 0)) / 100;
    return d.value || 0;
};

const blank: CpoEnrollmentConfig = {
    installment_overrides: [],
    cpo_discount: null,
    payment_mode: 'SKIP',
    payment_amount: null,
    payment_reference: null,
};

/**
 * Editor that produces a {@link CpoEnrollmentConfig} for one assignment.
 * Renders the CPO template installments with editable start/due/amount/discount,
 * plus a whole-CPO discount control and the existing offline-payment toggle.
 *
 * <p>Output is sent to the backend on the `cpo_config` field of an
 * {@link AssignmentItem} and supersedes the legacy `cpo_payment_*` fields.
 */
export const CpoEnrollmentConfigPanel = ({ cpoId, value, onChange }: Props) => {
    const { data, isLoading, isError } = useCPOFullDetails(cpoId, !!cpoId);
    const installments = useMemo(() => flattenInstallments(data?.fee_types), [data]);

    const cfg = value ?? blank;
    const overridesById = useMemo(() => {
        const m = new Map<string, InstallmentOverride>();
        for (const ov of cfg.installment_overrides ?? []) m.set(ov.aft_installment_id, ov);
        return m;
    }, [cfg.installment_overrides]);

    // Derived totals after overrides + CPO-level discount
    const grossTotal = useMemo(
        () => installments.reduce((sum, r) => sum + r.amount, 0),
        [installments],
    );
    /**
     * Per-row effective amount after applying installment overrides + CPO-level
     * discount (proportional share for PERCENTAGE; weighted-by-row-amount share
     * for FLAT). Mirrors the backend recompute so the UI shows what each row
     * will actually be billed at after Save.
     */
    const breakdown = useMemo(() => {
        // Step 1: per-row amount after manual override OR per-installment discount
        const postOverride: Array<{ id: string; amount: number }> = installments.map((r) => {
            const ov = overridesById.get(r.id);
            const amt =
                ov?.amount != null
                    ? ov.amount
                    : r.amount - computeDiscountAmount(r.amount, ov?.discount);
            return { id: r.id, amount: Math.max(0, amt) };
        });
        const postOverrideSum = postOverride.reduce((s, x) => s + x.amount, 0);

        // Step 2: CPO-level discount
        const cpoDiscountAmt = cfg.cpo_discount
            ? cfg.cpo_discount.type === 'PERCENTAGE'
                ? (postOverrideSum * (cfg.cpo_discount.value || 0)) / 100
                : Math.min(postOverrideSum, cfg.cpo_discount.value || 0)
            : 0;

        // Step 3: distribute CPO discount proportionally; last row absorbs rounding drift
        const effectiveByRow = new Map<string, number>();
        let allocated = 0;
        const lastIdx = postOverride.length - 1;
        postOverride.forEach((row, i) => {
            let share = 0;
            if (postOverrideSum > 0 && cpoDiscountAmt > 0) {
                if (i === lastIdx) {
                    share = cpoDiscountAmt - allocated;
                } else {
                    share = (row.amount / postOverrideSum) * cpoDiscountAmt;
                    allocated += share;
                }
            }
            effectiveByRow.set(row.id, Math.max(0, row.amount - share));
        });

        return {
            postOverride: postOverrideSum,
            net: Math.max(0, postOverrideSum - cpoDiscountAmt),
            cpoDiscountAmt,
            effectiveByRow,
        };
    }, [installments, overridesById, cfg.cpo_discount]);
    const totals = breakdown;

    // Helpers ----------------------------------------------------------------

    const replaceOverride = (next: InstallmentOverride[]) =>
        onChange({ ...cfg, installment_overrides: next });

    const updateRow = (aftId: string, patch: Partial<InstallmentOverride>) => {
        const list = cfg.installment_overrides ?? [];
        const existing = list.find((o) => o.aft_installment_id === aftId);
        const merged: InstallmentOverride = {
            aft_installment_id: aftId,
            start_date: existing?.start_date ?? null,
            due_date: existing?.due_date ?? null,
            amount: existing?.amount ?? null,
            discount: existing?.discount ?? null,
            ...patch,
        };
        // Drop the override entirely if every field is null/empty — keeps the payload tidy.
        const isEmpty =
            (merged.start_date == null || merged.start_date === '') &&
            (merged.due_date == null || merged.due_date === '') &&
            (merged.amount == null || Number.isNaN(merged.amount)) &&
            !merged.discount;
        if (isEmpty) {
            replaceOverride(list.filter((o) => o.aft_installment_id !== aftId));
            return;
        }
        if (existing) {
            replaceOverride(list.map((o) => (o.aft_installment_id === aftId ? merged : o)));
        } else {
            replaceOverride([...list, merged]);
        }
    };

    const setCpoDiscount = (d: DiscountSpec | null) =>
        onChange({ ...cfg, cpo_discount: d });

    const setPayment = (patch: Partial<CpoEnrollmentConfig>) =>
        onChange({ ...cfg, ...patch });

    // Local string state for amount input so blank entries stay blank
    const [paymentInput, setPaymentInput] = useState<string>(
        cfg.payment_amount != null ? String(cfg.payment_amount) : '',
    );
    useEffect(() => {
        setPaymentInput(cfg.payment_amount != null ? String(cfg.payment_amount) : '');
    }, [cfg.payment_amount]);

    if (!cpoId) return null;

    return (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                    Fee Configuration
                </p>
                <span className="text-[11px] text-neutral-600">
                    Total: <span className="font-semibold text-neutral-800">{fmt(grossTotal)}</span>
                    {' · '}
                    After discount: <span className="font-semibold text-orange-800">{fmt(totals.net)}</span>
                </span>
            </div>

            {isLoading && <p className="py-2 text-center text-[11px] text-neutral-500">Loading installments…</p>}
            {isError && (
                <p className="py-2 text-center text-[11px] text-red-600">
                    Could not load CPO details.
                </p>
            )}

            {/* Installments table with editable cells */}
            {installments.length > 0 && (
                <div className="mb-3 max-h-64 overflow-y-auto rounded border border-orange-100 bg-white">
                    <table className="w-full text-left text-[11px]">
                        <thead className="sticky top-0 bg-orange-50 text-[10px] uppercase text-neutral-500">
                            <tr>
                                <th className="px-2 py-1 font-medium">#</th>
                                <th className="px-2 py-1 font-medium">Fee Type</th>
                                <th className="px-2 py-1 font-medium">Start Date</th>
                                <th className="px-2 py-1 font-medium">Due Date</th>
                                <th className="px-2 py-1 text-right font-medium">Default</th>
                                <th className="px-2 py-1 text-right font-medium">Amount (₹)</th>
                                <th className="px-2 py-1 font-medium">Discount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-50">
                            {installments.map((row) => {
                                const ov = overridesById.get(row.id);
                                const startVal = ov?.start_date ?? row.startDate ?? '';
                                const dueVal = ov?.due_date ?? row.dueDate ?? '';
                                const amtVal = ov?.amount ?? '';
                                const discType = ov?.discount?.type ?? '';
                                const discValue = ov?.discount?.value ?? '';
                                // Effective amount this row will be billed at if no manual
                                // amount override is set: template − per-row discount − share
                                // of CPO discount. Used as placeholder so admins can see the
                                // post-discount figure without having to type it.
                                const effective = breakdown.effectiveByRow.get(row.id) ?? row.amount;
                                return (
                                    <tr key={row.id}>
                                        <td className="px-2 py-1 align-middle">{row.installmentNumber}</td>
                                        <td className="px-2 py-1 align-middle">{row.feeTypeName}</td>
                                        <td className="px-2 py-1 align-middle">
                                            <input
                                                type="date"
                                                value={isoDate(typeof startVal === 'string' ? startVal : null)}
                                                onChange={(e) =>
                                                    updateRow(row.id, {
                                                        start_date: e.target.value || null,
                                                    })
                                                }
                                                className="w-[120px] rounded border border-neutral-200 px-1 py-0.5 text-[11px] outline-none focus:border-primary-300"
                                            />
                                        </td>
                                        <td className="px-2 py-1 align-middle">
                                            <input
                                                type="date"
                                                value={isoDate(typeof dueVal === 'string' ? dueVal : null)}
                                                onChange={(e) =>
                                                    updateRow(row.id, {
                                                        due_date: e.target.value || null,
                                                    })
                                                }
                                                className="w-[120px] rounded border border-neutral-200 px-1 py-0.5 text-[11px] outline-none focus:border-primary-300"
                                            />
                                        </td>
                                        <td className="px-2 py-1 text-right align-middle text-neutral-500">
                                            {fmt(row.amount)}
                                        </td>
                                        <td className="px-2 py-1 align-middle text-right">
                                            <input
                                                type="number"
                                                step="any"
                                                min={0}
                                                placeholder={effective.toFixed(2)}
                                                title={
                                                    ov?.amount != null
                                                        ? 'Manual amount override'
                                                        : `Effective: ${fmt(effective)} (template ${fmt(row.amount)} after discounts)`
                                                }
                                                // Render 0/falsy as empty so typing into a
                                                // pre-zero field doesn't produce "0<digits>".
                                                value={!amtVal ? '' : amtVal}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateRow(row.id, {
                                                        amount: v === '' ? null : Number(v),
                                                    });
                                                }}
                                                className={`w-[88px] rounded border px-1 py-0.5 text-right text-[11px] outline-none focus:border-primary-300 ${
                                                    ov?.amount != null
                                                        ? 'border-primary-300 font-medium'
                                                        : 'border-neutral-200'
                                                }`}
                                            />
                                        </td>
                                        <td className="px-2 py-1 align-middle">
                                            <div className="flex items-center gap-1">
                                                <select
                                                    value={discType}
                                                    onChange={(e) => {
                                                        const t = e.target.value as DiscountType | '';
                                                        if (!t) {
                                                            updateRow(row.id, { discount: null });
                                                        } else {
                                                            updateRow(row.id, {
                                                                discount: {
                                                                    type: t,
                                                                    value: typeof discValue === 'number' ? discValue : 0,
                                                                    reason: ov?.discount?.reason ?? null,
                                                                },
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border border-neutral-200 px-1 py-0.5 text-[10px] outline-none"
                                                >
                                                    <option value="">none</option>
                                                    <option value="PERCENTAGE">%</option>
                                                    <option value="FLAT">₹</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    disabled={!discType}
                                                    placeholder="0"
                                                    // Render falsy / 0 as empty so the input doesn't
                                                    // pre-fill with "0" — otherwise typing "5" appends
                                                    // to it and the field briefly reads "05".
                                                    value={!discValue ? '' : discValue}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        const num = v === '' ? 0 : Number(v);
                                                        updateRow(row.id, {
                                                            discount: discType
                                                                ? {
                                                                      type: (discType as DiscountType) || 'FLAT',
                                                                      value: num,
                                                                      reason: ov?.discount?.reason ?? null,
                                                                  }
                                                                : null,
                                                        });
                                                    }}
                                                    className="w-[64px] rounded border border-neutral-200 px-1 py-0.5 text-right text-[11px] outline-none focus:border-primary-300 disabled:bg-neutral-50"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CPO-level discount */}
            <div className="mb-3 rounded-md border border-neutral-200 bg-white p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Discount (optional)
                </p>
                <div className="flex flex-wrap items-end gap-2">
                    <div>
                        <label className="block text-[10px] text-neutral-500">Type</label>
                        <select
                            value={cfg.cpo_discount?.type ?? ''}
                            onChange={(e) => {
                                const t = e.target.value as DiscountType | '';
                                if (!t) setCpoDiscount(null);
                                else
                                    setCpoDiscount({
                                        type: t,
                                        value: cfg.cpo_discount?.value ?? 0,
                                        reason: cfg.cpo_discount?.reason ?? null,
                                    });
                            }}
                            className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                        >
                            <option value="">none</option>
                            <option value="PERCENTAGE">% of total</option>
                            <option value="FLAT">flat ₹ off</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-neutral-500">Value</label>
                        <input
                            type="number"
                            step="any"
                            min={0}
                            disabled={!cfg.cpo_discount}
                            // Render falsy / 0 as empty — avoids the "05" effect when
                            // the value defaults to 0 on type selection.
                            value={!cfg.cpo_discount?.value ? '' : cfg.cpo_discount.value}
                            onChange={(e) =>
                                setCpoDiscount(
                                    cfg.cpo_discount
                                        ? {
                                              ...cfg.cpo_discount,
                                              value: Number(e.target.value || 0),
                                          }
                                        : null,
                                )
                            }
                            className="w-[100px] rounded border border-neutral-200 px-2 py-1 text-[11px] disabled:bg-neutral-50"
                        />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-[10px] text-neutral-500">Reason</label>
                        <input
                            type="text"
                            disabled={!cfg.cpo_discount}
                            placeholder="e.g. Sibling discount"
                            value={cfg.cpo_discount?.reason ?? ''}
                            onChange={(e) =>
                                setCpoDiscount(
                                    cfg.cpo_discount
                                        ? { ...cfg.cpo_discount, reason: e.target.value }
                                        : null,
                                )
                            }
                            className="w-full rounded border border-neutral-200 px-2 py-1 text-[11px] disabled:bg-neutral-50"
                        />
                    </div>
                    <span className="text-[11px] text-neutral-600">
                        = {fmt(totals.cpoDiscountAmt)} off
                    </span>
                </div>
            </div>

            {/* Initial offline payment */}
            <div className="rounded-md border border-neutral-200 bg-white p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Initial Payment (optional)
                </p>
                <div className="mb-2 flex flex-col gap-1.5 text-[11px] text-neutral-700">
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="radio"
                            name={`cpo-cfg-mode-${cpoId}`}
                            checked={(cfg.payment_mode ?? 'SKIP') === 'SKIP'}
                            onChange={() => setPayment({ payment_mode: 'SKIP', payment_amount: null })}
                            className="h-3.5 w-3.5"
                        />
                        <span>
                            <strong>Don't record any payment now.</strong> Learner pays each installment online later.
                        </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="radio"
                            name={`cpo-cfg-mode-${cpoId}`}
                            checked={cfg.payment_mode === 'OFFLINE'}
                            onChange={() =>
                                setPayment({
                                    payment_mode: 'OFFLINE',
                                    payment_amount:
                                        cfg.payment_amount && cfg.payment_amount > 0
                                            ? cfg.payment_amount
                                            : totals.net,
                                })
                            }
                            className="h-3.5 w-3.5"
                        />
                        <span>
                            <strong>Record an offline payment.</strong> Applied across installments earliest first.
                        </span>
                    </label>
                </div>
                {cfg.payment_mode === 'OFFLINE' && (
                    // items-start so the two labels line up at the top regardless
                    // of the per-column helper text (the "Net dues" hint under Amount
                    // would otherwise push Reference's input down with items-end).
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-[140px]">
                            <label className="mb-1 block text-[10px] font-medium text-neutral-500">
                                Amount (₹)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={paymentInput}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setPaymentInput(v);
                                    setPayment({ payment_amount: v === '' ? null : Number(v) });
                                }}
                                onFocus={(e) => e.currentTarget.select()}
                                className="w-full rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-primary-300"
                            />
                            <p className="mt-1 text-[10px] text-neutral-500">
                                Net dues: {fmt(totals.net)}
                            </p>
                        </div>
                        <div className="flex-1 min-w-[160px]">
                            <label className="mb-1 block text-[10px] font-medium text-neutral-500">
                                Reference (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. cheque #1234"
                                value={cfg.payment_reference ?? ''}
                                onChange={(e) => setPayment({ payment_reference: e.target.value || null })}
                                className="w-full rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-primary-300"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
