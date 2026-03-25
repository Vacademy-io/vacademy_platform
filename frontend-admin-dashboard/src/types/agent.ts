// Request/Response Types
export interface AgentChatRequest {
    sessionId?: string; // Optional: for continuing existing session
    instituteId: string; // Required: current institute context
    message: string; // Required: user's message
    model?: string; // Optional: LLM model (default: anthropic/claude-3.5-sonnet)
    context?: AgentContext; // Optional: additional context
}

export interface AgentContext {
    packageSessionId?: string;
    courseId?: string;
    userId?: string;
}

export interface AgentChatResponse {
    sessionId: string;
    status: 'STARTED' | 'RESUMED' | 'ERROR';
    message: string;
    timestamp: string;
    streamEndpoint: string;
}

export interface AgentRespondRequest {
    response: string;
    optionId?: string; // When responding to specific option
}

// SSE Event Types
export type AgentEventType =
    | 'THINKING'
    | 'TOOL_CALL'
    | 'TOOL_RESULT'
    | 'MESSAGE'
    | 'AWAITING_INPUT'
    | 'COMPLETE'
    | 'ERROR'
    | 'TIMEOUT';

export interface AgentEvent {
    eventType: AgentEventType;
    sessionId: string;
    timestamp: string;

    // THINKING event
    thought?: string;

    // TOOL_CALL event
    toolName?: string;
    toolDescription?: string;
    toolArguments?: Record<string, unknown>;

    // TOOL_RESULT event
    toolResult?: unknown;
    toolSuccess?: boolean;
    toolError?: string;

    // MESSAGE event
    message?: string;

    // AWAITING_INPUT event
    question?: string;
    options?: ConfirmationOption[];

    // ERROR event
    error?: string;

    // COMPLETE event
    summary?: string;
}

export interface ConfirmationOption {
    id: string;
    label: string;
    description: string;
}

// UI State
export interface AgentState {
    sessionId: string | null;
    status: 'idle' | 'connecting' | 'processing' | 'awaiting_input' | 'complete' | 'error';
    messages: AgentMessage[];
    isStreaming: boolean;
    error: string | null;
}

export interface AgentMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    eventType?: AgentEventType;
    toolCall?: {
        name: string;
        arguments: Record<string, unknown>;
        result?: unknown;
        success?: boolean;
    };
    confirmationOptions?: ConfirmationOption[];
}
