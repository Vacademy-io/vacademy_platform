import React, { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import axios from "axios";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MyInput } from "@/components/design-system/input";
import { motion, AnimatePresence } from "framer-motion";
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

export function ModalEmailLogin({
    onSwitchToUsername,
    type,
    courseId,
    onSwitchToSignup,
    onEmailVerificationSuccess,
    onLoginSuccess,
}: {
    onSwitchToUsername: () => void;
    type?: string;
    courseId?: string;
    onSwitchToSignup?: () => void;
    onEmailVerificationSuccess?: (email: string) => void;
    onLoginSuccess?: () => void;
}) {
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [email, setEmail] = useState("");
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const navigate = useNavigate();
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const redirect = useRouterState({
        select: (s) =>
            (s.location.search as Record<string, any>).redirect ?? "/login/",
    });

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
            setIsOtpSent(true);
            startTimer();
            toast.success("OTP sent successfully!");
            if (onEmailVerificationSuccess) {
                onEmailVerificationSuccess(email);
            }
        },
        onError: () => {
            toast.error("Failed to send OTP. Please try again.");
        },
        onSettled: () => {
            setIsLoading(false);
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: (data: { email: string; otp: string }) =>
            axios.post(LOGIN_OTP, data),
        onMutate: () => {
            setIsLoading(true);
        },
        onSuccess: async (response) => {
            const { accessToken, refreshToken, status } = response.data;

            if (accessToken && refreshToken) {
                await setTokenInStorage(TokenKey.accessToken, accessToken);
                await setTokenInStorage(TokenKey.refreshToken, refreshToken);

                try {
                    const decodedData = getTokenDecodedData(accessToken);
                    const authorities = decodedData?.authorities;
                    const userId = decodedData?.user;
                    const authorityKeys = authorities ? Object.keys(authorities) : [];

                    if (authorityKeys.length > 1) {
                        navigate({
                            to: "/institute-selection",
                            search: { redirect: "/dashboard/" },
                        });
                    } else if (authorityKeys.length === 1) {
                        const instituteId = authorityKeys[0];
                        await fetchAndStoreInstituteDetails(instituteId, userId);
                        await fetchAndStoreStudentDetails(instituteId, userId);

                        if (status == 200) {
                            // Determine redirect URL based on type and courseId
                            let redirectUrl = "/dashboard";
                            
                            if (type === "courseDetailsPage" && courseId) {
                                redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
                            } else if (type === "courseDetailsPage") {
                                redirectUrl = "/study-library/courses";
                            }
                            
                            // Open in new tab if login originated from course-related pages or if type is courseDetailsPage
                            if (type === "courseDetailsPage" || (type && type !== "mainLogin")) {
                                window.open(redirectUrl, '_blank');
                            }
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
                        } else if (status == 201) {
                            navigate({
                                to:
                                    typeof redirect === "string"
                                        ? redirect
                                        : "/assessment/examination",
                            });
                        }
                    } else {
                        console.error("Institute ID or User ID is undefined");
                    }
                } catch (error) {
                    console.error("Error fetching details:", error);
                    toast.error("Failed to fetch details");
                }
            } else {
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
            <div className="space-y-6">
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
                        className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center"
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
                            className="inline-flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1"
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
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 relative group font-medium"
                    onClick={onSwitchToUsername}
                >
                    Prefer username login?
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-700 transition-all duration-200 group-hover:w-full"></span>
                </motion.button>
                
                <div className="text-xs text-gray-500">
                    Don't have an account?{" "}
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        onClick={onSwitchToSignup}
                        className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
                    >
                        Sign up here
                    </motion.button>
                </div>
            </motion.div>
                </form>
            </Form>
        </div>
    );
} 