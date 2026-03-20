import { create } from 'zustand';

export type SlideType = {
    id: string;
    source_id: string;
    source_type: string;
    title: string;
    image_file_id: string;
    description: string;
    status: string;
    slide_order: number;
    video_slide?: {
        id: string;
        description: string;
        title: string;
        url: string;
        video_length_in_millis: number;
        published_url: string;
        published_video_length_in_millis: number;
        source_type: string;
        questions: Array<{
            id: string;
            parent_rich_text: {
                id: string;
                type: string;
                content: string;
            };
            text_data: {
                id: string;
                type: string;
                content: string;
            };
            explanation_text_data: {
                id: string;
                type: string;
                content: string;
            };
            media_id: string;
            question_response_type: string;
            question_type: string;
            access_level: string;
            auto_evaluation_json: string;
            evaluation_type: string;
            question_time_in_millis: number;
            question_order: number;
            status: string;
            can_skip: boolean;
            options: Array<{
                id: string;
                text: {
                    id: string;
                    type: string;
                    content: string;
                };
                explanation_text_data: {
                    id: string;
                    type: string;
                    content: string;
                };
                media_id: string;
                preview_id: string;
            }>;
            new_question: boolean;
        }>;
    };
    document_slide?: {
        id: string;
        type: string;
        data: string;
        title: string;
        cover_file_id: string;
        total_pages: number;
        published_data: string;
        published_document_total_pages: number;
    };
    question_slide?: {
        id: string;
        parent_rich_text: {
            id: string;
            type: string;
            content: string;
        };
        text_data: {
            id: string;
            type: string;
            content: string;
        };
        explanation_text_data: {
            id: string;
            type: string;
            content: string;
        };
        media_id: string;
        question_response_type: string;
        question_type: string;
        access_level: string;
        auto_evaluation_json: string;
        evaluation_type: string;
        default_question_time_mins: number;
        re_attempt_count: number;
        points: number;
        options: Array<{
            id: string;
            question_slide_id: string;
            text: {
                id: string;
                type: string;
                content: string;
            };
            explanation_text_data: {
                id: string;
                type: string;
                content: string;
            };
            media_id: string;
            preview_id: string;
        }>;
        source_type: string;
    };
    assignment_slide?: {
        id: string;
        parent_rich_text: {
            id: string;
            type: string;
            content: string;
        };
        text_data: {
            id: string;
            type: string;
            content: string;
        };
        live_date: string;
        end_date: string;
        re_attempt_count: number;
        comma_separated_media_ids: string;
        questions: Array<{
            id: string;
            text_data: {
                id: string;
                type: string;
                content: string;
            };
            question_order: number;
            status: string;
            new_question: boolean;
        }>;
    };
    is_loaded: boolean;
    new_slide: boolean;
};

export type ChapterWithSlides = {
    chapter: {
        id: string;
        chapter_name: string;
        status: string;
        file_id: string;
        description: string;
        chapter_order: number;
    };
    slides: SlideType[];
};

interface ChaptersWithSlidesState {
    chaptersWithSlidesData: ChapterWithSlides[] | null;
    setChaptersWithSlidesData: (data: ChapterWithSlides[] | null) => void;
}

export const useChaptersWithSlidesStore = create<ChaptersWithSlidesState>((set) => ({
    chaptersWithSlidesData: null,
    setChaptersWithSlidesData: (data) => set({ chaptersWithSlidesData: data }),
}));
