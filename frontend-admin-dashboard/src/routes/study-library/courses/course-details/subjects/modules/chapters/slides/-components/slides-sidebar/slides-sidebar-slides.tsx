import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { truncateString } from '@/lib/reusable/truncateString';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import {
    DotsSixVertical,
    FileDoc,
    FilePdf,
    PlayCircle,
    ClipboardText,
} from '@phosphor-icons/react';
import { Video, Sparkles } from 'lucide-react';
import { ReactNode, useEffect, useMemo } from 'react';
import {
    Slide,
    slideOrderPayloadType,
    useSlidesQuery,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useRouter } from '@tanstack/react-router';
import { useFieldArray, useForm } from 'react-hook-form';
import {
    BookOpen,
    CheckCircle,
    Code,
    File,
    GameController,
    MusicNotes,
    Package,
    Question,
} from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLearnerViewStore } from '../../-stores/learner-view-store';

interface FormValues {
    slides: Slide[];
}

// Function to get the display text for slide type
const getSlideTypeDisplay = (slide: Slide): string => {
    const sourceType = slide.source_type ?? '';
    // For HTML_VIDEO slides (AI Video, AI Slides, AI Storybook), show "AI Content"
    if (sourceType === 'HTML_VIDEO') {
        return 'AI Content';
    }

    // For DOCUMENT slides with specific sub-types (not DOC), show just the sub-type
    if (
        sourceType === 'DOCUMENT' &&
        slide.document_slide?.type &&
        slide.document_slide.type !== 'DOC'
    ) {
        return (slide.document_slide.type ?? '').toLowerCase().replace('_', ' ');
    }

    // For VIDEO slides with embedded_type, show the embedded_type
    if (sourceType === 'VIDEO' && slide.video_slide?.embedded_type) {
        const embedded = slide.video_slide.embedded_type ?? '';
        return `${sourceType.toLowerCase().replace('_', ' ')} - ${embedded.toLowerCase().replace('_', ' ')}`;
    }

    // For SCORM slides
    if (sourceType === 'SCORM') {
        return 'SCORM';
    }

    // For all other cases, show the main source_type
    return sourceType ? sourceType.toLowerCase().replace('_', ' ') : 'Slide';
};

export const getIcon = (
    source_type: string,
    document_slide_type: string | undefined,
    size?: string,
    slide?: any // Optional slide object to check for html_video_slide
): ReactNode => {
    const sizeClass = `size-${size ? size : '5'}`;
    const iconClass = `${sizeClass} transition-all duration-200 ease-in-out group-hover:scale-105`;

    // Check if it's HTML_VIDEO by source_type or by html_video_slide property
    const isHtmlVideo = source_type === 'HTML_VIDEO' || (slide && (slide as any).html_video_slide);

    if (source_type === 'ASSIGNMENT') {
        return <File className={`${iconClass} text-blue-500`} />;
    }

    if (source_type === 'QUIZ') {
        return <ClipboardText className={`${iconClass} text-orange-500`} />;
    }

    // HTML_VIDEO icon (blue video + sparkle)
    if (isHtmlVideo) {
        const sparkleSize = size === '4' ? 'h-3 w-3' : size === '6' ? 'h-4 w-4' : 'h-3.5 w-3.5';
        return (
            <div className="relative inline-block">
                <Video className={`${iconClass} text-blue-500`} />
                <Sparkles className={`absolute -right-0.5 -top-0.5 ${sparkleSize} text-blue-400`} />
            </div>
        );
    }

    const type =
        source_type === 'QUESTION'
            ? 'QUESTION'
            : source_type === 'VIDEO'
              ? 'VIDEO'
              : source_type === 'AUDIO'
                ? 'AUDIO'
                : source_type === 'SCORM'
                  ? 'SCORM'
                  : source_type === 'DOCUMENT' && document_slide_type;

    switch (type) {
        case 'PDF':
            return <FilePdf className={`${iconClass} text-red-500`} />;
        case 'VIDEO':
            return <PlayCircle className={`${iconClass} text-green-500`} />;
        case 'DOC':
        case 'DOCX':
            return <FileDoc className={`${iconClass} text-blue-600`} />;
        case 'QUESTION':
            return <Question className={`${iconClass} text-purple-500`} />;
        case 'JUPYTER':
            return <BookOpen className={`${iconClass} text-violet-500`} />;
        case 'SCRATCH':
            return <GameController className={`${iconClass} text-yellow-500`} />;
        case 'CODE':
            return <Code className={`${iconClass} text-green-500`} />;
        case 'PRESENTATION':
            return <FileDoc className={`${iconClass} text-orange-500`} />;
        case 'AUDIO':
            return <MusicNotes className={`${iconClass} text-indigo-500`} />;
        case 'SCORM':
            return <Package className={`${iconClass} text-teal-500`} />;
        default:
            return <></>;
    }
};

