import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MyInput } from '@/components/design-system/input';
import { deletePaymentLog, serverErrorMessage } from '@/services/payment-logs';
import { deleteInvoicePermanently } from '@/services/invoice-service';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

/** What is about to be deleted, and how to name it in the confirmation. */
export interface PermanentDeleteTarget {
    kind: 'payment' | 'invoice';
    id: string;
    /** Amount or invoice number, shown in the title. */
    label: string;
}

/** The word the admin has to type — a permanent delete should never be one stray click. */
const CONFIRM_WORD = 'DELETE';

/** Every cached view a permanent delete changes (same set a void changes). */
const QUERY_KEYS_TOUCHED_BY_DELETE: string[][] = [
    ['payment-logs-all'],
    ['payment-billing-summary'],
    ['payment-billing-summary-dash'],
    ['payment-outstanding-learners'],
    ['payment-outstanding-dash'],
    ['payment-analytics'],
    ['collection-summary-dash'],
    ['payment-log-invoices'],
    ['user-account-summary'],
    ['user-account-ledger'],
    ['user-invoices'],
    ['cpo-side-view'],
];

interface PermanentDeleteDialogProps {
    target: PermanentDeleteTarget | null;
    onOpenChange: (open: boolean) => void;
    onDeleted?: () => void;
}

/**
 * Confirms and performs a PERMANENT delete of a payment or an invoice. Only rendered where the
 * viewer's role has the Display Settings permission (off by default); the server enforces it
 * again. Every delete — and every refused attempt — lands in the admin activity log.
 */
export function PermanentDeleteDialog({ target, onOpenChange, onDeleted }: PermanentDeleteDialogProps) {
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const queryClient = useQueryClient();
    const [typed, setTyped] = useState('');

    const mutation = useMutation({
        mutationFn: async (input: PermanentDeleteTarget) => {
            if (input.kind === 'payment') {
                await deletePaymentLog(input.id);
                return;
            }
            const instituteId = getCurrentInstituteId();
            if (!instituteId) throw new Error('Institute ID not found');
            await deleteInvoicePermanently(input.id, instituteId);
        },
        onSuccess: (_result, input) => {
            QUERY_KEYS_TOUCHED_BY_DELETE.forEach((queryKey) =>
                queryClient.invalidateQueries({ queryKey })
            );
            toast.success(
                input.kind === 'payment'
                    ? t('permanentDelete.paymentDeletedToast', { label: input.label })
                    : t('permanentDelete.invoiceDeletedToast', { label: input.label })
            );
            onDeleted?.();
        },
        onError: (err: unknown) => {
            const message = serverErrorMessage(err);
            toast.error(message || t('permanentDelete.errorToast'));
        },
    });

    const close = (open: boolean) => {
        if (!open) setTyped('');
        onOpenChange(open);
    };

    const isPayment = target?.kind === 'payment';
    const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

    return (
        <AlertDialog open={!!target} onOpenChange={close}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {isPayment
                            ? t('permanentDelete.paymentTitle', { label: target?.label ?? '' })
                            : t('permanentDelete.invoiceTitle', { label: target?.label ?? '' })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isPayment
                            ? t('permanentDelete.paymentDescription')
                            : t('permanentDelete.invoiceDescription')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <MyInput
                    label={t('permanentDelete.typeToConfirm', { word: CONFIRM_WORD })}
                    inputPlaceholder={CONFIRM_WORD}
                    input={typed}
                    onChangeFunction={(e) => setTyped(e.target.value)}
                    size="medium"
                    className="w-full"
                />
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('permanentDelete.keep')}</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={!confirmed || mutation.isPending}
                        onClick={() => {
                            if (target && confirmed) mutation.mutate(target);
                            close(false);
                        }}
                        className="bg-danger-600 hover:bg-danger-700"
                    >
                        {t('permanentDelete.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
