import React from "react";
import { Star, Fire, Trophy, Lock } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import type { PlayBadge, PlayGamificationData } from "@/services/play-gamification";
import { BadgeVisual } from "./badge-icons";
import { useCleanerPlayTheme } from "@/hooks/use-cleaner-play-theme";
import iconPoints from "@/assets/cleaner-play/icon-points.webp";
import iconStreak from "@/assets/cleaner-play/icon-streak.webp";
import iconBadges from "@/assets/cleaner-play/icon-badges.webp";

/**
 * Standard-theme gamification panel.
 *
 * Mirrors the Play widgets (XP / streak / badges) but is built entirely from the
 * shared design-system tokens (primary / warning / muted) so it fits the default
 * and vibrant dashboards. The Play theme keeps its own `play-*` widgets — those
 * tokens are not allowed to leak onto standard screens (see design-system
 * `09-learner-app.md`).
 */

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const XP_PER_LEVEL = 500;

function XpCard({ data }: { data: PlayGamificationData | null }) {
  const isCleanerPlay = useCleanerPlayTheme();
  const totalXp = data?.totalXp ?? 0;
  const level = data?.level ?? 1;
  const xpToNext = data?.xpToNextLevel ?? XP_PER_LEVEL;
  const xpInLevel = XP_PER_LEVEL - xpToNext;
  const progress = Math.min(100, Math.max(0, Math.round((xpInLevel / XP_PER_LEVEL) * 100)));
  const hasXp = totalXp > 0;
  const breakdown = data?.xpBreakdown ?? [];

  if (isCleanerPlay) {
    return (
      <div className="cp-card flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <img src={iconPoints} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
          <div>
            <div className="flex items-baseline gap-1">
              <span className="cp-heading text-h2">{totalXp.toLocaleString()}</span>
              <span className="cp-muted text-caption font-semibold">points</span>
            </div>
            <p className="cp-muted text-caption font-medium uppercase tracking-wide">Level {level}</p>
          </div>
        </div>

        {breakdown.length > 0 && (
          <div className="space-y-1 rounded-lg bg-cp-bg-deep p-2">
            <p className="cp-muted text-3xs font-semibold uppercase tracking-wide">How you earn points</p>
            {breakdown.map((b) => (
              <div key={b.key} className="flex items-center justify-between text-caption">
                <span className="cp-muted">{b.label}</span>
                <span className="cp-heading">{b.points}</span>
              </div>
            ))}
          </div>
        )}

        {hasXp ? (
          <div className="mt-auto space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-cp-bg-deep">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }} // design-lint-ignore: dynamic XP progress within the current level
              />
            </div>
            <p className="cp-muted text-caption">
              {xpToNext} points to level {level + 1}
            </p>
          </div>
        ) : (
          <p className="cp-muted mt-auto text-caption">Start learning to earn your first points.</p>
        )}
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <Star weight="fill" size={20} className="text-primary-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-h2 font-bold text-foreground">{totalXp.toLocaleString()}</span>
              <span className="text-caption font-semibold text-muted-foreground">points</span>
            </div>
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              Level {level}
            </p>
          </div>
        </div>

        {breakdown.length > 0 && (
          <div className="space-y-1 rounded-lg bg-neutral-50 p-2">
            <p className="text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
              How you earn points
            </p>
            {breakdown.map((b) => (
              <div key={b.key} className="flex items-center justify-between text-caption">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-semibold text-foreground">{b.points}</span>
              </div>
            ))}
          </div>
        )}

        {hasXp ? (
          <div className="mt-auto space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-700"
                style={{ width: `${progress}%` }} // design-lint-ignore: dynamic XP progress within the current level
              />
            </div>
            <p className="text-caption text-muted-foreground">
              {xpToNext} points to level {level + 1}
            </p>
          </div>
        ) : (
          <p className="mt-auto text-caption text-muted-foreground">
            Start learning to earn your first points.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StreakCard({ data }: { data: PlayGamificationData | null }) {
  const isCleanerPlay = useCleanerPlayTheme();
  const streak = data?.currentStreak ?? 0;
  const best = data?.longestStreak ?? 0;
  const dots = data?.weeklyDots ?? Array(7).fill(false);
  const hasStreak = streak > 0;

  if (isCleanerPlay) {
    return (
      <div className="cp-card flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <img src={iconStreak} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
          {hasStreak ? (
            <div>
              <span className="cp-heading text-h2">{streak}</span>
              <p className="cp-muted text-caption font-medium uppercase tracking-wide">Day streak</p>
            </div>
          ) : (
            <p className="cp-heading text-body">Learn today to start a streak</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold",
                dots[i] ? "bg-cp-gold text-white" : "bg-cp-bg-deep cp-muted"
              )}
            >
              {dots[i] ? "✓" : label}
            </div>
          ))}
        </div>
        {best > 0 && <p className="cp-muted mt-auto text-caption">Best: {best} days</p>}
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50">
            <Fire weight="fill" size={20} className="text-warning-500" />
          </div>
          {hasStreak ? (
            <div>
              <span className="text-h2 font-bold text-foreground">{streak}</span>
              <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                Day streak
              </p>
            </div>
          ) : (
            <p className="text-body font-semibold text-foreground">
              Learn today to start a streak
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold",
                dots[i] ? "bg-warning-500 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {dots[i] ? "✓" : label}
            </div>
          ))}
        </div>
        {best > 0 && (
          <p className="mt-auto text-caption text-muted-foreground">Best: {best} days</p>
        )}
      </CardContent>
    </Card>
  );
}

