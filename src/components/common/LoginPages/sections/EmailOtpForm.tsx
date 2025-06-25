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
    <div className="w-full space-y-6">
      {!isOtpSent ? (
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            className="space-y-6"
          >
            <div className="space-y-2 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative group">
                        <MyInput
                          inputType="email"
                          inputPlaceholder="Enter your email address"
                          label="Email Address"
                          required
                          size="large"
                          error={emailForm.formState.errors.email?.message}
                          {...field}
                          className="w-full transition-all duration-300 border-gray-200/60 focus:border-orange-400 focus:ring-2 focus:ring-orange-100/50 rounded-2xl bg-gray-50/30 focus:bg-white font-light"
                          input={field.value} // Pass current value
                          onChangeFunction={field.onChange} // Pass change handler
                        />
                        {/* Subtle focus indicator */}
                        <div className="absolute inset-0 rounded-2xl ring-1 ring-orange-400 opacity-0 group-focus-within:opacity-30 transition-all duration-300 pointer-events-none"></div>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="pt-4 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-light py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-lg hover:shadow-xl text-base tracking-wide"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="font-light">Sending OTP...</span>
                  </div>
                ) : (
                  "Send OTP"
                )}
              </button>
            </div>
          </form>
        </Form>
      ) : (
        <div className="space-y-6">
          {/* OTP Header */}
          <div className="text-center space-y-3 animate-fade-in-up">
            <div className="w-16 h-16 bg-orange-100/70 rounded-2xl mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-light text-gray-900 tracking-tight">Check your email</h3>
            <p className="text-sm text-gray-500 font-light">
              We've sent a 6-digit verification code to
            </p>
            <p className="text-sm font-normal text-orange-500">{email}</p>
          </div>

          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
              <div className="space-y-4 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                <div className="flex justify-center gap-3">
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
                              className="h-14 w-14 text-center text-xl font-light border border-gray-200/60 rounded-2xl transition-all duration-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100/50 hover:border-gray-300/80 bg-gray-50/30 focus:bg-white tracking-wider"
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
                  <div className="text-sm text-red-500 text-center">
                    Please enter a valid 6-digit OTP
                  </div>
                )}
              </div>

              <div className="space-y-4 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                <button
                  type="submit"
                  disabled={
                    !otpForm.getValues().otp.every((value) => value !== "") || isLoading
                  }
                  className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-light py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-lg hover:shadow-xl text-base tracking-wide"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="font-light">Verifying...</span>
                    </div>
                  ) : (
                    "Verify & Sign In"
                  )}
                </button>

                <div className="flex justify-center items-center space-x-4 text-sm">
                  <button
                    type="button"
                    onClick={handleBackToEmail}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200 font-light"
                  >
                    ← Back to email
                  </button>

                  <div className="w-px h-4 bg-gray-200"></div>

                  <button
                    type="button"
                    className={`transition-colors duration-200 font-light ${
                      timer > 0 
                        ? "text-gray-300 cursor-not-allowed" 
                        : "text-orange-500 hover:text-orange-600"
                    }`}
                    onClick={() => timer === 0 && sendOtpMutation.mutate(email)}
                    disabled={timer > 0}
                  >
                    {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      )}
      
      <div className="text-center pt-6 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
        <button
          type="button"
          className="text-sm text-gray-400 hover:text-orange-500 transition-colors duration-200 relative group font-light"
          onClick={onSwitchToUsername}
        >
          Prefer username login?
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-orange-500 transition-all duration-300 group-hover:w-full"></span>
        </button>
      </div>
    </div>
  );
}
