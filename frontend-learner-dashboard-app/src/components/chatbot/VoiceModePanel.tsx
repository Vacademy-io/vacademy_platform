import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Mic, MicOff, PhoneOff, VolumeX, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceAvatar } from "./VoiceAvatar";
import { avatarUrl } from "@/services/chatbot-settings";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useVoiceWebSocket } from "@/hooks/useVoiceWebSocket";
import { SessionScorecard } from "./SessionScorecard";

interface VoiceModePanelProps {
  sessionId: string;
  mode: "voice_interview" | "voice_doubt" | "voice_oral_test";
  language: string;
  voice: string;
  onClose: () => void;
  chatbotSettings: { assistant_name: string };
}

type VoiceState = "idle" | "listening" | "speaking" | "processing";

interface TranscriptMessage {
  role: "user" | "ai";
  text: string;
}

const MODE_LABELS: Record<VoiceModePanelProps["mode"], { label: string; icon: string }> = {
  voice_interview: { label: "Mock Interview", icon: "briefcase" },
  voice_doubt: { label: "Doubt Discussion", icon: "message" },
  voice_oral_test: { label: "Oral Test", icon: "file-question" },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const VoiceModePanel: React.FC<VoiceModePanelProps> = ({
  sessionId,
  mode,
  language,
  voice,
  onClose,
  chatbotSettings,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [summaryData, setSummaryData] = useState<unknown | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Audio player
  const audioPlayer = useAudioPlayer();

  // WebSocket callbacks
  const onTranscriptFinal = useCallback((text: string) => {
    setTranscript((prev) => [...prev, { role: "user", text }]);
    setVoiceState("processing");
  }, []);

  const onAiText = useCallback((text: string) => {
    setTranscript((prev) => {
      // If last message is AI, append to it; else add new
      const last = prev[prev.length - 1];
      if (last && last.role === "ai") {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { role: "ai", text }];
    });
  }, []);

  const onAudioChunk = useCallback(
    (base64Data: string) => {
      setVoiceState("speaking");
      // Decode base64 to ArrayBuffer and queue for playback
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioPlayer.queueChunk(bytes.buffer as ArrayBuffer);
    },
    [audioPlayer],
  );

  const onAudioEnd = useCallback(() => {
    // After all audio chunks have been sent, go back to idle when playback finishes
    // We'll monitor audioPlayer.isPlaying in an effect
  }, []);

  const onSummary = useCallback((data: unknown) => {
    setSummaryData(data);
    setShowScorecard(true);
  }, []);

  const onError = useCallback((message: string) => {
    console.error("Voice WS error:", message);
  }, []);

  // Use a ref to call sendConfig from the onReady callback
  // (avoids circular dependency between ws and onReady)
  const wsRef = useRef<ReturnType<typeof useVoiceWebSocket> | null>(null);

  const onReady = useCallback(() => {
    // Send config once WS is ready
    wsRef.current?.sendConfig(language, voice);
  }, [language, voice]);

  // WebSocket
  const ws = useVoiceWebSocket({
    onTranscriptFinal,
    onAiText,
    onAudioChunk,
    onAudioEnd,
    onSummary,
    onError,
    onReady,
  });
  wsRef.current = ws;

  // Connect on mount, full cleanup on unmount
  useEffect(() => {
    ws.connect(sessionId);
    return () => {
      ws.disconnect();
      recorder.stopRecording();
      audioPlayer.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Monitor audio player to transition from speaking -> idle
  useEffect(() => {
    if (voiceState === "speaking" && !audioPlayer.isPlaying) {
      setVoiceState("idle");
    }
  }, [voiceState, audioPlayer.isPlaying]);

  // Voice recorder
  const recorder = useVoiceRecorder({
    silenceTimeout: 5000, // 5 seconds instead of default 3
    onAudioChunk: (base64Data) => {
      ws.sendAudioChunk(base64Data);
    },
  });

  // Determine current audio level based on state
  const currentAudioLevel =
    voiceState === "listening"
      ? recorder.audioLevel
      : voiceState === "speaking"
        ? audioPlayer.audioLevel
        : 0;

  // Toggle mic
  const toggleMic = useCallback(async () => {
    if (voiceState === "listening") {
      // Stop recording, send audio_end
      recorder.stopRecording();
      ws.sendAudioEnd();
      setVoiceState("processing");
    } else if (voiceState === "idle") {
      // Stop any playing audio first
      audioPlayer.stop();
      await recorder.startRecording();
      setVoiceState("listening");
    } else if (voiceState === "speaking") {
      // Interrupt AI speech
      audioPlayer.stop();
      await recorder.startRecording();
      setVoiceState("listening");
    }
  }, [voiceState, recorder, ws, audioPlayer]);

  // End session
  const handleEndSession = useCallback(() => {
    recorder.stopRecording();
    audioPlayer.stop();
    ws.sendEndSession();
    // Wait for summary or close
    setTimeout(() => {
      if (!summaryData) {
        onClose();
      }
    }, 5000);
  }, [recorder, audioPlayer, ws, summaryData, onClose]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
    // When muted, stop recorder if active
    if (!isMuted && voiceState === "listening") {
      recorder.stopRecording();
      ws.sendAudioEnd();
      setVoiceState("processing");
    }
  }, [isMuted, voiceState, recorder, ws]);

  const modeInfo = MODE_LABELS[mode];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10010] flex flex-col bg-gradient-to-b from-slate-900 to-slate-950"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-sm font-medium">{modeInfo.label}</span>
          </div>
          <span className="text-white/50 text-sm font-mono tabular-nums">
            {formatTime(elapsedSeconds)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
            onClick={() => {
              ws.disconnect();
              recorder.stopRecording();
              audioPlayer.stop();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Center area */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <VoiceAvatar
            avatarUrl={avatarUrl}
            assistantName={chatbotSettings.assistant_name}
            state={voiceState}
            audioLevel={currentAudioLevel}
          />
          <p className="text-white/50 text-xs mt-2">
            {voiceState === "idle" && "Tap the mic button below to start speaking"}
            {voiceState === "listening" && "I'm listening... tap mic when done"}
            {voiceState === "processing" && "Processing your response..."}
            {voiceState === "speaking" && "Tap mic to interrupt and speak"}
          </p>
        </div>

        {/* Transcript area */}
        <div className="max-h-[30%] px-6 overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-2 pb-2">
            {transcript.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-lg px-3 py-1.5 text-sm max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-primary/20 text-white"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Controls bar */}
        <div className="shrink-0 pb-8 pt-4 flex items-center justify-center gap-6">
          {/* Mute toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={toggleMute}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>

          {/* Large mic button */}
          <button
            className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${
              voiceState === "listening"
                ? "bg-red-500 text-white animate-pulse"
                : "bg-white text-slate-900 hover:bg-white/90"
            } ${voiceState === "processing" ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={toggleMic}
            disabled={voiceState === "processing"}
          >
            {voiceState === "listening" ? (
              <MicOff className="h-7 w-7" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </button>

          {/* End session button */}
          <Button
            variant="ghost"
            className="h-10 rounded-full bg-white/10 text-white hover:bg-red-500/30 hover:text-red-300 px-4 gap-2 text-sm"
            onClick={handleEndSession}
          >
            <PhoneOff className="h-4 w-4" />
            End
          </Button>
        </div>

        {/* Session scorecard overlay */}
        {showScorecard && summaryData && (
          <SessionScorecard
            summary={summaryData as any}
            mode={mode}
            onClose={onClose}
            onStartNew={() => {
              ws.disconnect();
              recorder.stopRecording();
              audioPlayer.stop();
              onClose();
              // Parent will handle re-opening voice mode selector with a new session
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
