/** Question papers generated from a knowledge base — mirrors ai_service kb/paper.py. */

export type PaperQuestionType = 'MCQS' | 'ONE_WORD' | 'LONG_ANSWER' | 'NUMERIC';
export type PaperDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface BlueprintRow {
    id: string;
    section: string;
    topic: string;
    /** Summary-tree anchors. A row with none of these cannot be generated. */
    node_ids: string[];
    page_start: number | null;
    page_end: number | null;
    question_type: PaperQuestionType;
    count: number;
    marks_each: number;
    difficulty: PaperDifficulty;
    instruction: string | null;
    total_marks: number;
}

export interface Blueprint {
    title: string;
    rows: BlueprintRow[];
    duration_minutes: number | null;
    instructions: string[];
    language: string | null;
    /** Coverage warnings from the planner — e.g. "chapter 4 has little numerical material". */
    notes: string[];
    total_questions: number;
    total_marks: number;
}

export interface PaperSpec {
    total_marks?: number;
    duration_minutes?: number;
    difficulty?: string;
    question_types?: PaperQuestionType[];
    grade?: string;
    language?: string;
    exam_style?: string;
}

export interface CreditEstimate {
    tool_key: string;
    estimated_credits: number;
    current_balance: number | null;
    balance_after: number | null;
    sufficient: boolean | null;
}

export interface BlueprintResponse {
    blueprint: Blueprint;
    /** What generating THIS plan will cost — shown on the button before committing. */
    generation_estimate: CreditEstimate;
}

/** The rich-text wrapper assessment_service stores. */
export interface RichText {
    id?: string | null;
    type?: string | null;
    content?: string | null;
}

/** QuestionDTO — the shape the assessment builder and question bank consume. */
export interface PaperQuestion {
    preview_id?: string | null;
    text?: RichText | null;
    explanation_text?: RichText | null;
    question_type?: string | null;
    question_response_type?: string | null;
    access_level?: string | null;
    auto_evaluation_json?: string | null;
    options?: Array<{
        preview_id?: string | null;
        text?: RichText | null;
        explanation_text?: RichText | null;
    }>;
    tags?: string[];
    level?: string | null;
    [key: string]: unknown;
}

/** The raw generator output, kept alongside so the review board can show provenance. */
export interface RawPaperQuestion {
    question_number?: number;
    question?: { type?: string; content?: string };
    options?: Array<{ preview_id?: string; content?: string }>;
    correct_options?: string[];
    ans?: string;
    exp?: string;
    question_type?: string;
    level?: string;
    tags?: string[];
    source_page?: number;
    kb_meta?: {
        row_id?: string;
        section?: string;
        topic?: string;
        marks?: number;
        source_page?: number;
        figures?: Array<{ image_url: string; page_number: number | null }>;
    };
}

export interface PaperIssue {
    question_number: number | null;
    severity: 'error' | 'warning';
    kind: string;
    message: string;
}

export interface PaperResult {
    blueprint: Blueprint;
    questions: PaperQuestion[];
    raw_questions: RawPaperQuestion[];
    issues: PaperIssue[];
    warnings: string[];
    delivered: number;
    planned: number;
}

export interface PaperJob {
    task_id: string;
    status: string;
    status_message: string | null;
    result: PaperResult | null;
}
