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
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Loader2 } from "lucide-react";

const instituteSelectionSchema = z.object({
  instituteId: z.string().nonempty("Please select an institute"),
});

type FormValues = z.infer<typeof instituteSelectionSchema>;
export function InstituteSelection() {
  const navigate = useNavigate();
  const { redirect } = useSearch<any>({ from: "/institute-selection/" });

  const form = useForm<FormValues>({
    resolver: zodResolver(instituteSelectionSchema),
    defaultValues: {
      instituteId: "",
    },
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
          toast.error("No token found");
          return;
        }
  
        const decodedData = await getTokenDecodedData(token);
        const authorities = decodedData?.authorities;
        const userId = decodedData?.user;
  
        if (!authorities || !userId) {
          toast.error("Invalid token data");
          return;
        }
  
        const instituteIds = Object.keys(authorities);
  
        const instituteList = await Promise.all(
          instituteIds.map(async (instituteId) => {
            try {
              const response = await authenticatedAxiosInstance({
                method: "GET",
                url: `${INSTITUTE_DETAIL}/${instituteId}`,
                params: {
                  instituteId,
                  userId,
                },
              });
  
              const data = response.data;
  
              return {
                label: data?.institute_name || instituteId, // Fallback if name is missing
                value: instituteId,
              };
            } catch (err) {
              console.error(`Error fetching details for ${instituteId}`, err);
              return {
                label: instituteId, // Fallback
                value: instituteId,
              };
            }
          })
        );
  
        setDropdownList(instituteList);
      } catch (error) {
        console.error("Error fetching institute list:", error);
        toast.error("Failed to fetch institute list");
      } finally {
        setIsLoadingInstitutes(false);
      }
    };
  
    fetchInstitutes();
  }, []);
  

  const onSubmit = async (data: FormValues) => {
    console.log("Form submitted with data:", data);
    if (!data.instituteId) {
      toast.error("Please select an institute.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Storing selected institute in storage...");
      // await setTokenInStorage("selectedInstitute", data.instituteId);

      const userId = await getTokenFromStorage(TokenKey.accessToken)
        .then(getTokenDecodedData)
        .then((data) => data?.user);

      if (!userId) {
        toast.error("Failed to retrieve user details.");
        return;
      }

      console.log("Fetching and storing institute details...");
      await fetchAndStoreInstituteDetails(data.instituteId, userId);
      console.log("Navigating to dashboard...");
      if (data.instituteId && userId) {
        try {
          await fetchAndStoreStudentDetails(data.instituteId, userId);
        } catch {
          // console.error("Error fetching details:");
          toast.error("Failed to fetch details");
          //   toast.error("Login Error", {
          //     description: "Failed to fetch details",
          //     className: "error-toast",
          //     duration: 3000,
          // });
        }
      } else {
        console.error("Institute ID or User ID is undefined");
      }
      navigate({
        to: "/SessionSelectionPage",
        search: { redirect: redirect },
      });
    } catch (error) {
      console.error("Error processing institute selection:", error);
      toast.error("Failed to process institute selection");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loader while fetching institutes
  if (isLoadingInstitutes) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-10 md:gap-8 lg:gap-6 px-4 md:px-8 lg:px-12">
        <Heading
          heading="Welcome, Student!"
          subHeading="Loading your institutes..."
        />
        <DashboardLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Selection Card */}
        <div className="glass-card rounded-2xl p-8 shadow-xl animate-scale-in opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
          {/* Header */}
          <div className="text-center space-y-4 mb-8 animate-fade-in-down opacity-0 [animation-delay:0.4s] [animation-fill-mode:forwards]">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <Heading
              heading="Select Your Institute"
              subHeading="Choose your institute to continue to your dashboard"
            />
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 animate-fade-in-up opacity-0 [animation-delay:0.6s] [animation-fill-mode:forwards]">
              <FormField
                control={form.control}
                name="instituteId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MyDropdown
                        {...field}
                        dropdownList={dropdownList.map(item => item.label)}
                        placeholder="Select your institute"
                        handleChange={(value) => {
                          const selectedItem = dropdownList.find(item => item.label === value);
                          field.onChange(selectedItem?.value || value);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex flex-col items-center gap-4 md:gap-6 lg:gap-8 justify-center">
                <MyButton
                  type="submit"
                  scale="large"
                  buttonType="primary"
                  layoutVariant="default"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Login to Institute"
                  )}
                </MyButton>
                <div className="flex flex-row font-regular items-center justify-center">
                  <div className="text-neutral-500 text-sm md:text-base lg:text-base text-center">
                    Want to Login with another account?
                    <MyButton
                      type="button"
                      scale="medium"
                      buttonType="text"
                      layoutVariant="default"
                      className="text-purple-600 hover:text-purple-700 transition-all duration-200 hover:scale-105"
                      onClick={() =>
                        navigate({
                          to: "/login",
                          search: { redirect: redirect },
                        })
                      }
                      disabled={isSubmitting}
                    >
                      Back to Login
                    </MyButton>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>

        {/* Info Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 animate-fade-in-up opacity-0 [animation-delay:1s] [animation-fill-mode:forwards]">
          <div className="text-center p-4 glass-card rounded-xl hover-lift">
            <div className="w-10 h-10 bg-purple-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium">Multi-Institute</p>
            <p className="text-xs text-gray-500 mt-1">Access multiple institutes</p>
          </div>
          <div className="text-center p-4 glass-card rounded-xl hover-lift">
            <div className="w-10 h-10 bg-purple-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium">Secure Access</p>
            <p className="text-xs text-gray-500 mt-1">Protected data</p>
          </div>
        </div>
      </div>
    </div>
  );
}