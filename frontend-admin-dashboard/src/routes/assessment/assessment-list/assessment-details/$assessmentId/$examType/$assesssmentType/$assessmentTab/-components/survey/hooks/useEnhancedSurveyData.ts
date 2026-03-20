import { useState, useEffect, useCallback } from 'react';
import { surveyApiService, QuestionsWithSectionsResponse } from '@/services/survey-api';
import { SurveyFilters } from '@/services/survey-api';
import { processQuestionsData, processIndividualResponse, groupResponsesByRespondent, ProcessedResponse } from '../utils/questionResponseProcessor';

/**
 * Enhanced hook that fetches questions and processes individual responses with proper context
 */
export const useEnhancedSurveyRespondents = (
  assessmentId: string,
  sectionIds: string[] = [],
  pageNo: number = 1,
  pageSize: number = 100, // Increased to get more respondents per page
  assessmentName: string = '',
  filters: SurveyFilters = {}
) => {
  const [data, setData] = useState<{
    respondents: any[];
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
  const [questionsData, setQuestionsData] = useState<Map<string, any> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First, fetch questions data if we have section IDs
      let questionMap = new Map();
      if (sectionIds.length > 0) {
        try {
          const questionsResponse = await surveyApiService.getQuestionsWithSections(assessmentId, sectionIds);
          questionMap = processQuestionsData(questionsResponse);
          setQuestionsData(questionMap);
        } catch (questionsError) {
          // Silently handle questions data fetch failure
        }
      }

      // Then fetch individual responses
      const requestFilters = {
        name: assessmentName,
        assessment_ids: [assessmentId],
        question_ids: [],
        section_ids: sectionIds,
        status: [],
        sort_columns: {},
        ...filters,
      };

      const response = await surveyApiService.getIndividualResponses(
        assessmentId,
        pageNo - 1,
        pageSize,
        requestFilters
      );

      // Process responses with question context
      const processedResponses = new Map<string, ProcessedResponse[]>();

      response.content.forEach((item) => {
        const processedResponse = processIndividualResponse(item, questionMap);
        if (processedResponse) {
          const respondentKey = `${item.name}-${item.email}`;
          if (!processedResponses.has(respondentKey)) {
            processedResponses.set(respondentKey, []);
          }
          processedResponses.get(respondentKey)!.push(processedResponse);
        }
      });

      // Group responses by respondent
      const respondents = Array.from(processedResponses.entries()).map(([key, responses]) => {
        const [name, email] = key.split('-', 2);
        // Get source_id from the first response (all responses from same respondent should have same source_id)
        const source_id = responses.length > 0 ? responses[0]?.source_id : undefined;
        return groupResponsesByRespondent(responses, name || '', email || '', source_id);
      });

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
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch enhanced respondent data';
      setError(errorMessage);
      console.error('❌ [Survey Hook] useEnhancedSurveyRespondents - Error:', {
        error: errorMessage,
        assessmentId,
        sectionIds,
        pageNo,
        pageSize,
        assessmentName,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, sectionIds, pageNo, pageSize, assessmentName, filters]);

  useEffect(() => {
    if (assessmentId) {
      fetchData();
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, questionsData };
};
