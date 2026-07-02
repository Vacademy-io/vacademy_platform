// Types for the Vacademy Assistant widget. The SSE payload shapes mirror
// ai_service app/routers/assistant.py / assistant_service.py.

export type AssistantRole = 'user' | 'assistant' | 'action' | 'status';

/** GET /assistant/capabilities — the tool groups THIS caller may use. */
export interface AssistantCapabilities {
    groups: Array<{ key: string; mode: 'READ' | 'WRITE'; tools: string[] }>;
}

export type AssistantActionStatus = 'pending' | 'working' | 'executed' | 'cancelled' | 'failed';

/** A proposed write awaiting the user's Confirm/Cancel (nonce-backed card). */
export interface AssistantAction {
    actionId: string;
    summary: string;
    status: AssistantActionStatus;
}

export interface AssistantMessage {
    id: string;
    role: AssistantRole;
    content: string;
    /** True while assistant tokens are still streaming into this bubble. */
    streaming?: boolean;
    /** Present when role === 'action'. */
    action?: AssistantAction;
}

/** `event: action_request` — the backend proposed a write and wants confirmation. */
export interface AssistantActionRequestData {
    action_id: string;
    tool: string;
    summary: string;
    expires_at?: string;
}

export type AssistantStatus = 'idle' | 'connecting' | 'streaming' | 'error';

/** `event: token`  — a streamed chunk of the assistant's answer. */
export interface AssistantTokenData {
    content: string;
}

/** `event: message` — a persisted message row. */
export interface AssistantMessageData {
    id: number | string;
    type: 'user' | 'assistant' | 'tool_call' | 'tool_result';
    content: string;
    metadata?: Record<string, unknown> | null;
    created_at?: string;
}

/** `event: error` — a recoverable error (e.g. code 402 = out of credits). */
export interface AssistantErrorData {
    type?: string;
    code?: number;
    message: string;
}
