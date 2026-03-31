import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CHATBOT_FLOW_BASE } from '@/constants/urls';
import { ChatbotFlowDTO } from '@/types/chatbot-flow/chatbot-flow-types';

export interface WhatsAppTemplateInfo {
    name: string;
    language: string;
    category: string;
    status: string;
    headerType: string;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    bodyParamCount: number;
    buttons?: Array<{
        type: string;
        text: string;
        url?: string;
        hasDynamicUrl: boolean;
    }>;
}

export const createChatbotFlow = async (dto: ChatbotFlowDTO): Promise<ChatbotFlowDTO> => {
    const { data } = await authenticatedAxiosInstance.post(CHATBOT_FLOW_BASE, dto);
    return data;
};

export const getChatbotFlow = async (flowId: string): Promise<ChatbotFlowDTO> => {
    const { data } = await authenticatedAxiosInstance.get(`${CHATBOT_FLOW_BASE}/${flowId}`);
    return data;
};

export const updateChatbotFlow = async (
    flowId: string,
    dto: ChatbotFlowDTO
): Promise<ChatbotFlowDTO> => {
    const { data } = await authenticatedAxiosInstance.put(`${CHATBOT_FLOW_BASE}/${flowId}`, dto);
    return data;
};

export const deleteChatbotFlow = async (flowId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(`${CHATBOT_FLOW_BASE}/${flowId}`);
};

export const listChatbotFlows = async (
    instituteId: string,
    status?: string
): Promise<ChatbotFlowDTO[]> => {
    const params: Record<string, string> = { instituteId };
    if (status) params.status = status;
    const { data } = await authenticatedAxiosInstance.get(`${CHATBOT_FLOW_BASE}/list`, { params });
    return data;
};

export const activateChatbotFlow = async (flowId: string): Promise<ChatbotFlowDTO> => {
    const { data } = await authenticatedAxiosInstance.post(`${CHATBOT_FLOW_BASE}/${flowId}/activate`);
    return data;
};

export const deactivateChatbotFlow = async (flowId: string): Promise<ChatbotFlowDTO> => {
    const { data } = await authenticatedAxiosInstance.post(
        `${CHATBOT_FLOW_BASE}/${flowId}/deactivate`
    );
    return data;
};

export const duplicateChatbotFlow = async (flowId: string): Promise<ChatbotFlowDTO> => {
    const { data } = await authenticatedAxiosInstance.post(
        `${CHATBOT_FLOW_BASE}/${flowId}/duplicate`
    );
    return data;
};

// ==================== Sessions & Analytics ====================

export interface ChatbotFlowSession {
    id: string;
    flowId: string;
    flowName: string;
    instituteId: string;
    userPhone: string;
    userId?: string;
    currentNodeId?: string;
    currentNodeName?: string;
    currentNodeType?: string;
    status: string;
    context?: Record<string, unknown>;
    startedAt?: string;
    lastActivityAt?: string;
    completedAt?: string;
    messages?: Array<{
        id: string;
        type: string;
        body: string;
        source: string;
        timestamp: string;
        direction: 'OUTGOING' | 'INCOMING';
    }>;
}

export interface FlowAnalytics {
    flowId: string;
    flowName: string;
    status: string;
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    errorSessions: number;
    timedOutSessions: number;
}

export const listFlowSessions = async (
    flowId: string,
    status?: string,
    page = 0,
    size = 20
): Promise<ChatbotFlowSession[]> => {
    const params: Record<string, string | number> = { page, size };
    if (status) params.status = status;
    const { data } = await authenticatedAxiosInstance.get(
        `${CHATBOT_FLOW_BASE}/${flowId}/sessions`,
        { params }
    );
    return data;
};

export const getSessionDetail = async (sessionId: string): Promise<ChatbotFlowSession> => {
    const { data } = await authenticatedAxiosInstance.get(
        `${CHATBOT_FLOW_BASE}/sessions/${sessionId}`
    );
    return data;
};

export const getFlowAnalytics = async (flowId: string): Promise<FlowAnalytics> => {
    const { data } = await authenticatedAxiosInstance.get(
        `${CHATBOT_FLOW_BASE}/${flowId}/analytics`
    );
    return data;
};

export const getInstituteAnalytics = async (instituteId: string): Promise<FlowAnalytics[]> => {
    const { data } = await authenticatedAxiosInstance.get(`${CHATBOT_FLOW_BASE}/analytics`, {
        params: { instituteId },
    });
    return data;
};

export const fetchWhatsAppTemplates = async (
    instituteId: string
): Promise<WhatsAppTemplateInfo[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        `${CHATBOT_FLOW_BASE}/templates/whatsapp`,
        { params: { instituteId } }
    );
    return data;
};
