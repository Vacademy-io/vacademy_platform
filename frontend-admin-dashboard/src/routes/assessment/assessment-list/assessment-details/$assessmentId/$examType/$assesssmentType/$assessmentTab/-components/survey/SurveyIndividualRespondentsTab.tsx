import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertCircle,
    Users,
} from 'lucide-react';
import { useSurveyRespondents } from './hooks/useSurveyData';
import { surveyApiService } from '@/services/survey-api';
import { useBatchNames } from './hooks/useBatchNames';

// Helper functions for response parsing
const formatMcqResponse = (responseData: any, questionData: any): string => {
  if (responseData.optionIds && responseData.optionIds.length > 0) {
    if (questionData && questionData.optionsMap) {
      const selectedOptions = responseData.optionIds.map((optionId: string) => {
        const optionText = questionData.optionsMap.get(optionId);
        return optionText || optionId;
      });
      return selectedOptions.join(', ');
    } else {
      return responseData.optionIds.join(', ');
    }
  }
  return 'No response';
};

const formatNumericResponse = (responseData: any): string => {
  if (responseData.validAnswer !== null && responseData.validAnswer !== undefined) {
    return responseData.validAnswer.toString();
  }
  return 'No response';
};

const formatTextResponse = (responseData: any): string => {
  if (responseData.answer && responseData.answer.trim() !== '') {
    return responseData.answer;
  }
  return 'No response';
};

const RESPONSE_TYPE_FORMATTERS = {
  'MCQS': formatMcqResponse,
  'MCQM': formatMcqResponse,
  'TRUE_FALSE': formatMcqResponse,
  'NUMERIC': formatNumericResponse,
  'ONE_WORD': formatTextResponse,
  'LONG_ANSWER': formatTextResponse,
} as const;

const formatAnswerByType = (responseData: any, questionData: any): string => {
  const formatter = RESPONSE_TYPE_FORMATTERS[responseData.type as keyof typeof RESPONSE_TYPE_FORMATTERS];
  return formatter ? formatter(responseData, questionData) : 'Unknown response type';
};

const createParsedResponse = (response: any, responseData: any, questionData: any, formattedAnswer: string) => ({
  questionId: response.questionId || 'Unknown',
  questionType: responseData.type || 'Unknown',
  questionContent: questionData?.questionContent || 'Survey Question',
  questionOrder: questionData?.questionOrder || 0,
  formattedAnswer,
  timeTaken: response.timeTakenInSeconds || 0,
  durationLeft: response.questionDurationLeftInSeconds || 0,
  isVisited: response.isVisited || false,
  isMarkedForReview: response.isMarkedForReview || false,
  rawResponse: response,
  questionData: questionData,
});

const createErrorResponse = (responseString: string) => ({
  questionId: 'Unknown',
  questionType: 'Unknown',
  questionContent: 'Survey Question',
  questionOrder: 0,
  formattedAnswer: 'Error parsing response data',
  timeTaken: 0,
  durationLeft: 0,
  isVisited: false,
  isMarkedForReview: false,
  rawResponse: responseString,
  questionData: null,
});

// Helper function to parse response data with question context
const parseResponseData = (responseString: string, questionsData: Map<string, any>) => {
  try {
    const response = JSON.parse(responseString);
    const responseData = response.responseData || {};
    const questionData = questionsData.get(response.questionId);
    const formattedAnswer = formatAnswerByType(responseData, questionData);
    return createParsedResponse(response, responseData, questionData, formattedAnswer);
  } catch (error) {
    return createErrorResponse(responseString);
  }
};

interface SurveyIndividualRespondentsTabProps {
    assessmentId: string;
    sectionIds?: string;
    assessmentName?: string;
    assessmentDetails?: any;
}

