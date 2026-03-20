export interface SummaryData {
    overview: string;
    key_points: string[];
}

export interface NoteData {
    topic: string;
    content: string;
}

export interface QuizQuestion {
    text: { content: string };
    options: Array<{
        preview_id: string;
        text: { content: string };
    }>;
    auto_evaluation_json: string;
    explanation_text?: { content: string };
    level?: string;
    question_type?: string;
    tags?: string[];
}

export interface QuizData {
    title: string;
    questions: QuizQuestion[];
    difficulty?: string;
    subjects?: string[];
    classes?: string[];
}

export interface QuizPDFOptions {
    showAnswers: boolean;
    showExplanations: boolean;
}
