import React, { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate, useSearch } from "@tanstack/react-router";
import axios from "axios";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { TokenKey } from "@/constants/auth/tokens";
import {
  getTokenDecodedData,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { LOGIN_OTP, REQUEST_OTP } from "@/constants/urls";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";

const emailSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

const otpSchema = z.object({
  otp: z
    .array(z.string())
    .length(6)
    .transform((val) => val.join("")),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type OtpFormValues = { otp: string[] };

export function EmailLogin({
  onSwitchToUsername,
}: {
  onSwitchToUsername: () => void;
}) {
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /* eslint-disable-next-line */
  const { redirect } = useSearch<any>({ from: "/login/" });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });
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
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: Array(6).fill(""),
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: (email: string) => axios.post(REQUEST_OTP, { email }),
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: () => {
      setIsLoading(false);
      setIsOtpSent(true);
      startTimer(); // Add this line
      toast.success("OTP sent successfully");
    },
    onError: () => {
      setIsLoading(false);
      toast.error("this email is not registered", {
        description: "Please try again with a registered email",
        duration: 3000,
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (data: { email: string; otp: string }) =>
      axios.post(LOGIN_OTP, data),
    onSuccess: async (response) => {
      try {
        // Store tokens
        await setTokenInStorage(
          TokenKey.accessToken,
          response.data.accessToken
        );
        await setTokenInStorage(
          TokenKey.refreshToken,
          response.data.refreshToken
        );

        // Decode token to get user data
        const decodedData = await getTokenDecodedData(
          response.data.accessToken
        );
        const authorities = decodedData?.authorities;
        const userId = decodedData?.user;
        const authorityKeys = authorities ? Object.keys(authorities) : [];

        if (authorityKeys.length > 1) {
          navigate({
            to: "/institute-selection",
            search: { redirect: redirect || "/dashboard/" },
          });
        } else {
          const instituteId = authorityKeys[0];

          if (instituteId && userId) {
            try {
              await fetchAndStoreInstituteDetails(instituteId, userId);
              const status = await fetchAndStoreStudentDetails(
                instituteId,
                userId
              );
              if (status == 200) {
                navigate({
                  to: "/SessionSelectionPage",
                  search: { redirect: redirect || "/dashboard" },
                });
              } else if (status == 201) {
                navigate({
                  to: redirect || "/assessment/examination",
                });
              }
            } catch (error) {
              console.error("Error fetching details:", error);
              toast.error("Failed to fetch details");
            }
          } else {
            console.error("Institute ID or User ID is undefined");
          }
        }
      } catch (error) {
        console.error("Error processing decoded data:", error);
      }
    },
    onError: () => {
      toast.error("Invalid OTP", {
        description: "Please try again",
        duration: 3000,
      });
      otpForm.reset();
    },
  });

  const onEmailSubmit = (data: EmailFormValues) => {
    setEmail(data.email);
    sendOtpMutation.mutate(data.email);
  };

  const onOtpSubmit = () => {
    const otpArray = otpForm.getValues().otp;
    if (otpArray.every((val) => val !== "")) {
      verifyOtpMutation.mutate({
        email,
        otp: otpArray.join(""),
      });
    } else {
      setIsLoading(false);
      toast.error("Please fill all OTP fields");
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/[^0-9]/g, "").split("");
    const validDigits = digits.slice(0, 6);

    if (validDigits.length > 0) {
      const newOtp = Array(6).fill("");

      for (let i = 0; i < validDigits.length; i++) {
        if (i < 6) {
          newOtp[i] = validDigits[i];
        }
      }

      otpForm.setValue("otp", newOtp);

      const nextEmptyIndex = newOtp.findIndex((val) => val === "");
      if (nextEmptyIndex !== -1 && nextEmptyIndex < 6) {
        otpInputRefs.current[nextEmptyIndex]?.focus();
      } else {
        otpInputRefs.current[5]?.focus();
      }

      if (newOtp.every((val) => val !== "")) {
        setTimeout(() => {
          onOtpSubmit();
        }, 100);
      }
    }
  };

  const handleBackToEmail = () => {
    setIsOtpSent(false);
    emailForm.reset();
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    const value = element.value.replace(/[^0-9]/g, "");

    if (value) {
      const newOtp = [...otpForm.getValues().otp];
      newOtp[index] = value.substring(0, 1);
      otpForm.setValue("otp", newOtp);

      if (index < 5 && value.length === 1) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    const currentValue = otpForm.getValues().otp[index];

    if (e.key === "Backspace") {
      if (!currentValue && index > 0) {
        const newOtp = [...otpForm.getValues().otp];
        newOtp[index - 1] = "";
        otpForm.setValue("otp", newOtp);
        otpInputRefs.current[index - 1]?.focus();
      } else if (currentValue) {
        const newOtp = [...otpForm.getValues().otp];
        newOtp[index] = "";
        otpForm.setValue("otp", newOtp);
      }
    }
  };

  return (
    <div>
      {!isOtpSent ? (
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            className="w-full"
          >
            <div className="flex w-full flex-col items-center justify-center gap-4 px-4 md:px-8 lg:px-12">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MyInput
                        inputType="email"
                        inputPlaceholder="you@example.com"
                        label="Email"
                        required
                        size="large"
                        error={emailForm.formState.errors.email?.message}
                        {...field}
                        className="w-[300px] md:w-[348px] lg:w-[348px]"
                        input={field.value} // Pass current value
                        onChangeFunction={field.onChange} // Pass change handler
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-16 flex flex-col items-center gap-3">
              <MyButton
                type="submit"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
              >
                {isLoading ? "Loading..." : "Send OTP"}
              </MyButton>
            </div>
          </form>
        </Form>
      ) : (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="w-full">
            <div className="flex w-full flex-col items-center justify-center gap-4 px-4 md:px-8 lg:px-12">
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <FormField
                    key={index}
                    control={otpForm.control}
                    name={`otp.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            ref={(el) => (otpInputRefs.current[index] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            className="h-12 w-12 text-center text-xl"
                            onChange={(e) => handleOtpChange(e.target, index)}
                            onKeyDown={(e) => handleOtpKeyDown(e, index)}
                            onPaste={(e) => handleOtpPaste(e)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              {otpForm.formState.errors.otp && (
                <div className="text-sm text-red-500">
                  Please enter a valid 6-digit OTP
                </div>
              )}
            </div>
            <div className="mt-16 flex flex-col items-center gap-3">
              <MyButton
                type="submit"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                disabled={
                  !otpForm.getValues().otp.every((value) => value !== "")
                }
              >
                {isLoading ? "Loading..." : "Login"}
              </MyButton>
              <div className="flex">
                <MyButton
                  type="button"
                  scale="medium"
                  buttonType="text"
                  onClick={handleBackToEmail}
                >
                  Back
                </MyButton>

                <MyButton
                  type="button"
                  scale="medium"
                  buttonType="text"
                  className={timer > 0 ? "text-gray-500" : "text-primary-500"}
                  onClick={() => timer === 0 && sendOtpMutation.mutate(email)}
                  disabled={timer > 0}
                >
                  {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                </MyButton>
              </div>
            </div>
          </form>
        </Form>
      )}
      <div className="flex flex-col items-center">
        <MyButton
          type="button"
          scale="medium"
          buttonType="text"
          className="text-primary-500"
          onClick={onSwitchToUsername}
        >
          Login with username
        </MyButton>
      </div>
    </div>
  );
}
