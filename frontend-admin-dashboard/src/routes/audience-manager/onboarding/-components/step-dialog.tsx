/**
 * StepDialog — add/edit an onboarding flow step (v1: FORM steps only).
 *
 * On edit, a step's field rows are rebuilt from the step's OWN `fields`
 * (fields_config — the authority for order / mandatory / hidden / role access),
 * joined against GET .../common/custom-fields/feature-fields?type=ONBOARDING_STEP
 * purely for each field's display name. The PUT always resends the FULL field +
 * role_access list, per the backend's "replace entirely" contract, so anything
 * not hydrated back into these rows would be destroyed on save.
 *
 * Role access isn't limited to ADMIN/STUDENT/PARENT: the grids take the institute's
 * roles (`fetchOnboardingAssignableRoles`) so a step — or a single field on it — can
 * be handed to a COUNSELLOR or any custom role, which is what lets a non-admin staff
 * member actually work the step.
 */
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
    fetchOnboardingAssignableRoles,
    onboardingAssignableRolesKey,
    onboardingStepFieldsKey,
    fetchPackageSessionPoolOptions,
    type OnboardingStepDTO,
    type OnboardingRoleAccess,
} from '../-services/onboarding-service';

const buildStepSchema = (t: TFunction) =>
    z.object({
        step_name: z
            .string()
            .min(1, t('schema.stepNameRequired'))
            .max(150, t('schema.stepNameMaxLength')),
        is_optional: z.boolean(),
        grants_student_role: z.boolean(),
        sends_login_credentials: z.boolean(),
        create_student: z.boolean(),
        skip_if_already_enrolled: z.boolean(),
    });

