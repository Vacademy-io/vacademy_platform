interface QuickResponse {
    name: string;
    time: number;
}

interface CorrectOption {
    optionId: string;
    optionName: string;
}

interface CorrectOptionIds {
    type: string;
    data: CorrectOption[];
}

interface QuestionAttemptedAnalysis {
    totalAttempt: number;
    correct: number;
    partiallyCorrect: number;
    wrongResponse: number;
    skipped: number;
}

export interface QuestionInsights {
    questionId: string;
    questionName: string;
    correctOptionIds: CorrectOptionIds;
    questionExplanation: string;
    quickResponses: QuickResponse[];
    questionAttemptedAnalysis: QuestionAttemptedAnalysis;
}

interface SectionInsights {
    id: string;
    sectionName: string;
    questions: QuestionInsights[];
}

export type QuestionInsightsData = SectionInsights[];
