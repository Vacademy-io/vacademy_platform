import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Fire } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import goalsIllustration from "@/assets/play-illustrations/goals.svg";
import continuousLearningIllustration from "@/assets/play-illustrations/continuous-learning.svg";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export const StreakCounterWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const streak = data?.currentStreak ?? 0;
  const best = data?.longestStreak ?? 0;
  const dots = data?.weeklyDots ?? Array(7).fill(false);

  return (
    <Card className="overflow-hidden border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <Fire
              weight="fill"
              size={24}
              className={`text-orange-500 ${streak > 0 ? "play-wiggle" : ""}`}
            />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-orange-600 leading-none">
              {streak}
            </p>
            <p className="text-xs text-muted-foreground">
              day streak
            </p>
          </div>
        </div>

        {/* Weekly dots */}
        <div className="flex items-center justify-between gap-1 mb-2">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all ${
                  dots[i]
                    ? "bg-orange-500 border-orange-400 text-white"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                {dots[i] ? "✓" : label}
              </div>
            </div>
          ))}
        </div>

        {/* Motivation illustration + best streak */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Best: <span className="font-semibold text-orange-500">{best} days</span>
          </p>
          <img
            src={streak > 0 ? continuousLearningIllustration : goalsIllustration}
            alt=""
            className="h-10 w-auto opacity-60"
          />
        </div>
      </CardContent>
    </Card>
  );
};
