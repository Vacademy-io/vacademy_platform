// hooks/use-slides.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_SLIDES,
    ADD_UPDATE_VIDEO_SLIDE,
    ADD_UPDATE_DOCUMENT_SLIDE,
    UPDATE_SLIDE_STATUS,
    UPDATE_SLIDE_ORDER,
    UPDATE_QUESTION_ORDER,
    UPDATE_ASSIGNMENT_ORDER,
} from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { SlideQuestionsDataInterface } from '@/types/study-library/study-library-slides-type';
import { cleanVideoQuestions } from '../-helper/helper';

// Common interfaces
export interface TextData {
    id: string;
    type: string;
    content: string;
}

export interface Option {
    id: string;
    text: TextData;
    explanation_text_data: TextData;
    media_id: string;
}

export interface QuestionSlideOption extends Option {
    question_slide_id: string;
}

// Video question interface
export interface VideoQuestion {
    id: string;
    parent_rich_text: TextData;
    text_data: TextData;
    explanation_text_data: TextData;
    media_id: string;
    question_response_type: string;
    question_type: string;
    access_level: string;
    auto_evaluation_json: string;
    evaluation_type: string;
    question_time_in_millis: number;
    question_order: number;
    status: string;
    options: Option[];
    new_question: boolean;
}

// Video slide interface
export interface VideoSlide {
    id: string;
    description: string;
    title: string;
    url: string;
    video_length_in_millis: number;
    published_url: string;
    published_video_length_in_millis: number;
    source_type: string;
    questions: VideoQuestion[];
}

// Document slide interface
export interface DocumentSlide {
    id: string;
    type: string;
    data: string;
    title: string;
    cover_file_id: string;
    total_pages: number;
    published_data: string;
    published_document_total_pages: number;
}

// Question slide interface
export interface QuestionSlide {
    id: string;
    parent_rich_text: TextData;
    text_data: TextData;
    explanation_text_data: TextData;
    media_id: string;
    question_response_type: string;
    question_type: string;
    access_level: string;
    auto_evaluation_json: string;
    evaluation_type: string;
    default_question_time_mins: number;
    re_attempt_count: number;
    points: number;
    options: QuestionSlideOption[];
    source_type: string;
}

// Assignment slide interface
export interface AssignmentSlide {
    id: string;
    parent_rich_text: TextData;
    text_data: TextData;
    live_date: string; // ISO 8601 date format
    end_date: string; // ISO 8601 date format
    re_attempt_count: number;
    comma_separated_media_ids: string;
    questions: AssignmentQuestion[];
}

export interface AssignmentQuestion {
    id: string;
    text_data: TextData;
    question_order: number;
    status: string;
    new_question: boolean;
    question_type: string;
}

// Main slide interface
export interface Slide {
    id: string;
    source_id: string;
    source_type: string;
    title: string;
    image_file_id: string;
    description: string;
    status: string;
    slide_order: number;
    video_slide?: VideoSlide | null;
    document_slide?: DocumentSlide | null;
    question_slide?: QuestionSlide | null;
    assignment_slide?: AssignmentSlide | null;
    is_loaded: boolean;
    new_slide: boolean;
}

export interface VideoSlidePayload {
    id?: string | null;
    title: string;
    description: string | null;
    image_file_id: string | null;
    slide_order: number | null;
    video_slide: {
        id: string;
        description: string;
        url: string | null;
        title: string;
        video_length_in_millis: number;
        published_url: string | null;
        published_video_length_in_millis: number;
        source_type: string;
    };
    status: string;
    new_slide?: boolean;
    notify: boolean;
}

export interface DocumentSlidePayload {
    id: string | null;
    title: string;
    image_file_id: string;
    description: string | null;
    slide_order: number | null;
    document_slide: {
        id: string;
        type: string;
        data: string | null;
        title: string;
        cover_file_id: string;
        total_pages: number;
        published_data: string | null;
        published_document_total_pages: number;
    };
    status: string;
    new_slide: boolean;
    notify: boolean;
}

