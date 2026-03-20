export interface QuestionText {
    id: string;
    type: string;
    content: string;
}

export interface Option {
    id: string;
    preview_id: string;
    question_id: string;
    text: QuestionText;
    media_id: string;
    option_order: number;
    created_on: string;
    updated_on: string;
    explanation_text: QuestionText;
}

export interface Question {
    id: string;
    preview_id: string;
    section_id: string;
    question_order_in_section: number;
    text: QuestionText;
    media_id: string;
    created_at: string;
    updated_at: string;
    question_response_type: string;
    question_type: string;
    access_level: string;
    auto_evaluation_json: string;
    parsed_evaluation_object: object;
    evaluation_type: string;
    explanation_text: QuestionText;
    default_question_time_mins: number;
    options: Option[];
    errors: string[];
    warnings: string[];
}

export interface QuestionDtoList {
    question_dtolist: Question[];
}
