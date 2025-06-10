import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { MyInput } from "@/components/design-system/input";
import { useEffect, useRef, useState } from "react";
import { useSessionCustomFields } from "../-hooks/useGetRegistrationFormData";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { generateZodSchema } from "../-types/registrationFormSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  FieldErrors,
  FormProvider,
  useForm,
} from "react-hook-form";
import SelectField from "@/components/design-system/select-field";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import dayjs from "dayjs";
import CountdownTimer from "./CountDown";
import { RegistrationLogo } from "@/svgs";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  LIVE_SESSION_CHECK_EMAIL_REGISTRATION,
  LIVE_SESSION_REQUEST_OTP,
  LIVE_SESSION_VERIFY_OTP,
  REQUEST_OTP,
  // SEND_LIVE_SESSION_EMAIL_VERIFICATION_OTP,
} from "@/constants/urls";
import { toast } from "sonner";
import { transformToGuestRegistrationDTO } from "../-utils/helper";
import { useRouter } from "@tanstack/react-router";
import { AccessLevel } from "../-types/enum";
import {
  ApiError,
  DropdownOption,
  RegistrationFormValues,
} from "../-types/type";
import { useLiveSessionGuestRegistration } from "../-hooks/useLiveSessionGuestRegistration";
import { useInstituteDetails } from "../-hooks/useInstituteDetails";

export const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z
    .array(z.string().length(1, "Each digit must be 1 character"))
    .length(6, "OTP must be 6 digits"),
});

