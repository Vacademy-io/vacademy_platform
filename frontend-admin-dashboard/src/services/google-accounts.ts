import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GOOGLE_ACCOUNTS_BASE, GOOGLE_OAUTH_INITIATE } from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

/**
 * Service module for managing per-institute connected Google Workspace accounts.
 *
 * Accounts are created via the "Connect Google Workspace" OAuth flow (no pasted secrets);
 * the backend stores an encrypted refresh token per institute and never returns it. These
 * helpers cover read, settings update, set-default, disconnect, and test-connection.
 */

export interface GoogleAccountSummary {
    id: string;
    label: string;
    organizerEmail: string;
    status: 'ACTIVE' | 'RECONNECT_NEEDED' | string;
    isDefault: boolean;
    recordingEnabled: boolean;
    /** OPEN | TRUSTED | RESTRICTED */
    defaultAccessType: string;
    defaultTimezone?: string | null;
    lastVerifiedAt?: string | null;
    createdAt?: string | null;
}

export interface GoogleAccountSettingsRequest {
    label?: string;
    recordingEnabled?: boolean;
    defaultAccessType?: string;
    defaultTimezone?: string;
    setAsDefault?: boolean;
}

export interface GoogleTestConnectionResponse {
    ok: boolean;
    accountEmail?: string;
    error?: string;
}

const getInstituteId = (): string => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteIds = Object.keys(tokenData?.authorities || {});
    if (instituteIds.length === 0) throw new Error('No institute ID found in token');
    return instituteIds[0]!;
};

export const listGoogleAccounts = async (): Promise<GoogleAccountSummary[]> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.get<GoogleAccountSummary[]>(
        GOOGLE_ACCOUNTS_BASE,
        { params: { instituteId } }
    );
    return data ?? [];
};

/**
 * Start "Connect Google Workspace": returns the Google consent URL. The caller redirects the
 * browser there; Google bounces back to the server callback, which stores the encrypted
 * refresh token and lands the admin back on Settings (?google_connected=1 or ?google_error=...).
 */
export const initiateGoogleOAuth = async (): Promise<{ oauth_url: string; session_key: string }> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post<{ oauth_url: string; session_key: string }>(
        GOOGLE_OAUTH_INITIATE,
        null,
        { params: { instituteId } }
    );
    return data;
};

export const updateGoogleAccountSettings = async (
    id: string,
    payload: GoogleAccountSettingsRequest
): Promise<GoogleAccountSummary> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.put<GoogleAccountSummary>(
        `${GOOGLE_ACCOUNTS_BASE}/${id}/settings`,
        payload,
        { params: { instituteId } }
    );
    return data;
};

export const disconnectGoogleAccount = async (id: string): Promise<void> => {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.delete(`${GOOGLE_ACCOUNTS_BASE}/${id}`, {
        params: { instituteId },
    });
};

export const setDefaultGoogleAccount = async (id: string): Promise<GoogleAccountSummary> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post<GoogleAccountSummary>(
        `${GOOGLE_ACCOUNTS_BASE}/${id}/set-default`,
        null,
        { params: { instituteId } }
    );
    return data;
};

export const testGoogleConnection = async (
    id: string
): Promise<GoogleTestConnectionResponse> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post<GoogleTestConnectionResponse>(
        `${GOOGLE_ACCOUNTS_BASE}/${id}/test-connection`,
        null,
        { params: { instituteId } }
    );
    return data;
};
