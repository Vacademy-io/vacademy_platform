// add-subject-form.tsx
import { SubjectDefaultImage } from "@/assets/svgs";
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRef, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import { useFileUpload } from "@/hooks/use-file-upload";
import { FileUploadComponent } from "@/components/design-system/file-upload";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

const formSchema = z.object({
    subjectName: z.string().min(1, "Subject name is required"),
    imageFile: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSubjectFormProps {
    onSubmitSuccess: (subject: SubjectType) => void;
    initialValues?: SubjectType;
}

export const AddSubjectForm = ({ onSubmitSuccess, initialValues }: AddSubjectFormProps) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile, getPublicUrl, isUploading: isUploadingFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileId, setFileId] = useState<string | null>(initialValues?.thumbnail_id || null);
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            subjectName: initialValues?.subject_name || "",
            imageFile: null,
        },
    });

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            const uploadedFileId = await uploadFile({
                file,
                setIsUploading,
                userId: "your-user-id",
                source: INSTITUTE_ID,
                sourceId: "SUBJECTS",
            });

            if (uploadedFileId) {
                setFileId(uploadedFileId);
                // Get public URL only for preview purposes
                const publicUrl = await getPublicUrl(uploadedFileId);
                setPreviewUrl(publicUrl);
            }
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = (data: FormValues) => {
        const newSubject: SubjectType = {
            id: initialValues?.id || crypto.randomUUID(),
            subject_name: data.subjectName,
            subject_code: "",
            credit: 0,
            thumbnail_id: fileId, // Use fileId instead of URL
            created_at: initialValues?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        onSubmitSuccess(newSubject);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex w-full flex-col gap-6 text-neutral-600"
            >
                <FormField
                    control={form.control}
                    name="subjectName"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    label="Subject"
                                    required={true}
                                    inputType="text"
                                    inputPlaceholder="Enter subject name"
                                    className="w-[352px]"
                                    input={field.value}
                                    onChangeFunction={(e) => field.onChange(e.target.value)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex flex-col gap-6">
                    <div className="relative flex w-full flex-col items-center justify-center gap-3">
                        {isUploading ? (
                            <div className="inset-0 flex h-[200px] w-[200px] items-center justify-center bg-white">
                                <DashboardLoader />
                            </div>
                        ) : previewUrl ? (
                            <img
                                src={previewUrl}
                                alt="Subject"
                                className="h-[200px] w-[200px] rounded-lg object-cover"
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

                    <MyButton
                        type="submit"
                        buttonType="primary"
                        layoutVariant="default"
                        scale="large"
                    >
                        {initialValues ? "Save Changes" : "Add"}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
