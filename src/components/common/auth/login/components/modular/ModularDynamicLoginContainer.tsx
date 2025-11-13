import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { ArrowRight } from "lucide-react";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Preferences } from "@capacitor/preferences";
import { useTheme } from "@/providers/theme/theme-provider";
import { ModalEmailLogin } from "../../forms/modal/ModalEmailOtpForm";
import { ModalUsernameLogin } from "../../forms/modal/ModalUsernamePasswordForm";
import { LoginSettings } from "@/config/login/defaultLoginSettings";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { TokenKey } from "@/constants/auth/tokens";
import { setTokenInStorage, getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { getStudentDisplaySettings } from "@/services/student-display-settings";

interface ModularDynamicLoginContainerProps {
  instituteId?: string;
  settings?: LoginSettings | null;
  signupSettings?: SignupSettings | null;
  type?: string;
  courseId?: string;
  onSwitchToSignup?: (email?: string, shouldAutoSendOtp?: boolean) => void;
  onSwitchToForgotPassword?: () => void;
  onLoginSuccess?: () => void;
  className?: string;
}

export function ModularDynamicLoginContainer({
  instituteId,
  settings,
  signupSettings,
  type,
  courseId,
  onSwitchToSignup,
  onSwitchToForgotPassword,
  onLoginSuccess,
  className = ""
}: ModularDynamicLoginContainerProps) {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  
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

  // Form providers are only emailOtp and usernamePassword
  const formEnabledProviders = ["emailOtp", "usernamePassword"].filter((p) => {
    const flags = effectiveSettings.providers as unknown as Record<string, boolean>;
    return Boolean(flags[p]);
  });

  // Check if signup is available
  const isSignupAvailable = !!(signupSettings && 
    Object.entries(signupSettings.providers)
      .filter(([key, value]) => key !== "defaultProvider" && value === true)
      .length > 0);

  // Determine initial provider based on defaultProvider (only form providers)
  const defaultProvider = effectiveSettings.providers.defaultProvider;
  
  // State to track current provider being shown
  const [currentProvider, setCurrentProvider] = useState<string>(() => {
    // Prefer defaultProvider only if it's a form provider and enabled
    const isFormDefault = (defaultProvider === "emailOtp" || defaultProvider === "usernamePassword")
      && formEnabledProviders.includes(defaultProvider);
    const initial = isFormDefault
      ? defaultProvider
      : (formEnabledProviders[0] || "usernamePassword");
    try { console.info("[ModularDynamicLoginContainer] init currentProvider=", initial, { defaultProvider, enabledProviders, formEnabledProviders }); } catch (err) { void err; }
    return initial;
  });

  // Always show at least one provider, even if only one is enabled
  // (selection UI currently always shown via enabled providers list)

  // Update current provider only if current provider is disabled among form providers
  useEffect(() => {
    if (!formEnabledProviders.includes(currentProvider) && formEnabledProviders.length > 0) {
      const canUseDefault = (defaultProvider === "emailOtp" || defaultProvider === "usernamePassword")
        && formEnabledProviders.includes(defaultProvider);
      const next = canUseDefault ? defaultProvider : formEnabledProviders[0];
      try { console.info("[ModularDynamicLoginContainer] adjusting currentProvider=", next); } catch (err) { void err; }
      setCurrentProvider(next);
    }
  }, [formEnabledProviders, currentProvider, defaultProvider]);

  useEffect(() => {
    // Helper to finalize login after receiving tokens
    const finalizeLoginWithTokens = async (accessToken: string, refreshToken: string) => {
      try {
        console.log('[ModularDynamicLoginContainer] 🎯 Finalizing login with tokens from popup');
        
        await setTokenInStorage(TokenKey.accessToken, accessToken);
        await setTokenInStorage(TokenKey.refreshToken, refreshToken);

        // Decode token to get user and institute information
        const decodedData = getTokenDecodedData(accessToken);
        const authorities = decodedData?.authorities;
        const userId = decodedData?.user;
        
        console.log('[ModularDynamicLoginContainer] 📋 Decoded token:', { userId, authorities });

        if (userId && authorities) {
          const authorityKeys = Object.keys(authorities);
          
          if (authorityKeys.length > 0) {
            // Use the first institute (or the one from sessionStorage if available)
            let instituteId = authorityKeys[0];
            
            // Try to get instituteId from sessionStorage if it was set during OAuth initiation
            try {
              const stored = sessionStorage.getItem('modal_oauth_data');
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.instituteId && authorityKeys.includes(parsed.instituteId)) {
                  instituteId = parsed.instituteId;
                }
              }
            } catch (e) { void e; }
            
            console.log('[ModularDynamicLoginContainer] 🏫 Fetching details for institute:', instituteId);
            
            // Fetch institute details
            const details = await fetchAndStoreInstituteDetails(instituteId, userId);
            if (setPrimaryColor) {
              setPrimaryColor(details?.institute_theme_code ?? import.meta.env.VITE_DEFAULT_THEME_COLOR ?? "#E67E22");
            }
            
            // Fetch student details
            await fetchAndStoreStudentDetails(instituteId, userId);
            
            console.log('[ModularDynamicLoginContainer] ✅ Institute and student details fetched successfully');
            
            // Fetch student display settings (for post-login redirect and UI customization)
            try {
              const displaySettings = await getStudentDisplaySettings(true);
              console.log('[ModularDynamicLoginContainer] 🎨 Student display settings loaded:', displaySettings);
            } catch (e) {
              console.warn('[ModularDynamicLoginContainer] ⚠️ Failed to load student display settings:', e);
              // Non-critical, continue with login
            }
          }
        }

        // Determine redirect target from sessionStorage (set when opening OAuth)
        let redirectTo: string | undefined;
        try {
          const stored = sessionStorage.getItem('modal_oauth_data');
          if (stored) {
            const parsed = JSON.parse(stored);
            redirectTo = parsed?.redirectTo;
          }
        } catch (e) { void e; }

        console.log('[ModularDynamicLoginContainer] 🚀 Redirecting to:', redirectTo || '/dashboard');

        // Close modal first
        if (onLoginSuccess) {
          onLoginSuccess();
        }

        // Redirect shortly after closing modal
        setTimeout(() => {
          const target = redirectTo && typeof redirectTo === 'string' ? redirectTo : '/dashboard';
          if (/^https?:\/\//.test(target)) {
            window.location.assign(target);
          } else {
            window.location.href = target;
          }
        }, 100);
      } catch (error) {
        console.error('[ModularDynamicLoginContainer] ❌ Error finalizing login:', error);
        toast.error("Failed to complete login. Please try again.");
      }
    };

    // Ensure we only process once
    let processed = false;

    // Listen for OAuth completion messages from popup
    const messageHandler = async (event: MessageEvent) => {
      const data = event.data;

      // DEBUG: Log all received messages for debugging
      console.log('[OAuth Parent][DEBUG] Received message:', {
        origin: event.origin,
        data: data,
        source: event.source
      });

      // Legacy/custom path: action-based message
      if (data && data.action === 'oauth_complete') {
        if (data.success) {
          const { redirectTo } = data;
          if (!processed) {
            processed = true;
            if (onLoginSuccess) onLoginSuccess();
            setTimeout(() => {
              const target = redirectTo && typeof redirectTo === 'string' ? redirectTo : '/dashboard';
              if (/^https?:\/\//.test(target)) {
                window.location.assign(target);
              } else {
                window.location.href = target;
              }
            }, 100);
          }
        } else if (data.needsSignup && data.signupData) {
          // User doesn't exist but we have OAuth data - switch to signup
          console.log('[OAuth Parent] User needs signup, switching to signup flow with OAuth data');
          if (onSwitchToSignup) {
            // Pass the OAuth data to signup (will be handled by the parent component)
            onSwitchToSignup(data.signupData?.signupData?.email || '', false);
            // Store OAuth data for signup to consume
            try {
              sessionStorage.setItem('oauth_signup_data', JSON.stringify(data.signupData));
            } catch (e) {
              console.error('[OAuth Parent] Failed to store signup data:', e);
            }
          } else {
            toast.info("Please sign up to continue");
          }
        } else if (data.error) {
          toast.error(data.error || "OAuth login failed. Please try again.", {
            duration: 5000,
            description: "Please check your internet connection and try again."
          });
        }
        return;
      }

      // Standard path used by oauth-popup-handler.html
      if (data && data.type === 'oauth_success' && data.data) {
        const payload = data.data;
        if (!processed && payload?.accessToken && payload?.refreshToken) {
          processed = true;
          await finalizeLoginWithTokens(payload.accessToken, payload.refreshToken);
        }
      } else if (data && data.type === 'oauth_signup_needed' && data.data) {
        // User doesn't exist but we have OAuth data - switch to signup
        console.log('[OAuth Parent] User needs signup (standard path), switching to signup flow');
        if (onSwitchToSignup) {
          onSwitchToSignup(data.data?.signupData?.email || '', false);
          try {
            sessionStorage.setItem('oauth_signup_data', JSON.stringify(data.data));
          } catch (e) {
            console.error('[OAuth Parent] Failed to store signup data:', e);
          }
        } else {
          toast.info("Please sign up to continue");
        }
      } else if (data && data.type === 'oauth_error') {
        toast.error(data?.data?.message || "We could not find a user for the credentials used. Please sign up to create a new account or contact the administrator.");
      }
    };

    // Fallback: storage event when COOP blocks postMessage
    const storageHandler = async (e: StorageEvent) => {
      console.log('[OAuth Parent][DEBUG] Storage event received:', {
        key: e.key,
        newValue: e.newValue,
        oldValue: e.oldValue,
        url: e.url
      });

      if (!e) return;
      if (e.key === 'OAUTH_RESULT' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          // Only process if this was a modal login (isModalLogin !== false means it's modal)
          if (parsed?.isModalLogin !== false && parsed?.type === 'oauth_success' && parsed?.data) {
            const { accessToken, refreshToken } = parsed.data || {};
            if (!processed && accessToken && refreshToken) {
              processed = true;
              await finalizeLoginWithTokens(accessToken, refreshToken);
              // Clean up after processing modal login
              localStorage.removeItem('OAUTH_RESULT');
            }
          } else if (parsed?.isModalLogin !== false && parsed?.type === 'oauth_signup_needed' && parsed?.data) {
            console.log('[OAuth Parent] User needs signup (storage), switching to signup flow');
            if (onSwitchToSignup) {
              onSwitchToSignup(parsed.data?.signupData?.email || '', false);
              try {
                sessionStorage.setItem('oauth_signup_data', JSON.stringify(parsed.data));
              } catch (e) {
                console.error('[OAuth Parent] Failed to store signup data:', e);
              }
            } else {
              toast.info("Please sign up to continue");
            }
            localStorage.removeItem('OAUTH_RESULT');
          } else if (parsed?.isModalLogin !== false && parsed?.type === 'oauth_error') {
            toast.error(parsed?.data?.message || 'We could not find a user for the credentials used. Please sign up to create a new account or contact the administrator.');
            localStorage.removeItem('OAUTH_RESULT');
          }
          // Don't remove localStorage if it's a page-level login - let __root.tsx handle it
        } catch (err) { void err; }
      }
    };

    // Fallback: BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('OAUTH_CHANNEL');
        bc.onmessage = async (ev: MessageEvent) => {
          const msg = ev?.data;
          if (!msg || typeof msg !== 'object') return;
          // Only process if this was a modal login
          if (msg.isModalLogin !== false && msg.type === 'oauth_success' && msg.data) {
            const { accessToken, refreshToken } = msg.data || {};
            if (!processed && accessToken && refreshToken) {
              processed = true;
              await finalizeLoginWithTokens(accessToken, refreshToken);
            }
          } else if (msg.isModalLogin !== false && msg.type === 'oauth_signup_needed' && msg.data) {
            console.log('[OAuth Parent] User needs signup (broadcast), switching to signup flow');
            if (onSwitchToSignup) {
              onSwitchToSignup(msg.data?.signupData?.email || '', false);
              try {
                sessionStorage.setItem('oauth_signup_data', JSON.stringify(msg.data));
              } catch (e) {
                console.error('[OAuth Parent] Failed to store signup data:', e);
              }
            } else {
              toast.info("Please sign up to continue");
            }
          } else if (msg.isModalLogin !== false && msg.type === 'oauth_error') {
            toast.error(msg?.data?.message || 'We could not find a user for the credentials used. Please sign up to create a new account or contact the administrator.');
          }
        };
      }
    } catch (err) { void err; }

    // Immediate localStorage check in case write happened before listener attached
    const checkLocalOnce = () => {
      try {
        const existing = localStorage.getItem('OAUTH_RESULT');
        if (existing) {
          const parsed = JSON.parse(existing);
          // Only process if this was a modal login (not a page-level login)
          if (parsed?.isModalLogin !== false && parsed?.type === 'oauth_success' && parsed?.data) {
            const { accessToken, refreshToken } = parsed.data || {};
            if (!processed && accessToken && refreshToken) {
              processed = true;
              finalizeLoginWithTokens(accessToken, refreshToken);
              // Clean up after processing modal login
              localStorage.removeItem('OAUTH_RESULT');
            }
          } else if (parsed?.isModalLogin !== false && parsed?.type === 'oauth_signup_needed' && parsed?.data) {
            console.log('[OAuth Parent] User needs signup (checkLocal), switching to signup flow');
            if (onSwitchToSignup) {
              onSwitchToSignup(parsed.data?.signupData?.email || '', false);
              try {
                sessionStorage.setItem('oauth_signup_data', JSON.stringify(parsed.data));
              } catch (e) {
                console.error('[OAuth Parent] Failed to store signup data:', e);
              }
            } else {
              toast.info("Please sign up to continue");
            }
            localStorage.removeItem('OAUTH_RESULT');
          } else if (parsed?.isModalLogin !== false && parsed?.type === 'oauth_error') {
            toast.error(parsed?.data?.message || 'OAuth authentication failed');
            localStorage.removeItem('OAUTH_RESULT');
          }
          // Don't remove localStorage if it's a page-level login - let __root.tsx handle it
        }
      } catch (err) { void err; }
    };
    checkLocalOnce();

    // Short polling loop as a last resort when storage event is missed
    const pollUntil = Date.now() + 15_000; // 15s
    const pollTimer = window.setInterval(() => {
      if (processed || Date.now() > pollUntil) {
        window.clearInterval(pollTimer);
        return;
      }
      checkLocalOnce();
    }, 400);

    window.addEventListener('message', messageHandler);
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('storage', storageHandler);
      try { window.clearInterval(pollTimer); } catch (err) { void err; }
      try { if (bc) bc.close(); } catch (err) { void err; }
    };
  }, [onLoginSuccess]);

  const handleOAuthLogin = (provider: "google" | "github") => {
    try {
      // Get current page information for redirection after login
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      
      // Clean the current URL to remove sensitive data like instituteId
      const cleanCurrentUrl = cleanUrlOfSensitiveData(`${currentPath}${currentSearch}`);
      
      // Extract instituteId from current URL (but don't expose it in redirect URLs)
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
        currentUrl: cleanCurrentUrl, // Use cleaned URL without sensitive data
        type: type,
        courseId: courseId,
        instituteId: instituteIdFromUrl, // Keep instituteId for backend processing but don't expose in URLs
      };
      
      // Store in sessionStorage
      sessionStorage.setItem('modal_oauth_data', JSON.stringify(modalOAuthData));
      
      // Create minimal state object
      // IMPORTANT: The backend should redirect to /login?accessToken=...&refreshToken=...&popup=1
      // The &popup=1 parameter is critical for popup detection
      const stateObj: Record<string, unknown> = {
        from: `${window.location.origin}/login?popup=1`,
        account_type: "login",
        user_type: "learner",
      };

      // Include institute_id if available (from URL or props)
      if (instituteIdFromUrl) {
        stateObj.institute_id = instituteIdFromUrl;
      }

      const stateJson = JSON.stringify(stateObj);
      const base64State = btoa(stateJson);
      const encodedState = encodeURIComponent(base64State);
      const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodedState}`;
      
      // Open OAuth in popup window
      const popup = window.open(
        loginUrl,
        'oauth_popup',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        console.error('[OAuth] Popup blocked');
        toast.error("Popup blocked! Please allow popups for this site.");
        return;
      }

      // Focus the popup
      popup.focus();
    } catch {
      toast.error("Failed to initiate login. Please try again.");
    }
  };

  // Helper function to clean URLs of sensitive data
  const cleanUrlOfSensitiveData = (url: string): string => {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Remove sensitive parameters
      urlObj.searchParams.delete("instituteId");
      urlObj.searchParams.delete("accessToken");
      urlObj.searchParams.delete("refreshToken");
      urlObj.searchParams.delete("state");
      
      // Keep only safe parameters
      const safeParams = new URLSearchParams();
      for (const [key, value] of urlObj.searchParams.entries()) {
        if (key === "type" || key === "courseId" || key === "fromOAuth") {
          safeParams.set(key, value);
        }
      }
      
      // Reconstruct URL with only safe parameters
      const cleanUrl = `${urlObj.pathname}${safeParams.toString() ? '?' + safeParams.toString() : ''}`;
      return cleanUrl;
    } catch (error) {
      console.error("Error cleaning URL:", error);
      // Return original URL if cleaning fails
      return url;
    }
  };

  // Apply institute theme and font (pre-login) from Preferences
  useEffect(() => {
    (async () => {
      try {
        const storedInstitute = instituteId || (await Preferences.get({ key: "InstituteId" })).value || "";
        if (!storedInstitute) return;
        const stored = await Preferences.get({ key: `LEARNER_${storedInstitute}` });
        if (!stored?.value) return;
        const parsed = JSON.parse(stored.value);
        if (parsed?.theme) {
          setPrimaryColor(parsed.theme);
        }
        if (parsed?.fontFamily) {
          const mapFamily = (f: string) => {
            const key = String(f).toUpperCase();
            if (key === "INTER") return 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "CAIRO") return 'Cairo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "PLAYPEN SANS") return 'Playpen Sans, cursive, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "WORK SANS") return 'Work Sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "LEXEND") return 'Lexend, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            return f;
          };
          const family = mapFamily(parsed.fontFamily);
          document.documentElement.style.setProperty("--app-font-family", family);
          document.body.style.fontFamily = family;
        }
      } catch {
        // Ignore
      }
    })();
  }, [instituteId, setPrimaryColor]);

  // Open Terms/Privacy using institute-specific URLs if available, else fallback
  const openTerms = async () => {
    try {
      const storedInstitute = instituteId || (await Preferences.get({ key: "InstituteId" })).value || "";
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
    } catch (err) { void err; }
    navigate({ to: "/terms-and-conditions" });
  };

  const openPrivacy = async () => {
    try {
      const storedInstitute = instituteId || (await Preferences.get({ key: "InstituteId" })).value || "";
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
    } catch (err) { void err; }
    navigate({ to: "/privacy-policy" });
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
            Sign in to continue your journey
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
                  signupAvailable={isSignupAvailable}
                  instituteId={instituteId}
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
                  signupAvailable={isSignupAvailable}
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

      {/* Signup Link - Only show if signup is available */}
      {isSignupAvailable && onSwitchToSignup && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-6"
        >
          <p className="text-lg text-gray-600">
            Don't have an account?{" "}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => onSwitchToSignup && onSwitchToSignup()}
              className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
            >
              Sign up here
            </motion.button>
          </p>
        </motion.div>
      )}

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
            onClick={openTerms}
            className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
          >
            terms and conditions
          </motion.button>{" "}
          and{" "}
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={openPrivacy}
            className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
          >
            Privacy Policy
          </motion.button>
        </p>
      </motion.div>
    </div>
  );
}