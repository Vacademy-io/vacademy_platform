import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { AI_SERVICE_URL } from "@/constants/urls";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  sessionId: string;
}

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const MicButton: React.FC<MicButtonProps> = ({
  onTranscript,
  disabled,
  sessionId,
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useVoiceRecorder();

  // Recording timer
  useEffect(() => {
    if (recorder.isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recorder.isRecording]);

  // When audioBlob is available after stopping, send to API
  useEffect(() => {
    if (recorder.audioBlob && !recorder.isRecording) {
      sendAudioForTranscription(recorder.audioBlob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, recorder.isRecording]);

  const sendAudioForTranscription = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        formData.append("language", "auto");

        const response = await authenticatedAxiosInstance.post(
          `${AI_SERVICE_URL}/chat-agent/session/${sessionId}/audio-message`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );

        const transcript = response.data?.transcript ?? response.data?.text ?? "";
        if (transcript) {
          onTranscript(transcript);
        }
      } catch (err) {
        console.error("Transcription failed:", err);
      } finally {
        setIsTranscribing(false);
        setRecordingSeconds(0);
      }
    },
    [sessionId, onTranscript],
  );

  const handleClick = useCallback(async () => {
    if (disabled || isTranscribing) return;

    if (recorder.isRecording) {
      recorder.stopRecording();
    } else {
      await recorder.startRecording();
    }
  }, [disabled, isTranscribing, recorder]);

  if (isTranscribing) {
    return (
      <button
        type="button"
        disabled
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground"
        title="Transcribing..."
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (recorder.isRecording) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 h-7 px-2 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
        onClick={handleClick}
        title="Stop recording"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs font-mono tabular-nums">
          {formatRecordingTime(recordingSeconds)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
        disabled
          ? "text-muted-foreground/50 cursor-not-allowed"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
      onClick={handleClick}
      disabled={disabled}
      title="Voice to text"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
};