interface UpdateStatusParams {
    chapterId: string;
    slideId: string;
    status: string;
    instituteId: string;
}

export type slideOrderPayloadType = {
    slide_id: string;
    slide_order: number | null;
}[];

interface UpdateSlideOrderParams {
    chapterId: string;
    slideOrderPayload: slideOrderPayloadType;
}

export const useSlides = (chapterId: string) => {
    const queryClient = useQueryClient();
    const { setItems } = useContentStore();
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];

    const getSlidesQuery = useQuery({
        queryKey: ['slides', chapterId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(
                `${GET_SLIDES}?chapterId=${chapterId}`
            );
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            setItems(cleanVideoQuestions(response.data));
            return cleanVideoQuestions(response.data);
        },
        staleTime: 3600000,
    });

    const addUpdateVideoSlideMutation = useMutation({
        mutationFn: async (payload: VideoSlidePayload) => {
            const response = await authenticatedAxiosInstance.post(
                `${ADD_UPDATE_VIDEO_SLIDE}?chapterId=${chapterId}&instituteId=${INSTITUTE_ID}`,
                payload
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });

    const addUpdateDocumentSlideMutation = useMutation({
        mutationFn: async (payload: DocumentSlidePayload) => {
            const response = await authenticatedAxiosInstance.post(
                `${ADD_UPDATE_DOCUMENT_SLIDE}?chapterId=${chapterId}&instituteId=${INSTITUTE_ID}`,
                payload
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });

    const updateSlideStatus = useMutation({
        mutationFn: async ({ chapterId, slideId, status, instituteId }: UpdateStatusParams) => {
            return await authenticatedAxiosInstance.put(
                `${UPDATE_SLIDE_STATUS}?chapterId=${chapterId}&slideId=${slideId}&status=${status}&instituteId=${instituteId}`
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });

    const updateSlideOrderMutation = useMutation({
        mutationFn: async ({ chapterId, slideOrderPayload }: UpdateSlideOrderParams) => {
            return await authenticatedAxiosInstance.put(
                `${UPDATE_SLIDE_ORDER}?chapterId=${chapterId}`,
                slideOrderPayload
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });

    const updateQuestionSlideMutation = useMutation({
        mutationFn: async (payload: SlideQuestionsDataInterface) => {
            const response = await authenticatedAxiosInstance.post(
                `${UPDATE_QUESTION_ORDER}?chapterId=${chapterId}&instituteId=${INSTITUTE_ID}`,
                payload
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });

    const updateAssignmentSlideMutation = useMutation({
        mutationFn: async (payload: SlideQuestionsDataInterface) => {
            const response = await authenticatedAxiosInstance.post(
                `${UPDATE_ASSIGNMENT_ORDER}?chapterId=${chapterId}&instituteId=${INSTITUTE_ID}`,
                payload
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });

    return {
        slides: getSlidesQuery.data,
        isLoading: getSlidesQuery.isLoading,
        error: getSlidesQuery.error,
        refetch: getSlidesQuery.refetch,
        addUpdateVideoSlide: addUpdateVideoSlideMutation.mutateAsync,
        addUpdateDocumentSlide: addUpdateDocumentSlideMutation.mutateAsync,
        updateSlideStatus: updateSlideStatus.mutateAsync,
        updateSlideOrder: updateSlideOrderMutation.mutateAsync,
        updateQuestionOrder: updateQuestionSlideMutation.mutateAsync,
        updateAssignmentOrder: updateAssignmentSlideMutation.mutateAsync,
        isUpdating:
            addUpdateVideoSlideMutation.isPending ||
            addUpdateDocumentSlideMutation.isPending ||
            updateSlideOrderMutation.isPending ||
            updateQuestionSlideMutation.isPending ||
            updateAssignmentSlideMutation.isPending,
    };
};
