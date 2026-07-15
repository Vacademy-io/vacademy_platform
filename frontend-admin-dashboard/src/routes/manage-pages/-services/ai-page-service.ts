import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_PAGE_BUILDER_GENERATE, AI_PAGE_BUILDER_ESTIMATE } from '@/constants/urls';
import { Component } from '../-types/editor-types';

export interface AiPageImage {
    url: string;
    caption?: string;
    kind?: 'logo' | 'photo' | 'banner';
}

export interface AiCourseSnapshotItem {
    name: string;
    price?: string;
    level?: string;
    description?: string;
    tags?: string[];
}

export interface GeneratePagePayload {
    brief: string;
    page_type?: string;
    route_slug?: string;
    institute_name?: string;
    images?: AiPageImage[];
    courses?: AiCourseSnapshotItem[];
    terminology?: Record<string, string>;
    direction?: string;
    run_id?: string;
}

export interface GeneratedPage {
    id: string;
    title?: string;
    route: string;
    components: Component[];
}

export interface GeneratePageResponse {
    page: GeneratedPage;
    run_id: string;
    model: string;
    warnings: string[];
}

export interface PageCreditEstimate {
    estimated_credits?: number;
    current_balance?: number;
    sufficient?: boolean;
}

export const generateAiPage = async (payload: GeneratePagePayload): Promise<GeneratePageResponse> => {
    const response = await authenticatedAxiosInstance.post<GeneratePageResponse>(
        AI_PAGE_BUILDER_GENERATE(),
        payload,
        { timeout: 240000 } // page composition is one large LLM call
    );
    return response.data;
};

export const estimateAiPageCredits = async (): Promise<PageCreditEstimate> => {
    const response = await authenticatedAxiosInstance.get<PageCreditEstimate>(
        AI_PAGE_BUILDER_ESTIMATE()
    );
    return response.data;
};
