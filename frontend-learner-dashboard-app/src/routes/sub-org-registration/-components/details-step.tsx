import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Buildings, Image as ImageIcon, Trash, SpinnerGap } from "@phosphor-icons/react";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import PhoneInputField from "@/components/design-system/phone-input-field";
import { useFileUpload } from "@/hooks/use-file-upload";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { isBlankPhone, isValidPhoneValue } from "@/lib/phone-validation";
import { cn } from "@/lib/utils";

const detailsSchema = z.object({
  orgName: z.string().trim().min(1, "Organization name is required"),
  adminName: z.string().trim().min(1, "Admin name is required"),
  adminEmail: z
    .string()
    .trim()
    .min(1, "Admin email is required")
    .email("Enter a valid email address"),
  adminPhone: z
    .string()
    .optional()
    .refine(
      (v) => !v || isBlankPhone(v) || isValidPhoneValue(v),
      "Enter a valid phone number for the selected country"
    ),
});

export type DetailsFormValues = z.infer<typeof detailsSchema>;

export interface DetailsStepValues extends DetailsFormValues {
  orgLogoFileId: string | null;
}

interface DetailsStepProps {
  /** Previously entered values (edit-details flow) */
  initialValues?: DetailsStepValues | null;
  onSubmit: (values: DetailsStepValues) => void;
  isSubmitting: boolean;
}

/** Step 1 — organization + admin details, POSTs /start on continue. */
const DetailsStep = ({ initialValues, onSubmit, isSubmitting }: DetailsStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFilePublic, isUploading } = useFileUpload();
  const [logoFileId, setLogoFileId] = useState<string | null>(
    initialValues?.orgLogoFileId ?? null
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const form = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      orgName: initialValues?.orgName ?? "",
      adminName: initialValues?.adminName ?? "",
      adminEmail: initialValues?.adminEmail ?? "",
      adminPhone: initialValues?.adminPhone ?? "",
    },
    mode: "onTouched",
  });

  // Restore the logo preview when re-entering via "Edit Details" (the local
  // object URL from the original upload does not survive the remount).
  useEffect(() => {
    const initialFileId = initialValues?.orgLogoFileId;
    if (!initialFileId) return;
    let cancelled = false;
    getPublicUrlWithoutLogin(initialFileId)
      .then((url) => {
        if (!cancelled && url) {
          setLogoPreviewUrl((current) => current ?? url);
        }
      })
      .catch(() => {
        // Preview is cosmetic — the fileId is still attached to the payload.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file for the logo");
      e.target.value = "";
      return;
    }

    try {
      const fileId = await uploadFilePublic({
        file,
        source: "SUB_ORG_REGISTRATION",
        sourceId: "ORG_LOGO",
      });
      if (fileId) {
        setLogoFileId(fileId);
        setLogoPreviewUrl(URL.createObjectURL(file));
      } else {
        toast.error("Logo upload failed. Please try again");
      }
    } catch (error) {
      console.error("Logo upload error:", error);
      toast.error("Logo upload failed. Please try again");
    } finally {
      e.target.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoFileId(null);
    setLogoPreviewUrl(null);
  };

  const handleSubmit = (values: DetailsFormValues) => {
    onSubmit({ ...values, orgLogoFileId: logoFileId });
  };

  return (
    <ModernCard
      variant="glass"
      padding="lg"
      rounded="lg"
      className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
    >
      <div className="mb-5 flex items-start gap-2 sm:gap-3">
        <div className="flex-shrink-0 rounded-lg bg-primary-50 p-1.5 sm:p-2">
          <Buildings className="size-5 text-primary-500 sm:size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-neutral-700">
            Organization Details
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Tell us about your organization and its admin
          </p>
        </div>
      </div>

      <Separator className="mb-5" />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex w-full flex-col gap-5"
        >
          <FormField
            control={form.control}
            name="orgName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <MyInput
                    label="Organization Name"
                    inputType="text"
                    inputPlaceholder="e.g. Acme Coaching Center"
                    input={field.value}
                    onChangeFunction={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    required
                    size="large"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Organization logo (optional) */}
          <div className="flex flex-col gap-1">
            <span className="text-subtitle font-regular">Organization Logo</span>
            <div className="flex items-center gap-3">
              {logoPreviewUrl ? (
                <img
                  src={logoPreviewUrl}
                  alt="Organization logo preview"
                  className="size-16 rounded-lg border border-neutral-200 bg-white object-contain"
                />
              ) : (
                <div
                  className={cn(
                    "flex size-16 items-center justify-center rounded-lg border border-dashed",
                    "border-neutral-300 bg-neutral-50 text-neutral-400"
                  )}
                >
                  {isUploading ? (
                    <SpinnerGap className="size-6 animate-spin" />
                  ) : (
                    <ImageIcon className="size-6" />
                  )}
                </div>
              )}
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="default"
                    onClick={() => fileInputRef.current?.click()}
                    disable={isUploading || isSubmitting}
                  >
                    {isUploading
                      ? "Uploading..."
                      : logoFileId
                        ? "Change Logo"
                        : "Upload Logo"}
                  </MyButton>
                  {logoFileId && !isUploading && (
                    <MyButton
                      type="button"
                      buttonType="text"
                      scale="small"
                      layoutVariant="default"
                      onClick={handleRemoveLogo}
                      className="!text-danger-600"
                    >
                      <Trash className="mr-1 size-4" />
                      Remove
                    </MyButton>
                  )}
                </div>
                <p className="text-caption text-neutral-400">
                  Optional — PNG or JPG works best
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          <Separator />

          <FormField
            control={form.control}
            name="adminName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <MyInput
                    label="Admin Full Name"
                    inputType="text"
                    inputPlaceholder="Full name of the org admin"
                    input={field.value}
                    onChangeFunction={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    required
                    size="large"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adminEmail"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <MyInput
                    label="Admin Email"
                    inputType="email"
                    inputPlaceholder="admin@yourorg.com"
                    input={field.value}
                    onChangeFunction={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    required
                    size="large"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <p className="-mt-4 text-caption text-neutral-400">
            We&apos;ll send a verification code to this email
          </p>

          <PhoneInputField
            label="Admin Phone"
            placeholder="123 456 7890"
            name="adminPhone"
            control={form.control}
            required={false}
          />

          <div className="mt-2 flex justify-end">
            <MyButton
              type="submit"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              disable={isSubmitting || isUploading}
              className="w-full min-w-32 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <SpinnerGap className="mr-2 size-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                "Continue"
              )}
            </MyButton>
          </div>
        </form>
      </Form>
    </ModernCard>
  );
};

export default DetailsStep;
