import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, RotateCcw } from "lucide-react";
import { FormProvider, UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import PhoneInputField from "@/components/design-system/phone-input-field";
import SelectField from "@/components/design-system/select-field";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { Calendar, CreditCard, Globe } from "phosphor-react";
import { getDefaultPlanFromPaymentsData, PaymentPlan } from "../-utils/helper";
import { SubscriptionPlanSection } from "./subscription-plan-sections";
import { OneTimePlanSection } from "./onetime-plan-section";
import { useState } from "react";
import { toast } from "sonner";
import { LIVE_SESSION_REQUEST_OTP, LIVE_SESSION_VERIFY_OTP } from "@/constants/urls";
import axios from "axios";

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
  comma_separated_options?: string[];
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
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoadingOtp, setIsLoadingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const planInfo =
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    inviteData?.package_session_to_payment_options?.[0]?.payment_option;
  const selectedPlan = getDefaultPlanFromPaymentsData(planInfo);

  // Send OTP for email verification
  const handleSendOTP = async () => {
    const email = form.getValues("email")?.value;
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoadingOtp(true);
    try {
      await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        {
          institute_id: instituteId,
          to: email,
        },
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
        }
      );

      setOtpSent(true);
      toast.success("OTP sent to your email");
    } catch (error) {
      toast.error("Failed to send OTP. Please try again");
      console.error("Send OTP Error:", error);
    } finally {
      setIsLoadingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    const email = form.getValues("email")?.value;
    setIsVerifyingOtp(true);
    try {
      await axios.post(
        LIVE_SESSION_VERIFY_OTP,
        {
          to: email,
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
      setOtpSent(false);
      setOtp("");
      toast.success("Email verified successfully");
    } catch (error) {
      toast.error("Failed to verify OTP. Please try again");
      console.error("Verify OTP Error:", error);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    return (
      isEmailVerified &&
      Object.entries(form.getValues()).every(
        ([, value]: [string, FormFieldValue]) =>
          !value.is_mandatory || value.value
      )
    );
  };

  return (
    <>
      {/* Show selected plan in a card */}
      {(selectedPlan?.type === "SUBSCRIPTION" ||
        selectedPlan?.type === "ONE_TIME") &&
        courseData.includePaymentPlans && (
          <Card className="mb-4 flex flex-col gap-0">
            <div className="flex flex-col items-start gap-3 p-4">
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
      <Card
        id="registration-card"
        className="overflow-hidden shadow-lg border bg-white w-full"
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3 mb-6">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                Registration Details
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Fill in your details to enroll in the course
              </p>
            </div>
          </div>

          <Separator className="mb-6" />

          <div className="flex justify-center items-center w-full">
            <div className="flex justify-center items-start w-full flex-col bg-white rounded-xl py-0 mb-4">
              <FormProvider {...form}>
                <form className="w-full flex flex-col gap-4 mt-4 max-h-full overflow-auto">
                  {Object.entries(form.getValues()).map(
                    ([key, value]: [string, FormFieldValue]) =>
                      key === "phone_number" ? (
                        <FormField
                          key={key}
                          control={form.control}
                          name={`${key}.value`}
                          render={() => (
                            <FormItem>
                              <FormControl>
                                <PhoneInputField
                                  label="Phone Number"
                                  placeholder="123 456 7890"
                                  name={`${key}.value`}
                                  control={form.control}
                                  country="gb"
                                  required
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      ) : key === "email" ? (
                        <div key={key} className="space-y-3">
                          <FormField
                            control={form.control}
                            name={`${key}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="flex items-center gap-2">
                                    <MyInput
                                      inputType="email"
                                      inputPlaceholder={value.name}
                                      input={field.value}
                                      onChangeFunction={(e) => {
                                        field.onChange(e);
                                        // Reset verification state when email changes
                                        if (isEmailVerified || otpSent) {
                                          setIsEmailVerified(false);
                                          setOtpSent(false);
                                          setOtp("");
                                        }
                                      }}
                                      required={value.is_mandatory}
                                      size="large"
                                      label={value.name}
                                      className=" !w-[300px] md:!w-[360px] lg:!w-[560px] xl:!w-[760px] 2xl:!w-[860px]"
                                      disabled={isEmailVerified}
                                      style={{ width: "100%" }}
                                    />
                                    {!otpSent && !isEmailVerified && (
                                      <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        onClick={handleSendOTP}
                                        disable={isLoadingOtp || !field.value}
                                        className="mt-8"
                                      >
                                        {isLoadingOtp
                                          ? "Sending..."
                                          : "Send OTP"}
                                      </MyButton>
                                    )}
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {otpSent && !isEmailVerified && (
                            <div className="flex gap-2">
                              <MyInput
                                inputType="text"
                                inputPlaceholder="Enter 6-digit OTP"
                                input={otp}
                                onChangeFunction={(e) => setOtp(e.target.value)}
                                required={true}
                                size="large"
                                label="OTP Code"
                                className="!max-w-full !w-full"
                                maxLength={6}
                              />
                              <MyButton
                                type="button"
                                buttonType="primary"
                                onClick={handleVerifyOTP}
                                disable={isVerifyingOtp || !otp.trim()}
                                className="mt-8 whitespace-nowrap"
                              >
                                {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                              </MyButton>
                            </div>
                          )}

                          {isEmailVerified && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <span>✓</span> Email verified successfully
                            </p>
                          )}
                        </div>
                      ) : (
                        <FormField
                          key={key}
                          control={form.control}
                          name={`${key}.value`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                {value.type === "dropdown" ? (
                                  <SelectField
                                    label={value.name}
                                    name={`${key}.value`}
                                    options={
                                      value.comma_separated_options?.map(
                                        (option: string, index: number) => ({
                                          value: option,
                                          label: option,
                                          _id: index,
                                        })
                                      ) || []
                                    }
                                    control={form.control}
                                    required={value.is_mandatory}
                                    className="!w-full"
                                  />
                                ) : (
                                  <MyInput
                                    inputType="text"
                                    inputPlaceholder={value.name}
                                    input={field.value}
                                    onChangeFunction={field.onChange}
                                    required={value.is_mandatory}
                                    size="large"
                                    label={value.name}
                                    className="!max-w-full !w-full"
                                  />
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )
                  )}
                  <div className="flex items-center justify-center flex-col gap-4">
                    <MyButton
                      type="button"
                      buttonType="primary"
                      scale="large"
                      layoutVariant="default"
                      onClick={form.handleSubmit(onSubmit, (err) =>
                        console.error(err)
                      )}
                      disable={!isFormValid()}
                      className="w-full md:w-fit bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2.5 px-5 rounded-md transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <GraduationCap className="w-5 h-5 mr-2" />
                      {!isEmailVerified ? "Verify Email First" : "Register"}
                    </MyButton>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-2 cursor-pointer transition-colors duration-200"
                      onClick={() => form.reset()}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Form
                    </button>
                  </div>
                </form>
              </FormProvider>
            </div>
          </div>
        </CardContent>
      </Card>
      {courseData?.customHtml && (
        <Card
          id="registration-card"
          className="overflow-hidden shadow-lg border bg-white w-full"
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3 mb-6">
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{
                  __html: courseData?.customHtml || "",
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default RegistrationStep;
