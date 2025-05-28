import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { DocumentSlidePayload, Slide, VideoSlidePayload } from '../../-hooks/use-slides';
import { UseMutateAsyncFunction } from '@tanstack/react-query';
import { SlideQuestionsDataInterface } from '@/types/study-library/study-library-slides-type';
import {
    converDataToAssignmentFormat,
    converDataToVideoFormat,
    convertToQuestionBackendSlideFormat,
} from '../../-helper/helper';

type SlideResponse = {
    id: string;
    title: string;
    description: string;
    status: string;
};

export const handleUnpublishSlide = async (
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
    SaveDraft: (activeItem: Slide) => Promise<void>
) => {
    const status = 'DRAFT';
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
            toast.error('error saving slide');
        }
        return;
    }
    if (activeItem?.source_type == 'DOCUMENT') {
        if (activeItem.document_slide?.type == 'DOC') SaveDraft(activeItem);
        const draftData = activeItem.document_slide?.data;
        try {
            await addUpdateDocumentSlide({
                id: activeItem?.id || '',
                title: activeItem?.title || '',
                image_file_id: activeItem?.image_file_id || '',
                description: activeItem?.description || '',
                slide_order: null,
                document_slide: {
                    id: activeItem?.document_slide?.id || '',
                    type: activeItem?.document_slide?.type || '',
                    data: draftData || null,
                    title: activeItem?.document_slide?.title || '',
                    cover_file_id: activeItem?.document_slide?.cover_file_id || '',
                    total_pages: activeItem?.document_slide?.total_pages || 0,
                    published_data: null,
                    published_document_total_pages: 0,
                },
                status: status,
                new_slide: false,
                notify: notify,
            });
            toast.success(`slide unpublished successfully!`);
            setIsOpen(false);
        } catch {
            toast.error(`Error in unpublishing the slide`);
        }
    }

    if (activeItem?.source_type == 'VIDEO') {
        const convertedData = converDataToVideoFormat({
            activeItem,
            status,
            notify,
            newSlide: false,
        });
        try {
            await addUpdateVideoSlide(convertedData);
            toast.success(`slide unpublished successfully!`);
            setIsOpen(false);
        } catch {
            toast.error(`Error in unpublishing the slide`);
        }
    }

    if (activeItem?.source_type == 'ASSIGNMENT') {
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
            toast.success(`slide published successfully!`);
            setIsOpen(false);
        } catch {
            toast.error(`Error in publishing the slide`);
        }
    }
};
