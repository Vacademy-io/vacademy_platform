import { useMemo } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ListChecks, SpinnerGap } from "@phosphor-icons/react";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";
import PhoneInputField from "@/components/design-system/phone-input-field";
import { CustomFieldRenderer } from "@/components/common/custom-fields/CustomFieldRenderer";
import {
  FieldRenderType,
  getFieldRenderType,
} from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";
import {
  getCountryCode,
  findCountryFieldKey,
} from "@/components/common/enroll-by-invite/-utils/country-code-mapping";
import { getDynamicSchema } from "@/routes/register/-utils/helper";
import { AssessmentCustomFieldOpenRegistration } from "@/types/assessment-open-registration";
import { capitalise } from "@/utils/custom-field";
import type {
  TemplateInstituteCustomField,
  CustomFieldValuePayload,
} from "../-services/sub-org-registration-services";

/**
 * Converts the template's institute custom fields to the shape the shared
 * renderer + dynamic zod schema expect. Same conversion audience-response
 * does, but tolerant of both camelCase and snake_case nested custom_field
 * keys (the backend DTO serializes camelCase today).
 */
const convertTemplateCustomFields = (
  customFields: TemplateInstituteCustomField[]
): AssessmentCustomFieldOpenRegistration[] => {
  return customFields
    .map((field) => {
      const cf = field.custom_field;
      if (!cf?.id) return null;
      return {
        id: cf.id,
        field_name: cf.fieldName ?? cf.field_name ?? "",
        field_key: cf.fieldKey ?? cf.field_key ?? cf.id,
        field_order:
          cf.individualOrder ??
          cf.individual_order ??
          cf.formOrder ??
          cf.form_order ??
          field.individual_order ??
          0,
        comma_separated_options: cf.config || "",
        config: cf.config || "{}",
        status: field.status || "ACTIVE",
        // Mapping-level override first: template edits update the OUTER row's
        // is_mandatory; the nested master flag is only the original default.
        is_mandatory: field.is_mandatory ?? cf.isMandatory ?? cf.is_mandatory ?? false,
        field_type: cf.fieldType ?? cf.field_type ?? "text",
        created_at: cf.createdAt ?? cf.created_at ?? "",
        updated_at: cf.updatedAt ?? cf.updated_at ?? "",
      };
    })
    .filter((f): f is AssessmentCustomFieldOpenRegistration => f !== null)
    .sort((a, b) => a.field_order - b.field_order);
};

interface CustomFieldsStepProps {
  customFields: TemplateInstituteCustomField[];
  /** Previously collected values keyed by custom_field_id (back/forth navigation) */
  initialValues?: Record<string, string>;
  /** Whether this Continue triggers the final POST /complete */
  isFinalStep: boolean;
  isSubmitting: boolean;
  onContinue: (values: CustomFieldValuePayload[]) => void;
  /**
   * Returns to the previous wizard step. Receives the CURRENT (unvalidated)
   * values so nothing typed so far is lost on back-navigation.
   */
  onBack?: (values: CustomFieldValuePayload[]) => void;
}

