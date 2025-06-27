import { useState } from "react";
import { MyInput } from "@/components/design-system/input";

import { loginSchema } from "@/schemas/login/login";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { loginUser } from "@/hooks/login/login-button";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  getTokenDecodedData,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { useTheme } from "@/providers/theme/theme-provider";
type FormValues = z.infer<typeof loginSchema>;

interface UsernameLoginProps {
  onSwitchToEmail: () => void;
}
export function UsernameLogin({ onSwitchToEmail }: UsernameLoginProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  /* eslint-disable-next-line */
  const { redirect } = useSearch<any>({ from: "/login/" });
  const { setPrimaryColor } = useTheme();

  const form = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
    mode: "onTouched",
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      loginUser(values.username, values.password),
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async (response) => {
      if (response) {
        try {
          // Store tokens in Capacitor Storage
          await setTokenInStorage(TokenKey.accessToken, response.accessToken);
          await setTokenInStorage(TokenKey.refreshToken, response.refreshToken);

          // Decode token to get user data
          const decodedData = await getTokenDecodedData(response.accessToken);

          // Check authorities in decoded data
          const authorities = decodedData?.authorities;
          const userId = decodedData?.user;
          const authorityKeys = authorities ? Object.keys(authorities) : [];

          if (authorityKeys.length > 1) {
            // Redirect to InstituteSelection if multiple authorities are found
            navigate({
              to: "/institute-selection",
              search: { redirect: redirect || "/dashboard/" },
            });
          } else {
            // Get the single institute ID
            const instituteId = authorities
              ? Object.keys(authorities)[0]
              : undefined;

            if (instituteId && userId) {
              try {
                const details = await fetchAndStoreInstituteDetails(
                  instituteId,
                  userId
                );
                console.log("Institute color:", details?.institute_theme_code);
                setPrimaryColor(details?.institute_theme_code ?? "primary");
              } catch (error) {
                console.error("Error fetching institute details:", error);
              }
            } else {
              console.error("Institute ID or User ID is undefined");
            }

            if (instituteId && userId) {
              try {
                await fetchAndStoreStudentDetails(instituteId, userId);
              } catch {
                toast.error("Failed to fetch details");
              }
            } else {
              console.error("Institute ID or User ID is undefined");
            }

            // Redirect to SessionSelectionPage
            navigate({
              to: "/SessionSelectionPage",
              search: { redirect: redirect || "/dashboard" },
            });
          }
        } catch (error) {
          console.error("Error processing decoded data:", error);
        }
      } else {
        form.reset();
      }
    },
    onError: () => {
      setIsLoading(false);
      toast.error(
        "Login failed. Please check your username and password and try again."
      );
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <div className="w-full space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Username Field */}
          <div className="space-y-2 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
            <FormField
              control={form.control}
              name="username"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative group">
                      <MyInput
                        inputType="text"
                        inputPlaceholder="Enter your username"
                        input={value}
                        onChangeFunction={onChange}
                        error={form.formState.errors.username?.message}
                        required
                        size="large"
                        label="Username"
                        {...field}
                        className="w-full transition-all duration-300 border-gray-200/60 focus:border-orange-400 focus:ring-2 focus:ring-orange-100/50 rounded-2xl bg-gray-50/30 focus:bg-white font-light"
                      />
                      {/* Subtle focus indicator */}
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-orange-400 opacity-0 group-focus-within:opacity-30 transition-all duration-300 pointer-events-none"></div>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-orange-500 transition-colors duration-200 font-light"
                onClick={() => navigate({ to: "/login/forgot-password" })}
              >
                Forgot username?
              </button>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            <FormField
              control={form.control}
              name="password"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative group">
                      <MyInput
                        inputType="password"
                        inputPlaceholder="Enter your password"
                        input={value}
                        onChangeFunction={onChange}
                        error={form.formState.errors.password?.message}
                        required
                        size="large"
                        label="Password"
                        {...field}
                        className="w-full transition-all duration-300 border-gray-200/60 focus:border-orange-400 focus:ring-2 focus:ring-orange-100/50 rounded-2xl bg-gray-50/30 focus:bg-white font-light"
                      />
                      {/* Subtle focus indicator */}
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-orange-400 opacity-0 group-focus-within:opacity-30 transition-all duration-300 pointer-events-none"></div>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-orange-500 transition-colors duration-200 font-light"
                onClick={() => navigate({ to: "/login/forgot-password" })}
              >
                Forgot password?
              </button>
            </div>
          </div>

          {/* Login Button */}
          <div className="pt-4 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-light py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-lg hover:shadow-xl text-base tracking-wide"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="font-light">Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>
      </Form>

      {/* Switch to Email Login */}
      <div className="text-center pt-6 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
        <button
          type="button"
          className="text-sm text-gray-400 hover:text-orange-500 transition-colors duration-200 relative group font-light"
          onClick={onSwitchToEmail}
        >
          Prefer email login?
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-orange-500 transition-all duration-300 group-hover:w-full"></span>
        </button>
      </div>
    </div>
  );
}
