# AI Agent Frontend Integration Guide

## Overview

This guide explains how to integrate the Vacademy AI Agent API with a React.js frontend. The agent uses a **ReAct (Reason + Act) loop** architecture with **Server-Sent Events (SSE)** for real-time updates.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              React Frontend                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. POST /agent/chat ──► Returns sessionId immediately                      │
│  2. EventSource (SSE) ──► Receives real-time events                         │
│  3. POST /agent/respond ──► User confirmation/response                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend (Spring Boot)                              │
│  AgentOrchestrator ←→ LLM (OpenRouter) ←→ Vector Search ←→ Tool Executor   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin-core-service/v1/agent/chat` | Start/continue a chat session |
| `GET` | `/admin-core-service/v1/agent/stream/{sessionId}` | SSE stream for real-time events |
| `POST` | `/admin-core-service/v1/agent/respond/{sessionId}` | Respond to agent confirmation |
| `GET` | `/admin-core-service/v1/agent/session/{sessionId}/status` | Get session status |

---

## TypeScript Types

Create a file `src/types/agent.ts`:

```typescript
// Request/Response Types
export interface AgentChatRequest {
  sessionId?: string;          // Optional: for continuing existing session
  instituteId: string;         // Required: current institute context
  message: string;             // Required: user's message
  model?: string;              // Optional: LLM model (default: anthropic/claude-3.5-sonnet)
  context?: AgentContext;      // Optional: additional context
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
  optionId?: string;           // When responding to specific option
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
  toolArguments?: Record<string, any>;
  
  // TOOL_RESULT event
  toolResult?: any;
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
    arguments: Record<string, any>;
    result?: any;
    success?: boolean;
  };
  confirmationOptions?: ConfirmationOption[];
}