// Enhanced Slide Item Component
const SlideItem = ({
    slide,
    index,
    isActive,
    onClick,
}: {
    slide: Slide;
    index: number;
    isActive: boolean;
    onClick: () => void;
}) => {
    const getSlideTitle = () => {
        return (
            (slide.source_type === 'DOCUMENT' && slide.document_slide?.title) ||
            (slide.source_type === 'VIDEO' && slide.video_slide?.title) ||
            (slide.source_type === 'HTML_VIDEO' &&
                ((slide as any).html_video_slide?.title || slide.title)) ||
            (slide.source_type === 'QUESTION' && slide?.title) ||
            (slide.source_type === 'ASSIGNMENT' && slide?.title) ||
            (slide.source_type === 'QUIZ' && slide.title) || // Always use slide.title for QUIZ
            (slide.source_type === 'AUDIO' && slide?.title) ||
            (slide.source_type === 'SCORM' && slide?.title) ||
            'Untitled'
        );
    };

    const getStatusBadge = () => {
        const status = slide.status;
        if (status === 'DRAFT') {
            return (
                <div className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-1 py-0.5 text-xs font-medium text-yellow-600">
                    D
                </div>
            );
        }
        if (status === 'PUBLISHED') {
            return (
                <CheckCircle
                    weight="fill"
                    className="text-green-500 transition-transform duration-200 group-hover:scale-110"
                    size={14}
                />
            );
        }
        if (status === 'UNSYNC') {
            return (
                <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-1 py-0.5 text-xs font-medium text-orange-600">
                    U
                </div>
            );
        }
        if (status === 'DELETED') {
            return (
                <div className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1 py-0.5 text-xs font-medium text-red-600">
                    DEL
                </div>
            );
        }
        return null;
    };

    return (
        <SortableItem value={slide.id} asChild className="group cursor-pointer">
            <div
                className={`w-full transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-left-2 ${
                    slide.status !== 'DELETED' ? 'hover:scale-[1.01]' : ''
                }`}
                onClick={slide.status === 'DELETED' ? undefined : onClick}
            >
                <div
                    className={`
                        flex w-full items-center gap-2.5 rounded-lg border px-3
                        py-2 backdrop-blur-sm transition-all
                        duration-300 ease-in-out
                        ${
                            slide.status === 'DELETED'
                                ? 'cursor-not-allowed border-red-200 bg-red-50/30 text-red-600 opacity-50'
                                : isActive
                                  ? 'border-primary-300 bg-primary-50/80 text-primary-600 shadow-md shadow-primary-100/50'
                                  : 'hover:bg-primary-25 border-neutral-100 bg-white/60 text-neutral-600 hover:border-primary-200 hover:text-primary-500 hover:shadow-sm'
                        }
                        ${slide.status !== 'DELETED' ? 'group-hover:shadow-md' : ''}
                    `}
                >
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger className="w-full">
                                <div className="flex flex-1 items-center gap-2.5">
                                    {/* Slide Number with enhanced styling */}
                                    <div
                                        className={`
                                        flex size-6 items-center justify-center rounded-md text-xs font-bold transition-all
                                        duration-200 ease-in-out group-hover:scale-105
                                        ${
                                            slide.status === 'DELETED'
                                                ? 'bg-red-200 text-red-600'
                                                : isActive
                                                  ? 'bg-primary-500 text-white shadow-sm'
                                                  : 'bg-neutral-100 text-neutral-500 group-hover:bg-primary-100 group-hover:text-primary-600'
                                        }
                                    `}
                                    >
                                        {index + 1}
                                    </div>

                                    {/* Icon with enhanced styling */}
                                    <div className="shrink-0">
                                        {getIcon(
                                            slide.source_type,
                                            slide.document_slide?.type,
                                            '4',
                                            slide
                                        )}
                                    </div>

                                    {/* Content area */}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium leading-tight">
                                            {truncateString(getSlideTitle(), 18)}
                                        </p>
                                        <p className="mt-0.5 text-xs capitalize leading-tight text-neutral-400">
                                            {getSlideTypeDisplay(slide)}
                                        </p>
                                    </div>

                                    {/* Status indicator */}
                                    <div className="shrink-0">{getStatusBadge()}</div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent
                                className="max-w-xs border border-neutral-300 bg-white/95 text-neutral-700 shadow-lg backdrop-blur-sm"
                                side="right"
                            >
                                <div className="space-y-1">
                                    <p className="font-medium">{getSlideTitle()}</p>
                                    <p className="text-xs capitalize text-neutral-500">
                                        {(slide.source_type ?? '').toLowerCase().replace('_', ' ')} •{' '}
                                        {(slide.status ?? '').toLowerCase()}
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Drag handle with enhanced styling */}
                    <div className="drag-handle-container opacity-100 transition-opacity duration-200">
                        <SortableDragHandle
                            variant="ghost"
                            size="icon"
                            className="size-6 cursor-grab rounded-md transition-all duration-200 hover:scale-105 hover:bg-neutral-100 active:scale-95 active:cursor-grabbing"
                            onClick={(e) => {
                                // Prevent the slide click when clicking the drag handle
                                e.stopPropagation();
                            }}
                        >
                            <DotsSixVertical className="size-3 shrink-0 text-neutral-400" />
                        </SortableDragHandle>
                    </div>
                </div>
            </div>
        </SortableItem>
    );
};

