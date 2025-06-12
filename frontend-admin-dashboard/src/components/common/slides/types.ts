export interface Slide {
    id: string;
    elements: unknown;
    type?: string;
}

// Sample presentation data
// Root presentation structure
export interface Presentation {
    id: string;
    title: string;
    description: string;
    cover_file_id: string;
    added_slides: SlideData[];
}

// Slide types: can be a visual slide or a question-based slide
interface SlideData {
    id: string;
    presentation_id: string | null;
    title: string;
    source_id: string | null;
    source: 'question' | 'excalidraw' | string;
    status: string | null;
    interaction_status: string;
    slide_order: number;
    default_time: number;
    content: string;
    created_at: string | null;
    updated_at: string | null;
    added_question?: Question | null;
    updated_question?: Question | null;
}

// Question embedded in a slide
interface Question {
    id: string;
    preview_id: string | null;
    section_id: string | null;
    question_order_in_section: number | null;
    text: RichText;
    media_id: string;
    created_at: string;
    updated_at: string;
    question_response_type: 'OPTION' | string;
    question_type: 'MCQS' | string;
    access_level: 'PRIVATE' | 'PUBLIC' | string;
    auto_evaluation_json: string;
    options_json: string | null;
    parsed_evaluation_object: Record<string, string>;
    evaluation_type: 'auto' | 'manual' | string;
    explanation_text: RichText;
    parent_rich_text_id: string | null;
    parent_rich_text: RichText | null;
    default_question_time_mins: number | null;
    options: Option[];
    errors: string[];
    warnings: string[];
}

// Text or explanation content
interface RichText {
    id: string | null;
    type: string;
    content: string | null;
}

// Options for multiple-choice questions
interface Option {
    id: string;
    preview_id: string | null;
    question_id: string;
    text: RichText;
    media_id: string;
    option_order: number | null;
    created_on: string;
    updated_on: string;
    explanation_text: RichText | null;
}
