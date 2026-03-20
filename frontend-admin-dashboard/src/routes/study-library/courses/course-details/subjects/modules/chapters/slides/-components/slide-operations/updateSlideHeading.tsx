import { Dispatch, SetStateAction } from 'react';
import {
    DocumentSlidePayload,
    Slide,
    VideoSlidePayload,
    QuizSlidePayload,
} from '../../-hooks/use-slides';
import { UseMutateAsyncFunction } from '@tanstack/react-query';
import { createQuizSlidePayload } from '../quiz/utils/api-helpers';
import {
    converDataToAssignmentFormat,
    convertToQuestionBackendSlideFormat,
} from '../../-helper/helper';

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
    >,
    addUpdateQuizSlide?: UseMutateAsyncFunction<SlideResponse, Error, QuizSlidePayload, unknown>,
    updateAssignmentOrder?: UseMutateAsyncFunction<SlideResponse, Error, any, unknown>,
    updateQuestionOrder?: UseMutateAsyncFunction<SlideResponse, Error, any, unknown>
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
                    // Preserve embedded fields for split-screen slides
                    embedded_type: activeItem?.video_slide?.embedded_type || '',
                    embedded_data: activeItem?.video_slide?.embedded_data || null,
                    questions: activeItem?.video_slide?.questions || [],
                },
                status: status,
                new_slide: false,
                notify: false,
            });
            return;
        } else if (activeItem.source_type === 'DOCUMENT') {
            // Handle PRESENTATION title update
            if (activeItem.document_slide?.type === 'PRESENTATION') {
                try {
                    const { setActiveItem, items, setItems } =
                        require('@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store').useContentStore.getState();
                    const newDocSlide = { ...activeItem.document_slide, title: heading };
                    const newSlide = { ...activeItem, title: heading, document_slide: newDocSlide };
                    setActiveItem(newSlide);
                    if (Array.isArray(items)) {
                        setItems(
                            items.map((item) => (item.id === activeItem.id ? newSlide : item))
                        );
                    }
                } catch (e) {}
                await addUpdateDocumentSlide({
                    ...activeItem,
                    title: heading,
                    document_slide: {
                        ...activeItem.document_slide,
                        title: heading,
                    },
                    new_slide: false,
                    notify: false,
                });
                setIsEditing(false);
                return;
            }
            // if (activeItem.document_slide?.type == 'DOC') await SaveDraft(activeItem);

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
            try {
                const { setActiveItem, items, setItems } =
                    require('@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store').useContentStore.getState();
                setActiveItem({ ...activeItem, title: heading });
                if (Array.isArray(items)) {
                    setItems(
                        items.map((item) =>
                            item.id === activeItem.id ? { ...item, title: heading } : item
                        )
                    );
                }
            } catch (e) {}
        } else if (activeItem.source_type === 'ASSIGNMENT' && updateAssignmentOrder) {
            // Assignment title update
            const convertedData = converDataToAssignmentFormat({
                activeItem: { ...activeItem, title: heading },
                status,
                notify: false,
                newSlide: false,
            });
            await updateAssignmentOrder(convertedData);
            try {
                const { setActiveItem, items, setItems } =
                    require('@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store').useContentStore.getState();
                setActiveItem({ ...activeItem, title: heading });
                if (Array.isArray(items)) {
                    setItems(
                        items.map((item) =>
                            item.id === activeItem.id ? { ...item, title: heading } : item
                        )
                    );
                }
            } catch (e) {}
        } else if (activeItem.source_type === 'QUESTION' && updateQuestionOrder) {
            // Question title update
            const convertedData = convertToQuestionBackendSlideFormat({
                activeItem: { ...activeItem, title: heading },
                status,
                notify: false,
                newSlide: false,
            });
            await updateQuestionOrder(convertedData);
            try {
                const { setActiveItem, items, setItems } =
                    require('@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store').useContentStore.getState();
                setActiveItem({ ...activeItem, title: heading });
                if (Array.isArray(items)) {
                    setItems(
                        items.map((item) =>
                            item.id === activeItem.id ? { ...item, title: heading } : item
                        )
                    );
                }
            } catch (e) {}
        } else if (activeItem.source_type === 'QUIZ' && addUpdateQuizSlide) {
            // Quiz title update
            const newQuizSlide = {
                ...activeItem.quiz_slide,
                id: activeItem.quiz_slide?.id || '',
                title: heading,
                description: activeItem.quiz_slide?.description || {
                    id: '',
                    content: '',
                    type: 'TEXT',
                },
                questions: activeItem.quiz_slide?.questions || [],
            };
            const newSlide = { ...activeItem, title: heading, quiz_slide: newQuizSlide };
            try {
                const { setActiveItem, items, setItems } =
                    require('@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store').useContentStore.getState();
                setActiveItem(newSlide);
                if (Array.isArray(items)) {
                    setItems(items.map((item) => (item.id === activeItem.id ? newSlide : item)));
                }
            } catch (e) {}
            const payload = createQuizSlidePayload(activeItem.quiz_slide?.questions || [], {
                ...activeItem,
                title: heading,
                quiz_slide: newQuizSlide,
                status,
            });
            await addUpdateQuizSlide(payload);
        }
    }
    setIsEditing(false);
};
