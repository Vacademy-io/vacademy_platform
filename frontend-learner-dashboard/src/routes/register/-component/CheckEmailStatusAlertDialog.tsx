import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import {
  useForm,
  Controller,
  FormProvider,
  UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { z } from "zod";
import { FormControl, FormItem } from "@/components/ui/form";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { LOGIN_OTP, REQUEST_OTP } from "@/constants/urls";
import { toast } from "sonner";
import {
  getTokenDecodedData,
  removeTokensAndLogout,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import {
  handleGetParticipantsTest,
  handleGetStudentDetailsOfInstitute,
} from "../-services/open-registration-services";
import { TokenKey } from "@/constants/auth/tokens";
import {
  calculateTimeDifference,
  getOpenRegistrationUserDetailsByEmail,
} from "../-utils/helper";
import { OpenTestAssessmentRegistrationDetails } from "@/types/open-test";
import {
  DynamicSchemaData,
  ParticipantsDataInterface,
} from "@/types/assessment-open-registration";
import AssessmentRegistrationCompleted from "./AssessmentRegistrationCompleted";
import AssessmentClosedExpiredComponent from "./AssessmentClosedExpiredComponent";
import { useNavigate } from "@tanstack/react-router";

const checkCloseTestTimeCondition = (serverTime: number, endDate: string) => {
  const registrationEndDate: number = new Date(Date.parse(endDate)).getTime();
  return serverTime <= registrationEndDate;
};

// Define Zod Schema
const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z
    .array(z.string().length(1, "Each digit must be 1 character"))
    .length(6, "OTP must be 6 digits"),
});

// Define Form Values Type
type FormValues = z.infer<typeof formSchema>;
interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

