interface Option {
    name?: string;
    isSelected?: boolean;
}

interface QuestionDuration {
    hrs: string;
    min: string;
}

interface AssessmentQuestionPreview {
    id: string;
    questionId?: string;
    questionName: string;
    explanation?: string;
    questionType: string; // Assuming types based on standard question formats
    questionPenalty: string;
    questionDuration: QuestionDuration;
    questionMark: string;
    singleChoiceOptions: Option[];
    multipleChoiceOptions: Option[];
}

interface QuestionStatus {
    questionId: string;
    correctAttempt: number;
    incorrectAttempt: number;
    partialCorrectAttempt: number;
}

interface top3CorrectResponse {
    userId: string;
    timeTakenInSeconds: number;
    name: string;
}

export interface AssessmentRevaluateQuestionWiseInterface {
    assessment_question_preview_dto: AssessmentQuestionPreview;
    question_status: QuestionStatus;
    skipped: number;
    top3_correct_response_dto: top3CorrectResponse[]; // Assuming unknown structure
    total_attempts: number;
}

export interface SelectedFilterRevaluateInterface {
    questions: {
        section_id: string;
        question_ids: string[];
    }[];
    attempt_ids: string[];
}
