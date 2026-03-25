import { APPROVE_ENROLL_REQUESTS, ENROLL_REQUESTS_LISTS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { EnrollRequestsInterface } from '../-components/enroll-requests';
import { EnrollRequestAcceptData } from '../-components/bulk-actions/bulk-actions-component/accept-request-dialog';

export const getEnrollmentRequestsData = async ({
    pageNo,
    pageSize,
    requestBody,
}: {
    pageNo: number;
    pageSize: number;
    requestBody: EnrollRequestsInterface;
}) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: ENROLL_REQUESTS_LISTS,
        params: {
            pageNo,
            pageSize,
        },
        data: requestBody,
    });
    return response?.data;
};

export const getApproveEnrollmentRequestsData = async ({
    enrollRequestData,
}: {
    enrollRequestData: EnrollRequestAcceptData;
}) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: APPROVE_ENROLL_REQUESTS,
        data: enrollRequestData,
    });
    return response?.data;
};