const CheckEmailStatusAlertDialog = ({
  timeLeft,
  registrationData,
  registrationForm,
  setParticipantsDto,
  userAlreadyRegistered,
  setUserAlreadyRegistered,
  userHasAttemptCount,
  setUserHasAttemptCount,
  case3Status,
  serverTime,
}: {
  timeLeft: TimeLeft;
  registrationData: OpenTestAssessmentRegistrationDetails;
  registrationForm: UseFormReturn<DynamicSchemaData>;
  setParticipantsDto: React.Dispatch<
    React.SetStateAction<ParticipantsDataInterface>
  >;
  userAlreadyRegistered: boolean;
  setUserAlreadyRegistered: React.Dispatch<React.SetStateAction<boolean>>;
  userHasAttemptCount: boolean;
  setUserHasAttemptCount: React.Dispatch<React.SetStateAction<boolean>>;
  case3Status: boolean;
  serverTime: number;
}) => {
  const [
    isPrivateAssessmentAlreadyRegistered,
    setIsPrivateAssessmentAlreadyRegistered,
  ] = useState(false);

  const [
    isPrivateAssessmentNotAlreadyRegistered,
    setIsPrivateAssessmentNotAlreadyRegistered,
  ] = useState(false);

  const [isOtpSent, setIsOTPSent] = useState(false);
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      otp: Array(6).fill(""), // Empty array for 6 digits
    },
    mode: "onChange",
  });
  const navigate = useNavigate();

  const handleCloseAlertDialog = () => {
    setOpen(false);
  };

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // Allow only numbers

    const otpArray = [...form.getValues("otp")];
    otpArray[index] = value;
    form.setValue("otp", otpArray, { shouldValidate: true });

    // Auto-focus next field
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP keydown for navigation
  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !form.getValues("otp")[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Watch form values
  const email = form.watch("email");
  const otp = form.watch("otp");

  // Check if form is valid
  const isFormValid =
    email.trim() !== "" && otp.every((digit) => digit.trim() !== "");

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

  const sendOtpMutation = useMutation({
    mutationFn: (email: string) => axios.post(REQUEST_OTP, { email }),
    onSuccess: () => {
      setIsOTPSent(true);
      startTimer();
      toast.success("OTP sent successfully");
      setUserAlreadyRegistered(false);
    },
    onError: async () => {
      await removeTokensAndLogout();
      toast.error("This email is not registered", {
        description: "Please register yourself to attempt this assessment",
        duration: 3000,
      });
      setUserAlreadyRegistered(true);
      handleCloseAlertDialog();
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (data: { email: string; otp: string }) =>
      axios.post(LOGIN_OTP, data),
    onSuccess: async (response) => {
      await removeTokensAndLogout();
      // Store tokens in Capacitor Storage
      await setTokenInStorage(TokenKey.accessToken, response.data.accessToken);
      await setTokenInStorage(
        TokenKey.refreshToken,
        response.data.refreshToken
      );
      const decodedData = getTokenDecodedData(response.data.accessToken);
      const userId = decodedData?.user;
      const assessmentId = registrationData.assessment_public_dto.assessment_id;
      const instituteId = registrationData.institute_id;
      const getAllStudentDetails =
        await handleGetStudentDetailsOfInstitute(instituteId);
      const userDetails = getOpenRegistrationUserDetailsByEmail(
        getAllStudentDetails,
        email
      );
      const psIds = userDetails?.package_session_id;
      const getTestDetailsOfParticipants = await handleGetParticipantsTest(
        assessmentId,
        instituteId,
        userId,
        psIds
      );
      if (userDetails) {
        setParticipantsDto({
          username: userDetails.username,
          user_id: userDetails.user_id,
          email: userDetails.email,
          full_name: userDetails.full_name,
          mobile_number: userDetails.mobile_number,
          file_id: userDetails.face_file_id || "",
          guardian_email: userDetails.parents_email,
          guardian_mobile_number: userDetails.parents_mobile_number,
          reattempt_count: getTestDetailsOfParticipants.remaining_attempts,
        });
      }
      if (
        registrationData.error_message === "Assessment is Private" &&
        getTestDetailsOfParticipants.is_already_registered &&
        getTestDetailsOfParticipants.remaining_attempts > 0
      ) {
        setIsPrivateAssessmentAlreadyRegistered(true);
      } else if (
        registrationData.error_message === "Assessment is Private" &&
        !getTestDetailsOfParticipants.is_already_registered &&
        getTestDetailsOfParticipants.remaining_attempts > 0
      ) {
        setIsPrivateAssessmentNotAlreadyRegistered(true);
      } else if (
        getTestDetailsOfParticipants.is_already_registered &&
        getTestDetailsOfParticipants.remaining_attempts > 0
      ) {
        setUserHasAttemptCount(true);
      } else if (
        getTestDetailsOfParticipants.is_already_registered &&
        getTestDetailsOfParticipants.remaining_attempts === 0
      ) {
        toast.error(
          "Your remaining attempts are over to attempt this assessment!",
          {
            description: "Your attempts are over!",
            duration: 3000,
          }
        );
      } else {
        registrationForm.reset((prevValues) => ({
          ...prevValues,
          email: {
            ...registrationForm.getValues("email"),
            value: userDetails?.email || "",
          },
          full_name: {
            ...registrationForm.getValues("full_name"),
            value: userDetails?.full_name || "",
          },
          phone_number: {
            ...registrationForm.getValues("phone_number"),
            value: userDetails?.mobile_number || "",
          },
          ...(registrationForm.getValues("gender") && {
            gender: {
              ...registrationForm.getValues("gender"),
              value: userDetails?.gender || "",
            },
          }),
          ...(registrationForm.getValues("state") && {
            state: {
              ...registrationForm.getValues("state"),
              value: userDetails?.region || "",
            },
          }),
          ...(registrationForm.getValues("city") && {
            city: {
              ...registrationForm.getValues("city"),
              value: userDetails?.city || "",
            },
          }),
        }));
        handleCloseAlertDialog();
      }
    },
    onError: () => {
      toast.error("Invalid OTP", {
        description: "Please try again",
        duration: 3000,
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    const otpArray = data.otp;
    if (otpArray.every((val) => val !== "")) {
      verifyOtpMutation.mutate({
        email,
        otp: otpArray.join(""),
      });
    } else {
      toast.error("Please fill all OTP fields");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      isPrivateAssessmentAlreadyRegistered &&
      checkCloseTestTimeCondition(
        serverTime,
        registrationData.assessment_public_dto.registration_close_date
      )
    ) {
      navigate({
        to: "/assessment/examination",
      });
    }
  }, [isPrivateAssessmentAlreadyRegistered]);

  if (isPrivateAssessmentNotAlreadyRegistered)
    return (
      <AssessmentClosedExpiredComponent
        isExpired={false}
        assessmentName={registrationData.assessment_public_dto.assessment_name}
        isPrivate={true}
      />
    );

  if (
    !userAlreadyRegistered &&
    case3Status &&
    !calculateTimeDifference(
      serverTime,
      registrationData.assessment_public_dto.bound_end_time
    )
  )
    return (
      <AssessmentClosedExpiredComponent
        isExpired={true}
        assessmentName={registrationData.assessment_public_dto.assessment_name}
      />
    );

  if (userHasAttemptCount)
    return (
      <AssessmentRegistrationCompleted
        assessmentName={registrationData.assessment_public_dto.assessment_name}
        timeLeft={timeLeft}
      />
    );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="p-0">
        <h1 className="p-4 text-primary-500 bg-primary-50 rounded-lg">
          Check Registration Status
        </h1>
        <FormProvider {...form}>
          <form className="w-full flex flex-col gap-6 p-4">
            <FormItem>
              <FormControl>
                <MyInput
                  inputType="email"
                  inputPlaceholder="Enter your email"
                  input={form.watch("email")}
                  onChangeFunction={(e) =>
                    form.setValue("email", e.target.value)
                  }
                  required={true}
                  size="large"
                  label="Email"
                  className="!max-w-full !w-full"
                />
              </FormControl>
            </FormItem>
            {!isOtpSent && (
              <h1
                className="text-primary-500 text-xs cursor-pointer -mt-3"
                onClick={() => sendOtpMutation.mutate(email)}
              >
                Send OTP
              </h1>
            )}
            {isOtpSent && (
              <>
                <div className="flex justify-start gap-2">
                  {form.watch("otp").map((_, index) => (
                    <Controller
                      key={index}
                      name={`otp.${index}`}
                      control={form.control}
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
                  onClick={() => timer === 0 && sendOtpMutation.mutate(email)}
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
            <div className="flex items-center justify-center flex-col gap-4">
              <MyButton
                type="button"
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                disable={!isFormValid}
                onClick={form.handleSubmit(onSubmit)}
              >
                Submit
              </MyButton>
            </div>
          </form>
        </FormProvider>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CheckEmailStatusAlertDialog;
