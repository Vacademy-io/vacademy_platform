// add-subject-form.tsx
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormLabel,
} from '@/components/ui/form';
import { SubjectType } from '@/stores/study-library/use-study-library-store';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useState, useRef } from 'react';
import { getInstituteId } from '@/constants/helper';
import { Input } from '@/components/ui/input';
import { ImageSquare, X } from '@phosphor-icons/react';

const formSchema = z.object({
    subjectName: z.string().min(1, 'Subject name is required'),
    imageFile: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSubjectFormProps {
    onSubmitSuccess: (subject: SubjectType) => void;
    initialValues?: SubjectType;
}

export const AddSubjectForm = ({ onSubmitSuccess, initialValues }: AddSubjectFormProps) => {
    const { uploadFile } = useFileUpload();
    const instituteId = getInstituteId();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedImageId, setUploadedImageId] = useState<string>(
        initialValues?.thumbnail_id || ''
    );
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            subjectName: initialValues?.subject_name || '',
            imageFile: null,
        },
    });

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            // Create preview URL
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const clearSelectedFile = () => {
        setSelectedFile(null);
        setPreviewUrl('');
        setUploadedImageId('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const onSubmit = async (data: FormValues) => {
        let thumbnailId = uploadedImageId;

        // Upload image if a new file is selected
        if (selectedFile) {
            try {
                setIsUploading(true);
                const fileId = await uploadFile({
                    file: selectedFile,
                    setIsUploading: setIsUploading,
                    userId: 'user-id',
                    source: instituteId,
                    sourceId: 'SUBJECT_IMAGE',
                });
                thumbnailId = fileId || '';
            } catch (error) {
                console.error('Failed to upload image:', error);
                setIsUploading(false);
                return;
            }
        }

        const newSubject: SubjectType = {
            id: initialValues?.id || crypto.randomUUID(),
            subject_name: data.subjectName,
            subject_code: '',
            credit: 0,
            thumbnail_id: thumbnailId || null,
            created_at: initialValues?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        onSubmitSuccess(newSubject);
        setIsUploading(false);
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
                                    label={`${getTerminology(
                                        ContentTerms.Subjects,
                                        SystemTerms.Subjects
                                    )} Name`}
                                    required={true}
                                    inputType="text"
                                    inputPlaceholder={`Enter ${getTerminology(
                                        ContentTerms.Subjects,
                                        SystemTerms.Subjects
                                    )} name`}
                                    className="w-[352px]"
                                    input={field.value}
                                    onChangeFunction={(e) => field.onChange(e.target.value)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Image Upload Section */}
                <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                        {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)} Image
                        (Optional)
                    </FormLabel>
                    <div className="space-y-3">
                        {/* File Input */}
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Upload Button or Preview */}
                        {!previewUrl ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50"
                            >
                                <ImageSquare size={32} className="mx-auto mb-2 text-gray-400" />
                                <p className="mb-1 text-sm text-gray-600">
                                    Click to upload an image
                                </p>
                                <p className="text-xs text-gray-400">PNG, JPG, GIF up to 10MB</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="h-32 w-full rounded-lg border object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={clearSelectedFile}
                                    className="absolute right-2 top-2 rounded-full bg-red-100 p-1 transition-colors hover:bg-red-200"
                                >
                                    <X size={16} className="text-red-600" />
                                </button>
                            </div>
                        )}
                    </div>
                </FormItem>

                <div className="flex items-start gap-6">
                    <MyButton
                        type="submit"
                        buttonType="primary"
                        layoutVariant="default"
                        scale="large"
                        disabled={isUploading}
                    >
                        {isUploading ? 'Uploading...' : initialValues ? 'Save Changes' : 'Add'}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
