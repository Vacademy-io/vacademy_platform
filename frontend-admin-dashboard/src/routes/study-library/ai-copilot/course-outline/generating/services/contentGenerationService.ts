import { AI_SERVICE_BASE_URL } from '@/constants/urls';

export interface ContentGenerationRequest {
    course_tree: {
        todos: Array<{
            name: string;
            title: string;
            type: "DOCUMENT" | "ASSESSMENT" | "VIDEO" | "AI_VIDEO" | "AI_SLIDES" | "AI_STORYBOOK" | "VIDEO_CODE" | "AI_VIDEO_CODE";
            path: string;
            action_type: "ADD" | "UPDATE";
            prompt: string;
            keyword?: string;  // Required for VIDEO type
            order?: number;
            [key: string]: any;  // Allow other fields from outline response
        }>;
    };
    institute_id?: string;
    language?: string;
}

export interface ContentUpdate {
    type: "SLIDE_CONTENT_UPDATE" | "SLIDE_CONTENT_ERROR";
    path: string;
    status: boolean | string; // Can be boolean or "COMPLETED" | "GENERATING" for AI_VIDEO
    actionType: "ADD" | "UPDATE";
    slideType: "DOCUMENT" | "ASSESSMENT" | "VIDEO" | "AI_VIDEO" | "AI_SLIDES" | "AI_STORYBOOK" | "VIDEO_CODE" | "AI_VIDEO_CODE";
    title?: string;
    contentData: any;
    errorMessage?: string;
    metadata?: {
        isGenerating?: boolean;
        videoId?: string;
    };
}

/**
 * Generate content for course todos using AI service
 * Uses Server-Sent Events (SSE) for streaming responses
 */
