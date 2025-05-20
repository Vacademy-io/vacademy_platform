import {
    GET_USER_VIDEO_SLIDE_ACTIVITY_LOGS,
    GET_USER_DOC_SLIDE_ACTIVITY_LOGS,
    GET_QUESTION_SLIDE_ACTIVITY_LOGS,
    GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS,
    GET_VIDEO_RESPONSE_SLIDE_ACTIVITY_LOGS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const fetchUserVideoSlideLogs = async (
    userId: string,
    slideId: string,
    pageNo: number,
    pageSize: number
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_USER_VIDEO_SLIDE_ACTIVITY_LOGS,
        params: {
            userId,
            slideId,
            pageNo,
            pageSize,
        },
    });
    return response.data;
};

export const getUserVideoSlideActivityLogs = ({
    userId,
    slideId,
    pageNo,
    pageSize,
}: {
    userId: string;
    slideId: string;
    pageNo: number;
    pageSize: number;
}) => {
    return {
        queryKey: ['GET_USER_VIDEO_SLIDE_ACTIVITY_LOGS', userId, slideId, pageNo, pageSize],
        queryFn: () => fetchUserVideoSlideLogs(userId, slideId, pageNo, pageSize),
        staleTime: 60 * 60 * 1000,
    };
};

export const fetchUserDocSlideLogs = async (
    userId: string,
    slideId: string,
    pageNo: number,
    pageSize: number
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_USER_DOC_SLIDE_ACTIVITY_LOGS,
        params: {
            userId,
            slideId,
            pageNo,
            pageSize,
        },
    });
    return response.data;
};

export const getUserDocActivityLogs = ({
    userId,
    slideId,
    pageNo,
    pageSize,
}: {
    userId: string;
    slideId: string;
    pageNo: number;
    pageSize: number;
}) => {
    return {
        queryKey: ['GET_USER_DOC_SLIDE_ACTIVITY_LOGS', userId, slideId, pageNo, pageSize],
        queryFn: () => fetchUserDocSlideLogs(userId, slideId, pageNo, pageSize),
        staleTime: 60 * 60 * 1000,
    };
};

export const fetchQuestionSlideLogs = async (
    userId: string,
    slideId: string,
    pageNo: number,
    pageSize: number
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_QUESTION_SLIDE_ACTIVITY_LOGS,
        params: {
            userId,
            slideId,
            pageNo,
            pageSize,
        },
    });
    return response.data;
};

export const getQuestionSlideActivityLogs = ({
    userId,
    slideId,
    pageNo,
    pageSize,
}: {
    userId: string;
    slideId: string;
    pageNo: number;
    pageSize: number;
}) => {
    return {
        queryKey: ['GET_QUESTION_SLIDE_ACTIVITY_LOGS', userId, slideId, pageNo, pageSize],
        queryFn: () => fetchQuestionSlideLogs(userId, slideId, pageNo, pageSize),
        staleTime: 60 * 60 * 1000,
    };
};

export const fetchAssignmentSlideLogs = async (
    userId: string,
    slideId: string,
    pageNo: number,
    pageSize: number
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS,
        params: {
            userId,
            slideId,
            pageNo,
            pageSize,
        },
    });
    return response.data;
};

export const getAssignmentSlideActivityLogs = ({
    userId,
    slideId,
    pageNo,
    pageSize,
}: {
    userId: string;
    slideId: string;
    pageNo: number;
    pageSize: number;
}) => {
    return {
        queryKey: ['GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS', userId, slideId, pageNo, pageSize],
        queryFn: () => fetchAssignmentSlideLogs(userId, slideId, pageNo, pageSize),
        staleTime: 60 * 60 * 1000,
    };
};

export const fetchUserVideoResponseSlideLogs = async (
    userId: string,
    slideId: string,
    pageNo: number,
    pageSize: number
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_VIDEO_RESPONSE_SLIDE_ACTIVITY_LOGS,
        params: {
            userId,
            slideId,
            pageNo,
            pageSize,
        },
    });
    return response.data;
};

export const getUserVideoResponseSlideActivityLogs = ({
    userId,
    slideId,
    pageNo,
    pageSize,
}: {
    userId: string;
    slideId: string;
    pageNo: number;
    pageSize: number;
}) => {
    return {
        queryKey: [
            'GET_USER_VIDEO_SLIDE_RESPONSE_ACTIVITY_LOGS',
            userId,
            slideId,
            pageNo,
            pageSize,
        ],
        queryFn: () => fetchUserVideoResponseSlideLogs(userId, slideId, pageNo, pageSize),
        staleTime: 60 * 60 * 1000,
    };
};
