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
      className="overflow-hidden rounded-[20px]"
      style={{
        backgroundColor: hasStreak ? "#FF6B35" : "#FF8C42",
        boxShadow: `0 5px 0 ${hasStreak ? "#CC4A1A" : "#CC6A2A"}`,
      }}
    >
      {/* Responsive: side-by-side on mobile, stacked on md+ */}
      <div className="flex flex-row md:flex-col">
        {/* SVG: right on mobile, top on desktop */}
        <div className="order-2 md:order-1 w-28 md:w-full flex items-center justify-center bg-white/10 p-2 md:px-6 md:pt-5 md:pb-2 flex-shrink-0">
          <playIllustrations.Celebration className="h-24 md:h-32 w-auto text-white" />
        </div>

        {/* Content: left on mobile, bottom on desktop */}
        <div className="order-1 md:order-2 flex-1 p-4 md:pt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
              <Fire weight="fill" size={26} className={`text-white ${hasStreak ? "play-wiggle" : ""}`} />
            </div>
            <div>
              <p className="text-3xl font-black text-white leading-none">{streak}</p>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wide">Day Streak</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black ${
                  dots[i] ? "bg-white text-orange-600" : "bg-white/15 text-white/60"
                }`}
              >
                {dots[i] ? "✓" : label}
              </div>
            ))}
          </div>

          <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
            Best: {best} days
          </p>
        </div>
      </div>
    </div>
  );
};
