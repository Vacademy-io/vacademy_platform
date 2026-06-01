import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import { markInvoicePaidManually } from '../../-services/custom-team-services';

interface MarkPaidDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceId: string;
    invoiceNumber?: string;
    /** Refresh callback fired on a successful manual-payment record. */
    onSuccess?: () => void;
}

/**
 * Small dialog wrapping the {@code POST /v1/invoices/{id}/mark-paid-manual} endpoint.
 * Both fields are optional — `transactionId` ends up on the PaymentLog's
 * paymentSpecificData JSON (audit trail) and `notes` shows on the side-view detail
 * panel + confirmation email. Same payload shape as the manage-students surface
 * uses, so behaviour is consistent across both entry points.
 */
export function MarkPaidDialog({
    open,
    onOpenChange,
    invoiceId,
    invoiceNumber,
    onSuccess,
}: MarkPaidDialogProps) {
    const [transactionId, setTransactionId] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    useEffect(() => {
        if (!open) return;
        setTransactionId('');
        setNotes('');
    }, [open]);

    const mutation = useMutation({
        mutationFn: () =>
            markInvoicePaidManually(invoiceId, {
                transaction_id: transactionId.trim() || undefined,
                notes: notes.trim() || undefined,
            }),
        onSuccess: () => {
            toast.success(`Invoice ${invoiceNumber || invoiceId} marked as paid`);
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(
                err?.response?.data?.message || err?.message || 'Failed to mark invoice as paid'
            );
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Mark invoice paid</DialogTitle>
                    <DialogDescription>
                        Records a manual / offline payment against{' '}
                        {invoiceNumber ? <strong>{invoiceNumber}</strong> : 'this invoice'} and
                        flips its status to PAID. Both fields below are optional.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
                    <div className="space-y-1">
                        <Label htmlFor="mp-transaction-id">Transaction reference</Label>
                        <Input
                            id="mp-transaction-id"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="cheque #, UPI ref, receipt no."
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="mp-notes">Notes</Label>
                        <Input
                            id="mp-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional note (shown on email + side-view)"
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onOpenChange(false)}
                        disable={mutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="small"
                        onClick={() => mutation.mutate()}
                        disable={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            'Mark as paid'
                        )}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
