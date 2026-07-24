// lib/api/bulkUploadAxios.ts
import axios from 'axios';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { getActiveLocale } from '@/lib/formatters';

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
        // Advertise the user's UI locale (mirrors lib/auth/axiosInstance.ts).
        if (!request.headers['Accept-Language']) {
            request.headers['Accept-Language'] = getActiveLocale();
        }
        // Don't set Content-Type here as it will be set automatically for FormData
        return request;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default bulkUploadAxiosInstance;
