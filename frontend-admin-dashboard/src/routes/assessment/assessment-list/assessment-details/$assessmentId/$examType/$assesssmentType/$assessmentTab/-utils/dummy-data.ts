interface StudentDetails {
    userId: string;
    name: string;
    batch?: string;
    enrollmentNumber?: string;
    gender: string;
    responseTime: number;
}

interface ResponseList {
    type: string;
    studentDetails: StudentDetails[];
}

interface QuestionAttemptedAnalysis {
    totalAttempt: number;
    correct: number;
    partiallyCorrect: number;
    wrongResponse: number;
    skipped: number;
}

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

interface Question {
    questionId: string;
    questionName: string;
    correctOptionIds: CorrectOptionIds;
    questionExplanation: string;
    quickResponses: QuickResponse[];
    questionAttemptedAnalysis: QuestionAttemptedAnalysis;
    studentResponseList: {
        correctResponse: ResponseList[];
        partiallyCorrect: ResponseList[];
        wrongResponse: ResponseList[];
        skipped: ResponseList[];
    };
}

interface Section {
    id: string;
    sectionName: string;
    questions: Question[];
}

export const questionInsightsData: Section[] = [
    {
        id: "1",
        sectionName: "Section 1",
        questions: [
            {
                questionId: "1",
                questionName: "What is the capital of France?",
                correctOptionIds: { type: "MCQM", data: [{ optionId: "0", optionName: "Paris" }] },
                questionExplanation:
                    "The iris is the colored part of the eye that adjusts the size of the pupil to control the amount of light entering.",
                quickResponses: [
                    { name: "Chomu Kumar 1", time: 0.35 },
                    { name: "Chomu Kumar 2", time: 0.45 },
                    { name: "Chomu Kumar 3", time: 0.4 },
                ],
                questionAttemptedAnalysis: {
                    totalAttempt: 48,
                    correct: 33,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "2",
                questionName: "Which planet is known as the Red Planet?",
                correctOptionIds: { type: "MCQM", data: [{ optionId: "1", optionName: "Mars" }] },
                questionExplanation: "Mars is called the Red Planet due to its reddish appearance.",
                quickResponses: [
                    { name: "Chomu Kumar 4", time: 0.55 },
                    { name: "Chomu Kumar 5", time: 0.65 },
                ],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "3",
                questionName: "What is 5 + 3?",
                correctOptionIds: { type: "MCQM", data: [{ optionId: "2", optionName: "8" }] },
                questionExplanation: "5 + 3 equals 8.",
                quickResponses: [
                    { name: "Chomu Kumar 6", time: 0.25 },
                    { name: "Chomu Kumar 7", time: 0.3 },
                ],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "4",
                questionName: "Who wrote 'Hamlet'?",
                correctOptionIds: {
                    type: "MCQM",
                    data: [{ optionId: "3", optionName: "Shakespeare" }],
                },
                questionExplanation: "William Shakespeare wrote 'Hamlet'.",
                quickResponses: [
                    { name: "Chomu Kumar 8", time: 0.7 },
                    { name: "Chomu Kumar 9", time: 0.8 },
                ],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "5",
                questionName: "What is the chemical symbol for gold?",
                correctOptionIds: { type: "MCQM", data: [{ optionId: "3", optionName: "Au" }] },
                questionExplanation: "The chemical symbol for gold is Au.",
                quickResponses: [{ name: "Chomu Kumar 10", time: 0.45 }],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: "2",
        sectionName: "Section 2",
        questions: [
            {
                questionId: "6",
                questionName: "What is the largest ocean on Earth?",
                correctOptionIds: {
                    type: "MCQM",
                    data: [{ optionId: "0", optionName: "Pacific Ocean" }],
                },
                questionExplanation: "The Pacific Ocean is the largest ocean on Earth.",
                quickResponses: [{ name: "Chomu Kumar 11", time: 0.33 }],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "7",
                questionName: "How many continents are there?",
                correctOptionIds: { type: "MCQM", data: [{ optionId: "1", optionName: "7" }] },
                questionExplanation: "There are 7 continents on Earth.",
                quickResponses: [{ name: "Chomu Kumar 12", time: 0.5 }],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "8",
                questionName: "Who discovered gravity?",
                correctOptionIds: {
                    type: "MCQM",
                    data: [{ optionId: "2", optionName: "Isaac Newton" }],
                },
                questionExplanation:
                    "Isaac Newton discovered gravity when an apple fell from a tree.",
                quickResponses: [{ name: "Chomu Kumar 13", time: 0.6 }],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "9",
                questionName: "What gas do plants absorb from the atmosphere?",
                correctOptionIds: {
                    type: "MCQM",
                    data: [{ optionId: "3", optionName: "Carbon Dioxide" }],
                },
                questionExplanation: "Plants absorb carbon dioxide during photosynthesis.",
                quickResponses: [{ name: "Chomu Kumar 14", time: 0.45 }],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                questionId: "10",
                questionName: "What is the hardest natural substance on Earth?",
                correctOptionIds: {
                    type: "MCQM",
                    data: [{ optionId: "3", optionName: "Diamond" }],
                },
                questionExplanation: "Diamond is the hardest known natural substance.",
                quickResponses: [{ name: "Chomu Kumar 15", time: 0.38 }],
                questionAttemptedAnalysis: {
                    totalAttempt: 50,
                    correct: 35,
                    partiallyCorrect: 2,
                    wrongResponse: 12,
                    skipped: 1,
                },
                studentResponseList: {
                    correctResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    partiallyCorrect: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    wrongResponse: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                    skipped: [
                        {
                            type: "internal",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    batch: "1",
                                    enrollmentNumber: "ENR12345",
                                    gender: "Male",
                                    responseTime: 2,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    batch: "2",
                                    enrollmentNumber: "ENR67890",
                                    gender: "Female",
                                    responseTime: 1,
                                },
                            ],
                        },
                        {
                            type: "external",
                            studentDetails: [
                                {
                                    userId: "1",
                                    name: "John Doe",
                                    gender: "male",
                                    responseTime: 1,
                                },
                                {
                                    userId: "2",
                                    name: "Jane Smith",
                                    gender: "male",
                                    responseTime: 1,
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    },
];

export const asssessmentDetailsData: {
    type: string;
    title: string;
    mode: string;
    status: string;
} = {
    type: "close",
    title: "The Human Eye and The Colourful World",
    mode: "offline",
    status: "active",
};
