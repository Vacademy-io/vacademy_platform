import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { 
    Mail, 
    RefreshCw, 
    Shield, 
    ArrowLeft, 
    User, 
    Lock,
    Eye,
    EyeOff,
    CheckCircle
} from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { VscError } from "react-icons/vsc";

const emailSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

const otpSchema = z.object({
    otp: z.array(z.string().length(1)).length(6),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type OtpFormValues = { otp: string[] };

interface EmailSignUpProps {
    onSwitchToUsername: () => void;
    type?: string;
    courseId?: string;
}

export function EmailSignUp({
    onSwitchToUsername,
    type,
    courseId,
}: EmailSignUpProps) {
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [email, setEmail] = useState("");
    const [timer, setTimer] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const emailForm = useForm<EmailFormValues>({
        resolver: zodResolver(emailSchema),
        defaultValues: {
            email: "",
            fullName: "",
            password: "",
            confirmPassword: "",
        },
        mode: "onTouched",
    });

    const otpForm = useForm<OtpFormValues>({
        resolver: zodResolver(otpSchema),
        defaultValues: {
            otp: Array(6).fill(""),
        },
        mode: "onChange",
    });

    const startTimer = () => {
        setTimer(60);
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const sendOtpMutation = useMutation({
        mutationFn: async (email: string) => {
            // Simulate API call for sending OTP
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return { success: true };
        },
        onSuccess: () => {
            setIsOtpSent(true);
            startTimer();
            toast.success("Verification code sent to your email");
        },
        onError: () => {
            toast.error("Failed to send verification code");
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: async (otp: string) => {
            // Simulate API call for verifying OTP
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return { success: true };
        },
        onSuccess: () => {
            toast.success("Account created successfully!");
            // Navigate to dashboard or next step
        },
        onError: () => {
            toast.error("Invalid verification code");
        },
    });

    const onEmailSubmit = (data: EmailFormValues) => {
        setEmail(data.email);
        sendOtpMutation.mutate(data.email);
    };

    const onOtpSubmit = () => {
        const otpValue = otpForm.getValues("otp").join("");
        if (otpValue.length === 6) {
            verifyOtpMutation.mutate(otpValue);
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text/plain").slice(0, 6);
        const otpArray = pastedData.split("").concat(Array(6 - pastedData.length).fill(""));
        otpForm.setValue("otp", otpArray);
    };

    const handleBackToEmail = () => {
        setIsOtpSent(false);
        setTimer(0);
    };

    const handleOtpChange = (element: HTMLInputElement, index: number) => {
        const value = element.value;
        if (value.length > 1) {
            element.value = value[0];
        }

        const newOtp = [...otpForm.getValues("otp")];
        newOtp[index] = value;
        otpForm.setValue("otp", newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = element.parentElement?.nextElementSibling?.querySelector("input") as HTMLInputElement;
            if (nextInput) {
                nextInput.focus();
            }
        }
    };

    const handleOtpKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        index: number
    ) => {
        if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
            const prevInput = e.currentTarget.parentElement?.previousElementSibling?.querySelector("input") as HTMLInputElement;
            if (prevInput) {
                prevInput.focus();
            }
        }
    };

    return (
        <div className="space-y-6">
            <AnimatePresence mode="wait">
                {!isOtpSent ? (
                    <motion.div
                        key="email"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                    >
                        <Form {...emailForm}>
                            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                                {/* Full Name Field */}
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <FormField
                                        control={emailForm.control}
                                        name="fullName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="text"
                                                            inputPlaceholder="Enter your full name"
                                                            label="Full Name"
                                                            required
                                                            size="large"
                                                            error={
                                                                emailForm.formState.errors.fullName?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <User className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>

                                {/* Email Field */}
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
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
                                                                emailForm.formState.errors.email?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <Mail className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>

                                {/* Password Field */}
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <FormField
                                        control={emailForm.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType={showPassword ? "text" : "password"}
                                                            inputPlaceholder="Create a strong password"
                                                            label="Password"
                                                            required
                                                            size="large"
                                                            error={
                                                                emailForm.formState.errors.password?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 transition-colors"
                                                        >
                                                            {showPassword ? (
                                                                <EyeOff className="w-4 h-4" />
                                                            ) : (
                                                                <Eye className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>

                                {/* Confirm Password Field */}
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <FormField
                                        control={emailForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType={showConfirmPassword ? "text" : "password"}
                                                            inputPlaceholder="Confirm your password"
                                                            label="Confirm Password"
                                                            required
                                                            size="large"
                                                            error={
                                                                emailForm.formState.errors.confirmPassword?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 transition-colors"
                                                        >
                                                            {showConfirmPassword ? (
                                                                <EyeOff className="w-4 h-4" />
                                                            ) : (
                                                                <Eye className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>

                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="pt-1"
                                >
                                    <motion.button
                                        type="submit"
                                        disabled={sendOtpMutation.isPending}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                    >
                                        {sendOtpMutation.isPending ? (
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
                                    We've sent a verification code to{" "}
                                    <span className="font-medium text-gray-900">
                                        {email}
                                    </span>
                                </p>
                            </div>
                        </motion.div>

                        {/* OTP Input Fields */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-4"
                        >
                            <Form {...otpForm}>
                                <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Enter verification code
                                        </label>
                                        <div className="flex justify-center space-x-2">
                                            {Array.from({ length: 6 }).map((_, index) => (
                                                <motion.div
                                                    key={index}
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ delay: 0.4 + index * 0.05 }}
                                                >
                                                    <input
                                                        type="text"
                                                        maxLength={1}
                                                        className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all duration-200 bg-white"
                                                        onPaste={handleOtpPaste}
                                                        onChange={(e) => handleOtpChange(e.target, index)}
                                                        onKeyDown={(e) => handleOtpKeyDown(e, index)}
                                                        {...otpForm.register(`otp.${index}`)}
                                                    />
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    <motion.div
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                        className="space-y-3"
                                    >
                                        <motion.button
                                            type="submit"
                                            disabled={verifyOtpMutation.isPending}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                        >
                                            {verifyOtpMutation.isPending ? (
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
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="text-sm">
                                                        Verify & Create Account
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
                                                    Back to form
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
                    </motion.div>
                )}
            </AnimatePresence>

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
                    Prefer username signup?
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-700 transition-all duration-200 group-hover:w-full"></span>
                </motion.button>
                
                <div className="text-xs text-gray-500">
                    Already have an account?{" "}
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        onClick={() => navigate({ to: "/login" })}
                        className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
                    >
                        Sign in here
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
} 