import axiosInstance from '@/lib/auth/axiosInstance';
import type {
    Inquiry,
    CreateInquiryPayload,
    UpdateInquiryPayload,
    InquiryFilters,
    InquiryListResponse,
    InquiryNote,
    InquiryFollowUp,
} from '../-types/inquiry-types';

const BASE_URL = '/admissions/inquiries';

// Get all inquiries with filters
export const getInquiries = async (filters: InquiryFilters): Promise<InquiryListResponse> => {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.status?.length) params.append('status', filters.status.join(','));
    if (filters.source?.length) params.append('source', filters.source.join(','));
    if (filters.priority?.length) params.append('priority', filters.priority.join(','));
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    params.append('page', String(filters.page ?? 0));
    params.append('size', String(filters.size ?? 20));

    const response = await axiosInstance.get(`${BASE_URL}?${params.toString()}`);
    return response.data;
};

// Get single inquiry
export const getInquiryById = async (id: string): Promise<Inquiry> => {
    const response = await axiosInstance.get(`${BASE_URL}/${id}`);
    return response.data;
};

// Create new inquiry
export const createInquiry = async (payload: CreateInquiryPayload): Promise<Inquiry> => {
    const response = await axiosInstance.post(BASE_URL, payload);
    return response.data;
};

// Update inquiry
export const updateInquiry = async (payload: UpdateInquiryPayload): Promise<Inquiry> => {
    const response = await axiosInstance.put(`${BASE_URL}/${payload.id}`, payload);
    return response.data;
};

// Delete inquiry
export const deleteInquiry = async (id: string): Promise<void> => {
    await axiosInstance.delete(`${BASE_URL}/${id}`);
};

// Add note to inquiry
export const addInquiryNote = async (inquiryId: string, content: string): Promise<InquiryNote> => {
    const response = await axiosInstance.post(`${BASE_URL}/${inquiryId}/notes`, { content });
    return response.data;
};

// Schedule follow-up
export const scheduleFollowUp = async (
    inquiryId: string,
    followUp: Omit<InquiryFollowUp, 'id' | 'completed' | 'completedAt' | 'outcome'>
): Promise<InquiryFollowUp> => {
    const response = await axiosInstance.post(`${BASE_URL}/${inquiryId}/follow-ups`, followUp);
    return response.data;
};

// Complete follow-up
export const completeFollowUp = async (
    inquiryId: string,
    followUpId: string,
    outcome: string
): Promise<InquiryFollowUp> => {
    const response = await axiosInstance.put(
        `${BASE_URL}/${inquiryId}/follow-ups/${followUpId}/complete`,
        { outcome }
    );
    return response.data;
};

// Convert inquiry to registration
export const convertToRegistration = async (
    inquiryId: string
): Promise<{ registrationId: string }> => {
    const response = await axiosInstance.post(`${BASE_URL}/${inquiryId}/convert`);
    return response.data;
};

// Bulk update status
export const bulkUpdateStatus = async (ids: string[], status: string): Promise<void> => {
    await axiosInstance.put(`${BASE_URL}/bulk/status`, { ids, status });
};

// Assign inquiries to staff
export const assignInquiries = async (ids: string[], assignedTo: string): Promise<void> => {
    await axiosInstance.put(`${BASE_URL}/bulk/assign`, { ids, assignedTo });
};

// Query keys for React Query
export const inquiryQueryKeys = {
    all: ['inquiries'] as const,
    lists: () => [...inquiryQueryKeys.all, 'list'] as const,
    list: (filters: InquiryFilters) => [...inquiryQueryKeys.lists(), filters] as const,
    details: () => [...inquiryQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...inquiryQueryKeys.details(), id] as const,
};
