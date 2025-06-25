"use client";
import { useEffect, useState } from "react";
// import { SplashScreen } from "@/components/common/LoginPages/layout/splash-container";
// import { useAnimationStore } from "@/stores/login/animationStore";

// import { MyButton } from "@/components/design-system/button";
// import { loginSchema } from "@/schemas/login/login";
// import { z } from "zod";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate } from "@tanstack/react-router";
// import HeaderLogo from "../ui/header_logo";

import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { EmailLogin } from "./EmailOtpForm";
import { UsernameLogin } from "./UsernamePasswordForm";
import { Preferences } from "@capacitor/preferences";
// type FormValues = z.infer<typeof loginSchema>;

export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

export function LoginForm() {
  // const { hasSeenAnimation, setHasSeenAnimation } = useAnimationStore();
  // const [showSplash, setShowSplash] = useState(!hasSeenAnimation);
  const navigate = useNavigate();
  const [isEmailLogin, setIsEmailLogin] = useState(false);

  // Handle splash screen timing
  // useEffect(() => {
  //   if (!hasSeenAnimation) {
  //     const timer = setTimeout(() => {
  //       setHasSeenAnimation();
  //       setShowSplash(false);
  //     }, 2000); // Splash screen duration
  //     return () => clearTimeout(timer); // Cleanup on unmount
  //   }
  // }, [hasSeenAnimation, setHasSeenAnimation]);

  // useEffect(() => {
  //   const redirect = async () => {
  //     const token = await getTokenFromStorage(TokenKey.accessToken);
  //       if (!isNullOrEmptyOrUndefined(token)) {
  //         navigate({ to: "/dashboard" });
  //       }
  //     };
  //     redirect();
  //   }, []);

  useEffect(() => {
    const redirect = async () => {
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

    redirect();
  }, []);

  // Conditionally render the splash screen
  // if (showSplash) {
  //   return <SplashScreen isAnimationEnabled />;
  // }
  // Login form content
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/30 w-full">
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        {/* Centered Login Form Container */}
        <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl space-y-8">
        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-10 animate-slide-in-right">
          {/* Header */}
          <div className="text-center space-y-3 mb-10">
            <h1 className="text-4xl font-light text-gray-900 tracking-tight">Welcome</h1>
            <p className="text-gray-500 font-light">Sign in to your account</p>
          </div>

          {/* Login Method Tabs */}
          <div className="relative bg-gray-50/50 rounded-2xl p-1.5 mb-10">
            <div 
              className={`absolute top-1.5 bottom-1.5 w-1/2 bg-white rounded-xl shadow-lg transition-transform duration-500 ease-out ${
                isEmailLogin ? 'translate-x-full' : 'translate-x-0'
              }`}
            ></div>
            <div className="relative grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setIsEmailLogin(false)}
                className={`relative py-4 px-6 text-sm font-light rounded-xl transition-all duration-300 ${
                  !isEmailLogin
                    ? 'text-orange-600 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Username
              </button>
              <button
                onClick={() => setIsEmailLogin(true)}
                className={`relative py-4 px-6 text-sm font-light rounded-xl transition-all duration-300 ${
                  isEmailLogin
                    ? 'text-orange-600 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Email & OTP
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="relative overflow-hidden">
            <div 
              className={`transition-all duration-500 ease-in-out ${
                isEmailLogin 
                  ? 'transform translate-x-0 opacity-100' 
                  : 'transform -translate-x-full opacity-0 absolute inset-0'
              }`}
            >
              {isEmailLogin && <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />}
            </div>
            <div 
              className={`transition-all duration-500 ease-in-out ${
                !isEmailLogin 
                  ? 'transform translate-x-0 opacity-100' 
                  : 'transform translate-x-full opacity-0 absolute inset-0'
              }`}
            >
              {!isEmailLogin && <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} />}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-8 border-t border-gray-100/50 text-center">
            <p className="text-xs text-gray-400 font-light flex items-center justify-center space-x-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secured with enterprise-grade encryption</span>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center text-sm text-gray-400 animate-fade-in-up font-light">
          <p>Need assistance? <a href="#" className="text-orange-500 hover:text-orange-600 font-normal transition-colors duration-200">Contact Support</a></p>
        </div>
        </div>
      </div>
    </div>
  );
}
