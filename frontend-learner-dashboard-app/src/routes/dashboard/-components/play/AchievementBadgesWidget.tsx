import React from "react";
import { Trophy, Lock, Star } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import type { PlayBadge } from "@/services/play-gamification";
import { playIllustrations } from "@/assets/play-illustrations";
import { BadgeVisual } from "../badge-icons";

const BadgeItem: React.FC<{ badge: PlayBadge }> = ({ badge }) => {
  const unlocked = badge.unlocked;
  const awarded = badge.isAdminAwarded;
  const tooltip = awarded
    ? `${badge.name} — Awarded by your institute${badge.awardReason ? `: ${badge.awardReason}` : ""}`
    : `${badge.name}: ${badge.description}`;
  return (
    <div className="flex flex-col items-center gap-1" title={tooltip}>
      <div
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          unlocked ? "bg-white shadow-play-badge" : "bg-white/30 grayscale"
        }`}
      >
        <BadgeVisual
          icon={badge.icon}
          fill
          weight={unlocked ? "fill" : "regular"}
          size={22}
          className={unlocked ? "text-play-accent-deep" : "text-play-ink"}
        />
        {!unlocked && (
          <Lock
            weight="fill"
            size={10}
            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 text-play-ink"
          />
        )}
        {awarded ? (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-play-gold ring-2 ring-white">
            <Star weight="fill" size={10} className="text-play-ink" />
          </span>
        ) : (
          unlocked && badge.unlockedAt && isRecent(badge.unlockedAt) && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-play-gold opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-play-gold text-play-badge text-play-ink font-black items-center justify-center">!</span>
            </span>
          )
        )}
      </div>
      <span className="text-3xs font-bold text-play-ink text-center leading-tight max-w-12">
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
  // Master toggle off → the institute disabled badges; render nothing.
  if (data?.badgesEnabled === false) return null;
  const badges = data?.badges ?? [];
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="overflow-hidden rounded-play-card bg-play-accent shadow-play-4d-accent">
      <div className="flex flex-row md:flex-col">
        {/* SVG: right on mobile, top on desktop */}
        <div className="order-2 md:order-1 w-28 md:w-full flex items-center justify-center bg-white/10 p-2 md:px-6 md:pt-5 md:pb-2 flex-shrink-0">
          <playIllustrations.Winners className="h-24 md:h-32 w-auto text-white" />
        </div>

        {/* Content */}
        <div className="order-1 md:order-2 flex-1 p-4 md:pt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-play-2d-accent">
              <Trophy weight="fill" size={22} className="text-play-accent-deep" />
            </div>
            <div>
              <p className="text-base font-black text-play-ink uppercase tracking-wide">Badges</p>
              <p className="text-caption font-bold text-play-ink">
                {unlockedCount > 0
                  ? `${unlockedCount}/${badges.length} unlocked`
                  : "Complete your first lesson to unlock a badge"}
              </p>
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