export default function LiveClassRegistrationPage() {
  const [dialog, setDialog] = useState<boolean>(true);
  const [isOtpSent, setIsOTPSent] = useState<boolean>(false);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { sessionId } = router.state.location.search;
  const { data, isLoading } = useSessionCustomFields(sessionId || "");
  const { data: instituteDetails } = useInstituteDetails();

  const { mutate: registerGuestUser } = useLiveSessionGuestRegistration();

  useEffect(() => {
    if (!sessionId) {
      router.navigate({ to: "/dashboard" });
    }
  }, [sessionId]);

  useEffect(() => {
    if (data?.accessLevel === AccessLevel.PRIVATE) {
      router.navigate({ to: "/study-library/live-class" });
    }
  }, [data]);

  const schema = generateZodSchema(data?.customFields);
  const form = useForm({
    resolver: zodResolver(schema),
  });
  const verificationForm = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: "",
      otp: Array(6).fill(""), // Empty array for 6 digits
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    formState: { errors },
  } = form;

  const onSubmit = (formValues: RegistrationFormValues) => {
    console.log("data ", formValues);
    try {
      const payload = transformToGuestRegistrationDTO(
        formValues,
        data?.sessionId || "",
        data?.customFields || []
      );

      registerGuestUser(payload);
    } catch (error) {
      toast.error("Error building request");
      console.error("DTO transformation error:", error);
    }
  };

  const onError = (errors: FieldErrors<typeof schema>) => {
    console.log("Validation errors:", errors);
    // You can show a toast or scroll to the first error here
  };

  const checkEmailRegistration = async (email: string) => {
    try {
      const response = await axios.get(LIVE_SESSION_CHECK_EMAIL_REGISTRATION, {
        headers: {
          "Content-Type": "application/json",
        },
        params: {
          sessionId: data?.sessionId,
          email: email,
        },
      });

      if (response.data === true) {
        toast.success("Email already registered");
      } else {
        toast.error("Email not registered");
      }
    } catch (error) {
      console.error("Failed to check email registration:", error);
    }
  };

  const sendEmailOtp = async (email: string) => {
    try {
      await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        { to: email },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      setIsOTPSent(true);
      toast.success("OTP sent successfully");
    } catch (error) {
      const apiError = error as ApiError;
      console.error(
        "Failed to send OTP:",
        apiError.response?.data || apiError.message
      );
      toast.error("Failed to send OTP");
      throw error;
    }
  };

  const verifyEmailOtp = async (email: string, otp: string) => {
    try {
      const response = await axios.post(
        LIVE_SESSION_VERIFY_OTP,
        { to: email, otp },
        {
          headers: {
            "Content-Type": "application/json",
          },
          params: {
            sessionId: data?.sessionId,
          },
        }
      );

      if (response.status === 200) {
        toast.success("OTP verified successfully");
        checkEmailRegistration(email);
        handleCloseAlertDialog();
      } else {
        toast.error("Wrong OTP entered");
      }

      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      console.error(
        "Failed to verify OTP:",
        apiError.response?.data || apiError.message
      );
      toast.error("OTP verification failed");
      throw error;
    }
  };

  const handleCloseAlertDialog = () => {
    setDialog(false);
  };

  const sendOtpMutation = useMutation({
    mutationFn: (email: string) => axios.post(REQUEST_OTP, { email }),
    onSuccess: () => {
      setIsOTPSent(true);
      startTimer();
      toast.success("OTP sent successfully");
      // setUserAlreadyRegistered(false);
    },
    onError: async () => {
      // await removeTokensAndLogout();
      toast.error("This email is not registered", {
        description: "Please register yourself to attempt this assessment",
        duration: 3000,
      });
      // setUserAlreadyRegistered(true);
      handleCloseAlertDialog();
    },
  });

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // Allow only numbers

    const otpArray = [...verificationForm.getValues("otp")];
    otpArray[index] = value;
    verificationForm.setValue("otp", otpArray, { shouldValidate: true });

    // Auto-focus next field
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !form.getValues("otp")[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const startTimer = () => {
    setTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    return dayjs(dateStr).format("hh:mm A");
  };

  if (isLoading) return <DashboardLoader />;

  return (
    <>
      <div className="w-screen h-screen bg-primary-50 p-20 flex flex-row justify-around items-center">
        <div className="flex flex-col gap-6 h-full w-[40%] items-center">
          {instituteDetails?.logoUrl ? (
            <img
              src={instituteDetails.logoUrl}
              alt={instituteDetails.institute_name}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <div>Logo</div>
          )}
          <div className="text-h2">{data?.sessionTitle}</div>
          <div>
            {data?.startTime && (
              <CountdownTimer startTime={`${data.startTime}Z`} />
            )}
          </div>
          <div>Already Registered? Login with Email</div>
          <div>
            <RegistrationLogo />
          </div>
          <div className="flex flex-col gap-1">
            <div className="font-bold">Live Class Details</div>
            <div className="flex flex-row gap-6">
              <div className="flex flex-row gap-2">
                <div>Start Time:</div>
                <div>{formatDateTime(data?.startTime)}</div>
              </div>
              <div className="flex flex-row gap-2">
                <div>End Time:</div>
                <div>{formatDateTime(data?.lastEntryTime)}</div>
              </div>
              {data?.subject && (
                <div className="flex flex-row gap-2">
                  <div>Subject:</div>
                  <div>{data.subject}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="w-[35%] h-full flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-md h-full">
            <div className="flex flex-col gap-4 h-full">
              <div>
                <div className="font-bold">Live Class Registration Form</div>
                <div>
                  Join for the live class by filling in the details below.
                </div>
              </div>
              <FormProvider {...form}>
                <form
                  onSubmit={handleSubmit(onSubmit, onError)}
                  className="flex flex-col gap-4 h-full"
                >
                  <div className="flex flex-col gap-4 overflow-auto h-[85%]">
                    {data?.customFields?.map((responseField) => (
                      <div
                        key={responseField.fieldKey}
                        className="flex flex-col gap-4"
                      >
                        {responseField.fieldType.toLocaleLowerCase() ===
                        "dropdown" ? (
                          <SelectField
                            label={responseField.fieldName}
                            name={responseField.fieldKey}
                            options={JSON.parse(responseField.config).map(
                              (option: DropdownOption, idx: number) => ({
                                value: option.name,
                                label: option.label,
                                _id: idx,
                              })
                            )}
                            control={form.control}
                            className="mt-[8px] w-full font-thin"
                          />
                        ) : (
                          <FormField
                            control={form.control}
                            name={responseField.fieldKey}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <MyInput
                                    inputType="text"
                                    inputPlaceholder={field.name}
                                    input={field.value}
                                    labelStyle="font-thin"
                                    onChangeFunction={field.onChange}
                                    required={responseField.mandatory}
                                    size="large"
                                    label={responseField.fieldName}
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}

                        {errors[responseField.fieldKey] && (
                          <p style={{ color: "red" }}>
                            {errors[
                              responseField.fieldKey
                            ]?.message?.toString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <MyButton buttonType="primary" type="submit" className="mt-4">
                    Join Now
                  </MyButton>
                  {/* <MyButton
                    buttonType="text"
                    type="button"
                    className="text-primary-500"
                  >
                    Reset Form
                  </MyButton> */}
                </form>
              </FormProvider>
            </div>
          </div>
        </div>
      </div>
      <MyDialog
        open={dialog}
        // onOpenChange={setDialog}
        heading="Verify Email"
        className="w-1/3 h-fit"
      >
        <FormProvider {...verificationForm}>
          <div>
            <FormField
              control={verificationForm.control}
              name={"email"}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MyInput
                      inputType="text"
                      inputPlaceholder={field.name}
                      input={field.value}
                      labelStyle="font-thin"
                      onChangeFunction={field.onChange}
                      required
                      size="large"
                      label={"Email"}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-col gap-4 my-4">
            {isOtpSent && (
              <>
                <div className="flex justify-start gap-2">
                  {verificationForm
                    .watch("otp")
                    .map((val: string, index: number) => (
                      <Controller
                        key={`${index}${val}`}
                        name={`otp.${index}`}
                        control={verificationForm.control}
                        render={({ field }) => (
                          <input
                            ref={(el) => (otpRefs.current[index] = el)}
                            type="text"
                            maxLength={1}
                            value={field.value}
                            onChange={(e) =>
                              handleOtpChange(index, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="size-10 text-center border border-gray-300 rounded-md focus:outline-none"
                          />
                        )}
                      />
                    ))}
                </div>
                <h1
                  className="text-primary-500 text-xs -mt-3 cursor-pointer"
                  onClick={() =>
                    timer === 0 &&
                    sendOtpMutation.mutate(verificationForm.watch("email"))
                  }
                >
                  {timer > 0 ? (
                    <span className="!text-neutral-400">
                      Resend OTP in {timer} seconds
                    </span>
                  ) : (
                    "Resend OTP"
                  )}
                </h1>
              </>
            )}
          </div>
          {!isOtpSent && (
            <MyButton
              buttonType="text"
              className="text-primary-500 p-0 flex flex-row justify-start m-0"
              onClick={() => {
                const email = verificationForm.getValues("email");

                // Create a Zod schema to validate just the email string
                const emailSchema = z
                  .string()
                  .email("Please enter a valid email address");

                // Safely validate the email
                const emailResult = emailSchema.safeParse(email);

                if (!emailResult.success) {
                  toast.error(emailResult.error.errors[0].message);
                } else {
                  sendEmailOtp(email);
                }
              }}
            >
              Send Otp
            </MyButton>
          )}
          {isOtpSent && (
            <MyButton
              buttonType="primary"
              className="m-auto"
              onClick={() => {
                verifyEmailOtp(
                  verificationForm.getValues("email"),
                  verificationForm.getValues("otp").join("")
                );
              }}
            >
              Verify
            </MyButton>
          )}
        </FormProvider>
      </MyDialog>
    </>
  );
}
