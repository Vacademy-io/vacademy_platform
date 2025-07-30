import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { 
    Mail,
    User,
    CheckCircle,
    ArrowRight,
} from "lucide-react";
import { MyInput } from "@/components/design-system/input";

const userDetailsSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    username: z.string().min(3, "Username must be at least 3 characters"),
});

type UserDetailsValues = z.infer<typeof userDetailsSchema>;

interface ModalSignUpFormProps {
    type?: string;
    courseId?: string;
    onSwitchToLogin?: () => void;
}

export function ModalSignUpForm({
    type,
    courseId,
    onSwitchToLogin,
}: ModalSignUpFormProps) {
    const navigate = useNavigate();

    const userDetailsForm = useForm<UserDetailsValues>({
        resolver: zodResolver(userDetailsSchema),
        defaultValues: {
            email: "",
            fullName: "",
            username: "",
        },
    });

    const handleUserDetailsSubmit = async (data: UserDetailsValues) => {
        try {
            // Simulate API call for user registration
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            toast.success("Account created successfully!");
            console.log("Registration data:", {
                userDetails: data,
                type,
                courseId,
            });
            
            // Navigate to dashboard or next step
            navigate({ to: "/dashboard" });
        } catch (error) {
            toast.error("Registration failed. Please try again.");
        }
    };

    const handleOAuthSignUp = (provider: "google" | "github") => {
        try {
            const stateObj = {
                from: `${window.location.origin}/signup/oauth/learner`,
                account_type: "signup",
            };

            const base64State = btoa(JSON.stringify(stateObj));
            const signupUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(
                base64State
            )}`;
            window.location.href = signupUrl;
        } catch {
            toast.error("Failed to initiate signup. Please try again.");
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center space-y-3"
            >
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Create Your Account
                    </h3>
                    <p className="text-sm text-gray-600">
                        Join our learning community and start your journey
                    </p>
                </div>
            </motion.div>

            {/* OAuth Buttons */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2 mb-6"
            >
                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 font-medium hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                    onClick={() => handleOAuthSignUp("google")}
                    type="button"
                >
                    <FcGoogle className="w-4 h-4" />
                    <span className="text-sm">
                        Continue with Google
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 font-medium hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                    onClick={() => handleOAuthSignUp("github")}
                    type="button"
                >
                    <GitHubLogoIcon className="w-4 h-4" />
                    <span className="text-sm">
                        Continue with GitHub
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </motion.button>
            </motion.div>

            {/* Divider */}
            <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="relative my-5"
            >
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 py-1 text-gray-500 font-medium rounded-full border border-gray-200">
                        or continue with email
                    </span>
                </div>
            </motion.div>

            {/* User Details Form */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
            >
                <Form {...userDetailsForm}>
                    <form onSubmit={userDetailsForm.handleSubmit(handleUserDetailsSubmit)} className="space-y-4">
                        {/* Email Field */}
                        <FormField
                            control={userDetailsForm.control}
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
                                                    userDetailsForm.formState.errors.email?.message
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

                        {/* Full Name Field */}
                        <FormField
                            control={userDetailsForm.control}
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
                                                    userDetailsForm.formState.errors.fullName?.message
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

                        {/* Username Field */}
                        <FormField
                            control={userDetailsForm.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="Choose a username"
                                                label="Username"
                                                required
                                                size="large"
                                                error={
                                                    userDetailsForm.formState.errors.username?.message
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

                        {/* Create Account Button */}
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">Create Account</span>
                            </div>
                        </motion.button>
                    </form>
                </Form>
            </motion.div>

            {/* Sign In Link */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center pt-3"
            >
                <div className="text-xs text-gray-500">
                    Already have an account?{" "}
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        onClick={onSwitchToLogin || (() => navigate({ to: "/login" }))}
                        className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
                    >
                        Sign in here
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
} 