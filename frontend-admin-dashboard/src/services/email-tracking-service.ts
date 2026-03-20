import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

// Types for email tracking
export interface EmailTrackingItem {
    emailId: string;
    recipientEmail: string;
    userId: string;
    emailSubject: string;
    source: string;
    sourceId: string;
    sentAt: string;
    latestStatus: {
        eventType: string;
        eventTimestamp: string;
        eventTimestampIso?: string;
        timezone?: string;
        eventDetails: string;
        bounceType: string | null;
        bounceSubType: string | null;
        clickedLink: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        complaintFeedbackType: string | null;
    };
    events?: Array<{
        eventType: string;
        eventTimestamp: string;
        eventTimestampIso?: string;
        timezone?: string;
        eventDetails: string;
        bounceType: string | null;
        bounceSubType: string | null;
        clickedLink: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        complaintFeedbackType: string | null;
    }>;
}

export interface EmailTrackingResponse {
    content: EmailTrackingItem[];
    pageable: {
        pageNumber: number;
        pageSize: number;
        sort: {
            sorted: boolean;
            empty: boolean;
            unsorted: boolean;
        };
        offset: number;
        paged: boolean;
        unpaged: boolean;
    };
    totalPages: number;
    totalElements: number;
    last: boolean;
    numberOfElements: number;
    size: number;
    number: number;
    sort: {
        sorted: boolean;
        empty: boolean;
        unsorted: boolean;
    };
    first: boolean;
    empty: boolean;
}

// Service functions
export async function getUserEmailTracking(
    userId: string,
    page: number = 0,
    size: number = 10
): Promise<EmailTrackingResponse> {
    const url = `${BASE_URL}/notification-service/v1/email-tracking/user/${userId}?page=${page}&size=${size}`;
    
    try {
        const response = await authenticatedAxiosInstance.get<EmailTrackingResponse>(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching user email tracking:', error);
        throw error;
    }
}




