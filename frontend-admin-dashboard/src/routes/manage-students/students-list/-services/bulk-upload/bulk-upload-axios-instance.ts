// lib/api/bulkUploadAxios.ts
import axios from 'axios';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';

const bulkUploadAxiosInstance = axios.create({
    headers: {
        Accept: 'application/json',
    },
});

bulkUploadAxiosInstance.interceptors.request.use(
    async (request) => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        if (accessToken) {
            request.headers.Authorization = `Bearer ${accessToken}`;
        }
        // Don't set Content-Type here as it will be set automatically for FormData
        return request;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default bulkUploadAxiosInstance;
