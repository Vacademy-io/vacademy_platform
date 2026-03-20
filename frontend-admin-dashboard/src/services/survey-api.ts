import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    SURVEY_RESPONDENT_RESPONSE,
    SURVEY_SETUP,
    SURVEY_INDIVIDUAL_RESPONSE,
    SURVEY_OVERVIEW,
    SURVEY_QUESTIONS_WITH_SECTIONS,
    BATCH_DETAILS,
} from '@/constants/urls';

// API Response Types
export interface SurveyRespondentResponse {
    question: string;
    question_type: string;
    response: string;
    name: string;
    email: string;
}

export interface SurveyRespondentResponseData {
    content: SurveyRespondentResponse[];
    page_no: number;
    page_size: number;
    total_pages: number;
    total_elements: number;
    last: boolean;
}

export interface SurveyRespondentResponseRequest {
    name?: string;
    assessment_ids?: string[];
    attempt_ids?: string[];
    status?: string[];
    sort_columns?: Record<string, string>;
}

export interface SurveySetupResponse {
    [key: string]: string;
}

export interface BatchInfo {
    id: string;
    name: string;
    description?: string;
}

export interface IndividualResponseData {
    name: string;
    email: string;
    response: string;
}

export interface IndividualResponseApiData {
    content: IndividualResponseData[];
    page_no: number;
    page_size: number;
    total_pages: number;
    total_elements: number;
    last: boolean;
}

export interface IndividualResponseRequest {
    name?: string;
    assessment_ids?: string[];
    question_ids?: string[];
    section_ids?: string[];
    attempt_ids?: string[];
    status?: string[];
    sort_columns?: Record<string, string>;
}

export interface RichTextContent {
    id: string;
    type: string;
    content: string;
}

export interface QuestionOption {
    id: string;
    preview_id: string;
    question_id: string;
    text: RichTextContent;
    media_id: string;
    option_order: number;
    created_on: string;
    updated_on: string;
}

export interface QuestionOptionWithExplanation extends QuestionOption {
    explanation_text: RichTextContent;
}

export interface AssessmentQuestionPreview {
    question_id: string;
    parent_rich_text: RichTextContent;
    question: RichTextContent;
    section_id: string;
    question_duration: number;
    question_order: number;
    marking_json: string;
    evaluation_json: string;
    question_type: string;
    options: QuestionOption[];
    options_with_explanation: QuestionOptionWithExplanation[];
}

export interface McqSurveyInfo {
    option: string;
    percentage: number;
    respondent_count: number;
}

export interface McqSurveyDto {
    type: string;
    total_respondent: number;
    order: number;
    mcq_survey_info_list: McqSurveyInfo[];
}

export interface OneWordLongSurveyResponse {
    name: string;
    email: string;
    answer: string;
}

export interface OneWordLongSurveyDto {
    type: string;
    total_respondent: number;
    order: number;
    latest_response: OneWordLongSurveyResponse[];
}

export interface NumberSurveyInfo {
    answer: string;
    total_responses: number;
}

export interface NumberSurveyDto {
    type: string;
    total_respondent: number;
    order: number;
    number_survey_info_list: NumberSurveyInfo[];
}

export interface SurveyQuestionData {
    assessment_question_preview_dto: AssessmentQuestionPreview;
    mcq_survey_dtos: McqSurveyDto[];
    one_word_long_survey_dtos: OneWordLongSurveyDto[];
    number_survey_dtos: NumberSurveyDto[];
}

export interface SurveyOverviewResponse {
    survey_id: string;
    total_participants: number;
    participants_responded: number;
    all_surveys: SurveyQuestionData[];
}

export interface QuestionsWithSectionsResponse {
    [sectionId: string]: AssessmentQuestionPreview[];
}

export interface SurveyFilters {
    name?: string;
    assessment_ids?: string[];
    question_ids?: string[];
    section_ids?: string[];
    attempt_ids?: string[];
    status?: string[];
    sort_columns?: Record<string, string>;
}

// Helper functions for logging and request processing
const getDataTypeInfo = (value: any): string => {
    return Array.isArray(value) ? 'array' : typeof value;
};

const createRequestParams = (params: any, assessmentId: string) => ({
    ...params,
    instituteId: params.instituteId || 'NOT_PROVIDED',
    assessmentId: assessmentId || 'NOT_PROVIDED',
});

const createRequestBodyInfo = (requestBody: any, assessmentId: string) => ({
    name: requestBody.name || 'NOT_PROVIDED',
    assessment_ids: requestBody.assessment_ids || [assessmentId],
    attempt_ids: requestBody.attempt_ids || [],
    status: requestBody.status || [],
    sort_columns: requestBody.sort_columns || {},
    fullRequestBody: requestBody,
    dataTypes: {
        name: typeof (requestBody.name || 'NOT_PROVIDED'),
        assessment_ids: getDataTypeInfo(requestBody.assessment_ids || [assessmentId]),
        attempt_ids: getDataTypeInfo(requestBody.attempt_ids || []),
        status: getDataTypeInfo(requestBody.status || []),
        sort_columns: typeof (requestBody.sort_columns || {}),
    },
});

