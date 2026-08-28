import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import SelectField from '@/components/design-system/select-field';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import type { LeavePolicyDTO, LeaveTypeDTO } from '@/routes/erp/-shared/hr-types';
import { HrTextField } from '@/routes/erp/people/-components/HrFormFields';
import { useSaveLeavePolicy } from '@/routes/erp/leave/-hooks/use-leave';
import { ACCRUAL_TYPE_LABELS, ACCRUAL_TYPE_OPTIONS, RECORD_STATUS_OPTIONS } from './leave-meta';

const schema = z
    .object({
        leave_type_id: z.string().min(1, 'Pick the leave type this policy governs'),
        annual_quota: z
            .string()
            .trim()
            .min(1, 'Enter the annual quota in days')
            .regex(/^\d+(\.\d+)?$/, 'Days only, e.g. 12 or 12.5'),
        accrual_type: z.string().min(1, 'Pick how the quota is credited'),
        accrual_amount: z
            .string()
            .trim()
            .min(1, 'Enter how many days each period credits')
            .regex(/^\d+(\.\d+)?$/, 'Days only, e.g. 1 or 1.5'),
        pro_rata_enabled: z.boolean(),
        applicable_after_days: z.string().trim().regex(/^\d*$/, 'Whole days only'),
        effective_from: z.string().min(1, 'A policy needs a start date'),
        effective_to: z.string(),
        status: z.string().min(1, 'Pick a status'),
    })
    .refine(
        (values) =>
            !values.effective_to || !values.effective_from
                ? true
                : values.effective_to >= values.effective_from,
        { path: ['effective_to'], message: 'The end date cannot be before the start date' }
    );

type PolicyFormValues = z.infer<typeof schema>;

const emptyValues: PolicyFormValues = {
    leave_type_id: '',
    annual_quota: '',
    accrual_type: 'MONTHLY',
    accrual_amount: '',
    pro_rata_enabled: true,
    applicable_after_days: '',
    effective_from: '',
    effective_to: '',
    status: 'ACTIVE',
};

