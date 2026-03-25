import { useEffect, useState } from "react";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate } from "@tanstack/react-router";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import {
  getTokenDecodedData,
  getTokenFromStorage,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { EmailLogin } from "./EmailOtpForm";
import { UsernameLogin } from "./UsernamePasswordForm";
import { PhoneLoginForm } from "./PhoneLoginForm";
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
import { motion, AnimatePresence } from "framer-motion";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { AuthPageBranding } from "@/components/common/institute-branding";
import { identifyUser } from "@/lib/analytics";
import { useEffect as useEffectTheme } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getOAuthRedirectOrigin,
  isNativeOAuthRequired,
  openOAuthInSystemBrowser,
} from "@/lib/auth/nativeOAuth";

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
  const fromPaymentSuccess = urlParams.get("fromPaymentSuccess") === "1";
  const [postPaymentCreds, setPostPaymentCreds] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [authMethod, setAuthMethod] = useState<"EMAIL" | "USERNAME" | "PHONE">(() => {
    if (isPublic === "true" && !fromPaymentSuccess) return "EMAIL";
    return "USERNAME";
  });
  const [providerFlags, setProviderFlags] = useState<{
    allowGoogleAuth: boolean;
    allowGithubAuth: boolean;
    allowEmailOtpAuth: boolean;
    allowUsernamePasswordAuth: boolean;
    allowPhoneAuth: boolean;
  }>({
    allowGoogleAuth: true,
    allowGithubAuth: true,
    allowEmailOtpAuth: true,
    allowUsernamePasswordAuth: true,
    allowPhoneAuth: true,
  });
  const { setInstituteId } = useInstituteFeatureStore();
  const domainRouting = useDomainRouting();

  // Pre-login theme and font from Preferences if present (external-first branding)
  useEffectTheme(() => {
    (async () => {
      try {
        const instituteId =
          (await Preferences.get({ key: "InstituteId" })).value || "";
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
          allowUsernamePasswordAuth:
            parsed?.allowUsernamePasswordAuth !== false,
          allowPhoneAuth: parsed?.allowPhoneAuth !== false,
        });
        if (
          parsed?.allowUsernamePasswordAuth === false &&
          parsed?.allowEmailOtpAuth !== false
        ) {
          setAuthMethod("EMAIL");
        } else if (
          parsed?.allowUsernamePasswordAuth === false &&
          parsed?.allowEmailOtpAuth === false &&
          parsed?.allowPhoneAuth !== false
        ) {
          setAuthMethod("PHONE");
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
            if (key === "WORK SANS")
              return 'Work Sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            if (key === "LEXEND")
              return 'Lexend, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            return f;
          };
          const family = mapFamily(parsed.fontFamily);
          document.documentElement.style.setProperty(
            "--app-font-family",
            family,
          );
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
    if (!fromPaymentSuccess) return;
    try {
      const raw = sessionStorage.getItem("post_payment_login_creds");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        username?: string;
        password?: string;
        instituteId?: string;
      };
      sessionStorage.removeItem("post_payment_login_creds");
      if (parsed?.username && parsed?.password) {
        setPostPaymentCreds({
          username: parsed.username,
          password: parsed.password,
        });
        setAuthMethod("USERNAME");
        if (parsed.instituteId) {
          Preferences.set({
            key: "InstituteId",
            value: parsed.instituteId,
          }).catch(() => { });
        }
      }
    } catch {
      /* ignore */
    }
  }, [fromPaymentSuccess]);

  useEffect(() => {
    // CRITICAL: Check for popup FIRST, before anything else
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("accessToken");
    const refreshToken = urlParams.get("refreshToken");

    // If this page is loaded inside an OAuth popup, do NOT complete login here.
    // Instead, broadcast tokens to the opener and close the popup to avoid duplicate app instances.
    const isPopupWindow = (() => {
      // Check if we have an opener (most reliable way to detect popup)
      try {
        if (window.opener && !window.opener.closed) {
          console.log("[LoginForm] ✅ Detected popup via window.opener");
          return true;
        }
      } catch (e) {
        console.log("[LoginForm] ❌ window.opener check failed:", e);
      }

      // Check window name
      try {
        if (window.name && window.name.toLowerCase() === "oauth_popup") {
          console.log("[LoginForm] ✅ Detected popup via window.name");
          return true;
        }
      } catch { }

      // Check for popup parameter in URL
      try {
        const q = new URLSearchParams(window.location.search);
        if (q.get("popup") === "1") {
          console.log("[LoginForm] ✅ Detected popup via ?popup=1");
          return true;
        }
      } catch { }

      console.log("[LoginForm] ❌ Not detected as popup window");
      console.log("[LoginForm] Debug:", {
        hasOpener: !!window.opener,
        windowName: window.name,
        searchParams: window.location.search,
      });
      return false;
    })();

    console.log("[LoginForm] 🔍 POPUP DETECTION:", {
      isPopupWindow,
      hasTokens: !!(accessToken && refreshToken),
      accessToken: accessToken?.substring(0, 50) + "...",
    });

    if (isPopupWindow && accessToken && refreshToken) {
      console.log("[LoginForm] 🚀 POPUP DETECTED WITH TOKENS - CLOSING POPUP");
      try {
        // postMessage (may be blocked by COOP)
        try {
          if (window.opener && !window.opener.closed) {
            console.log("[LoginForm] 📨 Sending postMessage to opener");
            window.opener.postMessage(
              {
                type: "oauth_success",
                data: { accessToken, refreshToken },
                isModalLogin: true,
              },
              "*",
            );
          }
        } catch (e) {
          console.log("[LoginForm] ❌ postMessage failed:", e);
        }

        // localStorage event for parent listeners
        try {
          console.log("[LoginForm] 💾 Writing to localStorage");
          localStorage.setItem(
            "OAUTH_RESULT",
            JSON.stringify({
              type: "oauth_success",
              data: { accessToken, refreshToken },
              ts: Date.now(),
              isModalLogin: true, // Mark as modal login so __root.tsx ignores it
            }),
          );
        } catch (e) {
          console.log("[LoginForm] ❌ localStorage failed:", e);
        }

        // BroadcastChannel fallback
        try {
          if (typeof BroadcastChannel !== "undefined") {
            console.log("[LoginForm] 📡 Broadcasting via BroadcastChannel");
            const bc = new BroadcastChannel("OAUTH_CHANNEL");
            bc.postMessage({
              type: "oauth_success",
              data: { accessToken, refreshToken },
              isModalLogin: true,
            });
            try {
              bc.close();
            } catch {
              /* ignore */
            }
          }
        } catch (e) {
          console.log("[LoginForm] ❌ BroadcastChannel failed:", e);
        }
      } finally {
        // Close popup quickly
        console.log("[LoginForm] 🔒 Closing popup in 300ms");
        setTimeout(() => {
          try {
            console.log("[LoginForm] 👋 Closing now");
            window.close();
          } catch (e) {
            console.log("[LoginForm] ❌ window.close() failed:", e);
          }
        }, 300);
      }
      return; // Don't proceed with in-popup login
    }

    // Handle OAuth error case in popup mode (when user doesn't exist)
    if (isPopupWindow) {
      const error = urlParams.get("error");
      const signupData = urlParams.get("signupData");
      const emailVerified = urlParams.get("emailVerified");
      const state = urlParams.get("state");

      if (error === "true") {
        console.log(
          "[LoginForm] 🚫 POPUP DETECTED WITH ERROR - OAuth login failed",
        );

        // Check if this is a signup scenario (user doesn't exist but we have OAuth data)
        if (signupData) {
          console.log(
            "[LoginForm] 📝 SignupData present - switching to signup flow",
          );

          // Decode signupData
          let decodedSignupData = null;
          try {
            decodedSignupData = JSON.parse(atob(signupData));
          } catch (e) {
            console.log("[LoginForm] ❌ Failed to decode signupData:", e);
          }

          // Send signup_needed message to parent
          const signupPayload = {
            signupData: decodedSignupData,
            state: state,
            emailVerified: emailVerified === "true",
          };

          try {
            if (window.opener && !window.opener.closed) {
              console.log(
                "[LoginForm] 📨 Sending signup_needed postMessage to opener",
              );
              window.opener.postMessage(
                {
                  action: "oauth_complete",
                  success: false,
                  needsSignup: true,
                  signupData: signupPayload,
                },
                "*",
              );
            }
          } catch (e) {
            console.log("[LoginForm] ❌ Signup postMessage failed:", e);
          }

          // localStorage for storage event listeners
          try {
            console.log("[LoginForm] 💾 Writing signup_needed to localStorage");
            localStorage.setItem(
              "OAUTH_RESULT",
              JSON.stringify({
                type: "oauth_signup_needed",
                data: signupPayload,
                ts: Date.now(),
                isModalLogin: true,
              }),
            );
          } catch (e) {
            console.log("[LoginForm] ❌ localStorage signup write failed:", e);
          }

          // BroadcastChannel fallback
          try {
            if (typeof BroadcastChannel !== "undefined") {
              console.log(
                "[LoginForm] 📡 Broadcasting signup_needed via BroadcastChannel",
              );
              const bc = new BroadcastChannel("OAUTH_CHANNEL");
              bc.postMessage({
                type: "oauth_signup_needed",
                data: signupPayload,
                isModalLogin: true,
              });
              try {
                bc.close();
              } catch {
                /* ignore */
              }
            }
          } catch (e) {
            console.log("[LoginForm] ❌ BroadcastChannel signup failed:", e);
          }
        } else {
          // No signupData - genuine error
          const errorMessage =
            "We could not find a user for the credentials used. Please sign up to create a new account or contact the administrator.";

          // Send error via multiple channels (same as modal-learner.tsx)
          try {
            if (window.opener && !window.opener.closed) {
              console.log("[LoginForm] 📨 Sending error postMessage to opener");
              window.opener.postMessage(
                {
                  action: "oauth_complete",
                  success: false,
                  error: errorMessage,
                },
                "*",
              );
            }
          } catch (e) {
            console.log("[LoginForm] ❌ Error postMessage failed:", e);
          }

          // localStorage for storage event listeners
          try {
            console.log("[LoginForm] 💾 Writing error to localStorage");
            localStorage.setItem(
              "OAUTH_RESULT",
              JSON.stringify({
                type: "oauth_error",
                data: { message: errorMessage },
                ts: Date.now(),
                isModalLogin: true,
              }),
            );
          } catch (e) {
            console.log("[LoginForm] ❌ localStorage error write failed:", e);
          }

          // BroadcastChannel fallback
          try {
            if (typeof BroadcastChannel !== "undefined") {
              console.log(
                "[LoginForm] 📡 Broadcasting error via BroadcastChannel",
              );
              const bc = new BroadcastChannel("OAUTH_CHANNEL");
              bc.postMessage({
                type: "oauth_error",
                data: { message: errorMessage },
                isModalLogin: true,
              });
              try {
                bc.close();
              } catch {
                /* ignore */
              }
            }
          } catch (e) {
            console.log("[LoginForm] ❌ BroadcastChannel error failed:", e);
          }
        }

        // Close popup after short delay
        console.log("[LoginForm] 🔒 Closing popup in 800ms");
        setTimeout(() => {
          try {
            console.log("[LoginForm] 👋 Closing popup now");
            window.close();
          } catch (e) {
            console.log("[LoginForm] ❌ window.close() failed:", e);
          }
        }, 800);

        return; // Don't proceed with rendering login form
      }
    }

    if (
      isNullOrEmptyOrUndefined(accessToken) ||
      isNullOrEmptyOrUndefined(refreshToken)
    ) {
      return;
    }

    if (accessToken && refreshToken) {
      // Failsafe: Double-check if this is a popup that somehow got past the first check
      const hasOpener = (() => {
        try {
          return window.opener && !window.opener.closed;
        } catch {
          return false;
        }
      })();

      if (hasOpener) {
        console.log(
          "[LoginForm] FAILSAFE: Detected opener after initial check - closing popup",
        );
        // Send tokens and close
        try {
          window.opener.postMessage(
            {
              type: "oauth_success",
              data: { accessToken, refreshToken },
              isModalLogin: true,
            },
            "*",
          );
        } catch {
          /* ignore */
        }
        try {
          localStorage.setItem(
            "OAUTH_RESULT",
            JSON.stringify({
              type: "oauth_success",
              data: { accessToken, refreshToken },
              ts: Date.now(),
              isModalLogin: true,
            }),
          );
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }, 300);
        return;
      }

      // Show loading screen immediately when processing OAuth tokens
      setIsSSOLoading(true);
      setTokenInStorage(TokenKey.accessToken, accessToken);
      setTokenInStorage(TokenKey.refreshToken, refreshToken);
      // Call async function without awaiting (it will navigate when complete)
      handleSuccessfulLogin(accessToken, redirect).catch((e) => {
        console.error("Login failed:", e);
        setIsSSOLoading(false);
      });
    }
  }, [navigate]);

  // Listen for OAuth completion from popup via localStorage/BroadcastChannel
  useEffect(() => {
    let processed = false;

    const finalizeLoginWithTokens = async (
      accessToken: string,
      refreshToken: string,
    ) => {
      try {
        // Show loading screen immediately when processing OAuth tokens from popup
        setIsSSOLoading(true);
        await setTokenInStorage(TokenKey.accessToken, accessToken);
        await setTokenInStorage(TokenKey.refreshToken, refreshToken);
        await handleSuccessfulLogin(accessToken, redirect);
      } catch {
        toast.error("Failed to complete login. Please try again.");
        setIsSSOLoading(false);
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
    redirect?: string | null,
  ) => {
    try {
      const decodedData = getTokenDecodedData(accessToken);
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];
      console.log("abc", userId);
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

      // Check if user has PARENT role by examining authorities
      let isParent = false;
      const allRoles: string[] = [];

      if (authorities && typeof authorities === "object") {
        for (const [, instAuthority] of Object.entries(authorities)) {
          if (instAuthority && typeof instAuthority === "object") {
            const instRoles = (instAuthority as { roles?: string[] }).roles;
            if (Array.isArray(instRoles)) {
              allRoles.push(...instRoles);
            }
          }
        }
      }

      const upperRoles = allRoles.map((r) => r.toUpperCase());
      isParent = upperRoles.includes("PARENT");

      if (isParent) {
        setIsSSOLoading(false);
        navigate({ to: "/parent" });
        return;
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
              userId,
            );
            setInstituteId(instituteId);
            if (instituteId === HOLISTIC_INSTITUTE_ID) {
              setPrimaryColor("holistic");
            } else {
              setPrimaryColor(
                details?.institute_theme_code ??
                  import.meta.env.VITE_DEFAULT_THEME_COLOR ??
                  "#E67E22",
              );
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

          if (/^https?:\/\//.test(redirectRoute)) {
            window.location.assign(redirectRoute);
          } else {
            navigate({ to: redirectRoute as never });
          }
        } catch (e) {
          console.error(
            "[Post-Login Redirect] Falling back to /dashboard due to error:",
            e,
          );
          navigate({ to: "/dashboard" });
        }
      }
    } catch {
      toast.error("Failed to process user data");
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    try {
      // Resolve the public-facing origin for OAuth redirect
      const redirectOrigin = await getOAuthRedirectOrigin();

      const stateObj: Record<string, unknown> = {
        from: `${redirectOrigin}/login/oauth/learner`,
        account_type: "login",
        user_type: "learner",
        isModalLogin: false, // Flag to indicate this is a page login
      };

      // Include institute_id if resolved from domain routing
      if (domainRouting?.instituteId) {
        stateObj.institute_id = domainRouting.instituteId;
      }

      const base64State = btoa(JSON.stringify(stateObj));
      const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(
        base64State,
      )}`;

      if (isNativeOAuthRequired()) {
        // Native: open in system browser via Capacitor Browser plugin
        await openOAuthInSystemBrowser(loginUrl);
      } else {
        window.location.href = loginUrl;
      }
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
      } bg-background relative mt-10`}
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
            className="w-full"
          >
            <Card
              className={
                type
                  ? "border-0 shadow-none p-0"
                  : "w-full shadow-lg border-gray-100"
              }
            >
              <CardHeader className="space-y-1 pb-6 text-center">
                <CardTitle className="text-2xl font-bold tracking-tight text-primary-700">
                  Welcome Back
                </CardTitle>
                <CardDescription>
                  Sign in to continue your journey
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                {/* OAuth Buttons */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="grid grid-cols-1 gap-3"
                >
                  {authProviders?.google && (
                    <Button
                      variant="outline"
                      className="w-full relative h-11"
                      onClick={() => handleOAuthLogin("google")}
                      type="button"
                    >
                      <FcGoogle className="mr-2 h-4 w-4" />
                      Continue with Google
                    </Button>
                  )}
                  {authProviders?.github && (
                    <Button
                      variant="outline"
                      className="w-full relative h-11"
                      onClick={() => handleOAuthLogin("github")}
                      type="button"
                    >
                      <GitHubLogoIcon className="mr-2 h-4 w-4" />
                      Continue with GitHub
                    </Button>
                  )}
                </motion.div>

                {/* Divider */}
                {(authProviders?.google || authProviders?.github) && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>
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
                      const allowPhone = providerFlags.allowPhoneAuth;

                      // Determine active method (fallback strategy)
                      let activeMethod = authMethod;
                      if (activeMethod === "EMAIL" && !allowEmail) {
                        activeMethod = allowUserPass ? "USERNAME" : (allowPhone ? "PHONE" : "USERNAME");
                      } else if (activeMethod === "USERNAME" && !allowUserPass) {
                        activeMethod = allowEmail ? "EMAIL" : (allowPhone ? "PHONE" : "EMAIL");
                      } else if (activeMethod === "PHONE" && !allowPhone) {
                        activeMethod = allowEmail ? "EMAIL" : (allowUserPass ? "USERNAME" : "EMAIL");
                      }

                      if (activeMethod === "PHONE" && allowPhone) {
                        return (
                          <motion.div
                            key="phone"
                            initial={{ x: 200, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -200, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <PhoneLoginForm
                              onSwitchToUsername={() => setAuthMethod("USERNAME")}
                              onSwitchToEmail={() => setAuthMethod("EMAIL")}
                              allowUsernamePasswordAuth={allowUserPass}
                              allowEmailOtpAuth={allowEmail}
                              type={type}
                              courseId={courseId}
                              onSwitchToSignup={onSwitchToSignup}
                            />
                          </motion.div>
                        );
                      }

                      if (activeMethod === "EMAIL" && allowEmail) {
                        return (
                          <motion.div
                            key="email"
                            initial={{ x: 200, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -200, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <EmailLogin
                              onSwitchToUsername={() => setAuthMethod("USERNAME")}
                              onSwitchToPhone={() => setAuthMethod("PHONE")}
                              type={type}
                              courseId={courseId}
                              onSwitchToSignup={onSwitchToSignup}
                              allowUsernamePasswordAuth={allowUserPass}
                              allowPhoneAuth={allowPhone}
                            />
                          </motion.div>
                        );
                      }

                      if (activeMethod === "USERNAME" && allowUserPass) {
                        return (
                          <motion.div
                            key="username"
                            initial={{ x: 200, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -200, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <UsernameLogin
                              onSwitchToEmail={() => setAuthMethod("EMAIL")}
                              onSwitchToPhone={() => setAuthMethod("PHONE")}
                              allowEmailOtpAuth={allowEmail}
                              allowPhoneAuth={allowPhone}
                              type={type}
                              courseId={courseId}
                              onSwitchToSignup={onSwitchToSignup}
                              initialUsername={postPaymentCreds?.username}
                              initialPassword={postPaymentCreds?.password}
                            />
                          </motion.div>
                        );
                      }

                      return null;
                    })()}
                  </AnimatePresence>
                </motion.div>

                {/* Explore Courses (for institutes with public catalog) */}
                {domainRouting?.redirectPath &&
                domainRouting.redirectPath !== "/login" ? (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.2 }}
                  >
                    <Button
                      variant="default"
                      className="w-full h-11 text-base font-medium shadow-sm hover:shadow-md transition-all duration-200"
                      onClick={() =>
                        navigate({ to: domainRouting.redirectPath as never })
                      }
                    >
                      Explore Courses
                    </Button>
                  </motion.div>
                ) : null}
              </CardContent>
            </Card>
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
                    const storedInstitute =
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
                    const storedInstitute =
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
