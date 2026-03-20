/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_COURSE_API_CONFIG, buildApiUrl } from '@/config/aiCourseApi';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

import { SCRAPE_URL } from '@/constants/urls';

export interface ChatApiRequest {
    prompt: string;
    model: string;
    attachments?: Array<{
        id: string;
        name: string;
        type: 'pdf' | 'video' | 'image';
        url: string;
    }>;
    codePrompt?: {
        code: string;
        language: string;
        description: string;
    };
    conversationHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}

export interface ChatApiResponse {
    content: string;
    model_used: string;
    // Some endpoints may return these alternative keys
    message?: string;
    result?: string;
    model?: string;
    timestamp: string;
    status: 'success' | 'error';
    error?: string;
}

// Test function that exactly matches your working Postman configuration
export const testChatMessagePostmanFormat = async (): Promise<ChatApiResponse> => {
    const testUrl = `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/media-service/course/ai/v1/generate?instituteId=123&model=google%2Fgemini-2.5-pro`;

    // Using the exact prompt from your working Postman request
    const testPrompt = `Subject: Python Programming
Level: Beginner
Session No. 1: Introduction to Python
Learning Objectives
By the end of this session, students will:
Understand what Python is and its key features.
Set up Python on their computer.
Write their first Python program.
Python usage
Image source: https://www.98thpercentile.com/blog/what-is-python-used-for/

Session Outline
Warm-Up (6 minutes)
A quick overview of programming vs coding.
Suggested Video(6 minutes): Click Here
Credit: https://www.youtube.com/@AaronJack
Topic 1: What is Python? (4 minutes)
Overview of Python.
Key features: simplicity, versatility, open-source.
Suggested Video(4 minutes): Click Here
Topic 2: Setting Up Python (10 minutes)
Downloading Python
Installing an IDE (e.g., Thonny or VS Code).
Testing installation with a "Hello, World!" script.
Suggested Video(10 minutes): Click Here
Topic 3: Writing Your First Program (4 minutes)
Syntax overview.
Hands-on: Write a Python program to display "Hello, [your name]!"
Suggested Video(4 minutes): Click Here
Wrap-Up (6 minutes)
Recap key points.
Introduce the next session: "Variables and Data Types in Python."
Suggested Video(6 minutes): Click Here

Additional References
https://www.w3schools.com/python/default.asp`;

    const testPayload = {
        user_prompt: testPrompt,
    };

    const response = await authenticatedAxiosInstance.post<ChatApiResponse>(testUrl, testPayload, {
        timeout: AI_COURSE_API_CONFIG.timeout,
        headers: AI_COURSE_API_CONFIG.defaultHeaders,
    });
    return response.data;
};

// Quick test function with simple prompt for connection testing
export const testSimplePrompt = async (): Promise<ChatApiResponse> => {
    const testUrl = `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/media-service/course/ai/v1/generate?instituteId=123&model=google%2Fgemini-2.5-pro`;

    const testPayload = {
        user_prompt: 'Create a very brief introduction to Python programming in 2 sentences.',
    };

    const response = await authenticatedAxiosInstance.post<ChatApiResponse>(testUrl, testPayload, {
        timeout: AI_COURSE_API_CONFIG.timeout,
        headers: AI_COURSE_API_CONFIG.defaultHeaders,
    });
    return response.data;
};

