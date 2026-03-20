'use client';

import type React from 'react';

import { MyButton } from '@/components/design-system/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useSlidesMutations } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { toast } from 'sonner';
import { Route } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/index';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useState } from 'react';
import { UploadFileInS3 } from '@/services/upload_file';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';

const formSchema = z.object({
    videoName: z.string().min(1, 'File name is required'),
    videoFile: z.instanceof(File, { message: 'Video file is required' }),
});

type FormValues = z.infer<typeof formSchema>;

const INSTITUTE_ID = 'your-institute-id'; // Replace this in real usage

export const AddVideoFileDialog = ({ openState }: { openState?: (open: boolean) => void }) => {
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } = Route.useSearch();
    const { addUpdateVideoSlide, updateSlideOrder } = useSlidesMutations(
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

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            videoName: '',
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            form.setValue('videoFile', file);
            form.setValue('videoName', file.name.replace(/\.[^/.]+$/, '')); // remove extension
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            setSelectedFile(file);
            form.setValue('videoFile', file);
            form.setValue('videoName', file.name.replace(/\.[^/.]+$/, ''));
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
        try {
            setIsUploading(true);

            const fileId = await UploadFileInS3(
                data.videoFile,
                (progress) => {
                    console.log(`Upload progress: ${progress}%`);
                },
                'your-user-id',
                INSTITUTE_ID,
                'ADMIN',
                true
            );

            const slideId = crypto.randomUUID();
            const slideStatus = getSlideStatusForUser();
            const response = await addUpdateVideoSlide({
                id: slideId,
                title: data.videoName,
                description: null,
                image_file_id: null,
                slide_order: 0,
                video_slide: {
                    id: crypto.randomUUID(),
                    description: '',
                    url: fileId ?? null,
                    title: data.videoName,
                    video_length_in_millis: 0,
                    published_url: slideStatus === 'PUBLISHED' ? (fileId ?? null) : null,
                    published_video_length_in_millis: slideStatus === 'PUBLISHED' ? 0 : 0,
                    source_type: 'FILE_ID',
                },
                status: slideStatus,
                new_slide: true,
                notify: false,
            });

            if (response) {
                await reorderSlidesAfterNewSlide(response);
                openState?.(false);
                toast.success('Video uploaded successfully!');
            }

            form.reset();
            setSelectedFile(null);
        } catch (error) {
            toast.error('Failed to upload video');
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
                <div
                    className="cursor-pointer rounded-lg border-2 border-dashed border-orange-400 p-8 text-center"
                    onClick={() => document.getElementById('video-file-upload')?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <div className="flex flex-col items-center justify-center">
                        <div className="mb-4 text-orange-500">
                            <svg
                                width="48"
                                height="48"
                                viewBox="0 0 48 48"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M24 12V24M24 24V36M24 24H36M24 24H12"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-medium text-orange-500">Import your file</h3>
                        <p className="mt-1 text-gray-500">Drag or click to upload</p>
                        {selectedFile && (
                            <p className="mt-2 text-sm font-medium text-gray-700">
                                Selected: {selectedFile.name}
                            </p>
                        )}
                    </div>
                    <input
                        id="video-file-upload"
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                {/* Hidden input for Zod validation */}
                <FormField
                    control={form.control}
                    name="videoFile"
                    render={() => (
                        <FormItem className="hidden">
                            <FormControl>
                                <input type="file" />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <MyButton
                    type="submit"
                    buttonType="primary"
                    scale="large"
                    layoutVariant="default"
                    disabled={isUploading || !selectedFile}
                    className={`
            w-full transition-all duration-300 ease-in-out
            ${
                isUploading || !selectedFile
                    ? 'cursor-not-allowed opacity-50'
                    : 'shadow-lg hover:scale-105 hover:shadow-xl active:scale-95'
            }
          `}
                >
                    {isUploading ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Uploading...
                        </div>
                    ) : (
                        'Upload Video'
                    )}
                </MyButton>
            </form>
        </Form>
    );
};
