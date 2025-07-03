import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { MyDropdown } from "@/components/design-system/dropdown";
import { MyButton } from "@/components/design-system/button";
import { Heading } from "@/components/common/LoginPages/ui/heading";
import {
  getTokenDecodedData,
  getTokenFromStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { z } from "zod";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { useSearch } from "@tanstack/react-router";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { INSTITUTE_DETAIL } from "@/constants/urls";
import { motion } from "framer-motion";
import { RefreshCw, Shield } from "lucide-react";
import { DashboardLoader } from "@/components/core/dashboard-loader";

const instituteSelectionSchema = z.object({
  instituteId: z.string().nonempty("Please select an institute"),
});

type FormValues = z.infer<typeof instituteSelectionSchema>;

export function InstituteSelection() {
  const navigate = useNavigate();
  const { redirect } = useSearch<any>({ from: "/institute-selection/" });

  const form = useForm<FormValues>({
    resolver: zodResolver(instituteSelectionSchema),
    defaultValues: { instituteId: "" },
    mode: "onTouched",
  });

  const [dropdownList, setDropdownList] = useState<
    { label: string; value: string }[]
  >([]);
  const [isLoadingInstitutes, setIsLoadingInstitutes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchInstitutes = async () => {
      setIsLoadingInstitutes(true);
      try {
        const token = await getTokenFromStorage(TokenKey.accessToken);
        if (!token) {
          toast.error("No token found - Please login first");
          return;
        }
  
        const decodedData = await getTokenDecodedData(token);
        const authorities = decodedData?.authorities;
        const userId = decodedData?.user;

        if (!authorities || !userId) {
          toast.error("Invalid token data - Please login again");
          return;
        }

        const instituteIds = Object.keys(authorities);
        const instituteList = await Promise.all(
          instituteIds.map(async (instituteId) => {
            try {
              const response = await authenticatedAxiosInstance({
                method: "GET",
                url: `${INSTITUTE_DETAIL}/${instituteId}`,
                params: { instituteId, userId },
              });
              const data = response.data;
              return {
                label: data?.institute_name || instituteId,
                value: instituteId,
              };
            } catch {
              return {
                label: instituteId,
                value: instituteId,
              };
            }
          })
        );

        setDropdownList(instituteList);
      } catch {
        toast.error("Failed to fetch institute list");
      } finally {
        setIsLoadingInstitutes(false);
      }
    };
  
    fetchInstitutes();
  }, []);
  

  const onSubmit = async (data: FormValues) => {
    if (!data.instituteId) {
      toast.error("Please select an institute.");
      return;
    }
    setIsSubmitting(true);
    try {
      const userId = await getTokenFromStorage(TokenKey.accessToken)
        .then(getTokenDecodedData)
        .then((data) => data?.user);

      if (!userId) {
        toast.error("Failed to retrieve user details.");
        return;
      }

      await fetchAndStoreInstituteDetails(data.instituteId, userId);
      try {
        await fetchAndStoreStudentDetails(data.instituteId, userId);
      } catch {
        toast.error("Failed to fetch student details");
      }

      navigate({
        to: "/SessionSelectionPage",
        search: { redirect: redirect },
      });
    } catch {
      toast.error("Failed to process institute selection");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInstitutes) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 z-50">
        <DashboardLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 relative overflow-hidden">
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -10, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-20 w-48 h-48 bg-gradient-to-br from-gray-200/10 to-gray-300/10 rounded-full blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-7">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gray-900 rounded-lg mx-auto flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <Heading heading="Select Your Institute" subHeading="Choose your institute to continue" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="instituteId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MyDropdown
                        {...field}
                        dropdownList={dropdownList.map((item) => item.label)}
                        placeholder="Select your institute"
                        handleChange={(value) => {
                          const selectedItem = dropdownList.find((item) => item.label === value);
                          field.onChange(selectedItem?.value || value);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.div>
                    <span className="text-sm">Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Login to Institute</span>
                  </div>
                )}
              </motion.button>
            </form>
          </Form>

          <div className="text-center mt-6 text-sm">
            <span className="text-neutral-500">Want to login with another account?</span>
            <MyButton
              type="button"
              scale="medium"
              buttonType="text"
              layoutVariant="default"
              className="text-gray-700 hover:text-black hover:underline ml-1"
              onClick={() => navigate({ to: "/login", search: { redirect } })}
              disabled={isSubmitting}
            >
              Back to Login
            </MyButton>
          </div>

          {/* Footer Cards Inside Main Card */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-700"
          >
            <div className="text-center p-4 glass-card rounded-xl hover-lift">
              <div className="w-10 h-10 bg-gray-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
<svg
  xmlns="http://www.w3.org/2000/svg"
  className="w-5 h-5 text-gray-700"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  viewBox="0 0 24 24"
>
  {/* Left shoulder/torso */}
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
  />
  {/* Left head */}
  <circle cx="9" cy="7" r="4" />
  {/* Right shoulder/torso */}
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M23 21v-2a4 4 0 00-3-3.87"
  />
  {/* Right head */}
  <circle cx="17" cy="7" r="4" />
</svg>


              </div>
              <p className="font-medium">Multi-Institute</p>
              <p className="text-xs text-gray-500">Access multiple institutes</p>
            </div>
            <div className="text-center p-4 glass-card rounded-xl hover-lift">
              <div className="w-10 h-10 bg-gray-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                <svg className="w-5 h-5 text-black-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="font-medium">Secure Access</p>
              <p className="text-xs text-gray-500">Protected data</p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