export const ChapterSidebarSlides = ({
    handleSlideOrderChange,
}: {
    handleSlideOrderChange: (slideOrderPayloadType: slideOrderPayloadType) => void;
}) => {
    const { setItems, activeItem, setActiveItem, items } = useContentStore();
    const { isLearnerView } = useLearnerViewStore();
    const router = useRouter();
    const searchParams = router.state.location.search;
    const { chapterId, slideId, courseId, levelId, moduleId, subjectId, sessionId } = searchParams;

    const { slides, isLoading, refetch } = useSlidesQuery(chapterId || '');

    // Memoize filtered slides to prevent infinite loops
    const filteredSlides = useMemo(() => {
        return isLearnerView
            ? slides?.filter((slide) => slide.status === 'PUBLISHED' || slide.status === 'UNSYNC')
            : slides;
    }, [slides, isLearnerView]);

    useEffect(() => {
        refetch();
    }, []);

    const handleSlideClick = async (slide: Slide) => {
        // Update URL with new slideId
        router.navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: {
                courseId: courseId || '',
                levelId: levelId || '',
                subjectId: subjectId || '',
                moduleId: moduleId || '',
                chapterId: chapterId || '',
                slideId: slide.id, // ✅ Update slideId in URL
                sessionId: sessionId || '',
            },
            replace: true, // Replace history entry instead of pushing new one
        });

        // Set the new active item
        setActiveItem(slide);
    };

    const form = useForm<FormValues>({
        defaultValues: {
            slides: items || [],
        },
    });

    const { move } = useFieldArray({
        control: form.control,
        name: 'slides',
    });

    const handleMove = ({ activeIndex, overIndex }: { activeIndex: number; overIndex: number }) => {
        move(activeIndex, overIndex);

        // Create order payload after move
        const updatedFields = form.getValues('slides');

        // Create order payload with the updated order
        const orderPayload = updatedFields.map((slide, index) => ({
            slide_id: slide.id,
            slide_order: index + 1,
        }));
        // Call the handler to update the order through API
        handleSlideOrderChange(orderPayload);
    };

    useEffect(() => {
        form.setValue('slides', items || []);
    }, [items]);

    useEffect(() => {
        // Debug quiz slides specifically
        const quizSlides = filteredSlides?.filter((slide) => slide.source_type === 'QUIZ') || [];

        if (filteredSlides?.length) {
            form.reset({ slides: filteredSlides });
            setItems(filteredSlides as Slide[]);

            // Check if current active slide still exists in updated slides
            const activeSlideStillExists =
                activeItem && filteredSlides.find((slide) => slide.id === activeItem.id);

            if (activeSlideStillExists) {
                setActiveItem(activeSlideStillExists as Slide);
                return;
            }

            // Priority 1: Use slideId from URL if available
            if (slideId) {
                const targetSlide = filteredSlides.find((item) => item.id === slideId) as
                    | Slide
                    | undefined;
                if (targetSlide) {
                    setActiveItem(targetSlide);
                    return;
                }
            }

            // Priority 2: Always set first slide as active (handles creation/deletion)
            const firstSlide = filteredSlides[0] as Slide;
            setActiveItem(firstSlide);
        } else {
            setItems([]);
            if (slideId === undefined) {
                setActiveItem(null);
            } else {
                // In learner view, if slideId doesn't exist in published slides, don't create placeholder
                if (isLearnerView) {
                    setActiveItem(null);
                } else {
                    // Create placeholder slide for URL slideId
                    setActiveItem({
                        id: slideId,
                        source_id: '',
                        source_type: '',
                        title: '',
                        image_file_id: '',
                        description: '',
                        status: '',
                        slide_order: 0,
                        video_slide: null,
                        document_slide: null,
                        question_slide: null,
                        assignment_slide: null,
                        is_loaded: false,
                        new_slide: false,
                    });
                }
            }
        }
    }, [filteredSlides, slideId]); // Removed isLearnerView from deps as it's already in filteredSlides memo

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6 duration-500 animate-in fade-in">
                <DashboardLoader />
            </div>
        );
    }

    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center px-3 py-8 text-center duration-700 animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-3 flex size-12 animate-pulse items-center justify-center rounded-full bg-neutral-100">
                    <File className="size-6 text-neutral-400" />
                </div>
                <h3 className="mb-1 text-base font-medium text-neutral-600">No slides yet</h3>
                <p className="max-w-xs text-xs leading-relaxed text-neutral-400">
                    Add your first slide to get started
                </p>
            </div>
        );
    }

    return (
        <div className="duration-500 animate-in fade-in slide-in-from-bottom-2">
            <Sortable value={items} onMove={handleMove} fast={false}>
                <div className="flex w-full flex-col gap-1.5 px-1 text-neutral-600">
                    {items.map((slide, index) => (
                        <SlideItem
                            key={slide.id}
                            slide={slide}
                            index={index}
                            isActive={slide.id === activeItem?.id}
                            onClick={() => handleSlideClick(slide)}
                        />
                    ))}
                </div>
            </Sortable>
        </div>
    );
};
