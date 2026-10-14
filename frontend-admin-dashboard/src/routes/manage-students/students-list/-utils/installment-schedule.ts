import type {
    InstallmentIntervalUnit,
    InstallmentSchedule,
    InstallmentScheduleRow,
} from '../-types/bulk-assign-types';
import type { CPOFeeType, CPOFlexibleDefaults } from '@/routes/financial-management/fee-plans/-types/cpo-types';

/**
 * Installment-schedule maths for the Enroll wizard. Mirrors the backend's
 * InstallmentScheduleService exactly, so the preview is what gets written:
 *  - amounts are whole currency units, the remainder (incl. paise) goes on installment #1;
 *  - DAYS: due k = first + k × value days;
 *  - MONTHS: due k = first + k × value months, counted from the first date each time and
 *    clamped to the month's length (31 Jan → 28 Feb → 31 Mar), so dates never drift.
 * See docs/CPO_FLEXIBLE_INSTALLMENTS.md.
 */

/** Same cap as InstallmentScheduleService.MAX_INSTALLMENTS. */
export const MAX_INSTALLMENTS = 60;

/** One fee of a plan and how a schedule treats it (split over the schedule, or paid upfront). */
export interface SchedulePart {
    feeTypeName: string;
    total: number;
    split: boolean;
}

/** Local YYYY-MM-DD for today; avoids the UTC shift of toISOString(). */
export const todayIso = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseIso = (iso: string): [number, number, number] | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
};

const toIso = (y: number, m: number, d: number) =>
    `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const addDaysIso = (iso: string, days: number): string => {
    const p = parseIso(iso);
    if (!p) return iso;
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
    return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

export const addMonthsIso = (iso: string, months: number): string => {
    const p = parseIso(iso);
    if (!p) return iso;
    const zeroBased = p[1] - 1 + months;
    const y = p[0] + Math.floor(zeroBased / 12);
    const m = (((zeroBased % 12) + 12) % 12) + 1;
    return toIso(y, m, Math.min(p[2], daysInMonth(y, m)));
};

export const generateDueDates = (
    firstDueDate: string,
    count: number,
    unit: InstallmentIntervalUnit,
    value: number
): string[] =>
    Array.from({ length: count }, (_, k) =>
        unit === 'DAYS' ? addDaysIso(firstDueDate, k * value) : addMonthsIso(firstDueDate, k * value)
    );

/** Whole-unit equal split, remainder on the first part. Works in paise to avoid float drift. */
export const equalSplit = (total: number, count: number): number[] => {
    if (count < 1) return [];
    const totalPaise = Math.round(total * 100);
    const basePaise = Math.floor(totalPaise / count / 100) * 100;
    const firstPaise = totalPaise - basePaise * (count - 1);
    return [firstPaise / 100, ...Array.from({ length: count - 1 }, () => basePaise / 100)];
};

/** The plan's fees as the backend sees them (DELETED rows are not returned by the API). */
export const partsFromFeeTypes = (feeTypes: CPOFeeType[] | undefined): SchedulePart[] => {
    if (!Array.isArray(feeTypes)) return [];
    return feeTypes
        .filter((ft) => ft.assigned_fee_value)
        .map((ft) => {
            const afv = ft.assigned_fee_value;
            const installments = afv.installments ?? [];
            const total =
                installments.length > 0
                    ? installments.reduce((s, i) => s + Number(i.amount ?? 0), 0)
                    : Number(afv.amount ?? 0);
            return {
                feeTypeName: ft.name,
                total,
                split: installments.length > 0 || afv.has_installment === true,
            };
        });
};

/** Starting schedule: the plan's defaults, else its template count, else 3 monthly. */
export const initialSchedule = (
    defaults: CPOFlexibleDefaults | null | undefined,
    templateCount?: number
): InstallmentSchedule => ({
    count: defaults?.count ?? (templateCount && templateCount > 1 ? templateCount : 3),
    interval: defaults?.interval ?? { unit: 'MONTHS', value: 1 },
    first_due_date: todayIso(),
    rows: null,
});

/**
 * Rows generated from the rule, with gross amounts. When the plan splits more than one fee,
 * the amount is the sum of each fee's share of that installment.
 */
export const rowsFromRule = (
    schedule: InstallmentSchedule,
    splitParts: SchedulePart[]
): InstallmentScheduleRow[] => {
    const count = schedule.count ?? 0;
    if (!schedule.first_due_date || count < 1 || count > MAX_INSTALLMENTS) return [];
    const unit = schedule.interval?.unit ?? 'MONTHS';
    const value = schedule.interval?.value && schedule.interval.value > 0 ? schedule.interval.value : 1;
    const dates = generateDueDates(schedule.first_due_date, count, unit, value);
    const shares = splitParts.map((p) => equalSplit(p.total, count));
    return dates.map((due_date, k) => ({
        due_date,
        amount: shares.reduce((s, share) => s + (share[k] ?? 0), 0),
    }));
};

/** A schedule problem as a translation key (namespace manageStudentsCpoEnrollmentConfigPanel). */
export interface ScheduleError {
    key: string;
    params?: Record<string, string | number>;
}

/**
 * Validates a schedule against the plan with the backend's rules, so the admin sees the
 * problem before Preview. Returns null when the schedule can be sent.
 */
export const validateSchedule = (
    schedule: InstallmentSchedule | null | undefined,
    parts: SchedulePart[],
    maxCount: number
): ScheduleError | null => {
    if (!schedule) return null;
    const splitParts = parts.filter((p) => p.split);
    if (parts.length > 0 && splitParts.length === 0) return { key: 'schedule.errors.nothingToSplit' };
    const max = Math.min(maxCount, MAX_INSTALLMENTS);
    const rows = schedule.rows ?? rowsFromRule(schedule, splitParts);
    if (rows.length < 1 || rows.length > max) return { key: 'schedule.errors.countRange', params: { max } };
    for (let k = 0; k < rows.length; k++) {
        if (!rows[k]?.due_date) return { key: 'schedule.errors.missingDueDate', params: { n: k + 1 } };
        if (k > 0 && rows[k]!.due_date < rows[k - 1]!.due_date) {
            return { key: 'schedule.errors.datesOutOfOrder', params: { n: k + 1, prev: k } };
        }
    }
    const withAmount = rows.filter((r) => r.amount != null).length;
    if (withAmount > 0 && withAmount !== rows.length) return { key: 'schedule.errors.mixedAmounts' };
    if (withAmount > 0) {
        if (rows.some((r) => (r.amount ?? 0) < 0)) return { key: 'schedule.errors.negativeAmount' };
        const splitTotal = splitParts.reduce((s, p) => s + p.total, 0);
        const given = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
        if (Math.round(given * 100) !== Math.round(splitTotal * 100)) {
            return {
                key: 'schedule.errors.amountMismatch',
                params: { given: formatInr(given), total: formatInr(splitTotal) },
            };
        }
    }
    return null;
};

export const formatInr = (n: number) =>
    Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
