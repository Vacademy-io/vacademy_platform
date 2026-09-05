import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Info, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Form } from '@/components/ui/form';
import SelectField from '@/components/design-system/select-field';
import { reportApiError } from '@/lib/report-api-error';
import { HrTextField, HrTextareaField } from '@/routes/erp/people/-components/HrFormFields';
import { humanizeToken } from '@/routes/erp/leave/-components/leave-meta';
import { useSubmitReimbursement } from '@/routes/erp/my-hr/-hooks/use-my-hr';
import { REIMBURSEMENT_TYPES } from './my-hr-shared';

const schema = z.object({
    type: z.string().min(1, 'Pick what this expense was for'),
    amount: z
        .string()
        .trim()
        .min(1, 'Enter the amount you spent')
        .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
            message: 'Enter an amount greater than zero',
        }),
    expense_date: z.string().min(1, 'When did you spend it?'),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
});

type ClaimValues = z.infer<typeof schema>;

const emptyValues: ClaimValues = {
    type: 'TRAVEL',
    amount: '',
    expense_date: '',
    description: '',
};

const TYPE_OPTIONS = REIMBURSEMENT_TYPES.map((value) => ({
    _id: value,
    value,
    label: humanizeToken(value),
}));

interface NewClaimDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: string;
}

/**
 * Submit an expense claim.
 *
 * Deliberately four fields: what it was for, how much, when, and a line of
 * context. Receipts are not uploaded here — the backend accepts a
 * `receipt_file_id`, but nothing in this flow issues one, and an upload control
 * that silently drops the file would be worse than telling people to bring the
 * receipt to HR.
 */
export const NewClaimDialog = ({ open, onOpenChange, employeeId }: NewClaimDialogProps) => {
    const mutation = useSubmitReimbursement(employeeId);
    const [refusal, setRefusal] = useState<string | null>(null);

    const form = useForm<ClaimValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!open) return;
        form.reset(emptyValues);
        setRefusal(null);
    }, [open, form]);

    const submit = form.handleSubmit(async (values) => {
        setRefusal(null);
        try {
            await mutation.mutateAsync({
                employee_id: employeeId,
                type: values.type,
                amount: Number(values.amount),
                expense_date: values.expense_date,
                ...(values.description.trim() ? { description: values.description.trim() } : {}),
            });
            toast.success('Claim submitted');
            onOpenChange(false);
        } catch (error) {
            setRefusal(
                reportApiError(error, {
                    feature: 'erp-my-hr',
                    tags: { action: 'submit-reimbursement' },
                    fallbackMessage: 'Could not submit your claim.',
                    showToast: false,
                })
            );
        }
    });

    return (
        <MyDialog
            heading="New claim"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-xl"
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
                        onAsyncClick={submit}
                        loadingText="Submitting…"
                    >
                        Submit claim
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form className="flex flex-col gap-4" noValidate>
                    <SelectField
                        control={form.control}
                        name="type"
                        label="What was it for?"
                        required
                        className="w-full sm:w-full"
                        options={TYPE_OPTIONS}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <HrTextField
                            control={form.control}
                            name="amount"
                            label="Amount you spent"
                            inputType="number"
                            placeholder="0"
                            required
                        />
                        <HrTextField
                            control={form.control}
                            name="expense_date"
                            label="Date of the expense"
                            inputType="date"
                            required
                        />
                    </div>
                    <HrTextareaField
                        control={form.control}
                        name="description"
                        label="What was it?"
                        rows={3}
                        placeholder="Cab from the airport to the campus"
                        description="Optional, but it saves your HR team asking."
                    />

                    <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                        <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                        <span>
                            Your claim goes to HR as Pending. Once approved, it is paid out with a
                            future month&apos;s salary. Keep the receipt — you may be asked for it.
                        </span>
                    </div>

                    {refusal && (
                        <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3">
                            <WarningCircle
                                size={16}
                                weight="fill"
                                className="mt-0.5 shrink-0 text-danger-600"
                            />
                            <p className="text-body text-danger-600">{refusal}</p>
                        </div>
                    )}
                </form>
            </Form>
        </MyDialog>
    );
};
