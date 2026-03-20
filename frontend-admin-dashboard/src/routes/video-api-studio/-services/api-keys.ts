import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import axios from 'axios';

export interface ApiKey {
    id: string;
    name: string;
    key: string;
    created_at: string;
    status: 'active' | 'revoked';
}

export interface GenerateKeyRequest {
    institute_id: string;
    name: string;
}

export interface GenerateKeyResponse {
    id: string;
    name: string;
    key: string;
    created_at: string;
    status: string;
}

export interface RevokeKeyResponse {
    status: string;
    message: string;
}

const apiKeysClient = axios.create({
    baseURL: AI_SERVICE_BASE_URL,
});

const STORED_KEY_PREFIX = 'vacademy_video_api_key_';

export function storeFullApiKey(keyId: string, fullKey: string): void {
    localStorage.setItem(`${STORED_KEY_PREFIX}${keyId}`, fullKey);
}

export function getStoredFullApiKey(keyId: string): string | null {
    return localStorage.getItem(`${STORED_KEY_PREFIX}${keyId}`);
}

export function removeStoredApiKey(keyId: string): void {
    localStorage.removeItem(`${STORED_KEY_PREFIX}${keyId}`);
}

export function getFirstAvailableFullKey(keys: ApiKey[]): string | null {
    for (const key of keys) {
        if (key.status === 'active') {
            const fullKey = getStoredFullApiKey(key.id);
            if (fullKey) {
                return fullKey;
            }
        }
    }
    return null;
}

export const generateApiKey = async (
    instituteId: string,
    name: string
): Promise<GenerateKeyResponse> => {
    const response = await apiKeysClient.post<GenerateKeyResponse>('/institute/api-keys/generate', {
        institute_id: instituteId,
        name,
    });
    return response.data;
};

export const listApiKeys = async (instituteId: string): Promise<ApiKey[]> => {
    const response = await apiKeysClient.get<ApiKey[]>(`/institute/api-keys/${instituteId}`);
    return response.data;
};

export const revokeApiKey = async (
    instituteId: string,
    keyId: string
): Promise<RevokeKeyResponse> => {
    const response = await apiKeysClient.delete<RevokeKeyResponse>(
        `/institute/api-keys/${instituteId}/${keyId}`
    );
    return response.data;
};
