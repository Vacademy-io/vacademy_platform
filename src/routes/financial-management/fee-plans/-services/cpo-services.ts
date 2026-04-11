import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { CREATE_CPO, GET_CPOS_BY_INSTITUTE, GET_CPO_FULL, APPROVE_CPO } from '@/constants/urls';
import { CreateCPORequest, CPOResponse } from '../-types/cpo-types';

const getUserData = () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    return getTokenDecodedData(accessToken);
};

const getInstituteId = () => {
    const tokenData = getUserData();
    return tokenData && Object.keys(tokenData.authorities)[0];
};

export const createCPO = async (payload: CreateCPORequest): Promise<CPOResponse> => {
    const response = await authenticatedAxiosInstance.post(CREATE_CPO, payload);
    return response.data;
};

export const getCPOsByInstitute = async (
    page: number = 0,
    size: number = 20
): Promise<CPOResponse[]> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found');
    const response = await authenticatedAxiosInstance.get(GET_CPOS_BY_INSTITUTE(instituteId), {
        params: { page, size },
    });
    return response.data;
};

export const getCPOFull = async (cpoId: string): Promise<CPOResponse> => {
    const response = await authenticatedAxiosInstance.get(GET_CPO_FULL(cpoId));
    return response.data;
};

export const approveCPO = async (cpoId: string): Promise<CPOResponse> => {
    const response = await authenticatedAxiosInstance.post(APPROVE_CPO(cpoId), null);
    return response.data;
};

export { getInstituteId };
