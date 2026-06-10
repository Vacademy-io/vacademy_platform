import React from "react";
import { Fire } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import { playIllustrations } from "@/assets/play-illustrations";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export const StreakCounterWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const streak = data?.currentStreak ?? 0;
  const best = data?.longestStreak ?? 0;
  const dots = data?.weeklyDots ?? Array(7).fill(false);
  const hasStreak = streak > 0;

  return (
    <div
      className={`overflow-hidden rounded-play-card ${
        hasStreak ? "bg-play-warn shadow-play-4d-warn" : "bg-play-surface shadow-play-4d-muted"
      }`}
    >
      {/* Responsive: side-by-side on mobile, stacked on md+ */}
      <div className="flex flex-row md:flex-col">
        {/* SVG: right on mobile, top on desktop */}
        <div
          className={`order-2 md:order-1 w-28 md:w-full flex items-center justify-center p-2 md:px-6 md:pt-5 md:pb-2 flex-shrink-0 ${
            hasStreak ? "bg-white/10" : "bg-white/60"
          }`}
        >
          <playIllustrations.Celebration
            className={`h-24 md:h-32 w-auto ${hasStreak ? "text-white" : "text-play-muted"}`}
          />
        </div>

        {/* Content: left on mobile, bottom on desktop */}
        <div className="order-1 md:order-2 flex-1 p-4 md:pt-3">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                hasStreak ? "bg-white" : "bg-play-warn shadow-play-2d-warn"
              }`}
            >
              <Fire
                weight="fill"
                size={26}
                className={hasStreak ? "play-wiggle text-play-warn" : "text-white"}
              />
            </div>
            {hasStreak ? (
              <div className="rounded-2xl bg-white px-3 py-1.5">
                <p className="text-3xl font-black text-play-ink leading-none">{streak}</p>
                <p className="text-xs font-bold text-play-ink uppercase tracking-wide">Day streak</p>
              </div>
            ) : (
              <p className="text-base font-black text-play-ink leading-tight">
                Attend or learn today to start a streak
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded-full flex items-center justify-center text-caption font-black ${
                  dots[i]
                    ? hasStreak
                      ? "bg-white text-play-warn-deep"
                      : "bg-play-warn text-white"
                    : hasStreak
                      ? "bg-white/25 text-play-ink"
                      : "bg-white text-play-muted-deep"
                }`}
              >
                {dots[i] ? "✓" : label}
              </div>
            ))}
          </div>

          {best > 0 && (
            <p className="text-caption font-bold text-play-ink uppercase tracking-wide">
              Best: {best} days
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
