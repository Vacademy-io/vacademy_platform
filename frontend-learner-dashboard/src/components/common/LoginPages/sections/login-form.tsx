"use client";
import { useEffect, useState } from "react";
// import { SplashScreen } from "@/components/common/LoginPages/layout/splash-container";
// import { useAnimationStore } from "@/stores/login/animationStore";
import { Heading } from "@/components/common/LoginPages/ui/heading";
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
    <div className="w-screen bg-white gap-4 md:gap-8 lg:gap-10 pt-14 lg:pt-20">
      {/* Logo Section */}
      {/* <HeaderLogo /> */}

      {/* Login Form Section */}
      <div className="flex w-full flex-col items-center justify-center gap-4 md:gap-8 lg:gap-12 px-4 md:px-8 lg:px-12">
        <Heading
          heading="Hello, Student!"
          subHeading="Ready to learn something new? Log in and continue your academic adventure!"
        />
        {/* Toggle Content */}
        <div className="w-full max-w-md">
          {isEmailLogin ? (
            <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
          ) : (
            <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} />
          )}
        </div>

          
        {/* <div className="flex font-regular pb-5 items-center">
          <div className="text-neutral-500 text-sm md:text-base lg:text-base">
            Don’t have an account?
          </div>
          <MyButton
            type="button"
            scale="medium"
            buttonType="text"
            layoutVariant="default"
            className="text-primary-500"
            onClick={() => navigate({ to: "/login" })}
          >
            Create Account
          </MyButton>
        </div> */}
      </div>
    </div>
  );
}
