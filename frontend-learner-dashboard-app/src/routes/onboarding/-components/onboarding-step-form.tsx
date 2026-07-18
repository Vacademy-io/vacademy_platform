import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, ListChecks, SpinnerGap } from "@phosphor-icons/react";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { ModernCard } from "@/components/design-system/modern-card";
import {
  getOnboardingStepFields,
  submitStepInstance,
  getOnboardingApiErrorMessage,
  type OnboardingCustomFieldDTO,
  type OnboardingStepInstanceDTO,
} from "../-services/onboarding-services";

const ONBOARDING_STEP_FIELDS_QUERY_KEY = "ONBOARDING_STEP_FIELDS";
export const ONBOARDING_INSTANCES_QUERY_KEY = "ONBOARDING_INSTANCES";

/**
 * One resolved form field: mapping-level `is_mandatory` overrides the
 * master custom field's flag when both are present.
 */
interface ResolvedField {
  customFieldId: string;
  fieldKey: string;
  fieldName: string;
  isMandatory: boolean;
  order: number;
}

const resolveFields = (rows: OnboardingCustomFieldDTO[]): ResolvedField[] => {
  return rows
    .filter((row) => row.custom_field?.id)
    .map((row) => {
      const cf = row.custom_field!;
      return {
        customFieldId: cf.id,
        fieldKey: cf.fieldKey || cf.id,
        fieldName: cf.fieldName || cf.fieldKey || "Field",
        isMandatory: row.is_mandatory ?? cf.isMandatory ?? false,
        order: row.individual_order ?? cf.formOrder ?? cf.individualOrder ?? 0,
      };
    })
    .sort((a, b) => a.order - b.order);
};

interface OnboardingStepFormProps {
  instituteId: string;
  stepInstance: OnboardingStepInstanceDTO;
  onSubmitted: (updated: OnboardingStepInstanceDTO) => void;
}

/**
 * Renders + submits the FORM step type: one text input per institute custom
 * field configured for this step.
 *
 * KNOWN v1 GAP: the fields lookup (`getOnboardingStepFields`) does not filter
 * by the learner's view/edit permission for each field — every mapped field
 * is rendered here as an editable text input regardless of role. The server
 * re-checks edit permission per field on submit, so a learner can't actually
 * persist a change to a field they don't own, but the UI doesn't yet grey
 * out / hide view-only fields. Needs a future "resolved step fields"
 * endpoint that returns each field's effective view/edit permission for the
 * caller's role.
 */
export const OnboardingStepForm = ({
  instituteId,
  stepInstance,
  onSubmitted,
}: OnboardingStepFormProps) => {
  const queryClient = useQueryClient();

  const {
    data: fieldRows,
    isLoading: isLoadingFields,
    isError: isFieldsError,
  } = useQuery({
    queryKey: [ONBOARDING_STEP_FIELDS_QUERY_KEY, instituteId, stepInstance.step_id],
    queryFn: () => getOnboardingStepFields(instituteId, stepInstance.step_id),
    enabled: Boolean(instituteId) && Boolean(stepInstance.step_id),
    staleTime: 5 * 60 * 1000,
  });

  const fields = useMemo(() => resolveFields(fieldRows ?? []), [fieldRows]);

  const zodSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    fields.forEach((field) => {
      shape[field.customFieldId] = field.isMandatory
        ? z.string().min(1, `${field.fieldName} is required`)
        : z.string().optional();
    });
    return z.object(shape);
  }, [fields]);

  type FormValues = Record<string, string>;

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: useMemo(
      () => Object.fromEntries(fields.map((f) => [f.customFieldId, ""])),
      [fields]
    ),
  });

  const submitMutation = useMutation({
    mutationFn: (values: FormValues) =>
      submitStepInstance(stepInstance.id, values),
    onSuccess: (updated) => {
      toast.success("Step submitted", {
        description: `${stepInstance.step_name} has been recorded.`,
      });
      queryClient.invalidateQueries({ queryKey: [ONBOARDING_INSTANCES_QUERY_KEY] });
      onSubmitted(updated);
    },
    onError: (error) => {
      toast.error("Couldn't submit", {
        description: getOnboardingApiErrorMessage(
          error,
          "Something went wrong while submitting this step. Please try again."
        ),
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    submitMutation.mutate(values);
  };

  return (
    <ModernCard
      variant="glass"
      padding="lg"
      rounded="lg"
      className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
    >
      <div className="mb-5 flex items-start gap-2 sm:gap-3">
        <div className="flex-shrink-0 rounded-lg bg-primary-50 p-1.5 sm:p-2">
          <ListChecks className="size-5 text-primary-500 sm:size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-neutral-700">
            {stepInstance.step_name}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Please fill in the details below to continue.
          </p>
        </div>
      </div>

      {isLoadingFields ? (
        <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
          <SpinnerGap className="size-4 animate-spin" />
          Loading form...
        </div>
      ) : isFieldsError ? (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">
          Couldn&apos;t load this step&apos;s form. Please try again later.
        </div>
      ) : fields.length === 0 ? (
        <div className="py-6 text-center text-sm text-neutral-500">
          <p className="mb-4">No fields are configured for this step.</p>
          <MyButton
            type="button"
            buttonType="primary"
            scale="large"
            layoutVariant="default"
            onClick={() => submitMutation.mutate({})}
            disable={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <>
                <SpinnerGap className="mr-2 size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 size-4" />
                Mark as complete
              </>
            )}
          </MyButton>
        </div>
      ) : (
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex w-full flex-col gap-5"
        >
          {fields.map((field) => (
            <MyInput
              key={field.customFieldId}
              label={field.fieldName}
              required={field.isMandatory}
              inputType="text"
              input={form.watch(field.customFieldId) ?? ""}
              onChangeFunction={(e) =>
                form.setValue(field.customFieldId, e.target.value, {
                  shouldValidate: form.formState.isSubmitted,
                })
              }
              error={form.formState.errors[field.customFieldId]?.message as string | undefined}
            />
          ))}

          <div className="mt-2 flex justify-end">
            <MyButton
              type="submit"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              disable={submitMutation.isPending}
              className="w-full sm:w-auto"
            >
              {submitMutation.isPending ? (
                <>
                  <SpinnerGap className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </MyButton>
          </div>
        </form>
      )}
    </ModernCard>
  );
};
