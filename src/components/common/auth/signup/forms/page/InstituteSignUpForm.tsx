import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { 
    Building2,
    User,
    CheckCircle,
    ChevronDown,
    Search,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { useSignupFlow } from "@/components/common/auth/signup/hooks/use-signup-flow";
import { SignupEmailOtpForm } from "./SignupEmailOtpForm";
import { getUserDetailsByEmail, registerUser, handlePostSignupAuth, type RegisterUserRequest } from "@/services/signup-api";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { AuthPageBranding } from "@/components/common/institute-branding";

const instituteSelectionSchema = z.object({
    instituteId: z.string().min(1, "Please select an institute"),
});

const userDetailsSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type InstituteSelectionValues = z.infer<typeof instituteSelectionSchema>;
type UserDetailsValues = z.infer<typeof userDetailsSchema>;

interface InstituteSignUpProps {
    type?: string;
    courseId?: string;
    onSwitchToLogin?: () => void;
}

export function InstituteSignUp({
    type,
    courseId,
    onSwitchToLogin,
}: InstituteSignUpProps) {
    const navigate = useNavigate();
    const search = useSearch({ from: "/signup/" });
    const [currentStep, setCurrentStep] = useState<"selection" | "email" | "details">("selection");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [verifiedEmail, setVerifiedEmail] = useState("");
    const domainRouting = useDomainRouting();
    
    // Use the signup flow hook
    const {
        state,
        handleInstituteSearch,
        handleInstituteSelect,
        updateUserData,
        updateSelectedRole,
        resetState,
    } = useSignupFlow(false, type, courseId); // false for main signup page

    // Check if institute ID is provided in URL (for modal signup)
    useEffect(() => {
        if (search && (search as { instituteId?: string }).instituteId && !state.selectedInstitute) {
            handleInstituteSelect((search as { instituteId?: string }).instituteId!);
        }
    }, [search, state.selectedInstitute, handleInstituteSelect]);

    // Filter institutes based on search query
    const filteredInstitutes = useMemo(() => {
        return state.searchResults;
    }, [state.searchResults]);

    const instituteSelectionForm = useForm<InstituteSelectionValues>({
        resolver: zodResolver(instituteSelectionSchema),
        defaultValues: {
            instituteId: "",
        },
    });

    const userDetailsForm = useForm<UserDetailsValues>({
        resolver: zodResolver(userDetailsSchema),
        defaultValues: {
            fullName: "",
            username: "",
            password: "",
            confirmPassword: "",
        },
    });

    const handleInstituteSelectLocal = async (instituteId: string) => {
        await handleInstituteSelect(instituteId);
        instituteSelectionForm.setValue("instituteId", instituteId);
        setIsDropdownOpen(false);
        setCurrentStep("email");
    };

    const handleUserDetailsCheck = async ({ email }: { email: string; response: unknown }) => {
        try {
            // Call the API to check if user already exists
            const userData = await getUserDetailsByEmail(email);
            
            // User exists, but we need to check if they're enrolled in the selected institute
            // Since the user details API doesn't return institute info, we'll proceed with enrollment
            // The backend will handle duplicate enrollment checks
            
            // Prepare user roles based on institute settings and course creation permissions
            const userRoles: string[] = [];
            
            // Always add STUDENT role for learners
            userRoles.push("STUDENT");
            
            // If learners can create courses, also add TEACHER role
            if (state.instituteSettings?.learnersCanCreateCourses) {
                userRoles.push("TEACHER");
            }
            
            // Call signup API with existing user data
            const registrationData: RegisterUserRequest = {
                user: {
                    username: userData.username,
                    email: userData.email,
                    full_name: userData.full_name,
                    password: userData.password || "",
                    roles: userRoles,
                    root_user: false,
                },
                institute_id: state.selectedInstitute!.id,
                learner_package_session_enroll: null,
            };

            const response = await registerUser(registrationData);
            
            // Handle post-signup authentication and redirect to dashboard
            await handlePostSignupAuth(
                response.accessToken,
                response.refreshToken,
                state.selectedInstitute!.id,
                navigate
            );
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

    const handleDropdownToggle = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleUserRegistrationWithPassword = async (password: string) => {
        if (!state.selectedInstitute) {
            toast.error("Please select an institute first");
            return;
        }

        if (!state.userData.email || !state.userData.fullName || !state.userData.username) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            // Prepare user roles based on institute settings and course creation permissions
            const userRoles: string[] = [];
            
            // Always add STUDENT role for learners
            userRoles.push("STUDENT");
            
            // If learners can create courses, also add TEACHER role
            if (state.instituteSettings?.learnersCanCreateCourses) {
                userRoles.push("TEACHER");
            }

            // Prepare registration payload with password
            const registrationData: RegisterUserRequest = {
                user: {
                    username: state.userData.username,
                    email: state.userData.email,
                    full_name: state.userData.fullName,
                    password: password,
                    roles: userRoles,
                    root_user: false,
                },
                institute_id: state.selectedInstitute.id,
                learner_package_session_enroll: null,
            };

            // Call the registration API
            const response = await registerUser(registrationData);

            // Handle post-signup authentication and redirect to dashboard
            await handlePostSignupAuth(
                response.accessToken,
                response.refreshToken,
                state.selectedInstitute.id,
                navigate
            );
        } catch (error) {
            console.error("Registration failed:", error);
            toast.error("Registration failed. Please try again.");
        }
    };

    const handleUserDetailsSubmit = async (data: UserDetailsValues) => {
        console.log("Form submission data:", data);
        console.log("Form state:", userDetailsForm.formState);
        
        // Check if form is valid
        const isValid = await userDetailsForm.trigger();
        if (!isValid) {
            console.log("Form validation failed:", userDetailsForm.formState.errors);
            toast.error("Please fill in all required fields correctly.");
            return;
        }
        
        if (!state.selectedInstitute) {
            toast.error("Please select an institute first");
            return;
        }

        if (!verifiedEmail) {
            toast.error("Please verify your email first.");
            return;
        }

        // Update user data in the hook
        updateUserData("email", verifiedEmail);
        updateUserData("fullName", data.fullName);
        updateUserData("username", data.username);

        // Call the registration function with password
        await handleUserRegistrationWithPassword(data.password);
    };

    const handleBackToSelection = () => {
        setCurrentStep("selection");
        resetState();
        instituteSelectionForm.reset();
        setVerifiedEmail("");
    };

    const handleBackToEmail = () => {
        setCurrentStep("email");
        setVerifiedEmail("");
    };

    const handleOAuthSignUp = (provider: "google" | "github") => {
        if (!state.selectedInstitute) {
            toast.error("Please select an institute first");
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
                from: `${window.location.origin}/signup/oauth/learner`,
                account_type: "signup",
                institute_id: state.selectedInstitute.id,
                institute_name: state.selectedInstitute.institute_name,
                redirectTo: studyLibraryUrl,
                currentUrl: currentUrl,
                isModalSignup: false, // false for main signup page
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
            <AnimatePresence mode="wait">
                {currentStep === "selection" ? (
                    <motion.div
                        key="selection"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                    >
                        {/* Institute Branding */}
                        {domainRouting.instituteId && (
                            <AuthPageBranding
                                branding={{
                                    instituteId: domainRouting.instituteId,
                                    instituteName: domainRouting.instituteName,
                                    instituteLogoFileId: domainRouting.instituteLogoFileId,
                                    instituteThemeCode: domainRouting.instituteThemeCode,
                                }}
                            />
                        )}

                        {/* Institute Selection Header */}
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
                                className="w-20 h-20 bg-gray-100 rounded-xl mx-auto flex items-center justify-center"
                            >
                                <Building2 className="w-12 h-12 text-gray-700" />
                            </motion.div>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-semibold text-gray-900">
                                    Select Your Institute
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Choose your educational institution from the list below
                                </p>
                            </div>
                        </motion.div>

                        {/* Institute Dropdown */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-4"
                        >
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Institute <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    {isDropdownOpen ? (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                                            <input
                                                type="text"
                                                placeholder="Search institutes..."
                                                value={state.searchQuery}
                                                onChange={(e) => handleInstituteSearch(e.target.value)}
                                                className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                                                autoFocus
                                            />
                                            {state.isSearching && (
                                                <Loader2 className="w-4 h-4 animate-spin text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleDropdownToggle}
                                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors duration-200"
                                            >
                                                <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleDropdownToggle}
                                            className="w-full p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:border-gray-900 focus:outline-none transition-all duration-200 flex items-center justify-between"
                                        >
                                            <span className={state.selectedInstitute ? "text-gray-900" : "text-gray-500"}>
                                                {state.selectedInstitute ? state.selectedInstitute.institute_name : "Select an institute..."}
                                            </span>
                                            {state.isFetchingInstituteDetails ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Options */}
                                {isDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        {filteredInstitutes.length > 0 ? (
                                            filteredInstitutes.map((institute) => (
                                                <button
                                                    key={institute.id}
                                                    type="button"
                                                    onClick={() => handleInstituteSelectLocal(institute.id)}
                                                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors duration-200"
                                                >
                                                    <div>
                                                        <h5 className="font-medium text-gray-900 text-sm">
                                                            {institute.institute_name}
                                                        </h5>
                                                        <p className="text-xs text-gray-600">
                                                            ID: {institute.id}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-sm">
                                                {state.searchQuery ? `No institutes found matching "${state.searchQuery}"` : "Start typing to search institutes"}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>

                        {/* Already have an account link - after dropdown */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
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
                    </motion.div>
                ) : currentStep === "email" ? (
                    <motion.div
                        key="email"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Institute Branding */}
                        {domainRouting.instituteId && (
                            <AuthPageBranding
                                branding={{
                                    instituteId: domainRouting.instituteId,
                                    instituteName: domainRouting.instituteName,
                                    instituteLogoFileId: domainRouting.instituteLogoFileId,
                                    instituteThemeCode: domainRouting.instituteThemeCode,
                                }}
                            />
                        )}

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
                        {/* Institute Display */}
                            {state.selectedInstitute && (
                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="p-3 bg-blue-50 border border-blue-200 rounded-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <Building2 className="w-5 h-5 text-blue-600" />
                                        <div>
                                            <h4 className="font-medium text-blue-900 text-sm">
                                                Institute
                                            </h4>
                                            <p className="text-xs text-blue-700">
                                                {state.selectedInstitute.institute_name}
                                            </p>
                                        </div>
                                    </div>
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.05 }}
                                        onClick={handleBackToSelection}
                                        className="text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                                    >
                                        Change
                                </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* OAuth Buttons on Step One */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-2"
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
                            transition={{ delay: 0.3, duration: 0.3 }}
                            className="relative"
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

                        {/* Email Verification using SignupEmailOtpForm component */}
                        <SignupEmailOtpForm
                            onUserDetailsCheck={handleUserDetailsCheck}
                            onSwitchToLogin={onSwitchToLogin}
                        />

                        {/* Terms Agreement - also show on step one */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
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
                                    onClick={() => navigate({ to: "/privacy-policy" })}
                                    className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
                                >
                                    Privacy Policy
                                </motion.button>
                            </p>
                        </motion.div>
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
                        {/* Institute Branding */}
                        {domainRouting.instituteId && (
                            <AuthPageBranding
                                branding={{
                                    instituteId: domainRouting.instituteId,
                                    instituteName: domainRouting.instituteName,
                                    instituteLogoFileId: domainRouting.instituteLogoFileId,
                                    instituteThemeCode: domainRouting.instituteThemeCode,
                                }}
                            />
                        )}

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

                        {/* OAuth buttons removed on details step */}



                        {/* Email Verification Display */}
                        {verifiedEmail && (
                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
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
                                        onClick={handleBackToEmail}
                                        className="text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                                    >
                                        Change
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* Role Selection */}
                        {state.instituteSettings && (state.instituteSettings.allowLearnerSignup && state.instituteSettings.allowTeacherSignup) && (
                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="space-y-2"
                            >
                                <label className="block text-sm font-medium text-gray-700">
                                    Select Role <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {state.instituteSettings.allowLearnerSignup && (
                                        <button
                                            key="learner"
                                            type="button"
                                            onClick={() => updateSelectedRole("learner")}
                                            className={`p-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                                                state.selectedRole === "learner"
                                                    ? "bg-gray-900 text-white border-gray-900"
                                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                                            }`}
                                        >
                                            Learner
                                        </button>
                                    )}
                                    {state.instituteSettings.allowTeacherSignup && (
                                        <button
                                            key="teacher"
                                            type="button"
                                            onClick={() => updateSelectedRole("teacher")}
                                            className={`p-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                                                state.selectedRole === "teacher"
                                                    ? "bg-gray-900 text-white border-gray-900"
                                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                                            }`}
                                        >
                                            Teacher
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* User Details Form */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.7 }}
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
                                        disabled={state.isRegistering}
                                        whileHover={{ scale: state.isRegistering ? 1 : 1.01 }}
                                        whileTap={{ scale: state.isRegistering ? 1 : 0.99 }}
                                        className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            {state.isRegistering ? (
                                                <div className="flex items-center space-x-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                                    <span className="text-sm">Creating Account...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="text-sm">Create Account</span>
                                                </>
                                            )}
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


                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
} 