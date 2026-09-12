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

/**
 * A dynamic placeholder mapping used by SEND_MESSAGE / SEND_TEMPLATE nodes.
 * Any `{{name}}` in the node body/params is resolved via this list first,
 * then falls back to built-in placeholders ({{phone}}, {{user.x}}, {{session.x}}).
 */
export type VariableMappingSource =
    | 'SYSTEM_FIELD'
    | 'CUSTOM_FIELD'
    | 'SESSION'
    | 'CONTEXT'
    | 'FIXED';

export interface VariableMapping {
    name: string;
    source: VariableMappingSource;
    field: string;
    defaultValue: string;
}

/**
 * Flow-level configuration stored on `ChatbotFlow.settings`.
 *
 * These decide who is told — by email, WhatsApp, or both — when the chatbot hands a conversation
 * to a human ("a learner is waiting for your reply"), and which of the institute's existing
 * notification templates renders that alert. Set them in the flow builder's Settings panel.
 */
export interface ChatbotFlowSettings {
    /** Email addresses that get the "a learner is waiting for your reply" alert. */
    notificationEmails?: string[];
    /** WhatsApp numbers that get the same alert. Requires `escalationWhatsappTemplate`. */
    notificationPhones?: string[];
    /** EMAIL notification_template name. Omitted = a built-in layout is used instead. */
    escalationEmailTemplate?: string;
    /**
     * WHATSAPP notification_template name. Required to alert phones at all — Meta only accepts
     * business-initiated messages built from an approved template.
     */
    escalationWhatsappTemplate?: string;
    /** Language of the WhatsApp template above. Defaults to `en`. */
    escalationWhatsappTemplateLanguage?: string;
    /** Master switch for these alerts on this flow. Defaults to on. */
    notifyOnEscalation?: boolean;
    /** Minimum gap before the SAME unanswered conversation alerts the admins again. */
    escalationRenotifyMinutes?: number;
    [key: string]: unknown;
}

/**
 * Placeholders the escalation alert passes to whichever template renders it. Named, so a WhatsApp
 * template maps them onto its positional params via its stored variable names, and an email
 * template substitutes `{{key}}` directly.
 */
export const ESCALATION_TEMPLATE_VARIABLES: Array<{ key: string; description: string }> = [
    { key: 'contact_name', description: "The learner's name, or their phone if unknown" },
    { key: 'phone', description: "The learner's WhatsApp number" },
    { key: 'question', description: "The message the bot couldn't answer" },
    { key: 'bot_reply', description: 'What the bot said instead' },
    { key: 'reason', description: 'Why it handed over, in plain language' },
    { key: 'institute_name', description: 'Your institute name' },
    { key: 'inbox_url', description: 'Deep link to the WhatsApp Inbox' },
];

export interface ChatbotFlowDTO {
    id?: string;
    instituteId: string;
    name: string;
    description?: string;
    channelType: string;
    status: ChatbotFlowStatus;
    version?: number;
    triggerConfig?: Record<string, unknown>;
    settings?: ChatbotFlowSettings;
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
        defaultConfig: {
            messageType: 'text',
            text: '',
            mediaUrl: '',
            mediaCaption: '',
            filename: '',
            variables: [] as VariableMapping[],
        },
    },
    {
        type: 'SEND_TEMPLATE',
        label: 'Send Template',
        description: 'Send a pre-approved WhatsApp template',
        color: '#3b82f6',
        icon: '📄',
        defaultConfig: {
            templateName: '',
            languageCode: 'en',
            bodyParams: [],
            headerConfig: { type: 'none' },
            buttonConfig: [],
            variables: [] as VariableMapping[],
        },
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
        defaultConfig: {
            conditionType: 'USER_RESPONSE',
            branches: [{ id: 'default', label: 'Default', isDefault: true }],
        },
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
        defaultConfig: {
            modelId: 'google/gemini-2.5-flash',
            systemPrompt: '',
            maxTokens: 500,
            temperature: 0.7,
            exitKeywords: ['agent', 'human'],
            maxTurns: 10,
            enableInteractive: false,
            escalateWhenUnsure: true,
            escalationMessage: '',
        },
    },
];