// Available LLM Models
export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Best for complex reasoning' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Fast and capable' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Cost-effective' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: 'Good for general tasks' },
] as const;
```

---

## React Hook: useAgent

Create a file `src/hooks/useAgent.ts`:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  AgentState, 
  AgentChatRequest, 
  AgentChatResponse, 
  AgentEvent, 
  AgentMessage,
  AgentRespondRequest 
} from '../types/agent';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://backend-stage.vacademy.io';

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
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  // Subscribe to SSE stream
  const subscribeToStream = useCallback((sessionId: string) => {
    closeConnection();

    const url = `${API_BASE_URL}/admin-core-service/v1/agent/stream/${sessionId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    setState(prev => ({ ...prev, isStreaming: true }));

    // Handle different event types
    const eventTypes = ['THINKING', 'TOOL_CALL', 'TOOL_RESULT', 'MESSAGE', 'AWAITING_INPUT', 'COMPLETE', 'ERROR', 'TIMEOUT'];
    
    eventTypes.forEach(eventType => {
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
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        error: 'Connection lost. Please try again.',
        isStreaming: false 
      }));
      closeConnection();
    };
  }, [closeConnection]);

  // Handle incoming agent events
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    setState(prev => {
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
          const lastToolIdx = newMessages.findLastIndex(m => m.eventType === 'TOOL_CALL');
          if (lastToolIdx >= 0 && newMessages[lastToolIdx].toolCall) {
            newMessages[lastToolIdx].toolCall!.result = event.toolResult;
            newMessages[lastToolIdx].toolCall!.success = event.toolSuccess;
            if (!event.toolSuccess) {
              newMessages[lastToolIdx].content += ` (Failed: ${event.toolError})`;
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
            isStreaming: false 
          };

        case 'COMPLETE':
          return { 
            ...prev, 
            status: 'complete',
            isStreaming: false 
          };

        case 'ERROR':
          return { 
            ...prev, 
            status: 'error',
            error: event.error || 'An error occurred',
            isStreaming: false 
          };

        case 'TIMEOUT':
          return { 
            ...prev, 
            status: 'error',
            error: 'Session timed out',
            isStreaming: false 
          };

        default:
          return prev;
      }
    });
  }, []);

  // Start a new chat
  const sendMessage = useCallback(async (
    message: string, 
    model: string = 'anthropic/claude-3.5-sonnet',
    context?: AgentChatRequest['context']
  ) => {
    try {
      setState(prev => ({
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
        model,
        context,
      };

      const response = await fetch(`${API_BASE_URL}/admin-core-service/v1/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authTokenRef.current}`,
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

      setState(prev => ({
        ...prev,
        sessionId: data.sessionId,
        status: 'processing',
      }));

      // Subscribe to SSE stream
      subscribeToStream(data.sessionId);

    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
    }
  }, [instituteId, state.sessionId, subscribeToStream]);

  // Respond to agent confirmation
  const respond = useCallback(async (response: string, optionId?: string) => {
    if (!state.sessionId) {
      console.error('No active session');
      return;
    }

    try {
      setState(prev => ({
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

      const apiResponse = await fetch(
        `${API_BASE_URL}/admin-core-service/v1/agent/respond/${state.sessionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authTokenRef.current}`,
          },
          body: JSON.stringify(request),
        }
      );

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`);
      }

      // Re-subscribe to SSE stream
      subscribeToStream(state.sessionId);

    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to respond',
      }));
    }
  }, [state.sessionId, subscribeToStream]);

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
```

---

## React Component: AgentChat

Create a file `src/components/AgentChat.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAgent } from '../hooks/useAgent';
import { AVAILABLE_MODELS, AgentMessage, ConfirmationOption } from '../types/agent';

interface AgentChatProps {
  instituteId: string;
  authToken: string;
}

export function AgentChat({ instituteId, authToken }: AgentChatProps) {
  const {
    sessionId,
    status,
    messages,
    isStreaming,
    error,
    sendMessage,
    respond,
    reset,
    setAuthToken,
  } = useAgent(instituteId);

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set auth token on mount
  useEffect(() => {
    setAuthToken(authToken);
  }, [authToken, setAuthToken]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'processing' || status === 'connecting') return;
    
    sendMessage(input.trim(), selectedModel);
    setInput('');
  };

  const handleConfirmation = (option: ConfirmationOption) => {
    respond(option.label, option.id);
  };

  const handleTextResponse = () => {
    if (!input.trim()) return;
    respond(input.trim());
    setInput('');
  };

  return (
    <div className="agent-chat">
      {/* Header */}
      <div className="agent-chat-header">
        <h2>AI Assistant</h2>
        <div className="model-selector">
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={status === 'processing'}
          >
            {AVAILABLE_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        {sessionId && (
          <button onClick={reset} className="reset-btn">
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="agent-chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>👋 Hi! I'm your AI assistant. Ask me anything about your institute.</p>
            <p className="hint">Try: "Show me learner enrollment stats" or "Get report for John"</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            onConfirm={handleConfirmation}
          />
        ))}

        {/* Status Indicators */}
        {status === 'connecting' && (
          <div className="status-indicator connecting">
            <span className="spinner" /> Connecting...
          </div>
        )}
        
        {status === 'processing' && (
          <div className="status-indicator thinking">
            <span className="spinner" /> Agent is thinking...
          </div>
        )}

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={status === 'awaiting_input' ? (e) => { e.preventDefault(); handleTextResponse(); } : handleSubmit} className="agent-chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            status === 'awaiting_input' 
              ? "Type your response..." 
              : "Ask me anything..."
          }
          disabled={status === 'processing' || status === 'connecting'}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || status === 'processing' || status === 'connecting'}
        >
          {status === 'awaiting_input' ? 'Respond' : 'Send'}
        </button>
      </form>
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: AgentMessage;
  onConfirm: (option: ConfirmationOption) => void;
}

function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const { role, content, eventType, toolCall, confirmationOptions } = message;

  return (
    <div className={`message-bubble ${role}`}>
      {/* Tool Call Indicator */}
      {eventType === 'TOOL_CALL' && toolCall && (
        <div className="tool-call">
          <span className="tool-icon">🔧</span>
          <span className="tool-name">{toolCall.name}</span>
          {toolCall.success !== undefined && (
            <span className={`tool-status ${toolCall.success ? 'success' : 'failed'}`}>
              {toolCall.success ? '✓' : '✗'}
            </span>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className="message-content">
        {/* Render markdown-style content */}
        {content.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {/* Confirmation Options */}
      {eventType === 'AWAITING_INPUT' && confirmationOptions && (
        <div className="confirmation-options">
          {confirmationOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onConfirm(option)}
              className={`confirm-btn ${option.id === 'yes' ? 'primary' : 'secondary'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## CSS Styles

Create a file `src/components/AgentChat.css`:

```css
.agent-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 800px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.agent-chat-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.agent-chat-header h2 {
  margin: 0;
  flex: 1;
  font-size: 1.25rem;
}

.model-selector select {
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
}

.reset-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.agent-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f8f9fa;
}

.empty-state {
  text-align: center;
  color: #6c757d;
  padding: 40px;
}

.empty-state .hint {
  font-size: 0.875rem;
  color: #adb5bd;
}

.message-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-bubble.user {
  align-self: flex-end;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble.assistant {
  align-self: flex-start;
  background: white;
  color: #212529;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.message-bubble.system {
  align-self: center;
  background: #e9ecef;
  color: #495057;
  font-size: 0.875rem;
  border-radius: 8px;
}

.tool-call {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 0.875rem;
}

.tool-icon {
  font-size: 1rem;
}

.tool-name {
  font-weight: 600;
}

.tool-status.success {
  color: #28a745;
}

.tool-status.failed {
  color: #dc3545;
}

.message-content p {
  margin: 0 0 8px 0;
}

.message-content p:last-child {
  margin-bottom: 0;
}

.confirmation-options {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.confirm-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.confirm-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.confirm-btn.primary {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
}

.confirm-btn.secondary {
  background: #e9ecef;
  color: #495057;
}

.status-indicator {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #e9ecef;
  border-radius: 20px;
  font-size: 0.875rem;
  color: #6c757d;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #dee2e6;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  align-self: center;
  padding: 12px 16px;
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  color: #c53030;
  font-size: 0.875rem;
}

.agent-chat-input {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #e9ecef;
}

.agent-chat-input input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 24px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.agent-chat-input input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.agent-chat-input button {
  padding: 12px 24px;
  border-radius: 24px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.agent-chat-input button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.agent-chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Usage Example

```tsx
import React from 'react';
import { AgentChat } from './components/AgentChat';
import './components/AgentChat.css';

function App() {
  // Get these from your auth context
  const instituteId = 'your-institute-id';
  const authToken = 'your-jwt-token';

  return (
    <div style={{ height: '600px', padding: '24px' }}>
      <AgentChat 
        instituteId={instituteId} 
        authToken={authToken} 
      />
    </div>
  );
}

export default App;
```

---

## Event Flow Examples

### Example 1: Simple Query

```
User: "How many active learners do we have?"

Events:
1. THINKING → "Analyzing request..."
2. TOOL_CALL → searchLearners({ status: "ACTIVE" })
3. TOOL_RESULT → { count: 150, learners: [...] }
4. MESSAGE → "You have 150 active learners enrolled in your institute."
5. COMPLETE
```

### Example 2: Multi-Step with Confirmation

```
User: "Delete learner John Doe"

Events:
1. THINKING → "Analyzing request..."
2. TOOL_CALL → searchLearners({ name: "John Doe" })
3. TOOL_RESULT → [{ id: 55, name: "John Doe" }]
4. AWAITING_INPUT → "I found John Doe (ID: 55). Should I delete this learner?"
   Options: [Yes, proceed] [No, cancel]

User clicks "Yes, proceed"

5. THINKING → "Processing confirmation..."
6. TOOL_CALL → deleteLearner({ learnerId: 55 })
7. TOOL_RESULT → { success: true }
8. MESSAGE → "John Doe has been deleted successfully."
9. COMPLETE
```

---

## Error Handling

```typescript
// Handle connection errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  // Attempt reconnection
  setTimeout(() => subscribeToStream(sessionId), 3000);
};

// Handle HTTP errors
if (!response.ok) {
  if (response.status === 401) {
    // Token expired - redirect to login
    window.location.href = '/login';
  } else if (response.status === 403) {
    // Insufficient permissions
    setError('You do not have permission to use the AI assistant.');
  } else {
    setError(`Server error: ${response.status}`);
  }
}
```

---

## Best Practices

1. **Always pass instituteId**: Every request requires the institute context.

2. **Handle SSE reconnection**: The connection may drop; implement retry logic.

3. **Persist sessionId**: Store in localStorage to resume conversations across page refreshes.

4. **Show loading states**: Users should see visual feedback during processing.

5. **Handle confirmation prompts**: Always render confirmation options when `AWAITING_INPUT` is received.

6. **Cleanup on unmount**: Close SSE connections when components unmount.

7. **Token refresh**: If using short-lived tokens, ensure they're refreshed before making requests.

---

## Testing

Mock the SSE stream for testing:

```typescript
// __mocks__/eventSource.ts
export class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  simulateEvent(type: string, data: any) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.onmessage?.(event);
  }
  
  close() {}
}

// In tests
(global as any).EventSource = MockEventSource;
```

---

## Support

For issues or questions, contact the backend team or check the API documentation at `/swagger-ui.html`.
