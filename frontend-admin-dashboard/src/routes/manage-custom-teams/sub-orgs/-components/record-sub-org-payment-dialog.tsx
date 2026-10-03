import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import { recordSubOrgAdminOfflinePayment } from '../../-services/custom-team-services';

interface RecordSubOrgPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userPlanId: string;
    adminUserId?: string;
    /** Subhead on the dialog (e.g. "SVM School — admin CPO"). */
    contextLabel?: string;
    /** Seed the amount input on open (typically the next-due amount). */
    suggestedAmount?: number;
}

/**
 * Records an offline payment against a sub-org admin's UserPlan via the same backend
 * endpoint manage-students' CPO side-view uses. Surfaces in the analytics-panel
 * Invoices tab so the institute admin doesn't have to drill into the member drawer
 * just to log a cash collection.
 */
export function RecordSubOrgPaymentDialog({
    open,
    onOpenChange,
    userPlanId,
    adminUserId,
    contextLabel,
    suggestedAmount,
}: RecordSubOrgPaymentDialogProps) {
    const { t } = useTranslation('manageCustomTeamsRecordSubOrgPaymentDialog');
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(
        new Date().toISOString().slice(0, 10)
    );
    const [reference, setReference] = useState<string>('');
    const [generateInvoice, setGenerateInvoice] = useState<boolean>(true);

    useEffect(() => {
        if (!open) return;
        setAmount(suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : '');
        setPaymentDate(new Date().toISOString().slice(0, 10));
        setReference('');
        setGenerateInvoice(true);
    }, [open, suggestedAmount]);

    const mutation = useMutation({
        mutationFn: async () => {
            const amt = Number(amount);
            if (!Number.isFinite(amt) || amt <= 0) {
                throw new Error(t('errors.enterPositiveAmount'));
            }
            return recordSubOrgAdminOfflinePayment(userPlanId, {
                amount: amt,
                payment_date: paymentDate,
                reference: reference.trim() ? reference.trim() : null,
                generate_invoice: generateInvoice,
            });
        },
        onSuccess: () => {
            toast.success(t('toasts.recorded'));
            // Invalidate the surfaces that reflect installment / invoice state so the
            // analytics panel + drawer pick up the new PaymentLog and (if requested)
            // the freshly-generated Invoice without a manual refresh.
            queryClient.invalidateQueries({ queryKey: ['sub-org-finance-detail'] });
            if (adminUserId) {
                queryClient.invalidateQueries({
                    queryKey: ['sub-org-admin-invoices', adminUserId],
                });
                queryClient.invalidateQueries({ queryKey: ['member-invoices', adminUserId] });
                queryClient.invalidateQueries({
                    queryKey: ['cpo-side-view', 'user-plans', adminUserId],
                });
                // Invalidate account summary so the balance/overdue tiles refresh.
                queryClient.invalidateQueries({
                    predicate: (q) =>
                        Array.isArray(q.queryKey)
                        && q.queryKey[0] === 'sub-org-admin-account-summary'
                        && q.queryKey[1] === adminUserId,
                });
            }
            queryClient.invalidateQueries({
                queryKey: ['cpo-side-view', 'installments', userPlanId],
            });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.message || err?.response?.data?.message || t('toasts.failed'));
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>
                        {contextLabel ? `${contextLabel}. ` : ''}
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="space-y-1">
                        <Label htmlFor="rsop-amount">{t('fields.amount')}</Label>
                        <Input
                            id="rsop-amount"
                            type="number"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={t('fields.amountPlaceholder')}
                            onFocus={(e) => e.currentTarget.select()}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rsop-date">{t('fields.paymentDate')}</Label>
                        <Input
                            id="rsop-date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rsop-ref">{t('fields.reference')}</Label>
                        <Input
                            id="rsop-ref"
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder={t('fields.referencePlaceholder')}
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={generateInvoice}
                            onCheckedChange={(c) => setGenerateInvoice(!!c)}
                        />
                        {t('fields.generateInvoice')}
                    </label>
                </div>

                <DialogFooter className="gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onOpenChange(false)}
                        disable={mutation.isPending}
                    >
                        {t('cancel')}
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
                                {t('saving')}
                            </>
                        ) : (
                            t('saveAndAllocate')
                        )}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
