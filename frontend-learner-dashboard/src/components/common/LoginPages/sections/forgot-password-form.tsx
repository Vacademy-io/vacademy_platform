import { FormContainer } from "@/components/common/LoginPages/layout/form-container";
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

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPassword() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onTouched",
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onSuccess: async (response) => {
      if (response.status === "success") {
        toast.success("Password Sent Successfully", {
          className: "success-toast",
          duration: 2000,
        });

        sendResetLinkMutation.mutate();
      } else {
        toast.error("Login Error", {
          description: "This account doesn't exist",
          className: "error-toast",
          duration: 2000,
        });
        form.reset(); // Clear email field if request fails
      }
    },
    onError: () => {
      toast.error("Login Error", {
        description: "This account doesn't exist",
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

  return (
    <div>
      <FormContainer>
        <div className="flex w-full flex-col items-center justify-center gap-10 md:gap-8 lg:gap-6 px-4 md:px-8 lg:px-12 pt-14 lg:pt-20">
          <Heading
            heading="Forgot Account Credentials"
            subHeading="Enter your email, and we’ll send your credentials to your inbox."
          />
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
              <div className="flex w-full flex-col items-center justify-center gap-20 md:gap-25 lg:gap-30">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormControl>
                        <MyInput
                          inputType="email"
                          inputPlaceholder="you@email.com"
                          input={value}
                          onChangeFunction={onChange}
                          error={form.formState.errors.email?.message}
                          required={true}
                          size="large"
                          label="Email"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col items-center gap-4 md:gap-6 lg:gap-8 ">
                  <MyButton
                    type="submit"
                    scale="large"
                    buttonType="primary"
                    layoutVariant="default"
                  >
                    Get Credentials
                  </MyButton>
                    <div className="flex flex-col items-center font-regular">
                    <div className="text-neutral-500 text-sm md:text-base lg:text-base text-center">
                      Remembered your account details?
                    </div>
                    <MyButton
                      type="button"
                      scale="medium"
                      buttonType="text"
                      layoutVariant="default"
                      className="text-primary-500"
                      onClick={() => navigate({ to: "/login" })}
                    >
                      Back to Login
                    </MyButton>
                    </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </FormContainer>
    </div>
  );
}
