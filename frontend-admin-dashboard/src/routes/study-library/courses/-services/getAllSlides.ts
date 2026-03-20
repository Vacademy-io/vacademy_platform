import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_CHAPTERS_WITH_SLIDES, GET_SLIDES } from '@/constants/urls';

export const fetchChaptersWithSlides = async (moduleId: string, packageSessionId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_CHAPTERS_WITH_SLIDES, {
        params: {
            moduleId,
            packageSessionId,
        },
    });
    return response.data;
};

export const handleFetchChaptersWithSlides = (moduleId: string, packageSessionId: string) => {
    return {
        queryKey: ['GET_CHAPTERS_WITH_SLIDES', moduleId, packageSessionId],
        queryFn: () => fetchChaptersWithSlides(moduleId, packageSessionId),
        staleTime: 60 * 60 * 1000,
    };
};

export const fetchSlidesOnly = async (chapterId: string) => {
    const response = await authenticatedAxiosInstance.get(`${GET_SLIDES}`, {
        params: {
            chapterId,
        },
    });
    return response.data;
};

export const handleFetchSlides = (chapterId: string) => {
    return {
        queryKey: ['GET_SLIDES_ONLY_OF_CHAPTERS', chapterId],
        queryFn: () => fetchSlidesOnly(chapterId),
        staleTime: 60 * 60 * 1000,
    };
};

// Fetch slides directly for packageSessionId (for 2-depth courses)
export const fetchDirectSlides = async (packageSessionId: string) => {
    const response = await authenticatedAxiosInstance.get(`${GET_SLIDES}`, {
        params: {
            packageSessionId,
        },
    });
    return response.data;
};

export const handleFetchDirectSlides = (packageSessionId: string) => {
    return {
        queryKey: ['GET_DIRECT_SLIDES', packageSessionId],
        queryFn: () => fetchDirectSlides(packageSessionId),
        staleTime: 60 * 60 * 1000,
    };
};

export type RichTextData = {
    id: string;
    type: string;
    content: string;
};

export type Option = {
    id: string;
    text: RichTextData;
    explanation_text_data: RichTextData;
    media_id: string;
};

export type Question = {
    id: string;
    parent_rich_text: RichTextData;
    text_data: RichTextData;
    explanation_text_data: RichTextData;
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
};

export type VideoSlide = {
    id: string;
    description: string;
    title: string;
    url: string;
    video_length_in_millis: number;
    published_url: string;
    published_video_length_in_millis: number;
    source_type: string;
    questions: Question[];
};

export type DocumentSlide = {
    id: string;
    type: string;
    data: string;
    title: string;
    cover_file_id: string;
    total_pages: number;
    published_data: string;
    published_document_total_pages: number;
};

export type QuestionSlide = {
    id: string;
    parent_rich_text: RichTextData;
    text_data: RichTextData;
    explanation_text_data: RichTextData;
    media_id: string;
    question_response_type: string;
    question_type: string;
    access_level: string;
    auto_evaluation_json: string;
    evaluation_type: string;
    default_question_time_mins: number;
    re_attempt_count: number;
    points: number;
    options: (Option & { question_slide_id: string })[];
    source_type: string;
};

export type AssignmentSlide = {
    id: string;
    parent_rich_text: RichTextData;
    text_data: RichTextData;
    live_date: string;
    end_date: string;
    re_attempt_count: number;
    comma_separated_media_ids: string;
    questions: AssignmentQuestion[];
};

export type AssignmentQuestion = {
    id: string;
    text_data: RichTextData;
    question_order: number;
    status: string;
    new_question: boolean;
    question_type: string;
};

export type Slide = {
    id: string;
    source_id: string;
    source_type: string;
    title: string;
    image_file_id: string;
    description: string;
    status: string;
    slide_order: number;
    video_slide?: VideoSlide;
    document_slide?: DocumentSlide;
    question_slide?: QuestionSlide;
    assignment_slide?: AssignmentSlide;
    is_loaded: boolean;
    new_slide: boolean;
};

export type Chapter = {
    id: string;
    chapter_name: string;
    status: string;
    file_id: string;
    description: string;
    chapter_order: number;
};

export type ChapterWithSlides = {
    chapter: Chapter;
    slides: Slide[];
};

export type UseSlidesFromModulesInput = {
    modules: { id: string }[];
    packageSessionId: string;
};
