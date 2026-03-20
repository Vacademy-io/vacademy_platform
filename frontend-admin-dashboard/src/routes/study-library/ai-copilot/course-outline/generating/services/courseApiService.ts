import { BASE_URL, AI_SERVICE_BASE_URL } from '@/constants/urls';
import { SlideGeneration, SlideType } from '../../../shared/types';

export interface CourseOutlineRequest {
    user_prompt: string;
    course_tree: any;
    course_depth: number;
    generation_options: {
        generate_images: boolean;
        image_style: string;
        num_chapters?: number;
        num_slides?: number;
        course_timing?: number;
    };
}

export interface CourseOutlineResponse {
    tree: any[];
    todos: any[];
    courseMetadata?: any;
    explanation?: string;
}

/**
 * Generate course outline using AI service
 */
export async function generateCourseOutline(
    payload: CourseOutlineRequest,
    instituteId: string,
    onProgress: (message: string) => void
): Promise<CourseOutlineResponse> {
    const apiUrl = `${AI_SERVICE_BASE_URL}/course/ai/v1/generate?institute_id=${instituteId}`;

    console.log('=== API Request ===');
    console.log('URL:', apiUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    onProgress('Connecting to AI service...');

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    console.log('Response Status:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('=== API Error ===');
        console.error('Status:', response.status);
        console.error('Status Text:', response.statusText);
        console.error('Error Body:', errorText);

        if (response.status === 402) {
            throw new Error('Your OpenRouter credits have been exhausted. Please recharge your credits to continue using AI features.');
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
        throw new Error('No response body');
    }

    onProgress('Generating course outline...');

    // Read SSE stream
    let buffer = '';
    let finalResponse: CourseOutlineResponse | null = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);

                // Check for error events (e.g. credits exhausted)
                if (data.startsWith('{') && data.includes('"type"') && data.includes('"ERROR"')) {
                    try {
                        const errorData = JSON.parse(data);
                        if (errorData.type === 'ERROR' && errorData.code === 402) {
                            throw new Error('Your OpenRouter credits have been exhausted. Please recharge your credits to continue using AI features.');
                        }
                    } catch (e) {
                        if (e instanceof Error && e.message.includes('OpenRouter credits')) throw e;
                        // Not a valid error JSON, continue processing
                    }
                }

                // Check if it's a progress message
                if (data.startsWith('[Generating...]')) {
                    const progressMsg = data.replace('[Generating...]', '').trim();
                    onProgress(progressMsg);
                }
                // Check if it's the final JSON
                else if (data.startsWith('{')) {
                    try {
                        const jsonData = JSON.parse(data);
                        console.log('=== API Response Received ===');
                        console.log('Full Response:', jsonData);
                        console.log('Course Metadata:', jsonData.courseMetadata);
                        console.log('Tree:', jsonData.tree);

                        // Validate response structure
                        if (!jsonData.tree || !Array.isArray(jsonData.tree)) {
                            console.error('Invalid API response structure:', jsonData);
                            throw new Error('Invalid response structure: missing or invalid tree');
                        }

                        finalResponse = jsonData as CourseOutlineResponse;
                    } catch (e) {
                        console.error('=== Error Processing Response ===');
                        console.error('Error:', e);
                        console.error('Raw data:', data);
                        throw new Error(`Failed to process course data: ${e instanceof Error ? e.message : 'Unknown error'}`);
                    }
                }
            }
        }
    }

    if (!finalResponse) {
        throw new Error('No response data received from API');
    }

    return finalResponse;
}
