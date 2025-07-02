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
import { motion } from "framer-motion";
import { User, Lock, RefreshCw, Shield, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { VscError } from "react-icons/vsc";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="w-full space-y-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Username Field */}
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
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
                        className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                      />
                      <User className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </motion.div>

          {/* Password Field */}
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <div className="relative">
                        {/* Custom input wrapper to override MyInput's password behavior */}
                        <div className="flex flex-col gap-1">
                          <Label className="text-subtitle font-regular">
                            Password
                            <span className="text-subtitle text-danger-600">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="h-10 py-2 px-3 text-subtitle w-full border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-20 text-neutral-600 shadow-none placeholder:text-body placeholder:font-regular hover:border-primary-200 focus:border-primary-500"
                              value={value}
                              onChange={onChange}
                              required
                              {...field}
                            />
                            {/* Custom password toggle and lock icon */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-gray-400 hover:text-gray-600 transition-colors duration-200 z-10"
                              >
                                {showPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </motion.button>
                              <Lock className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                          {form.formState.errors.password?.message && (
                            <div className="flex items-center gap-1 pl-1 text-body font-regular text-danger-600">
                              <VscError />
                              <span className="mt-[3px]">{form.formState.errors.password.message}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                onClick={() => navigate({ to: "/login/forgot-password" })}
              >
                Forgot password?
              </motion.button>
            </div>
          </motion.div>

          {/* Login Button */}
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="pt-1"
          >
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
                  <span className="text-sm">Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Sign In</span>
                </div>
              )}
            </motion.button>
          </motion.div>
        </form>
      </Form>

      {/* Switch to Email Login */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center pt-3"
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 relative group font-medium"
          onClick={onSwitchToEmail}
        >
          Prefer email login?
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-700 transition-all duration-200 group-hover:w-full"></span>
        </motion.button>
      </motion.div>
    </div>
  );
}
