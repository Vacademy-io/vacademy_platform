import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Form } from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import type { DesignationDTO } from '@/routes/erp/-shared/hr-types';
import { useSaveDesignation } from '../-hooks/use-hr-people';
import { HrTextField, HrTextareaField } from './HrFormFields';

const designationSchema = z.object({
    name: z.string().min(1, 'Give the designation a name'),
    code: z.string(),
    level: z.string().regex(/^\d*$/, 'Use a whole number'),
    grade: z.string(),
    description: z.string(),
});

type DesignationFormValues = z.infer<typeof designationSchema>;

interface DesignationFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Present for edit, absent for create. */
    designation?: DesignationDTO | null;
}

export function DesignationFormDialog({
    open,
    onOpenChange,
    designation,
}: DesignationFormDialogProps) {
    const isEdit = !!designation?.id;
    const saveDesignation = useSaveDesignation();

    const defaults = (): DesignationFormValues => ({
        name: designation?.name ?? '',
        code: designation?.code ?? '',
        level:
            designation?.level === undefined || designation?.level === null
                ? ''
                : String(designation.level),
        grade: designation?.grade ?? '',
        description: designation?.description ?? '',
    });

    const form = useForm<DesignationFormValues>({
        resolver: zodResolver(designationSchema),
        defaultValues: defaults(),
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) form.reset(defaults());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, designation]);

    const onSubmit = async (values: DesignationFormValues) => {
        const level = values.level.trim();
        try {
            await saveDesignation.mutateAsync({
                ...(isEdit ? { id: designation?.id } : {}),
                name: values.name.trim(),
                code: values.code.trim() || undefined,
                level: level ? Number(level) : undefined,
                grade: values.grade.trim() || undefined,
                description: values.description.trim() || undefined,
            });
            toast.success(isEdit ? 'Designation updated' : 'Designation added');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-people',
                tags: { 'erp.action': isEdit ? 'update-designation' : 'create-designation' },
                extra: { designationId: designation?.id },
                fallbackMessage: 'Could not save this designation',
            });
        }
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit designation' : 'Add designation'}
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
                        {isEdit ? 'Save changes' : 'Add designation'}
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
                        placeholder="e.g. Senior Teacher"
                        required
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <HrTextField
                            control={form.control}
                            name="code"
                            label="Code"
                            placeholder="e.g. SR-TCH"
                        />
                        <HrTextField
                            control={form.control}
                            name="level"
                            label="Level"
                            placeholder="e.g. 3"
                            description="Higher means more senior."
                        />
                        <HrTextField
                            control={form.control}
                            name="grade"
                            label="Grade"
                            placeholder="e.g. L3"
                        />
                    </div>
                    <HrTextareaField
                        control={form.control}
                        name="description"
                        label="Description"
                        placeholder="What this designation covers"
                    />
                </form>
            </Form>
        </MyDialog>
    );
}
