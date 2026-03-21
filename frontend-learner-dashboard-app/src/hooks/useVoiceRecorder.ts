import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecorderOptions {
  onAudioChunk?: (base64Data: string) => void;
  silenceTimeout?: number;
  sampleRate?: number;
}

interface UseVoiceRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isRecording: boolean;
  audioBlob: Blob | null;
  audioLevel: number;
  error: string | null;
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  const {
    onAudioChunk,
    silenceTimeout = 3000,
    sampleRate = 16000,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceStartRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const monitorAudioLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !isRecordingRef.current) {
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length / 255;
    setAudioLevel(average);

    // Silence detection
    if (average < 0.05) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = Date.now();
      } else if (Date.now() - silenceStartRef.current >= silenceTimeout) {
        // Auto-stop after silence threshold
        stopRecording();
        return;
      }
    } else {
      silenceStartRef.current = null;
    }

    animFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  }, [silenceTimeout]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    silenceStartRef.current = null;

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Re-bind monitorAudioLevel's reference to stopRecording
  // by using refs instead of closures for the recursive call
  const monitorRef = useRef(monitorAudioLevel);
  monitorRef.current = monitorAudioLevel;

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    chunksRef.current = [];
    silenceStartRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate,
        },
      });
      streamRef.current = stream;

      // Handle mic permission revocation or device unplugged
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          stopRecording();
          setError('Microphone access was lost');
        });
      });

      // Set up AudioContext + AnalyserNode for level monitoring
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser pick default
        }
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      const isStreamingMode = !!onAudioChunk;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          if (isStreamingMode) {
            // Convert chunk to base64 and send via callback
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              // Strip the data URL prefix to get raw base64
              const base64 = result.split(',')[1];
              if (base64) {
                onAudioChunk(base64);
              }
            };
            reader.readAsDataURL(event.data);
          }
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const finalMime = mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: finalMime });
          setAudioBlob(blob);
        }
      };

      mediaRecorder.onerror = () => {
        setError('MediaRecorder error occurred');
        stopRecording();
      };

      isRecordingRef.current = true;
      setIsRecording(true);

      // Start recording: use timeslice in streaming mode
      if (isStreamingMode) {
        mediaRecorder.start(250); // 250ms chunks
      } else {
        mediaRecorder.start();
      }

      // Start audio level monitoring
      monitorRef.current();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No microphone found'
            : `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`;
      setError(message);
      cleanup();
    }
  }, [sampleRate, onAudioChunk, stopRecording, cleanup]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    audioBlob,
    audioLevel,
    error,
  };
}
