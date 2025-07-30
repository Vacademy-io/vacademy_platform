import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { 
    User, 
    Lock, 
    RefreshCw, 
    Shield, 
    Eye, 
    EyeOff,
    Mail,
    CheckCircle
} from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { VscError } from "react-icons/vsc";

const signupSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Please enter a valid email address"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type FormValues = z.infer<typeof signupSchema>;

interface UsernameSignUpProps {
    onSwitchToEmail: () => void;
    type?: string;
    courseId?: string;
}

export function UsernameSignUp({
    onSwitchToEmail,
    type,
    courseId,
}: UsernameSignUpProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            username: "",
            email: "",
            fullName: "",
            password: "",
            confirmPassword: "",
        },
        mode: "onTouched",
    });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            // Simulate API call for user registration
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return { success: true, user: values };
        },
        onMutate: () => {
            setIsLoading(true);
        },
        onSuccess: (response) => {
            toast.success("Account created successfully!");
            console.log("Registration successful:", response);
            // Navigate to dashboard or next step
        },
        onError: (error) => {
            console.error("Registration failed:", error);
            toast.error("Registration failed. Please try again.");
        },
        onSettled: () => {
            setIsLoading(false);
        },
    });

    function onSubmit(values: FormValues) {
        mutation.mutate(values);
    }

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Full Name Field */}
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <FormField
                            control={form.control}
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
                                                    form.formState.errors.fullName?.message
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

                    {/* Username Field */}
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <FormField
                            control={form.control}
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
                                                    form.formState.errors.username?.message
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
                        transition={{ delay: 0.3 }}
                    >
                        <FormField
                            control={form.control}
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
                                                    form.formState.errors.email?.message
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
                        transition={{ delay: 0.4 }}
                    >
                        <FormField
                            control={form.control}
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
                                                    form.formState.errors.password?.message
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
                        transition={{ delay: 0.5 }}
                    >
                        <FormField
                            control={form.control}
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
                                                    form.formState.errors.confirmPassword?.message
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

                    {/* Sign Up Button */}
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6 }}
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
                                        Creating account...
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center space-x-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm">Create Account</span>
                                </div>
                            )}
                        </motion.button>
                    </motion.div>
                </form>
            </Form>

            {/* Switch to Email Sign Up */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-center pt-3 space-y-2"
            >
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 relative group font-medium"
                    onClick={onSwitchToEmail}
                >
                    Prefer email signup?
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