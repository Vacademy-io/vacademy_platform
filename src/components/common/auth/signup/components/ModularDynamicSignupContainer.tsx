import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SignupStep,
  CredentialsForm,
  EmailInputForm,
  OtpVerificationForm,
} from "./reusable";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { ArrowRight } from "lucide-react";
import {
  LOGIN_URL_GOOGLE_GITHUB,
  LIVE_SESSION_REQUEST_OTP,
} from "@/constants/urls";
import axios from "axios";
import { toast } from "sonner";
import { useUnifiedRegistration } from "../hooks/use-unified-registration";
import { parseInstituteSettings } from "@/services/signup-api";
import {
  checkUserEnrollmentInInstitute,
  handleEnrolledUser,
} from "../utils/enrollment-checker";
import { Preferences } from "@capacitor/preferences";
import { useTheme } from "@/providers/theme/theme-provider";
import { setTokenInStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

interface ModularDynamicSignupContainerProps {
  instituteId?: string;
  settings?: SignupSettings;
  instituteDetails?: any; // Add institute details prop
  onSignupSuccess?: () => void;
  onBackToProviders?: () => void;
  className?: string;
}

type SignupStep =
  | "providers"
  | "emailInput"
  | "otpVerification"
  | "credentials"
  | "success";

export function ModularDynamicSignupContainer({
  instituteId,
  settings,
  instituteDetails,
  onSignupSuccess,
  onBackToProviders,
  className = "",
}: ModularDynamicSignupContainerProps) {
  const { setPrimaryColor } = useTheme();
  const { registerUser: registerUserUnified } = useUnifiedRegistration();
  const [currentStep, setCurrentStep] = useState<SignupStep>("providers");
  const [emailInput, setEmailInput] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [oauthData, setOAuthData] = useState<any>(null);
  const [emailForOtp, setEmailForOtp] = useState("");
  const [fullNameForOtp, setFullNameForOtp] = useState("");
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [hasExecutedCallback, setHasExecutedCallback] = useState(false);
  const [enrollmentChecked, setEnrollmentChecked] = useState<Set<string>>(
    new Set()
  );
  const [uiError, setUiError] = useState<
    | { type: "alreadyEnrolled" | "oauthError" | "network" | "validation"; message: string }
    | null
  >(null);

  // Use backend settings if available, otherwise fall back to defaults
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

  // Handle success step callback execution
  useEffect(() => {
    if (currentStep === "success" && onSignupSuccess && !hasExecutedCallback) {
      setHasExecutedCallback(true);

      // Execute callback after a delay to allow success message to be seen
      const timer = setTimeout(() => {
        onSignupSuccess();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentStep, onSignupSuccess, hasExecutedCallback]);

  // Reset callback execution flag when step changes
  useEffect(() => {
    if (currentStep !== "success") {
      setHasExecutedCallback(false);
    }
  }, [currentStep]);

  // Parse institute settings to check for allowLearnersToCreateCourses
  useEffect(() => {
    if (instituteDetails?.setting) {
      try {
        const parsedSettings = parseInstituteSettings(instituteDetails.setting);
        setInstituteSettings(parsedSettings);
      } catch (error) {
        // Silently handle parsing errors
      }
    }
  }, [instituteDetails]);

  // Apply institute theme and font (pre-login) from Preferences
  useEffect(() => {
    (async () => {
      try {
        const storedInstitute =
          instituteId ||
          (await Preferences.get({ key: "InstituteId" })).value ||
          "";
        if (!storedInstitute) return;
        const stored = await Preferences.get({
          key: `LEARNER_${storedInstitute}`,
        });
        if (!stored?.value) return;
        const parsed = JSON.parse(stored.value);
        if (parsed?.theme) {
          setPrimaryColor(parsed.theme);
        }
        if (parsed?.fontFamily) {
          const mapFamily = (f: string) => {
            const key = String(f).toUpperCase();
            if (key === "INTER")
              return 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "CAIRO")
              return 'Cairo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "PLAYPEN SANS")
              return 'Playpen Sans, cursive, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            return f;
          };
          const family = mapFamily(parsed.fontFamily);
          document.documentElement.style.setProperty(
            "--app-font-family",
            family
          );
          document.body.style.fontFamily = family;
        }
      } catch {
        // Ignore
      }
    })();
  }, [instituteId, setPrimaryColor]);

  // If no institute ID, show error
  if (!instituteId) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Configuration Error
          </h3>
          <p className="text-gray-600">Institute ID is required for signup</p>
        </div>
      </div>
    );
  }

  // Get enabled providers
  const enabledProviders = Object.entries(effectiveSettings.providers)
    .filter(([key, value]) => key !== "defaultProvider" && value === true)
    .map(([key]) => key);

  // Check if any providers are enabled
  const hasEnabledProviders = enabledProviders.length > 0;

  // Always show provider selection step, even if only one provider is enabled
  const shouldShowProviderSelection = hasEnabledProviders;

  // If no providers are enabled, show a message that signup is not available
  if (!hasEnabledProviders) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Signup Not Available
          </h3>
          <p className="text-gray-600 mb-4">
            Signup is currently disabled for this institute. Please contact your
            administrator to enable signup options.
          </p>
          {onBackToProviders && (
            <button
              onClick={onBackToProviders}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

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
        user_type: "learner",
        institute_id: instituteId,
        redirectTo: studyLibraryUrl,
        currentUrl,
        isModalSignup: true,
      } as const;

      const base64State = btoa(JSON.stringify(stateObj));
      const signupUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(
        base64State
      )}`;

      // Open OAuth in popup window
      const popup = window.open(
        signupUrl,
        "oauth_popup",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      if (!popup) {
        toast.error("Popup blocked! Please allow popups for this site.");
        setUiError({
          type: "network",
          message:
            "We couldn't open the sign up window. Please allow popups or try again.",
        });
        return;
      }

      // Listen for OAuth completion message from popup using a cleanup-aware handler
      let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
      let processed = false;

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        window.removeEventListener("storage", onStorage);
        try {
          if (bc) {
            bc.close();
            bc = null;
          }
        } catch {}
        if (cleanupTimer) {
          clearTimeout(cleanupTimer);
          cleanupTimer = null;
        }
      };

      const handleSuccessPayload = async (payload: unknown) => {
        if (processed) return;
        processed = true;
        // Handle tokens-only success (direct login path)
        if (
          payload &&
          typeof payload === "object" &&
          "accessToken" in payload &&
          "refreshToken" in payload
        ) {
          const { accessToken, refreshToken } = payload as {
            accessToken: string;
            refreshToken: string;
          };
          try {
            await setTokenInStorage(TokenKey.accessToken, accessToken);
            await setTokenInStorage(TokenKey.refreshToken, refreshToken);
            setCurrentStep("success");
            onSignupSuccess?.();
          } catch {
            toast.error("Failed to store authentication tokens. Please try again.");
            setUiError({
              type: "network",
              message:
                "We couldn't complete authentication. Please try again, or sign in if you already have an account.",
            });
          }
          return true;
        }
        return false;
      };

      const onMessage = async (event: MessageEvent) => {
        // Only handle messages we expect
        if (!event?.data || typeof event.data !== "object") return;

        if (event.data.type === "oauth_success") {
          const payload = event.data.data;
          const handled = await handleSuccessPayload(payload);
          if (!handled) {
            // Fallback to signup data flow
            handleOAuthSuccess(payload);
          }
          cleanup();
        } else if (event.data.type === "oauth_error") {
          cleanup();
          toast.error(event.data.data?.message || "OAuth authentication failed");
          setUiError({
            type: "oauthError",
            message:
              "Authentication failed. If you already have an account, please sign in instead.",
          });
        }
      };

      window.addEventListener("message", onMessage);

      // Fallback: listen for storage events when COOP blocks postMessage
      const onStorage = async (e: StorageEvent) => {
        if (!e) return;
        if (e.key === "OAUTH_RESULT" && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.type === "oauth_success") {
              const handled = await handleSuccessPayload(parsed.data);
              if (!handled) {
                handleOAuthSuccess(parsed.data);
              }
              // Clean up stored value
              localStorage.removeItem("OAUTH_RESULT");
              cleanup();
            } else if (parsed?.type === "oauth_error") {
              cleanup();
              toast.error(parsed?.data?.message || "OAuth authentication failed");
              setUiError({
                type: "oauthError",
                message:
                  "Authentication failed. If you already have an account, please sign in instead.",
              });
            }
          } catch { return; }
        }
      };
      window.addEventListener("storage", onStorage);

      // BroadcastChannel listener (works when COOP blocks postMessage)
      let bc: BroadcastChannel | null = null;
      try {
        if (typeof BroadcastChannel !== "undefined") {
          bc = new BroadcastChannel("OAUTH_CHANNEL");
          bc.onmessage = async (ev: MessageEvent) => {
            const msg = ev?.data;
            if (!msg || typeof msg !== "object") return;
            if (msg.type === "oauth_success") {
              const handled = await handleSuccessPayload(msg.data);
              if (!handled) {
                handleOAuthSuccess(msg.data);
              }
              cleanup();
            } else if (msg.type === "oauth_error") {
              cleanup();
              toast.error(msg?.data?.message || "OAuth authentication failed");
              setUiError({
                type: "oauthError",
                message:
                  "Authentication failed. If you already have an account, please sign in instead.",
              });
            }
          };
        }
      } catch {
        // ignore
      }

      // Immediate localStorage check in case write happened before listener attached
      (async () => {
        try {
          const existing = localStorage.getItem("OAUTH_RESULT");
          if (!existing) return;
          const parsed = JSON.parse(existing);
          if (parsed?.type === "oauth_success") {
            const handled = await handleSuccessPayload(parsed.data);
            if (!handled) {
              handleOAuthSuccess(parsed.data);
            }
            localStorage.removeItem("OAUTH_RESULT");
            cleanup();
          } else if (parsed?.type === "oauth_error") {
            cleanup();
            toast.error(parsed?.data?.message || "OAuth authentication failed");
            setUiError({
              type: "oauthError",
              message:
                "Authentication failed. If you already have an account, please sign in instead.",
            });
          }
        } catch { /* ignore */ }
      })();

      // Fallback cleanup after a timeout to avoid COOP-related access to popup.closed
      cleanupTimer = setTimeout(() => {
        cleanup();
      }, 5 * 60 * 1000);
    } catch (error) {
      toast.error("Failed to initiate signup. Please try again.");
      setUiError({
        type: "network",
        message: "Unable to start signup. Please check your network and try again.",
      });
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
      await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        {
          to: emailInput.trim(),
          subject: "Email Verification",
          service: "signup",
          name: "User",
          otp: "",
        },
        {
          params: { instituteId },
        }
      );

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
    // For OAuth flows, we should already have the full name, so use it
    if (selectedProvider === "oauth" && oauthData?.signupData?.name) {
      setEmailForOtp(email);
      setFullNameForOtp(oauthData.signupData.name); // Use the OAuth full name
    } else {
      // For regular email OTP flows, use the provided full name
      // When usernameStrategy is "email", use email as full name
      const fullNameToUse =
        effectiveSettings.usernameStrategy === "email" ? email : fullName || "";
      setEmailForOtp(email);
      setFullNameForOtp(fullNameToUse);
    }

    setCurrentStep("otpVerification");
  };

  const handleBackToProviders = () => {
    setCurrentStep("providers");
    setSelectedProvider(null);
    setEmailForOtp("");
    setFullNameForOtp("");
    // Removed onBackToProviders?.() call to keep user in signup flow
  };

  // Helper function to check enrollment only once per email
  const checkEnrollmentOnce = async (email: string) => {
    // If we've already checked this email, don't check again
    if (enrollmentChecked.has(email)) {
      return null;
    }

    const enrollmentResult = await checkUserEnrollmentInInstitute(
      email,
      instituteId!
    );

    // Mark this email as checked
    setEnrollmentChecked((prev) => new Set(prev).add(email));

    return enrollmentResult;
  };

  const handleOAuthSuccess = async (oauthData: any) => {
    try {
      const { signupData, state, emailVerified } = oauthData;

      // Store OAuth data for later use
      setOAuthData({ signupData, state, emailVerified });

      // ENROLLMENT CHECK: Check if user is already enrolled before proceeding
      // This handles OAuth flows with public email (Google, GitHub with public email)
      // For flows requiring email verification (GitHub private email, regular email OTP),
      // enrollment is checked AFTER OTP verification in the OtpVerificationForm
      if (signupData.email) {
        const enrollmentResult = await checkEnrollmentOnce(signupData.email);

        if (enrollmentResult?.isEnrolled) {
          const autoLoginResult = await handleEnrolledUser(
            signupData.email,
            instituteId!,
            () => {
              // Auto-login success - redirect to success step
              setCurrentStep("success");
              onSignupSuccess?.();
            },
            (error) => {
              // Auto-login failed - show error and go back to providers
              setCurrentStep("providers");
              setSelectedProvider(null);
              setOAuthData(null);
              setUiError({
                type: "alreadyEnrolled",
                message:
                  "This email is already registered. Please sign in to continue.",
              });
            },
            true // shouldRedirectAfterLogin - will handle navigation automatically
          );

          if (autoLoginResult.success) {
            return; // Auto-login handled everything
          }
        }
      }

      // Check credential requirements based on institute settings
      const needsUsername =
        effectiveSettings.usernameStrategy === "manual" ||
        effectiveSettings.usernameStrategy === " ";
      const needsPassword =
        effectiveSettings.passwordStrategy === "manual" ||
        effectiveSettings.passwordStrategy === " ";

      // GitHub with private email - always need email OTP verification
      // We don't check enrollment here because we need to verify the email first
      // Enrollment will be checked AFTER OTP verification in OtpVerificationForm
      if (signupData.provider === "github" && !signupData.email) {
        setCurrentStep("emailInput");
        setSelectedProvider("oauth");
        return;
      }

      // Google or GitHub with public email - check if we can register immediately
      if (
        signupData.provider === "google" ||
        (signupData.provider === "github" && signupData.email)
      ) {
        // If we need credentials, show credentials form
        if (needsUsername || needsPassword) {
          // For OAuth flows that need credentials, also set the email for consistency
          if (signupData.email) {
            setEmailForOtp(signupData.email);
          }
          setCurrentStep("credentials");
          setSelectedProvider("oauth");
          return;
        }

        // If no credentials needed, proceed with direct registration
        await handleDirectRegistration(signupData);
        return;
      }

      // Fallback - should not reach here
      // For fallback OAuth flows, also set the email if available
      if (signupData.email) {
        setEmailForOtp(signupData.email);
      }
      setCurrentStep("credentials");
      setSelectedProvider("oauth");
    } catch (error) {
      toast.error("Failed to process OAuth response. Please try again.");
      setUiError({
        type: "oauthError",
        message:
          "We couldn't complete authentication. Please try again, or sign in if you already have an account.",
      });
    }
  };

  const handleDirectRegistration = async (signupData: any) => {
    try {
      // Use unified registration hook for OAuth signups with settings
      await registerUserUnified({
        username: signupData.username || signupData.email?.split("@")[0],
        email: signupData.email,
        full_name: signupData.name, // This should already be the full name from OAuth
        instituteId: instituteId!,
        settings: effectiveSettings, // Pass settings for credential generation
        subject_id: signupData.sub, // OAuth subject ID (e.g., Google sub)
        vendor_id: signupData.provider, // OAuth provider (e.g., "google", "github")
      });

      setCurrentStep("success");

      // Callback will be handled by the success step component
    } catch (error) {
      toast.error("Failed to create account. Please try again.");
      // Fallback to credentials form
      setCurrentStep("credentials");
    }
  };

  const handleOtpVerificationSuccess = async (
    email: string,
    fullName?: string
  ) => {
    // ENROLLMENT CHECK: Check if user is already enrolled after OTP verification
    // This handles: GitHub private email, regular email OTP, and any other email verification flows
    // We check here because we now have a verified email address
    const enrollmentResult = await checkEnrollmentOnce(email);

    if (enrollmentResult?.isEnrolled) {
      const autoLoginResult = await handleEnrolledUser(
        email,
        instituteId!,
        () => {
          // Auto-login success - redirect to success step
          setCurrentStep("success");
          onSignupSuccess?.();
        },
        (error) => {
          // Auto-login failed - show error and go back to providers
          setCurrentStep("providers");
          setSelectedProvider(null);
          setOAuthData(null);
        },
        true // shouldRedirectAfterLogin - will handle navigation automatically
      );

      if (autoLoginResult.success) {
        return; // Auto-login handled everything
      }
    }

    // Check if we need credentials form
    const needsUsername =
      effectiveSettings.usernameStrategy === "manual" ||
      effectiveSettings.usernameStrategy === " ";
    const needsPassword =
      effectiveSettings.passwordStrategy === "manual" ||
      effectiveSettings.passwordStrategy === " ";

    // For OAuth flows, update the OAuth data with verified email
    if (selectedProvider === "oauth" && oauthData) {
      setOAuthData({
        ...oauthData,
        signupData: {
          ...oauthData.signupData,
          email: email,
          name: fullName || oauthData.signupData.name,
        },
      });

      // Also update the fullNameForOtp for OAuth flows
      setFullNameForOtp(oauthData.signupData.name);
    } else {
      // For non-OAuth flows, use the provided fullName
      // When usernameStrategy is "email", use email as full name
      const fullNameToUse =
        effectiveSettings.usernameStrategy === "email" ? email : fullName || "";
      setFullNameForOtp(fullNameToUse);
    }

    if (needsUsername || needsPassword) {
      // For OAuth flows that need credentials after OTP, ensure email is set
      if (selectedProvider === "oauth" && oauthData?.signupData?.email) {
        setEmailForOtp(email);
      }
      setCurrentStep("credentials");
    } else {
      // Direct registration - no credentials needed

      if (selectedProvider === "oauth" && oauthData) {
        // For OAuth flows, use the updated OAuth data - we already have the full name
        await handleDirectRegistration({
          ...oauthData.signupData,
          email: email,
          name: oauthData.signupData.name, // Use the name from OAuth, not the fullName parameter
        });
      } else {
        // For email OTP flows (non-OAuth), we need to ask for full name first
        // When usernameStrategy is "email", use email as full name
        const fullNameToUse =
          effectiveSettings.usernameStrategy === "email" ? email : fullName;

        if (!fullNameToUse) {
          setCurrentStep("credentials");
        } else {
          // We have everything needed for registration
          await registerUserUnified({
            email: email,
            full_name: fullNameToUse,
            instituteId: instituteId!,
            settings: effectiveSettings,
          });
          setCurrentStep("success");
        }
      }
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
              <span className="text-sm">Continue with Google</span>
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
              <span className="text-sm">Continue with GitHub</span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </motion.button>
          )}
        </div>
      </SignupStep>

      {/* Divider */}
      {effectiveSettings.providers.emailOtp && (
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
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700"
              >
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
                  className="px-4 bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
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
        <div className="text-center text-xs text-gray-600 p-4">
          <p>
            Already have an account?{" "}
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
        <div />
      </SignupStep>

      {/* Terms and Privacy Policy */}
      <SignupStep delay={0.95}>
        <div className="text-center text-xs text-gray-500">
          <p>
            I agree to{" "}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={async () => {
                try {
                  const storedInstitute =
                    instituteId ||
                    (await Preferences.get({ key: "InstituteId" })).value ||
                    "";
                  if (storedInstitute) {
                    const stored = await Preferences.get({
                      key: `LEARNER_${storedInstitute}`,
                    });
                    if (stored?.value) {
                      const parsed = JSON.parse(stored.value);
                      if (parsed?.termsAndConditionUrl) {
                        window.open(parsed.termsAndConditionUrl, "_blank");
                        return;
                      }
                    }
                  }
                } catch {
                  // ignore and fallback
                }
                window.open("/terms-and-conditions", "_blank");
              }}
              className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
            >
              terms and conditions
            </motion.button>{" "}
            and{" "}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={async () => {
                try {
                  const storedInstitute =
                    instituteId ||
                    (await Preferences.get({ key: "InstituteId" })).value ||
                    "";
                  if (storedInstitute) {
                    const stored = await Preferences.get({
                      key: `LEARNER_${storedInstitute}`,
                    });
                    if (stored?.value) {
                      const parsed = JSON.parse(stored.value);
                      if (parsed?.privacyPolicyUrl) {
                        window.open(parsed.privacyPolicyUrl, "_blank");
                        return;
                      }
                    }
                  }
                } catch {
                  // ignore and fallback
                }
                window.open("/privacy-policy", "_blank");
              }}
              className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
            >
              Privacy Policy
            </motion.button>
          </p>
        </div>
      </SignupStep>
    </div>
  );

  // Always show provider selection step, even if only one provider is enabled
  // This prevents automatic auth process from starting

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {uiError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {uiError.message}{" "}
            {uiError.type !== "validation" && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={onBackToProviders}
                className="ml-2 underline font-medium"
              >
                Sign in instead
              </motion.button>
            )}
          </div>
        )}
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
              // For OAuth flows, we already have the full name, so we can hide it
              selectedProvider === "oauth" && oauthData?.signupData?.name
            }
            privateEmailMessage={
              selectedProvider === "oauth" &&
              oauthData?.signupData?.provider === "github" &&
              !oauthData?.signupData?.email
                ? "Your GitHub email is private. Please provide your email address to complete the signup process."
                : selectedProvider === "oauth"
                ? "Please verify your email to complete the OAuth signup process."
                : "Please verify your email to complete the signup process."
            }
            instituteId={instituteId}
            onEnrolledUserDetected={() => {
              // User is already enrolled and auto-login was successful
              setCurrentStep("success");
              onSignupSuccess?.();
            }}
            checkEnrollmentOnce={checkEnrollmentOnce}
          />
        )}

        {currentStep === "otpVerification" && (
          <OtpVerificationForm
            email={emailForOtp}
            fullName={fullNameForOtp}
            onOtpVerified={handleOtpVerificationSuccess}
            onBack={handleBackToProviders}
            className=""
            instituteId={instituteId}
            onEnrolledUserDetected={() => {
              // User is already enrolled and auto-login was successful
              setCurrentStep("success");
              onSignupSuccess?.();
            }}
            checkEnrollmentOnce={checkEnrollmentOnce}
            settings={effectiveSettings}
          />
        )}

        {currentStep === "credentials" && (
          <>
            <CredentialsForm
              settings={effectiveSettings}
              initialData={{
                fullName:
                  (selectedProvider === "oauth" &&
                    oauthData?.signupData?.name) ||
                  fullNameForOtp ||
                  "",
                ...(effectiveSettings.usernameStrategy === "manual" ||
                effectiveSettings.usernameStrategy === " "
                  ? {
                      username:
                        selectedProvider === "oauth" &&
                        oauthData?.signupData?.email
                          ? oauthData.signupData.email
                          : "",
                    }
                  : {}),
              }}
              onSubmit={async (data) => {
                try {
                  // Determine the correct email source
                  const email =
                    selectedProvider === "oauth" && oauthData?.signupData?.email
                      ? oauthData.signupData.email
                      : emailForOtp;

                  // Use unified registration hook with settings
                  await registerUserUnified({
                    username: data.username,
                    email: email,
                    full_name: data.fullName || fullNameForOtp,
                    password: data.password,
                    instituteId: instituteId!,
                    settings: effectiveSettings, // Pass settings for credential generation
                    // Include OAuth fields if this is an OAuth flow
                    ...(selectedProvider === "oauth" &&
                      oauthData?.signupData && {
                        subject_id: oauthData.signupData.sub, // OAuth subject ID
                        vendor_id: oauthData.signupData.provider, // OAuth provider
                      }),
                  });

                  // Move to success step
                  setCurrentStep("success");
                  // Callback will be handled by the success step component
                } catch (error) {
                  toast.error("Failed to create account. Please try again.");
                }
              }}
              onBack={handleBackToProviders}
              isOAuth={selectedProvider === "oauth"}
              oauthProvider={
                selectedProvider === "oauth" && oauthData?.signupData?.provider
                  ? oauthData.signupData.provider
                  : ""
              }
              hideFullName={
                // For OAuth flows: hide full name if:
                // 1. We have OAuth name AND no manual credentials are needed, OR
                // 2. usernameStrategy is "email" (hide field but still use OAuth name)
                // For Email OTP: never hide full name (always ask for it after OTP verification)
                selectedProvider === "oauth" &&
                oauthData?.signupData?.name &&
                ((!(
                  effectiveSettings.usernameStrategy === "manual" ||
                  effectiveSettings.usernameStrategy === " "
                ) &&
                  !(
                    effectiveSettings.passwordStrategy === "manual" ||
                    effectiveSettings.passwordStrategy === " "
                  )) ||
                  effectiveSettings.usernameStrategy === "email")
              }
            />
          </>
        )}

        {currentStep === "success" && (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Account Created Successfully!
            </h3>
            <p className="text-gray-600">
              Redirecting to your learning center...
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
