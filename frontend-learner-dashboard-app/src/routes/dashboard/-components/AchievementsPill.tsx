import { useEffect, useState } from "react";
import { Trophy, Star } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import { getCachedGamification, type PlayGamificationData } from "@/services/play-gamification";
import { getInstituteId } from "@/constants/helper";
import { AchievementsDialog } from "./AchievementsDialog";

/**
 * Compact header pill showing the learner's badge count + points. Clicking it
 * opens the achievements popup. Reads the shared gamification store (populated by
 * the dashboard) and falls back to the localStorage cache so it still shows on
 * pages the learner reaches without passing through the dashboard first.
 */
export function AchievementsPill({ className }: { className?: string }) {
  const storeData = usePlayGamificationStore((s) => s.data);
  const [fallback, setFallback] = useState<PlayGamificationData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (storeData) return;
    let active = true;
    (async () => {
      const id = await getInstituteId();
      if (!id || !active) return;
      const cached = getCachedGamification(id);
      if (cached && active) setFallback(cached);
    })();
    return () => {
      active = false;
    };
  }, [storeData]);

  const data = storeData ?? fallback;
  // Hide until we have data and only when the institute has the feature on.
  if (!data || data.badgesEnabled === false) return null;

  const badgeCount = data.badges?.filter((b) => b.unlocked).length ?? 0;
  const xp = data.totalXp ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Your achievements"
        title="Your achievements"
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border border-primary-200/50 bg-white px-2.5 transition-colors duration-200 hover:border-primary-300 hover:bg-primary-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 [.ui-play_&]:rounded-full [.ui-play_&]:border-border",
          className
        )}
      >
        <span className="flex items-center gap-1">
          <Trophy weight="fill" className="h-4 w-4 text-warning-500" />
          <span className="text-caption font-semibold text-foreground">{badgeCount}</span>
        </span>
        <span className="hidden items-center gap-1 border-s border-primary-200/50 ps-2 dark:border-neutral-700 sm:flex">
          <Star weight="fill" className="h-4 w-4 text-primary-500" />
          <span className="text-caption font-semibold text-foreground">
            {xp.toLocaleString()}
          </span>
        </span>
      </button>
      <AchievementsDialog open={open} onOpenChange={setOpen} data={data} />
    </>
  );
}
