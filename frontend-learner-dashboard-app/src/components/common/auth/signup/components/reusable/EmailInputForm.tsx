import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpinnerGap, ArrowRight, ArrowLeft } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { toast } from "sonner";
import axios from "axios";
import { LIVE_SESSION_REQUEST_OTP } from "@/constants/urls";

interface EmailInputFormData {
  email: string;
  fullName: string;
}

interface EmailInputFormProps {
  settings: SignupSettings;
  initialEmail?: string;
  initialFullName?: string;
  onOtpSent: (email: string, fullName: string) => void;
  onBack?: () => void;
  className?: string;
  isOAuth?: boolean;
  hideFullName?: boolean;
  privateEmailMessage?: string;
  instituteId?: string; // Add instituteId for enrollment checking
  onEnrolledUserDetected?: () => void; // Callback for when enrolled user is detected
  checkEnrollmentOnce?: (email: string) => Promise<any>; // Function to check enrollment once
}

const createEmailInputSchema = (
  hideFullName: boolean = false,
  usernameStrategy?: string
) => {
  const baseSchema: any = {
    email: z.string().email(i18n.t("auth:validation.validEmail")),
  };

  // For email OTP signup, ask for full name only if:
  // 1. hideFullName is false AND
  // 2. usernameStrategy is not "email" (when usernameStrategy is "email", we'll use email as full name)
  if (!hideFullName && usernameStrategy !== "email") {
    baseSchema.fullName = z
      .string()
      .min(2, i18n.t("auth:validation.fullNameMin"));
  }

  return z.object(baseSchema);
};

export function EmailInputForm({
  settings,
  initialEmail = "",
  initialFullName = "",
  onOtpSent,
  onBack,
  className = "",
  isOAuth = false,
  hideFullName = false,
  privateEmailMessage = "",
  instituteId,
  onEnrolledUserDetected,
  checkEnrollmentOnce,
}: EmailInputFormProps) {
  const { t } = useTranslation("auth");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const schema = createEmailInputSchema(
    hideFullName,
    settings.usernameStrategy
  );

  const form = useForm<EmailInputFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialEmail,
      fullName: initialFullName,
    },
  });

  const handleEmailSubmit = async (data: EmailInputFormData) => {
    try {
      setIsSubmitting(true);

      // Note: We don't check enrollment here anymore
      // Enrollment is checked AFTER OTP verification for all flows:
      // - GitHub private email (OAuth flow)
      // - Regular email OTP flow
      // This ensures we have a verified email before checking enrollment status

      // When usernameStrategy is "email", use email as full name
      const fullNameToUse =
        settings.usernameStrategy === "email"
          ? data.email
          : data.fullName || initialFullName || "User";

      await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        {
          to: data.email.trim(),
          subject: "Email Verification",
          service: "signup",
          name: fullNameToUse,
          otp: "",
        },
        {
          params: { instituteId },
        }
      );

      toast.success(i18n.t("auth:toasts.otpSentEmail"));
      onOtpSent(data.email, fullNameToUse);
    } catch (error) {
      toast.error(i18n.t("auth:toasts.failedToSendOtpRetry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-6 ${className}`}
    >
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-gray-900">
          {isOAuth ? t("emailInput.verifyEmail") : t("signup.createAccount")}
        </h3>
        <p className="text-sm text-gray-600">
          {isOAuth
            ? t("emailInput.verifyEmailSubtitle")
            : t("emailInput.enterDetails")}
        </p>
      </div>

      {hideFullName && privateEmailMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-800">{privateEmailMessage}</p>
            </div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleEmailSubmit)}
          className="space-y-4"
        >
          {/* Full Name - Show only if hideFullName is false AND usernameStrategy is not "email" */}
          {!hideFullName && settings.usernameStrategy !== "email" && (
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    {t("emailInput.fullNameLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("emailInput.enterFullName")}
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
                  {t("emailInput.emailLabel")}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder={t("common.enterEmailAddress")}
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
                <SpinnerGap className="w-4 h-4 me-2 animate-spin" />
                {t("emailInput.sendingOtp")}
              </>
            ) : (
              <>
                {t("emailInput.sendOtp")}
                <ArrowRight className="w-4 h-4 ms-2" />
              </>
            )}
          </Button>
        </form>
      </Form>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("emailInput.backToOptions")}
        </button>
      )}
    </motion.div>
  );
}
