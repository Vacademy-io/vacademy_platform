import { QuestionsWithSectionsResponse, AssessmentQuestionPreview, QuestionOptionWithExplanation } from '@/services/survey-api';

// Enhanced interfaces for processed question data
export interface ProcessedQuestion {
  questionId: string;
  questionType: string;
  questionContent: string;
  sectionId: string;
  questionOrder: number;
  options: ProcessedOption[];
  correctAnswers: string[];
  markingData: any;
  evaluationData: any;
}

export interface ProcessedOption {
  id: string;
  content: string;
  isCorrect: boolean;
  order: number;
}

export interface ProcessedResponse {
  questionId: string;
  questionType: string;
  questionContent: string;
  sectionId: string;
  questionOrder: number;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  options: ProcessedOption[];
  timeTaken: number;
  isVisited: boolean;
  isMarkedForReview: boolean;
  source_id?: string;
}

/**
 * Process questions data from API response
 */
export const processQuestionsData = (questionsData: QuestionsWithSectionsResponse): Map<string, ProcessedQuestion> => {
  const questionMap = new Map<string, ProcessedQuestion>();

  Object.entries(questionsData).forEach(([sectionId, questions]) => {
    questions.forEach((question: AssessmentQuestionPreview) => {
      const processedQuestion = processQuestion(question);
      questionMap.set(question.question_id, processedQuestion);
    });
  });

  return questionMap;
};

/**
 * Process individual question data
 */
const processQuestion = (question: AssessmentQuestionPreview): ProcessedQuestion => {
  const options = processOptions(question.options_with_explanation || []);
  const correctAnswers = extractCorrectAnswers(question);
  const markingData = JSON.parse(question.marking_json || '{}');
  const evaluationData = JSON.parse(question.evaluation_json || '{}');

  return {
    questionId: question.question_id,
    questionType: question.question_type,
    questionContent: question.question.content,
    sectionId: question.section_id,
    questionOrder: question.question_order,
    options,
    correctAnswers,
    markingData,
    evaluationData,
  };
};

/**
 * Process options data
 */
const processOptions = (options: QuestionOptionWithExplanation[]): ProcessedOption[] => {
  return options.map((option, index) => ({
    id: option.id,
    content: option.text.content,
    isCorrect: false, // Will be set based on evaluation data
    order: option.option_order || index,
  }));
};

/**
 * Extract correct answers from evaluation data
 */
const extractCorrectAnswers = (question: AssessmentQuestionPreview): string[] => {
  try {
    const evaluationData = JSON.parse(question.evaluation_json || '{}');

    switch (question.question_type) {
      case 'MCQS':
      case 'MCQM':
        return evaluationData.data?.correctOptionIds || [];
      case 'TRUE_FALSE':
        return evaluationData.data?.correctOptionIds || [];
      case 'NUMERIC':
        return evaluationData.data?.validAnswers?.map((answer: number) => answer.toString()) || [];
      case 'ONE_WORD':
      case 'LONG_ANSWER':
        return evaluationData.data?.answer?.content ? [evaluationData.data.answer.content] : [];
      default:
        return [];
    }
  } catch (error) {
    return [];
  }
};

/**
 * Process individual response with question context
 */
export const processIndividualResponse = (
  responseData: any,
  questionMap: Map<string, ProcessedQuestion>
): ProcessedResponse | null => {
  try {
    const response = JSON.parse(responseData.response);
    const question = questionMap.get(response.questionId);

    if (!question) {
      return null;
    }

    const userAnswer = response.responseData;
    const correctAnswer = getCorrectAnswerForQuestion(question, userAnswer);
    const isCorrect = checkAnswerCorrectness(question, userAnswer, correctAnswer);

    // Mark correct options
    const optionsWithCorrectness = question.options.map(option => ({
      ...option,
      isCorrect: question.correctAnswers.includes(option.id),
    }));

    return {
      questionId: question.questionId,
      questionType: question.questionType,
      questionContent: question.questionContent,
      sectionId: question.sectionId,
      questionOrder: question.questionOrder,
      userAnswer,
      correctAnswer,
      isCorrect,
      options: optionsWithCorrectness,
      timeTaken: response.timeTakenInSeconds || 0,
      isVisited: response.isVisited || false,
      isMarkedForReview: response.isMarkedForReview || false,
      source_id: responseData.source_id,
    };
  } catch (error) {
    return null;
  }
};

/**
 * Get correct answer for a question based on type
 */
const getCorrectAnswerForQuestion = (question: ProcessedQuestion, userAnswer: any): any => {
  switch (question.questionType) {
    case 'MCQS':
    case 'MCQM':
    case 'TRUE_FALSE':
      return {
        type: question.questionType,
        optionIds: question.correctAnswers,
        options: question.options.filter(opt => question.correctAnswers.includes(opt.id)),
      };
    case 'NUMERIC':
      return {
        type: 'NUMERIC',
        validAnswers: question.correctAnswers.map(answer => parseFloat(answer)),
      };
    case 'ONE_WORD':
    case 'LONG_ANSWER':
      return {
        type: question.questionType,
        answer: question.correctAnswers[0] || '',
      };
    default:
      return null;
  }
};

/**
 * Check if user answer is correct
 */
const checkAnswerCorrectness = (question: ProcessedQuestion, userAnswer: any, correctAnswer: any): boolean => {
  if (!userAnswer || !correctAnswer) return false;

  switch (question.questionType) {
    case 'MCQS':
      return userAnswer.optionIds &&
             userAnswer.optionIds.length === correctAnswer.optionIds.length &&
             userAnswer.optionIds.every((id: string) => correctAnswer.optionIds.includes(id));

    case 'MCQM':
      return userAnswer.optionIds &&
             userAnswer.optionIds.length > 0 &&
             userAnswer.optionIds.every((id: string) => correctAnswer.optionIds.includes(id));

    case 'TRUE_FALSE':
      return userAnswer.optionIds &&
             userAnswer.optionIds.length === 1 &&
             correctAnswer.optionIds.includes(userAnswer.optionIds[0]);

    case 'NUMERIC':
      return userAnswer.validAnswer !== null &&
             userAnswer.validAnswer !== undefined &&
             correctAnswer.validAnswers.includes(userAnswer.validAnswer);

    case 'ONE_WORD':
    case 'LONG_ANSWER':
      return userAnswer.answer &&
             userAnswer.answer.trim() === correctAnswer.answer.trim();

    default:
      return false;
  }
};

/**
 * Group responses by respondent
 */
export const groupResponsesByRespondent = (
  responses: ProcessedResponse[],
  respondentName: string,
  respondentEmail: string,
  source_id?: string
) => {
  return {
    id: `${respondentName}-${respondentEmail}`,
    name: respondentName,
    email: respondentEmail,
    source_id,
    responses: responses.sort((a, b) => a.questionOrder - b.questionOrder),
    totalQuestions: responses.length,
    correctAnswers: responses.filter(r => r.isCorrect).length,
    accuracy: responses.length > 0 ? (responses.filter(r => r.isCorrect).length / responses.length) * 100 : 0,
  };
};
