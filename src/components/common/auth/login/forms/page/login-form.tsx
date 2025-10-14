import { useEffect, useState } from "react";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate } from "@tanstack/react-router";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import {
  getTokenDecodedData,
  getTokenFromStorage,
  handleSSOLogin,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { EmailLogin } from "./EmailOtpForm";
import { UsernameLogin } from "./UsernamePasswordForm";
import { Preferences } from "@capacitor/preferences";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import {
  HOLISTIC_INSTITUTE_ID,
  LOGIN_URL_GOOGLE_GITHUB,
} from "@/constants/urls";
import { toast } from "sonner";
import { useTheme } from "@/providers/theme/theme-provider";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import ClipLoader from "react-spinners/ClipLoader";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import {
  getStudentDisplaySettings,
} from "@/services/student-display-settings";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { AuthPageBranding } from "@/components/common/institute-branding";
import { identifyUser } from "@/lib/analytics";
import { useEffect as useEffectTheme } from "react";

export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

export const setToStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

export function LoginForm({
  type,
  courseId,
  onSwitchToSignup,
}: {
  type?: string;
  courseId?: string;
  onSwitchToSignup?: () => void;
}) {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const urlParams = new URLSearchParams(window.location.search);
  const [isSSOLoading, setIsSSOLoading] = useState(false);
  const isPublic = urlParams.get("isPublicAssessment");
  const redirect = urlParams.get("redirect");
  const [isEmailLogin, setIsEmailLogin] = useState(isPublic === "true");
  const [providerFlags, setProviderFlags] = useState<{
    allowGoogleAuth: boolean;
    allowGithubAuth: boolean;
    allowEmailOtpAuth: boolean;
    allowUsernamePasswordAuth: boolean;
  }>({ allowGoogleAuth: true, allowGithubAuth: true, allowEmailOtpAuth: true, allowUsernamePasswordAuth: true });
  const { setInstituteId } = useInstituteFeatureStore();
  const domainRouting = useDomainRouting();
  
  // Pre-login theme and font from Preferences if present (external-first branding)
  useEffectTheme(() => {
    (async () => {
      try {
        const instituteId = (await Preferences.get({ key: "InstituteId" })).value || "";
        if (!instituteId) return;
        const stored = await Preferences.get({ key: `LEARNER_${instituteId}` });
        if (!stored?.value) return;
        const parsed = JSON.parse(stored.value);
        if (parsed?.theme) {
          setPrimaryColor(parsed.theme);
        }
        // Update provider flags from preferences
        setProviderFlags({
          allowGoogleAuth: parsed?.allowGoogleAuth !== false,
          allowGithubAuth: parsed?.allowGithubAuth !== false,
          allowEmailOtpAuth: parsed?.allowEmailOtpAuth !== false,
          allowUsernamePasswordAuth: parsed?.allowUsernamePasswordAuth !== false,
        });
        if (parsed?.allowUsernamePasswordAuth === false && parsed?.allowEmailOtpAuth !== false) {
          setIsEmailLogin(true);
        }
        if (parsed?.fontFamily) {
          const mapFamily = (f: string) => {
            const key = String(f).toUpperCase();
            if (key === "INTER") return 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "CAIRO") return 'Cairo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "PLAYPEN SANS") return 'Playpen Sans, cursive, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "WORK SANS") return 'Work Sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            return f;
          };
          const family = mapFamily(parsed.fontFamily);
          document.documentElement.style.setProperty("--app-font-family", family);
          document.body.style.fontFamily = family;
        }
      } catch {
        // ignore
      }
    })();
  }, [setPrimaryColor]);
  // Providers from stored flags
  const authProviders = {
    google: providerFlags.allowGoogleAuth,
    github: providerFlags.allowGithubAuth,
  };

  useEffect(() => {
    const ssoLoginSuccess = handleSSOLogin();
    if (ssoLoginSuccess) {
      setIsSSOLoading(true);
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("accessToken");
    const refreshToken = urlParams.get("refreshToken");

    if (
      isNullOrEmptyOrUndefined(accessToken) ||
      isNullOrEmptyOrUndefined(refreshToken)
    ) {
      return;
    }

    if (accessToken && refreshToken) {
      setTokenInStorage(TokenKey.accessToken, accessToken);
      setTokenInStorage(TokenKey.refreshToken, refreshToken);
      handleSuccessfulLogin(accessToken, redirect);
    }
  }, [navigate]);

  // Listen for OAuth completion from popup via localStorage/BroadcastChannel
  useEffect(() => {
    let processed = false;

    const finalizeLoginWithTokens = async (
      accessToken: string,
      refreshToken: string
    ) => {
      try {
        await setTokenInStorage(TokenKey.accessToken, accessToken);
        await setTokenInStorage(TokenKey.refreshToken, refreshToken);
        await handleSuccessfulLogin(accessToken, redirect);
      } catch {
        toast.error("Failed to complete login. Please try again.");
      }
    };

    const storageHandler = async (e: StorageEvent) => {
      if (!e) return;
      if (e.key === "OAUTH_RESULT" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.type === "oauth_success" && parsed?.data) {
            const { accessToken, refreshToken } = parsed.data || {};
            if (!processed && accessToken && refreshToken) {
              processed = true;
              await finalizeLoginWithTokens(accessToken, refreshToken);
            }
          }
          // Clean up
          localStorage.removeItem("OAUTH_RESULT");
        } catch {
          // Ignore JSON parse errors while reading OAuth result
          void 0;
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("OAUTH_CHANNEL");
        bc.onmessage = async (ev: MessageEvent) => {
          const msg = ev?.data;
          if (!msg || typeof msg !== "object") return;
          if (msg.type === "oauth_success" && msg.data) {
            const { accessToken, refreshToken } = msg.data || {};
            if (!processed && accessToken && refreshToken) {
              processed = true;
              await finalizeLoginWithTokens(accessToken, refreshToken);
            }
          }
        };
      }
    } catch {
      // Ignore BroadcastChannel construction failures in unsupported environments
      void 0;
    }

    // Immediate localStorage check in case write happened before listener attached
    const checkLocalOnce = async () => {
      try {
        const existing = localStorage.getItem("OAUTH_RESULT");
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed?.type === "oauth_success" && parsed?.data) {
            const { accessToken, refreshToken } = parsed.data || {};
            if (!processed && accessToken && refreshToken) {
              processed = true;
              await finalizeLoginWithTokens(accessToken, refreshToken);
            }
          }
          localStorage.removeItem("OAUTH_RESULT");
        }
      } catch {
        // Ignore localStorage access/parse errors
        void 0;
      }
    };
    checkLocalOnce();

    // Short polling as a last resort
    const pollUntil = Date.now() + 15000;
    const pollTimer = window.setInterval(() => {
      if (processed || Date.now() > pollUntil) {
        window.clearInterval(pollTimer);
        return;
      }
      void checkLocalOnce();
    }, 400);

    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      try {
        window.clearInterval(pollTimer);
      } catch {
        // Ignore timer cleanup errors
        void 0;
      }
      try {
        if (bc) bc.close();
      } catch {
        // Ignore BroadcastChannel close errors
        void 0;
      }
    };
  }, [navigate, redirect]);

  // Apply domain routing theme if available
  useEffect(() => {
    if (domainRouting.instituteThemeCode) {
      setPrimaryColor(domainRouting.instituteThemeCode);
    }
  }, [domainRouting.instituteThemeCode, setPrimaryColor]);

  const handleSuccessfulLogin = async (
    accessToken: string,
    redirect?: string | null
  ) => {
    try {
      const decodedData = getTokenDecodedData(accessToken);
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];

      // Identify user in analytics as soon as we know the userId
      if (userId) {
        try {
          identifyUser(userId, {
            username: decodedData?.username,
            email: decodedData?.email,
          });
        } catch {
          console.warn("Failed to identify user for analytics");
        }
      }

      if (authorityKeys.length > 1) {
        // User has multiple institutes - redirect to institute selection
        navigate({
          to: "/institute-selection",
          search: { redirect: redirect || "/dashboard/" },
        });
        setIsSSOLoading(false);
      } else {
        // User has only one institute - proceed directly to dashboard
        const instituteId = authorities
          ? Object.keys(authorities)[0]
          : undefined;

        if (instituteId && userId) {
          try {
            // Fetch and store institute details
            const details = await fetchAndStoreInstituteDetails(
              instituteId,
              userId
            );
            setInstituteId(instituteId);
            if (instituteId === HOLISTIC_INSTITUTE_ID) {
              setPrimaryColor("holistic");
            } else {
              setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
            }
          } catch (error) {
            console.error("Error fetching institute details:", error);
            
          }

          try {
            await fetchAndStoreStudentDetails(instituteId, userId);
          } catch {
            toast.error("Failed to fetch student details");
          }
        } else {
          toast.error("Invalid user data received");
        }

        // Refresh and use Student Display Settings post-login route
        try {
          const settings = await getStudentDisplaySettings(true);
          const redirectRoute =
            settings?.postLoginRedirectRoute || "/dashboard";

          console.group("[Post-Login Redirect | Username/Password]");
          console.log("Fetched settings:", settings);
          console.log("Resolved redirectRoute:", redirectRoute);
          console.groupEnd();

          if (/^https?:\/\//.test(redirectRoute)) {
            window.location.assign(redirectRoute);
          } else {
            navigate({ to: redirectRoute as never });
          }
        } catch (e) {
          console.error(
            "[Post-Login Redirect] Falling back to /dashboard due to error:",
            e
          );
          navigate({ to: "/dashboard" });
        }
      }
    } catch {
      toast.error("Failed to process user data");
    }
  };

  useEffect(() => {
    const redirectToDashboardIfAuthenticated = async () => {
      const token = await getTokenFromStorage(TokenKey.accessToken);
      const studentDetails = await getFromStorage("StudentDetails");
      const instituteDetails = await getFromStorage("InstituteDetails");

      if (
        !isNullOrEmptyOrUndefined(token) &&
        !isNullOrEmptyOrUndefined(studentDetails) &&
        !isNullOrEmptyOrUndefined(instituteDetails)
      ) {
        navigate({ to: "/dashboard" });
      }
    };

    redirectToDashboardIfAuthenticated();
  }, [navigate]);

  const handleOAuthLogin = (provider: "google" | "github") => {
    try {
      const stateObj = {
        from: `${window.location.origin}/login/oauth/learner`,
        account_type: "login",
        user_type: "learner",
        isModalLogin: false, // Flag to indicate this is a page login
      };

      const base64State = btoa(JSON.stringify(stateObj));
      const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(
        base64State
      )}`;
      window.location.href = loginUrl;
    } catch {
      toast.error("Failed to initiate login. Please try again.");
    }
  };

  if (isSSOLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Subtle Background Elements (gradients removed) */}
        <div className="absolute inset-0 -z-10" />
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 2, -2, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-20 left-20 w-24 h-24 bg-muted/20 rounded-full blur-xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, -2, 2, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-20 right-20 w-32 h-32 bg-muted/20 rounded-full blur-xl"
        />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
              className="inline-block"
            >
              <ClipLoader size={40} color="#374151" />
            </motion.div>
          </div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-semibold text-gray-900 mb-2"
          >
            Preparing Your Experience
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 text-sm"
          >
            Getting your details and personalizing your dashboard...
          </motion.p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div
      className={`${
        type ? "h-[400px] overflow-auto" : "min-h-screen overflow-hidden"
      } bg-background relative `}
    >
      {/* Subtle Background Pattern (gradients removed) */}
      <div className="absolute inset-0 -z-10" />

      

      {/* Centered container */}
      <div className="w-full min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg xl:max-w-xl">
          {/* Prominent Institute Branding above the card */}
          {domainRouting.instituteId && (
            <div className="mb-4">
              <AuthPageBranding
                branding={{
                  instituteId: domainRouting.instituteId,
                  instituteName: domainRouting.instituteName,
                  instituteLogoFileId: domainRouting.instituteLogoFileId,
                  instituteThemeCode: domainRouting.instituteThemeCode,
                }}
              />
            </div>
          )}

          {/* Login Card */}
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className={`bg-white rounded-md ${
              type ? "" : "shadow-md border border-gray-200 p-5 lg:p-6 xl:p-8"
            }  `}
          >

              {/* Compact Header */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center mb-6"
              >
                <h2 className="text-lg sm:text-xl font-semibold text-primary-700 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600 text-sm">
                  Sign in to continue your journey
                </p>
              </motion.div>

              {/* Compact OAuth Buttons */}

              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-2 mb-6"
              >
                {authProviders?.google && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-primary-200 rounded-md bg-white text-gray-700 font-medium hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm transition-all duration-200 group"
                    onClick={() => handleOAuthLogin("google")}
                    type="button"
                  >
                    <FcGoogle className="w-4 h-4" />
                    <span className="text-sm">Continue with Google</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </motion.button>
                )}
                {authProviders?.github && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-primary-200 rounded-md bg-white text-gray-700 font-medium hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm transition-all duration-200 group"
                    onClick={() => handleOAuthLogin("github")}
                    type="button"
                  >
                    <GitHubLogoIcon className="w-4 h-4" />
                    <span className="text-sm">Continue with GitHub</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </motion.button>
                )}
              </motion.div>

              {/* Compact Divider */}
              {(authProviders?.google || authProviders?.github) && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.3 }}
                  className="relative my-5"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-primary-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 py-1 text-primary-700 font-medium rounded-full border border-primary-200">
                      or continue with
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Form Content */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                <AnimatePresence mode="wait">
                  {(() => {
                    const allowEmail = providerFlags.allowEmailOtpAuth;
                    const allowUserPass = providerFlags.allowUsernamePasswordAuth;

                    // Only Email OTP allowed
                    if (allowEmail && !allowUserPass) {
                      return (
                        <motion.div
                          key="email-only"
                          initial={{ x: 200, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -200, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <EmailLogin
                            onSwitchToUsername={() => { /* hidden via child check */ }}
                            type={type}
                            courseId={courseId}
                            onSwitchToSignup={onSwitchToSignup}
                            allowUsernamePasswordAuth={providerFlags.allowUsernamePasswordAuth}
                          />
                        </motion.div>
                      );
                    }

                    // Only Username/Password allowed
                    if (!allowEmail && allowUserPass) {
                      return (
                        <motion.div
                          key="username-only"
                          initial={{ x: 200, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -200, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <UsernameLogin
                            onSwitchToEmail={() => { /* no email route enabled */ }}
                            allowEmailOtpAuth={false}
                            type={type}
                            courseId={courseId}
                            onSwitchToSignup={onSwitchToSignup}
                          />
                        </motion.div>
                      );
                    }

                    // Both allowed: preserve toggle behavior
                    if (allowEmail && allowUserPass) {
                      return isEmailLogin ? (
                        <motion.div
                          key="email"
                          initial={{ x: 200, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -200, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <EmailLogin
                            onSwitchToUsername={() => setIsEmailLogin(false)}
                            type={type}
                            courseId={courseId}
                            onSwitchToSignup={onSwitchToSignup}
                            allowUsernamePasswordAuth={providerFlags.allowUsernamePasswordAuth}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="username"
                          initial={{ x: 200, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -200, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <UsernameLogin
                            onSwitchToEmail={() => setIsEmailLogin(true)}
                            allowEmailOtpAuth={providerFlags.allowEmailOtpAuth}
                            type={type}
                            courseId={courseId}
                            onSwitchToSignup={onSwitchToSignup}
                          />
                        </motion.div>
                      );
                    }

                    // None allowed: render nothing or a message
                    return null;
                  })()}
                </AnimatePresence>
              </motion.div>

              {/* Explore Courses (for institutes with public catalog) */}
              {domainRouting?.redirectPath && domainRouting.redirectPath !== "/login" ? (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="mt-4"
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => navigate({ to: domainRouting.redirectPath as never })}
                    className="w-full bg-primary-500 hover:bg-primary-400 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Explore Courses
                  </motion.button>
                </motion.div>
              ) : null}

              {/* Compact Security Notice */}
              {/* Security message removed as requested */}
              {/* <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3 }}
                className="mt-6 p-3 bg-gray-50/80 border border-gray-200/60 rounded-lg"
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
            </motion.div>

          {/* Footer Links */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-6 text-center text-xs text-gray-600"
          >
            <p>
              I agree to{" "}
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={async () => {
                  try {
                    const storedInstitute = (await Preferences.get({ key: "InstituteId" })).value || "";
                    if (storedInstitute) {
                      const stored = await Preferences.get({ key: `LEARNER_${storedInstitute}` });
                      if (stored?.value) {
                        const parsed = JSON.parse(stored.value);
                        if (parsed?.termsAndConditionUrl) {
                          window.open(parsed.termsAndConditionUrl, "_blank");
                          return;
                        }
                      }
                    }
                  } catch {
                    // Fallback to internal route below on any error
                  }
                  navigate({ to: "/terms-and-conditions" });
                }}
                className="text-primary-700 hover:text-primary-800 font-medium underline cursor-pointer"
              >
                terms and conditions
              </motion.button>{" "}
              and{" "}
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={async () => {
                  try {
                    const storedInstitute = (await Preferences.get({ key: "InstituteId" })).value || "";
                    if (storedInstitute) {
                      const stored = await Preferences.get({ key: `LEARNER_${storedInstitute}` });
                      if (stored?.value) {
                        const parsed = JSON.parse(stored.value);
                        if (parsed?.privacyPolicyUrl) {
                          window.open(parsed.privacyPolicyUrl, "_blank");
                          return;
                        }
                      }
                    }
                  } catch {
                    // Fallback to internal route below on any error
                  }
                  navigate({ to: "/privacy-policy" });
                }}
                className="text-primary-700 hover:text-primary-800 font-medium underline cursor-pointer"
              >
                Privacy Policy
              </motion.button>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
