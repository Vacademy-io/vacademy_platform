import {
    GET_COMPLETED_QUESTIONS_URL,
    GET_EVALUATION_PROGRESS_URL,
    STOP_EVALUATION_URL,
    TRIGGER_EVALUATION_URL,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

// Types
export interface TriggerEvaluationRequest {
    attempt_ids: string[];
    preferred_model?: string;
}

export interface TriggerEvaluationResponse {
    processIds: string[];
}

export interface CriteriaBreakdown {
    criteria_name: string;
    marks: number;
    reason: string;
}

export interface EvaluationDetailsJson {
    marks_awarded: number;
    feedback: string;
    extracted_answer: string;
    criteria_breakdown: CriteriaBreakdown[];
}

export interface QuestionProgress {
    question_id: string;
    question_number: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    marks_awarded?: number;
    max_marks?: number | null;
    feedback?: string;
    extracted_answer?: string;
    evaluation_details_json?: EvaluationDetailsJson;
    started_at?: string;
    completed_at?: string;
}

export interface ParticipantDetails {
    name: string;
    username: string;
    email: string;
    institute_id: string;
    user_id: string;
}

export interface EvaluationProgress {
    attempt_id: string;
    evaluation_process_id: string;
    participant_details: ParticipantDetails;
    assessment_id: string;
    overall_status:
        | 'STARTED'
        | 'PROCESSING'
        | 'EXTRACTING'
        | 'EVALUATING'
        | 'COMPLETED'
        | 'FAILED'
        | 'CANCELLED';
    current_step: 'PROCESSING' | 'EXTRACTION' | 'GRADING';
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
    completed_questions: QuestionProgress[];
    pending_questions: QuestionProgress[];
}

/**
 * Trigger AI evaluation for one or more student attempts
 * @param attempt_ids - Array of student attempt IDs
 * @param preferred_model - Optional AI model to use (default: mistralai/devstral-2512:free)
 * @returns Array of process IDs for tracking evaluation progress
 */
export const triggerAIEvaluation = async (
    attempt_ids: string[],
    preferred_model: string = 'mistralai/devstral-2512:free'
): Promise<string[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: TRIGGER_EVALUATION_URL,
        data: {
            attempt_ids,
            preferred_model,
        },
    });

    return response?.data || [];
};

/**
 * Get evaluation progress for a specific process
 * @param processId - Process ID returned from trigger evaluation
 * @returns Evaluation progress with completed and pending questions
 */
export const getEvaluationProgress = async (processId: string): Promise<EvaluationProgress> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_EVALUATION_PROGRESS_URL}/${processId}`,
    });

    return response?.data;
};

/**
 * Get only completed questions for a process (lighter payload)
 * @param processId - Process ID returned from trigger evaluation
 * @returns Array of completed questions
 */
export const getCompletedQuestions = async (processId: string): Promise<QuestionProgress[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_COMPLETED_QUESTIONS_URL}/${processId}`,
    });

    return response?.data || [];
};

/**
 * Stop an ongoing evaluation process
 * @param processId - Process ID to stop
 * @returns Success response
 */
export const stopEvaluation = async (processId: string): Promise<void> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${STOP_EVALUATION_URL}/${processId}`,
    });

    return response?.data;
};

/**
 * React Query hook for triggering AI evaluation
 */
export const useTriggerAIEvaluation = () => {
    return {
        mutationKey: ['TRIGGER_AI_EVALUATION'],
        mutationFn: ({
            attempt_ids,
            preferred_model,
        }: {
            attempt_ids: string[];
            preferred_model?: string;
        }) => triggerAIEvaluation(attempt_ids, preferred_model),
    };
};

/**
 * React Query hook for getting evaluation progress
 */
export const useGetEvaluationProgress = (processId: string, enabled: boolean = true) => {
    return {
        queryKey: ['EVALUATION_PROGRESS', processId],
        queryFn: () => getEvaluationProgress(processId),
        enabled: !!processId && enabled,
        refetchInterval: 2000, // Poll every 2 seconds while evaluating
        staleTime: 0, // Always consider stale to get fresh data
    };
};

/**
 * React Query hook for getting completed questions
 */
export const useGetCompletedQuestions = (processId: string, enabled: boolean = true) => {
    return {
        queryKey: ['COMPLETED_QUESTIONS', processId],
        queryFn: () => getCompletedQuestions(processId),
        enabled: !!processId && enabled,
        refetchInterval: 2000, // Poll every 2 seconds
        staleTime: 0,
    };
};

/**
 * React Query mutation for stopping evaluation
 */
export const useStopEvaluation = () => {
    return {
        mutationKey: ['STOP_EVALUATION'],
        mutationFn: (processId: string) => stopEvaluation(processId),
    };
};

export interface EvaluationData {
    processId: string;
    attemptId: string;
    assessmentId: string;
    sectionIds: string[];
}

export const storeEvaluationDataInStorage = (data: EvaluationData) => {
    const stored = localStorage.getItem('TRIGGERED_EVALUATIONS');
    const triggeredEvaluations: EvaluationData[] = stored ? JSON.parse(stored) : [];
    triggeredEvaluations.push(data);
    localStorage.setItem('TRIGGERED_EVALUATIONS', JSON.stringify(triggeredEvaluations));
};

export const getEvaluationDataFromStorage = () => {
    const stored = localStorage.getItem('TRIGGERED_EVALUATIONS');
    return stored ? JSON.parse(stored) : [];
};

export const removeEvaluationDataFromStorage = (processId: string) => {
    const stored = localStorage.getItem('TRIGGERED_EVALUATIONS');
    const triggeredEvaluations: EvaluationData[] = stored ? JSON.parse(stored) : [];
    const updatedProcessIds = triggeredEvaluations.filter((data) => data.processId !== processId);
    localStorage.setItem('TRIGGERED_EVALUATIONS', JSON.stringify(updatedProcessIds));
};
