import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    CREATE_INSTRUCTOR_COPILOT_LOG,
    DELETE_INSTRUCTOR_COPILOT_LOG,
    LIST_INSTRUCTOR_COPILOT_LOGS,
    UPDATE_INSTRUCTOR_COPILOT_LOG,
    RETRY_INSTRUCTOR_COPILOT_LOG,
} from '@/constants/urls';

export interface InstructorCopilotLog {
    id: string;
    institute_id: string;
    created_by_user_id: string;
    title: string;
    thumbnail_file_id: string | null;
    transcript_json: string;
    flashnotes_json: string | null;
    summary: string | null;
    question_json: string | null;
    flashcard_json: string | null;
    slides_json: string | null;
    video_json: string | null;
    classwork_json: string | null;
    homework_json: string | null;
    status: 'ACTIVE' | 'DELETED';
    created_at: string;
}

export interface CreateInstructorCopilotLogRequest {
    transcript_json: string;
    instituteId: string;
}

export interface UpdateInstructorCopilotLogRequest {
    title?: string;
    status?: 'ACTIVE' | 'DELETED';
    question_json?: string;
}

export interface ListInstructorCopilotLogsParams {
    instituteId: string;
    status?: 'ACTIVE' | 'DELETED';
    startDate?: string;
    endDate?: string;
}

export const createInstructorCopilotLog = async (
    data: CreateInstructorCopilotLogRequest
): Promise<InstructorCopilotLog> => {
    const { instituteId, ...body } = data;
    const response = await authenticatedAxiosInstance.post(
        `${CREATE_INSTRUCTOR_COPILOT_LOG}?instituteId=${instituteId}`,
        body
    );
    return response.data;
};

export const listInstructorCopilotLogs = async (
    params: ListInstructorCopilotLogsParams
): Promise<InstructorCopilotLog[]> => {
    const response = await authenticatedAxiosInstance.get(LIST_INSTRUCTOR_COPILOT_LOGS, {
        params,
    });
    return response.data;
};

export const updateInstructorCopilotLog = async (
    id: string,
    data: UpdateInstructorCopilotLogRequest
): Promise<InstructorCopilotLog> => {
    const response = await authenticatedAxiosInstance.patch(
        UPDATE_INSTRUCTOR_COPILOT_LOG(id),
        data
    );
    return response.data;
};

export const deleteInstructorCopilotLog = async (id: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(DELETE_INSTRUCTOR_COPILOT_LOG(id));
};

export const retryInstructorCopilotLog = async (id: string): Promise<void> => {
    await authenticatedAxiosInstance.post(RETRY_INSTRUCTOR_COPILOT_LOG(id));
};

// Quiz Generation Interfaces
export interface QuizGenerationRequest {
    text: string;
    num: number;
    class_level: string;
    topics?: string;
    question_type: string;
    question_language: string;
    taskName: string;
    taskId?: string;
}

export interface QuizQuestion {
    id: string | null;
    text: {
        id: string | null;
        type: string;
        content: string;
    };
    question_type: string;
    question_response_type: string;
    auto_evaluation_json: string;
    explanation_text: {
        id: string | null;
        type: string;
        content: string;
    };
    options: Array<{
        id: string | null;
        preview_id: string;
        text: {
            id: string | null;
            type: string;
            content: string;
        };
    }>;
    tags: string[];
    level: string;
}

export interface QuizGenerationResponse {
    questions: QuizQuestion[];
    title: string;
    tags: string[];
    difficulty: string;
    subjects: string[];
    classes: string[];
}

export interface TaskStatusResponse {
    taskId: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    result?: QuizGenerationResponse;
}

// Quiz Generation API Functions
export const generateQuiz = async (
    data: QuizGenerationRequest,
    instituteId: string
): Promise<{ taskId: string }> => {
    const response = await authenticatedAxiosInstance.post(
        `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/media-service/ai/get-question-pdf/from-text?instituteId=${instituteId}`,
        data
    );
    // API returns taskId as a string directly, wrap it in an object
    const taskId = typeof response.data === 'string' ? response.data : response.data.taskId || response.data;
    return { taskId };
};

export const getQuizTaskStatus = async (taskId: string): Promise<QuizGenerationResponse> => {
    const response = await authenticatedAxiosInstance.get(
        `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/media-service/task-status/get-result?taskId=${taskId}`
    );
    return response.data;
};
