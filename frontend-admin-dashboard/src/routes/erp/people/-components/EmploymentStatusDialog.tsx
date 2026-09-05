import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import SelectField from '@/components/design-system/select-field';
import { Form } from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import type { EmployeeProfileDTO } from '@/routes/erp/-shared/hr-types';
import { useUpdateEmployeeStatus } from '../-hooks/use-hr-people';
import { EMPLOYMENT_STATUS_OPTIONS, humanizeToken, isExitStatus } from './EmployeeFields';
import { HrTextField, HrTextareaField } from './HrFormFields';

/**
 * Move an employee to a different employment status.
 *
 * The exit statuses (terminated / relieved / absconding) are the reason this is a
 * dialog and not an inline dropdown: they need a last working date and a reason,
 * both of which the full-and-final settlement is computed from. Asking for them
 * here means the F&F run later has what it needs instead of failing on it.
 */

const statusSchema = z
    .object({
        employment_status: z.string().min(1, 'Pick a status'),
        last_working_date: z.string(),
        exit_reason: z.string(),
    })
    .superRefine((values, ctx) => {
        if (!isExitStatus(values.employment_status)) return;
        if (!values.last_working_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['last_working_date'],
                message: 'A last working date is required to settle dues',
            });
        }
        if (!values.exit_reason.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['exit_reason'],
                message: 'Record why the employment ended',
            });
        }
    });

type StatusFormValues = z.infer<typeof statusSchema>;

interface EmploymentStatusDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: EmployeeProfileDTO;
}

export function EmploymentStatusDialog({
    open,
    onOpenChange,
    employee,
}: EmploymentStatusDialogProps) {
    const updateStatus = useUpdateEmployeeStatus();

    const form = useForm<StatusFormValues>({
        resolver: zodResolver(statusSchema),
        defaultValues: {
            employment_status: employee.employment_status ?? '',
            last_working_date: (employee.last_working_date ?? '').slice(0, 10),
            exit_reason: employee.exit_reason ?? '',
        },
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                employment_status: employee.employment_status ?? '',
                last_working_date: (employee.last_working_date ?? '').slice(0, 10),
                exit_reason: employee.exit_reason ?? '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, employee]);

    const selectedStatus = form.watch('employment_status');
    const exiting = isExitStatus(selectedStatus);
    const personLabel = employee.full_name || employee.employee_code || 'This employee';

    const onSubmit = async (values: StatusFormValues) => {
        if (!employee.id) return;
        try {
            await updateStatus.mutateAsync({
                id: employee.id,
                payload: {
                    employment_status: values.employment_status,
                    // Only meaningful for an exit; omitted otherwise so a
                    // correction back to ACTIVE doesn't carry a stale exit date.
                    last_working_date: exiting ? values.last_working_date : undefined,
                    exit_reason: exiting ? values.exit_reason.trim() : undefined,
                },
            });
            toast.success(
                exiting
                    ? `${personLabel} is now ${humanizeToken(values.employment_status).toLowerCase()}. Their full & final settlement can be prepared in Payroll.`
                    : `Status updated to ${humanizeToken(values.employment_status).toLowerCase()}`
            );
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-people',
                tags: { 'erp.action': 'update-employee-status' },
                extra: { employeeId: employee.id, nextStatus: values.employment_status },
                fallbackMessage: 'Could not change the employment status',
            });
        }
    };

    return (
        <MyDialog
            heading="Change employment status"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-xl"
            footer={
                <>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={form.handleSubmit(onSubmit)}
                        loadingText="Updating…"
                    >
                        Update status
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
                    <p className="text-body text-muted-foreground">
                        Currently {humanizeToken(employee.employment_status) || 'not set'} for{' '}
                        <span className="text-foreground">{personLabel}</span>.
                    </p>

                    <SelectField
                        control={form.control}
                        name="employment_status"
                        label="New status"
                        required
                        options={EMPLOYMENT_STATUS_OPTIONS}
                        className="w-full sm:w-full"
                    />

                    {exiting && (
                        <div className="flex flex-col gap-4 rounded-lg border border-warning-200 bg-warning-50 p-4">
                            <div className="flex items-start gap-2">
                                <Info size={18} className="mt-0.5 shrink-0 text-warning-600" />
                                <p className="text-caption text-warning-700">
                                    This ends the employment. The last working date and reason feed
                                    the full &amp; final settlement, so both are required.
                                </p>
                            </div>
                            <HrTextField
                                control={form.control}
                                name="last_working_date"
                                label="Last working date"
                                inputType="date"
                                required
                            />
                            <HrTextareaField
                                control={form.control}
                                name="exit_reason"
                                label="Exit reason"
                                placeholder="e.g. Resigned for a new role"
                                required
                            />
                        </div>
                    )}
                </form>
            </Form>
        </MyDialog>
    );
}
