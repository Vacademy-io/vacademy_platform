import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
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
    baseSchema.fullName = z.string().min(2, "Full name must be at least 2 characters");
  }

  if (settings.usernameStrategy === "manual" || settings.usernameStrategy === " ") {
    baseSchema.username = z.string().min(3, "Username must be at least 3 characters");
  }

  if (settings.passwordStrategy === "manual" || settings.passwordStrategy === " ") {
    baseSchema.password = z.string().min(8, "Password must be at least 8 characters");
    baseSchema.confirmPassword = z.string();
  }

  const schema = z.object(baseSchema);

  // Add password confirmation validation if password is required
  if (settings.passwordStrategy === "manual" || settings.passwordStrategy === " ") {
    return schema.refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);



  const schema = createCredentialsSchema(settings, hideFullName);
  const form = useForm<CredentialsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(hideFullName ? {} : { fullName: initialData.fullName || "" }),
      username: initialData.username || "",
      password: initialData.password || "",
      confirmPassword: initialData.confirmPassword || "",
    },
  });

  const handleSubmit = async (data: CredentialsFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsUsername = settings.usernameStrategy === "manual" || settings.usernameStrategy === " ";
  const needsPassword = settings.passwordStrategy === "manual" || settings.passwordStrategy === " ";

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2"
      >
        <h3 className="text-xl font-semibold text-gray-900">
          {isOAuth ? `Complete Your ${oauthProvider} Account` : "Complete Your Profile"}
        </h3>
        <p className="text-sm text-gray-600">
          {isOAuth 
            ? `Please provide additional details to complete your ${oauthProvider} registration`
            : "Please provide your details to complete registration"
          }
        </p>
      </motion.div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Full Name */}
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

          {/* Username (if required) */}
          {needsUsername && (
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    Username *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Choose a username"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Password (if required) */}
          {needsPassword && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    Password *
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        className="px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Confirm Password (if required) */}
          {needsPassword && (
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    Confirm Password *
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        className="px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </Form>

      {/* Back Button */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to signup options
        </motion.button>
      )}
    </div>
  );
}
