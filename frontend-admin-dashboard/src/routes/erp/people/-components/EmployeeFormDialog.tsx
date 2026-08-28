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
import type {
    DepartmentDTO,
    DesignationDTO,
    EmployeeProfileDTO,
} from '@/routes/erp/-shared/hr-types';
import { useCreateEmployee, useEmployeeOptions, useUpdateEmployee } from '../-hooks/use-hr-people';
import {
    EMPLOYMENT_TYPE_OPTIONS,
    NONE_VALUE,
    UNCHANGED_PLACEHOLDER,
    isMaskedValue,
    toSelectOptions,
    type SelectOption,
} from './EmployeeFields';
import { HrTextField } from './HrFormFields';

/**
 * Create or edit an employee profile.
 *
 * Every field is a string in the form and normalized on submit: a select left at
 * "None" and a text box left blank are both omitted from the payload rather than
 * sent as empty values, so a partially filled form never clears data the backend
 * already holds.
 */

const employeeSchema = z.object({
    user_id: z.string(),
    employee_code: z.string(),
    join_date: z.string().min(1, 'Pick the joining date'),
    department_id: z.string(),
    designation_id: z.string(),
    reporting_manager_id: z.string(),
    employment_type: z.string(),
    notice_period_days: z.string().regex(/^\d*$/, 'Use a whole number of days'),
    nationality: z.string(),
    emergency_contact_name: z.string(),
    emergency_contact_phone: z.string(),
    emergency_contact_relation: z.string(),
    pan_number: z.string(),
    uan_number: z.string(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

/** `user_id` links the profile to a platform user; it can only be set at creation. */
const buildSchema = (isEdit: boolean) =>
    employeeSchema.superRefine((values, ctx) => {
        if (!isEdit && !values.user_id.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['user_id'],
                message: 'A user id is required to link this profile to a person',
            });
        }
    });

const EMPTY_VALUES: EmployeeFormValues = {
    user_id: '',
    employee_code: '',
    join_date: '',
    department_id: NONE_VALUE,
    designation_id: NONE_VALUE,
    reporting_manager_id: NONE_VALUE,
    employment_type: NONE_VALUE,
    notice_period_days: '',
    nationality: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    pan_number: '',
    uan_number: '',
};

/** A masked value must never be echoed back, so it starts blank with an "unchanged" placeholder. */
const initialMaskable = (value: string | undefined): string =>
    isMaskedValue(value) ? '' : value ?? '';

const toFormValues = (employee: EmployeeProfileDTO | null | undefined): EmployeeFormValues => {
    if (!employee) return EMPTY_VALUES;
    return {
        user_id: employee.user_id ?? '',
        employee_code: employee.employee_code ?? '',
        join_date: (employee.join_date ?? '').slice(0, 10),
        department_id: employee.department_id || NONE_VALUE,
        designation_id: employee.designation_id || NONE_VALUE,
        reporting_manager_id: employee.reporting_manager_id || NONE_VALUE,
        employment_type: employee.employment_type || NONE_VALUE,
        notice_period_days:
            employee.notice_period_days === undefined || employee.notice_period_days === null
                ? ''
                : String(employee.notice_period_days),
        nationality: employee.nationality ?? '',
        emergency_contact_name: employee.emergency_contact_name ?? '',
        emergency_contact_phone: employee.emergency_contact_phone ?? '',
        emergency_contact_relation: employee.emergency_contact_relation ?? '',
        pan_number: initialMaskable(employee.pan_number),
        uan_number: initialMaskable(employee.uan_number),
    };
};

const textOrOmit = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};

const selectOrOmit = (value: string): string | undefined =>
    value && value !== NONE_VALUE ? value : undefined;

/**
 * A field whose stored value is masked on read. Blank means "leave it alone" — the
 * key is omitted entirely, because sending `****1234` back would persist the mask.
 */
const maskableOrOmit = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed || isMaskedValue(trimmed)) return undefined;
    return trimmed.toUpperCase();
};

interface EmployeeFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Present for edit, absent for create. */
    employee?: EmployeeProfileDTO | null;
    departments: DepartmentDTO[];
    designations: DesignationDTO[];
    onSaved?: () => void;
}

