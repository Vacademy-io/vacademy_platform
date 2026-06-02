import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';

// Types for email configuration
export interface EmailConfiguration {
    id: string;
    email: string;
    name: string;
    type: string;
    description?: string;
    displayText?: string;
}

export interface CreateEmailConfigurationRequest {
    email: string;
    name: string;
    type: string;
    description?: string;
}

export interface UpdateEmailConfigurationRequest {
    email?: string;
    name?: string;
    type?: string;
    description?: string;
}

// Service functions
export async function getEmailConfigurations(): Promise<EmailConfiguration[]> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }
    
    const url = `${BASE_URL}/notification-service/v1/announcements/email-configurations/${instituteId}`;
    
    try {
        const response = await authenticatedAxiosInstance.get<EmailConfiguration[]>(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching email configurations:', error);
        throw error;
    }
}

export async function createEmailConfiguration(
    config: CreateEmailConfigurationRequest
): Promise<EmailConfiguration> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }
    
    const url = `${BASE_URL}/notification-service/v1/announcements/email-configurations/${instituteId}`;
    
    try {
        const response = await authenticatedAxiosInstance.post<EmailConfiguration>(url, config);
        return response.data;
    } catch (error) {
        console.error('Error creating email configuration:', error);
        throw error;
    }
}

/**
 * The backend keys email configurations by `type` (the JSON key inside
 * institute.setting.EMAIL_SETTING.data). The `id` field returned in
 * `EmailConfiguration` is set server-side to mirror `type` for client
 * convenience, but the canonical path segment is the type itself — and type
 * is immutable once a configuration is created.
 */
export async function updateEmailConfiguration(
    emailType: string,
    config: UpdateEmailConfigurationRequest
): Promise<EmailConfiguration> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const url = `${BASE_URL}/notification-service/v1/announcements/email-configurations/${instituteId}/${encodeURIComponent(emailType)}`;

    try {
        const response = await authenticatedAxiosInstance.put<EmailConfiguration>(url, config);
        return response.data;
    } catch (error) {
        console.error('Error updating email configuration:', error);
        throw error;
    }
}

export async function deleteEmailConfiguration(emailType: string): Promise<void> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const url = `${BASE_URL}/notification-service/v1/announcements/email-configurations/${instituteId}/${encodeURIComponent(emailType)}`;

    try {
        await authenticatedAxiosInstance.delete(url);
    } catch (error) {
        console.error('Error deleting email configuration:', error);
        throw error;
    }
}