export const SurveyIndividualRespondentsTab: React.FC<SurveyIndividualRespondentsTabProps> = ({ assessmentId, sectionIds, assessmentName, assessmentDetails }) => {
    const [currentRespondentIndex, setCurrentRespondentIndex] = useState(0);
    const [pageInput, setPageInput] = useState('');
    const [pageNo, setPageNo] = useState(1);
    const [questionsData, setQuestionsData] = useState<Map<string, any>>(new Map());
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const { getBatchName } = useBatchNames();

    // Determine survey type from assessment details
    const isPublicSurvey = assessmentDetails?.assessment_visibility === 'PUBLIC';

    const pageSize = 100; // Increased to get more respondents per page

    const { data, loading, error } = useSurveyRespondents(assessmentId, pageNo, pageSize, assessmentName, sectionIds);

    // Fetch questions data when component mounts or sectionIds change
    React.useEffect(() => {
        const fetchQuestionsData = async () => {
            if (!sectionIds || !assessmentId) return;

            try {
                setQuestionsLoading(true);
                const sectionIdsArray = sectionIds.split(',').filter(id => id.trim());
                if (sectionIdsArray.length > 0) {
                    const questionsResponse = await surveyApiService.getQuestionsWithSections(assessmentId, sectionIdsArray);
                    const questionMap = processQuestionsData(questionsResponse);
                    setQuestionsData(questionMap);
                }
            } catch (error) {
                // Silently handle questions data fetch failure
            } finally {
                setQuestionsLoading(false);
            }
        };

        fetchQuestionsData();
    }, [assessmentId, sectionIds]);

    const processQuestionsData = (questionsResponse: any) => {
        const questionMap = new Map();
        Object.entries(questionsResponse).forEach(([sectionId, questions]) => {
            (questions as any[]).forEach((question: any) => {
                const optionsMap = createOptionsMap(question);
                questionMap.set(question.question_id, {
                    questionContent: question.question.content,
                    questionOrder: question.question_order,
                    questionType: question.question_type,
                    optionsMap: optionsMap
                });
            });
        });
        return questionMap;
    };

    const createOptionsMap = (question: any) => {
        const optionsMap = new Map();
        if (question.options_with_explanation) {
            question.options_with_explanation.forEach((option: any) => {
                optionsMap.set(option.id, option.text.content);
            });
        }
        return optionsMap;
    };

    const currentRespondent = data?.respondents[currentRespondentIndex];
    const totalRespondents = data?.respondents.length || 0;
    const totalElements = data?.respondents.length || 0; // Use unique respondents count instead of API totalElements

    // Calculate the global respondent number across all pages
    const globalRespondentNumber = ((pageNo - 1) * pageSize) + currentRespondentIndex + 1;

    const handlePrevious = () => {
        if (currentRespondentIndex > 0) {
            setCurrentRespondentIndex(currentRespondentIndex - 1);
        } else if (pageNo > 1) {
            // Load previous page
            setPageNo(pageNo - 1);
            setCurrentRespondentIndex(pageSize - 1);
        }
    };

    const handleNext = () => {
        if (currentRespondentIndex < totalRespondents - 1) {
            setCurrentRespondentIndex(currentRespondentIndex + 1);
        } else if (data?.pagination && !data.pagination.last) {
            // Load next page
            setPageNo(pageNo + 1);
            setCurrentRespondentIndex(0);
        }
    };

    const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPageInput(e.target.value);
    };

    const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const pageNumber = parseInt(pageInput);
            if (pageNumber >= 1 && pageNumber <= totalElements) {
                // Calculate which page and index this respondent is on
                const targetPage = Math.ceil(pageNumber / pageSize);
                const targetIndex = (pageNumber - 1) % pageSize;

                if (targetPage !== pageNo) {
                    setPageNo(targetPage);
                }
                setCurrentRespondentIndex(targetIndex);
            } else {
                // Reset to current respondent if invalid input
                setPageInput(globalRespondentNumber.toString());
            }
        }
    };

    const handlePageInputBlur = () => {
        const pageNumber = parseInt(pageInput);
        if (pageNumber >= 1 && pageNumber <= totalElements) {
            // Calculate which page and index this respondent is on
            const targetPage = Math.ceil(pageNumber / pageSize);
            const targetIndex = (pageNumber - 1) % pageSize;

            if (targetPage !== pageNo) {
                setPageNo(targetPage);
            }
            setCurrentRespondentIndex(targetIndex);
        } else {
            // Reset to current respondent if invalid input
            setPageInput(globalRespondentNumber.toString());
        }
    };

    // Update page input when respondent changes
    React.useEffect(() => {
        setPageInput(globalRespondentNumber.toString());
    }, [globalRespondentNumber]);

    // Reset to first respondent when data changes
    React.useEffect(() => {
        if (data?.respondents?.length) {
            setCurrentRespondentIndex(0);
        }
    }, [data?.respondents]);

    // Show loading state
    if (loading || questionsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>
                        {loading ? 'Loading survey respondents...' : 'Loading questions data...'}
                    </span>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Respondents</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Button onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    // Show empty state
    if (!data?.respondents?.length) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Respondents Found</h3>
                    <p className="text-gray-600">No survey responses found for this assessment.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Navigation Controls */}
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentRespondentIndex <= 0 && pageNo <= 1}
                    className="flex items-center gap-2"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>

                <div className="text-center">
                    <div className="font-semibold text-lg">{currentRespondent?.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-600">{currentRespondent?.email || 'No email'}</div>
                    {currentRespondent?.source_id && (
                        <div className="text-xs text-gray-500 mt-1">
                            Batch: {getBatchName(currentRespondent.source_id)}
                        </div>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                            Respondent
                        </span>
                        <Input
                            type="number"
                            min="1"
                            max={totalElements.toString()}
                            value={pageInput}
                            onChange={handlePageInputChange}
                            onKeyDown={handlePageInputSubmit}
                            onBlur={handlePageInputBlur}
                            className="w-12 h-6 text-xs text-center p-1"
                        />
                        <span className="text-xs text-gray-500">
                            of {totalElements}
                        </span>
                    </div>
                </div>

                <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={currentRespondentIndex >= totalRespondents - 1 && data?.pagination?.last}
                    className="flex items-center gap-2"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Individual Responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {currentRespondent?.responses?.map((response, index) => {
                    // Parse the response data with question context
                    const parsedResponse = parseResponseData(String(response.answer), questionsData);

                    return (
                    <Card key={response.id} className="h-fit">
                        <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-lg font-semibold flex-1">
                                        Q{parsedResponse.questionOrder || index + 1}. {parsedResponse.questionContent}
                                </CardTitle>
                                    <div className="flex items-center gap-2">
                                <Badge className="bg-primary-100 text-primary-800 border-primary-200 w-fit flex-shrink-0">
                                            {parsedResponse.questionType}
                                        </Badge>
                                        {parsedResponse.isVisited && (
                                            <Badge variant="outline" className="text-xs">
                                                Visited
                                            </Badge>
                                        )}
                                        {parsedResponse.isMarkedForReview && (
                                            <Badge variant="outline" className="text-xs">
                                                Marked for Review
                                </Badge>
                                        )}
                                    </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                                <div className="space-y-4">
                                    {/* Response Data */}
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-2">Response:</div>
                                <div className="p-4 bg-gray-50 rounded-lg border">
                                            <p className="text-sm font-medium">
                                                {parsedResponse.formattedAnswer}
                                    </p>
                                </div>
                                    </div>


                            </div>
                        </CardContent>
                    </Card>
                    );
                }) || (
                    <div className="col-span-2 text-center py-8">
                        <p className="text-gray-500">No responses available for this respondent.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