export async function generateContent(
    todos: any[],
    instituteId: string,
    onUpdate: (update: ContentUpdate) => void,
    onError: (error: string) => void,
    onProgress?: (message: string) => void,
    retryCount = 0,
    language = 'English',
    // Stable across transport retries of the same run — the backend keys
    // idempotent per-slide credit charges on it, so a retry never re-bills
    // slides that were already generated.
    generationRunId: string = crypto.randomUUID(),
    // Course-level AI-video settings (model/voice/tier/duration) applied
    // server-side to AI_VIDEO / AI_SLIDES / AI_STORYBOOK todos.
    videoSettings?: Record<string, string>,
    // Media fileIds of uploaded reference PDFs — the backend embeds their real
    // figures into DOCUMENT slides.
    referenceDocumentFileIds?: string[]
): Promise<void> {
    const apiUrl = `${AI_SERVICE_BASE_URL}/course/content/v1/generate`;
    
    console.log('=== Content Generation API Request ===');
    console.log('URL:', apiUrl);
    console.log('Todos count:', todos.length);
    
    if (onProgress) {
        onProgress('Connecting to content generation service...');
    }

    try {
        console.log('🚀 Making API request to:', apiUrl);
        console.log('📦 Request payload size:', JSON.stringify({
            course_tree: { todos },
            institute_id: instituteId,
        }).length, 'bytes');

        // Create AbortController for this request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('⏰ Request timed out, aborting...');
            controller.abort();
        }, 30000); // 30 second timeout

        let response: Response;
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course_tree: { todos },
                    institute_id: instituteId,
                    language: language,
                    generation_run_id: generationRunId,
                    video_settings:
                        videoSettings && Object.keys(videoSettings).length > 0
                            ? videoSettings
                            : undefined,
                    reference_document_file_ids:
                        referenceDocumentFileIds && referenceDocumentFileIds.length > 0
                            ? referenceDocumentFileIds
                            : undefined,
                }),
                signal: controller.signal,
            });

            // Clear the timeout since we got a response
            clearTimeout(timeoutId);
        } catch (fetchError) {
            // Clear the timeout
            clearTimeout(timeoutId);

            // Handle aborted requests
            if (controller.signal.aborted) {
                throw new Error('Request was aborted due to timeout');
            }

            // Re-throw other fetch errors
            throw fetchError;
        }

        console.log('Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('=== Content Generation API Error ===');
            console.error('Status:', response.status);
            console.error('Status Text:', response.statusText);
            console.error('Error Body:', errorText);

            // Special handling for 402 errors (institute AI credits exhausted)
            if (response.status === 402) {
                let detail = '';
                try {
                    detail = JSON.parse(errorText)?.detail || '';
                } catch {
                    /* non-JSON body */
                }
                throw new Error(
                    detail ||
                        "Your institute's AI credits are insufficient for this generation. Please top up credits to continue."
                );
            }

            // Special handling for 500 errors
            if (response.status === 500) {
                console.error('🔴 500 Internal Server Error - Backend issue detected');
                console.error('This might be due to:');
                console.error('1. Large assessment data causing processing issues');
                console.error('2. Invalid JSON structure in assessment content');
                console.error('3. Backend processing timeout');
                console.error('4. Memory issues on the server');
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('No response body');
        }

        if (onProgress) {
            onProgress('Generating content...');
        }

        // Read SSE stream with better buffer management
        let buffer = '';
        const maxBufferSize = 1024 * 1024; // 1MB buffer limit
        const maxChunkSize = 10 * 1024 * 1024; // 10MB chunk limit
        let totalProcessed = 0;
        // Inactivity-based timeout, NOT total duration: a large course with AI
        // video/slides legitimately streams for far longer than 5 minutes —
        // slides complete progressively, so only a silent gap means trouble.
        // The timer must race the read itself (a loop-top check can never see
        // a stale clock — reader.read() would block it forever on a dead
        // connection that is never closed).
        const streamStartTime = Date.now();
        const maxInactivity = 5 * 60 * 1000; // 5 minutes without any bytes
        const readWithInactivityTimeout = async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(
                        new Error(
                            `Stream timed out after ${maxInactivity / 1000} seconds of inactivity`
                        )
                    );
                }, maxInactivity);
            });
            try {
                return await Promise.race([reader.read(), timeout]);
            } finally {
                clearTimeout(timer);
            }
        };

        console.log('🔄 Starting SSE stream processing...');

        try {
            while (true) {
                const { done, value } = await readWithInactivityTimeout();
                if (done) {
                    console.log('✅ SSE stream completed');
                    break;
                }

                // Check chunk size
                if (value && value.length > maxChunkSize) {
                    console.warn(`⚠️ Large chunk received: ${value.length} bytes`);
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Prevent buffer from growing too large
                if (buffer.length > maxBufferSize) {
                    console.warn(`⚠️ Buffer size exceeded ${maxBufferSize} bytes, truncating buffer`);
                    // Truncate buffer to prevent memory issues
                    buffer = buffer.substring(buffer.length - maxBufferSize / 2);
                }

                const lines = buffer.split('\n');

                // Keep the last incomplete line in the buffer (unless buffer is too large)
                if (buffer.length <= maxBufferSize) {
                    buffer = lines.pop() || '';
                } else {
                    // If buffer is too large, don't keep incomplete lines
                    buffer = '';
                }

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();

                        // Skip metadata lines (requestId)
                        if (data.startsWith('```json') || data === '' || data === 'null') {
                            continue;
                        }

                        let update: any;
                        try {
                            update = JSON.parse(data);
                        } catch (parseError) {
                            // Skip invalid JSON lines but log for debugging
                            console.warn('⚠️ Failed to parse content update:', {
                                data: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
                                error: parseError instanceof Error ? parseError.message : 'Unknown error'
                            });
                            continue;
                        }

                        // Check for error events from SSE stream - throw immediately to break out of the loop
                        if (update.type === 'ERROR') {
                            throw new Error(update.message || `Server error (code: ${update.code || 'unknown'})`);
                        }

                        totalProcessed++;

                        if (update.type === 'SLIDE_CONTENT_UPDATE' || update.type === 'SLIDE_CONTENT_ERROR') {
                            console.log(`📦 Content update #${totalProcessed} received:`, {
                                type: update.type,
                                path: update.path,
                                slideType: update.slideType,
                                contentDataSize: update.contentData ? JSON.stringify(update.contentData).length : 0
                            });

                            // Validate the update structure
                            if (update.type === 'SLIDE_CONTENT_UPDATE') {
                                // For AI_VIDEO, contentData might be undefined in intermediate events
                                if (!update.path || !update.slideType) {
                                    console.error('❌ Invalid SLIDE_CONTENT_UPDATE structure:', update);
                                    continue; // Skip this update but continue processing
                                }
                                // Allow contentData to be undefined for AI_VIDEO intermediate events
                                if (update.contentData === undefined && update.slideType !== 'AI_VIDEO') {
                                    console.warn('⚠️ SLIDE_CONTENT_UPDATE missing contentData (non-AI_VIDEO):', update);
                                    // Continue processing anyway for AI_VIDEO
                                }
                            }

                            try {
                                onUpdate(update as ContentUpdate);
                            } catch (callbackError) {
                                console.error('❌ Error in update callback:', callbackError);
                                // Continue processing other updates
                            }

                            if (onProgress && update.type === 'SLIDE_CONTENT_UPDATE') {
                                onProgress(`Generated ${update.slideType} for ${update.path}`);
                            }
                        }
                    }
                }

                // Periodic buffer cleanup and heartbeat
                if (totalProcessed % 10 === 0) {
                    const elapsed = Date.now() - streamStartTime;
                    console.log(`🔄 Processed ${totalProcessed} updates in ${elapsed}ms, buffer size: ${buffer.length} bytes`);

                    // Send progress update every 10 updates
                    if (onProgress) {
                        onProgress(`Processing content updates... (${totalProcessed} completed)`);
                    }
                }
            }
        } catch (streamError) {
            console.error('❌ Stream processing error:', streamError);

            // Provide specific error messages for common issues
            let errorMessage = 'Unknown stream error';
            if (streamError instanceof Error) {
                const message = streamError.message.toLowerCase();

                if (message.includes('aborted') || message.includes('abort')) {
                    errorMessage = 'Connection was aborted - this may be due to network issues or server timeout';
                } else if (message.includes('buffer')) {
                    errorMessage = 'Stream buffer overflow - content may be too large';
                } else if (message.includes('timeout')) {
                    errorMessage = 'Stream processing timed out - server may be overloaded';
                } else if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
                    errorMessage = 'Network error during content generation';
                } else if (message.includes('cancelled') || message.includes('cancel')) {
                    errorMessage = 'Request was cancelled';
                } else {
                    errorMessage = streamError.message;
                }
            }

            throw new Error(`Stream processing failed: ${errorMessage}`);
        } finally {
            // Cancel the stream so the connection is actually torn down — a
            // timed-out/failed run must not keep generating (and billing) into
            // a stream nobody reads, especially before a retry starts.
            try {
                await reader.cancel();
                console.log('🛑 Reader cancelled');
            } catch (e) {
                console.warn('⚠️ Failed to cancel reader:', e);
            }
            // Ensure reader is properly closed
            try {
                reader.releaseLock();
                console.log('🔒 Reader lock released');
            } catch (e) {
                console.warn('⚠️ Failed to release reader lock:', e);
            }

            // Clear any pending timeouts
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }

        if (onProgress) {
            onProgress('Content generation complete!');
        }
    } catch (error) {
        console.error('=== Error in Content Generation ===');
        console.error('Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        // Don't retry SSE errors from backend (they have a specific message to show the user)
        const isSSEError = errorMessage.startsWith('Stream processing failed:') &&
            !errorMessage.toLowerCase().includes('aborted') &&
            !errorMessage.toLowerCase().includes('network') &&
            !errorMessage.toLowerCase().includes('timeout') &&
            !errorMessage.toLowerCase().includes('buffer');

        // Retry logic for certain types of errors (but not SSE backend errors)
        const shouldRetry = !isSSEError && retryCount < 2 && (
            errorMessage.toLowerCase().includes('aborted') ||
            errorMessage.toLowerCase().includes('network') ||
            errorMessage.toLowerCase().includes('timeout')
        );

        if (shouldRetry) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
            console.log(`🔄 Retrying content generation in ${delay}ms (attempt ${retryCount + 1}/3)`);

            if (onProgress) {
                onProgress(`Connection interrupted, retrying in ${delay / 1000} seconds...`);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
            return generateContent(
                todos,
                instituteId,
                onUpdate,
                onError,
                onProgress,
                retryCount + 1,
                language,
                generationRunId,
                videoSettings,
                referenceDocumentFileIds
            );
        }

        // Strip "Stream processing failed: " prefix for cleaner error display
        const cleanMessage = errorMessage.replace(/^Stream processing failed:\s*/, '');
        onError(cleanMessage);
        throw error;
    }
}

