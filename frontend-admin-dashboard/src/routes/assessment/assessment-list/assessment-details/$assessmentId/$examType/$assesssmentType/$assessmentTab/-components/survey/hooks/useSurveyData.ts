import { useState, useEffect, useCallback } from 'react';
import { surveyApiService, QuestionsWithSectionsResponse } from '@/services/survey-api';
import {
  SurveyOverviewResponse,
  SurveyRespondentResponseData,
  IndividualResponseApiData,
  TransformedSurveyAnalytics,
  TransformedQuestionAnalytics,
  TransformedSurveyRespondent,
  SurveyQuestionType,
  ResponseDistribution,
} from '../types';
import { processQuestionsData, processIndividualResponse, groupResponsesByRespondent, ProcessedResponse } from '../utils/questionResponseProcessor';

// Data transformation utilities
const transformQuestionType = (apiType: string): SurveyQuestionType => {
  const typeMap: Record<string, SurveyQuestionType> = {
    'MCQS': 'mcq_single_choice',
    'MCQM': 'mcq_multiple_choice',
    'TRUE_FALSE': 'true_false',
    'ONE_WORD': 'short_answer',
    'LONG_ANSWER': 'long_answer',
    'NUMERIC': 'numerical',
    'RATING': 'rating',
  };
  return typeMap[apiType] || 'short_answer';
};

interface RichContent {
  content?: string;
  text?: { content: string };
}

interface McqSurveyInfo {
  option: string;
  respondent_count: number;
  percentage: number;
}

interface McqSurveyData {
  total_respondent: number;
  mcq_survey_info_list: McqSurveyInfo[];
}

interface TextSurveyData {
  total_respondent: number;
  one_word_long_survey_info_list: Array<{
    response: string;
    respondent_count: number;
    percentage: number;
  }>;
}

interface NumberSurveyData {
  total_respondent: number;
  number_survey_info_list: Array<{
    response: number;
    respondent_count: number;
    percentage: number;
  }>;
}

interface SurveyData {
  assessment_question_preview_dto: {
    question_id: string;
    question: string;
    question_type: string;
  };
  mcq_survey_dtos?: McqSurveyData[];
  one_word_long_survey_dtos?: TextSurveyData[];
  number_survey_dtos?: NumberSurveyData[];
}

interface SurveyFilters {
  name?: string;
  assessment_ids?: string[];
  question_ids?: string[];
  section_ids?: string[];
  attempt_ids?: string[];
  status?: string[];
  sort_columns?: Record<string, string>;
}

const extractTextFromRichContent = (content: string | RichContent | null | undefined): string => {
  if (typeof content === 'string') return content;
  if (content?.content) return content.content;
  if (content?.text?.content) return content.text.content;
  return '';
};

const transformSurveyAnalytics = (data: SurveyOverviewResponse): TransformedSurveyAnalytics => {
  const completionRate = data.total_participants > 0
    ? Math.round((data.participants_responded / data.total_participants) * 100)
    : 0;

  return {
    totalParticipants: data.total_participants,
    completedResponses: data.participants_responded,
    completionRate,
    totalQuestions: data.all_surveys.length,
  };
};

// Helper functions for MCQ question processing
const processMcqQuestion = (surveyData: any, questionType: SurveyQuestionType) => {
  const mcqData = surveyData.mcq_survey_dtos[0];
  const questionOptions = surveyData.assessment_question_preview_dto.options_with_explanation || [];

  const optionMap = new Map();
  questionOptions.forEach((option: any) => {
    optionMap.set(option.id, extractTextFromRichContent(option.text) || 'Unknown Option');
  });

  const responseCounts = new Map();
  if (mcqData.mcq_survey_info_list?.length > 0) {
    mcqData.mcq_survey_info_list.forEach((item: any) => {
      if (item.option !== 'NO_ANSWER') {
        responseCounts.set(item.option, {
          count: item.respondent_count || 0,
          percentage: item.percentage || 0,
        });
      }
    });
  }

  const responseDistribution = questionOptions.map((option: any) => {
    const optionId = option.id;
    const optionText = extractTextFromRichContent(option.text) || 'Unknown Option';
    const responseData = responseCounts.get(optionId) || { count: 0, percentage: 0 };

    return {
      value: optionText,
      count: responseData.count,
      percentage: responseData.percentage, // Use the percentage from API directly
    };
  }).sort((a: any, b: any) => b.percentage - a.percentage);

  // Calculate actual total responses by summing all option counts
  const actualTotalResponses = responseDistribution.reduce((sum: number, option: ResponseDistribution) => sum + option.count, 0);

  const topInsights = responseDistribution.length > 0 ? [
    `${Math.round(responseDistribution.reduce((max: any, current: any) =>
      current.percentage > max.percentage ? current : max
    ).percentage)}% of respondents chose "${responseDistribution.reduce((max: any, current: any) =>
      current.percentage > max.percentage ? current : max
    ).value}"`,
    `Total responses: ${actualTotalResponses}`,
  ] : [
    `No responses yet`,
    `Question has ${questionOptions.length} options`,
  ];

  return { responseDistribution, totalResponses: actualTotalResponses, topInsights };
};

