import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Info, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Form } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import SelectField from '@/components/design-system/select-field';
import { reportApiError } from '@/lib/report-api-error';
import { HrTextField, HrTextareaField } from '@/routes/erp/people/-components/HrFormFields';
import { formatDays } from '@/routes/erp/leave/-components/leave-meta';
import type { LeaveBalanceDTO } from '@/routes/erp/-shared/hr-types';
import { useApplyForLeave, useMyLeaveTypes } from '@/routes/erp/my-hr/-hooks/use-my-hr';

const schema = z
    .object({
        leave_type_id: z.string().min(1, 'Pick the kind of leave you want'),
        from_date: z.string().min(1, 'Pick the first day'),
        to_date: z.string().min(1, 'Pick the last day'),
        is_half_day: z.boolean(),
        half_day_type: z.string(),
        reason: z.string().trim().max(500, 'Keep the reason under 500 characters'),
    })
    .refine((values) => values.to_date >= values.from_date, {
        path: ['to_date'],
        message: 'The last day cannot be before the first day',
    })
    .refine((values) => !values.is_half_day || values.from_date === values.to_date, {
        path: ['to_date'],
        message: 'A half day covers one date — set both days the same',
    });

type ApplyLeaveValues = z.infer<typeof schema>;

const emptyValues: ApplyLeaveValues = {
    leave_type_id: '',
    from_date: '',
    to_date: '',
    is_half_day: false,
    half_day_type: 'FIRST_HALF',
    reason: '',
};

interface ApplyLeaveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: string;
    /** This year's balances, used only to show what is left as the type is picked. */
    balances: LeaveBalanceDTO[];
}

/**
 * Apply for leave.
 *
 * The balance shown under the type picker is a hint, never a gate. The backend
 * re-checks the balance when the request is approved, and refuses outright when
 * payroll has locked the month — neither is knowable here, and a button disabled
 * on a stale number would block an application that would in fact have been
 * accepted. So the form always submits, and the backend's own sentence is
 * printed in the dialog rather than flashed as a toast: "You have 1.5 days of
 * Casual Leave left" is something you act on, and four seconds is not long
 * enough to read it and fix the dates.
 */
export const ApplyLeaveDialog = ({
    open,
    onOpenChange,
    employeeId,
    balances,
}: ApplyLeaveDialogProps) => {
    const typesQuery = useMyLeaveTypes();
    const mutation = useApplyForLeave();
    const [refusal, setRefusal] = useState<string | null>(null);

    const form = useForm<ApplyLeaveValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!open) return;
        form.reset(emptyValues);
        setRefusal(null);
    }, [open, form]);

    /** Only ACTIVE types — an inactive one is a leave nobody can be granted. */
    const typeOptions = useMemo(
        () =>
            (typesQuery.data ?? [])
                .filter((type) => (type.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE' && type.id)
                .map((type) => ({
                    _id: type.id as string,
                    value: type.id as string,
                    label: type.name || type.code || 'Leave',
                })),
        [typesQuery.data]
    );

    const selectedTypeId = form.watch('leave_type_id');
    const isHalfDay = form.watch('is_half_day');

    const selectedBalance = useMemo(
        () => balances.find((balance) => balance.leave_type_id === selectedTypeId),
        [balances, selectedTypeId]
    );

    const submit = form.handleSubmit(async (values) => {
        setRefusal(null);
        try {
            await mutation.mutateAsync({
                employee_id: employeeId,
                leave_type_id: values.leave_type_id,
                from_date: values.from_date,
                to_date: values.to_date,
                is_half_day: values.is_half_day,
                ...(values.is_half_day ? { half_day_type: values.half_day_type } : {}),
                ...(values.reason.trim() ? { reason: values.reason.trim() } : {}),
            });
            toast.success('Leave applied for — your approver has it now');
            onOpenChange(false);
        } catch (error) {
            setRefusal(
                reportApiError(error, {
                    feature: 'erp-my-hr',
                    tags: { action: 'apply-leave' },
                    fallbackMessage: 'Could not send your leave application.',
                    showToast: false,
                })
            );
        }
    });

    return (
        <MyDialog
            heading="Apply for leave"
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
                        loadingText="Sending…"
                    >
                        Send application
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form className="flex flex-col gap-4" noValidate>
                    <SelectField
                        control={form.control}
                        name="leave_type_id"
                        label="Kind of leave"
                        required
                        className="w-full sm:w-full"
                        options={typeOptions}
                    />
                    {typesQuery.isLoading && (
                        <p className="text-caption text-muted-foreground">
                            Loading the leave types your institute offers…
                        </p>
                    )}
                    {!typesQuery.isLoading && typeOptions.length === 0 && (
                        <p className="text-caption text-warning-700">
                            Your institute has not set up any leave types yet, so there is nothing
                            to apply for. Ask your HR team.
                        </p>
                    )}
                    {selectedBalance && (
                        <p className="text-caption text-muted-foreground">
                            You have {formatDays(selectedBalance.closing_balance)} day(s) of{' '}
                            {selectedBalance.leave_type_name || 'this leave'} left. Your balance is
                            checked again when someone approves this.
                        </p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <HrTextField
                            control={form.control}
                            name="from_date"
                            label="First day"
                            inputType="date"
                            required
                        />
                        <HrTextField
                            control={form.control}
                            name="to_date"
                            label="Last day"
                            inputType="date"
                            required
                        />
                    </div>

                    <label className="flex items-center gap-2">
                        <Checkbox
                            checked={isHalfDay}
                            onCheckedChange={(checked) =>
                                form.setValue('is_half_day', checked === true, {
                                    shouldValidate: true,
                                })
                            }
                        />
                        <span className="text-body text-foreground">This is only half a day</span>
                    </label>

                    {isHalfDay && (
                        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                            <span className="text-caption text-muted-foreground">
                                Which half are you taking off?
                            </span>
                            <RadioGroup
                                value={form.watch('half_day_type')}
                                onValueChange={(value) => form.setValue('half_day_type', value)}
                                className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                            >
                                <label className="flex items-center gap-2">
                                    <RadioGroupItem value="FIRST_HALF" />
                                    <span className="text-body text-foreground">
                                        First half (morning)
                                    </span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <RadioGroupItem value="SECOND_HALF" />
                                    <span className="text-body text-foreground">
                                        Second half (afternoon)
                                    </span>
                                </label>
                            </RadioGroup>
                        </div>
                    )}

                    <HrTextareaField
                        control={form.control}
                        name="reason"
                        label="Reason"
                        rows={3}
                        placeholder="Anything your approver should know"
                        description="Optional, but it tends to get answered faster."
                    />

                    <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                        <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                        <span>
                            Your application goes to your approver as Pending. The days only leave
                            your balance once it is approved, and you can cancel it before then.
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
