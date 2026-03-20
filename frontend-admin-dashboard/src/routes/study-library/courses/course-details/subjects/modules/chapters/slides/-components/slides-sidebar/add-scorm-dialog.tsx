'use client';

import type React from 'react';

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
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useSlidesMutations } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { toast } from 'sonner';
import { Route } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/index';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useState } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';
import { Textarea } from '@/components/ui/textarea';
import { Package } from '@phosphor-icons/react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { SCORM_UPLOAD } from '@/constants/urls';

const formSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    scormFile: z.instanceof(File, { message: 'SCORM zip file is required' }),
});

type FormValues = z.infer<typeof formSchema>;

interface ScormUploadResponse {
    id: string;
    launch_path: string;
    original_file_id: string;
    scorm_version: string;
}

export const AddScormDialog = ({ openState }: { openState?: (open: boolean) => void }) => {
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } = Route.useSearch();
    const { addUpdateScormSlide, updateSlideOrder } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );

    const { setActiveItem, getSlideById, items } = useContentStore();
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const [scormUploadResult, setScormUploadResult] = useState<ScormUploadResponse | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
        },
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.zip')) {
                toast.error('Please select a .zip file');
                return;
            }
            setSelectedFile(file);
            form.setValue('scormFile', file);
            form.setValue('title', file.name.replace(/\.zip$/i, ''));

            // Immediately upload the SCORM package
            await uploadScormPackage(file);
        }
    };

    const uploadScormPackage = async (file: File) => {
        try {
            setUploadProgress('Uploading SCORM package...');
            const formData = new FormData();
            formData.append('file', file);

            const response = await authenticatedAxiosInstance.post(SCORM_UPLOAD, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const result: ScormUploadResponse = response.data;
            setScormUploadResult(result);
            setUploadProgress(
                `Uploaded successfully! SCORM ${result.scorm_version} package detected.`
            );
            toast.success('SCORM package uploaded & parsed successfully!');
        } catch (err) {
            console.error('SCORM upload failed:', err);
            setUploadProgress('');
            setScormUploadResult(null);
            toast.error('Failed to upload SCORM package');
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.zip')) {
            setSelectedFile(file);
            form.setValue('scormFile', file);
            form.setValue('title', file.name.replace(/\.zip$/i, ''));
            await uploadScormPackage(file);
        } else {
            toast.error('Please drop a .zip file');
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const reorderSlidesAfterNewSlide = async (newSlideId: string) => {
        try {
            const currentSlides = items || [];
            const newSlide = currentSlides.find((slide) => slide.id === newSlideId);
            if (!newSlide) return;

            const reorderedSlides = [
                { slide_id: newSlideId, slide_order: 0 },
                ...currentSlides
                    .filter((slide) => slide.id !== newSlideId)
                    .map((slide, index) => ({
                        slide_id: slide.id,
                        slide_order: index + 1,
                    })),
            ];

            await updateSlideOrder({
                chapterId: chapterId || '',
                slideOrderPayload: reorderedSlides,
            });

            setTimeout(() => {
                setActiveItem(getSlideById(newSlideId));
            }, 500);
        } catch (error) {
            toast.error('Slide created but reordering failed');
        }
    };

    const handleSubmit = async (data: FormValues) => {
        if (!scormUploadResult) {
            toast.error('Please wait for the SCORM package upload to complete');
            return;
        }

        try {
            setIsUploading(true);

            const slideId = crypto.randomUUID();
            const slideStatus = getSlideStatusForUser();
            const response = await addUpdateScormSlide({
                id: slideId,
                title: data.title,
                description: data.description || null,
                status: slideStatus as 'DRAFT' | 'PUBLISHED',
                slide_order: 0,
                new_slide: true,
                scorm_slide: {
                    id: scormUploadResult.id,
                },
            });

            if (response) {
                await reorderSlidesAfterNewSlide(slideId);
                openState?.(false);
                toast.success('SCORM slide created successfully!');
            }

            form.reset();
            setSelectedFile(null);
            setScormUploadResult(null);
            setUploadProgress('');
        } catch (error) {
            console.error('Error creating SCORM slide:', error);
            toast.error('Failed to create SCORM slide');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex w-full flex-col gap-6 text-neutral-600"
            >
                {/* SCORM File Upload */}
                <div
                    className="cursor-pointer rounded-lg border-2 border-dashed border-primary-400 p-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50/30"
                    onClick={() => document.getElementById('scorm-file-upload')?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <div className="flex flex-col items-center justify-center">
                        <div className="mb-4 text-primary-500">
                            <Package size={48} weight="duotone" />
                        </div>
                        <h3 className="text-xl font-medium text-primary-500">
                            Import your SCORM package
                        </h3>
                        <p className="mt-1 text-gray-500">Drag or click to upload</p>
                        <p className="mt-1 text-xs text-gray-400">
                            Supports SCORM 1.2 and SCORM 2004 (.zip)
                        </p>
                        {selectedFile && (
                            <div className="mt-3 rounded-md bg-primary-50 p-2">
                                <p className="text-sm font-medium text-primary-700">
                                    Selected: {selectedFile.name}
                                </p>
                                {uploadProgress && (
                                    <p className="mt-1 text-xs text-primary-600">{uploadProgress}</p>
                                )}
                            </div>
                        )}
                    </div>
                    <input
                        id="scorm-file-upload"
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                {/* Hidden input for Zod validation */}
                <FormField
                    control={form.control}
                    name="scormFile"
                    render={() => (
                        <FormItem className="hidden">
                            <FormControl>
                                <input type="file" />
                            </FormControl>
                        </FormItem>
                    )}
                />

                {/* Title Input */}
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <MyInput
                                    inputType="text"
                                    inputPlaceholder="Enter SCORM slide title"
                                    input={field.value}
                                    onChangeFunction={field.onChange}
                                    size="large"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Description Input */}
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Enter a description for this SCORM module..."
                                    className="min-h-[80px] resize-none"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* SCORM Details (if uploaded) */}
                {scormUploadResult && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <h4 className="mb-2 text-sm font-medium text-green-800">
                            Package Details
                        </h4>
                        <div className="space-y-1 text-xs text-green-700">
                            <p>
                                <span className="font-medium">Version:</span>{' '}
                                SCORM {scormUploadResult.scorm_version}
                            </p>
                            <p>
                                <span className="font-medium">Launch file:</span>{' '}
                                {scormUploadResult.launch_path?.split('/').pop() || 'index.html'}
                            </p>
                        </div>
                    </div>
                )}

                <MyButton
                    type="submit"
                    buttonType="primary"
                    scale="large"
                    layoutVariant="default"
                    disabled={isUploading || !selectedFile || !scormUploadResult}
                    className={`
                        w-full transition-all duration-300 ease-in-out
                        ${
                            isUploading || !selectedFile || !scormUploadResult
                                ? 'cursor-not-allowed opacity-50'
                                : 'shadow-lg hover:scale-105 hover:shadow-xl active:scale-95'
                        }
                    `}
                >
                    {isUploading ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Creating slide...
                        </div>
                    ) : (
                        'Create SCORM Slide'
                    )}
                </MyButton>
            </form>
        </Form>
    );
};
