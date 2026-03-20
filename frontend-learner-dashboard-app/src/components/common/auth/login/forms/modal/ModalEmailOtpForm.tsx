import React, { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import axios, { AxiosError } from "axios";

interface ErrorResponse {
  message?: string;
  ex?: string;
  responseCode?: string;
  url?: string;
  date?: string;
}
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MyInput } from "@/components/design-system/input";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, RefreshCw, Shield, CheckCircle2 } from "lucide-react";

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

interface ModalEmailOtpFormProps {
  onSwitchToUsername?: () => void;
  onEmailVerificationSuccess?: (email: string) => void;
  type?: string;
  courseId?: string;
  onSwitchToSignup?: (email?: string, shouldAutoSendOtp?: boolean) => void;
  onLoginSuccess?: () => void;
  showUsernameSwitch?: boolean;
  signupAvailable?: boolean; // Add this prop to check if signup is available
  instituteId?: string; // Institute ID to pass to backend
}

export function ModalEmailLogin({
    onSwitchToUsername,
    type,
    courseId,
    onSwitchToSignup,
    onEmailVerificationSuccess,
    onLoginSuccess,
    showUsernameSwitch = true,
    signupAvailable,
    instituteId: propInstituteId,
}: ModalEmailOtpFormProps) {
    // Extract instituteId from props or current URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlInstituteId = urlParams.get("instituteId");
    const instituteId = propInstituteId || urlInstituteId;
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [email, setEmail] = useState("");
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const navigate = useNavigate();
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // const redirect = useRouterState({
    //     select: (s) =>
    //         (s.location.search as Record<string, unknown>).redirect ?? "/login/",
    // });

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
        mutationFn: (emailParam: string) => axios.post(REQUEST_OTP, { 
            email: emailParam,
            ...(instituteId && { institute_id: instituteId }) // Include institute_id for proper theming
        }),
        onMutate: () => {
            setIsLoading(true);
        },
        onSuccess: () => {
            setIsOtpSent(true);
            startTimer();
            toast.success("OTP sent successfully!");
            if (onEmailVerificationSuccess) {
                onEmailVerificationSuccess(email);
            }
        },
        onError: (error: AxiosError<ErrorResponse>) => {
            // Handle specific backend error responses
            const errorData = error.response?.data;
            
            if (errorData?.ex === "User not found!" || errorData?.responseCode === "User not found!") {
                // User doesn't exist - show signup message only if signup is available
                if (signupAvailable && onSwitchToSignup) {
                    // Get the email from the form state
                    const emailValue = emailForm.getValues().email;
                    
                    toast.error("Account not found. Please sign up to continue.", {
                        duration: 3000,
                        description: "This email is not registered in our system."
                    });
                    
                    // Automatically switch to signup after a short delay with pre-filled email and auto-send OTP
                    setTimeout(() => {
                        onSwitchToSignup(emailValue, true);
                    }, 2000);
                } else {
                    // Signup not available - show different message
                    toast.error("Account not found.", {
                        duration: 5000,
                        description: "This email is not registered in our system. Please contact your administrator for access."
                    });
                }
            } else if (errorData?.ex || errorData?.responseCode) {
                // Show specific backend error message
                toast.error(errorData.ex || errorData.responseCode || "Failed to send OTP", {
                    duration: 5000,
                    description: "Please try again or contact support if the issue persists."
                });
            } else {
                // Generic error fallback
                toast.error("Failed to send OTP. Please try again.", {
                    duration: 5000,
                    description: "Please check your internet connection and try again."
                });
            }
        },
        onSettled: () => {
            setIsLoading(false);
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: (data: { email: string; otp: string }) =>
            axios.post(LOGIN_OTP, {
                ...data,
                ...(instituteId && { institute_id: instituteId }) // Include institute_id for consistency
            }),
        onMutate: () => {
            setIsLoading(true);
        },
        onSuccess: async (response) => {
            try {
                // If onEmailVerificationSuccess callback is provided, use it for signup flow
                if (onEmailVerificationSuccess) {
                    onEmailVerificationSuccess(email);
                    return;
                }

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
                const authorityKeys = authorities
                    ? Object.keys(authorities)
                    : [];

                // If instituteId is provided, check if user is enrolled in that institute
                if (instituteId && authorityKeys.includes(instituteId)) {
                    // User is enrolled in the specified institute
                    try {
                        await fetchAndStoreInstituteDetails(instituteId as string, userId as string);
                        await fetchAndStoreStudentDetails(instituteId as string, userId as string);
                        
                        // For email OTP login, assume status 200 (success) since we have tokens
                        const loginStatus = 200;
                        
                        if (loginStatus == 200) {
                            // Determine redirect URL based on type and courseId
                            let redirectUrl = "/dashboard";
                            
                            if (type === "courseDetailsPage" && courseId) {
                                redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
                            } else if (type === "courseDetailsPage") {
                                redirectUrl = "/study-library/courses";
                            }
                            
                            // Redirect in same tab if login originated from course-related pages or if type is courseDetailsPage
                            if (type === "courseDetailsPage" || (type && type !== "mainLogin")) {
                                // For course-related pages, redirect to the appropriate study library page
                                if (redirectUrl !== "/dashboard") {
                                    // Close modal first, then redirect
                                    if (onLoginSuccess) {
                                        onLoginSuccess();
                                    }
                                    // Use setTimeout to ensure modal closes before redirect
                                    setTimeout(() => {
                                        window.location.href = redirectUrl;
                                    }, 100);
                                } else {
                                    // Call onLoginSuccess callback for modal login
                                    if (onLoginSuccess) {
                                        onLoginSuccess();
                                    }
                                }
                            } else {
                                // Only navigate to dashboard if this is NOT a modal login (i.e., main login page)
                                if (!type || type === "mainLogin") {
                                    navigate({
                                        to: "/dashboard",
                                    });
                                } else {
                                    // Call onLoginSuccess callback for modal login
                                    if (onLoginSuccess) {
                                        onLoginSuccess();
                                    }
                                }
                            }
                        }
                                            } catch (error) {
                            toast.error("Failed to fetch details");
                        }
                    } else if (instituteId && !authorityKeys.includes(instituteId)) {
                    // User is not enrolled in the specified institute
                    toast.error("You are not enrolled in this institute.");
                    if (onLoginSuccess) {
                        onLoginSuccess(); // Close modal
                    }
                } else if (authorityKeys.length > 1) {
                    // No instituteId provided and user has multiple institutes - use first available
                    const firstInstituteId = authorityKeys[0];
                    
                    try {
                        await fetchAndStoreInstituteDetails(firstInstituteId as string, userId as string);
                        await fetchAndStoreStudentDetails(firstInstituteId as string, userId as string);
                        
                        // For email OTP login, assume status 200 (success) since we have tokens
                        const loginStatus = 200;
                        
                        if (loginStatus == 200) {
                            // Determine redirect URL based on type and courseId
                            let redirectUrl = "/dashboard";
                            
                            if (type === "courseDetailsPage" && courseId) {
                                redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
                            } else if (type === "courseDetailsPage") {
                                redirectUrl = "/study-library/courses";
                            }
                            
                            // Redirect in same tab if login originated from course-related pages or if type is courseDetailsPage
                            if (type === "courseDetailsPage" || (type && type !== "mainLogin")) {
                                // For course-related pages, redirect to the appropriate study library page
                                if (redirectUrl !== "/dashboard") {
                                    // Close modal first, then redirect
                                    if (onLoginSuccess) {
                                        onLoginSuccess();
                                    }
                                    // Use setTimeout to ensure modal closes before redirect
                                    setTimeout(() => {
                                        window.location.href = redirectUrl;
                                    }, 100);
                                } else {
                                    // Call onLoginSuccess callback for modal login
                                    if (onLoginSuccess) {
                                        onLoginSuccess();
                                    }
                                }
                            } else {
                                // Only navigate to dashboard if this is NOT a modal login (i.e., main login page)
                                if (!type || type === "mainLogin") {
                                    navigate({
                                        to: "/dashboard",
                                    });
                                } else {
                                    // Call onLoginSuccess callback for modal login
                                    if (onLoginSuccess) {
                                        onLoginSuccess();
                                    }
                                }
                            }
                        }
                                            } catch (error) {
                            toast.error("Failed to fetch details");
                        }
                    } else {
                        // Single institute case
                    const instituteId = authorityKeys[0];

                    if (instituteId && userId) {
                        try {
                            await fetchAndStoreInstituteDetails(
                                instituteId,
                                userId
                            );
                            await fetchAndStoreStudentDetails(
                                instituteId,
                                userId
                            );
                            
                            // For email OTP login, assume status 200 (success) since we have tokens
                            const loginStatus = 200;
                            
                            if (loginStatus == 200) {
                                // Determine redirect URL based on type and courseId
                                let redirectUrl = "/dashboard";
                                
                                if (type === "courseDetailsPage" && courseId) {
                                    redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
                                } else if (type === "courseDetailsPage") {
                                    redirectUrl = "/study-library/courses";
                                }
                                
                                // Redirect in same tab if login originated from course-related pages or if type is courseDetailsPage
                                if (type === "courseDetailsPage" || (type && type !== "mainLogin")) {
                                    // For course-related pages, redirect to the appropriate study library page
                                    if (redirectUrl !== "/dashboard") {
                                        // Close modal first, then redirect
                                        if (onLoginSuccess) {
                                            onLoginSuccess();
                                        }
                                        // Use setTimeout to ensure modal closes before redirect
                                        setTimeout(() => {
                                            window.location.href = redirectUrl;
                                        }, 100);
                                    } else {
                                        // Call onLoginSuccess callback for modal login
                                        if (onLoginSuccess) {
                                            onLoginSuccess();
                                        }
                                    }
                                } else {
                                    // Only navigate to dashboard if this is NOT a modal login (i.e., main login page)
                                    if (!type || type === "mainLogin") {
                                        navigate({
                                            to: "/dashboard",
                                        });
                                    } else {
                                        // Call onLoginSuccess callback for modal login
                                        if (onLoginSuccess) {
                                            onLoginSuccess();
                                        }
                                    }
                                }
                            } else {
                                // Unexpected login status
                            }
                        } catch (error) {
                            toast.error("Failed to fetch details");
                        }
                    } else {
                        // Institute ID or User ID is undefined
                    }
                }
            } catch (error) {
                // Error processing decoded data
            }
        },
        onError: (error: AxiosError<ErrorResponse>) => {
            // Handle specific backend error responses
            const errorData = error.response?.data;
            
            if (errorData?.ex || errorData?.responseCode) {
                // Show specific backend error message
                toast.error(errorData.ex || errorData.responseCode || "Invalid OTP", {
                    duration: 5000,
                    description: "Please check your OTP and try again."
                });
            } else {
                // Generic error fallback
                toast.error("Invalid OTP", {
                    description: "Please try again",
                    duration: 5000,
                });
            }
            
            otpForm.reset();
        },
        onSettled: () => {
            setIsLoading(false);
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

            validDigits.forEach((digit, index) => {
                newOtp[index] = digit;
            });

            otpForm.setValue("otp", newOtp);

            const nextEmptyIndex =
                validDigits.length < 6 ? validDigits.length : 5;
            otpInputRefs.current[nextEmptyIndex]?.focus();
        }
    };

    const handleBackToEmail = () => {
        setIsOtpSent(false);
        setTimer(0);
        otpForm.reset();
    };

    const handleOtpChange = (element: HTMLInputElement, index: number) => {
        const value = element.value;
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
        if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleResendOtp = () => {
        if (timer === 0) {
            sendOtpMutation.mutate(email);
        }
    };

    if (isOtpSent) {
        return (
            <div className="space-y-4">
                {/* Compact OTP Header */}
                <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-center space-y-3"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            delay: 0.2,
                            type: "spring",
                            stiffness: 200,
                        }}
                        className="w-12 h-12 bg-gray-100 rounded-md mx-auto flex items-center justify-center"
                    >
                        <Mail className="w-6 h-6 text-gray-700" />
                    </motion.div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Check your email
                        </h3>
                        <p className="text-sm text-gray-600">
                            We've sent a 6-digit code to
                        </p>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="inline-flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-1"
                        >
                            <CheckCircle2 className="w-3 h-3 text-gray-600" />
                            <span className="text-sm font-medium text-gray-800">
                                {email}
                            </span>
                        </motion.div>
                    </div>
                </motion.div>

                <Form {...otpForm}>
                    <form
                        onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                        className="space-y-4"
                    >
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="space-y-3"
                        >
                            <div className="flex justify-center gap-2">
                                {[0, 1, 2, 3, 4, 5].map((index) => (
                                    <motion.div
                                        key={index}
                                        initial={{
                                            scale: 0,
                                            opacity: 0,
                                        }}
                                        animate={{
                                            scale: 1,
                                            opacity: 1,
                                        }}
                                        transition={{
                                            delay: 0.5 + index * 0.03,
                                        }}
                                    >
                                        <FormField
                                            control={otpForm.control}
                                            name={`otp.${index}`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            ref={(el) =>
                                                                (otpInputRefs.current[
                                                                    index
                                                                ] = el)
                                                            }
                                                            type="text"
                                                            inputMode="numeric"
                                                            maxLength={
                                                                1
                                                            }
                                                            className="h-12 w-12 text-center text-lg font-semibold border border-gray-200 rounded-lg transition-all duration-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 hover:border-gray-300 bg-white shadow-sm"
                                                            onChange={(
                                                                e
                                                            ) =>
                                                                handleOtpChange(
                                                                    e.target,
                                                                    index
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                e
                                                            ) =>
                                                                handleOtpKeyDown(
                                                                    e,
                                                                    index
                                                                )
                                                            }
                                                            onPaste={
                                                                handleOtpPaste
                                                            }
                                                            disabled={
                                                                isLoading
                                                            }
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Resend OTP */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="text-center"
                        >
                                                         <p className="text-sm text-gray-600">
                                 Didn't receive the code?{" "}
                                 <motion.button
                                     type="button"
                                     onClick={handleResendOtp}
                                     disabled={timer > 0 || isLoading}
                                     whileHover={timer === 0 ? { scale: 1.02 } : {}}
                                     whileTap={timer === 0 ? { scale: 0.98 } : {}}
                                     className={`font-medium transition-colors duration-200 ${
                                         timer > 0 || isLoading
                                             ? "text-gray-400 cursor-not-allowed"
                                             : "text-gray-700 hover:text-gray-900"
                                     }`}
                                 >
                                     {timer > 0
                                         ? `Resend in ${timer}s`
                                         : "Resend"}
                                 </motion.button>
                             </p>
                        </motion.div>

                                                 {/* Submit Button */}
                         <motion.div
                             initial={{ y: 10, opacity: 0 }}
                             animate={{ y: 0, opacity: 1 }}
                             transition={{ delay: 0.7 }}
                             className="pt-1"
                         >
                             <motion.button
                                 type="submit"
                                 disabled={isLoading}
                                 whileHover={{ scale: 1.01 }}
                                 whileTap={{ scale: 0.99 }}
                                 className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                             >
                                 {isLoading ? (
                                     <div className="flex items-center justify-center space-x-2">
                                         <motion.div
                                             animate={{ rotate: 360 }}
                                             transition={{
                                                 duration: 1,
                                                 repeat: Infinity,
                                                 ease: "linear",
                                             }}
                                         >
                                             <RefreshCw className="w-4 h-4" />
                                         </motion.div>
                                         <span className="text-sm">
                                             Verifying...
                                         </span>
                                     </div>
                                 ) : (
                                     <div className="flex items-center justify-center space-x-2">
                                         <Shield className="w-4 h-4" />
                                         <span className="text-sm">Verify OTP</span>
                                     </div>
                                 )}
                             </motion.button>
                         </motion.div>

                                                 {/* Back to Email */}
                         <motion.div
                             initial={{ y: 10, opacity: 0 }}
                             animate={{ y: 0, opacity: 1 }}
                             transition={{ delay: 0.8 }}
                             className="text-center"
                         >
                             <motion.button
                                 type="button"
                                 onClick={handleBackToEmail}
                                 whileHover={{ scale: 1.02 }}
                                 whileTap={{ scale: 0.98 }}
                                 className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                             >
                                 <ArrowLeft className="w-3 h-3 mr-1" />
                                 Back to email
                             </motion.button>
                         </motion.div>
                    </form>
                </Form>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Email Form */}
            <Form {...emailForm}>
                <form
                    onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                    className="space-y-4"
                >
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-2"
                    >
                        <FormField
                            control={emailForm.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            inputType="email"
                                            inputPlaceholder="Enter your email"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            error={
                                                emailForm.formState.errors
                                                    .email?.message
                                            }
                                            required
                                            size="large"
                                            label="Email Address"
                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </motion.div>

                    {/* Submit Button */}
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="pt-1"
                    >
                        <motion.button
                            type="submit"
                            disabled={isLoading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{
                                            duration: 1,
                                            repeat: Infinity,
                                            ease: "linear",
                                        }}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </motion.div>
                                    <span className="text-sm">
                                        Sending code...
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center space-x-2">
                                    <Mail className="w-4 h-4" />
                                    <span className="text-sm">
                                        Send Verification Code
                                    </span>
                                </div>
                            )}
                        </motion.button>
                    </motion.div>

            {/* Switch to Username Login */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center pt-3 space-y-2"
            >
                {showUsernameSwitch && (
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 relative group font-medium"
                        onClick={onSwitchToUsername}
                    >
                        Prefer username login?
                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-700 transition-all duration-200 group-hover:w-full"></span>
                    </motion.button>
                )}
                

            </motion.div>
                </form>
            </Form>
        </div>
    );
} 