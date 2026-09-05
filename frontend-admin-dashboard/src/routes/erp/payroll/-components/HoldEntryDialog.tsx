import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { PayrollEntryDTO } from '@/routes/erp/-shared/hr-types';

const MIN_REASON = 4;

interface HoldEntryDialogProps {
    /** The entry to hold; null closes the dialog. */
    entry: PayrollEntryDTO | null;
    onClose: () => void;
    onHold: (entryId: string, reason: string) => Promise<string | null>;
}

/**
 * Hold one employee's payslip out of the run.
 *
 * The reason is mandatory and not a formality: a held entry drops out of the run's
 * net pay, so whoever reconciles the bank transfer a week later needs to know why
 * the total moved. The backend stores it on the entry and it is shown on the row.
 */
export const HoldEntryDialog = ({ entry, onClose, onHold }: HoldEntryDialogProps) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (entry) setReason('');
    }, [entry]);

    const submit = async () => {
        if (!entry?.id) return;
        const trimmed = reason.trim();
        if (trimmed.length < MIN_REASON) {
            toast.error('Give a reason for the hold — it is stored against the payslip.');
            return;
        }
        const message = await onHold(entry.id, trimmed);
        if (message === null) return;
        toast.success(message);
        onClose();
    };

    return (
        <MyDialog
            heading={`Hold payslip${entry?.employee_code ? ` — ${entry.employee_code}` : ''}`}
            open={!!entry}
            onOpenChange={(open) => !open && onClose()}
            dialogWidth="max-w-lg"
            footer={
                <>
                    <MyButton buttonType="secondary" scale="medium" onClick={onClose}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={submit}
                        loadingText="Holding…"
                    >
                        Hold payslip
                    </MyButton>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-body text-neutral-600">
                    Holding removes this employee&apos;s net pay from the run total. Their payslip
                    stays computed, so releasing it later needs no recalculation.
                </p>
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="hold-reason"
                        className="text-body font-semibold text-neutral-700"
                    >
                        Reason <span className="text-danger-600">*</span>
                    </label>
                    <Textarea
                        id="hold-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        placeholder="e.g. Bank details unverified — awaiting cancelled cheque."
                    />
                    <p className="text-caption text-neutral-500">
                        Shown on the payroll register and to whoever reconciles the transfer.
                    </p>
                </div>
            </div>
        </MyDialog>
    );
};
