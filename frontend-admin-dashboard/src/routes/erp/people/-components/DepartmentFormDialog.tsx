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
import type { DepartmentDTO } from '@/routes/erp/-shared/hr-types';
import { useSaveDepartment } from '../-hooks/use-hr-people';
import { NONE_VALUE, type SelectOption } from './EmployeeFields';
import { HrTextField, HrTextareaField } from './HrFormFields';

const departmentSchema = z.object({
    name: z.string().min(1, 'Give the department a name'),
    code: z.string(),
    parent_id: z.string(),
    description: z.string(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

interface DepartmentFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Present for edit, absent for create. */
    department?: DepartmentDTO | null;
    /** All departments — used to offer a parent, minus the one being edited. */
    departments: DepartmentDTO[];
}

export function DepartmentFormDialog({
    open,
    onOpenChange,
    department,
    departments,
}: DepartmentFormDialogProps) {
    const isEdit = !!department?.id;
    const saveDepartment = useSaveDepartment();

    const form = useForm<DepartmentFormValues>({
        resolver: zodResolver(departmentSchema),
        defaultValues: {
            name: department?.name ?? '',
            code: department?.code ?? '',
            parent_id: department?.parent_id || NONE_VALUE,
            description: department?.description ?? '',
        },
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: department?.name ?? '',
                code: department?.code ?? '',
                parent_id: department?.parent_id || NONE_VALUE,
                description: department?.description ?? '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, department]);

    // A department cannot be its own parent, and offering it would create a cycle.
    const parentOptions = useMemo<SelectOption[]>(
        () => [
            { _id: NONE_VALUE, value: NONE_VALUE, label: 'No parent (top level)' },
            ...departments
                .filter((row) => !!row.id && row.id !== department?.id)
                .map((row) => ({
                    _id: row.id as string,
                    value: row.id as string,
                    label: row.name || (row.id as string),
                })),
        ],
        [departments, department?.id]
    );

    const onSubmit = async (values: DepartmentFormValues) => {
        try {
            await saveDepartment.mutateAsync({
                ...(isEdit ? { id: department?.id } : {}),
                name: values.name.trim(),
                code: values.code.trim() || undefined,
                parent_id: values.parent_id === NONE_VALUE ? undefined : values.parent_id,
                description: values.description.trim() || undefined,
            });
            toast.success(isEdit ? 'Department updated' : 'Department added');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-people',
                tags: { 'erp.action': isEdit ? 'update-department' : 'create-department' },
                extra: { departmentId: department?.id },
                fallbackMessage: 'Could not save this department',
            });
        }
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit department' : 'Add department'}
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
                        loadingText="Saving…"
                    >
                        {isEdit ? 'Save changes' : 'Add department'}
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
                    <HrTextField
                        control={form.control}
                        name="name"
                        label="Name"
                        placeholder="e.g. Academics"
                        required
                    />
                    <HrTextField
                        control={form.control}
                        name="code"
                        label="Code"
                        placeholder="e.g. ACAD"
                        description="Short code used in reports and payroll exports."
                    />
                    <SelectField
                        control={form.control}
                        name="parent_id"
                        label="Parent department"
                        options={parentOptions}
                        className="w-full sm:w-full"
                    />
                    <HrTextareaField
                        control={form.control}
                        name="description"
                        label="Description"
                        placeholder="What this department is responsible for"
                    />
                </form>
            </Form>
        </MyDialog>
    );
}
