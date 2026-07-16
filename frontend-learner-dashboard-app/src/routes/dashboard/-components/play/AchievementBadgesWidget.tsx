import React from "react";
import { Lock, Star } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import type { PlayBadge } from "@/services/play-gamification";
import iconBadges from "@/assets/cleaner-play/icon-badges.webp";
import { BadgeVisual } from "../badge-icons";

const BadgeItem: React.FC<{ badge: PlayBadge }> = ({ badge }) => {
  const unlocked = badge.unlocked;
  const awarded = badge.isAdminAwarded;
  const tooltip = awarded
    ? `${badge.name} — Awarded by your institute${badge.awardReason ? `: ${badge.awardReason}` : ""}`
    : `${badge.name}: ${badge.description}`;
  return (
    <div className="flex w-16 flex-col items-center gap-1" title={tooltip}>
      <div
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full transition-all",
          unlocked ? "bg-white shadow-play-badge" : "bg-white/60 grayscale"
        )}
      >
        <BadgeVisual
          icon={badge.icon}
          fill
          weight={unlocked ? "fill" : "regular"}
          size={22}
          className={unlocked ? "text-play-accent-deep" : "text-play-ink/50"}
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
      <span className="w-full text-center text-3xs font-bold leading-tight text-play-ink/70">
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
    <div className="flex h-full flex-col gap-3 rounded-play-card-sm border border-border bg-play-accent-soft p-4 shadow-play-soft-card">
      <div className="flex items-center gap-3">
        <img src={iconBadges} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
        <div>
          <p className="text-body font-black uppercase tracking-wide text-play-accent-soft-ink">Badges</p>
          <p className="text-caption font-bold text-play-ink/60">
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
  );
};
