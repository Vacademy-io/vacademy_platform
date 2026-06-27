import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { INSTITUTE_WIDGET_BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';

// ---- Types (camelCase, matching community-service) -------------------------------

export type WidgetType = 'ONBOARDING_TRACKER' | 'INFO_CARD';
export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type InfoSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Milestone {
    id: string;
    label: string;
    status: MilestoneStatus;
    estimatedDate?: string | null;
    note?: string | null;
    source?: 'TEMPLATE' | 'CUSTOM';
}

export interface OnboardingPayload {
    milestones?: Milestone[];
    overallNote?: string | null;
}

export interface InfoCardPayload {
    body?: string | null;
    severity?: InfoSeverity;
    imageUrl?: string | null;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
}

export interface DashboardWidget {
    id: string;
    widgetType: WidgetType;
    targetType: 'INSTITUTE' | 'LEAD_TAG';
    targetValue: string;
    visibleRoles: string[];
    title: string;
    payload: OnboardingPayload & InfoCardPayload;
    status: string;
    position: number;
    createdAt: number | null;
    updatedAt: number | null;
}

export interface WidgetInteraction {
    id: string;
    widgetId: string;
    milestoneId: string | null;
    interactionType: 'COMMENT' | 'CONFIRM';
    message: string | null;
    userId: string;
    userName: string | null;
    instituteId: string;
    createdAt: number | null;
}

// ---- Query / mutations -----------------------------------------------------------

/**
 * Published super-admin widgets for the current institute + the caller's role. Degrades to an empty
 * list if community-service is unavailable so the dashboard never crashes.
 */
export function getMyWidgetsQuery() {
    const instituteId = getInstituteId();
    return {
        queryKey: ['institute-widgets', instituteId],
        queryFn: async (): Promise<DashboardWidget[]> => {
            try {
                const res = await authenticatedAxiosInstance.get<DashboardWidget[]>(
                    `${INSTITUTE_WIDGET_BASE_URL}/me`,
                    { params: { instituteId } }
                );
                return res.data || [];
            } catch {
                return [];
            }
        },
        staleTime: 5 * 60 * 1000,
        retry: 1,
    };
}

export async function postWidgetComment(
    widgetId: string,
    message: string,
    milestoneId?: string
): Promise<WidgetInteraction> {
    const instituteId = getInstituteId();
    const res = await authenticatedAxiosInstance.post<WidgetInteraction>(
        `${INSTITUTE_WIDGET_BASE_URL}/${widgetId}/comment`,
        { message, milestoneId: milestoneId || null },
        { params: { instituteId } }
    );
    return res.data;
}

export async function confirmMilestone(
    widgetId: string,
    milestoneId: string,
    message?: string
): Promise<WidgetInteraction> {
    const instituteId = getInstituteId();
    const res = await authenticatedAxiosInstance.post<WidgetInteraction>(
        `${INSTITUTE_WIDGET_BASE_URL}/${widgetId}/milestones/${milestoneId}/confirm`,
        { message: message || null },
        { params: { instituteId } }
    );
    return res.data;
}

export function milestoneProgress(milestones: Milestone[] = []): number {
    if (!milestones.length) return 0;
    const done = milestones.filter((m) => m.status === 'DONE').length;
    return Math.round((done / milestones.length) * 100);
}
