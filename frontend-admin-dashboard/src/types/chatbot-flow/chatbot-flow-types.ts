export type ChatbotNodeType =
    | 'TRIGGER'
    | 'SEND_TEMPLATE'
    | 'SEND_MESSAGE'
    | 'SEND_INTERACTIVE'
    | 'CONDITION'
    | 'WORKFLOW_ACTION'
    | 'DELAY'
    | 'HTTP_WEBHOOK'
    | 'AI_RESPONSE';

export type ChatbotFlowStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ChatbotFlowDTO {
    id?: string;
    instituteId: string;
    name: string;
    description?: string;
    channelType: string;
    status: ChatbotFlowStatus;
    version?: number;
    triggerConfig?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    nodes: ChatbotFlowNodeDTO[];
    edges: ChatbotFlowEdgeDTO[];
}

export interface ChatbotFlowNodeDTO {
    id: string;
    nodeType: ChatbotNodeType;
    name: string;
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
}

export interface ChatbotFlowEdgeDTO {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    conditionLabel?: string;
    conditionConfig?: Record<string, unknown>;
    sortOrder?: number;
}

// Node type metadata for the palette
export interface NodeTypeInfo {
    type: ChatbotNodeType;
    label: string;
    description: string;
    color: string;
    icon: string;
    defaultConfig: Record<string, unknown>;
}

export const NODE_TYPE_REGISTRY: NodeTypeInfo[] = [
    {
        type: 'TRIGGER',
        label: 'Trigger',
        description: 'Starts the flow when a message matches',
        color: '#22c55e',
        icon: '⚡',
        defaultConfig: { triggerType: 'KEYWORD_MATCH', keywords: [], matchType: 'contains' },
    },
    {
        type: 'SEND_MESSAGE',
        label: 'Send Message',
        description: 'Send text, image, video, or document (no template needed)',
        color: '#10b981',
        icon: '💬',
        defaultConfig: { messageType: 'text', text: '', mediaUrl: '', mediaCaption: '', filename: '' },
    },
    {
        type: 'SEND_TEMPLATE',
        label: 'Send Template',
        description: 'Send a pre-approved WhatsApp template',
        color: '#3b82f6',
        icon: '📄',
        defaultConfig: { templateName: '', languageCode: 'en', bodyParams: [], headerConfig: { type: 'none' }, buttonConfig: [] },
    },
    {
        type: 'SEND_INTERACTIVE',
        label: 'Send Interactive',
        description: 'Send buttons or list (24hr window)',
        color: '#06b6d4',
        icon: '🔘',
        defaultConfig: { interactiveType: 'button', body: '', buttons: [], sections: [] },
    },
    {
        type: 'CONDITION',
        label: 'Condition',
        description: 'Branch based on user reply',
        color: '#eab308',
        icon: '🔀',
        defaultConfig: { conditionType: 'USER_RESPONSE', branches: [{ id: 'default', label: 'Default', isDefault: true }] },
    },
    {
        type: 'WORKFLOW_ACTION',
        label: 'Workflow',
        description: 'Trigger a backend workflow',
        color: '#8b5cf6',
        icon: '⚙️',
        defaultConfig: { workflowId: '', params: {} },
    },
    {
        type: 'DELAY',
        label: 'Delay',
        description: 'Wait before continuing',
        color: '#6b7280',
        icon: '⏱️',
        defaultConfig: { delayType: 'FIXED', delayValue: 5, delayUnit: 'MINUTES' },
    },
    {
        type: 'HTTP_WEBHOOK',
        label: 'HTTP Webhook',
        description: 'Call an external URL',
        color: '#f97316',
        icon: '🌐',
        defaultConfig: { url: '', method: 'POST', headers: {}, body: {} },
    },
    {
        type: 'AI_RESPONSE',
        label: 'AI Response',
        description: 'AI-powered conversation',
        color: '#14b8a6',
        icon: '🤖',
        defaultConfig: { modelId: 'google/gemini-2.0-flash-001', systemPrompt: '', maxTokens: 500, temperature: 0.7, exitKeywords: ['agent', 'human'], maxTurns: 10 },
    },
];
