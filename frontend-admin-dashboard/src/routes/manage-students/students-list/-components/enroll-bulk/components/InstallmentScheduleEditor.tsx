import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
    InstallmentIntervalUnit,
    InstallmentSchedule,
    InstallmentScheduleRow,
} from '@/routes/manage-students/students-list/-types/bulk-assign-types';
import {
    MAX_INSTALLMENTS,
    formatInr,
    rebalanceRows,
    rowsFromRule,
    type ScheduleError,
    type SchedulePart,
} from '@/routes/manage-students/students-list/-utils/installment-schedule';

interface Props {
    schedule: InstallmentSchedule;
    parts: SchedulePart[];
    maxCount: number;
    /** Share of the gross that remains after the plan discount (1 = no discount). */
    netFactor: number;
    error: ScheduleError | null;
    onChange: (next: InstallmentSchedule) => void;
}

const inputClass =
    'rounded border border-neutral-200 px-1.5 py-0.5 text-2xs outline-none focus:border-primary-300';

/**
 * Lets the admin set this learner's installment schedule: how many installments, the gap
 * (every N days or every N months), the first due date, then fine-tune each row's date and,
 * when the plan splits a single fee, its amount. Rows are regenerated whenever the rule
 * changes; the backend writes exactly these rows (see InstallmentScheduleService).
 */
