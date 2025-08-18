import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { registerUser, parseInstituteSettings } from "@/services/signup-api";
// import { handlePostSignupAuth } from "@/services/signup-api"; // keep for later
// import { useNavigate } from "@tanstack/react-router"; // keep for later
import { Preferences } from "@capacitor/preferences";
import { FcGoogle } from "react-icons/fc";

interface GoogleSignupProviderProps {
  instituteId: string;
  settings: SignupSettings;
  isDefault?: boolean;
  onSignupSuccess?: () => void;
  onBackToProviders?: () => void;
  className?: string;
}

interface GoogleProfile {
  name: string;
  email: string;
}

interface CredentialsFormData {
  fullName: string;
  username: string;
  password: string;
  confirmPassword: string;
}

const credentialsSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function GoogleSignupProvider({
  instituteId,
  settings,
  isDefault = false,
  onSignupSuccess,
  onBackToProviders,
  className = ""
}: GoogleSignupProviderProps) {
  const [currentStep, setCurrentStep] = useState<"button" | "credentials" | "processing">("button");
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // const navigate = useNavigate(); // keep for later

  const credentialsForm = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleGoogleOAuth = async () => {
    try {
      setCurrentStep("processing");
      
      // Simulate Google OAuth flow - in real implementation, this would redirect to Google
      // For now, we'll simulate getting a profile
      const mockProfile: GoogleProfile = {
        name: "John Doe",
        email: "john.doe@gmail.com"
      };
      
      setGoogleProfile(mockProfile);
      
      // Decide whether we need credentials based on strategies
      const needsUsername = !["email", "auto"].includes((settings.usernameStrategy as string) || "manual");
      const needsPassword = !["auto", "none"].includes((settings.passwordStrategy as string) || "manual");

      if (needsUsername || needsPassword) {
        setCurrentStep("credentials");
        credentialsForm.setValue("fullName", mockProfile.name);
      } else {
        await handleDirectRegistration(mockProfile);
      }
    } catch (error) {
      console.error("Google OAuth error:", error);
      toast.error("Failed to authenticate with Google");
      setCurrentStep("button");
    }
  };

  const handleDirectRegistration = async (profile: GoogleProfile) => {
    try {
      setIsSubmitting(true);
      // Determine roles based on institute settings
      let learnersCanCreateCourses = false;
      try {
        const stored = await Preferences.get({ key: "InstituteDetails" });
        if (stored?.value) {
          const parsed = JSON.parse(stored.value);
          const settingsString = parsed?.institute_settings_json;
          if (typeof settingsString === "string") {
            const instSettings = parseInstituteSettings(settingsString);
            learnersCanCreateCourses = !!instSettings?.learnersCanCreateCourses;
          }
        }
      } catch {}

      const roles: string[] = ["STUDENT", ...(learnersCanCreateCourses ? ["TEACHER"] : [])];

      const payload = {
        user: {
          username: settings.usernameStrategy === "email" ? profile.email : "",
          email: profile.email,
          full_name: profile.name,
          roles,
          root_user: false,
        },
        institute_id: instituteId,
        learner_package_session_enroll: null,
      } as const;

      const response = await registerUser(payload);
      // Token handling (keep for later)
      // await handlePostSignupAuth(response.accessToken, response.refreshToken, instituteId, navigate, true);

      toast.success("Account created successfully!");
      onSignupSuccess?.();
    } catch (error) {
      console.error("Direct registration error:", error);
      toast.error("Failed to register user");
      setCurrentStep("button");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (data: CredentialsFormData) => {
    try {
      setIsSubmitting(true);
      if (!googleProfile?.email) {
        throw new Error("Missing Google email");
      }

      // Determine roles
      let learnersCanCreateCourses = false;
      try {
        const stored = await Preferences.get({ key: "InstituteDetails" });
        if (stored?.value) {
          const parsed = JSON.parse(stored.value);
          const settingsString = parsed?.institute_settings_json;
          if (typeof settingsString === "string") {
            const instSettings = parseInstituteSettings(settingsString);
            learnersCanCreateCourses = !!instSettings?.learnersCanCreateCourses;
          }
        }
      } catch {}
      const roles: string[] = ["STUDENT", ...(learnersCanCreateCourses ? ["TEACHER"] : [])];

      const payload = {
        user: {
          username: settings.usernameStrategy === "email" ? googleProfile.email : data.username,
          email: googleProfile.email,
          full_name: data.fullName,
          roles,
          root_user: false,
          ...(settings.passwordStrategy === "manual" ? { password: data.password } : {}),
        },
        institute_id: instituteId,
        learner_package_session_enroll: null,
      } as const;

      const response = await registerUser(payload);
      // Token handling (keep for later)
      // await handlePostSignupAuth(response.accessToken, response.refreshToken, instituteId, navigate, true);

      toast.success("Account created successfully!");
      onSignupSuccess?.();
    } catch (error) {
      console.error("Credentials registration error:", error);
      toast.error("Failed to register user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToProviders = () => {
    setCurrentStep("button");
    setGoogleProfile(null);
    credentialsForm.reset();
    onBackToProviders?.();
  };

  if (currentStep === "processing") {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Google...</p>
        </div>
      </div>
    );
  }

  if (currentStep === "credentials") {
    return renderCredentialsForm();
  }

  const renderCredentialsForm = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Header */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-3"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900">Complete Your Profile</h3>
          <p className="text-sm text-gray-600">
            We've got your name from Google. Please set your username and password.
          </p>
        </div>
      </motion.div>

      <form onSubmit={credentialsForm.handleSubmit(handleCredentialsSubmit)} className="space-y-4">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">Full Name</Label>
          <Input
            id="fullName"
            {...credentialsForm.register("fullName")}
            placeholder="Your full name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            readOnly
          />
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username *</Label>
          <Input
            id="username"
            {...credentialsForm.register("username")}
            placeholder="Choose a username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {credentialsForm.formState.errors.username && (
            <p className="text-sm text-red-600">{credentialsForm.formState.errors.username.message}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...credentialsForm.register("password")}
              placeholder="Create a password"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-1.042.334-2.021.925-2.874m2.211-2.211C7.42 5.7 9.62 5 12 5c5 0 9 4 9 7 0 1.152-.395 2.352-1.093 3.4M3 3l18 18M9.88 9.88A3 3 0 0114.12 14.12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {credentialsForm.formState.errors.password && (
            <p className="text-sm text-red-600">{credentialsForm.formState.errors.password.message}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm Password *</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              {...credentialsForm.register("confirmPassword")}
              placeholder="Confirm your password"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(p => !p)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {showConfirmPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-1.042.334-2.021.925-2.874m2.211-2.211C7.42 5.7 9.62 5 12 5c5 0 9 4 9 7 0 1.152-.395 2.352-1.093 3.4M3 3l18 18M9.88 9.88A3 3 0 0114.12 14.12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {credentialsForm.formState.errors.confirmPassword && (
            <p className="text-sm text-red-600">{credentialsForm.formState.errors.confirmPassword.message}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3 pt-4"
        >
          <Button
            type="button"
            variant="outline"
            onClick={handleBackToProviders}
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
          >
            Back
          </Button>
          <Button 
            type="submit" 
            className="flex-1 bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );

  // Render the Google signup button
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleGoogleOAuth}
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group ${className}`}
      type="button"
    >
      <FcGoogle className="w-4 h-4" />
      <span className="text-sm">
        Continue with Google
      </span>
    </motion.button>
  );
}
