import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shield, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

import {
  LOGIN_USING_USERNAME,
  LOGIN_USING_OTP,
  REQUEST_OTP,
} from "@/constants/urls";
import {
  setTokenInStorage,
  getTokenDecodedData,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { identifyUser } from "@/lib/analytics";

// Schemas for form validation
const usernameSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

type UsernameFormValues = z.infer<typeof usernameSchema>;

interface UserDetails {
  id: string;
  username: string;
  email: string;
  full_name: string;
  password: string;
}

interface SessionLoginFormProps {
  username: string;
  instituteId: string;
  onLoginSuccess: () => void;
}

export const SessionLoginForm: React.FC<SessionLoginFormProps> = ({
  username: urlUsername,
  instituteId,
  onLoginSuccess,
}) => {
  const [step, setStep] = useState<"username" | "otp">("username");
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const navigate = useNavigate();
  const hasCalledInitialAPI = useRef(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Username form
  const usernameForm = useForm<UsernameFormValues>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: urlUsername || "",
    },
  });

  // Step 1: Get user details by username
  const getUserDetailsMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await axios({
        method: "GET",
        url: LOGIN_USING_USERNAME,
        params: {
          username,
          portal: "LEARNER",
          instituteId,
        },
      });
      return response.data;
    },
    onSuccess: async (data: UserDetails) => {
      setUserDetails(data);

      // Step 2: Request OTP for the user's email
      try {
        await axios.post(REQUEST_OTP, {
          email: data.email,
          institute_id: instituteId,
        });

        setStep("otp");
        toast.success("We have sent an OTP! Please check your email.");
      } catch (error) {
        console.error("Failed to send OTP:", error);
        toast.error("Failed to send OTP", {
          description: "Please try again",
        });
      }
    },
    onError: (error: unknown) => {
      console.error("User lookup error:", error);
      let errorMessage = "User not found";
      if (error && typeof error === "object" && "response" in error) {
        const responseError = error as {
          response?: { data?: { message?: string; ex?: string } };
        };
        errorMessage =
          responseError.response?.data?.message ||
          responseError.response?.data?.ex ||
          "User not found";
      }
      toast.error("Failed to find user", {
        description: errorMessage,
      });
    },
  });

  // Automatically call the API when component mounts with urlUsername
  useEffect(() => {
    if (
      urlUsername &&
      urlUsername.trim() !== "" &&
      !hasCalledInitialAPI.current
    ) {
      hasCalledInitialAPI.current = true;
      getUserDetailsMutation.mutate(urlUsername);
    }
  }, [urlUsername]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OTP verification with new API flow
  const handleOtpVerified = async () => {
    if (!userDetails || otpValues.join("").length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      return;
    }

    try {
      setIsVerifyingOtp(true);

      // Step 3: Login using OTP with only email and OTP
      const response = await axios.post(LOGIN_USING_OTP, {
        email: userDetails.email,
        otp: otpValues.join(""),
      });

      if (response.data.accessToken) {
        toast.success("OTP verified successfully!");
        // Store tokens
        await setTokenInStorage(
          TokenKey.accessToken,
          response.data.accessToken
        );
        await setTokenInStorage(
          TokenKey.refreshToken,
          response.data.refreshToken
        );

        // Decode token to get user data
        const tokenData = getTokenDecodedData(response.data.accessToken);
        const userId = tokenData?.user;

        if (instituteId && userId) {
          identifyUser(userId, {
            username: tokenData?.username,
            email: tokenData?.email,
          });

          try {
            // Fetch and store institute details
            await fetchAndStoreInstituteDetails(instituteId, userId);
            getStudentDisplaySettings(true);
          } catch (error) {
            console.error("Error fetching institute details:", error);
            
          }

          try {
            await fetchAndStoreStudentDetails(instituteId, userId);
          } catch {
            toast.error("Failed to fetch student details");
          }

          toast.success("Login successful! Redirecting...", {
            description: "Welcome to your live session",
          });

          // Navigate to live class route
          navigate({
            to: "/study-library/live-class/$username",
            params: { username: urlUsername },
          });

          // Call success callback
          onLoginSuccess();
        } else {
          toast.error("Invalid user data received");
          throw new Error("Invalid user data received");
        }
      } else {
        toast.error("Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      toast.error("Invalid OTP. Please try again.");
      // Reset OTP values on error
      setOtpValues(Array(6).fill(""));
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (index: number, value: string) => {
    // Only handle single character input here
    const newOtpValues = [...otpValues];
    newOtpValues[index] = value.replace(/\D/g, "");
    setOtpValues(newOtpValues);

    // Auto-focus next input for single character
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 6);

    if (digits.length > 0) {
      const newOtpValues = Array(6).fill("");
      digits.split("").forEach((digit, i) => {
        if (i < 6) {
          newOtpValues[i] = digit;
        }
      });
      setOtpValues(newOtpValues);

      // Focus the next empty input or the last filled input
      const nextIndex = Math.min(digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const onUsernameSubmit = (values: UsernameFormValues) => {
    getUserDetailsMutation.mutate(values.username);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">
          Login to View Sessions
        </h2>
        <p className="text-sm text-gray-600">
          {getUserDetailsMutation.isPending && step === "username"
            ? "Loading user details..."
            : step === "username"
            ? "Enter your username to access the live session"
            : ``}
        </p>
      </div>

      {getUserDetailsMutation.isPending && !userDetails ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center space-y-4"
        >
          <RefreshCw className="w-8 h-8 animate-spin text-gray-600" />
          <p className="text-sm text-gray-600">Finding user details...</p>
        </motion.div>
      ) : step === "username" ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Form {...usernameForm}>
            <form
              onSubmit={usernameForm.handleSubmit(onUsernameSubmit)}
              className="space-y-4"
            >
              <FormField
                control={usernameForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="username">Username</Label>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          id="username"
                          type="text"
                          placeholder="Enter your username"
                          className="h-11 pr-10"
                          disabled={getUserDetailsMutation.isPending}
                        />
                        <Shield className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11"
                disabled={getUserDetailsMutation.isPending}
              >
                {getUserDetailsMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Finding User...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Continue</span>
                  </div>
                )}
              </Button>
            </form>
          </Form>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* OTP Header */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 rounded-md mx-auto flex items-center justify-center">
              <Shield className="w-6 h-6 text-gray-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">Enter OTP</h3>
              <p className="text-sm text-gray-600">
                We've sent a 6-digit code to{" "}
                <span className="font-medium">{userDetails?.email}</span>
              </p>
            </div>
          </div>

          {/* OTP Input */}
          <div className="space-y-6">
            <div className="flex justify-center space-x-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Input
                  key={index}
                  ref={(el) => (otpInputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otpValues[index]}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={index === 0 ? handleOtpPaste : undefined}
                  className="h-12 w-12 text-center text-lg font-semibold border border-gray-200 rounded-lg transition-all duration-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 hover:border-gray-300 bg-white shadow-sm"
                />
              ))}
            </div>

            <Button
              onClick={handleOtpVerified}
              disabled={isVerifyingOtp || otpValues.join("").length !== 6}
              className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifyingOtp ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
