import { getInstituteId } from '@/constants/helper';
import {
    CHAT_WITH_PDF_AI_URL,
    CONVERT_PDF_TO_HTML_AI_URL,
    GENERATE_FEEDBACK_FROM_FILE_AI_URL,
    GENERATE_QUESTIONS_FROM_FILE_AI_URL,
    GENERATE_QUESTIONS_FROM_IMAGE_AI_URL,
    GET_INDIVIDUAL_AI_TASK_QUESTIONS,
    GET_INDIVIDUAL_CHAT_WITH_PDF_AI_TASK_QUESTIONS,
    GET_LECTURE_FEEDBACK_PREVIEW_URL,
    GET_LECTURE_PLAN_PREVIEW_URL,
    GET_LECTURE_PLAN_URL,
    GET_QUESTIONS_FROM_AUDIO,
    GET_QUESTIONS_FROM_TEXT,
    GET_QUESTIONS_URL_FROM_HTML_AI_URL,
    HTML_TO_QUESTIONS_FROM_FILE_AI_URL,
    LIST_INDIVIDUAL_AI_TASKS_URL,
    PROCESS_AUDIO_FILE,
    RETRY_AI_URL,
    SORT_QUESTIONS_FILE_AI_URL,
    SORT_SPLIT_FILE_AI_URL,
    START_PROCESSING_FILE_AI_URL,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import axios from 'axios';

export const handleStartProcessUploadedFile = async (fileId: string) => {
    const response = await axios({
        method: 'POST',
        url: START_PROCESSING_FILE_AI_URL,
        data: {
            file_id: fileId,
        },
    });
    return response?.data;
};

export const handleGetListIndividualTopics = async (taskType: string) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: LIST_INDIVIDUAL_AI_TASKS_URL,
        params: {
            instituteId,
            taskType,
        },
    });
    return response?.data;
};

export const handleRetryAITask = async (taskId: string) => {
    const response = await axios({
        method: 'POST',
        url: RETRY_AI_URL,
        params: {
            taskId,
        },
    });
    return response?.data;
};

export const handleQueryGetListIndividualTopics = (taskType: string) => {
    return {
        queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA', taskType],
        queryFn: () => handleGetListIndividualTopics(taskType),
        staleTime: 60 * 60 * 1000,
    };
};

export const handleGetQuestionsInvidualTask = async (taskId: string) => {
    const response = await axios({
        method: 'GET',
        url: GET_INDIVIDUAL_AI_TASK_QUESTIONS,
        params: {
            taskId,
        },
    });
    return response?.data;
};

export const handleGetChatWithPDFInvidualTask = async (parentId: string) => {
    const response = await axios({
        method: 'GET',
        url: GET_INDIVIDUAL_CHAT_WITH_PDF_AI_TASK_QUESTIONS,
        params: {
            parentId,
        },
    });
    return response?.data;
};

export const handleGetLecturePlan = async (taskId: string) => {
    const response = await axios({
        method: 'GET',
        url: GET_LECTURE_PLAN_PREVIEW_URL,
        params: {
            taskId,
        },
    });
    return response?.data;
};

export const handleGetEvaluateLecture = async (taskId: string) => {
    const response = await axios({
        method: 'GET',
        url: GET_LECTURE_FEEDBACK_PREVIEW_URL,
        params: {
            taskId,
        },
    });
    return response?.data;
};

export const handleSortSplitPDF = async (
    pdfId: string,
    requiredTopics: string,
    taskName: string,
    taskId: string
) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: SORT_SPLIT_FILE_AI_URL,
        params: {
            pdfId,
            requiredTopics,
            taskName,
            instituteId,
            taskId,
        },
    });
    return response?.data;
};