export function EmployeeFormDialog({
    open,
    onOpenChange,
    employee,
    departments,
    designations,
    onSaved,
}: EmployeeFormDialogProps) {
    const isEdit = !!employee?.id;
    const createEmployee = useCreateEmployee();
    const updateEmployee = useUpdateEmployee();

    // The manager list is only needed while the dialog is open.
    const managerQuery = useEmployeeOptions(open);

    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(buildSchema(isEdit)),
        defaultValues: toFormValues(employee),
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) form.reset(toFormValues(employee));
        // `form` is stable across renders; resetting on open keeps a reopened dialog honest.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, employee]);

    const departmentOptions = useMemo(
        () => toSelectOptions(departments, 'No department'),
        [departments]
    );
    const designationOptions = useMemo(
        () => toSelectOptions(designations, 'No designation'),
        [designations]
    );
    const managerOptions = useMemo<SelectOption[]>(() => {
        const rows = (managerQuery.data?.content ?? []).filter(
            (row) => !!row.id && row.id !== employee?.id
        );
        return [
            { _id: NONE_VALUE, value: NONE_VALUE, label: 'No reporting manager' },
            ...rows.map((row) => ({
                _id: row.id as string,
                value: row.id as string,
                label: row.full_name || row.employee_code || (row.id as string),
            })),
        ];
    }, [managerQuery.data, employee?.id]);

    const employmentTypeOptions = useMemo<SelectOption[]>(
        () => [
            { _id: NONE_VALUE, value: NONE_VALUE, label: 'Not set' },
            ...EMPLOYMENT_TYPE_OPTIONS,
        ],
        []
    );

    const panMasked = isEdit && isMaskedValue(employee?.pan_number);
    const uanMasked = isEdit && isMaskedValue(employee?.uan_number);

    const buildPayload = (values: EmployeeFormValues): EmployeeProfileDTO => {
        const noticeDays = values.notice_period_days.trim();
        return {
            ...(isEdit ? { id: employee?.id, user_id: employee?.user_id } : {}),
            ...(isEdit ? {} : { user_id: values.user_id.trim() }),
            employee_code: textOrOmit(values.employee_code),
            join_date: values.join_date,
            department_id: selectOrOmit(values.department_id),
            designation_id: selectOrOmit(values.designation_id),
            reporting_manager_id: selectOrOmit(values.reporting_manager_id),
            employment_type: selectOrOmit(values.employment_type),
            notice_period_days: noticeDays ? Number(noticeDays) : undefined,
            nationality: textOrOmit(values.nationality),
            emergency_contact_name: textOrOmit(values.emergency_contact_name),
            emergency_contact_phone: textOrOmit(values.emergency_contact_phone),
            emergency_contact_relation: textOrOmit(values.emergency_contact_relation),
            pan_number: maskableOrOmit(values.pan_number),
            uan_number: maskableOrOmit(values.uan_number),
        };
    };

    const onSubmit = async (values: EmployeeFormValues) => {
        const payload = buildPayload(values);
        try {
            if (isEdit && employee?.id) {
                await updateEmployee.mutateAsync({ id: employee.id, payload });
                toast.success('Employee profile updated');
            } else {
                await createEmployee.mutateAsync(payload);
                toast.success('Employee added');
            }
            onSaved?.();
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-people',
                tags: { 'erp.action': isEdit ? 'update-employee' : 'create-employee' },
                extra: { employeeId: employee?.id },
                fallbackMessage: isEdit
                    ? 'Could not update this employee profile'
                    : 'Could not add this employee',
            });
        }
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit employee' : 'Add employee'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-3xl"
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
                        loadingText={isEdit ? 'Saving…' : 'Adding…'}
                    >
                        {isEdit ? 'Save changes' : 'Add employee'}
                    </MyButton>
                </>
            }
        >
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-6"
                    noValidate
                >
                    <section className="flex flex-col gap-4">
                        <h3 className="text-subtitle text-foreground">Who this profile is for</h3>
                        {!isEdit && (
                            <HrTextField
                                control={form.control}
                                name="user_id"
                                label="User id"
                                placeholder="Platform user id"
                                required
                                description="Easier path: open Staff Coverage and create the HR profile straight from someone already on your team — it fills the user id in for you."
                            />
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <HrTextField
                                control={form.control}
                                name="employee_code"
                                label="Employee code"
                                placeholder="e.g. EMP-014"
                            />
                            <HrTextField
                                control={form.control}
                                name="join_date"
                                label="Join date"
                                inputType="date"
                                required
                            />
                        </div>
                    </section>

                    <section className="flex flex-col gap-4">
                        <h3 className="text-subtitle text-foreground">Role in the organisation</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
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
                            <SelectField
                                control={form.control}
                                name="reporting_manager_id"
                                label="Reporting manager"
                                options={managerOptions}
                                className="w-full sm:w-full"
                            />
                            <SelectField
                                control={form.control}
                                name="employment_type"
                                label="Employment type"
                                options={employmentTypeOptions}
                                className="w-full sm:w-full"
                            />
                            <HrTextField
                                control={form.control}
                                name="notice_period_days"
                                label="Notice period (days)"
                                placeholder="e.g. 30"
                            />
                            <HrTextField
                                control={form.control}
                                name="nationality"
                                label="Nationality"
                                placeholder="e.g. Indian"
                            />
                        </div>
                    </section>

                    <section className="flex flex-col gap-4">
                        <h3 className="text-subtitle text-foreground">Emergency contact</h3>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <HrTextField
                                control={form.control}
                                name="emergency_contact_name"
                                label="Name"
                                placeholder="Contact name"
                            />
                            <HrTextField
                                control={form.control}
                                name="emergency_contact_phone"
                                label="Phone"
                                inputType="tel"
                                placeholder="Contact number"
                            />
                            <HrTextField
                                control={form.control}
                                name="emergency_contact_relation"
                                label="Relation"
                                placeholder="e.g. Spouse"
                            />
                        </div>
                    </section>

                    <section className="flex flex-col gap-4">
                        <h3 className="text-subtitle text-foreground">Statutory identifiers</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <HrTextField
                                control={form.control}
                                name="pan_number"
                                label="PAN"
                                placeholder={panMasked ? UNCHANGED_PLACEHOLDER : 'e.g. ABCDE1234F'}
                                description={
                                    panMasked
                                        ? 'The stored number is hidden. Leave this blank to keep it.'
                                        : undefined
                                }
                            />
                            <HrTextField
                                control={form.control}
                                name="uan_number"
                                label="UAN"
                                placeholder={
                                    uanMasked ? UNCHANGED_PLACEHOLDER : 'Provident fund UAN'
                                }
                                description={
                                    uanMasked
                                        ? 'The stored number is hidden. Leave this blank to keep it.'
                                        : undefined
                                }
                            />
                        </div>
                    </section>
                </form>
            </Form>
        </MyDialog>
    );
}
