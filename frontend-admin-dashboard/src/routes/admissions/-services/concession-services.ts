import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    SUBMIT_FEE_CONCESSION,
    GET_PENDING_CONCESSIONS,
    APPROVE_CONCESSION,
    REJECT_CONCESSION,
    GET_CONCESSION_HISTORY,
} from '@/constants/urls';
import { ConcessionRequest } from '../-types/fee-concession-types';

// Helper to get user data from token
const getUserData = () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    return tokenData;
};

// Helper to get institute ID
const getInstituteId = () => {
    const tokenData = getUserData();
    return tokenData && Object.keys(tokenData.authorities)[0];
};

// Submit a concession request for approval
export const submitConcessionRequest = async (request: Omit<ConcessionRequest, 'id' | 'status' | 'requestedBy' | 'requestedAt'>) => {
    const response = await authenticatedAxiosInstance.post(SUBMIT_FEE_CONCESSION, request, {
        params: { instituteId: getInstituteId() },
        headers: {
            user: JSON.stringify({
                id: getUserData()?.user,
                role: 'ADMIN',
            }),
        },
    });
    return response.data;
};

// Get all pending concession requests for the institute
export const getPendingConcessions = async () => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance.get(GET_PENDING_CONCESSIONS, {
        params: { instituteId },
    });
    return response.data;
};

// Approve a concession request
export const approveConcession = async (concessionId: string, remarks?: string) => {
    const params: Record<string, string> = { concessionId };
    if (remarks) {
        params.remarks = remarks;
    }
    const response = await authenticatedAxiosInstance.post(APPROVE_CONCESSION, null, {
        params,
        headers: {
            user: JSON.stringify({
                id: getUserData()?.user,
                role: 'ADMIN',
            }),
        },
    });
    return response.data;
};

// Reject a concession request
export const rejectConcession = async (concessionId: string, reason: string) => {
    const response = await authenticatedAxiosInstance.post(REJECT_CONCESSION, null, {
        params: { concessionId, reason },
        headers: {
            user: JSON.stringify({
                id: getUserData()?.user,
                role: 'ADMIN',
            }),
        },
    });
    return response.data;
};

// Get concession history for a registration
export const getConcessionHistory = async (registrationId: string) => {
    const response = await authenticatedAxiosInstance.get(
        `${GET_CONCESSION_HISTORY}/${registrationId}`,
        {
            headers: {
                user: JSON.stringify({
                    id: getUserData()?.user,
                    role: 'ADMIN',
                }),
            },
        }
    );
    return response.data;
};
