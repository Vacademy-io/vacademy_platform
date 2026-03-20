import axios from 'axios';
import { BASE_URL } from '@/constants/urls';

export interface SystemAlertContentBody {
    id: string;
    type: 'html' | 'text' | string;
    content: string;
}

export interface SystemAlertItem {
    messageId: string;
    announcementId?: string | null;
    title: string;
    content: SystemAlertContentBody;
    createdBy?: string | null;
    createdByName?: string | null;
    createdByRole?: string | null;
    modeType?: string | null;
    status?: string | null;
    createdAt: string;
    deliveredAt?: string | null;
    isRead?: boolean;
    isDismissed?: boolean;
    interactionTime?: string | null;
    modeSettings?: unknown;
    repliesCount?: number | null;
    recentReplies?: unknown;
}

export interface PagedResponse<T> {
    content: T[];
    pageable: {
        pageNumber: number;
        pageSize: number;
        offset: number;
        paged: boolean;
        unpaged: boolean;
        sort?: unknown;
    };
    totalPages: number;
    totalElements: number;
    last: boolean;
    numberOfElements: number;
    first: boolean;
    size: number;
    number: number; // current page index
    sort?: unknown;
    empty: boolean;
}

export function getSystemAlertsUrl(userId: string): string {
    return `${BASE_URL}/notification-service/v1/user-messages/user/${userId}/system-alerts`;
}

export async function fetchSystemAlerts(params: {
    userId: string;
    page?: number;
    size?: number;
}): Promise<PagedResponse<SystemAlertItem>> {
    const { userId, page = 0, size = 20 } = params;
    try {
        const url = getSystemAlertsUrl(userId);
        const response = await axios.get(url, {
            params: {
                page,
                size,
            },
        });
        return response.data;
    } catch (error) {
        // Return empty response when notification service is down to prevent UI crashes
        console.warn('Failed to fetch system alerts, notification service may be down:', error);
        return {
            content: [],
            pageable: {
                pageNumber: page,
                pageSize: size,
                offset: page * size,
                paged: true,
                unpaged: false,
            },
            totalPages: 0,
            totalElements: 0,
            last: true,
            numberOfElements: 0,
            first: page === 0,
            size: size,
            number: page,
            empty: true,
        };
    }
}

// Helpers to integrate with @tanstack/react-query
export function getSystemAlertsQuery(userId: string, size = 5) {
    return {
        queryKey: ['SYSTEM_ALERTS', userId, size] as const,
        queryFn: () => fetchSystemAlerts({ userId, page: 0, size }),
        staleTime: 60_000,
        retry: false, // Don't retry since we handle errors gracefully in fetchSystemAlerts
    };
}

export function getInfiniteSystemAlertsQuery(userId: string, pageSize = 20) {
    return {
        queryKey: ['SYSTEM_ALERTS_INFINITE', userId, pageSize] as const,
        queryFn: ({ pageParam = 0 }: { pageParam?: number }) =>
            fetchSystemAlerts({ userId, page: pageParam, size: pageSize }),
        getNextPageParam: (lastPage: PagedResponse<SystemAlertItem>) =>
            lastPage.last ? undefined : lastPage.number + 1,
        initialPageParam: 0,
        staleTime: 30_000,
        retry: false, // Don't retry since we handle errors gracefully in fetchSystemAlerts
    };
}

export function stripHtml(html: string): string {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
}
