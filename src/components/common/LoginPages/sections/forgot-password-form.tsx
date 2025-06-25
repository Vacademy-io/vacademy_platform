
import { Heading } from "@/components/common/LoginPages/ui/heading";
import { MyInput } from "@/components/design-system/input";
import { forgotPasswordSchema } from "@/schemas/login/login";
import { z } from "zod";
import { forgotPassword } from "@/hooks/login/send-link-button";
import { sendResetLink } from "@/hooks/login/reset-link-click";
import { useMutation } from "@tanstack/react-query";
import { MyButton } from "@/components/design-system/button";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPassword() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onTouched",
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async (response) => {
      if (response.status === "success") {
        setEmailSent(true);
        toast.success("Credentials sent successfully", {
          className: "success-toast",
          duration: 2000,
        });

        sendResetLinkMutation.mutate();
      } else {
        toast.error("Account not found", {
          description: "This email address is not registered",
          className: "error-toast",
          duration: 2000,
        });
        form.reset(); // Clear email field if request fails
      }
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
      toast.error("Account not found", {
        description: "This email address is not registered",
        className: "error-toast",
        duration: 2000,
      });
    },
  });

  const sendResetLinkMutation = useMutation({
    mutationFn: sendResetLink,
    onSuccess: (response) => {
      if (response.status != "success") {
        toast.error("Failed to reset the password", {
          className: "error-toast",
          duration: 3000,
        });
      }
    },
    onError: () => {
      toast.error("Failed to reset the password", {
        className: "error-toast",
        duration: 3000,
      });
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Reset Card */}
        <div className="glass-card rounded-2xl p-8 shadow-xl animate-scale-in opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
          {/* Header */}
          <div className="text-center space-y-4 mb-8 animate-fade-in-down opacity-0 [animation-delay:0.4s] [animation-fill-mode:forwards]">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <Heading
              heading="Forgot Your Credentials?"
              subHeading={!emailSent ? "Enter your email to receive your login credentials" : "Check your email for credentials"}
            />
          </div>

          {!emailSent ? (
            <div className="animate-fade-in-up opacity-0 [animation-delay:0.6s] [animation-fill-mode:forwards]">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2 transform transition-all duration-300 hover:scale-[1.02]">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field: { onChange, value, ...field } }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative group">
                              <MyInput
                                inputType="email"
                                inputPlaceholder="you@example.com"
                                input={value}
                                onChangeFunction={onChange}
                                error={form.formState.errors.email?.message}
                                required={true}
                                size="large"
                                label="Email Address"
                                {...field}
                                className="w-full transition-all duration-300 focus:shadow-lg focus:shadow-orange-500/25 group-hover:shadow-md"
                              />
                              {/* Animated underline */}
                              <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300 group-focus-within:w-full" />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 pt-4">
                    <MyButton
                      type="submit"
                      scale="large"
                      buttonType="primary"
                      layoutVariant="default"
                      disabled={isLoading}
                      className="w-full relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] disabled:scale-100"
                    >
                      <span className={`transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                        Send Credentials
                      </span>
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                          </div>
                        </div>
                      )}
                    </MyButton>

                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-3">
                        Remember your credentials?
                      </p>
                      <MyButton
                        type="button"
                        scale="medium"
                        buttonType="text"
                        layoutVariant="default"
                        className="text-orange-600 hover:text-orange-700 transition-all duration-200 hover:scale-105"
                        onClick={() => navigate({ to: "/login" })}
                      >
                        Back to Login
                      </MyButton>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <div className="text-center space-y-6 animate-fade-in-up opacity-0 [animation-delay:0.6s] [animation-fill-mode:forwards]">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Email Sent!</h3>
                <p className="text-sm text-gray-600">
                  We've sent your login credentials to <span className="font-medium text-orange-600">{form.getValues().email}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Please check your inbox and spam folder
                </p>
              </div>

              <div className="space-y-3">
                <MyButton
                  type="button"
                  scale="large"
                  buttonType="primary"
                  layoutVariant="default"
                  className="w-full transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98]"
                  onClick={() => navigate({ to: "/login" })}
                >
                  Back to Login
                </MyButton>

                <MyButton
                  type="button"
                  scale="medium"
                  buttonType="text"
                  className="text-orange-600 hover:text-orange-700 transition-colors duration-200"
                  onClick={handleTryAgain}
                >
                  Try Different Email
                </MyButton>
              </div>
            </div>
          )}
        </div>

        {/* Help Info */}
        <div className="mt-6 text-center animate-fade-in-up opacity-0 [animation-delay:0.8s] [animation-fill-mode:forwards]">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Need help? Contact your administrator</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
