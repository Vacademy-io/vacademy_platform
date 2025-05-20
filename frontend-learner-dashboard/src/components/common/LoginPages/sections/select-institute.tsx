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

  useEffect(() => {
    const fetchInstitutes = async () => {
      try {
        console.log("Fetching institutes...");
        const token = await getTokenFromStorage(TokenKey.accessToken);
        if (!token) {
          console.error("No token found in storage.");
          return;
        }

        const decodedData = await getTokenDecodedData(token);
        const authorities = decodedData?.authorities;
        if (!authorities) {
          toast.error("No authorities found in token.");
          return;
        }

        const instituteList = Object.keys(authorities).map((key) => ({
          label: key,
          value: key,
        }));

        setDropdownList(instituteList);
      } catch (error) {
        console.error("Error fetching institute list:", error);
        toast.error("Failed to fetch institutes");
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
    }
  };

  return (
    <div className="flex w-full flex-col items-center justify-center gap-10 md:gap-8 lg:gap-6 px-4 md:px-8 lg:px-12">
      <Heading
        heading="Welcome, Student!"
        subHeading="Select your Institute to proceed."
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
          <div className="flex w-full flex-col items-center justify-center gap-10 md:gap-15 lg:gap-20">
            <FormField
              control={form.control}
              name="instituteId"
              render={() => (
                <FormItem>
                  <FormControl>
                    <MyDropdown
                      dropdownList={
                        dropdownList.length > 0
                          ? dropdownList.map((item) => item.label)
                          : []
                      }
                      placeholder="Select an Institute"
                      handleChange={(selectedLabel) => {
                        const selectedInstitute = dropdownList.find(
                          (item) => item.label === selectedLabel
                        );
                        form.setValue(
                          "instituteId",
                          selectedInstitute?.value || ""
                        );
                      }}
                      currentValue={
                        dropdownList.find(
                          (item) => item.value === form.watch("instituteId")
                        )?.label || ""
                      }
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
              >
                Login to Institute
              </MyButton>
              <div className="flex flex-row font-regular items-center justify-center">
                <div className="text-neutral-500 text-sm md:text-base lg:text-base text-center">
                  Want to Login with another account?
                  <MyButton
                    type="button"
                    scale="medium"
                    buttonType="text"
                    layoutVariant="default"
                    className="text-primary-500"
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
        </form>
      </Form>
    </div>
  );
}
