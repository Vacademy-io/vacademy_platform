import { Dispatch, SetStateAction } from 'react';
import { DocumentSlidePayload, Slide, VideoSlidePayload } from '../../-hooks/use-slides';
import { UseMutateAsyncFunction } from '@tanstack/react-query';

type SlideResponse = {
    id: string;
    title: string;
    description: string;
    status: string;
};

export const updateHeading = async (
    activeItem: Slide,
    addUpdateVideoSlide: UseMutateAsyncFunction<SlideResponse, Error, VideoSlidePayload, unknown>,
    SaveDraft: (activeItem: Slide) => Promise<void>,
    heading: string,
    setIsEditing: Dispatch<SetStateAction<boolean>>,
    addUpdateDocumentSlide: UseMutateAsyncFunction<
        SlideResponse,
        Error,
        DocumentSlidePayload,
        unknown
    >
) => {
    const status = activeItem?.status == 'DRAFT' ? 'DRAFT' : 'UNSYNC';
    if (activeItem) {
        if (activeItem.source_type == 'VIDEO') {
            const url =
                activeItem?.status == 'PUBLISHED'
                    ? activeItem.video_slide?.published_url
                    : activeItem.video_slide?.url;
            await addUpdateVideoSlide({
                id: activeItem?.id,
                title: heading,
                description: activeItem.description,
                image_file_id: activeItem.image_file_id,
                slide_order: null,
                video_slide: {
                    id: activeItem.video_slide?.id || '',
                    description: activeItem.video_slide?.description || '',
                    url: url || null,
                    title: heading,
                    video_length_in_millis: activeItem?.video_slide?.video_length_in_millis || 0,
                    published_url: null,
                    published_video_length_in_millis:
                        activeItem?.video_slide?.published_video_length_in_millis || 0,
                    source_type: activeItem?.video_slide?.source_type || '',
                },
                status: status,
                new_slide: false,
                notify: false,
            });
            return;
        } else {
            if (activeItem.source_type === 'DOCUMENT') {
                if (activeItem.document_slide?.type == 'DOC') await SaveDraft(activeItem);
                await addUpdateDocumentSlide({
                    id: activeItem?.id || '',
                    title: heading,
                    image_file_id: activeItem.image_file_id || '',
                    description: activeItem?.description || '',
                    slide_order: null,
                    document_slide: {
                        id: activeItem?.document_slide?.id || '',
                        type: activeItem?.document_slide?.type || '',
                        data:
                            activeItem.status == 'PUBLISHED'
                                ? activeItem.document_slide?.published_data || null
                                : activeItem.document_slide?.data || null,
                        title: heading,
                        cover_file_id: activeItem.document_slide?.cover_file_id || '',
                        total_pages: activeItem?.document_slide?.total_pages || 0,
                        published_data: null,
                        published_document_total_pages:
                            activeItem?.document_slide?.published_document_total_pages || 0,
                    },
                    status: status,
                    new_slide: false,
                    notify: false,
                });
            }
        }
    }
    setIsEditing(false);
};
