import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { formatMonthValue, type MonthValue } from '@/components/design-system/month-picker';
import SelectField from '@/components/design-system/select-field';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { reportApiError } from '@/lib/report-api-error';
import { EmployeePicker } from '@/routes/erp/-shared/EmployeePicker';
import { createAdjustment, hrKeys } from '@/routes/erp/-shared/hr-service';
import { ADJUSTMENT_TYPE_OPTIONS, CURRENCY_OPTIONS, RUN_SCOPE_OPTIONS } from './adjustment-meta';

const schema = z.object({
    employee_id: z.string().min(1, 'Pick an employee'),
    type: z.enum(['EARNING', 'DEDUCTION']),
    code: z
        .string()
        .trim()
        .min(2, 'Codes are at least 2 characters')
        .regex(
            /^[A-Z0-9_]+$/,
            'Uppercase letters, digits and underscores only — no spaces (e.g. INCENTIVE, ARREARS)'
        ),
    label: z.string().trim().min(1, 'Give it a label the employee will recognise'),
    amount: z
        .string()
        .min(1, 'Enter the amount')
        .refine(
            (value) => Number.isFinite(Number(value)) && Number(value) > 0,
            'Enter an amount above zero'
        ),
    currency: z.enum(['INR', 'AED', 'SAR']),
    run_scope: z.enum(['REGULAR', 'OFF_CYCLE', 'FNF', 'BONUS']),
    notes: z.string().trim().max(500, 'Keep the notes under 500 characters'),
});

type AdjustmentFormValues = z.infer<typeof schema>;

const defaultValues: AdjustmentFormValues = {
    employee_id: '',
    type: 'EARNING',
    code: '',
    label: '',
    amount: '',
    currency: 'INR',
    run_scope: 'REGULAR',
    notes: '',
};

interface AdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The month the table is showing — the adjustment is stamped with it. */
    month: MonthValue;
}

/**
 * Record one adjustment against the month currently in view.
 *
 * The month is taken from the page rather than asked for again: an adjustment
 * entered while looking at August that silently lands in September is the
 * failure mode of a second date control here.
 */
export const AdjustmentDialog = ({ open, onOpenChange, month }: AdjustmentDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(schema),
        defaultValues,
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) form.reset(defaultValues);
    }, [open, form]);

    const mutation = useMutation({
        mutationFn: createAdjustment,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: hrKeys.adjustments(month.year, month.month),
            });
            toast.success('Adjustment added');
            onOpenChange(false);
        },
        onError: (error) => {
            reportApiError(error, {
                feature: 'erp-adjustments',
                tags: { action: 'create-adjustment' },
                fallbackMessage: 'Could not add the adjustment.',
            });
        },
    });

    const onSubmit = async (values: AdjustmentFormValues) => {
        await mutation.mutateAsync({
            employee_id: values.employee_id,
            month: month.month,
            year: month.year,
            type: values.type,
            code: values.code.toUpperCase(),
            label: values.label,
            amount: Number(values.amount),
            currency: values.currency,
            run_scope: values.run_scope,
            notes: values.notes || undefined,
        });
    };

    return (
        <MyDialog
            heading={`Add adjustment — ${formatMonthValue(month)}`}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-2xl"
            footer={
                <>
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
                        onAsyncClick={form.handleSubmit(onSubmit)}
                        loadingText="Adding…"
                    >
                        Add adjustment
                    </MyButton>
                </>
            }
        >
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-4"
                    noValidate
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="employee_id"
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Employee</FormLabel>
                                    <FormControl>
                                        <EmployeePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            portal={false}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <SelectField
                            control={form.control}
                            name="type"
                            label="Type"
                            required
                            options={ADJUSTMENT_TYPE_OPTIONS}
                            className="w-full sm:w-full"
                        />

                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Code</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="INCENTIVE"
                                            className="w-full font-mono sm:w-full"
                                            required
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(
                                                    event.target.value
                                                        .toUpperCase()
                                                        .replace(/\s+/g, '_')
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription className="text-caption text-neutral-500">
                                        Becomes the payslip line&apos;s component code.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="label"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Label</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="Q2 performance incentive"
                                            className="w-full sm:w-full"
                                            required
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(event.target.value)
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription className="text-caption text-neutral-500">
                                        What the employee sees on their payslip.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="number"
                                            inputPlaceholder="5000"
                                            className="w-full sm:w-full"
                                            required
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(event.target.value)
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription className="text-caption text-neutral-500">
                                        Always a positive number — the type decides the direction.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <SelectField
                            control={form.control}
                            name="currency"
                            label="Currency"
                            required
                            options={CURRENCY_OPTIONS}
                            className="w-full sm:w-full"
                        />

                        <SelectField
                            control={form.control}
                            name="run_scope"
                            label="Run scope"
                            required
                            options={RUN_SCOPE_OPTIONS}
                            className="w-full sm:w-full"
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        placeholder="Internal context — why this was granted or recovered."
                                        className="text-body"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
