import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioPlayerReturn {
  playAudio: (audioData: ArrayBuffer | Blob | string) => Promise<void>;
  playChunks: (chunks: ArrayBuffer[]) => Promise<void>;
  queueChunk: (chunk: ArrayBuffer) => void;
  stop: () => void;
  isPlaying: boolean;
  audioLevel: number;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const isProcessingQueueRef = useRef(false);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const getAnalyser = useCallback((): AnalyserNode => {
    const ctx = getAudioContext();
    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }
    return analyserRef.current;
  }, [getAudioContext]);

  const monitorLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !isPlayingRef.current) {
      setAudioLevel(0);
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

    animFrameRef.current = requestAnimationFrame(monitorLevel);
  }, []);

  const startLevelMonitoring = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    monitorLevel();
  }, [monitorLevel]);

  const stopLevelMonitoring = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const disconnectSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
  }, []);

  const toArrayBuffer = useCallback(
    async (audioData: ArrayBuffer | Blob | string): Promise<ArrayBuffer> => {
      if (audioData instanceof ArrayBuffer) {
        return audioData;
      }
      if (audioData instanceof Blob) {
        return audioData.arrayBuffer();
      }
      // base64 string
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer as ArrayBuffer;
    },
    [],
  );

  const playBuffer = useCallback(
    (audioBuffer: AudioBuffer): Promise<void> => {
      return new Promise<void>((resolve) => {
        const ctx = getAudioContext();
        const analyser = getAnalyser();

        disconnectSource();

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        sourceNodeRef.current = source;

        isPlayingRef.current = true;
        setIsPlaying(true);
        startLevelMonitoring();

        source.onended = () => {
          sourceNodeRef.current = null;
          // Only set not playing if queue is empty
          if (queueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            stopLevelMonitoring();
          }
          resolve();
        };

        source.start();
      });
    },
    [getAudioContext, getAnalyser, disconnectSource, startLevelMonitoring, stopLevelMonitoring],
  );

  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    const ctx = getAudioContext();

    while (queueRef.current.length > 0) {
      const chunk = queueRef.current.shift()!;
      try {
        const audioBuffer = await ctx.decodeAudioData(chunk.slice(0));
        await playBuffer(audioBuffer);
      } catch (err) {
        console.error('Failed to decode audio chunk:', err);
      }
    }

    isProcessingQueueRef.current = false;
    if (!sourceNodeRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopLevelMonitoring();
    }
  }, [getAudioContext, playBuffer, stopLevelMonitoring]);

  const playAudio = useCallback(
    async (audioData: ArrayBuffer | Blob | string): Promise<void> => {
      try {
        const ctx = getAudioContext();
        // Resume context if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const arrayBuffer = await toArrayBuffer(audioData);
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        await playBuffer(audioBuffer);
      } catch (err) {
        console.error('Failed to play audio:', err);
        isPlayingRef.current = false;
        setIsPlaying(false);
        stopLevelMonitoring();
      }
    },
    [getAudioContext, toArrayBuffer, playBuffer, stopLevelMonitoring],
  );

  const playChunks = useCallback(
    async (chunks: ArrayBuffer[]): Promise<void> => {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      for (const chunk of chunks) {
        try {
          const audioBuffer = await ctx.decodeAudioData(chunk.slice(0));
          await playBuffer(audioBuffer);
        } catch (err) {
          console.error('Failed to decode/play chunk:', err);
        }
      }
    },
    [getAudioContext, playBuffer],
  );

  const queueChunk = useCallback(
    (chunk: ArrayBuffer) => {
      queueRef.current.push(chunk);
      if (!isProcessingQueueRef.current) {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => processQueue());
        } else {
          processQueue();
        }
      }
    },
    [getAudioContext, processQueue],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    isProcessingQueueRef.current = false;
    disconnectSource();
    isPlayingRef.current = false;
    setIsPlaying(false);
    stopLevelMonitoring();
  }, [disconnectSource, stopLevelMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queueRef.current = [];
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
        } catch {
          // Already stopped
        }
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    playAudio,
    playChunks,
    queueChunk,
    stop,
    isPlaying,
    audioLevel,
  };
}
