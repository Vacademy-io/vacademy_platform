import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    BASE_URL,
    CHATBOT_FLOW_BASE,
    CHATBOT_FLOW_AI_USAGE,
    CHATBOT_FLOW_AI_USAGE_LOGS,
} from '@/constants/urls';
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
    const { data } = await authenticatedAxiosInstance.post(
        `${CHATBOT_FLOW_BASE}/${flowId}/activate`
    );
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

// ==================== Institute Custom Fields ====================

export interface CustomFieldOption {
    id: string;
    fieldKey: string;
    fieldName: string;
    fieldType: string;
}

/**
 * Fetch the institute's custom field catalog to populate the Variable Mapping
 * editor's CUSTOM_FIELD source dropdown.
 *
 * Uses `/admin-core-service/common/custom-fields/setup` which returns the
 * deduped list of ALL active custom fields for the institute (regardless of
 * whether they're used in any enroll invite or audience form). Wire shape is
 * a flat array of `InstituteCustomFieldSetupDTO` serialized with snake_case:
 *
 *   [
 *     { "custom_field_id": "...", "field_key": "full_name",
 *       "field_name": "Full Name", "field_type": "text",
 *       "form_order": 0, "is_hidden": false, "group_name": null,
 *       "type": "DEFAULT_CUSTOM_FIELD", "type_id": null, "status": "ACTIVE" }
 *   ]
 */
export const fetchInstituteCustomFields = async (
    instituteId: string
): Promise<CustomFieldOption[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/common/custom-fields/setup`,
        { params: { instituteId } }
    );
    if (!Array.isArray(data)) return [];
    return data
        .map((row: Record<string, unknown>) => ({
            id: String(row.custom_field_id ?? row.customFieldId ?? ''),
            fieldKey: String(row.field_key ?? row.fieldKey ?? ''),
            fieldName: String(row.field_name ?? row.fieldName ?? ''),
            fieldType: String(row.field_type ?? row.fieldType ?? 'text'),
        }))
        .filter((f) => f.fieldName !== '');
};

// ==================== AI Credits (AI_RESPONSE nodes) ====================

export interface FlowAiUsageRow {
    flowId: string | null;
    flowName: string | null;
    totalCredits: number;
    turnCount: number;
    userCount: number;
    lastUsedAt: number | null;
}

export interface FlowAiUsageSummary {
    totalCredits: number;
    turnCount: number;
    userCount: number;
    flowCount: number;
    /** Null when the balance could not be read. */
    currentBalance: number | null;
    /**
     * False when the institute cannot pay for AI replies. The engine applies the
     * same gate server-side, so a false here means AI nodes are genuinely paused —
     * not a warning we could choose to ignore.
     */
    aiEnabled: boolean;
    byFlow: FlowAiUsageRow[];
}

export interface FlowAiUsageLogRow {
    id: string;
    createdAt: number | null;
    flowId: string | null;
    userId: string | null;
    name: string | null;
    email: string | null;
    model: string | null;
    credits: number;
    description: string | null;
}

export interface PagedFlowAiUsageLogs {
    content: FlowAiUsageLogRow[];
    totalElements: number;
    totalPages: number;
    number: number;
}

/** Credits the flows' AI replies burned in the window, plus the funding state. */
export const fetchChatbotFlowAiUsage = async (
    startDate?: number,
    endDate?: number
): Promise<FlowAiUsageSummary> => {
    const params: Record<string, number> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await authenticatedAxiosInstance.get(CHATBOT_FLOW_AI_USAGE, { params });
    return data;
};

/** Per-turn charge history behind those figures. */
export const fetchChatbotFlowAiLogs = async (
    flowId?: string,
    page = 0,
    size = 20,
    startDate?: number,
    endDate?: number
): Promise<PagedFlowAiUsageLogs> => {
    const params: Record<string, string | number> = { page, size };
    if (flowId) params.flowId = flowId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await authenticatedAxiosInstance.get(CHATBOT_FLOW_AI_USAGE_LOGS, { params });
    return data;
};
