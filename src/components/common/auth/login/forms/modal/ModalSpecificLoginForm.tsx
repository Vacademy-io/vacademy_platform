import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
    Shield,
    ArrowRight,
} from "lucide-react";
import { ModalEmailLogin } from "./ModalEmailOtpForm";
import { ModalUsernameLogin } from "./ModalUsernamePasswordForm";

interface ModalSpecificLoginFormProps {
    type?: string;
    courseId?: string;
    onSwitchToSignup?: () => void;
    onSwitchToForgotPassword?: () => void;
    onLoginSuccess?: () => void;
}

export function ModalSpecificLoginForm({
    type,
    courseId,
    onSwitchToSignup,
    onSwitchToForgotPassword,
    onLoginSuccess,
}: ModalSpecificLoginFormProps) {
    const navigate = useNavigate();
    const [isEmailLogin, setIsEmailLogin] = useState(false);

    const handleOAuthLogin = (provider: "google" | "github") => {
        try {
            // Get current page information for redirection after login
            const currentPath = window.location.pathname;
            const currentSearch = window.location.search;
            const currentUrl = `${currentPath}${currentSearch}`;
            
            // Extract instituteId from current URL
            const urlParams = new URLSearchParams(currentSearch);
            const instituteId = urlParams.get("instituteId");
            

            
            // Determine the appropriate study-library URL based on current page and type
            let studyLibraryUrl = "/study-library/courses";
            
            if (type === "courseDetailsPage" && courseId) {
                studyLibraryUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
            } else if (currentPath.includes("/courses/course-details")) {
                // Extract courseId from current URL
                const courseId = urlParams.get("courseId");
                if (courseId) {
                    studyLibraryUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
                }
            } else if (currentPath.includes("/courses")) {
                // For courses page, redirect to study-library courses
                studyLibraryUrl = "/study-library/courses";
            }
            
            // Store additional data in sessionStorage to reduce state size
            const modalOAuthData = {
                redirectTo: studyLibraryUrl,
                currentUrl: currentUrl,
                type: type,
                courseId: courseId,
                instituteId: instituteId,
            };
            
            // Store in sessionStorage
            sessionStorage.setItem('modal_oauth_data', JSON.stringify(modalOAuthData));
            
            // Create minimal state object
            const stateObj = {
                from: `${window.location.origin}/login/oauth/modal-learner`,
                account_type: "login",
            };

            const stateJson = JSON.stringify(stateObj);
            const base64State = btoa(stateJson);
            const encodedState = encodeURIComponent(base64State);
            const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodedState}`;
            
            // Open OAuth flow in new tab to maintain user action context
            const newWindow = window.open(loginUrl, '_blank');
            
            if (newWindow) {
                // Close the modal since OAuth is happening in new tab
                if (onLoginSuccess) {
                    onLoginSuccess();
                }
            } else {
                // Fallback: redirect in current tab if popup is blocked
                window.location.href = loginUrl;
            }
        } catch {
            toast.error("Failed to initiate login. Please try again.");
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
                        Welcome Back
                    </h3>
                    <p className="text-sm text-gray-600">
                        Sign in to continue your journey
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
                   className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
                    onClick={() => handleOAuthLogin("google")}
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
                   className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
                    onClick={() => handleOAuthLogin("github")}
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
                        or continue with
                    </span>
                </div>
            </motion.div>

            {/* Login Forms */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
            >
                <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.1 }}
                    >
                        {isEmailLogin ? (
                            <ModalEmailLogin
                                onSwitchToUsername={() => setIsEmailLogin(false)}
                                type={type}
                                courseId={courseId}
                                onSwitchToSignup={onSwitchToSignup}
                                onLoginSuccess={onLoginSuccess}
                            />
                        ) : (
                            <ModalUsernameLogin
                                onSwitchToEmail={() => setIsEmailLogin(true)}
                                type={type}
                                courseId={courseId}
                                onSwitchToSignup={onSwitchToSignup}
                                onSwitchToForgotPassword={onSwitchToForgotPassword}
                                onLoginSuccess={onLoginSuccess}
                            />
                        )}
                    </motion.div>
                </motion.div>
            </motion.div>

            {/* Security Notice */}
            {/* Security message removed as requested */}
            {/* <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3 }}
                className="mt-4 p-3 bg-gray-50/80 border border-gray-200/60 rounded-lg"
            >
                <div className="flex items-start space-x-2">
                    <Shield className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-gray-800 mb-1">
                            Secure Login
                        </p>
                        <p className="text-xs text-gray-600">
                            Your data is protected with enterprise-grade encryption.
                        </p>
                    </div>
                </div>
            </motion.div> */}

            {/* Footer Links */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="text-center text-xs text-gray-600"
            >
                <p>
                    I agree to{" "}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() =>
                            navigate({
                                to: "/terms-and-conditions",
                            })
                        }
                        className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
                    >
                        terms and conditions
                    </motion.button>{" "}
                    and{" "}
                    <motion.button
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
        </div>
    );
} 