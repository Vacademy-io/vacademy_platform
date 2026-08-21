import { useEffect, useMemo, useState } from "react";
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
import { Check } from "@phosphor-icons/react";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import PhoneInputField from "@/components/design-system/phone-input-field";
import {
  FieldRenderType,
  getFieldRenderType,
} from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";
import { CustomFieldRenderer } from "@/components/common/custom-fields/CustomFieldRenderer";
import { capitalise } from "@/utils/custom-field";
import {
  getCountryCode,
  findCountryFieldKey,
} from "@/components/common/enroll-by-invite/-utils/country-code-mapping";
import { getCachedPreferredCountries } from "@/services/domain-routing";
import type { AudienceCampaignResponse } from "../-services/audience-campaign-services";
import {
  submitAudienceLead,
  handleSubmitAudienceLead,
  extractRespondentIdentity,
} from "../-services/audience-campaign-services";
import {
  parsePostSubmitConfiguration,
  applyPostSubmitTokens,
  sanitizePostSubmitHtml,
  resolvePostSubmitButtons,
  isExternalPostSubmitUrl,
  type PostSubmitTokens,
} from "../-utils/post-submit-config";
import { usePostSubmitRedirect } from "../-utils/use-post-submit-redirect";
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
        // Order by the per-form mapping order (individual_order) so each form controls
        // its own field sequence. Fall back to the nested/master order only when the
        // mapping has none. Use ?? (not ||) so a valid 0 (first position) is respected.
        field_order:
          field.individual_order ??
          customField.individualOrder ??
          customField.formOrder ??
          0,
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
  // What the visitor typed, kept after the form resets so the thank-you screen
  // can resolve {{name}} / {{email}} tokens.
  const [respondent, setRespondent] = useState<PostSubmitTokens>({});

  // Admin-authored thank-you screen / redirect. Falls back to the previous
  // hardcoded copy for campaigns that predate the feature.
  const postSubmitConfig = useMemo(
    () => parsePostSubmitConfiguration(campaignData.setting_json),
    [campaignData.setting_json]
  );
  const postSubmitTokens: PostSubmitTokens = useMemo(
    () => ({ ...respondent, campaignName: campaignData.campaign_name }),
    [respondent, campaignData.campaign_name]
  );
  const { redirectUrl, secondsLeft } = usePostSubmitRedirect(
    postSubmitConfig,
    postSubmitTokens,
    // Gated on the master switch: a campaign that never enabled this must never
    // redirect anyone, whatever else is sitting in its setting_json.
    isSubmitted && postSubmitConfig.enabled
  );

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
      // Multi-input revamp (2026-04): always forward `config` and the parsed
      // options so non-dropdown types (radio, date, file, checkbox, etc.) can
      // read their metadata from `value.config` inside CustomFieldRenderer.
      // Previously only dropdown fields carried `config`, so the shared
      // renderer fell back to text input for everything else.
      defaults[field.field_key] = {
        id: field.id,
        name: field.field_name,
        value: "",
        is_mandatory: field.is_mandatory || false,
        type: field.field_type,
        config: field.config || "{}",
      };
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

  // Get phone country code dynamically, falling back to the institute's
  // configured preferred country (commaSeparatedPreferredCountry) instead of
  // a hardcoded default so the phone input honors institute settings.
  const getPhoneCountryCode = () => {
    const preferred = getCachedPreferredCountries();
    const fallback = preferred[0] ?? "in";
    const formValues = form.getValues();
    const countryFieldKey = findCountryFieldKey(formValues);
    if (countryFieldKey) {
      const countryValue = formValues[countryFieldKey]?.value || "";
      return getCountryCode(countryValue, fallback);
    }
    return fallback;
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

      // Capture identity BEFORE the reset — the thank-you screen and the
      // redirect URL both interpolate it.
      setRespondent(
        extractRespondentIdentity(
          values as Record<string, { value: string; id: string }>
        )
      );

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
    // Master switch off (the default) → the exact screen this page rendered
    // before the feature existed.
    const useCustomScreen = postSubmitConfig.enabled;
    const successTitle = applyPostSubmitTokens(
      postSubmitConfig.successTitle,
      postSubmitTokens
    );
    const successMessage = applyPostSubmitTokens(
      postSubmitConfig.successMessage,
      postSubmitTokens
    );
    // Custom HTML replaces the plain message when the admin supplied one.
    const successHtml = postSubmitConfig.content.trim()
      ? sanitizePostSubmitHtml(
          applyPostSubmitTokens(postSubmitConfig.content, postSubmitTokens)
        )
      : "";
    // Buttons pointing somewhere unsafe are dropped, not rendered dead.
    const actionButtons = resolvePostSubmitButtons(
      postSubmitConfig,
      postSubmitTokens
    );
    const showAnother = postSubmitConfig.allowAnotherResponse;
    const anotherLabel =
      applyPostSubmitTokens(postSubmitConfig.anotherResponseText, postSubmitTokens) ||
      "Submit another response";

    const handleAnotherResponse = () => {
      form.reset(defaultValues);
      setRespondent({});
      setIsSubmitted(false);
    };

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
                  hideInstituteName: domainRouting.hideInstituteName,
                  logoWidthPx: domainRouting.logoWidthPx,
                  logoHeightPx: domainRouting.logoHeightPx,
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
                {/* Success icon — unchanged whether or not the campaign uses a
                    custom screen; only the copy and actions are configurable. */}
                <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-success-100">
                  <Check className="size-10 text-success-600" weight="bold" aria-hidden="true" />
                </div>

                {/* Success Message — copy, CTA and redirect all come from the
                    campaign's Post Submit Configuration. */}
                <div className="space-y-3">
                  {(useCustomScreen ? successTitle : "Registration Successful!") && (
                    <h2 className="text-2xl sm:text-3xl font-bold text-neutral-800">
                      {useCustomScreen ? successTitle : "Registration Successful!"}
                    </h2>
                  )}
                  {useCustomScreen && successHtml ? (
                    <div
                      className="text-lg text-neutral-600 [&_a]:text-primary-500 [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:mx-auto [&_img]:max-w-full [&_li]:list-inside [&_ol]:list-decimal [&_ul]:list-disc"
                      dangerouslySetInnerHTML={{ __html: successHtml }}
                    />
                  ) : (
                    (useCustomScreen
                      ? successMessage
                      : "Thank you for your response. Your form has been submitted successfully.") && (
                      <p className="text-lg text-neutral-600 whitespace-pre-line">
                        {useCustomScreen
                          ? successMessage
                          : "Thank you for your response. Your form has been submitted successfully."}
                      </p>
                    )
                  )}
                  {campaignData.send_respondent_email && (
                    <p className="text-sm text-neutral-500">
                      A confirmation email will be sent to you shortly.
                    </p>
                  )}
                  {redirectUrl && secondsLeft !== null && (
                    <p className="text-sm text-neutral-500">
                      Redirecting in {secondsLeft}
                      {secondsLeft === 1 ? " second" : " seconds"}…
                    </p>
                  )}
                </div>

                {useCustomScreen && (actionButtons.length > 0 || showAnother) && (
                  <div className="flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
                    {actionButtons.map((button) => (
                      // Anchors, not buttons: middle-click / "open in new tab"
                      // is what people expect from a link on a thank-you page.
                      <a
                        key={button.id}
                        href={button.href}
                        {...(isExternalPostSubmitUrl(button.href)
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className={
                          button.variant === "primary"
                            ? "inline-flex items-center justify-center rounded-lg bg-primary-500 px-6 py-2.5 text-subtitle font-semibold text-white transition-colors hover:bg-primary-600"
                            : "inline-flex items-center justify-center rounded-lg border border-neutral-300 px-6 py-2.5 text-subtitle font-semibold text-neutral-600 transition-colors hover:border-neutral-400"
                        }
                      >
                        {button.text}
                      </a>
                    ))}
                    {showAnother && (
                      <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="large"
                        layoutVariant="default"
                        onClick={handleAnotherResponse}
                      >
                        {anotherLabel}
                      </MyButton>
                    )}
                  </div>
                )}
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
                hideInstituteName: domainRouting.hideInstituteName,
                logoWidthPx: domainRouting.logoWidthPx,
                logoHeightPx: domainRouting.logoHeightPx,
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
                        // Fallback: render using the shared renderer with whatever
                        // metadata we can derive from the field definition.
                        const fallbackRenderType = getFieldRenderType(
                          key,
                          field.field_type || "text"
                        );
                        return (
                          <FormField
                            key={key}
                            control={form.control}
                            name={`${key}.value`}
                            render={({ field: formField }) => (
                              <FormItem>
                                <div className="flex flex-col gap-1">
                                  {/* Checkbox fields render their own inline
                                      label (and optional description block)
                                      inside the renderer — skip the label-above
                                      to avoid a duplicate. */}
                                  {fallbackRenderType !== FieldRenderType.CHECKBOX && (
                                    <label className="text-subtitle font-regular">
                                      {capitalise(field.field_name)}
                                      {field.is_mandatory && (
                                        <span className="text-danger-600"> *</span>
                                      )}
                                    </label>
                                  )}
                                  <FormControl>
                                    <CustomFieldRenderer
                                      type={fallbackRenderType}
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
                      }

                      const renderType =
                        value.render_type ||
                        getFieldRenderType(key, value.type || field.field_type || "text");

                      // Phone: use the specialized PhoneInputField with country-code detection
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
                                    labelClassName="text-subtitle font-regular"
                                    inputClassName="!text-subtitle placeholder:!text-body"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        );
                      }

                      // All other types — shared renderer handles text, number,
                      // email, url, date, textarea, checkbox, radio, dropdown, file
                      return (
                        <FormField
                          key={key}
                          control={form.control}
                          name={`${key}.value`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <div className="flex flex-col gap-1">
                                {/* Checkbox fields render their own inline label
                                    (and optional description block) inside the
                                    renderer — skip the label-above to avoid a
                                    duplicate. */}
                                {renderType !== FieldRenderType.CHECKBOX && (
                                  <label className="text-subtitle font-regular">
                                    {capitalise(value.name)}
                                    {value.is_mandatory && (
                                      <span className="text-danger-600"> *</span>
                                    )}
                                  </label>
                                )}
                                <FormControl>
                                  <CustomFieldRenderer
                                    type={renderType}
                                    name={value.name}
                                    value={formField.value || ""}
                                    onChange={(val) => formField.onChange(val)}
                                    config={value.config}
                                    options={value.comma_separated_options}
                                    required={value.is_mandatory}
                                  />
                                </FormControl>
                              </div>
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
                    className="min-w-32"
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

