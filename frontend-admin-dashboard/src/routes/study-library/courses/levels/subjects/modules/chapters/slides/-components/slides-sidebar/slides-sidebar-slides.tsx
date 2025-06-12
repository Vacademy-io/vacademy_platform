import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { truncateString } from '@/lib/reusable/truncateString';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { DotsSixVertical, FileDoc, FilePdf, PlayCircle } from '@phosphor-icons/react';
import { ReactNode, useEffect } from 'react';
import {
    Slide,
    slideOrderPayloadType,
    useSlides,
} from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useRouter } from '@tanstack/react-router';
import { useFieldArray, useForm } from 'react-hook-form';
import { CheckCircle, File, Question } from 'phosphor-react';
import { useSaveDraft } from '../../-context/saveDraftContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FormValues {
    slides: Slide[];
}

export const getIcon = (
    source_type: string,
    document_slide_type: string | undefined,
    size?: string
): ReactNode => {
    const sizeClass = `size-${size ? size : '6'}`;
    if (source_type === 'ASSIGNMENT') {
        return <File className={sizeClass} />;
    }
    const type =
        source_type === 'QUESTION'
            ? 'QUESTION'
            : source_type === 'VIDEO'
              ? 'VIDEO'
              : source_type === 'DOCUMENT' && document_slide_type;
    switch (type) {
        case 'PDF':
            return <FilePdf className={sizeClass} />;
        case 'VIDEO':
            return <PlayCircle className={sizeClass} />;
        case 'DOC':
            return <FileDoc className={sizeClass} />;
        case 'DOCX':
            return <FileDoc className={sizeClass} />;
        case 'QUESTION':
            return <Question className={sizeClass} />;
        default:
            return <></>;
    }
};

export const ChapterSidebarSlides = ({
    handleSlideOrderChange,
}: {
    handleSlideOrderChange: (slideOrderPayload: slideOrderPayloadType) => void;
}) => {
    const { setItems, activeItem, setActiveItem, items } = useContentStore();
    const router = useRouter();
    const { chapterId, slideId } = router.state.location.search;
    const { slides, isLoading, refetch } = useSlides(chapterId || '');
    const { getCurrentEditorHTMLContent, saveDraft } = useSaveDraft();

    useEffect(() => {
        refetch();
    }, []);

    const handleSlideClick = async (slide: Slide) => {
        // Check if we need to save the current slide before switching
        if (
            activeItem &&
            activeItem.source_type === 'DOCUMENT' &&
            activeItem.document_slide?.type === 'DOC'
        ) {
            const currentContent = getCurrentEditorHTMLContent();
            if (currentContent) {
                if (
                    (activeItem.status === 'UNSYNC' || activeItem.status === 'DRAFT') &&
                    activeItem.document_slide.data !== currentContent
                ) {
                    await saveDraft(activeItem);
                } else if (
                    activeItem.status === 'PUBLISHED' &&
                    activeItem.document_slide.published_data !== currentContent
                ) {
                    await saveDraft(activeItem);
                }
            }
        }

        // Now set the new active item
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
        if (slides?.length) {
            form.reset({ slides: items });
            setItems(items);

            if (slideId) {
                const targetSlide: Slide | undefined = items.find(
                    (item: Slide) => item.id === slideId
                );
                if (targetSlide) {
                    setActiveItem(targetSlide);
                    return;
                }
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setActiveItem(slides[0] ?? null);
        } else {
            if (slideId == undefined) {
                setActiveItem(null);
            } else {
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
    }, [slides]);

    if (isLoading) {
        return <DashboardLoader />;
    }

    return (
        <Sortable value={items} onMove={handleMove} fast={false}>
            <div className="flex w-full flex-col items-center gap-6 text-neutral-600">
                {items.map((slide, index) => (
                    <SortableItem key={index} value={slide.id} asChild className="cursor-pointer">
                        <div className="w-full" onClick={() => handleSlideClick(slide)}>
                            <div
                                className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 ${
                                    slide.id === activeItem?.id
                                        ? 'border border-neutral-200 bg-white text-primary-500'
                                        : 'hover:border hover:border-neutral-200 hover:bg-white hover:text-primary-500'
                                }`}
                            >
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger className="w-full">
                                            <div className="flex flex-1 items-center gap-2">
                                                <div className="flex gap-3">
                                                    <p className={` font-semibold`}>S{index + 1}</p>
                                                    {getIcon(
                                                        slide.source_type,
                                                        slide.document_slide?.type
                                                    )}
                                                    <p className={`flex-1 text-subtitle`}>
                                                        {truncateString(
                                                            (slide.source_type === 'DOCUMENT' &&
                                                                slide.document_slide?.title) ||
                                                                (slide.source_type === 'VIDEO' &&
                                                                    slide.video_slide?.title) ||
                                                                (slide.source_type === 'QUESTION' &&
                                                                    slide?.title) ||
                                                                (slide.source_type ===
                                                                    'ASSIGNMENT' &&
                                                                    slide?.title) ||
                                                                '',
                                                            12
                                                        )}
                                                    </p>
                                                </div>
                                                {slide.status != 'DRAFT' && (
                                                    <CheckCircle
                                                        weight="fill"
                                                        className="text-success-600"
                                                        size={20}
                                                    />
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="border border-neutral-300 bg-primary-100 text-neutral-600">
                                            <p>
                                                {(slide.source_type === 'DOCUMENT' &&
                                                    slide.document_slide?.title) ||
                                                    (slide.source_type === 'VIDEO' &&
                                                        slide.video_slide?.title) ||
                                                    (slide.source_type === 'QUESTION' &&
                                                        slide?.title) ||
                                                    (slide.source_type === 'ASSIGNMENT' &&
                                                        slide?.title) ||
                                                    ''}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <div className="drag-handle-container">
                                    <SortableDragHandle
                                        variant="ghost"
                                        size="icon"
                                        className="cursor-grab hover:bg-neutral-100 active:cursor-grabbing"
                                    >
                                        <DotsSixVertical className={`size-6 shrink-0 `} />
                                    </SortableDragHandle>
                                </div>
                            </div>
                        </div>
                    </SortableItem>
                ))}
            </div>
        </Sortable>
    );
};
