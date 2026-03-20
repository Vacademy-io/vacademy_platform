import { ASSEMBLYAI_API_KEY } from '@/config/assemblyai';

export interface TranscriptionResponse {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    text?: string;
    error?: string;
    words?: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
    }>;
}

export interface RealtimeTranscript {
    message_type: 'SessionBegins' | 'PartialTranscript' | 'FinalTranscript' | 'SessionTerminated';
    text?: string;
    created?: string;
    audio_start?: number;
    audio_end?: number;
}

/**
 * Upload audio file to AssemblyAI for transcription
 */
export async function uploadAudioFile(file: File): Promise<string> {
    console.log('AssemblyAI API Key:', ASSEMBLYAI_API_KEY ? 'Present' : 'Missing');
    console.log('Uploading file:', file.name, 'Size:', file.size);

    const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
            authorization: ASSEMBLYAI_API_KEY,
        },
        body: file,
    });

    console.log('Upload response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error:', errorText);
        throw new Error(`Failed to upload audio file: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Upload URL:', data.upload_url);
    return data.upload_url;
}

/**
 * Create transcription job
 */
export async function createTranscription(audioUrl: string): Promise<string> {
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
            authorization: ASSEMBLYAI_API_KEY || '',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            audio_url: audioUrl,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to create transcription: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
}

/**
 * Poll transcription status
 */
export async function getTranscription(transcriptId: string): Promise<TranscriptionResponse> {
    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        method: 'GET',
        headers: {
            authorization: ASSEMBLYAI_API_KEY || '',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get transcription: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Poll until transcription is complete
 */
export async function waitForTranscription(
    transcriptId: string,
    onProgress?: (status: string) => void
): Promise<TranscriptionResponse> {
    let isComplete = false;

    while (!isComplete) {
        const transcript = await getTranscription(transcriptId);
        onProgress?.(transcript.status);

        if (transcript.status === 'completed' || transcript.status === 'error') {
            isComplete = true;
            return transcript;
        }

        // Wait 3 seconds before polling again
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // This will never be reached, but TypeScript needs it
    throw new Error('Transcription failed');
}

/**
 * Get temporary token for real-time transcription
 */
export async function getRealtimeToken(): Promise<string> {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: {
            authorization: ASSEMBLYAI_API_KEY || '',
        },
        body: JSON.stringify({
            expires_in: 3600, // 1 hour
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to get realtime token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
}

/**
 * Create WebSocket connection for real-time transcription
 */
export async function createRealtimeConnection(
    onTranscript: (transcript: RealtimeTranscript) => void,
    onError?: (error: Event) => void,
    onClose?: (event: CloseEvent) => void
): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        getRealtimeToken()
            .then((token) => {
                const ws = new WebSocket(
                    `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
                );

                ws.onopen = () => {
                    console.log('WebSocket connection opened');
                    resolve(ws);
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    onTranscript(data);
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    onError?.(error);
                    reject(error);
                };

                ws.onclose = (event) => {
                    console.log('WebSocket connection closed');
                    onClose?.(event);
                };
            })
            .catch((error) => {
                reject(error);
            });
    });
}
