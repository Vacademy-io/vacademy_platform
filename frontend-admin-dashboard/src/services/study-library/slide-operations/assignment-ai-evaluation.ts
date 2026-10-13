import {
    GET_ASSIGNMENT_AI_EVALUATION,
    TRIGGER_ASSIGNMENT_AI_EVALUATION,
} from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export type AssignmentAiEvaluationStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** One AI Evaluator run over an assignment copy. Marks here are a suggestion until the grade is saved. */
export interface AssignmentAiEvaluation {
    id: string;
    tracked_id: string;
    status: AssignmentAiEvaluationStatus;
    current_step: string | null;
    max_marks: number | null;
    marks_awarded: number | null;
    feedback: string | null;
    evaluated_file_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export const triggerAssignmentAiEvaluation = async (
    trackedId: string,
    preferredModel?: string
): Promise<AssignmentAiEvaluation> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: TRIGGER_ASSIGNMENT_AI_EVALUATION,
        params: { instituteId: getInstituteId() },
        data: { tracked_id: trackedId, preferred_model: preferredModel },
    });
    return response.data;
};

/** The latest run for a submission, or null when it was never evaluated. */
export const fetchAssignmentAiEvaluation = async (
    trackedId: string
): Promise<AssignmentAiEvaluation | null> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_ASSIGNMENT_AI_EVALUATION,
        params: { trackedId, instituteId: getInstituteId() },
    });
    return response.data || null;
};
