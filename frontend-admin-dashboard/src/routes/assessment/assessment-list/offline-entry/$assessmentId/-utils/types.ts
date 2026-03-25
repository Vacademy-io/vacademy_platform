export interface OfflineQuestionResponse {
    question_id: string;
    type: string;
    option_ids: string[];
}

export interface OfflineSectionResponse {
    section_id: string;
    questions: OfflineQuestionResponse[];
}

export interface OfflineResponseSubmitRequest {
    sections: OfflineSectionResponse[];
}

export interface OfflineAttemptCreateResponse {
    attempt_id: string;
    registration_id: string;
    assessment_id: string;
}

export interface DirectMarksSubmitRequest {
    set_id?: string;
    file_id?: string;
    data_json?: string;
    request: DirectMarksQuestionDto[];
}

export interface DirectMarksQuestionDto {
    section_id: string;
    question_id: string;
    status: string;
    marks: number;
}

// Per-question response state tracked by the UI
export interface QuestionResponseState {
    selectedOptionIds: string[];
    marks?: number;
    status?: string;
}

// Map of questionId -> response state
export type OfflineResponseState = Record<string, QuestionResponseState>;

export type ScoringMode = 'AUTO_CALCULATE' | 'DIRECT_MARKS';
