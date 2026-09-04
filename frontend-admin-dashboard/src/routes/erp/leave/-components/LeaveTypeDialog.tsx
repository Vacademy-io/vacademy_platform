import { useEffect } from 'react';
import { useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import SelectField from '@/components/design-system/select-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import type { LeaveTypeDTO } from '@/routes/erp/-shared/hr-types';
import { HrTextField, HrTextareaField } from '@/routes/erp/people/-components/HrFormFields';
import { useSaveLeaveType } from '@/routes/erp/leave/-hooks/use-leave';
import { GENDER_OPTIONS, RECORD_STATUS_OPTIONS } from './leave-meta';

const decimalDays = (label: string) =>
    z
        .string()
        .trim()
        .regex(/^\d*(\.\d+)?$/, `${label} must be a positive number of days`);

const wholeDays = (label: string) =>
    z.string().trim().regex(/^\d*$/, `${label} must be a whole number of days`);

const schema = z.object({
    name: z.string().trim().min(1, 'Give the leave type a name'),
    code: z
        .string()
        .trim()
        .min(2, 'Codes are at least 2 characters')
        .regex(
            /^[A-Z0-9_]+$/,
            'Uppercase letters, digits and underscores only — no spaces (e.g. CASUAL, SICK, COMP_OFF)'
        ),
    is_paid: z.boolean(),
    is_carry_forward: z.boolean(),
    max_carry_forward: wholeDays('Carry-forward cap'),
    is_encashable: z.boolean(),
    requires_document: z.boolean(),
    min_days: decimalDays('Minimum days'),
    max_consecutive_days: wholeDays('Maximum consecutive days'),
    applicable_gender: z.string().min(1, 'Pick who this applies to'),
    status: z.string().min(1, 'Pick a status'),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
});

type LeaveTypeFormValues = z.infer<typeof schema>;

const emptyValues: LeaveTypeFormValues = {
    name: '',
    code: '',
    is_paid: true,
    is_carry_forward: false,
    max_carry_forward: '',
    is_encashable: false,
    requires_document: false,
    min_days: '',
    max_consecutive_days: '',
    applicable_gender: 'ALL',
    status: 'ACTIVE',
    description: '',
};

const numberOrUndefined = (value: string): number | undefined =>
    value.trim() === '' ? undefined : Number(value);

interface LeaveTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` to create; a leave type to edit. */
    leaveType: LeaveTypeDTO | null;
    /** Uppercase codes already in use, so a duplicate is caught before the round trip. */
    existingCodes: string[];
}

const CheckboxField = ({
    control,
    name,
    label,
}: {
    control: Control<LeaveTypeFormValues>;
    name: 'is_paid' | 'is_carry_forward' | 'is_encashable' | 'requires_document';
    label: string;
}) => (
    <FormField
        control={control}
        name={name}
        render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                    <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                </FormControl>
                <FormLabel className="!mt-0 text-body text-foreground">{label}</FormLabel>
            </FormItem>
        )}
    />
);

/**
 * Add or edit one leave type — the kind of leave, not how much of it anyone gets.
 * The quota lives on the policy, so a type can outlive several policies without
 * the rules of the leave itself changing.
 */
export const LeaveTypeDialog = ({
    open,
    onOpenChange,
    leaveType,
    existingCodes,
}: LeaveTypeDialogProps) => {
    const mutation = useSaveLeaveType();
    const isEdit = !!leaveType?.id;

    const form = useForm<LeaveTypeFormValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!open) return;
        form.reset(
            leaveType
                ? {
                      name: leaveType.name ?? '',
                      code: (leaveType.code ?? '').toUpperCase(),
                      is_paid: leaveType.is_paid ?? true,
                      is_carry_forward: leaveType.is_carry_forward ?? false,
                      max_carry_forward:
                          leaveType.max_carry_forward === undefined ||
                          leaveType.max_carry_forward === null
                              ? ''
                              : String(leaveType.max_carry_forward),
                      is_encashable: leaveType.is_encashable ?? false,
                      requires_document: leaveType.requires_document ?? false,
                      min_days:
                          leaveType.min_days === undefined || leaveType.min_days === null
                              ? ''
                              : String(leaveType.min_days),
                      max_consecutive_days:
                          leaveType.max_consecutive_days === undefined ||
                          leaveType.max_consecutive_days === null
                              ? ''
                              : String(leaveType.max_consecutive_days),
                      applicable_gender: (leaveType.applicable_gender || 'ALL').toUpperCase(),
                      status: (leaveType.status || 'ACTIVE').toUpperCase(),
                      description: leaveType.description ?? '',
                  }
                : emptyValues
        );
    }, [open, leaveType, form]);

    const carryForward = form.watch('is_carry_forward');
    const isPaid = form.watch('is_paid');

    const onSubmit = async (values: LeaveTypeFormValues) => {
        const code = values.code.toUpperCase();
        const clash = existingCodes.some(
            (existing) => existing === code && code !== (leaveType?.code ?? '').toUpperCase()
        );
        if (clash) {
            form.setError('code', { message: 'Another leave type already uses this code' });
            return;
        }

        try {
            await mutation.mutateAsync({
                ...(leaveType?.id ? { id: leaveType.id } : {}),
                name: values.name,
                code,
                is_paid: values.is_paid,
                is_carry_forward: values.is_carry_forward,
                max_carry_forward: values.is_carry_forward
                    ? numberOrUndefined(values.max_carry_forward)
                    : undefined,
                is_encashable: values.is_encashable,
                requires_document: values.requires_document,
                min_days: numberOrUndefined(values.min_days),
                max_consecutive_days: numberOrUndefined(values.max_consecutive_days),
                applicable_gender: values.applicable_gender,
                status: values.status,
                description: values.description || undefined,
            });
            toast.success(isEdit ? 'Leave type updated' : 'Leave type created');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-leave',
                tags: { action: isEdit ? 'update-leave-type' : 'create-leave-type' },
                fallbackMessage: 'Could not save the leave type.',
            });
        }
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit leave type' : 'Add leave type'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-2xl"
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
                        loadingText="Saving…"
                    >
                        {isEdit ? 'Save changes' : 'Create leave type'}
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form className="flex flex-col gap-4" noValidate>
                    <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                        <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                        <span>
                            {isPaid
                                ? 'A paid type draws on a balance, so it needs a policy to give employees a quota.'
                                : 'An unpaid type is treated as loss of pay by payroll: the days are deducted from salary and no balance is needed, so it does not require a policy.'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <HrTextField
                            control={form.control}
                            name="name"
                            label="Name"
                            placeholder="Casual leave"
                            required
                        />
                        <HrTextField
                            control={form.control}
                            name="code"
                            label="Code"
                            placeholder="CASUAL"
                            required
                            description="Identifier used by policies, balances and payroll."
                        />
                        <HrTextField
                            control={form.control}
                            name="min_days"
                            label="Minimum days per application"
                            placeholder="0.5"
                            description="0.5 lets employees take a half day."
                        />
                        <HrTextField
                            control={form.control}
                            name="max_consecutive_days"
                            label="Maximum consecutive days"
                            placeholder="5"
                            description="Leave blank for no limit."
                        />
                        <SelectField
                            control={form.control}
                            name="applicable_gender"
                            label="Applicable to"
                            required
                            options={GENDER_OPTIONS}
                            className="w-full sm:w-full"
                        />
                        <SelectField
                            control={form.control}
                            name="status"
                            label="Status"
                            required
                            options={RECORD_STATUS_OPTIONS}
                            className="w-full sm:w-full"
                        />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
                        <CheckboxField control={form.control} name="is_paid" label="Paid leave" />
                        <CheckboxField
                            control={form.control}
                            name="is_carry_forward"
                            label="Carries forward"
                        />
                        <CheckboxField
                            control={form.control}
                            name="is_encashable"
                            label="Encashable"
                        />
                        <CheckboxField
                            control={form.control}
                            name="requires_document"
                            label="Requires a document"
                        />
                    </div>

                    {carryForward && (
                        <HrTextField
                            control={form.control}
                            name="max_carry_forward"
                            label="Maximum days carried forward"
                            placeholder="10"
                            description="The most the year-end process will carry into the next year. Anything above it lapses, or is encashed when the type is encashable."
                        />
                    )}

                    <HrTextareaField
                        control={form.control}
                        name="description"
                        label="Description"
                        rows={2}
                        placeholder="When employees should use this leave, so the next admin doesn't have to guess."
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
