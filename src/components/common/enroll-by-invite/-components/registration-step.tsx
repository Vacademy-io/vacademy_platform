import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, RotateCcw } from "lucide-react";
import { FormProvider, UseFormReturn, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import PhoneInputField from "@/components/design-system/phone-input-field";
import SelectField from "@/components/design-system/select-field";
import ComboboxField from "@/components/design-system/combobox-field";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { Calendar, CreditCard, Globe } from "@phosphor-icons/react";
import { getDefaultPlanFromPaymentsData, PaymentPlan } from "../-utils/helper";
import { SubscriptionPlanSection } from "./subscription-plan-sections";
import { OneTimePlanSection } from "./onetime-plan-section";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  LIVE_SESSION_REQUEST_OTP,
  LIVE_SESSION_VERIFY_OTP,
} from "@/constants/urls";
import axios from "axios";
import {
  FieldRenderType,
  getInputType,
  getFieldRenderType,
  parseDropdownOptions,
} from "../-utils/custom-field-helpers";
import { capitalise } from "@/utils/custom-field";
import {
  getCountryCode,
  findCountryFieldKey,
} from "../-utils/country-code-mapping";
import { EMAIL_OTP_VERIFICATION_ENABLED } from "@/constants/feature-flags";
// Replace heavy country-state-city with lightweight country-region-data
// import { State, City } from "country-state-city";
import { allCountries } from "country-region-data";

// Course data interface
export interface FinalCourseData {
  aboutCourse: string;
  course: string;
  courseBanner: string;
  customHtml: string;
  description: string;
  includeInstituteLogo: boolean;
  includePaymentPlans: boolean;
  learningOutcome: string;
  restrictToSameBatch: boolean;
  showRelatedCourses: boolean;
  tags: string[];
  targetAudience: string;
}

// Form field value interface
export interface FormFieldValue {
  id: string;
  name: string;
  value: string;
  is_mandatory: boolean;
  type: string;
  render_type?: FieldRenderType; // Add render type to determine how to display the field
  comma_separated_options?: Array<{
    _id: number;
    value: string;
    label: string;
  }>;
  config?: string;
}

// Form values interface
export interface FormValues {
  [key: string]: FormFieldValue;
}

// Invite data interface
export interface InviteData {
  id: string;
  institute_id: string;
  type: string;
  type_id: string;
  custom_field: {
    id: string;
    fieldKey: string;
    fieldName: string;
    fieldType: string;
    defaultValue: string;
    config: string;
    formOrder: number;
    isMandatory: boolean;
    isFilter: boolean;
    isSortable: boolean;
    createdAt: string;
    updatedAt: string;
    sessionId: string;
    liveSessionId: string | null;
    customFieldValue: string | null;
  };
}

// Registration step props interface
export interface RegistrationStepProps {
  /** Course data containing all course-related information */
  courseData: FinalCourseData;
  /** Invite data containing custom field configurations */
  inviteData: InviteData | null;
  /** Institute ID for OTP verification */
  instituteId: string;
  /** Callback function called when form is submitted */
  onSubmit: (values: FormValues) => void;
  /** React Hook Form instance */
  form: UseFormReturn<FormValues>;
}

const currencySymbols: { [key: string]: string } = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
};

export const getCurrencySymbol = (currencyCode: string) => {
  return currencySymbols[currencyCode] || currencyCode;
};

export const getPaymentPlanIcon = (type: string) => {
  switch (type) {
    case "SUBSCRIPTION":
      return <Calendar className="size-5" />;
    case "FREE":
      return <Globe className="size-5" />;
    default:
      return <CreditCard className="size-5" />;
  }
};

export const getAllUniqueFeatures = (
  paymentOptions: PaymentPlan[]
): string[] => {
  const allFeatures = new Set<string>();
  paymentOptions?.map((option) => {
    const features = JSON.parse(option.feature_json || "[]") as string[];
    features?.forEach((feature: string) => {
      allFeatures.add(feature);
    });
  });
  return Array.from(allFeatures);
};

