// hooks/use-slides.ts
import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
    GET_SLIDES,
} from "@/constants/urls";

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
    slide_order: number ;
    video_slide?: VideoSlide;
    document_slide?: DocumentSlide;
    question_slide?: QuestionSlide;
    assignment_slide?: AssignmentSlide;
    is_loaded: boolean;
    new_slide: boolean;
    percentage_completed: number;
    progress_marker: number;
}

export const fetchSlidesByChapterId = async (chapterId: string): Promise<Slide[]> => {
  const response = await authenticatedAxiosInstance.get(`${GET_SLIDES}?chapterId=${chapterId}`);
  return response.data;
};

export const useSlides = (chapterId: string) => {

    const getSlidesQuery = useQuery({
        queryKey: ["slides", chapterId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(`${GET_SLIDES}?chapterId=${chapterId}`);
            return response.data;
        },
        staleTime: 3600000,
    });
    

    return {
        slides: getSlidesQuery.data,
        isLoading: getSlidesQuery.isLoading,
        error: getSlidesQuery.error
    };
};