/** Step 3 — template-configured additional information (custom fields). */
const CustomFieldsStep = ({
  customFields,
  initialValues,
  isFinalStep,
  isSubmitting,
  onContinue,
  onBack,
}: CustomFieldsStepProps) => {
  const formFields = useMemo(
    () => convertTemplateCustomFields(customFields),
    [customFields]
  );

  const zodSchema = getDynamicSchema(formFields);
  type FormValues = z.infer<typeof zodSchema>;

  const defaultValues = useMemo(
    () =>
      formFields.reduce(
        (
          defaults: Record<
            string,
            {
              id: string;
              name: string;
              value: string;
              is_mandatory: boolean;
              type: string;
              config?: string;
            }
          >,
          field
        ) => {
          defaults[field.field_key] = {
            id: field.id,
            name: field.field_name,
            value: initialValues?.[field.id] ?? "",
            is_mandatory: field.is_mandatory || false,
            type: field.field_type,
            config: field.config || "{}",
          };
          return defaults;
        },
        {}
      ),
    [formFields, initialValues]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
    mode: "onChange",
  });

  const watchedFormValues = useWatch({ control: form.control });

  // Phone country code derives from a country field if one exists in the form
  const getPhoneCountryCode = () => {
    const formValues = form.getValues();
    const countryFieldKey = findCountryFieldKey(formValues);
    if (countryFieldKey) {
      const countryValue = formValues[countryFieldKey]?.value || "";
      return getCountryCode(countryValue);
    }
    return "in";
  };

  /** Collects values keyed by custom_field_id in the template's field order. */
  const collectPayload = (values: FormValues): CustomFieldValuePayload[] => {
    const payload: CustomFieldValuePayload[] = [];
    formFields.forEach((field) => {
      const entry = values[field.field_key];
      const value = entry?.value;
      if (value !== undefined && value !== null && String(value) !== "") {
        payload.push({ custom_field_id: field.id, value: String(value) });
      }
    });
    return payload;
  };

  const handleSubmit = (values: FormValues) => {
    onContinue(collectPayload(values));
  };

  // Back navigation must not lose typed values — hand the wizard whatever is
  // currently in the form (no validation; it re-validates on the way forward).
  const handleBack = () => {
    onBack?.(collectPayload(form.getValues()));
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
            Additional Information
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            A few more details requested by the institute
          </p>
        </div>
      </div>

      <Separator className="mb-5" />

      {formFields.length === 0 ? (
        <div className="py-8 text-center text-neutral-500">
          <p className="mb-4">No additional information is required.</p>
          <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            {onBack && (
              <MyButton
                type="button"
                buttonType="secondary"
                scale="large"
                layoutVariant="default"
                onClick={() => onBack([])}
                disable={isSubmitting}
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </MyButton>
            )}
            <MyButton
              type="button"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              onClick={() => onContinue([])}
              disable={isSubmitting}
            >
              Continue
            </MyButton>
          </div>
        </div>
      ) : (
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex w-full flex-col gap-5"
          >
            {formFields.map((field) => {
              const key = field.field_key;
              const formValues = watchedFormValues || form.getValues() || defaultValues;
              const value = formValues[key] || defaultValues[key];
              const renderType = getFieldRenderType(
                key,
                value?.type || field.field_type || "text"
              );

              // Phone: specialized input with country-code detection
              if (renderType === FieldRenderType.PHONE) {
                const phoneCountryCode = getPhoneCountryCode();
                return (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`${key}.value`}
                    render={() => (
                      <FormItem>
                        <FormControl>
                          <PhoneInputField
                            label={capitalise(field.field_name)}
                            placeholder="123 456 7890"
                            name={`${key}.value`}
                            control={form.control}
                            country={phoneCountryCode}
                            required={field.is_mandatory}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                );
              }

              // All other types — the shared renderer handles text, number,
              // email, url, date, textarea, checkbox, radio, dropdown, file
              return (
                <FormField
                  key={key}
                  control={form.control}
                  name={`${key}.value`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <div className="flex flex-col gap-1">
                        <label className="text-subtitle font-regular">
                          {capitalise(field.field_name)}
                          {field.is_mandatory && (
                            <span className="text-danger-600"> *</span>
                          )}
                        </label>
                        <FormControl>
                          <CustomFieldRenderer
                            type={renderType}
                            name={field.field_name}
                            value={formField.value || ""}
                            onChange={(val) => formField.onChange(val)}
                            config={field.config}
                            required={field.is_mandatory}
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              );
            })}

            <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {onBack ? (
                <MyButton
                  type="button"
                  buttonType="secondary"
                  scale="large"
                  layoutVariant="default"
                  onClick={handleBack}
                  disable={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </MyButton>
              ) : (
                <span className="hidden sm:block" />
              )}
              <MyButton
                type="submit"
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                disable={isSubmitting}
                className="w-full min-w-32 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <SpinnerGap className="mr-2 size-4 animate-spin" />
                    Submitting...
                  </>
                ) : isFinalStep ? (
                  "Submit Registration"
                ) : (
                  "Continue"
                )}
              </MyButton>
            </div>
          </form>
        </FormProvider>
      )}
    </ModernCard>
  );
};

export default CustomFieldsStep;