type StepForm = z.infer<ReturnType<typeof buildStepSchema>>;

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
    const { t } = useTranslation('audienceManagerStepDialog');
    // Bound to the field-config-editor's own namespace: newFieldRowFromCatalog
    // (imported from that module) needs its "Untitled field" fallback string,
    // which that namespace owns, not this one.
    const { t: tFieldConfigEditor } = useTranslation('audienceManagerStepFieldConfigEditor');
    const queryClient = useQueryClient();
    const isEditing = !!editingStep;

    const stepSchema = useMemo(() => buildStepSchema(t), [t]);

    const form = useForm<StepForm>({
        resolver: zodResolver(stepSchema),
        defaultValues: {
            step_name: '',
            is_optional: true,
            grants_student_role: false,
            sends_login_credentials: false,
            create_student: false,
            skip_if_already_enrolled: false,
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

    // Institute roles offered by the role-access grids' "Add role" picker, so a step can be
    // handed to a COUNSELLOR (or any custom role) rather than only ADMIN/STUDENT/PARENT.
    // A failure here just leaves the picker hidden -- the built-in three still work.
    const rolesQuery = useQuery({
        queryKey: onboardingAssignableRolesKey(instituteId),
        queryFn: () => fetchOnboardingAssignableRoles(instituteId),
        enabled: open && !!instituteId,
        staleTime: 5 * 60 * 1000,
    });
    const assignableRoles = rolesQuery.data ?? [];

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
                skip_if_already_enrolled:
                    config.skip_if_already_enrolled === 'true' || config.skip_if_already_enrolled === true,
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
                skip_if_already_enrolled: false,
            });
            setFieldRows([]);
            setPackageSessionIds([]);
            setRoleAccess(defaultRoleAccess());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingStep?.id]);

    // Hydrate the field editor once the existing-fields fetch resolves.
    //
    // The step's OWN `fields` (fields_config) is the authority for order / mandatory / hidden /
    // role access -- the feature-fields lookup only supplies display NAMES. Hydrating from that
    // lookup instead, as this used to, silently reset a step's field config on every reopen:
    // its `is_mandatory` and `individual_order` are catalog columns this domain never writes (so
    // they always came back null -> every Mandatory toggle off, every field back in catalog
    // order), and `is_hidden`/`role_access` aren't in that payload at all. Saving then wrote the
    // reset values back over the real ones.
    useEffect(() => {
        if (!isEditing || !existingFieldsQuery.data) return;
        const nameById = new Map(existingFieldsQuery.data.map((f) => [f.id, f]));
        const configured = (editingStep?.fields ?? []).filter((f) => f.institute_custom_field_id);
        const rows = (
            configured.length > 0
                ? configured
                      .slice()
                      .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0))
                      .map((f) => ({ config: f, catalog: nameById.get(f.institute_custom_field_id!) }))
                : // No fields_config (a step saved before it was written, or unparseable JSON):
                  // fall back to the catalog rows so the admin at least sees the attached fields.
                  existingFieldsQuery.data.map((f) => ({ config: undefined, catalog: f }))
        ).filter((r) => r.catalog);
        setFieldRows(
            rows.map(({ config, catalog }) => ({
                ...newFieldRowFromCatalog(catalog!, tFieldConfigEditor),
                is_mandatory: config?.is_mandatory ?? false,
                is_hidden: config?.is_hidden ?? false,
                // Left undefined when the step never set one, so the field keeps INHERITING the
                // step-level access rather than gaining an explicit override on next save.
                role_access: config?.role_access ?? undefined,
            }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingFieldsQuery.data, editingStep?.fields, isEditing]);

    const { mutate: save, isPending } = useMutation({
        mutationFn: (values: StepForm) => {
            const fields = fieldRows.map((row, index) => ({
                institute_custom_field_id: row.institute_custom_field_id,
                new_field: row.new_field,
                field_order: index,
                is_mandatory: row.is_mandatory,
                is_hidden: row.is_hidden,
                // Only ever send an explicit per-field override when the admin actually set one
                // (RoleAccessGrid touched, or one round-tripped from fields_config). Stamping
                // defaultRoleAccess() here -- which this used to do -- attached a STUDENT/PARENT
                // can_edit=false override to EVERY field, overriding whatever the step's own
                // Step Access grid said, so a step marked "Student: View + Edit" still blocked
                // the student on all of its fields. Same reasoning as StepFieldConfigEditor's
                // addNewField, which deliberately leaves role_access unset for the same reason.
                role_access: row.role_access,
            }));
            const payload = {
                step_order: editingStep?.step_order ?? nextStepOrder,
                step_name: values.step_name,
                step_type: 'FORM' as const,
                step_type_config: values.create_student
                    ? {
                          create_student: 'true',
                          package_session_ids: packageSessionIds,
                          skip_if_already_enrolled: values.skip_if_already_enrolled ? 'true' : 'false',
                      }
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
            toast.success(isEditing ? t('toasts.stepUpdated') : t('toasts.stepAdded'));
            if (editingStep) {
                queryClient.invalidateQueries({ queryKey: onboardingStepFieldsKey(instituteId, editingStep.id) });
            }
            onOpenChange(false);
            onSaved();
        },
        onError: () => {
            toast.error(t('toasts.saveError'));
        },
    });

    const onSubmit = (values: StepForm) => {
        if (hasPendingFieldSelection) {
            toast.warning(t('toasts.pendingFieldSelection'));
            return;
        }
        save(values);
    };

    const loadingFields = isEditing && existingFieldsQuery.isLoading;

    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)} disable={isPending}>
                {t('actions.cancel')}
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="medium"
                onClick={form.handleSubmit(onSubmit)}
                disable={isPending || loadingFields}
            >
                {isPending ? t('actions.saving') : isEditing ? t('actions.saveStep') : t('actions.addStep')}
            </MyButton>
        </div>
    );

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={isEditing ? t('heading.edit') : t('heading.add')}
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
                                <FormLabel>{t('fields.stepName.label')}</FormLabel>
                                <FormControl>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder={t('fields.stepName.placeholder')}
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
                                {t('switches.optional')}
                            </Label>
                            <Switch
                                id="step-optional"
                                checked={form.watch('is_optional')}
                                onCheckedChange={(v) => form.setValue('is_optional', v, { shouldDirty: true })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="step-grants-role" className="cursor-pointer text-body">
                                {t('switches.grantsStudentRole')}
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
                                {t('switches.sendsLoginCredentials')}
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
                                {t('switches.createStudent')}
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
                                <FormLabel>{t('fields.coursePool.label')}</FormLabel>
                                <FormControl>
                                    <MultiSelect
                                        options={poolOptions}
                                        selected={packageSessionIds}
                                        onChange={setPackageSessionIds}
                                        placeholder={
                                            poolOptionsQuery.isLoading
                                                ? t('fields.coursePool.loadingPlaceholder')
                                                : t('fields.coursePool.emptyPlaceholder')
                                        }
                                        disabled={poolOptionsQuery.isLoading}
                                    />
                                </FormControl>
                                <p className="text-caption text-neutral-500">
                                    {t('fields.coursePool.helperText')}
                                </p>
                            </FormItem>
                        )}
                        {form.watch('create_student') && (
                            <div className="flex items-center justify-between">
                                <Label htmlFor="step-skip-if-enrolled" className="cursor-pointer text-body">
                                    {t('switches.skipIfAlreadyEnrolled')}
                                </Label>
                                <Switch
                                    id="step-skip-if-enrolled"
                                    checked={form.watch('skip_if_already_enrolled')}
                                    onCheckedChange={(v) =>
                                        form.setValue('skip_if_already_enrolled', v, { shouldDirty: true })
                                    }
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label className="text-body font-medium text-neutral-800">{t('sections.stepAccess')}</Label>
                        <RoleAccessGrid
                            value={roleAccess}
                            onChange={setRoleAccess}
                            assignableRoles={assignableRoles}
                        />
                    </div>

                    {isEditing && editingStep && (
                        <StepWorkflowTriggersCard
                            instituteId={instituteId}
                            flowId={flowId}
                            stepId={editingStep.id}
                        />
                    )}

                    <div className="flex flex-col gap-2">
                        <Label className="text-body font-medium text-neutral-800">{t('sections.formFields')}</Label>
                        {loadingFields ? (
                            <div className="text-caption text-neutral-500">{t('sections.loadingFields')}</div>
                        ) : (
                            <StepFieldConfigEditor
                                instituteId={instituteId}
                                catalog={catalogQuery.data ?? []}
                                assignableRoles={assignableRoles}
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
