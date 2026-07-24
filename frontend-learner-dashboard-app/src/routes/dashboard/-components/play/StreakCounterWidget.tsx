import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import iconStreak from "@/assets/cleaner-play/icon-streak.webp";

/**
 * Weekday initials, Monday-first. A function (not a module const) so the
 * labels re-resolve when the learner switches language — a module-scope array
 * would freeze the English initials at import time.
 */
const getDayLabels = (t: TFunction<"dashboard">): string[] => [
  t("streak.dayInitial.monday"),
  t("streak.dayInitial.tuesday"),
  t("streak.dayInitial.wednesday"),
  t("streak.dayInitial.thursday"),
  t("streak.dayInitial.friday"),
  t("streak.dayInitial.saturday"),
  t("streak.dayInitial.sunday"),
];

export const StreakCounterWidget: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const dayLabels = getDayLabels(t);
  const data = usePlayGamificationStore((s) => s.data);
  const isLoading = usePlayGamificationStore((s) => s.isLoading);
  const streak = data?.currentStreak ?? 0;
  const best = data?.longestStreak ?? 0;
  const dots = data?.weeklyDots ?? Array(7).fill(false);
  const hasStreak = streak > 0;

  if (isLoading) {
    return (
      <div className="h-full min-h-36 animate-pulse rounded-play-card-sm border border-border bg-play-warn-soft/50 shadow-play-soft-card" />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-play-card-sm border border-border p-4 shadow-play-soft-card",
        // Inactive = quiet white (matches the pastel language) — the old
        // flat-gray --play-c-surface fallback clashed with the -soft cards.
        hasStreak ? "bg-play-warn-soft" : "bg-white"
      )}
    >
      <div className="flex items-center gap-3">
        <img src={iconStreak} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
        {hasStreak ? (
          <div>
            <p className="text-h2 font-black leading-none text-play-warn-soft-ink">{streak}</p>
            <p className="text-caption font-bold uppercase tracking-wide text-play-ink/60">
              {t("streak.dayStreakLabel")}
            </p>
          </div>
        ) : (
          <p className="text-body font-black leading-tight text-play-ink">
            {t("streak.emptyPrompt")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {dayLabels.map((label, i) => (
          <div
            key={i}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-caption font-black",
              // play-ink/5 reads on both the peach active card and the white
              // inactive card (bg-white/70 was invisible on white).
              dots[i] ? "bg-play-warn text-white" : "bg-play-ink/5 text-play-ink/50"
            )}
          >
            {dots[i] ? "✓" : label}
          </div>
        ))}
      </div>

      {best > 0 && (
        <p className="mt-auto text-caption font-bold uppercase tracking-wide text-play-ink/60">
          {t("streak.best", { count: best })}
        </p>
      )}
    </div>
  );
};
