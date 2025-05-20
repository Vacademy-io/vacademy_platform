interface Option {
    option_id: string; // UUID
    option_name: string;
}

interface Question {
    question_id: string; // UUID
    question_name: string;
    student_response_options: Option[];
    correct_options: Option[];
    explanation_id: string; // UUID
    explanation: string;
    mark: number;
    time_taken_in_seconds: number;
    answer_status: string;
}

interface AllSections {
    [sectionId: string]: Question[]; // Dynamic section ID as key
}

interface QuestionOverallDetailDTO {
    submitTime: string;
    completionTimeInSeconds: number;
    totalCorrectMarks: number;
    totalIncorrectMarks: number;
    rank: number;
    achievedMarks: number;
    percentile: number;
    wrongAttempt: number;
    skippedCount: number;
    totalPartialMarks: number;
    startTime: string; // ISO date string
    subjectId: string; // UUID
    attemptId: string; // UUID
    correctAttempt: number;
    partialCorrectAttempt: number;
    userId: string; // UUID
}

export interface AssessmentTestReport {
    all_sections: AllSections;
    question_overall_detail_dto: QuestionOverallDetailDTO;
}
