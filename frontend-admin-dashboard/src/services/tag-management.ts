import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const BASE = `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/admin-core-service/tag-management`;

export interface TagItem {
    id: string;
    tagName: string;
    instituteId: string | null;
    description?: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'DELETED' | string;
    createdAt?: string;
    updatedAt?: string;
    createdByUserId?: string;
    defaultTag?: boolean;
}

export interface BulkResult {
    totalProcessed: number;
    successCount: number;
    skipCount: number;
    errorCount: number;
    errors?: string[];
    userErrors?: Record<string, string>;
    autoCreatedTags?: Array<{ tagId: string; tagName: string; action: string }>;
}

export interface TagUserCountResponse {
    tagCounts: Record<string, number>; // keyed by tagName per API sample
    totalTags: number;
    totalUsers: number;
}

export interface TagUserDetailItem {
    userId: string;
    fullName?: string;
    username?: string;
    email?: string;
    phoneNumber?: string;
    enrollmentId?: string;
}

export interface UserTagsResponse {
    userId: string;
    activeTags: TagItem[];
    inactiveTags: TagItem[];
    totalTagCount: number;
}

export async function getAllTags(): Promise<TagItem[]> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<TagItem[]>({
        method: 'GET',
        url: `${BASE}/institutes/${instituteId}/tags`,
    });
    return data;
}

export async function getInstituteTags(): Promise<TagItem[]> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<TagItem[]>({
        method: 'GET',
        url: `${BASE}/institutes/${instituteId}/tags/institute`,
    });
    return data;
}

export async function getDefaultTags(): Promise<TagItem[]> {
    const { data } = await authenticatedAxiosInstance<TagItem[]>({
        method: 'GET',
        url: `${BASE}/tags/default`,
    });
    return data;
}

export async function createInstituteTag(input: {
    tagName: string;
    description?: string;
}): Promise<TagItem> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<TagItem>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/tags`,
        data: input,
    });
    return data;
}

export async function addUsersToTagByName(tagName: string, userIds: string[]): Promise<BulkResult> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<BulkResult>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/tags/by-name/${encodeURIComponent(tagName)}/users/add`,
        data: userIds,
        headers: { 'Content-Type': 'application/json' },
    });
    return data;
}

export async function uploadCsvForTagName(tagName: string, file: File): Promise<BulkResult> {
    const instituteId = getCurrentInstituteId();
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await authenticatedAxiosInstance<BulkResult>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/tags/by-name/${encodeURIComponent(tagName)}/users/csv-upload`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}

export async function downloadCsvTemplate(): Promise<Blob> {
    const { data } = await authenticatedAxiosInstance<Blob>({
        method: 'GET',
        url: `${BASE}/csv/template`,
        responseType: 'blob',
    });
    return data;
}

export function buildFailedCasesCsv(userErrors?: Record<string, string>): Blob | null {
    if (!userErrors || Object.keys(userErrors).length === 0) return null;
    const header = 'user_id,error\n';
    const rows = Object.entries(userErrors)
        .map(([userId, err]) => `${userId},"${(err || '').replace(/"/g, '""')}"`)
        .join('\n');
    const content = header + rows + '\n';
    return new Blob([content], { type: 'text/csv;charset=utf-8;' });
}

export async function getUserCountsByTags(tagIds: string[]): Promise<TagUserCountResponse> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<TagUserCountResponse>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/tags/user-counts`,
        data: tagIds,
        headers: { 'Content-Type': 'application/json' },
    });
    return data;
}

export async function getUserIdsByTags(tagIds: string[]): Promise<string[]> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<string[]>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/tags/users`,
        data: tagIds,
        headers: { 'Content-Type': 'application/json' },
    });
    return data;
}

export async function getUserDetailsByTags(tagIds: string[]): Promise<TagUserDetailItem[]> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<TagUserDetailItem[]>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/tags/users/details`,
        data: tagIds,
        headers: { 'Content-Type': 'application/json' },
    });
    return data;
}

export async function getUserTags(userId: string): Promise<UserTagsResponse> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<UserTagsResponse>({
        method: 'GET',
        url: `${BASE}/institutes/${instituteId}/users/${userId}/tags`,
    });
    return data;
}

export async function deactivateUserTags(userId: string, tagIds: string[]): Promise<BulkResult> {
    const instituteId = getCurrentInstituteId();
    const params = new URLSearchParams();
    params.set('userIds', userId);
    params.set('tagIds', tagIds.join(','));
    const { data } = await authenticatedAxiosInstance<BulkResult>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/users/tags/deactivate?${params.toString()}`,
    });
    return data;
}