export const sendChatMessage = async (request: ChatApiRequest): Promise<ChatApiResponse> => {
    try {
        // Get institute ID from user token
        const accessToken = getTokenFromCookie(TokenKey.accessToken);

        if (!accessToken) {
            throw new Error('No access token found. Please log in again.');
        }

        const instituteId = getCurrentInstituteId();

        if (!instituteId) {
            throw new Error('Institute ID not found. Please log in again.');
        }

        // Build API URL with query parameters
        const apiUrl = buildApiUrl('generate', {
            instituteId: instituteId,
            model: request.model, // Don't double encode - URLSearchParams will handle it
        });

        const payload = {
            user_prompt: request.prompt,
            attachments: request.attachments,
            code_prompt: request.codePrompt,
            conversation_history: request.conversationHistory,
        };
        const startTime = Date.now();
        const response = await authenticatedAxiosInstance.post<ChatApiResponse>(apiUrl, payload, {
            timeout: AI_COURSE_API_CONFIG.timeout,
            headers: AI_COURSE_API_CONFIG.defaultHeaders,
        });
        const endTime = Date.now();

        // Handle different response formats
        let processedResponse: ChatApiResponse;

        if (response.data?.content) {
            // Expected format
            processedResponse = response.data;
        } else if (response.data?.message) {
            // Alternative format with 'message' field
            processedResponse = {
                content: response.data.message,
                model_used:
                    response.data.model_used || response.data.model || 'google/gemini-2.5-pro',
                timestamp: response.data.timestamp || new Date().toISOString(),
                status: 'success',
            };
        } else if (response.data?.result) {
            // Alternative format with 'result' field
            processedResponse = {
                content: response.data.result,
                model_used:
                    response.data.model_used || response.data.model || 'google/gemini-2.5-pro',
                timestamp: response.data.timestamp || new Date().toISOString(),
                status: 'success',
            };
        } else if (typeof response.data === 'string') {
            // Direct string response
            processedResponse = {
                content: response.data,
                model_used: 'google/gemini-2.5-pro',
                timestamp: new Date().toISOString(),
                status: 'success',
            };
        } else {
            // Fallback: try to extract any text content
            const fallbackContent = JSON.stringify(response.data, null, 2);
            processedResponse = {
                content: fallbackContent,
                model_used: 'google/gemini-2.5-pro',
                timestamp: new Date().toISOString(),
                status: 'success',
            };
        }
        return processedResponse;
    } catch (error: any) {
        console.error('❌ [API-DEBUG] Exception caught in sendChatMessage:', error);
        console.error('🔍 [API-DEBUG] Error analysis:', {
            hasResponse: !!error.response,
            hasRequest: !!error.request,
            errorCode: error.code,
            errorMessage: error.message,
            errorName: error.name,
            isAxiosError: error.isAxiosError,
            status: error.response?.status,
            statusText: error.response?.statusText,
        });

        console.error('🌐 [API-DEBUG] Request configuration:', {
            url: error.config?.url,
            method: error.config?.method,
            timeout: error.config?.timeout,
            headers: error.config?.headers,
        });

        if (error.response) {
            console.error('📡 [API-DEBUG] Response details:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers,
            });
        }

        // Handle different error scenarios
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
            console.error('⏰ [API-DEBUG] Timeout error detected');
            throw new Error(
                'AI generation is taking longer than expected. This is normal for complex requests. Please try again or try a simpler prompt.'
            );
        } else if (error.response?.status === 511) {
            console.error('🔐 [API-DEBUG] 511 Network Authentication Required');
            // Check if it's actually a backend error disguised as 511
            if (error.response?.data?.ex || error.response?.data?.responseCode) {
                const backendError = error.response.data.ex || error.response.data.responseCode;
                console.error('🐛 [API-DEBUG] Backend error disguised as 511:', backendError);
                throw new Error(
                    `Backend Error: ${backendError}. Please contact your development team.`
                );
            }
            throw new Error(
                'Network authentication required. Please check your connection or contact support.'
            );
        } else if (error.response?.status === 429) {
            console.error('🚦 [API-DEBUG] Rate limit exceeded (429)');
            throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.response?.status === 401 || error.response?.status === 403) {
            console.error(
                '🔒 [API-DEBUG] Authentication/Authorization error:',
                error.response?.status
            );
            throw new Error('Authentication failed. Please log in again.');
        } else if (error.response?.status >= 500) {
            console.error('🔥 [API-DEBUG] Server error (5xx):', error.response?.status);
            throw new Error('Server error. Please try again later.');
        } else if (error.response?.status === 404) {
            console.error('🔍 [API-DEBUG] API endpoint not found (404)');
            throw new Error('API endpoint not found. Please contact support.');
        } else if (error.response?.data?.message) {
            console.error('📝 [API-DEBUG] Backend error message:', error.response.data.message);
            throw new Error(error.response.data.message);
        } else if (error.message) {
            console.error('📄 [API-DEBUG] Generic error message:', error.message);
            throw new Error(error.message);
        } else {
            console.error('❓ [API-DEBUG] Unknown error - no specific message available');
            throw new Error('Failed to get AI response. Please try again.');
        }
    }
};