function BadgeChip({ badge, isCleanerPlay }: { badge: PlayBadge; isCleanerPlay?: boolean }) {
  const unlocked = badge.unlocked;
  const awarded = badge.isAdminAwarded;
  const tooltip = awarded
    ? `${badge.name} — Awarded by your institute${badge.awardReason ? `: ${badge.awardReason}` : ""}`
    : `${badge.name}: ${badge.description}`;
  return (
    <div className="flex w-16 flex-col items-center gap-1" title={tooltip}>
      <div
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full",
          unlocked
            ? isCleanerPlay ? "bg-cp-sage-tint" : "bg-primary-50"
            : isCleanerPlay ? "bg-cp-bg-deep" : "bg-muted"
        )}
      >
        <BadgeVisual
          icon={badge.icon}
          fill
          weight={unlocked ? "fill" : "regular"}
          size={20}
          className={cn(
            unlocked
              ? isCleanerPlay ? "text-cp-sage" : "text-primary-500"
              : isCleanerPlay ? "cp-muted" : "text-muted-foreground"
          )}
        />
        {!unlocked && (
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full",
            isCleanerPlay ? "bg-cp-surface" : "bg-background"
          )}>
            <Lock weight="fill" size={9} className={isCleanerPlay ? "cp-muted" : "text-muted-foreground"} />
          </span>
        )}
        {awarded && (
          <span className={cn(
            "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2",
            isCleanerPlay ? "bg-cp-gold ring-cp-surface" : "bg-warning-500 ring-card"
          )}>
            <Star weight="fill" size={9} className="text-white" />
          </span>
        )}
      </div>
      <span className={cn(
        "w-full text-center text-3xs font-medium leading-tight",
        isCleanerPlay ? "cp-muted" : "text-muted-foreground"
      )}>
        {badge.name}
      </span>
    </div>
  );
}

function BadgesCard({ data }: { data: PlayGamificationData | null }) {
  const isCleanerPlay = useCleanerPlayTheme();
  const badges = data?.badges ?? [];
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  if (isCleanerPlay) {
    return (
      <div className="cp-card flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <img src={iconBadges} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
          <div>
            <p className="cp-heading text-subtitle">Badges</p>
            <p className="cp-muted text-caption">
              {unlockedCount > 0
                ? `${unlockedCount}/${badges.length} unlocked`
                : "Complete a lesson to unlock a badge"}
            </p>
          </div>
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {badges.map((badge) => (
              <BadgeChip key={badge.id} badge={badge} isCleanerPlay />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <Trophy weight="fill" size={20} className="text-primary-500" />
          </div>
          <div>
            <p className="text-subtitle font-bold text-foreground">Badges</p>
            <p className="text-caption text-muted-foreground">
              {unlockedCount > 0
                ? `${unlockedCount}/${badges.length} unlocked`
                : "Complete a lesson to unlock a badge"}
            </p>
          </div>
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {badges.map((badge) => (
              <BadgeChip key={badge.id} badge={badge} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const DashboardGamificationPanel: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const isLoading = usePlayGamificationStore((s) => s.isLoading);
  // Master toggle off → hide the badges card (XP + streak stay).
  const showBadges = data?.badgesEnabled !== false;

  // No empty-state flash: skeletons until the store resolves (cache or fetch).
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-36 animate-pulse rounded-xl border border-border bg-muted/50",
              "cp-card [.ui-cleaner-play_&]:bg-cp-bg-deep"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <XpCard data={data} />
      <StreakCard data={data} />
      {showBadges && <BadgesCard data={data} />}
    </div>
  );
};
