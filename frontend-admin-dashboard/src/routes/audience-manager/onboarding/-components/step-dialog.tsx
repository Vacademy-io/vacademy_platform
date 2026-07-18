/**
 * StepDialog — add/edit an onboarding flow step (v1: FORM steps only).
 *
 * On edit, the step's attached fields are re-fetched via
 * GET .../common/custom-fields/feature-fields?type=ONBOARDING_STEP — the
 * step's own GET/PUT responses never echo `fields`. Per-field role_access
 * ISN'T independently fetchable from that endpoint either (see the gap noted
 * in onboarding-service.ts), so editing a step always re-defaults every
 * field's role access to ADMIN(view+edit)/STUDENT(view)/PARENT(none) and
 * relies on the admin re-confirming it — the PUT always resends the FULL
 * field + role_access list per the backend's "replace entirely" contract.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RoleAccessGrid } from './role-access-grid';
import { StepFieldConfigEditor, newFieldRowFromCatalog, type FieldRow } from './step-field-config-editor';
import { StepWorkflowTriggersCard } from './step-workflow-triggers-card';
import { MultiSelect } from '@/components/design-system/multi-select';
import {
    createOnboardingStep,
    updateOnboardingStep,
    fetchStepFields,
    fetchInstituteCustomFieldCatalog,
    defaultRoleAccess,
    onboardingStepFieldsKey,
    fetchPackageSessionPoolOptions,
    type OnboardingStepDTO,
    type OnboardingRoleAccess,
} from '../-services/onboarding-service';

const stepSchema = z.object({
    step_name: z.string().min(1, 'Step name is required').max(150, 'Keep it under 150 characters'),
    is_optional: z.boolean(),
    grants_student_role: z.boolean(),
    sends_login_credentials: z.boolean(),
    create_student: z.boolean(),
});

type StepForm = z.infer<typeof stepSchema>;

interface StepDialogProps {
    instituteId: string;
    flowId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Present → editing this step. Absent → creating a new one. */
    editingStep?: OnboardingStepDTO | null;
    /** Where a newly-created step should land (end of list). */
    nextStepOrder: number;
    onSaved: () => void;
}