// Alternative: For direct API calls with custom parameters
export const sendChatMessageCustom = async (
    payload: any,
    model: string,
    headers?: Record<string, string>
): Promise<any> => {
    try {
        // Get institute ID
        const instituteId = getCurrentInstituteId();

        if (!instituteId) {
            throw new Error('Institute ID not found. Please log in again.');
        }

        // Build API URL with query parameters
        const apiUrl = buildApiUrl('generate', {
            instituteId: instituteId,
            model: model, // Don't double encode - URLSearchParams will handle it
        });

        const response = await authenticatedAxiosInstance.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            timeout: AI_COURSE_API_CONFIG.timeout,
        });

        return response.data;
    } catch (error: any) {
        console.error('Custom AI API Error:', error);
        throw error;
    }
};

// Streaming version of sendChatMessage for real-time response
export const sendChatMessageStreaming = async (
    request: ChatApiRequest,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: ChatApiResponse) => void,
    onError: (error: Error) => void
): Promise<void> => {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);

        if (!accessToken) {
            onError(new Error('No access token found. Please log in again.'));
            return;
        }

        const instituteId = getCurrentInstituteId();

        if (!instituteId) {
            onError(new Error('Institute ID not found. Please log in again.'));
            return;
        }

        const apiUrl = buildApiUrl('generate', {
            instituteId: instituteId,
            model: request.model,
        });

        const payload = {
            user_prompt: request.prompt,
            attachments: request.attachments,
            code_prompt: request.codePrompt,
            conversation_history: request.conversationHistory,
        };
        const startTime = Date.now();

        // Use fetch for streaming support instead of axios
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            onError(new Error(`HTTP ${response.status}: ${response.statusText}`));
            return;
        }

        if (!response.body) {
            onError(new Error('No response body available for streaming'));
            return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // Decode the chunk
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process complete lines/chunks
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            // Try to parse as JSON first (for structured responses)
                            if (line.startsWith('{') || line.startsWith('[')) {
                                const jsonData = JSON.parse(line);
                                if (jsonData.content) {
                                    fullContent += jsonData.content;
                                    onChunk(jsonData.content);
                                } else if (jsonData.message) {
                                    fullContent += jsonData.message;
                                    onChunk(jsonData.message);
                                } else if (typeof jsonData === 'string') {
                                    fullContent += jsonData;
                                    onChunk(jsonData);
                                }
                            } else {
                                // Plain text chunk
                                fullContent += line;
                                onChunk(line);
                            }
                        } catch (parseError) {
                            // If not JSON, treat as plain text
                            fullContent += line;
                            onChunk(line);
                        }
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                try {
                    if (buffer.startsWith('{') || buffer.startsWith('[')) {
                        const jsonData = JSON.parse(buffer);
                        if (jsonData.content) {
                            fullContent += jsonData.content;
                            onChunk(jsonData.content);
                        } else if (jsonData.message) {
                            fullContent += jsonData.message;
                            onChunk(jsonData.message);
                        }
                    } else {
                        fullContent += buffer;
                        onChunk(buffer);
                    }
                } catch (parseError) {
                    fullContent += buffer;
                    onChunk(buffer);
                }
            }

            const endTime = Date.now();

            // Call completion callback
            const finalResponse: ChatApiResponse = {
                content: fullContent,
                model_used: request.model,
                timestamp: new Date().toISOString(),
                status: 'success',
            };

            onComplete(finalResponse);
        } catch (streamError) {
            onError(streamError as Error);
        } finally {
            reader.releaseLock();
        }
    } catch (error: any) {
        onError(error);
    }
};

export const scrapeUrlContent = async (
    url: string
): Promise<{ content: string; title: string }> => {
    try {
        const response = await authenticatedAxiosInstance.post(SCRAPE_URL, { url });
        return response.data;
    } catch (error) {
        console.error('Error scraping URL:', error);
        throw error;
    }
};
