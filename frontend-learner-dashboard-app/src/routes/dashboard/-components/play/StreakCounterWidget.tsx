import React from "react";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import iconStreak from "@/assets/cleaner-play/icon-streak.webp";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export const StreakCounterWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const streak = data?.currentStreak ?? 0;
  const best = data?.longestStreak ?? 0;
  const dots = data?.weeklyDots ?? Array(7).fill(false);
  const hasStreak = streak > 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-play-card p-4 shadow-play-soft-card",
        hasStreak ? "bg-play-warn-soft" : "bg-play-surface"
      )}
    >
      <div className="flex items-center gap-3">
        <img src={iconStreak} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
        {hasStreak ? (
          <div>
            <p className="text-h2 font-black leading-none text-play-warn-soft-ink">{streak}</p>
            <p className="text-caption font-bold uppercase tracking-wide text-play-ink/60">Day streak</p>
          </div>
        ) : (
          <p className="text-body font-black leading-tight text-play-ink">
            Attend or learn today to start a streak
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-caption font-black",
              dots[i] ? "bg-play-warn text-white" : "bg-white/70 text-play-ink/50"
            )}
          >
            {dots[i] ? "✓" : label}
          </div>
        ))}
      </div>

      {best > 0 && (
        <p className="mt-auto text-caption font-bold uppercase tracking-wide text-play-ink/60">
          Best: {best} days
        </p>
      )}
    </div>
  );
};
