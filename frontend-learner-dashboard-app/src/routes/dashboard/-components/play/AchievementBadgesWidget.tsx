import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Fire,
  Lightning,
  Star,
  Trophy,
  Medal,
  Lock,
} from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import type { PlayBadge } from "@/services/play-gamification";
import winnersIllustration from "@/assets/play-illustrations/winners.svg";
import treasureIllustration from "@/assets/play-illustrations/treasure.svg";

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen,
  Fire,
  Lightning,
  Star,
  Trophy,
  Medal,
};

const BadgeItem: React.FC<{ badge: PlayBadge }> = ({ badge }) => {
  const Icon = ICON_MAP[badge.icon] ?? Trophy;
  const unlocked = badge.unlocked;

  return (
    <div
      className="group relative flex flex-col items-center gap-1"
      title={`${badge.name}: ${badge.description}`}
    >
      <div
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all ${
          unlocked
            ? "bg-purple-100 border-purple-300 shadow-md"
            : "bg-gray-100 border-gray-200 grayscale opacity-50"
        }`}
      >
        <Icon
          weight={unlocked ? "fill" : "regular"}
          size={22}
          className={unlocked ? "text-purple-600" : "text-gray-400"}
        />
        {!unlocked && (
          <Lock
            weight="fill"
            size={10}
            className="absolute -bottom-0.5 -right-0.5 text-gray-400 bg-white rounded-full"
          />
        )}
        {/* "New!" pulse for recently unlocked */}
        {unlocked && badge.unlockedAt && isRecent(badge.unlockedAt) && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-purple-500 text-[6px] text-white font-bold items-center justify-center">
              !
            </span>
          </span>
        )}
      </div>
      <span
        className={`text-[9px] font-medium text-center leading-tight max-w-[56px] ${
          unlocked ? "text-purple-700" : "text-gray-400"
        }`}
      >
        {badge.name}
      </span>
    </div>
  );
};

/** Badge was unlocked within the last 24 hours */
function isRecent(dateStr: string): boolean {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    return diff < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export const AchievementBadgesWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const badges = data?.badges ?? [];
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <Card className="overflow-hidden border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
              <Trophy weight="fill" size={18} className="text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-purple-700">Badges</p>
              <p className="text-[10px] text-muted-foreground">
                {unlockedCount}/{badges.length} unlocked
              </p>
            </div>
          </div>
        </div>

        {/* Badge grid */}
        <div className="flex flex-wrap justify-center gap-3">
          {badges.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} />
          ))}
        </div>

        {/* Motivational illustration */}
        <div className="flex justify-center mt-2">
          <img
            src={unlockedCount > 0 ? winnersIllustration : treasureIllustration}
            alt=""
            className="h-12 w-auto opacity-50"
          />
        </div>
      </CardContent>
    </Card>
  );
};
