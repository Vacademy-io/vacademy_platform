import { useState, useCallback, useRef, useEffect } from 'react';
import {
    AgentState,
    AgentChatRequest,
    AgentChatResponse,
    AgentEvent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    AgentMessage,
    AgentRespondRequest,
} from '../types/agent';
import { AGENT_CHAT, AGENT_STREAM, AGENT_RESPOND } from '@/constants/urls';

export function useAgent(instituteId: string) {
    const [state, setState] = useState<AgentState>({
        sessionId: null,
        status: 'idle',
        messages: [],
        isStreaming: false,
        error: null,
    });

    const eventSourceRef = useRef<EventSource | null>(null);
    const authTokenRef = useRef<string | null>(null);

    // Set auth token (call this after user authentication)
    const setAuthToken = useCallback((token: string) => {
        authTokenRef.current = token;
    }, []);

    // Clean up SSE connection
    const closeConnection = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setState((prev) => ({ ...prev, isStreaming: false }));
    }, []);

    // Handle incoming agent events
    const handleAgentEvent = useCallback((event: AgentEvent) => {
        setState((prev) => {
            const newMessages = [...prev.messages];

            switch (event.eventType) {
                case 'THINKING':
                    // Update status to show thinking indicator
                    return { ...prev, status: 'processing' };

                case 'TOOL_CALL':
                    // Add tool call message
                    newMessages.push({
                        id: `tool-${Date.now()}`,
                        role: 'system',
                        content: `Calling: ${event.toolName}`,
                        timestamp: new Date(),
                        eventType: 'TOOL_CALL',
                        toolCall: {
                            name: event.toolName!,
                            arguments: event.toolArguments || {},
                        },
                    });
                    return { ...prev, messages: newMessages };

                case 'TOOL_RESULT':
                    // Update the last tool call with result
                    // eslint-disable-next-line no-case-declarations
                    const lastToolIdx = newMessages.findLastIndex(
                        (m) => m.eventType === 'TOOL_CALL'
                    );
                    if (lastToolIdx >= 0) {
                        const toolMsg = newMessages[lastToolIdx];
                        if (toolMsg && toolMsg.toolCall) {
                            toolMsg.toolCall.result = event.toolResult;
                            toolMsg.toolCall.success = event.toolSuccess;
                            if (!event.toolSuccess) {
                                toolMsg.content += ` (Failed: ${event.toolError})`;
                            }
                        }
                    }
                    return { ...prev, messages: newMessages };

                case 'MESSAGE':
                    // Add assistant message
                    newMessages.push({
                        id: `msg-${Date.now()}`,
                        role: 'assistant',
                        content: event.message || '',
                        timestamp: new Date(),
                        eventType: 'MESSAGE',
                    });
                    return { ...prev, messages: newMessages };

                case 'AWAITING_INPUT':
                    // Add confirmation request
                    newMessages.push({
                        id: `confirm-${Date.now()}`,
                        role: 'assistant',
                        content: event.question || event.message || '',
                        timestamp: new Date(),
                        eventType: 'AWAITING_INPUT',
                        confirmationOptions: event.options,
                    });
                    return {
                        ...prev,
                        messages: newMessages,
                        status: 'awaiting_input',
                        isStreaming: false,
                    };

                case 'COMPLETE':
                    return {
                        ...prev,
                        status: 'complete',
                        isStreaming: false,
                    };

                case 'ERROR':
                    return {
                        ...prev,
                        status: 'error',
                        error: event.error || 'An error occurred',
                        isStreaming: false,
                    };

                case 'TIMEOUT':
                    return {
                        ...prev,
                        status: 'error',
                        error: 'Session timed out',
                        isStreaming: false,
                    };

                default:
                    return prev;
            }
        });
    }, []);

    // Subscribe to SSE stream
    const subscribeToStream = useCallback(
        (sessionId: string) => {
            closeConnection();

            const url = AGENT_STREAM(sessionId);
            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            setState((prev) => ({ ...prev, isStreaming: true }));

            // Handle different event types
            const eventTypes = [
                'THINKING',
                'TOOL_CALL',
                'TOOL_RESULT',
                'MESSAGE',
                'AWAITING_INPUT',
                'COMPLETE',
                'ERROR',
                'TIMEOUT',
            ];

            eventTypes.forEach((eventType) => {
                eventSource.addEventListener(eventType, (event: MessageEvent) => {
                    try {
                        const data: AgentEvent = JSON.parse(event.data);
                        handleAgentEvent(data);
                    } catch (e) {
                        console.error('Failed to parse SSE event:', e);
                    }
                });
            });

            eventSource.onerror = (error) => {
                console.error('SSE Error:', error);
                setState((prev) => ({
                    ...prev,
                    status: 'error',
                    error: 'Connection lost. Please try again.',
                    isStreaming: false,
                }));
                closeConnection();
            };
        },
        [closeConnection, handleAgentEvent]
    );

    // Start a new chat
    const sendMessage = useCallback(
        async (message: string, model?: string, context?: AgentChatRequest['context']) => {
            try {
                setState((prev) => ({
                    ...prev,
                    status: 'connecting',
                    error: null,
                    messages: [
                        ...prev.messages,
                        {
                            id: `user-${Date.now()}`,
                            role: 'user',
                            content: message,
                            timestamp: new Date(),
                        },
                    ],
                }));

                const request: AgentChatRequest = {
                    sessionId: state.sessionId || undefined,
                    instituteId,
                    message,
                    model: model || undefined,
                    context,
                };

                const response = await fetch(AGENT_CHAT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authTokenRef.current}`,
                    },
                    body: JSON.stringify(request),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: AgentChatResponse = await response.json();

                if (data.status === 'ERROR') {
                    throw new Error(data.message);
                }

                setState((prev) => ({
                    ...prev,
                    sessionId: data.sessionId,
                    status: 'processing',
                }));

                // Subscribe to SSE stream
                subscribeToStream(data.sessionId);
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Failed to send message',
                }));
            }
        },
        [instituteId, state.sessionId, subscribeToStream]
    );

    // Respond to agent confirmation
    const respond = useCallback(
        async (response: string, optionId?: string) => {
            if (!state.sessionId) {
                console.error('No active session');
                return;
            }

            try {
                setState((prev) => ({
                    ...prev,
                    status: 'processing',
                    messages: [
                        ...prev.messages,
                        {
                            id: `user-${Date.now()}`,
                            role: 'user',
                            content: response,
                            timestamp: new Date(),
                        },
                    ],
                }));

                const request: AgentRespondRequest = { response, optionId };

                const apiResponse = await fetch(AGENT_RESPOND(state.sessionId), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authTokenRef.current}`,
                    },
                    body: JSON.stringify(request),
                });

                if (!apiResponse.ok) {
                    throw new Error(`HTTP error! status: ${apiResponse.status}`);
                }

                // Re-subscribe to SSE stream
                subscribeToStream(state.sessionId);
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Failed to respond',
                }));
            }
        },
        [state.sessionId, subscribeToStream]
    );

    // Reset the agent state
    const reset = useCallback(() => {
        closeConnection();
        setState({
            sessionId: null,
            status: 'idle',
            messages: [],
            isStreaming: false,
            error: null,
        });
    }, [closeConnection]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            closeConnection();
        };
    }, [closeConnection]);

    return {
        ...state,
        sendMessage,
        respond,
        reset,
        setAuthToken,
    };
}
