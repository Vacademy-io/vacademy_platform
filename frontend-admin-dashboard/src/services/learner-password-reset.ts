import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    SEND_LEARNER_PASSWORD_RESET,
    LEARNER_PASSWORD_RESET_LINK,
    LEARNER_PASSWORD_RESET_TEMPLATE_CONFIG,
} from '@/constants/urls';

/**
 * Which body the mail is rendered from. `DEFAULT` is the platform's built-in email (and any
 * workflow an institute has bound to it) — unchanged behaviour, nothing to configure.
 * `TEMPLATE` renders the institute's own template, which is built around the reset link.
 */
export type CredentialDeliveryMode = 'DEFAULT' | 'TEMPLATE';

export interface CredentialSendResult {
    sent_channels: string[];
    skipped_channels: string[];
    message?: string;
}

export interface TemplateConfig {
    template_id: string | null;
    template_name: string | null;
    template_subject: string | null;
}

export interface PasswordResetLink {
    /** The learner's login username, as auth-service holds it. */
    username: string | null;
    /** Ready-to-send link for this learner. */
    reset_link: string | null;
    /** Same link with `username_placeholder` left in it, for third-party integrators. */
    reset_link_template: string | null;
    username_placeholder: string | null;
}

const requireInstituteId = (): string => {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found. Please log in again.');
    }
    return instituteId;
};

/**
 * Sends the learner a "set a new password" mail.
 *
 * `packageId` only matters in DEFAULT mode, where an institute may have a workflow bound to the
 * send (the LMS credential handoff); the template path ignores it.
 */
export const sendPasswordResetEmail = async (params: {
    userId: string;
    packageId?: string;
    mode: CredentialDeliveryMode;
    templateId?: string;
}): Promise<CredentialSendResult> => {
    const response = await authenticatedAxiosInstance.post<CredentialSendResult>(
        SEND_LEARNER_PASSWORD_RESET,
        null,
        {
            params: {
                instituteId: requireInstituteId(),
                userId: params.userId,
                ...(params.packageId ? { packageId: params.packageId } : {}),
                mode: params.mode,
                ...(params.templateId ? { templateId: params.templateId } : {}),
                channels: 'EMAIL',
            },
        }
    );
    return response.data;
};

export const getPasswordResetLink = async (userId: string): Promise<PasswordResetLink> => {
    const response = await authenticatedAxiosInstance.get<PasswordResetLink>(
        LEARNER_PASSWORD_RESET_LINK,
        { params: { instituteId: requireInstituteId(), userId } }
    );
    return response.data;
};

export const getPasswordResetTemplateConfig = async (
    channel: 'EMAIL' | 'WHATSAPP' = 'EMAIL'
): Promise<TemplateConfig> => {
    const response = await authenticatedAxiosInstance.get<TemplateConfig>(
        LEARNER_PASSWORD_RESET_TEMPLATE_CONFIG,
        { params: { instituteId: requireInstituteId(), channel } }
    );
    return response.data;
};

/**
 * Remembers the admin's choice for the institute, so the next admin opening this dialog starts
 * from the same template instead of picking it again.
 */
export const setPasswordResetTemplateConfig = async (
    templateId: string,
    channel: 'EMAIL' | 'WHATSAPP' = 'EMAIL'
): Promise<void> => {
    await authenticatedAxiosInstance.post(LEARNER_PASSWORD_RESET_TEMPLATE_CONFIG, null, {
        params: { instituteId: requireInstituteId(), channel, templateId },
    });
};
