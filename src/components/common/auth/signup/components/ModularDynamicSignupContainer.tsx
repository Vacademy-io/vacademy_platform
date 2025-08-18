import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignupStep, CredentialsForm, EmailInputForm, OtpVerificationForm } from "./reusable";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { ArrowRight, Shield } from "lucide-react";
import { LOGIN_URL_GOOGLE_GITHUB, LIVE_SESSION_REQUEST_OTP } from "@/constants/urls";
import axios from "axios";
import { toast } from "sonner";
import { registerUser } from "@/services/signup-api";

interface ModularDynamicSignupContainerProps {
  instituteId?: string;
  settings?: SignupSettings;
  onSignupSuccess?: () => void;
  onBackToProviders?: () => void;
  className?: string;
}

type SignupStep = "providers" | "emailInput" | "otpVerification" | "credentials" | "success";

export function ModularDynamicSignupContainer({
  instituteId,
  settings,
  onSignupSuccess,
  onBackToProviders,
  className = ""
}: ModularDynamicSignupContainerProps) {
  const [currentStep, setCurrentStep] = useState<SignupStep>("providers");
  const [emailInput, setEmailInput] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [oauthData, setOAuthData] = useState<any>(null);
  const [emailForOtp, setEmailForOtp] = useState("");
  const [fullNameForOtp, setFullNameForOtp] = useState("");

  // If settings are not available, use default settings
  const effectiveSettings = settings || {
    providers: {
      google: true,
      github: true,
      emailOtp: true,
      defaultProvider: "emailOtp",
    },
    googleSignupMode: "askCredentials",
    githubSignupMode: "askCredentials",
    emailOtpSignupMode: "askCredentials",
    usernameStrategy: "manual",
    passwordStrategy: "manual",
    passwordDelivery: "none",
  };

  // Debug logging - Keep this to see how component is rendering
  console.log("ModularDynamicSignupContainer: Current state", {
    hasSettings: !!settings,
    hasInstituteId: !!instituteId,
    instituteId,
    currentStep,
    effectiveSettings
  });

  // If no institute ID, show error
  if (!instituteId) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration Error</h3>
          <p className="text-gray-600">Institute ID is required for signup</p>
        </div>
      </div>
    );
  }

  // Get enabled providers
  const enabledProviders = Object.entries(effectiveSettings.providers)
    .filter(([key, value]) => key !== "defaultProvider" && value === true)
    .map(([key]) => key);

  // Check if we should show the provider selection step
  const shouldShowProviderSelection = enabledProviders.length > 1;

  const handleOAuthSignUp = (provider: "google" | "github") => {
    try {
      // Build state payload
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const currentUrl = `${currentPath}${currentSearch}`;

      let studyLibraryUrl = "/study-library/courses";
      if (currentPath.includes("/courses/course-details")) {
        const urlParams = new URLSearchParams(currentSearch);
        const courseId = urlParams.get("courseId");
        if (courseId) {
          studyLibraryUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
        }
      } else if (currentPath.includes("/courses")) {
        studyLibraryUrl = "/study-library/courses";
      }

      const stateObj = {
        from: `${window.location.origin}/oauth-popup-handler.html`,
        account_type: "signup",
        institute_id: instituteId,
        redirectTo: studyLibraryUrl,
        currentUrl,
        isModalSignup: true,
      } as const;

      const base64State = btoa(JSON.stringify(stateObj));
      const signupUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(base64State)}`;
      
      // Open OAuth in popup window
      const popup = window.open(
        signupUrl,
        'oauth_popup',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        toast.error("Popup blocked! Please allow popups for this site.");
        return;
      }

      // Listen for OAuth completion message from popup
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'oauth_success') {
          handleOAuthSuccess(event.data.data);
          window.removeEventListener('message', messageHandler);
        } else if (event.data.type === 'oauth_error') {
          console.error('[OAuth] Error response received:', event.data.data);
          toast.error(event.data.data.message || 'OAuth authentication failed');
          window.removeEventListener('message', messageHandler);
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
        }
      }, 1000);

    } catch (error) {
      console.error('OAuth signup error:', error);
      toast.error("Failed to initiate signup. Please try again.");
    }
  };

  const handleProviderSelect = (provider: string) => {
    if (provider === "google" || provider === "github") {
      handleOAuthSignUp(provider as "google" | "github");
      return;
    }
    
    // For email OTP, directly go to email input step
    if (provider === "emailOtp") {
      setSelectedProvider(provider);
      setCurrentStep("emailInput");
      return;
    }
    
    setSelectedProvider(provider);
    setCurrentStep("emailInput");
  };

  const handleEmailOtpSignup = async () => {
    if (!emailInput.trim()) return;
    try {
      setIsSendingOtp(true);
      await axios.post(LIVE_SESSION_REQUEST_OTP, {
        to: emailInput.trim(),
        subject: "Email Verification",
        service: "signup",
        name: "User",
        otp: "",
      });
      toast.success("OTP sent successfully");
      setEmailForOtp(emailInput.trim());
      setSelectedProvider("emailOtp");
      setCurrentStep("otpVerification");
    } catch (e) {
      toast.error("Failed to send OTP", { description: "Please try again" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleEmailInputSuccess = (email: string, fullName?: string) => {
    setEmailForOtp(email);
    setFullNameForOtp(fullName || "");
    setCurrentStep("otpVerification");
  };

  const handleBackToProviders = () => {
    setCurrentStep("providers");
    setSelectedProvider(null);
    setEmailForOtp("");
    setFullNameForOtp("");
    // Removed onBackToProviders?.() call to keep user in signup flow
  };



  const handleOAuthSuccess = async (oauthData: any) => {
    try {
      const { signupData, state, emailVerified } = oauthData;
      
      // Store OAuth data for later use
      setOAuthData({ signupData, state, emailVerified });
      
      // Check credential requirements based on institute settings
      const needsUsername = effectiveSettings.usernameStrategy === "manual" || effectiveSettings.usernameStrategy === " ";
      const needsPassword = effectiveSettings.passwordStrategy === "manual" || effectiveSettings.passwordStrategy === " ";
      
      // GitHub with private email - always need email OTP verification
      if (signupData.provider === "github" && !signupData.email) {
        setCurrentStep("emailInput");
        setSelectedProvider("oauth");
        return;
      }
      
      // Google or GitHub with public email - skip email OTP (already verified)
      if (signupData.provider === "google" || (signupData.provider === "github" && signupData.email)) {
        // If we need credentials, show credentials form
        if (needsUsername || needsPassword) {
          setCurrentStep("credentials");
          setSelectedProvider("oauth");
          return;
        }
        
        // If no credentials needed, proceed with direct registration
        await handleDirectRegistration(signupData);
        return;
      }
      
      // Fallback - should not reach here
      setCurrentStep("credentials");
      setSelectedProvider("oauth");
      
    } catch (error) {
      console.error('[OAuth] Error handling OAuth success:', error);
      toast.error("Failed to process OAuth response. Please try again.");
    }
  };

  const handleDirectRegistration = async (signupData: any) => {
    try {
      // Here you would call your registration API
      // For now, we'll simulate success
      toast.success("Account created successfully!");
      setCurrentStep("success");
      
      setTimeout(() => {
        onSignupSuccess?.();
      }, 1500);
      
    } catch (error) {
      console.error('[OAuth] Direct registration failed:', error);
      toast.error("Failed to create account. Please try again.");
      // Fallback to credentials form
      setCurrentStep("credentials");
    }
  };

  const handleOtpVerificationSuccess = async (email: string, fullName?: string) => {
    // Check if we need credentials form
    const needsUsername = effectiveSettings.usernameStrategy === "manual" || effectiveSettings.usernameStrategy === " ";
    const needsPassword = effectiveSettings.passwordStrategy === "manual" || effectiveSettings.passwordStrategy === " ";

    // For OAuth flows, update the OAuth data with verified email
    if (selectedProvider === "oauth" && oauthData) {
      setOAuthData({
        ...oauthData,
        signupData: {
          ...oauthData.signupData,
          email: email,
          name: fullName || oauthData.signupData.name
        }
      });
    }

    if (needsUsername || needsPassword) {
      setCurrentStep("credentials");
    } else {
      // Direct registration - this would need to be implemented
      setCurrentStep("success");
      setTimeout(() => {
        onSignupSuccess?.();
      }, 1500);
    }
  };

  const renderProviderSelection = () => (
    <div className="space-y-4">
      {/* Header */}
      <SignupStep delay={0.1}>
        <div className="text-center space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Create Your Account
            </h3>
            <p className="text-sm text-gray-600">
              Choose how you'd like to sign up
            </p>
          </div>
        </div>
      </SignupStep>

      {/* OAuth Providers */}
      <SignupStep delay={0.2}>
        <div className="space-y-2 mb-6">
          {effectiveSettings.providers.google && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleProviderSelect("google")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
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
              onClick={() => handleProviderSelect("github")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
              type="button"
            >
              <GitHubLogoIcon className="w-4 h-4" />
              <span className="text-sm">
                Continue with GitHub
              </span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </motion.button>
          )}
        </div>
      </SignupStep>

      {/* Divider */}
      {enabledProviders.length > 1 && (
        <SignupStep delay={0.4}>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 py-1 text-gray-500 font-medium rounded-full border border-gray-200">
                or continue with
              </span>
            </div>
          </div>
        </SignupStep>
      )}

      {/* Email OTP Input Field */}
      {effectiveSettings.providers.emailOtp && (
        <SignupStep delay={0.6}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white hover:bg-white"
                />
                <Button
                  onClick={handleEmailOtpSignup}
                  disabled={!emailInput.trim() || isSendingOtp}
                  className="px-6 bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                >
                  {isSendingOtp ? "Sending..." : "Send OTP"}
                </Button>
              </div>
            </div>
          </div>
        </SignupStep>
      )}

      {/* Login Link */}
      <SignupStep delay={0.8}>
        <div className="text-center text-xs text-gray-600">
          <p>
            Already have an account? {" "}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={onBackToProviders}
              className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
            >
              Sign in here
            </motion.button>
          </p>
        </div>
      </SignupStep>

      {/* Security Notice */}
      <SignupStep delay={0.9}>
        <div className="mt-1 p-3 bg-gray-50/80 border border-gray-200/60 rounded-lg">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-800 mb-1">
                Secure Signup
              </p>
              <p className="text-xs text-gray-600">
                Your data is protected with enterprise-grade encryption.
              </p>
            </div>
          </div>
        </div>
      </SignupStep>

      {/* Terms and Privacy Policy */}
      <SignupStep delay={0.95}>
        <div className="text-center text-xs text-gray-500">
          <p>
            By signing up, you agree to our{" "}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => window.open("/terms-and-conditions", "_blank")}
              className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
            >
              Terms of Service
            </motion.button>
            {" "}and{" "}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => window.open("/privacy-policy", "_blank")}
              className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
            >
              Privacy Policy
            </motion.button>
          </p>
        </div>
      </SignupStep>
    </div>
  );

  // If only one provider is enabled, skip provider selection
  if (!shouldShowProviderSelection && enabledProviders.length === 1) {
    const singleProvider = enabledProviders[0];
    
    switch (singleProvider) {
      case "google":
        // Immediately initiate OAuth for Google
        handleOAuthSignUp("google");
        return (
          <div className={`flex items-center justify-center p-8 ${className}`}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Opening Google OAuth...</p>
            </div>
          </div>
        );
      case "github":
        // Immediately initiate OAuth for GitHub
        handleOAuthSignUp("github");
        return (
          <div className={`flex items-center justify-center p-8 ${className}`}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Opening GitHub OAuth...</p>
            </div>
          </div>
        );
      case "emailOtp":
        return (
          <div className={className}>
            <EmailInputForm
              settings={effectiveSettings}
              initialEmail=""
              initialFullName=""
              onOtpSent={handleEmailInputSuccess}
              onBack={handleBackToProviders}
              isOAuth={false}
              hideFullName={false}
              privateEmailMessage=""
            />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {currentStep === "providers" && renderProviderSelection()}
        
        {currentStep === "emailInput" && (
          <EmailInputForm
            settings={effectiveSettings}
            initialEmail={
              selectedProvider === "oauth" && oauthData?.signupData?.email 
                ? oauthData.signupData.email 
                : ""
            }
            initialFullName={
              selectedProvider === "oauth" && oauthData?.signupData?.name 
                ? oauthData.signupData.name 
                : ""
            }
            onOtpSent={handleEmailInputSuccess}
            onBack={handleBackToProviders}
            isOAuth={selectedProvider === "oauth"}
            hideFullName={
              // GitHub with private email: ask only for email (hide full name) before OTP
              selectedProvider === "oauth" &&
              oauthData?.signupData?.provider === "github" &&
              !oauthData?.signupData?.email
            }
            privateEmailMessage={
              selectedProvider === "oauth" && 
              oauthData?.signupData?.provider === "github" && 
              !oauthData?.signupData?.email
                ? "Your GitHub email is private. Please provide your email address to complete the signup process."
                : "Please verify your email to complete the OAuth signup process."
            }
          />
        )}
        
        {currentStep === "otpVerification" && (
          <OtpVerificationForm
            email={emailForOtp}
            fullName={fullNameForOtp}
            onOtpVerified={handleOtpVerificationSuccess}
            onBack={handleBackToProviders}
            className=""
          />
        )}
        
        {currentStep === "credentials" && (
          <CredentialsForm
            settings={effectiveSettings}
            initialData={{
              fullName: selectedProvider === "oauth" && oauthData?.signupData?.name ? oauthData.signupData.name : "",
              ...(effectiveSettings.usernameStrategy === "manual" || effectiveSettings.usernameStrategy === " " ? {
                username: selectedProvider === "oauth" && oauthData?.signupData?.email ? oauthData.signupData.email : ""
              } : {}),
            }}
            onSubmit={async (data) => {
              try {
                // Call the register API
                const registerData = {
                  user: {
                    username: data.username || data.email, // Use username if provided, otherwise use email
                    email: emailForOtp,
                    full_name: data.fullName || fullNameForOtp,
                    password: data.password,
                    roles: ["LEARNER"],
                    root_user: false,
                  },
                  institute_id: instituteId!,
                };

                await registerUser(registerData);
                
                toast.success("Account created successfully!");
                
                // Move to success step
                setCurrentStep("success");
                setTimeout(() => {
                  onSignupSuccess?.();
                }, 1500);
              } catch (error) {
                console.error("Registration failed:", error);
                toast.error("Failed to create account. Please try again.");
              }
            }}
            onBack={handleBackToProviders}
            isOAuth={selectedProvider === "oauth"}
            oauthProvider={selectedProvider === "oauth" && oauthData?.signupData?.provider ? oauthData.signupData.provider : ""}
            hideFullName={
              // For OAuth (Google/GitHub): show full name field (prefilled) even if strategy would hide it
              // For Email OTP: never hide full name (always ask for it after OTP verification)
              false // Always show full name field for now to ensure it's visible and prefilled
            }
          />
        )}
        
        {currentStep === "success" && (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Created Successfully!</h3>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
