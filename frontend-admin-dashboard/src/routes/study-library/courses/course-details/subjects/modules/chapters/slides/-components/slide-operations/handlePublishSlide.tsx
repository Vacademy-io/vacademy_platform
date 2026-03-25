import { Slide } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { Dispatch, RefObject, SetStateAction } from 'react';
import { toast } from 'sonner';
import { UseMutateAsyncFunction } from '@tanstack/react-query';
import {
    DocumentSlidePayload,
    VideoSlidePayload,
    QuizSlidePayload,
    AudioSlidePayload,
    ScormSlidePayload,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { SlideQuestionsDataInterface } from '@/types/study-library/study-library-slides-type';
import {
    converDataToAssignmentFormat,
    converDataToVideoFormat,
    convertToQuestionBackendSlideFormat,
} from '../../-helper/helper';
import { createQuizSlidePayload } from '../quiz/utils/api-helpers';

type SlideResponse = {
    id: string;
    title: string;
    description: string;
    status: string;
};

export interface YTPlayer {
    getDuration(): number;
}

export const handlePublishSlide = async (
    setIsOpen: Dispatch<SetStateAction<boolean>>,
    notify: boolean,
    activeItem: Slide,
    addUpdateDocumentSlide: UseMutateAsyncFunction<
        SlideResponse,
        Error,
        DocumentSlidePayload,
        unknown
    >,
    addUpdateVideoSlide: UseMutateAsyncFunction<SlideResponse, Error, VideoSlidePayload, unknown>,
    updateQuestionOrder: UseMutateAsyncFunction<
        SlideResponse,
        Error,
        SlideQuestionsDataInterface,
        unknown
    >,
    updateAssignmentOrder: UseMutateAsyncFunction<
        SlideResponse,
        Error,
        SlideQuestionsDataInterface,
        unknown
    >,
    addUpdateQuizSlide: UseMutateAsyncFunction<SlideResponse, Error, QuizSlidePayload, unknown>,
    addUpdateAudioSlide: UseMutateAsyncFunction<SlideResponse, Error, AudioSlidePayload, unknown>,
    addUpdateScormSlide: UseMutateAsyncFunction<SlideResponse, Error, ScormSlidePayload, unknown>,
    SaveDraft: (activeItem: Slide) => Promise<void>,
    playerRef?: RefObject<YTPlayer> // Optional YouTube player ref
) => {
    const status = 'PUBLISHED';

    if (activeItem?.source_type === 'QUESTION') {
        const convertedData = convertToQuestionBackendSlideFormat({
            activeItem,
            status,
            notify,
            newSlide: false,
        });
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            await updateQuestionOrder(convertedData!);
        } catch {
            toast.error('Error saving slide');
        }
        return;
    }

    if (activeItem?.source_type === 'DOCUMENT') {
        // if (activeItem?.document_slide?.type === 'DOC') await SaveDraft(activeItem);
        const publishedData = activeItem.document_slide?.data;
        try {
            await addUpdateDocumentSlide({
                id: activeItem?.id || '',
                title: activeItem.title || '',
                image_file_id: activeItem?.image_file_id || '',
                description: activeItem?.description || '',
                slide_order: 0,
                document_slide: {
                    id: activeItem?.document_slide?.id || '',
                    type: activeItem?.document_slide?.type || '',
                    data: null,
                    title: activeItem?.document_slide?.title || '',
                    cover_file_id: activeItem?.document_slide?.cover_file_id || '',
                    total_pages: activeItem?.document_slide?.total_pages || 0,
                    published_data: publishedData || null,
                    published_document_total_pages: activeItem?.document_slide?.total_pages || 0,
                },
                status: status,
                new_slide: false,
                notify: notify,
            });
            toast.success(`Slide published successfully!`);
            setIsOpen(false);
        } catch {
            toast.error(`Error in publishing the slide`);
        }
    }

    if (activeItem?.source_type === 'VIDEO') {
        if (!activeItem.video_slide) {
            toast.error('Video slide data is missing.');
            return;
        }

        // Use playerRef to get latest duration if available
        let durationInMillis = 0;
        if (playerRef?.current?.getDuration) {
            const durationInSec = playerRef.current.getDuration();
            durationInMillis = Math.round(durationInSec * 1000);
        } else {
            durationInMillis =
                activeItem.video_slide.video_length_in_millis ||
                activeItem.video_slide.published_video_length_in_millis ||
                0;
        }

        const convertedData = converDataToVideoFormat({
            activeItem: {
                ...activeItem,
                video_slide: {
                    ...activeItem.video_slide,
                    video_length_in_millis: durationInMillis,
                    published_video_length_in_millis: durationInMillis,
                },
            },
            status,
            notify,
            newSlide: false,
        });

        try {
            await addUpdateVideoSlide(convertedData);
            toast.success(`Slide published successfully!`);
            setIsOpen(false);
        } catch {
            toast.error(`Error in publishing the slide`);
        }
    }

    if (activeItem?.source_type === 'ASSIGNMENT') {
        const convertedData = converDataToAssignmentFormat({
            activeItem,
            status,
            notify,
            newSlide: false,
        });
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            await updateAssignmentOrder(convertedData!);
            toast.success(`Slide published successfully!`);
            setIsOpen(false);
        } catch {
            toast.error(`Error in publishing the slide`);
        }
    }

    if (activeItem?.source_type === 'QUIZ') {
        try {
            // Use the createQuizSlidePayload function to properly transform the data
            const payload = createQuizSlidePayload(activeItem.quiz_slide?.questions || [], {
                ...activeItem,
                status: 'PUBLISHED', // Override status to PUBLISHED
            });

            // Call the API to publish the quiz slide
            await addUpdateQuizSlide(payload);
            toast.success('Quiz published successfully!');
            setIsOpen(false);
        } catch (error) {
            console.error('Error publishing quiz slide:', error);
            toast.error('Failed to publish quiz');
        }
    }

    if (activeItem?.source_type === 'AUDIO') {
        if (!activeItem.audio_slide) {
            toast.error('Audio slide data is missing.');
            return;
        }

        try {
            await addUpdateAudioSlide({
                id: activeItem.id,
                title: activeItem.title,
                description: activeItem.description || null,
                image_file_id: activeItem.image_file_id || null,
                status: 'PUBLISHED',
                slide_order: activeItem.slide_order,
                notify: notify,
                new_slide: false,
                audio_slide: {
                    id: activeItem.audio_slide.id,
                    audio_file_id: activeItem.audio_slide.audio_file_id,
                    thumbnail_file_id: activeItem.audio_slide.thumbnail_file_id || null,
                    audio_length_in_millis: activeItem.audio_slide.audio_length_in_millis,
                    source_type: activeItem.audio_slide.source_type,
                    external_url: activeItem.audio_slide.external_url || null,
                    transcript: activeItem.audio_slide.transcript || null,
                },
            });
            toast.success('Slide published successfully!');
            setIsOpen(false);
        } catch {
            toast.error('Error in publishing the slide');
        }
    }

    if (activeItem?.source_type === 'SCORM') {
        if (!activeItem.scorm_slide) {
            toast.error('SCORM slide data is missing.');
            return;
        }

        try {
            await addUpdateScormSlide({
                id: activeItem.id,
                title: activeItem.title,
                description: activeItem.description || '',
                image_file_id: activeItem.image_file_id || '',
                status: 'PUBLISHED',
                slide_order: activeItem.slide_order,
                notify: notify,
                new_slide: false,
                scorm_slide: {
                    id: activeItem.scorm_slide.id,
                },
            });
            toast.success('SCORM slide published successfully!');
            setIsOpen(false);
        } catch {
            toast.error('Error in publishing the SCORM slide');
        }
    }
};
