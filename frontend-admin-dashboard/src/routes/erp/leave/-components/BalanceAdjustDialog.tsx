import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Form } from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import type { LeaveBalanceDTO } from '@/routes/erp/-shared/hr-types';
import { HrTextField, HrTextareaField } from '@/routes/erp/people/-components/HrFormFields';
import { useAdjustLeaveBalance } from '@/routes/erp/leave/-hooks/use-leave';
import { employeeLabel, formatDays, toNumber } from './leave-meta';

const schema = z.object({
    adjustment: z
        .string()
        .trim()
        .min(1, 'Enter the correction, e.g. 1.5 or -2')
        .regex(/^-?\d+(\.\d+)?$/, 'Numbers only — use a leading minus to take days away')
        .refine((value) => Number(value) !== 0, 'Zero would not change anything'),
    reason: z.string().trim().max(500, 'Keep the reason under 500 characters'),
});

type AdjustFormValues = z.infer<typeof schema>;

interface BalanceAdjustDialogProps {
    /** `null` closes the dialog; a balance row opens it for that employee + leave type. */
    balance: LeaveBalanceDTO | null;
    onOpenChange: (open: boolean) => void;
}

/**
 * Correct one employee's balance for one leave type.
 *
 * The value is an ADJUSTMENT, not a new closing balance: it is added to the
 * ledger, so `-2` takes two days away and `1.5` grants a day and a half. Writing
 * the resulting closing balance under the field is the cheapest way to stop the
 * common mistake of typing the number the admin wants to end up with.
 */
export const BalanceAdjustDialog = ({ balance, onOpenChange }: BalanceAdjustDialogProps) => {
    const mutation = useAdjustLeaveBalance();

    const form = useForm<AdjustFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { adjustment: '', reason: '' },
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!balance) return;
        form.reset({ adjustment: '', reason: '' });
    }, [balance, form]);

    const typed = toNumber(form.watch('adjustment'));
    const currentClosing = toNumber(balance?.closing_balance) ?? 0;
    const projected = typed === null ? null : currentClosing + typed;

    const onSubmit = async (values: AdjustFormValues) => {
        if (!balance?.id) return;
        try {
            await mutation.mutateAsync({
                id: balance.id,
                adjustment: Number(values.adjustment),
                reason: values.reason || undefined,
            });
            toast.success('Balance adjusted');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-leave',
                tags: { action: 'adjust-leave-balance' },
                fallbackMessage: 'Could not adjust this balance.',
            });
        }
    };

    return (
        <MyDialog
            heading="Adjust leave balance"
            open={!!balance}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        type="button"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        type="button"
                        onAsyncClick={form.handleSubmit(onSubmit)}
                        loadingText="Adjusting…"
                    >
                        Apply adjustment
                    </MyButton>
                </div>
            }
        >
            {balance && (
                <Form {...form}>
                    <form className="flex flex-col gap-4" noValidate>
                        <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                            <span className="text-body font-semibold text-foreground">
                                {employeeLabel(balance.employee_name, balance.employee_code)}
                            </span>
                            <span className="text-caption text-muted-foreground">
                                {balance.leave_type_name || 'Leave'} · {balance.year ?? '—'} ·
                                closing balance{' '}
                                <span className="tabular-nums text-foreground">
                                    {formatDays(balance.closing_balance)}
                                </span>{' '}
                                days
                            </span>
                        </div>

                        <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                            <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                            <span>
                                An adjustment is an absolute correction added to the balance — not
                                the balance you want to end up with. Enter <b>1.5</b> to grant a day
                                and a half, <b>-2</b> to take two days away.
                            </span>
                        </div>

                        <HrTextField
                            control={form.control}
                            name="adjustment"
                            label="Adjustment in days"
                            placeholder="-2"
                            required
                            description={
                                projected === null
                                    ? 'Decimals allowed — 0.5 is half a day.'
                                    : `Closing balance becomes ${formatDays(projected)} days.`
                            }
                        />

                        <HrTextareaField
                            control={form.control}
                            name="reason"
                            label="Reason"
                            rows={3}
                            placeholder="Why the balance is being corrected"
                            description="Kept on the record so the next admin can see why the number moved."
                        />
                    </form>
                </Form>
            )}
        </MyDialog>
    );
};
