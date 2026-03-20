// Survey-related constants
export const SURVEY_CONSTANTS = {
    // Default pagination
    DEFAULT_PAGE_SIZE: 10,
    DEFAULT_PAGE_NO: 1,
    
    // Survey types
    SURVEY_TYPES: {
        PUBLIC: 'PUBLIC',
        PRIVATE: 'PRIVATE',
    } as const,
    
    // Question types
    QUESTION_TYPES: {
        MCQS: 'MCQS',
        MCQM: 'MCQM',
        TRUE_FALSE: 'TRUE_FALSE',
        ONE_WORD: 'ONE_WORD',
        LONG_ANSWER: 'LONG_ANSWER',
        NUMERIC: 'NUMERIC',
        RATING: 'RATING',
    } as const,
    
    // Response types
    RESPONSE_TYPES: {
        MCQS: 'MCQS',
        MCQM: 'MCQM',
        TRUE_FALSE: 'TRUE_FALSE',
        ONE_WORD: 'ONE_WORD',
        LONG_ANSWER: 'LONG_ANSWER',
        NUMERIC: 'NUMERIC',
    } as const,
    
    // Error messages
    ERROR_MESSAGES: {
        INSTITUTE_ID_NOT_FOUND: 'Institute ID not found',
        ASSESSMENT_ID_REQUIRED: 'Assessment ID is required',
        BATCH_IDS_REQUIRED: 'Batch IDs are required',
        SECTION_IDS_REQUIRED: 'Section IDs are required',
        UNKNOWN_ERROR: 'An unknown error occurred',
    } as const,
    
    // API response status
    API_STATUS: {
        SUCCESS: 'success',
        ERROR: 'error',
        LOADING: 'loading',
    } as const,
} as const;

// Type definitions for constants
export type SurveyType = typeof SURVEY_CONSTANTS.SURVEY_TYPES[keyof typeof SURVEY_CONSTANTS.SURVEY_TYPES];
export type QuestionType = typeof SURVEY_CONSTANTS.QUESTION_TYPES[keyof typeof SURVEY_CONSTANTS.QUESTION_TYPES];
export type ResponseType = typeof SURVEY_CONSTANTS.RESPONSE_TYPES[keyof typeof SURVEY_CONSTANTS.RESPONSE_TYPES];
export type ApiStatus = typeof SURVEY_CONSTANTS.API_STATUS[keyof typeof SURVEY_CONSTANTS.API_STATUS];