export const InstallmentScheduleEditor = ({
    schedule,
    parts,
    maxCount,
    netFactor,
    error,
    onChange,
}: Props) => {
    const { t } = useTranslation('manageStudentsCpoEnrollmentConfigPanel');
    const splitParts = useMemo(() => parts.filter((p) => p.split), [parts]);
    const upfrontParts = useMemo(() => parts.filter((p) => !p.split), [parts]);
    // Amounts can only be edited when one fee is split: with several, a row's amount
    // would have to be divided between fees, which the backend does not guess at.
    const amountsEditable = splitParts.length === 1;
    const max = Math.min(maxCount, MAX_INSTALLMENTS);

    const generated = useMemo(() => rowsFromRule(schedule, splitParts), [schedule, splitParts]);
    const rows: InstallmentScheduleRow[] = schedule.rows ?? generated;
    const edited = schedule.rows != null;
    // On by default: changing one amount spreads the difference over the other installments
    // so the schedule still adds up to the fee. Off: every row is edited on its own.
    const [rebalance, setRebalance] = useState(true);

    // Changing the rule discards row edits: the rows are regenerated from it, and the
    // backend regenerates the same rows when none are sent.
    const applyRule = (patch: Partial<InstallmentSchedule>) => {
        onChange({ ...schedule, ...patch, rows: null });
    };

    const updateRow = (index: number, patch: Partial<InstallmentScheduleRow>) => {
        const base = rows.map((r) => ({
            due_date: r.due_date,
            amount: amountsEditable ? (r.amount ?? null) : null,
        }));
        base[index] = { ...base[index]!, ...patch };
        onChange({ ...schedule, rows: base });
    };

    const updateAmount = (index: number, amount: number | null) => {
        if (amount == null || !rebalance || !amountsEditable) {
            updateRow(index, { amount });
            return;
        }
        const base = rows.map((r, k) => ({
            due_date: r.due_date,
            amount: r.amount ?? generated[k]?.amount ?? 0,
        }));
        onChange({ ...schedule, rows: rebalanceRows(base, index, amount, splitParts[0]!.total) });
    };

    const unit: InstallmentIntervalUnit = schedule.interval?.unit ?? 'MONTHS';
    const value = schedule.interval?.value ?? 1;

    return (
        <div className="mb-3 rounded-md border border-neutral-200 bg-white p-2.5">
            <div className="mb-2 flex flex-wrap items-end gap-3">
                <div>
                    <label className="block text-2xs text-neutral-500">{t('schedule.countLabel')}</label>
                    <input
                        type="number"
                        min={1}
                        max={max}
                        value={schedule.count ?? ''}
                        onChange={(e) => {
                            const n = e.target.value === '' ? null : Math.floor(Number(e.target.value));
                            applyRule({ count: n });
                        }}
                        className={`${inputClass} w-16`}
                    />
                </div>
                <div>
                    <label className="block text-2xs text-neutral-500">{t('schedule.everyLabel')}</label>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={1}
                            value={value}
                            disabled={(schedule.count ?? 0) <= 1}
                            onChange={(e) =>
                                applyRule({
                                    interval: {
                                        unit,
                                        value: Math.max(1, Math.floor(Number(e.target.value || 1))),
                                    },
                                })
                            }
                            className={`${inputClass} w-14 disabled:bg-neutral-50`}
                        />
                        <select
                            value={unit}
                            disabled={(schedule.count ?? 0) <= 1}
                            onChange={(e) =>
                                applyRule({
                                    interval: { unit: e.target.value as InstallmentIntervalUnit, value },
                                })
                            }
                            className={`${inputClass} disabled:bg-neutral-50`}
                        >
                            <option value="DAYS">{t('schedule.units.days')}</option>
                            <option value="MONTHS">{t('schedule.units.months')}</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-2xs text-neutral-500">{t('schedule.firstDueLabel')}</label>
                    <input
                        type="date"
                        value={schedule.first_due_date ?? ''}
                        onChange={(e) => applyRule({ first_due_date: e.target.value || null })}
                        className={`${inputClass} w-32`}
                    />
                </div>
                {edited && (
                    <button
                        type="button"
                        onClick={() => applyRule({})}
                        className="text-2xs font-medium text-primary-600 hover:underline"
                    >
                        {t('schedule.reset')}
                    </button>
                )}
            </div>

            {unit === 'MONTHS' && (schedule.count ?? 0) > 1 && (
                <p className="mb-2 text-2xs text-neutral-500">{t('schedule.monthsHint')}</p>
            )}

            {rows.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded border border-neutral-100">
                    <table className="w-full text-start text-2xs">
                        <thead className="sticky top-0 bg-neutral-50 text-2xs uppercase text-neutral-500">
                            <tr>
                                <th className="px-2 py-1 font-medium">{t('table.index')}</th>
                                <th className="px-2 py-1 font-medium">{t('table.dueDate')}</th>
                                <th className="px-2 py-1 text-end font-medium">{t('table.amount')}</th>
                                <th className="px-2 py-1 text-end font-medium">
                                    {t('schedule.afterDiscount')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {rows.map((row, k) => {
                                const gross = row.amount ?? generated[k]?.amount ?? 0;
                                return (
                                    <tr key={k}>
                                        <td className="px-2 py-1 align-middle">{k + 1}</td>
                                        <td className="px-2 py-1 align-middle">
                                            <input
                                                type="date"
                                                value={row.due_date}
                                                onChange={(e) =>
                                                    updateRow(k, { due_date: e.target.value })
                                                }
                                                className={`${inputClass} w-32`}
                                            />
                                        </td>
                                        <td className="px-2 py-1 text-end align-middle">
                                            {amountsEditable ? (
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    value={row.amount ?? ''}
                                                    onChange={(e) =>
                                                        updateAmount(
                                                            k,
                                                            e.target.value === ''
                                                                ? null
                                                                : Number(e.target.value)
                                                        )
                                                    }
                                                    className={`${inputClass} w-24 text-end`}
                                                />
                                            ) : (
                                                <span className="tabular-nums text-neutral-700">
                                                    {formatInr(gross)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1 text-end align-middle tabular-nums text-neutral-600">
                                            {formatInr(Math.round(gross * netFactor * 100) / 100)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {amountsEditable && rows.length > 1 && (
                <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5 text-2xs text-neutral-600">
                    <input
                        type="checkbox"
                        checked={rebalance}
                        onChange={(e) => setRebalance(e.target.checked)}
                        className="size-3.5 accent-primary-500"
                    />
                    {t('schedule.rebalance')}
                </label>
            )}
            {!amountsEditable && splitParts.length > 1 && (
                <p className="mt-1 text-2xs text-neutral-500">{t('schedule.multiFeeHint')}</p>
            )}
            {upfrontParts.length > 0 && (
                <p className="mt-1 text-2xs text-neutral-600">
                    {t('schedule.upfront', {
                        fees: upfrontParts
                            .map((p) => `${p.feeTypeName} ${formatInr(p.total)}`)
                            .join(', '),
                    })}
                </p>
            )}
            {error && (
                <p role="alert" className="mt-2 text-2xs font-medium text-danger-600">
                    {t(error.key, error.params)}
                </p>
            )}
        </div>
    );
};