const RegistrationStep = ({
  courseData,
  inviteData,
  instituteId,
  onSubmit,
  form,
}: RegistrationStepProps) => {
  // Sub-step: 0 = fill details, 1 = verify OTP
  const [subStep, setSubStep] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoadingOtp, setIsLoadingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  
  const planInfo =
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    inviteData?.package_session_to_payment_options?.[0]?.payment_option;
  const selectedPlan = getDefaultPlanFromPaymentsData(planInfo);

  // Find the country field key dynamically (memoized)
  const countryFieldKey = useMemo(() => {
    const values = form.getValues();
    return findCountryFieldKey(values);
  }, [form]);

  // Watch all form values to detect country field changes
  const formValues = useWatch({
    control: form.control,
  });

  // Determine the phone country code based on country field value
  const getPhoneCountryCode = (): string => {
    if (countryFieldKey && formValues) {
      const countryField = formValues[countryFieldKey];
      if (countryField && typeof countryField.value === "string") {
        return getCountryCode(countryField.value, "in");
      }
    }
    return "gb"; // Default to United Kingdom
  };

  // Memoize state and city options to prevent recalculation on every render
  // This fixes the "Maximum call stack size exceeded" error on mobile
  // Extract specific values needed for options calculation
  // We use formValues from useWatch or fall back to getValues
  const currentValues = formValues || form.getValues();
  const currentCountryValue = countryFieldKey ? currentValues[countryFieldKey]?.value : undefined;

  // Memoize state and city options to prevent recalculation on every render
  // heavily optimized to run ONLY when country or state actually changes
  // Use state + useEffect for heavy calculations to avoid blocking render stack
  const [availableStateOptions, setAvailableStateOptions] = useState<{ _id: number; value: string; label: string }[]>([]);
  const [availableCityOptions, setAvailableCityOptions] = useState<{ _id: number; value: string; label: string }[]>([]);

  useEffect(() => {
    // If no country, clear options immediately
    if (!currentCountryValue) {
      setAvailableStateOptions([]);
      setAvailableCityOptions([]);
      return;
    }

    try {
      const countryCode = getCountryCode(String(currentCountryValue)).toUpperCase();
      
      // Find country in the lightweight dataset
      // Format: [CountryName, CountrySlug, Regions[]]
      const countryData = allCountries.find(c => c[1] === countryCode);
      
      let stateOptions: { _id: number; value: string; label: string }[] = [];

      if (countryData) {
        const regions = countryData[2]; // Index 2 is the regions array
         stateOptions = regions.map((region, index) => ({
            _id: index,
            value: region[0], // Index 0 is Region Name
            label: region[0],
         }));
      }

      setAvailableStateOptions(stateOptions);
      // Clear city options as they are not supported by this library
      setAvailableCityOptions([]);
      
    } catch (error) {
      console.error("Error calculating location options:", error);
    }
  }, [currentCountryValue]);

  // Helper function to find the email field dynamically
  const getEmailField = () => {
    const formData = form.getValues();
    const emailEntry = Object.entries(formData).find(([key, value]) => {
      const renderType =
        value.render_type || getFieldRenderType(key, value.type || "text");
      return renderType === FieldRenderType.EMAIL;
    });
    return emailEntry
      ? { key: emailEntry[0], value: emailEntry[1].value }
      : null;
  };

  // Check if all required fields are filled (excluding email verification)
  const areAllFieldsFilled = () => {
    return Object.entries(form.getValues()).every(
      ([, value]: [string, FormFieldValue]) =>
        !value.is_mandatory || value.value
    );
  };

  // Handle "Next" click - validate form and send OTP (or skip if disabled)
  const handleNextClick = async () => {
    // Validate all fields first
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!areAllFieldsFilled()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const emailField = getEmailField();
    if (!emailField || !emailField.value) {
      toast.error("Please enter your email address");
      return;
    }

    const email = emailField.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // If email OTP verification is disabled, skip directly to form submission
    if (!EMAIL_OTP_VERIFICATION_ENABLED) {
      setIsEmailVerified(true);
      form.handleSubmit(onSubmit, (err) => console.error(err))();
      return;
    }

    setUserEmail(email);
    setIsLoadingOtp(true);

    try {
      await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        { to: email },
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
          params: { instituteId },
        }
      );

      setSubStep(1);
      toast.success("Verification code sent to your email");
    } catch (error) {
      toast.error("Failed to send verification code. Please try again");
      console.error("Send OTP Error:", error);
    } finally {
      setIsLoadingOtp(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setIsLoadingOtp(true);
    try {
      await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        { to: userEmail },
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
          params: { instituteId },
        }
      );
      toast.success("Verification code resent");
    } catch (error) {
      toast.error("Failed to resend. Please try again");
      console.error("Resend OTP Error:", error);
    } finally {
      setIsLoadingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length < 4) {
      toast.error("Please enter a valid verification code");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await axios.post(
        LIVE_SESSION_VERIFY_OTP,
        {
          to: userEmail,
          otp: otp,
          client_name: "LEARNER",
          institute_id: instituteId,
        },
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
        }
      );

      setIsEmailVerified(true);
      toast.success("Email verified successfully!");
      
      // Auto-submit the form after successful verification
      setTimeout(() => {
        form.handleSubmit(onSubmit, (err) => console.error(err))();
      }, 500);
    } catch (error) {
      toast.error("Invalid code. Please check and try again");
      console.error("Verify Email Error:", error);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Go back to details form
  const handleBackToDetails = () => {
    setSubStep(0);
    setOtp("");
  };

  // Render OTP Verification Step
  if (subStep === 1) {
    return (
      <Card id="registration-card" className="overflow-hidden border border-gray-200 w-full">
        <CardContent className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Verify Your Email
            </h2>
            <p className="text-sm text-gray-500">
              We've sent a verification code to
            </p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {userEmail}
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Can't find the email?</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>Check your <strong>Spam</strong> or <strong>Junk</strong> folder</li>
                  <li>Make sure the email address is correct</li>
                  <li>Wait a few seconds and refresh your inbox</li>
                </ul>
              </div>
            </div>
          </div>

          {/* OTP Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                maxLength={6}
                autoFocus
                disabled={isVerifyingOtp || isEmailVerified}
              />
            </div>

            {/* Verify Button */}
            <MyButton
              type="button"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              onClick={handleVerifyOTP}
              disable={isVerifyingOtp || otp.length < 4 || isEmailVerified}
              className="w-full"
            >
              {isVerifyingOtp ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : isEmailVerified ? (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Verified! Proceeding...
                </>
              ) : (
                "Verify & Continue"
              )}
            </MyButton>

            {/* Resend & Back Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleBackToDetails}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                disabled={isVerifyingOtp}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Edit Details
              </button>
              
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isLoadingOtp || isVerifyingOtp}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {isLoadingOtp ? "Sending..." : "Resend Code"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render Registration Details Form (subStep === 0)
  return (
    <>
      <Card id="registration-card" className="overflow-hidden border border-gray-200 w-full">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="flex items-start gap-2 sm:gap-3 mb-5">
            <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg flex-shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                Registration Details
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Fill in your details to enroll in the course
              </p>
            </div>
          </div>

          <Separator className="mb-5" />

          <FormProvider {...form}>
            <form className="w-full flex flex-col gap-4">
              {Object.entries((formValues || form.getValues()) as Record<string, FormFieldValue>).map(
                ([key, value]) => {
                  const renderType = value.render_type
                    ? value.render_type
                    : getFieldRenderType(key, value.type || "text");

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

                  // Render Email - Simple input without OTP buttons
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
                                inputPlaceholder={value.name}
                                input={field.value}
                                onChangeFunction={field.onChange}
                                required={value.is_mandatory}
                                size="large"
                                label={capitalise(value.name)}
                                className="w-full"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    );
                  }

                  // Render Dropdown
                  // Skip City dropdown if we don't have city options (fallback to text input)
                  if (
                    renderType === FieldRenderType.DROPDOWN &&
                    (!key.toLowerCase().includes("city") ||
                      availableCityOptions.length > 0)
                  ) {
                    let dropdownOptions = value.comma_separated_options
                      ? value.comma_separated_options
                      : parseDropdownOptions(value.config || "{}");

                    if (
                      dropdownOptions.length === 0 &&
                      value.comma_separated_options
                    ) {
                      if (Array.isArray(value.comma_separated_options)) {
                        dropdownOptions = (
                          value.comma_separated_options as unknown[]
                        ).map((option: unknown, index: number) => {
                          if (typeof option === "string") {
                            return {
                              _id: index,
                              value: option,
                              label: option,
                            };
                          }
                          return option as {
                            _id: number;
                            value: string;
                            label: string;
                          };
                        });
                      }
                    }

                    return (
                      <FormField
                        key={key}
                        control={form.control}
                        name={`${key}.value`}
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <SelectField
                                label={capitalise(value.name)}
                                name={`${key}.value`}
                                options={dropdownOptions}
                                control={form.control}
                                required={value.is_mandatory}
                                className="!w-full"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    );
                  }

                  // Render State Dropdown if country is selected
                  const isStateField =
                    key.toLowerCase().includes("state") &&
                    !key.toLowerCase().includes("statement");

                  if (isStateField && availableStateOptions.length > 0) {
                          return (
                            <ComboboxField
                              key={key}
                              label={capitalise(value.name)}
                              name={`${key}.value`}
                              options={availableStateOptions}
                              control={form.control}
                              required={value.is_mandatory}
                              className="!w-full"
                            />
                          );
                  }

                  // Render City Dropdown
                  const isCityField =
                    key.toLowerCase().includes("city") &&
                    !key.toLowerCase().includes("ethnicity");

                  // If it's a city field and we have options, render combobox
                  // Otherwise, it falls through to the default text input which is exactly what we want
                  if (isCityField && availableCityOptions.length > 0) {
                    return (
                      <ComboboxField
                        key={key}
                        label={capitalise(value.name)}
                        name={`${key}.value`}
                        options={availableCityOptions}
                        control={form.control}
                        required={value.is_mandatory}
                        className="!w-full"
                      />
                    );
                  }

                  // Render Text Input (default)
                  return (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`${key}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <MyInput
                              inputType={getInputType(value.type, renderType)}
                              inputPlaceholder={value.name}
                              input={field.value}
                              onChangeFunction={field.onChange}
                              required={value.is_mandatory}
                              size="large"
                              label={capitalise(value.name)}
                              className="!max-w-full !w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  );
                }
              )}
              
              {/* Next Button */}
              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  onClick={() => form.reset()}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                
                <MyButton
                  type="button"
                  buttonType="primary"
                  scale="large"
                  layoutVariant="default"
                  onClick={handleNextClick}
                  disable={isLoadingOtp || form.formState.isSubmitting}
                  className="min-w-[140px]"
                >
                  {isLoadingOtp || form.formState.isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Next
                      <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </MyButton>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
      
      {courseData?.customHtml && (
        <Card className="overflow-hidden border border-gray-200 w-full mt-4">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{
                __html: courseData?.customHtml || "",
              }}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Show selected plan in a card */}
      {(selectedPlan?.type === "SUBSCRIPTION" ||
        selectedPlan?.type === "ONE_TIME") &&
        courseData.includePaymentPlans && (
          <Card className="mt-4 flex flex-col gap-0 border border-gray-200">
            <div className="flex flex-col items-start gap-3 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                {getPaymentPlanIcon(selectedPlan?.type || "")}
                <div className="flex flex-1 flex-col font-semibold">
                  <span>{selectedPlan?.name}</span>
                </div>
              </div>
              {selectedPlan?.type === "ONE_TIME" && (
                <OneTimePlanSection
                  payment_options={selectedPlan?.payment_options || []}
                  currency={getCurrencySymbol(selectedPlan?.currency || "")}
                  discount_json={selectedPlan?.discount_json || null}
                  selectedPayment={null}
                  onSelect={() => {}}
                />
              )}
              {selectedPlan?.type === "SUBSCRIPTION" && (
                <SubscriptionPlanSection
                  payment_options={selectedPlan?.payment_options || []}
                  currency={getCurrencySymbol(selectedPlan?.currency || "")}
                  features={getAllUniqueFeatures(
                    selectedPlan.payment_options || []
                  )}
                  discount_json={selectedPlan?.discount_json}
                  selectedPayment={null}
                  onSelect={() => {}}
                />
              )}
            </div>
          </Card>
        )}
    </>
  );
};

export default RegistrationStep;