export const handleSortQuestionsPDF = async (
    pdfId: string,
    userPrompt: string,
    taskName: string
) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: SORT_QUESTIONS_FILE_AI_URL,
        params: {
            pdfId,
            userPrompt,
            taskName,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGenerateAssessmentQuestions = async (
    pdfId: string,
    userPrompt: string,
    taskName: string,
    taskId: string
) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: GENERATE_QUESTIONS_FROM_FILE_AI_URL,
        params: {
            pdfId,
            userPrompt,
            taskName,
            instituteId,
            taskId,
        },
    });
    return response?.data;
};
export const handleGenerateAssessmentImage = async (
    pdfId: string,
    userPrompt: string,
    taskName: string,
    taskId: string
) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: GENERATE_QUESTIONS_FROM_IMAGE_AI_URL,
        params: {
            pdfId,
            userPrompt,
            taskName,
            instituteId,
            taskId,
        },
    });
    return response?.data;
};

export const handleEvaluateLecture = async (audioId: string, taskName: string) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: GENERATE_FEEDBACK_FROM_FILE_AI_URL,
        params: {
            audioId,
            taskName,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGenerateAssessmentQuestionsPageWise = async (
    html: string,
    userPrompt: string,
    taskId: string
) => {
    const response = await axios({
        method: 'POST',
        url: HTML_TO_QUESTIONS_FROM_FILE_AI_URL,
        params: {
            userPrompt,
        },
        data: { html: html, taskId: taskId },
    });
    return response?.data;
};

export const handleConvertPDFToHTML = async (pdfId: string, taskName: string) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: CONVERT_PDF_TO_HTML_AI_URL,
        params: {
            pdfId,
            taskName,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGetQuestionsFromHTMLUrl = async (html: string, userPrompt: string) => {
    const response = await axios({
        method: 'POST',
        params: {
            userPrompt,
        },
        url: GET_QUESTIONS_URL_FROM_HTML_AI_URL,
        data: { html: html },
    });
    return response?.data;
};

export const handleStartProcessUploadedAudioFile = async (fileId: string) => {
    const response = await axios({
        method: 'POST',
        url: PROCESS_AUDIO_FILE,
        // params: {
        //     audioId: fileId
        // },
        data: { file_id: fileId },
    });
    return response?.data;
};

export const handleGetQuestionsFromAudio = async (
    audioId: string,
    numQuestions: string | null,
    prompt: string | null,
    difficulty: string | null,
    language: string | null,
    taskName: string,
    taskId: string
) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: GET_QUESTIONS_FROM_AUDIO,
        params: {
            audioId: audioId,
            numQuestions: numQuestions,
            prompt: prompt,
            difficulty: difficulty,
            language: language,
            taskName,
            instituteId,
            taskId,
        },
    });
    return response?.data;
};

export const handleGetQuestionsFromText = async (
    taskName: string,
    text: string,
    num: number,
    class_level: string,
    topics: string,
    question_type: string,
    question_language: string,
    taskId: string
) => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_QUESTIONS_FROM_TEXT,
        data: {
            text: text,
            num: num,
            class_level: class_level,
            topics: topics,
            question_type: question_type,
            question_language: question_language,
            taskName,
            taskId,
        },
        params: { instituteId },
    });
    return response?.data;
};

export const handleGetPlanLecture = async (
    taskName: string,
    prompt: string,
    level: string,
    teachingMethod: string,
    language: string,
    lectureDuration: {
        hrs: string;
        min: string;
    },
    isQuestionGenerated: boolean,
    isAssignmentHomeworkGenerated: boolean
) => {
    const instituteId = getInstituteId();
    const totalMinutes =
        Number(lectureDuration.hrs || '0') * 60 + Number(lectureDuration.min || '0');
    const response = await axios({
        method: 'GET',
        url: GET_LECTURE_PLAN_URL,
        params: {
            userPrompt: prompt,
            lectureDuration: `${totalMinutes} minutes`,
            language: language,
            methodOfTeaching: teachingMethod,
            taskName: taskName,
            instituteId,
            level: level,
            isQuestionGenerated,
            isAssignmentHomeworkGenerated,
        },
    });
    return response?.data;
};

export const handleChatWithPDF = async (
    pdfId: string,
    userPrompt: string,
    taskName: string,
    parentId: string
) => {
    const instituteId = getInstituteId();
    const response = await axios({
        method: 'GET',
        url: CHAT_WITH_PDF_AI_URL,
        params: {
            pdfId,
            userPrompt,
            taskName,
            instituteId,
            parentId,
        },
    });
    return response?.data;
};
