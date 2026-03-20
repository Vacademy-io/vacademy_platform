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

export async function updateEmailConfiguration(
    id: string,
    config: UpdateEmailConfigurationRequest
): Promise<EmailConfiguration> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }
    
    const url = `${BASE_URL}/notification-service/v1/announcements/email-configurations/${instituteId}/${id}`;
    
    try {
        const response = await authenticatedAxiosInstance.put<EmailConfiguration>(url, config);
        return response.data;
    } catch (error) {
        console.error('Error updating email configuration:', error);
        throw error;
    }
}

export async function deleteEmailConfiguration(id: string): Promise<void> {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }
    
    const url = `${BASE_URL}/notification-service/v1/announcements/email-configurations/${instituteId}/${id}`;
    
    try {
        await authenticatedAxiosInstance.delete(url);
    } catch (error) {
        console.error('Error deleting email configuration:', error);
        throw error;
    }
}