export function StepDialog({
    instituteId,
    flowId,
    open,
    onOpenChange,
    editingStep,
    nextStepOrder,
    onSaved,
}: StepDialogProps) {
    const queryClient = useQueryClient();
    const isEditing = !!editingStep;

    const form = useForm<StepForm>({
        resolver: zodResolver(stepSchema),
        defaultValues: {
            step_name: '',
            is_optional: true,
            grants_student_role: false,
            sends_login_credentials: false,
            create_student: false,
        },
    });

    const [fieldRows, setFieldRows] = useState<FieldRow[]>([]);
    const [roleAccess, setRoleAccess] = useState<OnboardingRoleAccess[]>(defaultRoleAccess());
    // The course POOL for "create student from this step" — empty means the
    // completing admin picks ANY course at onboarding time; non-empty
    // restricts them to picking from exactly this set. Not a react-hook-form
    // field since it's a set, not a single scalar value.
    const [packageSessionIds, setPackageSessionIds] = useState<string[]>([]);
    // A field picked in the "attach existing field" picker but not yet
    // confirmed via "Attach" — saving now would silently drop that selection.
    const [hasPendingFieldSelection, setHasPendingFieldSelection] = useState(false);

    const poolOptionsQuery = useQuery({
        queryKey: ['onboarding-package-session-pool', instituteId],
        queryFn: fetchPackageSessionPoolOptions,
        enabled: open && form.watch('create_student'),
        staleTime: 60 * 1000,
    });
    const poolOptions = (poolOptionsQuery.data ?? []).map((o) => ({
        label: o.label,
        value: o.package_session_id,
    }));

    const catalogQuery = useQuery({
        queryKey: ['onboarding-custom-field-catalog', instituteId],
        queryFn: () => fetchInstituteCustomFieldCatalog(instituteId),
        enabled: open && !!instituteId,
        staleTime: 60 * 1000,
    });

    const existingFieldsQuery = useQuery({
        queryKey: editingStep ? onboardingStepFieldsKey(instituteId, editingStep.id) : ['onboarding-step-fields-noop'],
        queryFn: () => fetchStepFields(instituteId, editingStep!.id),
        enabled: open && isEditing && !!editingStep && !!instituteId,
        staleTime: 0,
    });

    useEffect(() => {
        if (!open) return;
        if (editingStep) {
            const config = (editingStep.step_type_config ?? {}) as Record<string, unknown>;
            const configuredPool = Array.isArray(config.package_session_ids)
                ? (config.package_session_ids as unknown[]).filter((v): v is string => typeof v === 'string')
                : [];
            form.reset({
                step_name: editingStep.step_name,
                is_optional: editingStep.is_optional,
                grants_student_role: editingStep.grants_student_role,
                sends_login_credentials: editingStep.sends_login_credentials,
                create_student: config.create_student === 'true' || config.create_student === true,
            });
            setPackageSessionIds(configuredPool);
            setRoleAccess(editingStep.role_access ?? defaultRoleAccess());
        } else {
            form.reset({
                step_name: '',
                is_optional: true,
                grants_student_role: false,
                sends_login_credentials: false,
                create_student: false,
            });
            setFieldRows([]);
            setPackageSessionIds([]);
            setRoleAccess(defaultRoleAccess());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingStep?.id]);

    // Hydrate the field editor once the existing-fields fetch resolves.
    useEffect(() => {
        if (!isEditing || !existingFieldsQuery.data) return;
        setFieldRows(
            existingFieldsQuery.data
                .slice()
                .sort((a, b) => (a.individual_order ?? 0) - (b.individual_order ?? 0))
                .map((f) => ({
                    ...newFieldRowFromCatalog(f),
                    is_mandatory: f.is_mandatory ?? false,
                }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingFieldsQuery.data, isEditing]);

    const { mutate: save, isPending } = useMutation({
        mutationFn: (values: StepForm) => {
            const fields = fieldRows.map((row, index) => ({
                institute_custom_field_id: row.institute_custom_field_id,
                new_field: row.new_field,
                field_order: index,
                is_mandatory: row.is_mandatory,
                is_hidden: row.is_hidden,
                role_access: row.role_access ?? defaultRoleAccess(),
            }));
            const payload = {
                step_order: editingStep?.step_order ?? nextStepOrder,
                step_name: values.step_name,
                step_type: 'FORM' as const,
                step_type_config: values.create_student
                    ? { create_student: 'true', package_session_ids: packageSessionIds }
                    : { create_student: 'false' },
                is_optional: values.is_optional,
                grants_student_role: values.grants_student_role,
                sends_login_credentials: values.sends_login_credentials,
                fields,
                role_access: roleAccess,
            };
            return editingStep
                ? updateOnboardingStep(instituteId, flowId, editingStep.id, payload)
                : createOnboardingStep(instituteId, flowId, payload);
        },
        onSuccess: () => {
            toast.success(isEditing ? 'Step updated' : 'Step added');
            if (editingStep) {
                queryClient.invalidateQueries({ queryKey: onboardingStepFieldsKey(instituteId, editingStep.id) });
            }
            onOpenChange(false);
            onSaved();
        },
        onError: () => {
            toast.error('Could not save the step. Please try again.');
        },
    });

    const onSubmit = (values: StepForm) => {
        if (hasPendingFieldSelection) {
            toast.warning(
                'You picked a field but haven’t clicked "Attach" yet — attach it (or clear the selection) before saving, or it will be lost.'
            );
            return;
        }
        save(values);
    };

    const loadingFields = isEditing && existingFieldsQuery.isLoading;

    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)} disable={isPending}>
                Cancel
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="medium"
                onClick={form.handleSubmit(onSubmit)}
                disable={isPending || loadingFields}
            >
                {isPending ? 'Saving…' : isEditing ? 'Save Step' : 'Add Step'}
            </MyButton>
        </div>
    );

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={isEditing ? 'Edit Step' : 'Add Step'}
            footer={footer}
            dialogWidth="max-w-2xl"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 px-6 py-6">
                    <FormField
                        control={form.control}
                        name="step_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Step name</FormLabel>
                                <FormControl>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="e.g. Fill Enrollment Form"
                                        input={field.value}
                                        onChangeFunction={field.onChange}
                                        required
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="step-optional" className="cursor-pointer text-body">
                                Optional (skippable) step
                            </Label>
                            <Switch
                                id="step-optional"
                                checked={form.watch('is_optional')}
                                onCheckedChange={(v) => form.setValue('is_optional', v, { shouldDirty: true })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="step-grants-role" className="cursor-pointer text-body">
                                Grant STUDENT role on completion
                            </Label>
                            <Switch
                                id="step-grants-role"
                                checked={form.watch('grants_student_role')}
                                onCheckedChange={(v) =>
                                    form.setValue('grants_student_role', v, { shouldDirty: true })
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="step-sends-creds" className="cursor-pointer text-body">
                                Send login credentials on completion
                            </Label>
                            <Switch
                                id="step-sends-creds"
                                checked={form.watch('sends_login_credentials')}
                                onCheckedChange={(v) =>
                                    form.setValue('sends_login_credentials', v, { shouldDirty: true })
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="step-create-student" className="cursor-pointer text-body">
                                Create a student from this form on completion
                            </Label>
                            <Switch
                                id="step-create-student"
                                checked={form.watch('create_student')}
                                onCheckedChange={(v) =>
                                    form.setValue('create_student', v, { shouldDirty: true })
                                }
                            />
                        </div>
                        {form.watch('create_student') && (
                            <FormItem>
                                <FormLabel>Course(s) this step can enroll into</FormLabel>
                                <FormControl>
                                    <MultiSelect
                                        options={poolOptions}
                                        selected={packageSessionIds}
                                        onChange={setPackageSessionIds}
                                        placeholder={
                                            poolOptionsQuery.isLoading
                                                ? 'Loading courses…'
                                                : 'Leave empty to let the admin pick any course…'
                                        }
                                        disabled={poolOptionsQuery.isLoading}
                                    />
                                </FormControl>
                                <p className="text-caption text-neutral-500">
                                    Leave empty and the completing admin picks any course at onboarding
                                    time — the flow never needs rebuilding when a new course is added.
                                    Select specific course(s) to restrict the choice to only those.
                                </p>
                            </FormItem>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label className="text-body font-medium text-neutral-800">Step access (who can view/edit this step)</Label>
                        <RoleAccessGrid value={roleAccess} onChange={setRoleAccess} />
                    </div>

                    {isEditing && editingStep && (
                        <StepWorkflowTriggersCard
                            instituteId={instituteId}
                            flowId={flowId}
                            stepId={editingStep.id}
                        />
                    )}

                    <div className="flex flex-col gap-2">
                        <Label className="text-body font-medium text-neutral-800">Form fields</Label>
                        {loadingFields ? (
                            <div className="text-caption text-neutral-500">Loading existing fields…</div>
                        ) : (
                            <StepFieldConfigEditor
                                instituteId={instituteId}
                                catalog={catalogQuery.data ?? []}
                                value={fieldRows}
                                onChange={setFieldRows}
                                onPendingSelectionChange={setHasPendingFieldSelection}
                            />
                        )}
                    </div>
                </form>
            </Form>
        </MyDialog>
    );
}
