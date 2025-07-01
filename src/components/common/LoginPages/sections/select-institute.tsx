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
      console.log("[InstituteSelection] Fetching institutes...");
      setIsLoadingInstitutes(true);
      try {
        const token = await getTokenFromStorage(TokenKey.accessToken);
        console.log("[InstituteSelection] Retrieved token:", token);

        if (!token) {
          toast.error("No token found - Please login first");
          setIsLoadingInstitutes(false);
          return;
        }

        const decodedData = await getTokenDecodedData(token);
        console.log("[InstituteSelection] Decoded token data:", decodedData);

        const authorities = decodedData?.authorities;
        const userId = decodedData?.user;

        if (!authorities || !userId) {
          toast.error("Invalid token data - Please login again");
          setIsLoadingInstitutes(false);
          return;
        }

        const instituteIds = Object.keys(authorities);
        console.log("[InstituteSelection] Institute IDs found:", instituteIds);

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
              console.log(`[InstituteSelection] Data for ${instituteId}:`, data);

              return {
                label: data?.institute_name || instituteId,
                value: instituteId,
              };
            } catch (err) {
              console.error(`[InstituteSelection] Error fetching ${instituteId}:`, err);
              return {
                label: instituteId,
                value: instituteId,
              };
            }
          })
        );

        console.log("[InstituteSelection] Final dropdown list:", instituteList);
        setDropdownList(instituteList);
      } catch (error) {
        console.error("[InstituteSelection] Error fetching institute list:", error);
        toast.error("Failed to fetch institute list");
      } finally {
        setIsLoadingInstitutes(false);
        console.log("[InstituteSelection] Institute loading complete.");
      }
    };

    fetchInstitutes();
  }, []);

  const onSubmit = async (data: FormValues) => {
    console.log("[InstituteSelection] Submitting form with data:", data);

    if (!data.instituteId) {
      toast.error("Please select an institute.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = await getTokenFromStorage(TokenKey.accessToken)
        .then(getTokenDecodedData)
        .then((data) => data?.user);

      console.log("[InstituteSelection] userId:", userId);

      if (!userId) {
        toast.error("Failed to retrieve user details.");
        return;
      }

      console.log(`[InstituteSelection] Storing details for institute ${data.instituteId}...`);
      await fetchAndStoreInstituteDetails(data.instituteId, userId);
      console.log("[InstituteSelection] Institute details stored successfully.");

      try {
        console.log("[InstituteSelection] Fetching student details...");
        await fetchAndStoreStudentDetails(data.instituteId, userId);
        console.log("[InstituteSelection] Student details fetched.");
      } catch (err) {
        console.error("[InstituteSelection] Failed to fetch student details:", err);
        toast.error("Failed to fetch details");
      }

      console.log("[InstituteSelection] Navigating to SessionSelectionPage...");
      navigate({
        to: "/SessionSelectionPage",
        search: { redirect: redirect },
      });
    } catch (error) {
      console.error("[InstituteSelection] Error in form submission:", error);
      toast.error("Failed to process institute selection");
    } finally {
      setIsSubmitting(false);
      console.log("[InstituteSelection] Submission process ended.");
    }
  };

  if (isLoadingInstitutes) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="flex w-full flex-col items-center justify-center gap-10 md:gap-8 lg:gap-6 px-4 md:px-8 lg:px-12">
          <Heading
            heading="Welcome, Student!"
            subHeading="Loading your institutes..."
          />
          <DashboardLoader />
        </div>
      </div>
    );
  }

  if (!isLoadingInstitutes && dropdownList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto">
          <div className="glass-card rounded-2xl p-8 md:p-10 lg:p-12 xl:p-16 shadow-xl text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <Heading
              heading="No Institutes Available"
              subHeading="You don't have access to any institutes. Please contact your administrator or login with a different account."
            />
            <div className="mt-6">
              <MyButton
                type="button"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                onClick={() =>
                  navigate({
                    to: "/login",
                    search: { redirect: redirect },
                  })
                }
              >
                Back to Login
              </MyButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto">
        <div className="glass-card rounded-2xl p-8 md:p-10 lg:p-12 xl:p-16 shadow-xl animate-scale-in [animation-delay:0.2s] [animation-fill-mode:forwards]">
          <div className="text-center space-y-4 md:space-y-6 mb-8 md:mb-10 lg:mb-12 animate-fade-in-down [animation-delay:0.4s] [animation-fill-mode:forwards]">
            <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <Heading
              heading="Select Your Institute"
              subHeading="Choose your institute to continue to your dashboard"
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8 lg:space-y-10 animate-fade-in-up [animation-delay:0.6s] [animation-fill-mode:forwards]">
              <FormField
                control={form.control}
                name="instituteId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="w-full max-w-md mx-auto">
                        <MyDropdown
                          {...field}
                          dropdownList={dropdownList.map(item => item.label)}
                          placeholder="Select your institute"
                          handleChange={(value) => {
                            const selectedItem = dropdownList.find(item => item.label === value);
                            field.onChange(selectedItem?.value || value);
                          }}
                        />
                      </div>
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

        <div className="mt-6 md:mt-8 lg:mt-10 grid grid-cols-2 gap-4 md:gap-6 lg:gap-8 max-w-md mx-auto animate-fade-in-up [animation-delay:1s] [animation-fill-mode:forwards]">
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
