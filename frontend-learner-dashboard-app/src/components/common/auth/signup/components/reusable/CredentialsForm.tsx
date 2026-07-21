import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Eye, EyeSlash, ArrowLeft, ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";

interface CredentialsFormData {
  fullName: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
}

interface CredentialsFormProps {
  settings: SignupSettings;
  initialData?: Partial<CredentialsFormData>;
  onSubmit: (data: CredentialsFormData) => Promise<void>;
  onBack?: () => void;
  className?: string;
  isOAuth?: boolean;
  oauthProvider?: string;
  hideFullName?: boolean;
}

// Dynamic schema based on signup settings
const createCredentialsSchema = (settings: SignupSettings, hideFullName: boolean = false) => {
  const baseSchema: any = {};
  
  if (!hideFullName) {
    baseSchema.fullName = z.string().min(2, i18n.t("auth:validation.fullNameMin"));
  }

  if (settings.usernameStrategy === "manual" || settings.usernameStrategy === " ") {
    baseSchema.username = z.string().min(3, i18n.t("auth:validation.usernameMin"));
  }

  if (settings.passwordStrategy === "manual" || settings.passwordStrategy === " ") {
    baseSchema.password = z.string().min(8, i18n.t("auth:validation.passwordMin"));
    baseSchema.confirmPassword = z.string();
  }

  const schema = z.object(baseSchema);

  // Add password confirmation validation if password is required
  if (settings.passwordStrategy === "manual" || settings.passwordStrategy === " ") {
    return schema.refine((data) => data.password === data.confirmPassword, {
      message: i18n.t("auth:validation.passwordsDontMatch"),
      path: ["confirmPassword"],
    });
  }

  return schema;
};

export function CredentialsForm({
  settings,
  initialData = {},
  onSubmit,
  onBack,
  className = "",
  isOAuth = false,
  oauthProvider = "",
  hideFullName = false
}: CredentialsFormProps) {
  const { t } = useTranslation("auth");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const schema = createCredentialsSchema(settings, hideFullName);
  const form = useForm<CredentialsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Always set fullName if we have initial data, regardless of hideFullName
      fullName: initialData.fullName || "",
      username: initialData.username || "",
      password: initialData.password || "",
      confirmPassword: initialData.confirmPassword || "",
    },
  });

  const handleSubmit = async (data: CredentialsFormData) => {
    try {
      setIsSubmitting(true);
      
      // When usernameStrategy is "email" and we have OAuth data, use OAuth name as full name
      const finalData = {
        ...data,
        fullName: settings.usernameStrategy === "email" && initialData.fullName 
          ? initialData.fullName 
          : data.fullName
      };
      
      await onSubmit(finalData);
    } catch (error) {
      // Handle error silently
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsUsername = settings.usernameStrategy === "manual" || settings.usernameStrategy === " ";
  const needsPassword = settings.passwordStrategy === "manual" || settings.passwordStrategy === " ";

  // Show full name field if:
  // 1. hideFullName is false AND
  // 2. usernameStrategy is not "email" (when usernameStrategy is "email", we hide the field but still use OAuth name)
  // 3. OR if we have initial data and any credentials are manual
  const showFullName = (!hideFullName && settings.usernameStrategy !== "email") || 
                      (initialData.fullName && (needsUsername || needsPassword));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-6 ${className}`}
    >
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-gray-900">
          {isOAuth ? t("credentials.completeProfile") : t("signup.createAccount")}
        </h3>
        <p className="text-sm text-gray-600">
          {isOAuth
            ? t("credentials.provideInfo")
            : t("emailInput.enterDetails")}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Full Name - Show if we have a value or if any credentials are manual */}
          {showFullName && (
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

          {/* Username - Only show if manual strategy */}
          {needsUsername && (
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    {t("credentials.usernameLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("credentials.enterUsername")}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Password - Only show if manual strategy */}
          {needsPassword && (
            <>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("credentials.passwordLabel")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder={t("common.enterPassword")}
                          className="px-3 py-2 pe-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 end-0 pe-3 flex items-center"
                        >
                          {showPassword ? (
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg className="w-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("credentials.confirmPasswordLabel")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={t("credentials.confirmPassword")}
                          className="px-3 py-2 pe-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 end-0 pe-3 flex items-center"
                        >
                          {showConfirmPassword ? (
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg className="w-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isSubmitting ? (
              <>
                <SpinnerGap className="w-4 h-4 me-2 animate-spin" />
                {t("credentials.creatingAccount")}
              </>
            ) : (
              <>
                {t("credentials.createAccount")}
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
