import { MyInput } from "@/components/design-system/input";
import { forgotPasswordSchema } from "@/schemas/login/login";
import { z } from "zod";
import { forgotPassword } from "@/components/common/auth/login/hooks/send-link-button";
import { sendResetLink } from "@/components/common/auth/login/hooks/reset-link-click";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, Key, Shield, CheckCircle, RefreshCw, ArrowRight } from "lucide-react";
import { useTheme } from "@/providers/theme/theme-provider";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPassword() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const { setInstituteId } = useInstituteFeatureStore();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Initialize theme based on institute (similar to login form)
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Check if we have institute details in localStorage
        const instituteDetails = localStorage.getItem("InstituteDetails");
        const studentDetails = localStorage.getItem("StudentDetails");
        
        if (instituteDetails && studentDetails) {
          const parsedInstituteDetails = JSON.parse(instituteDetails);
          const parsedStudentDetails = JSON.parse(studentDetails);
          
          if (parsedInstituteDetails.institute_id && parsedStudentDetails.user_id) {
            setInstituteId(parsedInstituteDetails.institute_id);
            
            // Set theme based on institute
            if (parsedInstituteDetails.institute_id === HOLISTIC_INSTITUTE_ID) {
              setPrimaryColor("holistic");
            } else {
              setPrimaryColor(parsedInstituteDetails.institute_theme_code ?? "#E67E22");
            }
          }
        }
      } catch (error) {
        console.error("Error initializing theme:", error);
      }
    };

    initializeTheme();
  }, [setPrimaryColor, setInstituteId]);

  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onTouched",
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onMutate: () => setIsLoading(true),
    onSuccess: async (response) => {
      if (response.status === "success") {
        setEmailSent(true);
        toast.success("Credentials sent successfully", { duration: 2000 });
        sendResetLinkMutation.mutate();
      } else {
        toast.error("Account not found", {
          description: "This email address is not registered",
          duration: 2000,
        });
        form.reset();
      }
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
      toast.error("Account not found", {
        description: "This email address is not registered",
        duration: 2000,
      });
    },
  });

  const sendResetLinkMutation = useMutation({
    mutationFn: sendResetLink,
    onSuccess: (response) => {
      if (response.status !== "success") {
        toast.error("Failed to reset the password", { duration: 3000 });
      }
    },
    onError: () => {
      toast.error("Failed to reset the password", { duration: 3000 });
    },
  });

  function onSubmit(values: FormValues) {
    forgotPasswordMutation.mutate(values.email);
  }

  const handleTryAgain = () => {
    setEmailSent(false);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Subtle Background Pattern (gradients removed) */}
      <div className="absolute inset-0 -z-10" />
      
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
        className="absolute top-20 left-20 w-48 h-48 bg-muted/10 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -20, 0],
          y: [0, 10, 0],
          rotate: [0, -2, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
        className="absolute bottom-20 right-20 w-64 h-64 bg-muted/10 rounded-full blur-3xl"
      />

      <div className="flex min-h-screen">
        {/* Left Side - Branding & Features */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex lg:w-1/2 xl:w-1/2 flex-col justify-center px-8 xl:px-16"
        >
          {/* Main Heading */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-foreground mb-4 leading-tight">
              Reset Your Password
              <br />
              Securely
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
              Don't worry! We'll help you get back to your learning journey with secure password recovery.
            </p>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            {[
              {
                icon: Shield,
                title: "Secure Recovery",
                desc: "Enterprise-grade security",
              },
              {
                icon: Mail,
                title: "Email Verification",
                desc: "Instant delivery to your inbox",
              },
              {
                icon: Key,
                title: "Quick Access",
                desc: "Get back to learning fast",
              },
              {
                icon: CheckCircle,
                title: "Verified Process",
                desc: "Trusted by thousands of learners",
              },
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
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-600">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Trust Indicators */}
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
              <CheckCircle className="w-4 h-4" />
              <span>99.9% Uptime</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Side - Forgot Password Form */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="w-full lg:w-1/2 xl:w-1/2 p-4 lg:p-8 xl:p-12 flex items-center justify-center"
        >
          <div className="w-full max-w-lg xl:max-w-xl">
          {/* Main Card */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8 xl:p-10"
            >
            {/* Back Button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => navigate({ to: "/login" })}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
              <span className="text-sm font-medium">Back to Login</span>
            </motion.button>

            <AnimatePresence mode="wait">
              {!emailSent ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header */}
                  <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-6"
                  >
                    <div className="w-12 h-12 bg-gray-900 rounded-lg mx-auto flex items-center justify-center mb-4">
                      <Key className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                      Forgot Your Password?
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Enter your email address and we'll send you your login credentials
                    </p>
                  </motion.div>

                  {/* Form */}
                  <Form {...form}>
                    <motion.form 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      onSubmit={form.handleSubmit(onSubmit)} 
                      className="space-y-5"
                    >
                      {/* Email Field */}
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field: { onChange, value, ...field } }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <MyInput
                                  inputType="email"
                                  inputPlaceholder="Enter your email address"
                                  input={value}
                                  onChangeFunction={onChange}
                                  error={form.formState.errors.email?.message}
                                  required={true}
                                  size="large"
                                  label="Email Address"
                                  {...field}
                                  className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                />
                                <Mail className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Submit Button */}
                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </motion.div>
                              <span>Sending...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <Mail className="w-4 h-4" />
                              <span>Send Credentials</span>
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        )}
                      </motion.button>
                    </motion.form>
                  </Form>

                  {/* Security Notice */}
                  <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6 p-3 bg-gray-50/80 border border-gray-200/60 rounded-lg"
                  >
                    <div className="flex items-start space-x-2">
                      <Shield className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800 mb-1">
                          Account Security
                        </p>
                        <p className="text-xs text-gray-600">
                          We'll send your credentials securely to your registered email address.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  {/* Success Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 bg-gray-900 rounded-full mx-auto flex items-center justify-center mb-6"
                  >
                    <CheckCircle className="w-8 h-8 text-white" />
                  </motion.div>

                  {/* Success Message */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mb-6"
                  >
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      Email Sent Successfully!
                    </h2>
                    <p className="text-gray-600 text-sm mb-2">
                      We've sent your login credentials to
                    </p>
                    <p className="font-medium text-gray-900 text-sm">
                      {form.getValues().email}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Please check your inbox and spam folder
                    </p>
                  </motion.div>

                  {/* Action Buttons */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-3"
                  >
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => navigate({ to: "/login" })}
                      className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <ArrowLeft className="w-4 h-4" />
                          <span>Back to Login</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      onClick={handleTryAgain}
                      className="w-full text-gray-600 hover:text-gray-800 font-medium py-2 transition-colors duration-200 text-sm"
                    >
                      Try different email
                    </motion.button>
                  </motion.div>

                  {/* Additional Help */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-6 p-3 bg-gray-50/80 border border-gray-200/60 rounded-lg"
                  >
                    <p className="text-xs text-gray-600">
                      <strong>Didn't receive the email?</strong><br />
                      Check your spam folder or contact support if the issue persists.
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            </motion.div>

          {/* Footer */}
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-gray-600"
          >
            <p>
              Need help? Contact{" "}
              <a href="#" className="text-gray-800 hover:text-gray-900 font-medium underline">
                support
              </a>
            </p>
          </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
