import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle,
  ListChecks,
  Lock,
  PencilSimpleLine,
  SpinnerGap,
} from "@phosphor-icons/react";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MyButton } from "@/components/design-system/button";
import { ModernCard } from "@/components/design-system/modern-card";
import { cn } from "@/lib/utils";
import {
  getResolvedStepFields,
  submitStepInstance,
  getOnboardingApiErrorMessage,
  type OnboardingStepInstanceDTO,
} from "../-services/onboarding-services";

const ONBOARDING_STEP_FIELDS_QUERY_KEY = "ONBOARDING_STEP_FIELDS";
export const ONBOARDING_INSTANCES_QUERY_KEY = "ONBOARDING_INSTANCES";

interface OnboardingStepFormProps {
  stepInstance: OnboardingStepInstanceDTO;
  onSubmitted: (updated: OnboardingStepInstanceDTO) => void;
}

/**
 * Renders + submits the FORM step type: one input per field resolved for the
 * caller's own role (`getResolvedStepFields`) — a field they can't view is
 * never sent by the server, and a field they can view but not edit renders
 * read-only (pre-filled with its already-submitted value) instead of an
 * editable text input. Only editable fields are included in the submit
 * payload; the server re-validates mandatory/edit permission regardless.
 */
export const OnboardingStepForm = ({
  stepInstance,
  onSubmitted,
}: OnboardingStepFormProps) => {
  const queryClient = useQueryClient();

  const {
    data: fieldRows,
    isLoading: isLoadingFields,
    isError: isFieldsError,
  } = useQuery({
    queryKey: [ONBOARDING_STEP_FIELDS_QUERY_KEY, stepInstance.id],
    queryFn: () => getResolvedStepFields(stepInstance.id),
    enabled: Boolean(stepInstance.id),
    staleTime: 60 * 1000,
  });

  const fields = useMemo(
    () =>
      [...(fieldRows ?? [])].sort(
        (a, b) => (a.field_order ?? 0) - (b.field_order ?? 0)
      ),
    [fieldRows]
  );
  const editableFields = useMemo(
    () => fields.filter((f) => f.can_edit !== false),
    [fields]
  );
  const readOnlyFields = useMemo(
    () => fields.filter((f) => f.can_edit === false),
    [fields]
  );

  const zodSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    editableFields.forEach((field) => {
      shape[field.institute_custom_field_id] = field.is_mandatory
        ? z.string().min(1, `${field.field_name ?? "This field"} is required`)
        : z.string().optional();
    });
    return z.object(shape);
  }, [editableFields]);

  type FormValues = Record<string, string>;

  const defaultValues = useMemo(
    () =>
      Object.fromEntries(
        editableFields.map((f) => [f.institute_custom_field_id, f.value ?? ""])
      ),
    [editableFields]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // Fields resolve asynchronously (a separate query) after the form is already
  // constructed with empty defaults -- reset once the real values arrive so
  // previously-submitted values actually show up pre-filled.
  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

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
      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 ring-1 ring-primary-200/60">
          <PencilSimpleLine className="size-5 text-primary-600" weight="fill" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-neutral-800">
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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex w-full flex-col gap-4"
          >
            {readOnlyFields.map((field) => (
              <div
                key={field.institute_custom_field_id}
                className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3.5 py-2.5"
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Lock className="size-3.5" />
                  {field.field_name ?? "Field"}
                </span>
                <span className="text-sm text-neutral-700">
                  {field.value || "Not filled in"}
                </span>
              </div>
            ))}

            {editableFields.map((field) => (
              <FormField
                key={field.institute_custom_field_id}
                control={form.control}
                name={field.institute_custom_field_id}
                render={({ field: rhfField, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor={field.institute_custom_field_id}
                          className="text-sm font-medium text-neutral-700"
                        >
                          {field.field_name ?? "Field"}
                          {field.is_mandatory && (
                            <span className="ms-0.5 text-danger-600">*</span>
                          )}
                        </Label>
                        <Input
                          id={field.institute_custom_field_id}
                          placeholder={`Enter ${field.field_name ?? "value"}`}
                          className={cn(
                            "h-10 rounded-lg border-neutral-200 bg-neutral-50/50 px-3 text-sm text-neutral-700 shadow-none",
                            "placeholder:text-neutral-400 hover:border-primary-200 focus:border-primary-500 focus:bg-white focus-visible:ring-0",
                            fieldState.error && "border-danger-400"
                          )}
                          {...rhfField}
                        />
                        {fieldState.error && (
                          <p className="text-xs font-medium text-danger-600">
                            {fieldState.error.message}
                          </p>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}

            <MyButton
              type="submit"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              disable={submitMutation.isPending}
              className="mt-2 w-full"
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
          </form>
        </Form>
      )}
    </ModernCard>
  );
};
