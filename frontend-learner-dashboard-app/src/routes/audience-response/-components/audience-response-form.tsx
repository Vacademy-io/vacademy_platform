import { useEffect, useState } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { Preferences } from "@capacitor/preferences";
import { applyTabBranding } from "@/utils/branding";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetPublicInstituteDetails } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import { getDynamicSchema } from "@/routes/register/-utils/helper";
import { AssessmentCustomFieldOpenRegistration } from "@/types/assessment-open-registration";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { ModernCard, ModernCardHeader, ModernCardTitle } from "@/components/design-system/modern-card";
import { InstituteBrandingComponent } from "@/components/common/institute-branding";
import { MyButton } from "@/components/design-system/button";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { MyInput } from "@/components/design-system/input";
import SelectField from "@/components/design-system/select-field";
import PhoneInputField from "@/components/design-system/phone-input-field";
import {
  FieldRenderType,
  getFieldRenderType,
  getInputType,
  parseDropdownOptions,
} from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";
import { capitalise } from "@/utils/custom-field";
import {
  getCountryCode,
  findCountryFieldKey,
} from "@/components/common/enroll-by-invite/-utils/country-code-mapping";
import type { AudienceCampaignResponse } from "../-services/audience-campaign-services";
import {
  submitAudienceLead,
  handleSubmitAudienceLead,
} from "../-services/audience-campaign-services";
import { toast } from "sonner";

interface AudienceResponseFormProps {
  campaignData: AudienceCampaignResponse;
  instituteId: string;
  audienceId: string; // Reserved for future use (e.g., submitting response)
}

// Convert audience campaign custom fields to the format expected by the form
const convertAudienceCustomFields = (
  customFields: AudienceCampaignResponse["institute_custom_fields"]
): AssessmentCustomFieldOpenRegistration[] => {
  return customFields
    .map((field) => {
      const customField = field.custom_field;
      return {
        id: customField.id,
        field_name: customField.fieldName,
        field_key: customField.fieldKey,
        field_order: customField.individualOrder || customField.formOrder || 0,
        comma_separated_options: customField.config || "",
        config: customField.config || "{}",
        status: field.status || "ACTIVE",
        is_mandatory: customField.isMandatory || false,
        field_type: customField.fieldType || "text",
        created_at: customField.createdAt,
        updated_at: customField.updatedAt,
      };
    })
    .sort((a, b) => a.field_order - b.field_order);
};

