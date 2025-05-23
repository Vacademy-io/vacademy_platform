'use client';

import type React from 'react';

import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useSlides } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import { toast } from 'sonner';
import { Route } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/index';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useState } from 'react';
import { UploadFileInS3 } from '@/services/upload_file';

const formSchema = z.object({
    videoName: z.string().min(1, 'File name is required'),
    videoFile: z.instanceof(File, { message: 'Video file is required' }),
});

type FormValues = z.infer<typeof formSchema>;

// Declare INSTITUTE_ID here or import it from a config file
const INSTITUTE_ID = 'your-institute-id'; // Replace with your actual institute ID

export const AddVideoFileDialog = ({
    openState,
}: {
    openState?: ((open: boolean) => void) | undefined;
}) => {
    const { chapterId } = Route.useSearch();
    const { addUpdateVideoSlide } = useSlides(chapterId);
    const { setActiveItem, getSlideById } = useContentStore();
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleSubmit = async (data: FormValues) => {
        try {
            setIsUploading(true);

            // Upload file to S3
            const fileId = await UploadFileInS3(
                data.videoFile,
                (progress) => {
                    // You can handle progress updates here if needed
                    console.log(`Upload progress: ${progress}%`);
                },
                'your-user-id',
                INSTITUTE_ID,
                'ADMIN',
                true
            );

            // Create the slide with the file ID in the URL field
            const slideId = crypto.randomUUID();
            const response: string = await addUpdateVideoSlide({
                id: slideId,
                title: data.videoName,
                description: null,
                image_file_id: null,
                slide_order: null,
                video_slide: {
                    id: crypto.randomUUID(),
                    description: '',
                    url: fileId ?? null, // Store the file ID or fallback to null
                    title: data.videoName,
                    video_length_in_millis: 0,
                    published_url: null,
                    published_video_length_in_millis: 0,
                    source_type: 'FILE_ID',
                },
                status: 'DRAFT',
                new_slide: true,
                notify: false,
            });
            console.log('Response:', response, 'source_type', 'FILE_ID');

            toast.success('Video uploaded successfully!');
            form.reset();
            setSelectedFile(null);
            openState?.(false);
            setTimeout(() => {
                setActiveItem(getSlideById(response));
            }, 500);
        } catch (error) {
            console.error('Error uploading video:', error);
            toast.error('Failed to upload video');
        } finally {
            setIsUploading(false);
        }
    };

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
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            setSelectedFile(file);
            form.setValue('videoFile', file);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
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

                <FormField
                    control={form.control}
                    name="videoName"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    label="Video Title"
                                    required={true}
                                    input={field.value}
                                    inputType="text"
                                    inputPlaceholder="File name"
                                    onChangeFunction={field.onChange}
                                    className="w-full"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <MyButton
                    type="submit"
                    buttonType="primary"
                    scale="large"
                    layoutVariant="default"
                    disabled={isUploading}
                >
                    {isUploading ? 'Uploading...' : 'Upload Video'}
                </MyButton>
            </form>
        </Form>
    );
};
