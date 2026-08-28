import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import SelectField from '@/components/design-system/select-field';
import { Form } from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import type { DepartmentDTO, DesignationDTO, StaffBridgeRow } from '@/routes/erp/-shared/hr-types';
import { useCreateEmployeeFromStaff } from '../-hooks/use-hr-people';
import { NONE_VALUE, toSelectOptions } from './EmployeeFields';
import { HrTextField } from './HrFormFields';

/**
 * Turn someone already on the team into an HR employee.
 *
 * This is the short path: the user id, name and email come from the staff row, so
 * the dialog only asks for the few things HR adds on top. Join date defaults to
 * today because the common case is "we are onboarding HR now", not backfilling.
 */

const staffProfileSchema = z.object({
    employee_code: z.string(),
    join_date: z.string().min(1, 'Pick the joining date'),
    department_id: z.string(),
    designation_id: z.string(),
});

type StaffProfileFormValues = z.infer<typeof staffProfileSchema>;

const today = (): string => new Date().toISOString().slice(0, 10);

interface StaffProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staff: StaffBridgeRow;
    departments: DepartmentDTO[];
    designations: DesignationDTO[];
}

export function StaffProfileDialog({
    open,
    onOpenChange,
    staff,
    departments,
    designations,
}: StaffProfileDialogProps) {
    const createFromStaff = useCreateEmployeeFromStaff();

    const form = useForm<StaffProfileFormValues>({
        resolver: zodResolver(staffProfileSchema),
        defaultValues: {
            employee_code: '',
            join_date: today(),
            department_id: NONE_VALUE,
            designation_id: NONE_VALUE,
        },
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                employee_code: '',
                join_date: today(),
                department_id: NONE_VALUE,
                designation_id: NONE_VALUE,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, staff.user_id]);

    const departmentOptions = useMemo(
        () => toSelectOptions(departments, 'No department'),
        [departments]
    );
    const designationOptions = useMemo(
        () => toSelectOptions(designations, 'No designation'),
        [designations]
    );

    const personLabel = staff.full_name || staff.email || 'this person';

    const onSubmit = async (values: StaffProfileFormValues) => {
        if (!staff.user_id) return;
        try {
            await createFromStaff.mutateAsync({
                user_id: staff.user_id,
                employee_code: values.employee_code.trim() || undefined,
                join_date: values.join_date,
                department_id:
                    values.department_id === NONE_VALUE ? undefined : values.department_id,
                designation_id:
                    values.designation_id === NONE_VALUE ? undefined : values.designation_id,
            });
            toast.success(`HR profile created for ${personLabel}`);
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-people',
                tags: { 'erp.action': 'create-employee-from-staff' },
                extra: { userId: staff.user_id },
                fallbackMessage: `Could not create an HR profile for ${personLabel}`,
            });
        }
    };

    return (
        <MyDialog
            heading="Create HR profile"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
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
                        loadingText="Creating…"
                    >
                        Create profile
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
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted p-3">
                        <span className="text-body text-foreground">{personLabel}</span>
                        {staff.email && (
                            <span className="text-caption text-muted-foreground">
                                {staff.email}
                            </span>
                        )}
                    </div>

                    <HrTextField
                        control={form.control}
                        name="employee_code"
                        label="Employee code"
                        placeholder="Leave blank to let HR assign one"
                    />
                    <HrTextField
                        control={form.control}
                        name="join_date"
                        label="Join date"
                        inputType="date"
                        required
                    />
                    <SelectField
                        control={form.control}
                        name="department_id"
                        label="Department"
                        options={departmentOptions}
                        className="w-full sm:w-full"
                    />
                    <SelectField
                        control={form.control}
                        name="designation_id"
                        label="Designation"
                        options={designationOptions}
                        className="w-full sm:w-full"
                    />
                </form>
            </Form>
        </MyDialog>
    );
}
