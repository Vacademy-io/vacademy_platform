import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shield, ArrowRight } from "lucide-react";
import { ModalEmailLogin } from "../../forms/modal/ModalEmailOtpForm";
import { ModalUsernameLogin } from "../../forms/modal/ModalUsernamePasswordForm";
import { LoginSettings } from "@/config/login/defaultLoginSettings";

interface ModularDynamicLoginContainerProps {
  instituteId?: string;
  settings?: LoginSettings | null;
  type?: string;
  courseId?: string;
  onSwitchToSignup?: () => void;
  onSwitchToForgotPassword?: () => void;
  onLoginSuccess?: () => void;
  className?: string;
}

export function ModularDynamicLoginContainer({
  instituteId,
  settings,
  type,
  courseId,
  onSwitchToSignup,
  onSwitchToForgotPassword,
  onLoginSuccess,
  className = ""
}: ModularDynamicLoginContainerProps) {
  const navigate = useNavigate();
  
  // Use backend settings if available, otherwise fall back to defaults
  const effectiveSettings = settings || {
    providers: {
      google: true,
      github: true,
      emailOtp: true,
      usernamePassword: true,
      defaultProvider: "usernamePassword" as const,
    },
    usernameStrategy: "email" as const,
    passwordStrategy: "manual" as const,
    passwordDelivery: "none" as const,
  };

  // Get enabled providers
  const enabledProviders = Object.entries(effectiveSettings.providers)
    .filter(([key, value]) => key !== "defaultProvider" && value === true)
    .map(([key]) => key);

  // Determine initial provider based on defaultProvider
  const defaultProvider = effectiveSettings.providers.defaultProvider;
  
  // State to track current provider being shown
  const [currentProvider, setCurrentProvider] = useState<string>(() => {
    // Priority: 1. Default provider from settings, 2. Email OTP if available, 3. First enabled provider
    if (enabledProviders.includes(defaultProvider)) {
      return defaultProvider;
    }
    // If email OTP is enabled, prefer it as default
    if (effectiveSettings.providers.emailOtp) {
      return "emailOtp";
    }
    // Fallback to first enabled provider or usernamePassword as last resort
    return enabledProviders[0] || "usernamePassword";
  });

  // Always show at least one provider, even if only one is enabled
  const shouldShowProviderSelection = enabledProviders.length > 0;

  // Update current provider if settings change and current provider is disabled
  useEffect(() => {
    if (!enabledProviders.includes(currentProvider) && enabledProviders.length > 0) {
      setCurrentProvider(enabledProviders[0]);
    }
  }, [enabledProviders, currentProvider]);

  const handleOAuthLogin = (provider: "google" | "github") => {
    try {
      // Get current page information for redirection after login
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const currentUrl = `${currentPath}${currentSearch}`;
      
      // Extract instituteId from current URL
      const urlParams = new URLSearchParams(currentSearch);
      const instituteIdFromUrl = urlParams.get("instituteId") || instituteId;
      
      // Determine the appropriate study-library URL based on current page and type
      let studyLibraryUrl = "/study-library/courses";
      
      if (type === "courseDetailsPage" && courseId) {
        studyLibraryUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
      } else if (currentPath.includes("/courses/course-details")) {
        // Extract courseId from current URL
        const courseIdFromUrl = urlParams.get("courseId");
        if (courseIdFromUrl) {
          studyLibraryUrl = `/study-library/courses/course-details?courseId=${courseIdFromUrl}&selectedTab=ALL`;
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
        instituteId: instituteIdFromUrl,
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
    <div className={`space-y-6 ${className}`}>
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
            Sign in to continue your learning journey
          </p>
        </div>
      </motion.div>

      {/* OAuth Providers */}
      {(effectiveSettings.providers.google || effectiveSettings.providers.github) && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          {effectiveSettings.providers.google && (
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
          )}
          
          {effectiveSettings.providers.github && (
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
          )}
        </motion.div>
      )}

      {/* Spacing between OAuth and forms */}
      {(effectiveSettings.providers.emailOtp || effectiveSettings.providers.usernamePassword) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="my-4"
        />
      )}

      {/* Login Forms - Show if enabled */}
      {(effectiveSettings.providers.emailOtp || effectiveSettings.providers.usernamePassword) && (
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
              {currentProvider === "emailOtp" && effectiveSettings.providers.emailOtp ? (
                <ModalEmailLogin
                  onSwitchToUsername={() => setCurrentProvider("usernamePassword")}
                  type={type}
                  courseId={courseId}
                  onSwitchToSignup={onSwitchToSignup}
                  onLoginSuccess={onLoginSuccess}
                  showUsernameSwitch={false} // Disable built-in switching since we handle it in container
                />
              ) : currentProvider === "usernamePassword" && effectiveSettings.providers.usernamePassword ? (
                <ModalUsernameLogin
                  onSwitchToEmail={() => setCurrentProvider("emailOtp")}
                  type={type}
                  courseId={courseId}
                  onSwitchToSignup={onSwitchToSignup}
                  onSwitchToForgotPassword={onSwitchToForgotPassword}
                  onLoginSuccess={onLoginSuccess}
                  showEmailSwitch={false} // Disable built-in switching since we handle it in container
                />
              ) : null}

              {/* Provider Switching Links - Only show if both username and email OTP are enabled */}
              {effectiveSettings.providers.emailOtp && effectiveSettings.providers.usernamePassword && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.15 }}
                  className="text-center pt-3"
                >
                  {currentProvider === "emailOtp" ? (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 relative group font-medium"
                      onClick={() => setCurrentProvider("usernamePassword")}
                    >
                      Prefer username login?
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-700 transition-all duration-200 group-hover:w-full"></span>
                    </motion.button>
                  ) : (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 relative group font-medium"
                      onClick={() => setCurrentProvider("emailOtp")}
                    >
                      Prefer email login?
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-700 transition-all duration-200 group-hover:w-full"></span>
                    </motion.button>
                  )}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* Signup Link - Always show regardless of providers */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-center mt-6"
      >
        <p className="text-xs text-gray-600">
          Don't have an account?{" "}
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={onSwitchToSignup}
            className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
          >
            Sign up here
          </motion.button>
        </p>
      </motion.div>

      {/* Security Notice */}
      <motion.div
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
      </motion.div>

      {/* Footer Links */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="text-center text-xs text-gray-600"
      >
        <p>
          By signing in, you agree to our{" "}
          <motion.button
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
