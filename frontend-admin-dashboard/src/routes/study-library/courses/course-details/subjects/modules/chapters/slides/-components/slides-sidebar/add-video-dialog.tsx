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
import { useEffect, useRef, useState } from 'react';
import { YoutubeLogo, CheckCircle, PlayCircle } from '@phosphor-icons/react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';

const formSchema = z.object({
    videoUrl: z
        .string()
        .min(1, 'URL is required')
        .url('Please enter a valid URL')
        .refine((url) => url.includes('youtube.com') || url.includes('youtu.be'), {
            message: 'Please enter a valid YouTube URL',
        }),
    videoName: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const AddVideoDialog = ({ openState }: { openState?: (open: boolean) => void }) => {
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
    const [isAPIReady, setIsAPIReady] = useState(false);
    const [isValidUrl, setIsValidUrl] = useState(false);
    const [videoPreview, setVideoPreview] = useState<{ title: string; thumbnail: string } | null>(
        null
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVideoUploading, setIsVideoUploading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            videoUrl: '',
            videoName: '',
        },
    });

    const extractVideoId = (url: string): string => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2]?.length === 11 ? match[2] : '';
    };

    const loadYouTubeAPI = () => {
        if (window.YT) {
            setIsAPIReady(true);
            return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        window.onYouTubeIframeAPIReady = () => {
            setIsAPIReady(true);
        };
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    };

    useEffect(() => {
        loadYouTubeAPI();
    }, []);

    const handleUrlChange = (url: string) => {
        const videoId = extractVideoId(url);
        if (videoId) {
            setIsValidUrl(true);
            fetch(`https://www.youtube.com/oembed?url=${url}&format=json`)
                .then((response) => response.json())
                .then((data) => {
                    form.setValue('videoName', data.title || 'YouTube Video');
                    setVideoPreview({ title: data.title, thumbnail: data.thumbnail_url });
                })
                .catch(() => {
                    form.setValue('videoName', 'YouTube Video');
                    setVideoPreview(null);
                });
        } else {
            setIsValidUrl(false);
            setVideoPreview(null);
        }
    };

    const handleSubmit = async (data: FormValues) => {
        const videoId = extractVideoId(data.videoUrl);
        if (!videoId) {
            toast.error('Invalid YouTube URL');
            return;
        }

        if (containerRef.current && isAPIReady) {
            const playerContainer = document.createElement('div');
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(playerContainer);

            new window.YT.Player(playerContainer, {
                height: '0',
                width: '0',
                videoId: videoId,
                playerVars: { autoplay: 0, controls: 0 },
                events: {
                    onReady: (event) => {
                        const duration = event.target.getDuration();
                        submitFormWithDuration(data, duration * 1000);
                        event.target.destroy();
                    },
                },
            });
        } else {
            submitFormWithDuration(data, 0);
        }
    };

    const submitFormWithDuration = async (data: FormValues, duration: number) => {
        setIsVideoUploading(true);
        try {
            const slideId = crypto.randomUUID();
            const slideStatus = getSlideStatusForUser();
            const response: string = await addUpdateVideoSlide({
                id: slideId,
                title: data.videoName || 'YouTube Video',
                description: null,
                image_file_id: null,
                slide_order: 0,
                video_slide: {
                    id: crypto.randomUUID(),
                    description: '',
                    url: data.videoUrl,
                    title: data.videoName || 'YouTube Video',
                    video_length_in_millis: duration,
                    published_url: slideStatus === 'PUBLISHED' ? data.videoUrl : null,
                    published_video_length_in_millis: slideStatus === 'PUBLISHED' ? duration : 0,
                    source_type: 'VIDEO',
                },
                status: slideStatus,
                new_slide: true,
                notify: false,
            });

            if (response) {
                await reorderSlidesAfterNewSlide(response);
                openState?.(false);
                toast.success('Video added successfully!');
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
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="w-full rounded-lg border border-neutral-300 px-4 py-3 pr-10 text-sm"
                                            required
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {isValidUrl ? (
                                                <CheckCircle className="size-5 text-green-500" />
                                            ) : (
                                                <YoutubeLogo className="size-5 text-neutral-400" />
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
                                    <p className="text-xs text-neutral-500">YouTube Video</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div ref={containerRef} className="hidden" />

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
                                <YoutubeLogo className="size-4" />
                                Add YouTube Video
                            </div>
                        )}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