const logRequestDetails = (url: string, params: any, requestBody: any, assessmentId: string) => {
    console.log('🔍 [Survey API] getRespondentResponses - Request Details:', {
        url,
        method: 'POST',
        params: createRequestParams(params, assessmentId),
        requestBody: createRequestBodyInfo(requestBody, assessmentId),
        timestamp: new Date().toISOString(),
    });
};

const createFinalRequestBody = (requestBody: any, assessmentId: string) => {
    return {
        ...requestBody,
        assessment_ids: requestBody.assessment_ids || [assessmentId],
    };
};

const logFinalRequestBody = (finalRequestBody: any) => {
    console.log('🔍 [Survey API] getRespondentResponses - Final Request Body:', {
        finalRequestBody,
        stringified: JSON.stringify(finalRequestBody),
        timestamp: new Date().toISOString(),
    });
};

const logResponseDetails = (response: any) => {
    console.log('✅ [Survey API] getRespondentResponses - Response Details:', {
        status: response.status,
        data: {
            contentLength: response.data.content?.length || 0,
            pageNo: response.data.page_no,
            pageSize: response.data.page_size,
            totalPages: response.data.total_pages,
            totalElements: response.data.total_elements,
            last: response.data.last,
        },
        timestamp: new Date().toISOString(),
    });
};

const createErrorInfo = (error: any) => ({
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
});

const createErrorRequestInfo = (url: string, params: any, requestBody: any, assessmentId: string) => ({
    url,
    params,
    requestBody: {
        ...requestBody,
        assessment_ids: requestBody.assessment_ids || [assessmentId],
    },
});

const logErrorDetails = (error: any, url: string, params: any, requestBody: any, assessmentId: string) => {
    console.error('❌ [Survey API] getRespondentResponses - Error Details:', {
        error: createErrorInfo(error),
        request: createErrorRequestInfo(url, params, requestBody, assessmentId),
        timestamp: new Date().toISOString(),
    });
};

