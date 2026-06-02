import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ZOOM_ACCOUNTS_BASE } from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

/**
 * Service module for managing per-institute Zoom account credentials.
 *
 * Backend never returns secret fields — only masked identifiers. To rotate a
 * secret the admin must re-enter it on edit; leaving it blank preserves the
 * existing encrypted value.
 */

export interface ZoomAccountSummary {
    id: string;
    label: string;
    zoomAccountIdMasked: string;
    s2sClientIdMasked: string;
    sdkClientKeyMasked: string;
    webhookConfigured: boolean;
    status: 'ACTIVE' | 'INVALID_CREDENTIALS' | 'DISABLED' | string;
    isDefault: boolean;
    lastVerifiedAt?: string | null;
    createdAt?: string | null;
}

export interface ZoomAccountRequest {
    label: string;
    zoomAccountId: string;
    s2sClientId: string;
    /** Required on create; omit on edit to keep the existing secret. */
    s2sClientSecret?: string;
    sdkClientKey: string;
    sdkClientSecret?: string;
    webhookVerificationToken?: string | null;
    setAsDefault?: boolean;
}

export interface ZoomTestConnectionResponse {
    ok: boolean;
    accountEmail?: string;
    planType?: string;
    error?: string;
}

const getInstituteId = (): string => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteIds = Object.keys(tokenData?.authorities || {});
    if (instituteIds.length === 0) throw new Error('No institute ID found in token');
    return instituteIds[0]!;
};

export const listZoomAccounts = async (): Promise<ZoomAccountSummary[]> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.get<ZoomAccountSummary[]>(
        ZOOM_ACCOUNTS_BASE,
        { params: { instituteId } }
    );
    return data ?? [];
};

export const createZoomAccount = async (
    payload: ZoomAccountRequest
): Promise<ZoomAccountSummary> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post<ZoomAccountSummary>(
        ZOOM_ACCOUNTS_BASE,
        payload,
        { params: { instituteId } }
    );
    return data;
};

export const updateZoomAccount = async (
    id: string,
    payload: ZoomAccountRequest
): Promise<ZoomAccountSummary> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.put<ZoomAccountSummary>(
        `${ZOOM_ACCOUNTS_BASE}/${id}`,
        payload,
        { params: { instituteId } }
    );
    return data;
};

export const deleteZoomAccount = async (id: string): Promise<void> => {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.delete(`${ZOOM_ACCOUNTS_BASE}/${id}`, {
        params: { instituteId },
    });
};

export const setDefaultZoomAccount = async (id: string): Promise<ZoomAccountSummary> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post<ZoomAccountSummary>(
        `${ZOOM_ACCOUNTS_BASE}/${id}/set-default`,
        null,
        { params: { instituteId } }
    );
    return data;
};

export const testZoomConnection = async (
    id: string
): Promise<ZoomTestConnectionResponse> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post<ZoomTestConnectionResponse>(
        `${ZOOM_ACCOUNTS_BASE}/${id}/test-connection`,
        null,
        { params: { instituteId } }
    );
    return data;
};
