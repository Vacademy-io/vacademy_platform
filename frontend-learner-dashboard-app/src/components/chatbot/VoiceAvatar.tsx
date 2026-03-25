import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface VoiceAvatarProps {
  avatarUrl?: string;
  assistantName: string;
  state: "idle" | "listening" | "speaking" | "processing";
  audioLevel: number; // 0-1
}

const STATE_LABELS: Record<VoiceAvatarProps["state"], string> = {
  idle: "Ready",
  listening: "Listening...",
  processing: "Thinking...",
  speaking: "Speaking...",
};

const RING_SIZES = [120, 150, 180];

function getRingStyle(
  state: VoiceAvatarProps["state"],
  audioLevel: number,
  ringIndex: number,
) {
  const base = RING_SIZES[ringIndex]!;

  switch (state) {
    case "idle":
      return {
        className: "border-white/30",
        animate: {
          scale: [1.0, 1.05, 1.0],
          opacity: [0.15, 0.3, 0.15],
        },
        transition: {
          duration: 3,
          ease: "easeInOut" as const,
          repeat: Infinity,
          delay: ringIndex * 0.3,
        },
      };
    case "listening":
      return {
        className: "border-green-400",
        animate: {
          scale: 1 + audioLevel * 0.3 + ringIndex * 0.03,
          opacity: 0.2 + audioLevel * 0.5,
        },
        transition: { duration: 0.1, ease: "linear" as const },
      };
    case "speaking":
      return {
        className: "border-blue-400",
        animate: {
          scale: 1 + audioLevel * 0.25 + ringIndex * 0.03,
          opacity: 0.2 + audioLevel * 0.4,
        },
        transition: { duration: 0.1, ease: "linear" as const },
      };
    case "processing":
      return {
        className: "border-amber-400",
        animate: {
          rotate: [0, 360],
          opacity: [0.3, 0.5, 0.3],
        },
        transition: {
          rotate: {
            duration: 2,
            ease: "linear" as const,
            repeat: Infinity,
          },
          opacity: {
            duration: 1.5,
            ease: "easeInOut" as const,
            repeat: Infinity,
          },
          delay: ringIndex * 0.15,
        },
      };
  }
}

export const VoiceAvatar: React.FC<VoiceAvatarProps> = ({
  avatarUrl,
  assistantName,
  state,
  audioLevel,
}) => {
  // Deterministic sine-wave offsets for smooth waveform bars
  const barOffsets = useMemo(
    () => Array.from({ length: 7 }, (_, i) => 0.6 + 0.4 * Math.sin(i * 1.2)),
    [],
  );

  const initials = assistantName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Avatar with rings */}
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        {/* Concentric rings */}
        {RING_SIZES.map((size, i) => {
          const ringConfig = getRingStyle(state, audioLevel, i);
          return (
            <motion.div
              key={i}
              className={`absolute rounded-full border-2 ${ringConfig.className}`}
              style={{
                width: size,
                height: size,
                top: "50%",
                left: "50%",
                marginTop: -size / 2,
                marginLeft: -size / 2,
              }}
              animate={ringConfig.animate}
              transition={ringConfig.transition}
            />
          );
        })}

        {/* Center avatar */}
        <Avatar className="h-20 w-20 sm:h-24 sm:w-24 z-10">
          <AvatarImage src={avatarUrl} alt={assistantName} />
          <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Audio waveform bars */}
      <div className="flex items-end gap-1 h-8">
        {barOffsets.map((offset, i) => {
          const barScale = state === "idle"
            ? 0.15 + 0.05 * Math.sin(i * 0.9)
            : audioLevel * (0.6 + 0.4 * Math.sin(i * 1.2));
          const height = Math.max(4, barScale * 32);
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-100 ${
                state === "listening"
                  ? "bg-green-400"
                  : state === "speaking"
                    ? "bg-blue-400"
                    : state === "processing"
                      ? "bg-amber-400"
                      : "bg-white/30"
              }`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {/* State label */}
      <p className="text-sm text-white/70 font-medium">{STATE_LABELS[state]}</p>
    </div>
  );
};
