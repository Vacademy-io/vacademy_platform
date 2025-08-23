import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { toast } from "sonner";
import axios from "axios";
import { LIVE_SESSION_REQUEST_OTP, LIVE_SESSION_VERIFY_OTP } from "@/constants/urls";

interface EmailOtpFormData {
  email: string;
  fullName: string;
}

interface OtpFormData {
  otp: string[];
}

interface EmailOtpFormProps {
  settings: SignupSettings;
  initialEmail?: string;
  initialFullName?: string;
  onOtpVerified: (email: string, fullName: string) => Promise<void>;
  onBack?: () => void;
  className?: string;
  isOAuth?: boolean;
  hideFullName?: boolean;
  privateEmailMessage?: string;
}

// Dynamic schema based on signup mode
const createEmailOtpSchema = (signupMode: "direct" | "askCredentials", hideFullName: boolean = false) => {
  const baseSchema: any = {
    email: z.string().email("Please enter a valid email address"),
  };

  if (!hideFullName) {
    baseSchema.fullName = z.string().min(2, "Full name must be at least 2 characters");
  }

  return z.object(baseSchema);
};

export function EmailOtpForm({
  settings,
  initialEmail = "",
  initialFullName = "",
  onOtpVerified,
  onBack,
  className = "",
  isOAuth = false,
  hideFullName = false,
  privateEmailMessage = ""
}: EmailOtpFormProps) {
  const [currentStep, setCurrentStep] = useState<"form" | "otp" | "verifying">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [formData, setFormData] = useState<EmailOtpFormData | null>(null);
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));

  const schema = createEmailOtpSchema(settings.emailOtpSignupMode, hideFullName);
  const form = useForm<EmailOtpFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialEmail,
      fullName: initialFullName,
    },
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(z.object({
      otp: z.array(z.string()).length(6).transform((val) => val.join("")),
    })),
    defaultValues: {
      otp: Array(6).fill(""),
    },
  });

  // Timer for OTP resend
  const startTimer = () => {
    setTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleEmailSubmit = async (data: EmailOtpFormData) => {
    try {
      setIsSubmitting(true);
      
      // Send OTP
      await axios.post(LIVE_SESSION_REQUEST_OTP, {
        to: data.email.trim(),
        subject: "Email Verification",
        service: "signup",
        name: data.fullName || initialFullName || "User", // Use initialFullName if fullName not provided
        otp: "",
      });

      setFormData(data);
      setIsOtpSent(true);
      setCurrentStep("otp");
      // Reset OTP values when starting new OTP flow
      setOtpValues(Array(6).fill(""));
      otpForm.setValue("otp", Array(6).fill(""));
      startTimer();
      toast.success("OTP sent successfully to your email");
    } catch (error) {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!formData) {
      return;
    }

    try {
      setCurrentStep("verifying");
      
      // Use local OTP state instead of form state
      const otpString = otpValues.join("");

      // Check if OTP is complete
      if (otpString.length !== 6) {
        toast.error("Please enter the complete 6-digit OTP");
        setCurrentStep("otp");
        return;
      }

      // Verify OTP
      await axios.post(LIVE_SESSION_VERIFY_OTP, {
        to: formData.email,
        otp: otpString,
        service: "signup",
      });

      // OTP verified, call the callback
      // Use initialFullName as fallback when fullName is not provided (for GitHub private email case)
      const fullNameToPass = formData.fullName || initialFullName || "User";
      await onOtpVerified(formData.email, fullNameToPass);
    } catch (error) {
      toast.error("Invalid OTP. Please try again.");
      setCurrentStep("otp");
    }
  };

  const handleResendOtp = async () => {
    if (!formData || timer > 0) return;

    try {
      await axios.post(LIVE_SESSION_REQUEST_OTP, {
        to: formData.email.trim(),
        subject: "Email Verification",
        service: "signup",
        name: formData.fullName || initialFullName || "User", // Use initialFullName if fullName not provided
        otp: "",
      });

      startTimer();
      toast.success("OTP resent successfully");
    } catch (error) {
      toast.error("Failed to resend OTP. Please try again.");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) {
      value = value[0];
    }
    
    // Update local state
    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);
    
    // Also update form state for compatibility
    otpForm.setValue("otp", newOtpValues);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!e.currentTarget.value && index > 0) {
        // If current field is empty and backspace is pressed, go to previous field
        otpInputRefs.current[index - 1]?.focus();
      } else if (e.currentTarget.value) {
        // If current field has value, clear it first
        const newOtpValues = [...otpValues];
        newOtpValues[index] = "";
        setOtpValues(newOtpValues);
        otpForm.setValue("otp", newOtpValues);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, 6);
    
    if (pastedData.length > 0) {
      // Create OTP array with pasted data + empty strings for remaining slots
      const otpArray = pastedData.split("").concat(Array(6 - pastedData.length).fill(""));
      
      setOtpValues(otpArray);
      otpForm.setValue("otp", otpArray);
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(pastedData.length, 5);
      if (otpInputRefs.current[nextIndex]) {
        otpInputRefs.current[nextIndex]?.focus();
      } else if (otpInputRefs.current[5]) {
        // If nextIndex is out of bounds, focus the last input
        otpInputRefs.current[5]?.focus();
      }
      
      // Show success message
                  // OTP pasted successfully - no need to show toast
    }
  };

  if (currentStep === "form") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`space-y-6 ${className}`}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-gray-900">
            {isOAuth ? "Verify Your Email" : "Create Your Account"}
          </h3>
          <p className="text-sm text-gray-600">
            {isOAuth 
              ? "Please verify your email to complete the signup process"
              : "Enter your details to get started"
            }
          </p>
        </div>

        {/* Email Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleEmailSubmit)} className="space-y-4">
            {/* Private Email Message */}
            {hideFullName && privateEmailMessage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-800">{privateEmailMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Full Name Field - Only show when not hidden */}
            {!hideFullName && (
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Full Name *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your full name"
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    Email Address *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Enter your email address"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </Form>

        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to signup options
          </button>
        )}
      </motion.div>
    );
  }

  if (currentStep === "otp") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`space-y-6 ${className}`}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Verify Your Email</h3>
          <p className="text-sm text-gray-600">
            We've sent a 6-digit code to <span className="font-medium">{formData?.email}</span>
          </p>
        </div>

        {/* OTP Form */}
        <div className="space-y-6">
          <div className="space-y-4">
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
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="h-12 w-12 text-center text-lg font-semibold border border-gray-200 rounded-lg transition-all duration-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 hover:border-gray-300 bg-white shadow-sm"
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleOtpSubmit}
            disabled={currentStep === "verifying"}
            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === "verifying" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify OTP"
            )}
          </Button>
        </div>

        {/* Resend OTP */}
        <div className="text-center">
          <button
            onClick={handleResendOtp}
            disabled={timer > 0}
            className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {timer > 0 ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Resend in {timer}s
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Resend OTP
              </span>
            )}
          </button>
        </div>

        {/* Back Button */}
        <button
          onClick={() => {
            setCurrentStep("form");
            // Reset OTP values when going back
            setOtpValues(Array(6).fill(""));
            otpForm.setValue("otp", Array(6).fill(""));
          }}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to email form
        </button>
      </motion.div>
    );
  }

  if (currentStep === "verifying") {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying OTP...</p>
        </div>
      </div>
    );
  }

  return null;
}
