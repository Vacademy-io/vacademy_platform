'use client';

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
import { VideoCamera, CheckCircle, PlayCircle } from '@phosphor-icons/react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';

const formSchema = z.object({
    videoUrl: z
        .string()
        .min(1, 'URL is required')
        .url('Please enter a valid URL')
        .refine((url) => url.includes('vimeo.com'), {
            message: 'Please enter a valid Vimeo URL',
        }),
    videoName: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const extractVimeoId = (url: string): string => {
    const regExp = /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/;
    const match = url.match(regExp);
    return match && match[1] ? match[1] : '';
};

export const AddVimeoDialog = ({ openState }: { openState?: (open: boolean) => void }) => {
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
    const [isValidUrl, setIsValidUrl] = useState(false);
    const [videoPreview, setVideoPreview] = useState<{ title: string; thumbnail: string } | null>(
        null
    );
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [isVideoUploading, setIsVideoUploading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            videoUrl: '',
            videoName: '',
        },
    });

    const handleUrlChange = (url: string) => {
        const videoId = extractVimeoId(url);
        if (videoId) {
            setIsValidUrl(true);
            fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`)
                .then((response) => response.json())
                .then((data) => {
                    form.setValue('videoName', data.title || 'Vimeo Video');
                    setVideoPreview({
                        title: data.title,
                        thumbnail: data.thumbnail_url,
                    });
                    setVideoDuration((data.duration || 0) * 1000);
                })
                .catch(() => {
                    form.setValue('videoName', 'Vimeo Video');
                    setVideoPreview(null);
                    setVideoDuration(0);
                });
        } else {
            setIsValidUrl(false);
            setVideoPreview(null);
            setVideoDuration(0);
        }
    };

    const handleSubmit = async (data: FormValues) => {
        const videoId = extractVimeoId(data.videoUrl);
        if (!videoId) {
            toast.error('Invalid Vimeo URL');
            return;
        }

        setIsVideoUploading(true);
        try {
            const slideId = crypto.randomUUID();
            const slideStatus = getSlideStatusForUser();
            const response: string = await addUpdateVideoSlide({
                id: slideId,
                title: data.videoName || 'Vimeo Video',
                description: null,
                image_file_id: null,
                slide_order: 0,
                video_slide: {
                    id: crypto.randomUUID(),
                    description: '',
                    url: data.videoUrl,
                    title: data.videoName || 'Vimeo Video',
                    video_length_in_millis: videoDuration,
                    published_url: slideStatus === 'PUBLISHED' ? data.videoUrl : null,
                    published_video_length_in_millis: slideStatus === 'PUBLISHED' ? videoDuration : 0,
                    source_type: 'VIMEO',
                },
                status: slideStatus,
                new_slide: true,
                notify: false,
            });

            if (response) {
                await reorderSlidesAfterNewSlide(response);
                openState?.(false);
                toast.success('Vimeo video added successfully!');
            }
        } catch (error) {
            toast.error('Failed to add video');
        } finally {
            setIsVideoUploading(false);
        }
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

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex w-full flex-col gap-6 p-6 text-neutral-600"
            >
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="videoUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={field.value}
                                            onChange={(e) => {
                                                field.onChange(e);
                                                handleUrlChange(e.target.value);
                                            }}
                                            placeholder="https://vimeo.com/..."
                                            className="w-full rounded-lg border border-neutral-300 px-4 py-3 pr-10 text-sm"
                                            required
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {isValidUrl ? (
                                                <CheckCircle className="size-5 text-green-500" />
                                            ) : (
                                                <VideoCamera className="size-5 text-neutral-400" />
                                            )}
                                        </div>
                                    </div>
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {videoPreview && (
                        <div className="rounded-xl border bg-neutral-50 p-4 duration-500 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <img
                                        src={videoPreview.thumbnail}
                                        alt="Video thumbnail"
                                        className="h-12 w-16 rounded-lg object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <PlayCircle className="size-6 text-white drop-shadow-lg" />
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-neutral-700">
                                        {videoPreview.title}
                                    </p>
                                    <p className="text-xs text-neutral-500">Vimeo Video</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end border-t border-neutral-100 pt-4">
                    <MyButton
                        type="submit"
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        disabled={!form.getValues('videoUrl') || !isValidUrl || isVideoUploading}
                        className={`
              w-full transition-all duration-300 ease-in-out
              ${
                  !form.getValues('videoUrl') || !isValidUrl || isVideoUploading
                      ? 'cursor-not-allowed opacity-50'
                      : 'shadow-lg hover:scale-105 hover:shadow-xl active:scale-95'
              }
            `}
                    >
                        {isVideoUploading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Adding Video...
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <VideoCamera className="size-4" />
                                Add Vimeo Video
                            </div>
                        )}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
