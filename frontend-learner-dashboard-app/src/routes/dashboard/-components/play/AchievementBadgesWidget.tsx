import React from "react";
import { BookOpen, Fire, Lightning, Star, Trophy, Medal, Lock } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import type { PlayBadge } from "@/services/play-gamification";
import { playIllustrations } from "@/assets/play-illustrations";

const ICON_MAP: Record<string, React.ElementType> = { BookOpen, Fire, Lightning, Star, Trophy, Medal };

const BadgeItem: React.FC<{ badge: PlayBadge }> = ({ badge }) => {
  const Icon = ICON_MAP[badge.icon] ?? Trophy;
  const unlocked = badge.unlocked;
  return (
    <div className="flex flex-col items-center gap-1" title={`${badge.name}: ${badge.description}`}>
      <div className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all ${
        unlocked ? "bg-white/30 shadow-[0_2px_0_rgba(0,0,0,0.15)]" : "bg-white/10 opacity-50"
      }`}>
        <Icon weight={unlocked ? "fill" : "regular"} size={22} className={unlocked ? "text-white" : "text-white/40"} />
        {!unlocked && <Lock weight="fill" size={10} className="absolute -bottom-0.5 -right-0.5 text-white/60 bg-white/20 rounded-full p-0.5" />}
        {unlocked && badge.unlockedAt && isRecent(badge.unlockedAt) && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-400 text-[6px] text-purple-900 font-black items-center justify-center">!</span>
          </span>
        )}
      </div>
      <span className={`text-[8px] font-bold text-center leading-tight max-w-[50px] uppercase tracking-wide ${unlocked ? "text-white" : "text-white/40"}`}>
        {badge.name}
      </span>
    </div>
  );
};

function isRecent(dateStr: string): boolean {
  try { return Date.now() - new Date(dateStr).getTime() < 86400000; } catch { return false; }
}

export const AchievementBadgesWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const badges = data?.badges ?? [];
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="overflow-hidden rounded-[20px]" style={{ backgroundColor: "#8E44AD", boxShadow: "0 5px 0 #6C3483" }}>
      <div className="flex flex-row md:flex-col">
        {/* SVG: right on mobile, top on desktop */}
        <div className="order-2 md:order-1 w-28 md:w-full flex items-center justify-center bg-white/10 p-2 md:px-6 md:pt-5 md:pb-2 flex-shrink-0">
          <playIllustrations.Winners className="h-24 md:h-32 w-auto text-white" />
        </div>

        {/* Content */}
        <div className="order-1 md:order-2 flex-1 p-4 md:pt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Trophy weight="fill" size={22} className="text-white" />
            </div>
            <div>
              <p className="text-base font-black text-white uppercase tracking-wide">Badges</p>
              <p className="text-[10px] font-bold text-white/70">{unlockedCount}/{badges.length} unlocked</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {badges.map((badge) => <BadgeItem key={badge.id} badge={badge} />)}
          </div>
        </div>
      </div>
    </div>
  );
};
