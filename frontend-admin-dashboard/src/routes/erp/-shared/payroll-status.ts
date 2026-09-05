import type { StatusType } from '@/components/design-system/status-chips';

/** Payroll run lifecycle, mirroring the backend PayrollStatus enum. */
export type PayrollRunStatus =
    | 'DRAFT'
    | 'PROCESSING'
    | 'PROCESSED'
    | 'APPROVED'
    | 'PAID'
    | 'CANCELLED';

/** Per-employee line status, mirroring PayrollEntryStatus. */
export type PayrollEntryStatus = 'CALCULATED' | 'HELD' | 'PAID';

export type PayrollRunType = 'REGULAR' | 'OFF_CYCLE' | 'FNF' | 'BONUS';

/**
 * The happy path a run walks. CANCELLED is deliberately absent: it is an exit,
 * not a step, and drawing it in the stepper would imply progress.
 */
export const RUN_STEPS: PayrollRunStatus[] = ['DRAFT', 'PROCESSED', 'APPROVED', 'PAID'];

export const RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
    DRAFT: 'Draft',
    PROCESSING: 'Processing',
    PROCESSED: 'Processed',
    APPROVED: 'Approved',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
};

export const RUN_TYPE_LABELS: Record<PayrollRunType, string> = {
    REGULAR: 'Regular',
    OFF_CYCLE: 'Off-cycle',
    FNF: 'Full & final',
    BONUS: 'Bonus',
};

export function runStatusChipType(status: string | null | undefined): StatusType {
    switch ((status ?? '').toUpperCase()) {
        case 'PAID':
        case 'APPROVED':
            return 'SUCCESS';
        case 'CANCELLED':
            return 'DANGER';
        case 'PROCESSING':
            return 'WARNING';
        default:
            // DRAFT / PROCESSED — in flight, nothing wrong.
            return 'INFO';
    }
}

export function entryStatusChipType(status: string | null | undefined): StatusType {
    switch ((status ?? '').toUpperCase()) {
        case 'PAID':
            return 'SUCCESS';
        case 'HELD':
            return 'WARNING';
        default:
            return 'INFO';
    }
}

/**
 * Which transitions the backend will accept from here — the single source the UI
 * uses to decide which buttons exist at all, so a user is never offered an
 * action that ends in a 400.
 *
 * Backend rules (PayrollRunService): process needs DRAFT; approve needs
 * PROCESSED; reject accepts PROCESSED or APPROVED; mark-paid needs APPROVED;
 * cancel accepts anything except PAID.
 */
export interface RunTransitions {
    canProcess: boolean;
    canApprove: boolean;
    canReject: boolean;
    canMarkPaid: boolean;
    canCancel: boolean;
    /** Entries can be held/released only while the run is still mutable. */
    canEditEntries: boolean;
}

export function runTransitions(status: string | null | undefined): RunTransitions {
    const s = (status ?? '').toUpperCase();
    return {
        canProcess: s === 'DRAFT',
        canApprove: s === 'PROCESSED',
        canReject: s === 'PROCESSED' || s === 'APPROVED',
        canMarkPaid: s === 'APPROVED',
        canCancel: s !== 'PAID' && s !== 'CANCELLED',
        canEditEntries: s === 'PROCESSED' || s === 'APPROVED',
    };
}
