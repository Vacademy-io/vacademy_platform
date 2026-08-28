import { StatusChip, type StatusType } from '@/components/design-system/status-chips';
import { RUN_TYPE_LABELS, type PayrollRunType } from '@/routes/erp/-shared/payroll-status';

/** Shared labels/options for the variable-pay table and its add dialog. */

export const ADJUSTMENT_TYPE_OPTIONS = [
    { _id: 'EARNING', value: 'EARNING', label: 'Earning — adds to net pay' },
    { _id: 'DEDUCTION', value: 'DEDUCTION', label: 'Deduction — reduces net pay' },
];

export const RUN_SCOPES: PayrollRunType[] = ['REGULAR', 'OFF_CYCLE', 'FNF', 'BONUS'];

/** One line each, because "FNF" means nothing to someone entering their first adjustment. */
export const RUN_SCOPE_MEANINGS: Record<PayrollRunType, string> = {
    REGULAR: 'the normal monthly payroll run',
    OFF_CYCLE: 'an extra run outside the monthly cycle',
    FNF: 'the full & final settlement when someone leaves',
    BONUS: 'a standalone bonus run',
};

export const RUN_SCOPE_OPTIONS = RUN_SCOPES.map((value) => ({
    _id: value,
    value,
    label: `${RUN_TYPE_LABELS[value]} — ${RUN_SCOPE_MEANINGS[value]}`,
}));

export const CURRENCY_OPTIONS = [
    { _id: 'INR', value: 'INR', label: 'INR — Indian rupee' },
    { _id: 'AED', value: 'AED', label: 'AED — UAE dirham' },
    { _id: 'SAR', value: 'SAR', label: 'SAR — Saudi riyal' },
];

export function adjustmentTypeChipStatus(type: string | null | undefined): StatusType {
    return (type ?? '').toUpperCase() === 'DEDUCTION' ? 'DANGER' : 'SUCCESS';
}

export const AdjustmentTypeChip = ({ type }: { type: string | null | undefined }) => {
    const upper = (type ?? '').toUpperCase();
    return (
        <StatusChip
            text={
                upper === 'DEDUCTION' ? 'Deduction' : upper === 'EARNING' ? 'Earning' : upper || '—'
            }
            textSize="text-caption"
            status={adjustmentTypeChipStatus(upper)}
            showIcon={false}
        />
    );
};

export const RunScopeChip = ({ scope }: { scope: string | null | undefined }) => {
    const upper = (scope ?? 'REGULAR').toUpperCase();
    const label = RUN_TYPE_LABELS[upper as PayrollRunType] ?? upper;
    return (
        <span className="w-fit rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1 text-caption text-neutral-600">
            {label}
        </span>
    );
};
