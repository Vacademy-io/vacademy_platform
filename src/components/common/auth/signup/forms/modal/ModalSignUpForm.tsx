import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { 
    User,
    CheckCircle,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { getInstituteDetails, parseInstituteSettings, registerUser, getUserDetailsByEmail, handlePostSignupAuth, type InstituteDetails, type RegisterUserRequest } from "@/services/signup-api";
import { SignupEmailOtpForm } from "../page/SignupEmailOtpForm";

const userDetailsSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type UserDetailsValues = z.infer<typeof userDetailsSchema>;

interface ModalSignUpFormProps {
    type?: string;
    courseId?: string;
    instituteId?: string;
    onSwitchToLogin?: () => void;
    onSignupSuccess?: () => void;
}

export function ModalSignUpForm({
    type,
    courseId,
    instituteId: propInstituteId,
    onSwitchToLogin,
    onSignupSuccess,
}: ModalSignUpFormProps) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingInstitute, setIsFetchingInstitute] = useState(false);
    const [selectedInstitute, setSelectedInstitute] = useState<InstituteDetails | null>(null);
    const [instituteSettings, setInstituteSettings] = useState<{ allowLearnerSignup: boolean; allowTeacherSignup: boolean; learnersCanCreateCourses: boolean } | null>(null);
    const [currentStep, setCurrentStep] = useState<"email" | "details">("email");
    const [verifiedEmail, setVerifiedEmail] = useState("");

    const userDetailsForm = useForm<UserDetailsValues>({
        resolver: zodResolver(userDetailsSchema),
        defaultValues: {
            fullName: "",
            username: "",
            password: "",
            confirmPassword: "",
        },
    });

    // Get URL parameters for institute ID
    const urlParams = new URLSearchParams(window.location.search);
    const urlInstituteId = urlParams.get('instituteId');
    
    // Use prop instituteId if provided, otherwise use URL parameter
    const instituteId = propInstituteId || urlInstituteId;

    // Fetch institute details when component mounts (for modal signup)
    useEffect(() => {
        if (instituteId && !selectedInstitute) {
            fetchInstituteDetails(instituteId);
        } else if (!instituteId) {
            // If no institute ID, show a message or handle accordingly
        }
    }, [instituteId, selectedInstitute]);

    const fetchInstituteDetails = async (instituteId: string) => {
        setIsFetchingInstitute(true);
        try {
            const instituteDetails = await getInstituteDetails(instituteId);
            
            const settings = parseInstituteSettings(instituteDetails.setting);
            
            setSelectedInstitute(instituteDetails);
            setInstituteSettings(settings);
        } catch (error) {
            console.error("Error fetching institute details:", error);
            toast.error("Failed to fetch institute details. Please try again.");
        } finally {
            setIsFetchingInstitute(false);
        }
    };

    const handleUserDetailsCheck = async ({ email }: { email: string; response: unknown }) => {
        try {
            const userData = await getUserDetailsByEmail(email);
            
            // User exists, but we need to check if they're enrolled in the selected institute
            // Since the user details API doesn't return institute info, we'll proceed with enrollment
            // The backend will handle duplicate enrollment checks
            
            // Prepare user roles based on institute settings and course creation permissions
            const userRoles: string[] = [];
            
            // Always add STUDENT role for learners
            userRoles.push("STUDENT");
            
            // If learners can create courses, also add TEACHER role
            if (instituteSettings?.learnersCanCreateCourses) {
                userRoles.push("TEACHER");
            }
            
            const registrationData: RegisterUserRequest = {
                user: {
                    username: userData.username,
                    email: userData.email,
                    full_name: userData.full_name,
                    password: userData.password || "",
                    roles: userRoles,
                    root_user: false,
                },
                institute_id: selectedInstitute!.id,
                learner_package_session_enroll: null,
            };

            const response = await registerUser(registrationData);
            
            // Handle post-signup authentication and redirect
            await handlePostSignupAuth(
                response.accessToken,
                response.refreshToken,
                selectedInstitute!.id,
                navigate,
                true, // isModalSignup
                type,
                courseId
            );

            // Call onSignupSuccess callback for modal signup
            if (onSignupSuccess) {
                onSignupSuccess();
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
                // User doesn't exist, proceed to user details step
                setVerifiedEmail(email);
                setCurrentStep("details");
                toast.success("Email verified successfully! Please complete your registration.");
            } else {
                console.error("Error checking user details:", error);
                toast.error("Failed to check user details. Please try again.");
            }
        }
    };

    const handleUserDetailsSubmit = async (data: UserDetailsValues) => {
        
        if (!selectedInstitute) {
            toast.error("Institute details not available. Please try again.");
            return;
        }

        if (!instituteSettings) {
            toast.error("Institute settings not available. Please try again.");
            return;
        }

        if (!verifiedEmail) {
            toast.error("Please verify your email first.");
            return;
        }

        setIsLoading(true);
        try {
            // Prepare user roles based on institute settings and course creation permissions
            const userRoles: string[] = [];
            
            // Always add STUDENT role for learners
            userRoles.push("STUDENT");
            
            // If learners can create courses, also add TEACHER role
            if (instituteSettings.learnersCanCreateCourses) {
                userRoles.push("TEACHER");
            }
            
            const registrationData: RegisterUserRequest = {
                user: {
                    username: data.username,
                    email: verifiedEmail,
                    full_name: data.fullName,
                    password: data.password,
                    roles: userRoles,
                    root_user: false,
                },
                institute_id: selectedInstitute.id,
                learner_package_session_enroll: null,
            };

            // Call the registration API
            const response = await registerUser(registrationData);

            // Handle post-signup authentication and redirect
            await handlePostSignupAuth(
                response.accessToken,
                response.refreshToken,
                selectedInstitute.id,
                navigate,
                true, // isModalSignup
                type,
                courseId
            );

            // Call onSignupSuccess callback for modal signup
            if (onSignupSuccess) {
                onSignupSuccess();
            }
        } catch (error) {
            console.error("Registration failed:", error);
            toast.error("Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOAuthSignUp = (provider: "google" | "github") => {
        if (!selectedInstitute) {
            toast.error("Institute details not available. Please try again.");
            return;
        }

        try {
            // Get current page information for redirection after signup
            const currentPath = window.location.pathname;
            const currentSearch = window.location.search;
            const currentUrl = `${currentPath}${currentSearch}`;
            
            // Determine the appropriate study-library URL based on current page
            let studyLibraryUrl = "/study-library/courses";
            
            if (currentPath.includes("/courses/course-details")) {
                // Extract courseId from current URL
                const urlParams = new URLSearchParams(currentSearch);
                const courseId = urlParams.get("courseId");
                if (courseId) {
                    studyLibraryUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
                }
            } else if (currentPath.includes("/courses")) {
                // For courses page, redirect to study-library courses
                studyLibraryUrl = "/study-library/courses";
            }
            
            const stateObj = {
                from: `${window.location.origin}/signup/oauth/modal-learner`,
                account_type: "signup",
                institute_id: selectedInstitute.id,
                institute_name: selectedInstitute.institute_name,
                redirectTo: studyLibraryUrl,
                currentUrl: currentUrl,
                type: type, // Include type from props
                courseId: courseId, // Include courseId from props
                isModalSignup: true, // Flag to indicate this is a modal signup
            };

            const base64State = btoa(JSON.stringify(stateObj));
            const signupUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(
                base64State
            )}`;
            
            // Open OAuth flow in new tab to maintain user action context
            const newWindow = window.open(signupUrl, '_blank');
            
            if (newWindow) {
                // Close the modal since OAuth is happening in new tab
                if (onSignupSuccess) {
                    onSignupSuccess();
                }
            } else {
                // Fallback: redirect in current tab if popup is blocked
                window.location.href = signupUrl;
            }
        } catch {
            toast.error("Failed to initiate signup. Please try again.");
        }
    };

    // Show loading state while fetching institute details
    if (isFetchingInstitute) {
        return (
            <div className="space-y-4">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-600" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Loading Institute Details
                        </h3>
                        <p className="text-sm text-gray-600">
                            Please wait while we fetch your institute information...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show message if institute ID is provided but institute details couldn't be fetched
    if (instituteId && !selectedInstitute && !isFetchingInstitute) {
        return (
            <div className="space-y-4">
                <div className="text-center space-y-3">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Institute Not Found
                        </h3>
                        <p className="text-sm text-gray-600">
                            The provided institute ID is invalid or the institute details could not be loaded.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <AnimatePresence mode="wait">
                {currentStep === "email" ? (
                    <motion.div
                        key="email"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >


                        {/* Email Verification using SignupEmailOtpForm component */}
                        <SignupEmailOtpForm
                            onUserDetailsCheck={handleUserDetailsCheck}
                            onSwitchToLogin={onSwitchToLogin}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="details"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
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
                                disabled={isLoading}
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
                                disabled={isLoading}
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
                            transition={{ delay: 0.3, duration: 0.3 }}
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

                        {/* Email Verification Display */}
                        {verifiedEmail && (
                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <CheckCircle className="w-5 h-5 text-blue-600" />
                                        <div>
                                            <h4 className="font-medium text-blue-900 text-sm">
                                                Email Verified
                                            </h4>
                                            <p className="text-xs text-blue-700">
                                                {verifiedEmail}
                                            </p>
                                        </div>
                                    </div>
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => setCurrentStep("email")}
                                        className="text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                                    >
                                        Change
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* User Details Form */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Form {...userDetailsForm}>
                                <form onSubmit={userDetailsForm.handleSubmit(handleUserDetailsSubmit)} className="space-y-4">
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

                                    {/* Password Field */}
                                    <FormField
                                        control={userDetailsForm.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="password"
                                                            inputPlaceholder="Create a password"
                                                            label="Password"
                                                            required
                                                            size="large"
                                                            error={
                                                                userDetailsForm.formState.errors.password?.message
                                                            }
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Confirm Password Field */}
                                    <FormField
                                        control={userDetailsForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="password"
                                                            inputPlaceholder="Confirm your password"
                                                            label="Confirm Password"
                                                            required
                                                            size="large"
                                                            error={
                                                                userDetailsForm.formState.errors.confirmPassword?.message
                                                            }
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
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
                                        disabled={isLoading}
                                        className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                            <CheckCircle className="w-4 h-4" />
                                            )}
                                            <span className="text-sm">
                                                {isLoading ? "Creating Account..." : "Create Account"}
                                            </span>
                                        </div>
                                    </motion.button>
                                </form>
                            </Form>
                        </motion.div>

                        {/* Already have an account link */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="text-center text-xs text-gray-500"
                        >
                            Already have an account?{" "}
                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                onClick={() => {
                                    if (onSwitchToLogin) {
                                        onSwitchToLogin();
                                    } else {
                                        navigate({ to: "/login" });
                                    }
                                }}
                                className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
                            >
                                Sign in here
                            </motion.button>
                        </motion.div>

                        {/* Terms Agreement */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 1.0 }}
                            className="text-center text-xs text-gray-600"
                        >
                            <p>
                                By creating an account, you agree to our{" "}
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() =>
                                        navigate({
                                            to: "/terms-and-conditions",
                                        })
                                    }
                                    className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
                                >
                                    Terms of Service
                                </motion.button>{" "}
                                and{" "}
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() =>
                                        navigate({ to: "/privacy-policy" })
                                    }
                                    className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
                                >
                                    Privacy Policy
                                </motion.button>
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
} 