import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { MyInput } from "@/components/design-system/input";
import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { z } from "zod";
import axios from "axios";
import {
  LIVE_SESSION_REQUEST_OTP,
  LIVE_SESSION_VERIFY_OTP,
} from "@/constants/urls";
import { toast } from "sonner";
import { ApiError } from "../-types/type";
import { EMAIL_OTP_VERIFICATION_ENABLED } from "@/constants/feature-flags";

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z
    .array(z.string().length(1, "Each digit must be 1 character"))
    .length(6, "OTP must be 6 digits"),
});

interface EmailVerificationDialogProps {
  open: boolean;
  sessionId: string;
  instituteId: string;
  onEmailVerified: (email: string) => void;
}

export default function EmailVerificationDialog({
  open,
  sessionId,
  instituteId,
  onEmailVerified,
}: EmailVerificationDialogProps) {
  const [isOtpSent, setIsOTPSent] = useState<boolean>(false);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const verificationForm = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: "",
      otp: Array(6).fill(""),
    },
    mode: "onChange",
  });

  const sendEmailOtp = async (email: string) => {
    try {
      await axios({
        method: "POST",
        url: LIVE_SESSION_REQUEST_OTP,
        data: { to: email, subject: "Your OTP for Live Session Registration" },
        params: {
          instituteId,
        },
      });

      setIsOTPSent(true);
      startTimer();
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
            sessionId: sessionId,
          },
        }
      );

      if (response.status === 200) {
        // Save verified email to localStorage
        const existingEmails = JSON.parse(
          localStorage.getItem("verifiedEmail") || "[]"
        );
        if (!existingEmails.includes(email)) {
          existingEmails.push(email);
          localStorage.setItem("verifiedEmail", JSON.stringify(existingEmails));
        }

        onEmailVerified(email);
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

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const otpArray = [...verificationForm.getValues("otp")];
    otpArray[index] = value;
    verificationForm.setValue("otp", otpArray, { shouldValidate: true });

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      e.key === "Backspace" &&
      !verificationForm.getValues("otp")[index] &&
      index > 0
    ) {
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
    const nextEmptyIndex = otpArray.findIndex((val) => !val);
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    otpRefs.current[focusIndex]?.focus();
  };

  const startTimer = () => {
    setTimer(30);
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <MyDialog
      open={open}
      heading="Verify Email"
      className="w-full max-w-md sm:w-2/3 md:w-1/2 lg:w-1/3 h-fit rounded-md"
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
              <div className="flex justify-center gap-1 sm:gap-2 flex-nowrap">
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
                          className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base md:text-lg"
                        />
                      )}
                    />
                  ))}
              </div>
              <h1
                className="text-primary-500 text-xs -mt-3 cursor-pointer"
                onClick={() =>
                  timer === 0 && sendEmailOtp(verificationForm.watch("email"))
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
        <div className="flex flex-col gap-3">
          {!isOtpSent && (
            <MyButton
              className="text-primary-500 w-full"
              onClick={() => {
                const email = verificationForm.getValues("email");
                const emailSchema = z
                  .string()
                  .email("Please enter a valid email address");
                const emailResult = emailSchema.safeParse(email);

                if (!emailResult.success) {
                  toast.error(emailResult.error.errors[0].message);
                } else {
                  // If OTP verification is disabled, skip directly to verified state
                  if (!EMAIL_OTP_VERIFICATION_ENABLED) {
                    // Save email to localStorage
                    const existingEmails = JSON.parse(
                      localStorage.getItem("verifiedEmail") || "[]"
                    );
                    if (!existingEmails.includes(email)) {
                      existingEmails.push(email);
                      localStorage.setItem("verifiedEmail", JSON.stringify(existingEmails));
                    }
                    onEmailVerified(email);
                  } else {
                    sendEmailOtp(email);
                  }
                }
              }}
            >
              {EMAIL_OTP_VERIFICATION_ENABLED ? "Send OTP" : "Continue"}
            </MyButton>
          )}
          {isOtpSent && (
            <MyButton
              buttonType="primary"
              className="w-full"
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
        </div>
      </FormProvider>
    </MyDialog>
  );
}
