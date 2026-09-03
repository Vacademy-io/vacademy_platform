import { QUIZ_RESULTS_OVERVIEW, QUIZ_RESULTS_QUESTIONS, QUIZ_RESULTS_QUIZ } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import type {
    QuizLearnerResultsResponse,
    QuizOverviewResponse,
    QuizQuestionAnalysisResponse,
} from '../-types/quiz-results-types';

export const getQuizResultsOverview = async (batchId: string): Promise<QuizOverviewResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: QUIZ_RESULTS_OVERVIEW,
        params: { batchId },
    });
    return response.data;
};

/**
 * The tab is not a live view, so these do not poll. Results only move when a learner
 * submits, and the tab has an explicit Refresh for that; `staleTime` keeps flipping
 * between the list and a quiz free of refetches.
 */
export const quizResultsOverviewQueryOptions = (batchId: string) => ({
    queryKey: ['quiz-results-overview', batchId],
    queryFn: () => getQuizResultsOverview(batchId),
    enabled: !!batchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
});

export const getQuizLearnerResults = async (
    batchId: string,
    slideId: string
): Promise<QuizLearnerResultsResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: QUIZ_RESULTS_QUIZ,
        params: { batchId, slideId },
    });
    return response.data;
};

export const quizLearnerResultsQueryOptions = (batchId: string, slideId: string) => ({
    queryKey: ['quiz-results-learners', batchId, slideId],
    queryFn: () => getQuizLearnerResults(batchId, slideId),
    enabled: !!batchId && !!slideId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
});

export const getQuizQuestionAnalysis = async (
    batchId: string,
    slideId: string
): Promise<QuizQuestionAnalysisResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: QUIZ_RESULTS_QUESTIONS,
        params: { batchId, slideId },
    });
    return response.data;
};

/** Only fetched once the Questions view is opened — the list view never needs it. */
export const quizQuestionAnalysisQueryOptions = (
    batchId: string,
    slideId: string,
    enabled: boolean
) => ({
    queryKey: ['quiz-results-questions', batchId, slideId],
    queryFn: () => getQuizQuestionAnalysis(batchId, slideId),
    enabled: enabled && !!batchId && !!slideId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
});
