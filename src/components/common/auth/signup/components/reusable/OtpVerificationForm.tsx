import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { LIVE_SESSION_VERIFY_OTP, LIVE_SESSION_REQUEST_OTP } from "@/constants/urls";

interface OtpFormData {
  otp: string[];
}

interface OtpVerificationFormProps {
  email: string;
  fullName?: string;
  onOtpVerified: (email: string, fullName?: string) => Promise<void>;
  onBack?: () => void;
  className?: string;
}

const otpSchema = z.object({
  otp: z.array(z.string()).length(6).transform((val) => val.join("")),
});

export function OtpVerificationForm({
  email,
  fullName,
  onOtpVerified,
  onBack,
  className = ""
}: OtpVerificationFormProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
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

  // Start timer when component mounts
  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleOtpSubmit = async () => {
    try {
      setIsVerifying(true);
      
      // Use local OTP state
      const otpString = otpValues.join("");

      // Check if OTP is complete
      if (otpString.length !== 6) {
        toast.error("Please enter the complete 6-digit OTP");
        return;
      }

      // Verify OTP
      await axios.post(LIVE_SESSION_VERIFY_OTP, {
        to: email,
        otp: otpString,
        service: "signup",
      });

      // OTP verified, call the callback
      await onOtpVerified(email, fullName);
    } catch (error) {
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;

    try {
      await axios.post(LIVE_SESSION_REQUEST_OTP, {
        to: email,
        subject: "Email Verification",
        service: "signup",
        name: fullName || "User",
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`space-y-6 ${className}`}
    >
      {/* Header with Email Badge */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 200,
          }}
          className="w-12 h-12 bg-gray-100 rounded-md mx-auto flex items-center justify-center"
        >
          <Mail className="w-6 h-6 text-gray-700" />
        </motion.div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Check your email
          </h3>
          <p className="text-sm text-gray-600">
            We've sent a 6-digit code to
          </p>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1"
          >
            <CheckCircle2 className="w-3 h-3 text-gray-600" />
            <span className="text-sm font-medium text-gray-800">
              {email}
            </span>
          </motion.div>
        </div>
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

        {/* Resend OTP */}
        <div className="text-center">
          <span className="text-sm text-gray-600">
            Didn't receive the code?{" "}
          </span>
          <button
            onClick={handleResendOtp}
            disabled={timer > 0}
            className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
                      {timer > 0 ? (
            <span>
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

        <Button
          onClick={handleOtpSubmit}
          disabled={isVerifying}
          className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify OTP"
          )}
        </Button>
      </div>

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
