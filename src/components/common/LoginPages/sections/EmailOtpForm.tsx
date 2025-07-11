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

export function EmailLogin({
    onSwitchToUsername,
    type,
    courseId,
}: {
    onSwitchToUsername: () => void;
    type?: string;
    courseId?: string;
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
                const authorityKeys = authorities
                    ? Object.keys(authorities)
                    : [];

                if (authorityKeys.length > 1) {
                    navigate({
                        to: "/institute-selection",
                        search: { redirect: redirect || "/dashboard/" },
                        state: { type, courseId },
                    });
                } else {
                    const instituteId = authorityKeys[0];

                    if (instituteId && userId) {
                        try {
                            await fetchAndStoreInstituteDetails(
                                instituteId,
                                userId
                            );
                            const status = await fetchAndStoreStudentDetails(
                                instituteId,
                                userId
                            );
                            if (status == 200) {
                                navigate({
                                    to: "/SessionSelectionPage",
                                    search: {
                                        redirect: redirect || "/dashboard",
                                    },
                                    state: { type, courseId },
                                });
                            } else if (status == 201) {
                                navigate({
                                    to:
                                        typeof redirect === "string"
                                            ? redirect
                                            : "/assessment/examination",
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
        <div className="w-full space-y-5">
            <AnimatePresence mode="wait">
                {!isOtpSent ? (
                    <motion.div
                        key="email"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                    >
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
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="email"
                                                            inputPlaceholder="Enter your email address"
                                                            label="Email Address"
                                                            required
                                                            size="large"
                                                            error={
                                                                emailForm
                                                                    .formState
                                                                    .errors
                                                                    .email
                                                                    ?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={
                                                                field.onChange
                                                            }
                                                        />
                                                        <Mail className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>

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
                            </form>
                        </Form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="otp"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                    >
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
                                                                    onPaste={(
                                                                        e
                                                                    ) =>
                                                                        handleOtpPaste(
                                                                            e
                                                                        )
                                                                    }
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </motion.div>
                                        ))}
                                    </div>
                                    {otpForm.formState.errors.otp && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-lg p-2"
                                        >
                                            Please enter a valid 6-digit
                                            verification code
                                        </motion.div>
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="space-y-3"
                                >
                                    <motion.button
                                        type="submit"
                                        disabled={
                                            !otpForm
                                                .getValues()
                                                .otp.every(
                                                    (value) => value !== ""
                                                ) || isLoading
                                        }
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
                                                <span className="text-sm">
                                                    Verify & Sign In
                                                </span>
                                            </div>
                                        )}
                                    </motion.button>

                                    <div className="flex justify-center items-center space-x-3 text-sm">
                                        <motion.button
                                            type="button"
                                            onClick={handleBackToEmail}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                                        >
                                            <ArrowLeft className="w-3 h-3" />
                                            <span className="text-xs">
                                                Back to email
                                            </span>
                                        </motion.button>

                                        <div className="w-px h-3 bg-gray-300"></div>

                                        <motion.button
                                            type="button"
                                            whileHover={
                                                timer === 0
                                                    ? { scale: 1.02 }
                                                    : {}
                                            }
                                            whileTap={
                                                timer === 0
                                                    ? { scale: 0.98 }
                                                    : {}
                                            }
                                            className={`transition-colors duration-200 font-medium ${
                                                timer > 0
                                                    ? "text-gray-400 cursor-not-allowed"
                                                    : "text-gray-700 hover:text-gray-900"
                                            }`}
                                            onClick={() =>
                                                timer === 0 &&
                                                sendOtpMutation.mutate(email)
                                            }
                                            disabled={timer > 0}
                                        >
                                            {timer > 0 ? (
                                                <div className="flex items-center space-x-1">
                                                    <RefreshCw className="w-3 h-3" />
                                                    <span className="text-xs">
                                                        Resend in {timer}s
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-1">
                                                    <RefreshCw className="w-3 h-3" />
                                                    <span className="text-xs">
                                                        Resend code
                                                    </span>
                                                </div>
                                            )}
                                        </motion.button>
                                    </div>
                                </motion.div>
                            </form>
                        </Form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center pt-3"
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
            </motion.div>
        </div>
    );
}
