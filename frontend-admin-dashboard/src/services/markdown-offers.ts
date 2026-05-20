import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    APPLY_MARKDOWN_URL,
    LOOKUP_MARKDOWN_URL,
    RESET_MARKDOWN_URL,
} from '@/constants/urls';

export type MarkdownMode = 'PERCENT' | 'ABSOLUTE';

export interface ApplyMarkdownRequest {
    instituteId: string;
    packageSessionIds: string[];
    mode: MarkdownMode;
    value: number;
}

export interface ResetMarkdownRequest {
    instituteId: string;
    packageSessionIds: string[];
}

export interface LookupMarkdownRequest {
    instituteId: string;
    packageSessionIds: string[];
}

export interface MarkdownResultRow {
    packageSessionId: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    paymentOptionId?: string;
    paymentPlanId?: string;
    oldActualPrice?: number;
    newActualPrice?: number;
    elevatedPrice?: number;
    currency?: string;
    conflictingPackageSessionIds?: string[];
}

export interface MarkdownResponse {
    totalRequested: number;
    successCount: number;
    failureCount: number;
    results: MarkdownResultRow[];
}

export interface MarkdownLookupItem {
    packageSessionId: string;
    paymentOptionId?: string;
    paymentOptionType?: string;
    paymentOptionSource?: string;
    paymentPlanId?: string;
    actualPrice?: number;
    elevatedPrice?: number;
    currency?: string;
    discountable: boolean;
    ineligibleReason?: string;
    sharedWithPackageSessionIds?: string[];
}

const requireInstituteId = (): string => {
    const id = getCurrentInstituteId();
    if (!id) throw new Error('No institute selected.');
    return id;
};

export const lookupMarkdown = async (
    packageSessionIds: string[]
): Promise<MarkdownLookupItem[]> => {
    if (packageSessionIds.length === 0) return [];
    const response = await authenticatedAxiosInstance<MarkdownLookupItem[]>({
        method: 'POST',
        url: LOOKUP_MARKDOWN_URL,
        data: {
            instituteId: requireInstituteId(),
            packageSessionIds,
        } satisfies LookupMarkdownRequest,
    });
    return response.data;
};

export const applyMarkdown = async (
    packageSessionIds: string[],
    mode: MarkdownMode,
    value: number
): Promise<MarkdownResponse> => {
    const response = await authenticatedAxiosInstance<MarkdownResponse>({
        method: 'POST',
        url: APPLY_MARKDOWN_URL,
        data: {
            instituteId: requireInstituteId(),
            packageSessionIds,
            mode,
            value,
        } satisfies ApplyMarkdownRequest,
    });
    return response.data;
};

export const resetMarkdown = async (
    packageSessionIds: string[]
): Promise<MarkdownResponse> => {
    const response = await authenticatedAxiosInstance<MarkdownResponse>({
        method: 'POST',
        url: RESET_MARKDOWN_URL,
        data: {
            instituteId: requireInstituteId(),
            packageSessionIds,
        } satisfies ResetMarkdownRequest,
    });
    return response.data;
};

export const computeMarkdownPercent = (
    actual?: number,
    elevated?: number
): number | null => {
    if (
        actual == null ||
        elevated == null ||
        elevated <= 0 ||
        actual > elevated
    ) {
        return null;
    }
    return Math.round(((elevated - actual) / elevated) * 100);
};