// Helper function for True/False question processing
const processTrueFalseQuestion = (surveyData: any, questionType: SurveyQuestionType) => {
  const mcqData = surveyData.mcq_survey_dtos[0];
  const questionOptions = surveyData.assessment_question_preview_dto.options_with_explanation || [];

  // For True/False questions, we need to ensure we have exactly 2 options: True and False
  const responseDistribution: ResponseDistribution[] = [];

  // Initialize with default True/False structure
  const trueOption = questionOptions.find((option: any) =>
    extractTextFromRichContent(option.text).toLowerCase().includes('true')
  );
  const falseOption = questionOptions.find((option: any) =>
    extractTextFromRichContent(option.text).toLowerCase().includes('false')
  );

  // Create response counts map
  const responseCounts = new Map();
  if (mcqData.mcq_survey_info_list?.length > 0) {
    mcqData.mcq_survey_info_list.forEach((item: any) => {
      if (item.option !== 'NO_ANSWER') {
        responseCounts.set(item.option, {
          count: item.respondent_count || 0,
          percentage: item.percentage || 0,
        });
      }
    });
  }

  // Get actual counts for True and False
  let trueCount = 0;
  let falseCount = 0;

  // For True/False questions, we need to handle the case where only one option has responses
  // The API might only return data for the option that has responses

  if (trueOption) {
    const trueData = responseCounts.get(trueOption.id) || { count: 0, percentage: 0 };
    trueCount = trueData.count;
  }

  if (falseOption) {
    const falseData = responseCounts.get(falseOption.id) || { count: 0, percentage: 0 };
    falseCount = falseData.count;
  }

  // Calculate actual total responses
  const actualTotalResponses = trueCount + falseCount;

  // Calculate percentages based on actual counts
  const truePercentage = actualTotalResponses > 0 ? (trueCount / actualTotalResponses) * 100 : 0;
  const falsePercentage = actualTotalResponses > 0 ? (falseCount / actualTotalResponses) * 100 : 0;

  // Debug logging for True/False data
  console.log('🔍 [TrueFalse] Data Processing:', {
    actualTotalResponses,
    trueCount,
    falseCount,
    truePercentage: truePercentage.toFixed(2),
    falsePercentage: falsePercentage.toFixed(2),
    sumPercentage: (truePercentage + falsePercentage).toFixed(2),
    calculationLogic: {
      actualTotalResponses,
      initialTrueCount: trueOption ? (responseCounts.get(trueOption.id) || { count: 0 }).count : 0,
      initialFalseCount: falseOption ? (responseCounts.get(falseOption.id) || { count: 0 }).count : 0,
      calculatedTrueCount: trueCount,
      calculatedFalseCount: falseCount,
      sumMatchesTotal: (trueCount + falseCount) === actualTotalResponses
    },
    mcqData: mcqData,
    responseCounts: Array.from(responseCounts.entries()),
    questionOptions: questionOptions.map((opt: any) => ({
      id: opt.id,
      text: extractTextFromRichContent(opt.text)
    })),
    mcqSurveyInfoList: mcqData.mcq_survey_info_list,
    timestamp: new Date().toISOString()
  });

  // Process True option
  responseDistribution.push({
    value: 'True',
    count: trueCount,
    percentage: truePercentage,
  });

  // Process False option
  responseDistribution.push({
    value: 'False',
    count: falseCount,
    percentage: falsePercentage,
  });

  const topInsights = responseDistribution.length > 0 ? [
    `${Math.round(responseDistribution.reduce((max: any, current: any) =>
      current.percentage > max.percentage ? current : max
    ).percentage)}% of respondents chose "${responseDistribution.reduce((max: any, current: any) =>
      current.percentage > max.percentage ? current : max
    ).value}"`,
    `Total responses: ${actualTotalResponses}`,
  ] : [
    `No responses yet`,
    `Question type: ${questionType}`,
  ];

  return { responseDistribution, totalResponses: actualTotalResponses, topInsights };
};

