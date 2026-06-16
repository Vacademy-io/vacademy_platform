import { SUBMIT_MARKS, GET_RELEASE_STUDENT_RESULT } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

interface SubimtRequest {
    set_id: string;
    file_id: string;
    data_json: string;
    request: {
        section_id: string;
        question_id: string;
        status: string;
        marks: number;
        evaluator_feedback?: string;
    }[];
}

export const submitEvlauationMarks = async (
    assessmentId: string,
    instituteId: string,
    attemptId: string,
    data: SubimtRequest
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${SUBMIT_MARKS}`,
        params: {
            assessmentId,
            instituteId,
            attemptId,
        },
        data,
    });
    return response?.data;
};

// Release the result for a single attempt so the learner sees it immediately
// after the admin submits a manual evaluation.
export const releaseEvaluationResult = async (
    assessmentId: string,
    instituteId: string | undefined,
    attemptId: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${GET_RELEASE_STUDENT_RESULT}`,
        params: {
            assessmentId,
            instituteId,
            methodType: 'ENTIRE_ASSESSMENT_PARTICIPANTS',
        },
        data: { attempt_ids: [attemptId] },
    });
    return response?.data;
};
