import { useCallback, useEffect, useRef, useState } from 'react';

export interface CallRecorderResult {
    file: File;
    durationSeconds: number;
}

/**
 * Minimal in-browser audio recorder built on MediaRecorder. No transcription,
 * no third-party services — just capture mic audio and hand back a File.
 *
 * Usage:
 *   const rec = useCallRecorder();
 *   await rec.start();
 *   const result = await rec.stop(); // { file, durationSeconds } | null
 */
export function useCallRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsedRef = useRef(0);
    const resolveRef = useRef<((result: CallRecorderResult | null) => void) | null>(null);

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    const start = useCallback(async (): Promise<boolean> => {
        setError(null);
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setError('Recording is not supported in this browser.');
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const type = recorder.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type });
                const ext = type.includes('webm')
                    ? 'webm'
                    : type.includes('ogg')
                      ? 'ogg'
                      : type.includes('mp4') || type.includes('mpeg')
                        ? 'm4a'
                        : 'audio';
                const file = new File([blob], `call_recording_${Date.now()}.${ext}`, { type });
                const durationSeconds = elapsedRef.current;
                cleanup();
                setIsRecording(false);
                const resolve = resolveRef.current;
                resolveRef.current = null;
                resolve?.({ file, durationSeconds });
            };

            recorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
            elapsedRef.current = 0;
            setElapsedSeconds(0);
            timerRef.current = setInterval(() => {
                elapsedRef.current += 1;
                setElapsedSeconds(elapsedRef.current);
            }, 1000);
            return true;
        } catch {
            setError('Microphone access was denied or is unavailable.');
            cleanup();
            setIsRecording(false);
            return false;
        }
    }, [cleanup]);

    const stop = useCallback((): Promise<CallRecorderResult | null> => {
        return new Promise((resolve) => {
            const recorder = recorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                resolve(null);
                return;
            }
            resolveRef.current = resolve;
            recorder.stop();
        });
    }, []);

    const cancel = useCallback(() => {
        resolveRef.current = null;
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = null;
            try {
                recorder.stop();
            } catch {
                /* no-op */
            }
        }
        cleanup();
        setIsRecording(false);
        elapsedRef.current = 0;
        setElapsedSeconds(0);
    }, [cleanup]);

    // Stop tracks if the component unmounts mid-recording.
    useEffect(() => cleanup, [cleanup]);

    return { isRecording, elapsedSeconds, error, start, stop, cancel };
}
