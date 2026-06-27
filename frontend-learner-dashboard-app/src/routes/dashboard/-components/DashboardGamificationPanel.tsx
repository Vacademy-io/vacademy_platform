import React from "react";
import { Star, Fire, Trophy, Lock } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import type { PlayBadge, PlayGamificationData } from "@/services/play-gamification";
import { BadgeVisual } from "./badge-icons";

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
  const totalXp = data?.totalXp ?? 0;
  const level = data?.level ?? 1;
  const xpToNext = data?.xpToNextLevel ?? XP_PER_LEVEL;
  const xpInLevel = XP_PER_LEVEL - xpToNext;
  const progress = Math.min(100, Math.max(0, Math.round((xpInLevel / XP_PER_LEVEL) * 100)));
  const hasXp = totalXp > 0;
  const breakdown = data?.xpBreakdown ?? [];

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
              {/* dynamic: XP progress within the current level */}
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-700"
                style={{ width: `${progress}%` }}
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
  const streak = data?.currentStreak ?? 0;
  const best = data?.longestStreak ?? 0;
  const dots = data?.weeklyDots ?? Array(7).fill(false);
  const hasStreak = streak > 0;

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

function BadgeChip({ badge }: { badge: PlayBadge }) {
  const unlocked = badge.unlocked;
  const awarded = badge.isAdminAwarded;
  const tooltip = awarded
    ? `${badge.name} — Awarded by your institute${badge.awardReason ? `: ${badge.awardReason}` : ""}`
    : `${badge.name}: ${badge.description}`;
  return (
    <div className="flex flex-col items-center gap-1" title={tooltip}>
      <div
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full",
          unlocked ? "bg-primary-50" : "bg-muted"
        )}
      >
        <BadgeVisual
          icon={badge.icon}
          fill
          weight={unlocked ? "fill" : "regular"}
          size={20}
          className={unlocked ? "text-primary-500" : "text-muted-foreground"}
        />
        {!unlocked && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background">
            <Lock weight="fill" size={9} className="text-muted-foreground" />
          </span>
        )}
        {awarded && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning-500 ring-2 ring-card">
            <Star weight="fill" size={9} className="text-white" />
          </span>
        )}
      </div>
      <span className="max-w-12 text-center text-caption font-medium leading-tight text-muted-foreground">
        {badge.name}
      </span>
    </div>
  );
}

function BadgesCard({ data }: { data: PlayGamificationData | null }) {
  const badges = data?.badges ?? [];
  const unlockedCount = badges.filter((b) => b.unlocked).length;

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
  // Master toggle off → hide the badges card (XP + streak stay).
  const showBadges = data?.badgesEnabled !== false;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <XpCard data={data} />
      <StreakCard data={data} />
      {showBadges && <BadgesCard data={data} />}
    </div>
  );
};
