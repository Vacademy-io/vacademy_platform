// add-modules-form.tsx
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { Module } from "@/stores/study-library/use-modules-with-chapters-store";
import { useRef, useState } from "react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { FileUploadComponent } from "@/components/design-system/file-upload";
import { SubjectDefaultImage } from "@/assets/svgs";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

const formSchema = z.object({
    moduleName: z.string().min(1, "Module name is required"),
    description: z.string().optional(),
    imageFile: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddModulesFormProps {
    initialValues?: Module;
    onSubmitSuccess: (module: Module) => void;
}

export const AddModulesForm = ({ initialValues, onSubmitSuccess }: AddModulesFormProps) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile, getPublicUrl, isUploading: isUploadingFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
    const [imageId, setImageId] = useState<string | null>(initialValues?.thumbnail_id || null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            moduleName: initialValues?.module_name || "",
            description: initialValues?.description || "",
            imageFile: null,
        },
    });

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            const fileId = await uploadFile({
                file,
                setIsUploading,
                userId: "your-user-id",
                source: INSTITUTE_ID,
                sourceId: "MODULES",
            });

            if (fileId) {
                setImageId(fileId);
                const publicUrl = await getPublicUrl(fileId);
                setImageUrl(publicUrl);
            }
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = (data: FormValues) => {
        const newModule = {
            id: initialValues?.id || "",
            module_name: data.moduleName,
            description: data.description || "",
            status: "",
            thumbnail_id: imageId || "",
        };
        onSubmitSuccess(newModule);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex w-full flex-col gap-6 text-neutral-600"
            >
                <FormField
                    control={form.control}
                    name="moduleName"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    label="Module Name"
                                    required={true}
                                    inputType="text"
                                    inputPlaceholder="Enter Module Name"
                                    className="w-[352px]"
                                    input={field.value}
                                    onChangeFunction={(e) => field.onChange(e.target.value)}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <div className="relative flex w-full flex-col items-center justify-center gap-3">
                    {isUploading ? (
                        <div className="inset-0 flex h-[150px] w-[150px] items-center justify-center bg-white">
                            <DashboardLoader />
                        </div>
                    ) : imageUrl ? (
                        <img
                            src={imageUrl}
                            alt="Module"
                            className="h-[150px] w-[150px] rounded-lg object-cover"
                        />
                    ) : (
                        <SubjectDefaultImage />
                    )}
                    <FileUploadComponent
                        fileInputRef={fileInputRef}
                        onFileSubmit={handleFileSubmit}
                        control={form.control}
                        name="imageFile"
                        acceptedFileTypes="image/*"
                    />
                    <div
                        className={`flex w-full flex-col items-center gap-3 ${
                            isUploading ? "hidden" : "visible"
                        }`}
                    >
                        {/* <div className="w-full flex gap-6 items-end">
                                <MyInput
                                    label="Image link"
                                    inputPlaceholder="Paste link to an image..."
                                    inputType="text"
                                    className="w-[300px]"
                                    input={imageUrl}
                                    onChangeFunction={handleImageUrlChange}
                                />
                                <MyButton
                                   onClick={() => fileInputRef.current?.click()}
                                   disabled={isUploading || isUploadingFile}
                                   buttonType="primary"
                                   layoutVariant="icon"
                                   scale="small"
                                   type="button"
                                   className="mb-2"
                                >
                                    <Check />
                                </MyButton>
                            </div>
                            <p>OR</p> */}
                        <MyButton
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isUploadingFile}
                            buttonType="secondary"
                            layoutVariant="default"
                            scale="large"
                            type="button"
                        >
                            Upload Image
                        </MyButton>
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    label="Description"
                                    inputType="text"
                                    inputPlaceholder="Briefly describe module"
                                    className="w-[352px]"
                                    input={field.value}
                                    onChangeFunction={(e) => field.onChange(e.target.value)}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <div className="w-full px-6 py-4">
                    <MyButton
                        type="submit"
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        className="w-full"
                    >
                        {initialValues ? "Save Changes" : "Add"}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
