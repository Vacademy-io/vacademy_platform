export interface TestReport {
    testInfo: TestInfo;
    charts: TestCharts;
    answerReview: AnswerReview[];
}

export interface TestInfo {
    testName: string;
    description?: string;
    subject: string;
    duration: string;
    attemptDate: string;
    marks: string;
    endTime: string;
    startTime: string;
}

export interface TestCharts {
    responseBreakdown: {
        attempted: number;
        skipped: number;
        total: number;
    };
    marksBreakdown: {
        correctAnswers?: {
            count: number;
            marks: string;
        };
        partiallyCorrectAnswers?: {
            count: number;
            marks: string;
        };
        incorrectAnswers?: {
            count: number;
            marks: string;
        };
        notAttempted?: {
            count: number;
            marks: string;
        };
        total: {
            count: number;
            marks: string;
        };
    };
}

export interface AnswerReview {
    questionNumber: number;
    question: string;
    marks: string;
    status: 'correct' | 'incorrect' | 'not-attempted';
    studentAnswer?: string;
    correctAnswer: string;
    explanation: string;
}
