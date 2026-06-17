import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { SUPPORT_BASE_URL } from '@/constants/urls';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

// ---- Types (camelCase, matching community-service) ---------------------------------

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'MAJOR' | 'MINOR';
export type TicketCategory = 'BUG' | 'QUESTION' | 'BILLING' | 'FEATURE_REQUEST' | 'OTHER';
export type SenderType = 'CUSTOMER' | 'SUPPORT' | 'SYSTEM';

export interface SupportPlanDto {
    key: string;
    displayName: string;
    description: string;
    hoursOfOperation: string;
    dedicatedEngineer: boolean;
    majorSlaHours: number | null;
    majorSlaText: string;
    minorSlaHours: number | null;
    minorSlaText: string;
}

export interface SupportConfigDto {
    instituteId: string;
    plan: SupportPlanDto;
    dedicatedEngineerNames: string[];
    openTicketCount: number;
}

export interface SupportAttachment {
    fileId?: string;
    fileName?: string;
    url?: string;
}

export interface SupportMessageDto {
    id: string;
    ticketId: string;
    senderType: SenderType;
    senderName: string | null;
    senderUserId: string | null;
    body: string;
    attachments: SupportAttachment[];
    internalNote: boolean;
    createdAt: string;
}

export interface SupportTicketDto {
    id: string;
    instituteId: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    planAtCreation: string | null;
    firstResponseDueAt: string | null;
    firstRespondedAt: string | null;
    resolvedAt: string | null;
    lastMessageAt: string | null;
    messageCount: number;
    overdue: boolean;
    createdAt: string;
    updatedAt: string;
    raisedByName: string | null;
    messages?: SupportMessageDto[];
}

export interface SupportPage<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

// ---- Identity helpers --------------------------------------------------------------

function currentInstituteName(): string | null {
    return useInstituteDetailsStore.getState().instituteDetails?.institute_name ?? null;
}

// ---- Hooks -------------------------------------------------------------------------

export function useSupportConfig() {
    return useQuery({
        queryKey: ['support', 'config'],
        queryFn: async () =>
            (await authenticatedAxiosInstance.get<SupportConfigDto>(`${SUPPORT_BASE_URL}/config`))
                .data,
        staleTime: 5 * 60 * 1000,
    });
}

export function useMyTickets(status?: string, enabled = true) {
    return useQuery({
        queryKey: ['support', 'tickets', status ?? 'ALL'],
        queryFn: async () =>
            (
                await authenticatedAxiosInstance.get<SupportPage<SupportTicketDto>>(
                    `${SUPPORT_BASE_URL}/tickets`,
                    { params: { status: status || undefined, size: 50 } }
                )
            ).data,
        enabled,
        refetchInterval: enabled ? 20000 : false,
    });
}

export function useTicket(id: string | null) {
    return useQuery({
        queryKey: ['support', 'ticket', id],
        queryFn: async () =>
            (
                await authenticatedAxiosInstance.get<SupportTicketDto>(
                    `${SUPPORT_BASE_URL}/tickets/${id}`
                )
            ).data,
        enabled: !!id,
        refetchInterval: id ? 15000 : false,
    });
}

export interface CreateTicketPayload {
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    message: string;
}

export function useCreateTicket() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CreateTicketPayload) => {
            // Raiser identity is derived server-side from the authenticated principal; we only
            // pass instituteName as a display hint for support-team alerts.
            const { data } = await authenticatedAxiosInstance.post<SupportTicketDto>(
                `${SUPPORT_BASE_URL}/tickets`,
                payload,
                { params: { instituteName: currentInstituteName() || undefined } }
            );
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support', 'config'] });
        },
    });
}

export function useReplyToTicket() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (vars: { id: string; body: string }) =>
            (
                await authenticatedAxiosInstance.post<SupportTicketDto>(
                    `${SUPPORT_BASE_URL}/tickets/${vars.id}/messages`,
                    { body: vars.body }
                )
            ).data,
        onSuccess: (_d, vars) => {
            queryClient.invalidateQueries({ queryKey: ['support', 'ticket', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
        },
    });
}

export function useSetTicketStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (vars: { id: string; status: TicketStatus }) =>
            (
                await authenticatedAxiosInstance.post<SupportTicketDto>(
                    `${SUPPORT_BASE_URL}/tickets/${vars.id}/status`,
                    { status: vars.status }
                )
            ).data,
        onSuccess: (_d, vars) => {
            queryClient.invalidateQueries({ queryKey: ['support', 'ticket', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support', 'config'] });
        },
    });
}