// API Service Functions
export const surveyApiService = {
    /**
     * Get survey respondent responses with pagination and filtering
     */
    async getRespondentResponses(
        assessmentId: string,
        pageNo: number = 1,
        pageSize: number = 10,
        requestBody: SurveyRespondentResponseRequest = {}
    ): Promise<SurveyRespondentResponseData> {
        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found');
        }

        const url = SURVEY_RESPONDENT_RESPONSE;
        const params = {
            instituteId,
            pageNo,
            pageSize,
        };

        logRequestDetails(url, params, requestBody, assessmentId);

        try {
            const finalRequestBody = createFinalRequestBody(requestBody, assessmentId);
            logFinalRequestBody(finalRequestBody);

            const response = await authenticatedAxiosInstance.post<SurveyRespondentResponseData>(
                url,
                finalRequestBody,
                { params }
            );

            logResponseDetails(response);
            return response.data;
        } catch (error: any) {
            logErrorDetails(error, url, params, requestBody, assessmentId);
            throw error;
        }
    },

    /**
     * Get survey setup data
     */
    async getSurveySetup(assessmentId: string): Promise<SurveySetupResponse> {
        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found');
        }

        const url = SURVEY_SETUP;
        const params = {
            instituteId,
            assessmentId,
        };

        console.log('🔍 [Survey API] getSurveySetup - Request Details:', {
            url,
            method: 'GET',
            params: {
                ...params,
                instituteId: params.instituteId || 'NOT_PROVIDED',
                assessmentId: params.assessmentId || 'NOT_PROVIDED',
            },
            timestamp: new Date().toISOString(),
        });

        try {
            const response = await authenticatedAxiosInstance.get<SurveySetupResponse>(url, {
                params,
            });

            console.log('✅ [Survey API] getSurveySetup - Response Details:', {
                status: response.status,
                data: {
                    responseType: Array.isArray(response.data) ? 'array' : typeof response.data,
                    dataLength: Array.isArray(response.data)
                        ? response.data.length
                        : Object.keys(response.data || {}).length,
                    sampleData: Array.isArray(response.data)
                        ? response.data.slice(0, 3)
                        : response.data,
                },
                timestamp: new Date().toISOString(),
            });

            return response.data;
        } catch (error: any) {
            console.error('❌ [Survey API] getSurveySetup - Error Details:', {
                error: {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                },
                request: {
                    url,
                    params,
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    },

    /**
     * Get individual survey responses with pagination and filtering
     */
    async getIndividualResponses(
        assessmentId: string,
        pageNo: number = 1,
        pageSize: number = 10,
        requestBody: IndividualResponseRequest = {}
    ): Promise<IndividualResponseApiData> {
        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found');
        }

        const url = SURVEY_INDIVIDUAL_RESPONSE;
        const params = {
            instituteId,
            pageNo,
            pageSize,
        };

        console.log('🔍 [Survey API] getIndividualResponses - Request Details:', {
            url,
            method: 'POST',
            params: {
                ...params,
                instituteId: params.instituteId || 'NOT_PROVIDED',
                assessmentId: assessmentId || 'NOT_PROVIDED',
            },
            requestBody: {
                name: requestBody.name || 'NOT_PROVIDED',
                assessment_ids: requestBody.assessment_ids || [assessmentId],
                attempt_ids: requestBody.attempt_ids || [],
                status: requestBody.status || [],
                sort_columns: requestBody.sort_columns || {},
                fullRequestBody: requestBody,
            },
            timestamp: new Date().toISOString(),
        });

        try {
            const response = await authenticatedAxiosInstance.post<IndividualResponseApiData>(
                url,
                {
                    ...requestBody,
                    assessment_ids: requestBody.assessment_ids || [assessmentId],
                },
                { params }
            );

            console.log('✅ [Survey API] getIndividualResponses - Response Details:', {
                status: response.status,
                data: {
                    contentLength: response.data.content?.length || 0,
                    pageNo: response.data.page_no,
                    pageSize: response.data.page_size,
                    totalPages: response.data.total_pages,
                    totalElements: response.data.total_elements,
                    last: response.data.last,
                    sampleContent: response.data.content?.slice(0, 2) || [],
                },
                timestamp: new Date().toISOString(),
            });

            return response.data;
        } catch (error: any) {
            console.error('❌ [Survey API] getIndividualResponses - Error Details:', {
                error: {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                },
                request: {
                    url,
                    params,
                    requestBody: {
                        ...requestBody,
                        assessment_ids: requestBody.assessment_ids || [assessmentId],
                    },
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    },

    /**
     * Get survey overview data
     */
    async getSurveyOverview(
        assessmentId: string,
        sectionIds?: string
    ): Promise<SurveyOverviewResponse> {
        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found');
        }

        const url = SURVEY_OVERVIEW;
        const params = {
            instituteId,
            assessmentId,
            ...(sectionIds && { sectionIds }),
        };

        console.log('🔍 [Survey API] getSurveyOverview - Request Details:', {
            url,
            method: 'GET',
            params: {
                ...params,
                sectionIds: sectionIds || 'NOT_PROVIDED',
            },
            timestamp: new Date().toISOString(),
        });

        try {
            const response = await authenticatedAxiosInstance.get<SurveyOverviewResponse>(url, {
                params,
            });

            console.log('✅ [Survey API] getSurveyOverview - Response Details:', {
                status: response.status,
                requestUrl: `${url}?${new URLSearchParams(params).toString()}`,
                data: {
                    surveyId: response.data.survey_id,
                    totalParticipants: response.data.total_participants,
                    participantsResponded: response.data.participants_responded,
                    allSurveysCount: response.data.all_surveys?.length || 0,
                    sampleSurvey: response.data.all_surveys?.[0]
                        ? {
                              questionId:
                                  response.data.all_surveys[0].assessment_question_preview_dto
                                      ?.question_id,
                              questionType:
                                  response.data.all_surveys[0].assessment_question_preview_dto
                                      ?.question_type,
                              mcqCount: response.data.all_surveys[0].mcq_survey_dtos?.length || 0,
                              textCount:
                                  response.data.all_surveys[0].one_word_long_survey_dtos?.length ||
                                  0,
                              numberCount:
                                  response.data.all_surveys[0].number_survey_dtos?.length || 0,
                          }
                        : null,
                },
                timestamp: new Date().toISOString(),
            });

            return response.data;
        } catch (error: any) {
            console.error('❌ [Survey API] getSurveyOverview - Error Details:', {
                error: {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                },
                request: {
                    url,
                    params,
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    },

    /**
     * Get questions with sections for assessment
     */
    async getQuestionsWithSections(
        assessmentId: string,
        sectionIds: string[]
    ): Promise<{ [sectionId: string]: any[] }> {
        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found');
        }

        const url = SURVEY_QUESTIONS_WITH_SECTIONS;
        const params = {
            assessmentId,
            sectionIds: sectionIds.join(','),
        };

        try {
            const response = await authenticatedAxiosInstance.get<{ [sectionId: string]: any[] }>(
                url,
                { params }
            );

            return response.data;
        } catch (error: any) {
            console.error('❌ [Survey API] getQuestionsWithSections - Error Details:', {
                error: {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                },
                request: {
                    url,
                    params,
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    },

    /**
     * Get batch information by batch IDs
     */
    async getBatchInfo(batchIds: string[]): Promise<BatchInfo[]> {
        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found');
        }

        if (!batchIds || batchIds.length === 0) {
            return [];
        }

        const url = BATCH_DETAILS;
        const params = {
            instituteId,
            batchIds: batchIds.join(','),
        };

        try {
            const response = await authenticatedAxiosInstance.get<BatchInfo[]>(url, { params });

            return response.data || [];
        } catch (error: any) {
            console.error('❌ [Survey API] getBatchInfo - Error:', error.message);
            // Return empty array instead of throwing error to prevent breaking the UI
            return [];
        }
    },
};