// Helper functions for text question processing
const processTextQuestion = (surveyData: any, questionType: SurveyQuestionType) => {
  const textData = surveyData.one_word_long_survey_dtos[0];

  let responseDistribution: ResponseDistribution[] = [];
  let topInsights: string[] = [];

  if (textData.latest_response?.length > 0) {
    const responseCounts: Record<string, number> = {};

    textData.latest_response.forEach((response: any) => {
      try {
        const parsedResponse = JSON.parse(response.answer);
        const answer = parsedResponse.responseData?.answer || '';
        if (answer && answer.trim().length > 0) {
          responseCounts[answer] = (responseCounts[answer] ?? 0) + 1;
        }
      } catch (error) {
        const answer = response.answer || '';
        if (answer && answer.trim().length > 0) {
          responseCounts[answer] = (responseCounts[answer] ?? 0) + 1;
        }
      }
    });

    responseDistribution = Object.entries(responseCounts)
      .map(([value, count]) => ({
        value,
        count,
        percentage: 0, // Will be calculated below
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate actual total responses and percentages
    const actualTotalResponses = responseDistribution.reduce((sum, item) => sum + item.count, 0);

    // Update percentages based on actual total
    responseDistribution = responseDistribution.map(item => ({
      ...item,
      percentage: actualTotalResponses > 0 ? Math.round((item.count / actualTotalResponses) * 100) : 0,
    }));

    topInsights = [
      `Total responses: ${actualTotalResponses}`,
      `Recent responses: ${textData.latest_response.length}`,
    ];
  } else {
    topInsights = [
      `No responses yet`,
      `Question type: ${questionType}`,
    ];
  }

  // Calculate actual total responses for return value
  const actualTotalResponses = responseDistribution.reduce((sum, item) => sum + item.count, 0);

  return { responseDistribution, totalResponses: actualTotalResponses, topInsights };
};

// Helper functions for numerical question processing
const processNumericalQuestion = (surveyData: any, questionType: SurveyQuestionType) => {
  const numberData = surveyData.number_survey_dtos[0];

  let responseDistribution: ResponseDistribution[] = [];
  let topInsights: string[] = [];

  if (numberData.number_survey_info_list?.length > 0) {
    const responseCounts: Record<string, number> = {};
    numberData.number_survey_info_list.forEach((item: any) => {
      const value = item.answer?.toString() || '0';
      responseCounts[value] = item.total_responses || 0;
    });

    responseDistribution = Object.entries(responseCounts)
      .map(([value, count]) => ({
        value,
        count,
        percentage: 0, // Will be calculated below
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate actual total responses and percentages
    const actualTotalResponses = responseDistribution.reduce((sum, item) => sum + item.count, 0);

    // Update percentages based on actual total
    responseDistribution = responseDistribution.map(item => ({
      ...item,
      percentage: actualTotalResponses > 0 ? Math.round((item.count / actualTotalResponses) * 100) : 0,
    }));

    topInsights = [
      `Total responses: ${actualTotalResponses}`,
      `Most common answer: ${responseDistribution[0]?.value ?? 'N/A'}`,
    ];
  } else {
    topInsights = [
      `No responses yet`,
      `Question type: ${questionType}`,
    ];
  }

  // Calculate actual total responses for return value
  const actualTotalResponses = responseDistribution.reduce((sum, item) => sum + item.count, 0);

  return { responseDistribution, totalResponses: actualTotalResponses, topInsights };
};

const transformQuestionAnalytics = (surveyData: any): TransformedQuestionAnalytics => {
  const question = surveyData.assessment_question_preview_dto;
  const questionText = extractTextFromRichContent(question.question);
  const questionType = transformQuestionType(question.question_type);

  let responseDistribution: ResponseDistribution[] = [];
  let totalResponses = 0;
  let topInsights: string[] = [];

  // Handle MCQ questions (MCQS, MCQM, TRUE_FALSE)
  if (surveyData.mcq_survey_dtos?.length > 0) {
    if (questionType === 'true_false') {
      const result = processTrueFalseQuestion(surveyData, questionType);
      responseDistribution = result.responseDistribution;
      totalResponses = result.totalResponses;
      topInsights = result.topInsights;
    } else {
      const result = processMcqQuestion(surveyData, questionType);
      responseDistribution = result.responseDistribution;
      totalResponses = result.totalResponses;
      topInsights = result.topInsights;
    }
  }
  // Handle text-based questions (ONE_WORD, LONG_ANSWER)
  else if (surveyData.one_word_long_survey_dtos?.length > 0) {
    const result = processTextQuestion(surveyData, questionType);
    responseDistribution = result.responseDistribution;
    totalResponses = result.totalResponses;
    topInsights = result.topInsights;
  }
  // Handle numerical questions (NUMERIC)
  else if (surveyData.number_survey_dtos?.length > 0) {
    const result = processNumericalQuestion(surveyData, questionType);
    responseDistribution = result.responseDistribution;
    totalResponses = result.totalResponses;
    topInsights = result.topInsights;
  }

  // If no specific response data is available, show basic info
  if (responseDistribution.length === 0) {
    topInsights = [
      `No responses yet`,
      `Question type: ${questionType}`,
    ];
  }

  return {
    questionId: question.question_id,
    questionText,
    questionType,
    totalResponses,
    responseDistribution,
    topInsights,
  };
};

const transformSurveyRespondents = (data: IndividualResponseApiData): TransformedSurveyRespondent[] => {
  // Group responses by respondent
  const respondentMap = new Map<string, TransformedSurveyRespondent>();

  data.content.forEach((item, index) => {
    const respondentId = `${item.name}-${item.email}`;

    if (!respondentMap.has(respondentId)) {
      respondentMap.set(respondentId, {
        id: respondentId,
        name: item.name,
        email: item.email,
        source_id: item.source_id,
        responses: [],
      });
    }

    const respondent = respondentMap.get(respondentId)!;
    respondent.responses.push({
      id: `response-${index}`,
      respondentId: respondentId,
      questionId: 'unknown', // We don't have question ID in this API
      answer: item.response,
      submittedAt: new Date().toISOString(), // We don't have timestamp
    });
  });

  return Array.from(respondentMap.values());
};

// Custom hooks
export const useSurveyOverview = (assessmentId: string, sectionIds?: string) => {
  const [data, setData] = useState<{
    analytics: TransformedSurveyAnalytics | null;
    questions: TransformedQuestionAnalytics[];
  }>({
    analytics: null,
    questions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);


      const response = await surveyApiService.getSurveyOverview(assessmentId, sectionIds);

      const analytics = transformSurveyAnalytics(response);
      const questions = response.all_surveys.map(transformQuestionAnalytics);


      setData({ analytics, questions });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch survey overview';
      setError(errorMessage);
      console.error('❌ [Survey Hook] useSurveyOverview - Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, sectionIds]);

  useEffect(() => {
    if (assessmentId) {
      fetchData();
    }
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};

export const useSurveyRespondents = (
  assessmentId: string,
  pageNo: number = 1,
  pageSize: number = 100, // Increased to get more respondents per page
  assessmentName: string = '',
  sectionIds: string = '',
  filters: SurveyFilters = {}
) => {
  const [data, setData] = useState<{
    respondents: TransformedSurveyRespondent[];
    pagination: {
      pageNo: number;
      pageSize: number;
      totalPages: number;
      totalElements: number;
      last: boolean;
    };
  }>({
    respondents: [],
    pagination: {
      pageNo: 0,
      pageSize: 0,
      totalPages: 0,
      totalElements: 0,
      last: true,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const requestFilters = {
        name: '',
        assessment_ids: [assessmentId],
        question_ids: [],
        section_ids: sectionIds ? sectionIds.split(',') : [],
        status: [],
        sort_columns: {},
        ...filters,
      };


      const response = await surveyApiService.getIndividualResponses(
        assessmentId,
        pageNo - 1, // Convert to 0-based indexing as expected by backend
        pageSize,
        requestFilters
      );

      const respondents = transformSurveyRespondents(response);


      setData({
        respondents,
        pagination: {
          pageNo: response.page_no,
          pageSize: response.page_size,
          totalPages: response.total_pages,
          totalElements: response.total_elements,
          last: response.last,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch survey respondents';
      setError(errorMessage);
      console.error('❌ [Survey Hook] useSurveyRespondents - Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, pageNo, pageSize, assessmentName, sectionIds]);

  useEffect(() => {
    if (assessmentId) {
      fetchData();
    }
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};

export const useSurveyRespondentResponses = (
  assessmentId: string,
  pageNo: number = 1,
  pageSize: number = 10,
  assessmentName: string = '',
  filters: SurveyFilters = {}
) => {
  const [data, setData] = useState<SurveyRespondentResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const requestFilters = {
        name: '',
        assessment_ids: [assessmentId],
        attempt_ids: [],
        status: [],
        sort_columns: {},
        ...filters,
      };


      const response = await surveyApiService.getRespondentResponses(
        assessmentId,
        pageNo - 1, // Convert to 0-based indexing as expected by backend
        pageSize,
        requestFilters
      );


      setData(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch respondent responses';
      setError(errorMessage);
      console.error('❌ [Survey Hook] useSurveyRespondentResponses - Error:', {
        error: errorMessage,
        assessmentId,
        pageNo,
        pageSize,
        assessmentName,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, pageNo, pageSize, assessmentName]);

  useEffect(() => {
    if (assessmentId) {
      fetchData();
    }
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};

