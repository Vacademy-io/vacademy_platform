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
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { toast } from "sonner";
import { useTheme } from "@/providers/theme/theme-provider";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import ClipLoader from "react-spinners/ClipLoader";
import { Shield, BookOpen, Users, Award, ArrowRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

export const setToStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

export function LoginForm() {
  const navigate = useNavigate();
  const { setPrimaryColor, getPrimaryColorCode } = useTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const [isSSOLoading, setIsSSOLoading] = useState(false);
  const isPublic = urlParams.get("isPublicAssessment");
  const redirect = urlParams.get("redirect");
  const [isEmailLogin, setIsEmailLogin] = useState(isPublic === "true");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      console.log("called ...................");
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get("accessToken");
      const refreshToken = urlParams.get("refreshToken");
      const error = urlParams.get("error");
      const message = urlParams.get("message");

      if (error) {
        console.error("OAuth error:", error);
        toast.error(decodeURIComponent(message || "Authentication failed."));
        return;
      }

      if (accessToken && refreshToken) {
        try {
          await setToStorage("accessToken", accessToken);
          await setToStorage("refreshToken", refreshToken);
          await setTokenInStorage(TokenKey.accessToken, accessToken);
          await setTokenInStorage(TokenKey.refreshToken, refreshToken);

          await handleSuccessfulLogin(accessToken, redirect);
        } catch (error) {
          console.error("Error storing tokens:", error);
          toast.error("Failed to store authentication tokens");
        }
      }
    };

    handleOAuthCallback();
  }, []);

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
      console.log("accessToken", accessToken);
      setTokenInStorage(TokenKey.accessToken, accessToken);
      setTokenInStorage(TokenKey.refreshToken, refreshToken);
      handleSuccessfulLogin(accessToken, redirect);
    }
  }, [navigate]);

  const handleSuccessfulLogin = async (
    accessToken: string,
    redirect?: string | null
  ) => {
    try {
      const decodedData = await getTokenDecodedData(accessToken);
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];

      if (authorityKeys.length > 1) {
        navigate({
          to: "/institute-selection",
          search: { redirect: redirect || "/dashboard/" },
        });
        setIsSSOLoading(false);
      } else {
        const instituteId = authorities ? Object.keys(authorities)[0] : undefined;

        if (instituteId && userId) {
          try {

            // Fetch and store institute details
            const details = await fetchAndStoreInstituteDetails(
              instituteId,
              userId
            );
           

            setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
          } catch (error) {
            console.error("Error fetching institute details:", error);
            toast.error("Failed to fetch institute details");
          }

          try {
            await fetchAndStoreStudentDetails(instituteId, userId);
          } catch (error) {
            console.error("Error fetching student details:", error);
            toast.error("Failed to fetch student details");
          }
        } else {
          console.error("Institute ID or User ID is undefined");
          toast.error("Invalid user data received");
        }

        navigate({
          to: "/SessionSelectionPage",
          search: { redirect: redirect || "/dashboard" },
        });
      }
    } catch (error) {
      console.error("Error processing decoded data:", error);
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
      console.log("handleOAuthLogin called");

      const stateObj = {
        from: `${window.location.origin}/login/oauth/redirect`,
        account_type: "",
      };

      const base64State = btoa(JSON.stringify(stateObj));
      const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(base64State)}`;
      window.location.href = loginUrl;
    } catch (error) {
      console.error("Error initiating OAuth login:", error);
      toast.error("Failed to initiate login. Please try again.");
    }
  };

  if (isSSOLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 bg-grid-gray-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        <motion.div 
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, 2, -2, 0] 
          }}
          transition={{ 
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="absolute top-20 left-20 w-24 h-24 bg-gray-200/20 rounded-full blur-xl"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, -2, 2, 0] 
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1 
          }}
          className="absolute bottom-20 right-20 w-32 h-32 bg-gray-300/20 rounded-full blur-xl"
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
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
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
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-grid-gray-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      {/* Subtle Floating Background Elements */}
      <motion.div 
        animate={{ 
          x: [0, 20, 0],
          y: [0, -10, 0],
          rotate: [0, 2, 0] 
        }}
        transition={{ 
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-20 left-20 w-48 h-48 bg-gradient-to-br from-gray-200/10 to-gray-300/10 rounded-full blur-3xl"
      />
      <motion.div 
        animate={{ 
          x: [0, -20, 0],
          y: [0, 10, 0],
          rotate: [0, -2, 0] 
        }}
        transition={{ 
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3 
        }}
        className="absolute bottom-20 right-20 w-64 h-64 bg-gradient-to-br from-gray-300/10 to-gray-400/10 rounded-full blur-3xl"
      />

      <div className="flex min-h-screen">
        {/* Left Side - Compact Branding & Features */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex lg:w-1/2 xl:w-1/2 flex-col justify-center px-8 xl:px-16"
        >
          {/* Compact Main Heading */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Transform Your 
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent"> Learning</span>
              <br />Journey
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
              Access personalized learning experiences, track your progress, and achieve your educational goals.
            </p>
          </motion.div>

          {/* Compact Features Grid */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            {[
              { icon: BookOpen, title: "Interactive Learning", desc: "Engaging content & assessments" },
              { icon: Users, title: "Collaborative Environment", desc: "Connect with peers & instructors" },
              { icon: Award, title: "Track Progress", desc: "Monitor your achievements" },
              { icon: Shield, title: "Secure Platform", desc: "Enterprise-grade security" }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                className="group p-3 rounded-lg bg-white/60 backdrop-blur-sm border border-gray-200/50 hover:bg-white/80 transition-all duration-200"
              >
                <feature.icon className="w-6 h-6 text-gray-700 mb-2 group-hover:scale-105 transition-transform duration-200" />
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">{feature.title}</h3>
                <p className="text-xs text-gray-600">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Compact Trust Indicators */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center space-x-6 text-sm text-gray-500"
          >
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>ISO 27001 Certified</span>
            </div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span>99.9% Uptime</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Side - Compact Login Form */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="w-full lg:w-1/2 xl:w-1/2 flex items-center justify-center p-4 lg:p-8 xl:p-12"
        >
          <div className="w-full max-w-lg xl:max-w-xl">
            {/* Compact Login Card */}
            <motion.div 
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8 xl:p-10"
            >
              {/* Compact Header */}
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center mb-6"
              >
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600 text-sm">
                  Sign in to continue your learning journey
                </p>
              </motion.div>

              {/* Compact OAuth Buttons */}
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-2 mb-6"
              >
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 font-medium hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                  onClick={() => handleOAuthLogin("google")}
                  type="button"
                >
                  <FcGoogle className="w-4 h-4" />
                  <span className="text-sm">Continue with Google</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 font-medium hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                  onClick={() => handleOAuthLogin("github")}
                  type="button"
                >
                  <GitHubLogoIcon className="w-4 h-4" />
                  <span className="text-sm">Continue with GitHub</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </motion.button>
              </motion.div>

              {/* Compact Divider */}
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.3 }}
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

              {/* Form Content */}
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                <AnimatePresence mode="wait">
                  {isEmailLogin ? (
                    <motion.div
                      key="email"
                      initial={{ x: 200, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -200, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="username"
                      initial={{ x: 200, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -200, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Compact Security Notice */}
              <motion.div 
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
              </motion.div>
            </motion.div>

            {/* Compact Footer Links */}
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-6 text-center text-xs text-gray-600"
            >
              <p>
                By signing in, you agree to our{" "}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate({ to: "/terms-and-conditions" })}
                  className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
                >
                  Terms of Service
                </motion.button>{" "}
                and{" "}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate({ to: "/privacy-policy" })}
                  className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"
                >
                  Privacy Policy
                </motion.button>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