const AudienceResponseForm = ({
  campaignData,
  instituteId,
  audienceId,
}: AudienceResponseFormProps) => {
  const domainRouting = useDomainRouting();
  const { setInstituteDetails } = useInstituteDetailsStore();
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: instituteData, isLoading: isInstituteLoading } =
    useSuspenseQuery(handleGetPublicInstituteDetails({ instituteId }));

  // Convert custom fields
  const formFields = convertAudienceCustomFields(
    campaignData.institute_custom_fields || []
  );

  // Debug: Log to help diagnose rendering issues
  useEffect(() => {
    console.log("🔍 Audience Response Form Debug:", {
      formFieldsCount: formFields.length,
      formFields: formFields.map(f => ({ key: f.field_key, name: f.field_name, type: f.field_type })),
      campaignDataId: campaignData.id,
      campaignName: campaignData.campaign_name,
      instituteCustomFieldsCount: campaignData.institute_custom_fields?.length || 0,
      instituteCustomFields: campaignData.institute_custom_fields,
    });
  }, [formFields, campaignData]);

  // Create dynamic schema
  const zodSchema = getDynamicSchema(formFields);
  type FormValues = z.infer<typeof zodSchema>;

  // Initialize form with default values
  const defaultValues = formFields.reduce(
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
          comma_separated_options?: string[];
        }
      >,
      field: AssessmentCustomFieldOpenRegistration
    ) => {
      if (field.field_type === "dropdown") {
        defaults[field.field_key] = {
          id: field.id,
          name: field.field_name,
          value: "",
          is_mandatory: field.is_mandatory || false,
          type: field.field_type,
          config: field.config || "{}",
        };
      } else {
        defaults[field.field_key] = {
          id: field.id,
          name: field.field_name,
          value: "",
          is_mandatory: field.is_mandatory || false,
          type: field.field_type,
        };
      }
      return defaults;
    },
    {}
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
    mode: "onChange",
  });

  // Watch form to ensure it's reactive
  form.watch();

  // Watch all form values for reactivity
  const watchedFormValues = useWatch({
    control: form.control,
  });

  // Apply branding
  useEffect(() => {
    if (instituteData) {
      setInstituteDetails(instituteData);
    }
  }, [instituteData, setInstituteDetails]);

  useEffect(() => {
    const syncBranding = async () => {
      try {
        if (!instituteId || !instituteData) return;

        await Preferences.set({ key: "InstituteId", value: instituteId });

        const mappedDetails = {
          id: instituteId,
          institute_name:
            instituteData?.institute_name ?? instituteData?.name ?? "",
          institute_logo_file_id: instituteData?.institute_logo_file_id ?? null,
          institute_theme_code:
            instituteData?.institute_theme_code ??
            (instituteData?.theme as string) ??
            "primary",
          institute_settings_json: instituteData?.setting ?? "",
        } as unknown as {
          id: string;
          institute_name: string;
          institute_logo_file_id: string | null;
          institute_theme_code: string;
          institute_settings_json: string;
        };

        await Preferences.set({
          key: "InstituteDetails",
          value: JSON.stringify(mappedDetails),
        });

        const learnerKey = `LEARNER_${instituteId}`;
        const learnerSettings = {
          tabText:
            instituteData?.tabText ?? instituteData?.institute_name ?? null,
          tabIconFileId:
            instituteData?.tabIconFileId ??
            instituteData?.institute_logo_file_id ??
            null,
          fontFamily: instituteData?.fontFamily ?? null,
          theme: instituteData?.institute_theme_code ?? null,
          privacyPolicyUrl: null,
          termsAndConditionUrl: null,
          allowSignup: null,
          allowGoogleAuth: null,
          allowGithubAuth: null,
          allowEmailOtpAuth: null,
          allowUsernamePasswordAuth: null,
        };
        await Preferences.set({
          key: learnerKey,
          value: JSON.stringify(learnerSettings),
        });

        await applyTabBranding(document.title);
      } catch (e) {
        console.warn("[Audience Response] Branding sync failed", e);
      }
    };

    void syncBranding();
  }, [instituteId, instituteData]);

  // Get phone country code dynamically
  const getPhoneCountryCode = () => {
    const formValues = form.getValues();
    const countryFieldKey = findCountryFieldKey(formValues);
    if (countryFieldKey) {
      const countryValue = formValues[countryFieldKey]?.value || "";
      return getCountryCode(countryValue);
    }
    return "us"; // Default
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      // Build the payload using the helper function
      // Pass formFields to maintain the order from GET API (sorted by field_order)
      // This ensures custom_field_values in POST payload matches the order from GET API
      const customFieldsOrder = formFields.map((field) => ({
        id: field.id,
        field_key: field.field_key,
      }));
      const payload = handleSubmitAudienceLead(
        values,
        audienceId,
        campaignData.id,
        customFieldsOrder
      );

      // console.log("Submitting audience lead with payload:", payload);

      // Submit the audience lead
      const response = await submitAudienceLead(payload);

      console.log("Audience response submitted successfully:", response);
      
      // Show success state
      setIsSubmitted(true);
      
      // Reset the form after successful submission
      form.reset();
    } catch (error: any) {
      console.error("Error submitting audience response:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to submit response. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isInstituteLoading) {
    return <DashboardLoader />;
  }

  // Show success message after submission
  if (isSubmitted) {
    return (
      <div className="w-full h-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        {/* Navbar Header */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6">
            <div className="flex items-center justify-start h-18 sm:h-16 py-3 p-3 sm:py-4">
              <InstituteBrandingComponent
                branding={{
                  instituteId: instituteId || null,
                  instituteName:
                    instituteData?.institute_name ??
                    instituteData?.name ??
                    null,
                  instituteLogoFileId:
                    instituteData?.institute_logo_file_id ?? null,
                  instituteThemeCode:
                    (instituteData?.institute_theme_code as string) ||
                    (instituteData?.theme as string) ||
                    null,
                  homeIconClickRoute: domainRouting.homeIconClickRoute ?? null,
                }}
                size="medium"
                showName={true}
                className="!flex-row !items-center !gap-3 sm:!gap-4"
              />
            </div>
          </div>
        </nav>

        {/* Success Message */}
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <ModernCard
              variant="glass"
              padding="lg"
              rounded="lg"
              className="border border-white/40 bg-white/90 backdrop-blur-md shadow-lg"
            >
              <div className="text-center space-y-6 py-8">
                {/* Success Icon */}
                <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-10 w-10 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                {/* Success Message */}
                <div className="space-y-3">
                  <h2 className="text-2xl sm:text-3xl font-bold text-neutral-800">
                     Registration Successfully!
                  </h2>
                  <p className="text-lg text-neutral-600">
                    Thank you for your response. Your form has been submitted successfully.
                  </p>
                  {campaignData.send_respondent_email && (
                    <p className="text-sm text-neutral-500">
                      A confirmation email will be sent to you shortly.
                    </p>
                  )}
                </div>

                {/* Campaign Info */}
                <div className="mt-8 pt-6 border-t border-neutral-200">
                  <p className="text-sm text-neutral-600">
                    <span className="font-semibold">Campaign:</span> {campaignData.campaign_name}
                  </p>
                </div>
              </div>
            </ModernCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Navbar Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6">
          <div className="flex items-center justify-start h-18 sm:h-16 py-3 p-3 sm:py-4">
            <InstituteBrandingComponent
              branding={{
                instituteId: instituteId || null,
                instituteName:
                  instituteData?.institute_name ??
                  instituteData?.name ??
                  null,
                instituteLogoFileId:
                  instituteData?.institute_logo_file_id ?? null,
                instituteThemeCode:
                  (instituteData?.institute_theme_code as string) ||
                  (instituteData?.theme as string) ||
                  null,
                homeIconClickRoute: domainRouting.homeIconClickRoute ?? null,
              }}
              size="medium"
              showName={true}
              className="!flex-row !items-center !gap-3 sm:!gap-4"
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Campaign Header */}
          <ModernCard
            variant="glass"
            padding="lg"
            rounded="lg"
            className="border border-white/40 bg-white/90 backdrop-blur-md shadow-lg"
          >
            <ModernCardHeader className="p-0 mb-4">
              <ModernCardTitle
                size="lg"
                className="text-neutral-800 text-2xl sm:text-3xl"
              >
                {campaignData.campaign_name}
              </ModernCardTitle>
            </ModernCardHeader>
            {campaignData.description && (
              <div
                className="text-neutral-600 text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: campaignData.description }}
              />
            )}
            {campaignData.campaign_objective && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-700 mb-2">
                  Objective:
                </p>
                <p className="text-neutral-600">{campaignData.campaign_objective}</p>
              </div>
            )}
          </ModernCard>

          {/* Response Form */}
          <ModernCard
            variant="glass"
            padding="lg"
            rounded="lg"
            className="border border-white/40 bg-white/90 backdrop-blur-md shadow-lg"
            id="response-form-card"
          >
            <ModernCardHeader className="p-0 mb-6">
              <ModernCardTitle
                size="md"
                className="text-neutral-800 text-xl sm:text-2xl mb-2"
              >
                Please fill in your details
              </ModernCardTitle>
              <p className="text-neutral-600 text-sm">
                This information will be used to contact you about the campaign.
              </p>
            </ModernCardHeader>

            <FormProvider {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full flex flex-col gap-6"
              >
                {/* Debug Info - Remove in production */}
                {/* <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                  <p><strong>Debug Info:</strong></p>
                  <p>Form Fields Count: {formFields.length}</p>
                  <p>Default Values Keys: {Object.keys(defaultValues).join(", ") || "None"}</p>
                  <p>Form Values Keys: {Object.keys(form.getValues()).join(", ") || "None"}</p>
                </div> */}

                {formFields.length === 0 ? (
                  <div className="text-center py-8 text-neutral-600">
                    <p className="text-lg font-semibold mb-2">No form fields available</p>
                    <p>This campaign does not have any custom fields configured.</p>
                    <p className="text-xs mt-4 text-neutral-400">
                      Custom Fields from API: {campaignData.institute_custom_fields?.length || 0}
                    </p>
                  </div>
                ) : (
                  <>
                    {formFields.map((field) => {
                      const key = field.field_key;
                      // Use watched values or fallback to defaultValues
                      const formValues = watchedFormValues || form.getValues() || defaultValues;
                      const value = formValues[key] || defaultValues[key];
                      
                      if (!value) {
                        console.warn(`Form value not found for key: ${key}`, {
                          availableKeys: Object.keys(formValues),
                          fieldKey: key,
                          formFields: formFields.map(f => f.field_key),
                          defaultValuesKeys: Object.keys(defaultValues)
                        });
                        // Return a fallback field structure if value not found
                        const renderType = getFieldRenderType(key, field.field_type || "text");
                        
                        // Render as text input if value not found
                        return (
                        <FormField
                          key={key}
                          control={form.control}
                          name={`${key}.value`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormControl>
                                <MyInput
                                  inputType={getInputType(field.field_type || "text", renderType)}
                                  inputPlaceholder={`Enter ${field.field_name}`}
                                  input={formField.value || ""}
                                  onChangeFunction={formField.onChange}
                                  required={field.is_mandatory}
                                  size="large"
                                  label={capitalise(field.field_name)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      );
                      }

                      const renderType =
                        value.render_type ||
                        getFieldRenderType(key, value.type || field.field_type || "text");

                      // Render Phone Input
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
                                  label={capitalise(value.name)}
                                  placeholder="123 456 7890"
                                  name={`${key}.value`}
                                  control={form.control}
                                  country={phoneCountryCode}
                                  required={value.is_mandatory}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      );
                      }

                      // Render Email
                      if (renderType === FieldRenderType.EMAIL) {
                        return (
                        <FormField
                          key={key}
                          control={form.control}
                          name={`${key}.value`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <MyInput
                                  inputType="email"
                                  inputPlaceholder="example@email.com"
                                  input={field.value || ""}
                                  onChangeFunction={field.onChange}
                                  required={value.is_mandatory}
                                  size="large"
                                  label={capitalise(value.name)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      );
                      }

                      // Render Dropdown
                      if (value.type === "dropdown") {
                        const options = parseDropdownOptions(value.config || "{}");
                        return (
                        <SelectField
                          key={key}
                          label={capitalise(value.name)}
                          name={`${key}.value`}
                          options={options}
                          control={form.control}
                          required={value.is_mandatory}
                          className="!w-full"
                        />
                      );
                      }

                      // Render Text/Number Input
                      return (
                        <FormField
                        key={key}
                        control={form.control}
                        name={`${key}.value`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <MyInput
                                inputType={getInputType(
                                  value.type,
                                  renderType
                                )}
                                inputPlaceholder={`Enter ${value.name}`}
                                input={field.value || ""}
                                onChangeFunction={field.onChange}
                                required={value.is_mandatory}
                                size="large"
                                label={capitalise(value.name)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      );
                    })}
                  </>
                )}

                {/* Submit Button */}
                <div className="flex justify-end mt-4">
                  <MyButton
                    type="submit"
                    buttonType="primary"
                    scale="large"
                    layoutVariant="default"
                    disabled={loading}
                    className="min-w-[120px]"
                  >
                    {loading ? "Submitting..." : "Submit Response"}
                  </MyButton>
                </div>
              </form>
            </FormProvider>
          </ModernCard>
        </div>
      </div>
    </div>
  );
};

export default AudienceResponseForm;

