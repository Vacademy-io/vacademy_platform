import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';

// A DNS record the institute must publish so AWS SES can verify a domain (DOMAIN mode).
export interface DnsRecord {
    type: string; // "CNAME" | "TXT"
    name: string;
    value: string;
    purpose: string;
}

export type VerificationStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED';
export type VerificationMode = 'EMAIL' | 'DOMAIN';

export interface SenderVerificationResponse {
    enabled: boolean;
    type: string;
    email?: string;
    identity?: string;
    mode?: VerificationMode;
    status: VerificationStatus;
    verified: boolean;
    message?: string;
    dnsRecords?: DnsRecord[] | null;
}

export interface VerifySenderRequest {
    email: string;
    name?: string;
    type: string;
    mode?: VerificationMode; // defaults to EMAIL on the backend
}

const base = () => `${BASE_URL}/notification-service/v1/email-verification`;

/**
 * Whether self-serve SES sender verification is provisioned on this deployment.
 * Returns false (never throws) so the UI can degrade to the manual "contact support" path.
 */
export async function getVerificationEnabled(): Promise<boolean> {
    try {
        const response = await authenticatedAxiosInstance.get<{ enabled: boolean }>(
            `${base()}/enabled`
        );
        return Boolean(response.data?.enabled);
    } catch (error) {
        console.error('Error checking sender-verification availability:', error);
        return false;
    }
}

/** Initiate (or re-send) verification for a sender address. */
export async function verifySender(
    req: VerifySenderRequest
): Promise<SenderVerificationResponse> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }
    const response = await authenticatedAxiosInstance.post<SenderVerificationResponse>(
        `${base()}/${instituteId}/verify`,
        req
    );
    return response.data;
}

/** Re-check the live SES status for a sender, keyed by its EMAIL_SETTING type. */
export async function getVerificationStatus(
    emailType: string
): Promise<SenderVerificationResponse> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }
    const response = await authenticatedAxiosInstance.get<SenderVerificationResponse>(
        `${base()}/${instituteId}/status/${encodeURIComponent(emailType)}`
    );
    return response.data;
}
