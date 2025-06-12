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
import RegistrationLogo from "@/svgs/registration-logo.svg?url";
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
import { useNavigate, useRouter } from "@tanstack/react-router";
import { AccessLevel } from "../-types/enum";
import {
  ApiError,
  DropdownOption,
  RegistrationFormValues,
} from "../-types/type";
import { useLiveSessionGuestRegistration } from "../-hooks/useLiveSessionGuestRegistration";
import { useEarliestScheduleId } from "../-hooks/useEarliestScheduleId";
import { fetchSessionDetails } from "@/routes/live-class-guest/-hooks/useSessionDetails";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { getPublicFileUrl } from "../-hooks/getPublicUrl";

export const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z
    .array(z.string().length(1, "Each digit must be 1 character"))
    .length(6, "OTP must be 6 digits"),
});

export default function LiveClassRegistrationPage() {
  const [dialog, setDialog] = useState<boolean>(true);
  const [isOtpSent, setIsOTPSent] = useState<boolean>(false);
  const [sessionDetails, setSessionDetails] =
    useState<SessionDetailsResponse | null>(null);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { sessionId } = router.state.location.search;
  const { data, isLoading } = useSessionCustomFields(sessionId || "");
  const { data: earliestScheduleId } = useEarliestScheduleId(sessionId || "");
  const navigate = useNavigate();
  const [coverFileUrl, setCoverFileUrl] = useState<string | undefined>(
    undefined
  );

  const { mutateAsync: registerGuestUser } = useLiveSessionGuestRegistration();

  const fetchSessionDetail = async (id: string) => {
    console.log("fetching session details");
    const response = await fetchSessionDetails(id);
    setSessionDetails(response);
    console.log("sessionDetails ", response);
  };

  useEffect(() => {
    if (!sessionId) {
      router.navigate({ to: "/dashboard" });
    }
  }, [sessionId]);

  useEffect(() => {
    if (data?.accessLevel === AccessLevel.PRIVATE) {
      router.navigate({ to: "/study-library/live-class" });
    } else {
      fetchCoverFileUrl();
    }
  }, [data]);

  useEffect(() => {
    if (sessionDetails) {
      const now = new Date();
      const sessionDate = new Date(
        `${sessionDetails?.meetingDate}T${sessionDetails?.scheduleStartTime}`
      );
      const waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - (sessionDetails?.waitingRoomTime ?? 0)
      );

      // Check if we're in waiting room period or main session
      const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
      const isInMainSession = now >= sessionDate;

      if (isInWaitingRoom && sessionDetails?.defaultMeetLink) {
        navigate({
          to: "/live-class-guest/waiting-room",
          search: {
            sessionId: earliestScheduleId || "",
          },
        });
      } else if (
        isInMainSession &&
        sessionDetails?.defaultMeetLink &&
        sessionDetails?.sessionStreamingServiceType ===
          SessionStreamingServiceType.EMBED
      ) {
        navigate({
          to: "/live-class-guest/embed",
          search: {
            sessionId: earliestScheduleId || "",
          },
        });
      } else if (
        isInMainSession &&
        sessionDetails?.defaultMeetLink &&
        sessionDetails?.sessionStreamingServiceType ===
          SessionStreamingServiceType.REDIRECT
      ) {
        window.open(
          sessionDetails?.defaultMeetLink,
          "_blank",
          "noopener,noreferrer"
        );
      } else {
        toast.error("Session is not live yet");
      }
    }
  }, [sessionDetails]);

  const fetchCoverFileUrl = async () => {
    const response = await getPublicFileUrl(data?.coverFileId || "");
    setCoverFileUrl(response);
  };

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

  const onSubmit = async (formValues: RegistrationFormValues) => {
    console.log("data ", formValues);
    let payload;
    try {
      payload = transformToGuestRegistrationDTO(
        formValues,
        data?.sessionId || "",
        data?.customFields || []
      );
    } catch (error) {
      toast.error("Error building request");
      console.error("DTO transformation error:", error);
      return;
    }

    try {
      const response = await registerGuestUser(payload);
      if (response.status === 200) {
        toast.success("Registration successful");
        fetchSessionDetail(earliestScheduleId || "");
      }
    } catch (error) {
      // The hook's onError will show a toast.
      console.error("Registration API call failed:", error);
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
        if (sessionId) {
          fetchSessionDetail(earliestScheduleId || "");
          console.log("sessionDetails ", sessionDetails);
        }
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
    },
    onError: async () => {
      toast.error("This email is not registered", {
        description: "Please register yourself to attempt this assessment",
        duration: 3000,
      });
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

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const otpArray = Array(6).fill("");
    [...pastedData].forEach((char, index) => {
      if (/^\d$/.test(char) && index < 6) {
        otpArray[index] = char;
        if (otpRefs.current[index]) {
          otpRefs.current[index]!.value = char;
        }
      }
    });
    verificationForm.setValue("otp", otpArray, { shouldValidate: true });
    // Focus the next empty input or the last input if all are filled
    const nextEmptyIndex = otpArray.findIndex((val) => !val);
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    otpRefs.current[focusIndex]?.focus();
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
      <div className="w-screen h-screen max-sm:h-fit bg-primary-50 max-sm:p-0 p-20 flex flex-row max-sm:flex-col max-sm:gap-8 justify-around items-center">
        <div className="flex flex-col gap-6 h-full w-[40%] max-sm:w-full items-center">
          {data?.coverFileId ? (
            <img
              src={coverFileUrl}
              alt={data?.sessionTitle}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <div>Logo</div>
          )}
          <div className="text-h2">{data?.sessionTitle}</div>
          <div>
            {data?.startTime && (
              <CountdownTimer startTime={`${data.startTime}`} />
            )}
          </div>
          <div>
            <div className="size-[45vh]">
              <img
                src={RegistrationLogo}
                alt="Registration Logo"
                className="size-full"
              />
            </div>
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
        <div className="w-[35%] max-sm:w-full max-sm:mb-4 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md ">
            <div className="flex flex-col gap-4">
              <FormProvider {...form}>
                <form
                  onSubmit={handleSubmit(onSubmit, onError)}
                  className="flex flex-col gap-4 justify-between m-6"
                >
                  <div className="font-bold">Registration Form</div>
                  <div className="flex flex-col gap-4 overflow-auto h-[60vh]">
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
        className="w-1/3 max-sm:w-screen h-fit max-sm:rounded-md"
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
                            onPaste={handlePaste}
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
