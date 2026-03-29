import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Lightning } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import accomplishmentsIllustration from "@/assets/play-illustrations/accomplishments.svg";
import steppingUpIllustration from "@/assets/play-illustrations/stepping-up.svg";

export const XpDisplayWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const totalXp = data?.totalXp ?? 0;
  const level = data?.level ?? 1;
  const xpToNext = data?.xpToNextLevel ?? 500;
  const todayXp = data?.todayXp ?? 0;

  // Progress within current level (0–100)
  const xpPerLevel = 500;
  const xpInLevel = xpPerLevel - xpToNext;
  const progress = Math.round((xpInLevel / xpPerLevel) * 100);

  return (
    <Card className="overflow-hidden border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
            <Star weight="fill" size={24} className="text-yellow-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-extrabold text-yellow-600 leading-none">
                {totalXp.toLocaleString()}
              </p>
              <span className="text-xs font-medium text-yellow-500">XP</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Level {level}
            </p>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Level {level}</span>
            <span>Level {level + 1}</span>
          </div>
          <div className="h-2.5 rounded-full bg-yellow-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {xpToNext} XP to next level
          </p>
        </div>

        {/* Today's XP + illustration */}
        <div className="flex items-center justify-between">
          {todayXp > 0 ? (
            <div className="flex items-center gap-1 text-xs">
              <Lightning weight="fill" size={14} className="text-yellow-500" />
              <span className="font-semibold text-yellow-600 play-xp-pop">
                +{todayXp} XP today
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Earn XP by learning!</span>
          )}
          <img
            src={level > 1 ? accomplishmentsIllustration : steppingUpIllustration}
            alt=""
            className="h-10 w-auto opacity-60"
          />
        </div>
      </CardContent>
    </Card>
  );
};