interface LeavePolicyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` to create; a policy to edit. */
    policy: LeavePolicyDTO | null;
    /** The institute's leave types — a policy has to attach to one. */
    leaveTypes: LeaveTypeDTO[];
}

/**
 * Add or edit one leave policy: how much of a leave type an employee gets, and
 * on what rhythm it arrives.
 *
 * Quota and accrual are two different numbers on purpose — the quota is the year's
 * entitlement, the accrual amount is what each scheduled run actually credits.
 * A 12-day annual quota accrued monthly is 1 day a month; the same quota accrued
 * yearly lands all at once in the first run of the year.
 */
export const LeavePolicyDialog = ({
    open,
    onOpenChange,
    policy,
    leaveTypes,
}: LeavePolicyDialogProps) => {
    const mutation = useSaveLeavePolicy();
    const isEdit = !!policy?.id;

    const form = useForm<PolicyFormValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!open) return;
        form.reset(
            policy
                ? {
                      leave_type_id: policy.leave_type_id ?? '',
                      annual_quota:
                          policy.annual_quota === undefined || policy.annual_quota === null
                              ? ''
                              : String(policy.annual_quota),
                      accrual_type: (policy.accrual_type || 'MONTHLY').toUpperCase(),
                      accrual_amount:
                          policy.accrual_amount === undefined || policy.accrual_amount === null
                              ? ''
                              : String(policy.accrual_amount),
                      pro_rata_enabled: policy.pro_rata_enabled ?? true,
                      applicable_after_days:
                          policy.applicable_after_days === undefined ||
                          policy.applicable_after_days === null
                              ? ''
                              : String(policy.applicable_after_days),
                      effective_from: policy.effective_from ?? '',
                      effective_to: policy.effective_to ?? '',
                      status: (policy.status || 'ACTIVE').toUpperCase(),
                  }
                : emptyValues
        );
    }, [open, policy, form]);

    const leaveTypeOptions = leaveTypes
        .filter((type) => !!type.id)
        .map((type) => ({
            _id: type.id as string,
            value: type.id as string,
            label: type.code ? `${type.name || type.code} (${type.code})` : type.name || 'Leave',
        }));

    const accrualType = form.watch('accrual_type');
    const accrualLabel = ACCRUAL_TYPE_LABELS[accrualType] ?? accrualType;

    const onSubmit = async (values: PolicyFormValues) => {
        try {
            await mutation.mutateAsync({
                ...(policy?.id ? { id: policy.id } : {}),
                leave_type_id: values.leave_type_id,
                annual_quota: Number(values.annual_quota),
                accrual_type: values.accrual_type,
                accrual_amount: Number(values.accrual_amount),
                pro_rata_enabled: values.pro_rata_enabled,
                applicable_after_days:
                    values.applicable_after_days.trim() === ''
                        ? undefined
                        : Number(values.applicable_after_days),
                effective_from: values.effective_from,
                effective_to: values.effective_to || undefined,
                status: values.status,
            });
            toast.success(isEdit ? 'Policy updated' : 'Policy created');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-leave',
                tags: { action: isEdit ? 'update-leave-policy' : 'create-leave-policy' },
                fallbackMessage: 'Could not save the leave policy.',
            });
        }
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit leave policy' : 'Add leave policy'}
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
                        {isEdit ? 'Save changes' : 'Create policy'}
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form className="flex flex-col gap-4" noValidate>
                    <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                        <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                        <span>
                            The accrual type decides how the scheduled job credits the quota:{' '}
                            <b>{accrualLabel.toLowerCase()}</b> means each run adds the accrual
                            amount to every eligible employee&apos;s balance. Pro-rata prorates a
                            mid-period joiner&apos;s first period, so someone who joins halfway
                            through a month is credited half of it rather than all of it.
                        </span>
                    </div>

                    {leaveTypeOptions.length === 0 ? (
                        <p className="text-body text-danger-600">
                            No leave types yet — create one on the Leave types tab first. A policy
                            has to attach to a type.
                        </p>
                    ) : (
                        <SelectField
                            control={form.control}
                            name="leave_type_id"
                            label="Leave type"
                            required
                            options={leaveTypeOptions}
                            className="w-full sm:w-full"
                        />
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <HrTextField
                            control={form.control}
                            name="annual_quota"
                            label="Annual quota (days)"
                            placeholder="12"
                            required
                            description="The whole year's entitlement."
                        />
                        <SelectField
                            control={form.control}
                            name="accrual_type"
                            label="Accrual type"
                            required
                            options={ACCRUAL_TYPE_OPTIONS}
                            className="w-full sm:w-full"
                        />
                        <HrTextField
                            control={form.control}
                            name="accrual_amount"
                            label="Accrual amount (days)"
                            placeholder="1"
                            required
                            description={`Credited on each ${accrualLabel.toLowerCase()} run.`}
                        />
                        <HrTextField
                            control={form.control}
                            name="applicable_after_days"
                            label="Applicable after (days of service)"
                            placeholder="90"
                            description="Blank means it applies from the joining date."
                        />
                        <HrTextField
                            control={form.control}
                            name="effective_from"
                            label="Effective from"
                            inputType="date"
                            required
                        />
                        <HrTextField
                            control={form.control}
                            name="effective_to"
                            label="Effective to"
                            inputType="date"
                            description="Blank leaves the policy open-ended."
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

                    <FormField
                        control={form.control}
                        name="pro_rata_enabled"
                        render={({ field }) => (
                            <FormItem className="flex flex-col gap-1.5">
                                <div className="flex flex-row items-center gap-2">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(checked) =>
                                                field.onChange(checked === true)
                                            }
                                        />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-body text-foreground">
                                        Pro-rata for mid-period joiners
                                    </FormLabel>
                                </div>
                                <FormDescription className="text-caption text-muted-foreground">
                                    Off means a joiner gets the full period&apos;s accrual on their
                                    first run, however few days of it they worked.
                                </FormDescription>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
