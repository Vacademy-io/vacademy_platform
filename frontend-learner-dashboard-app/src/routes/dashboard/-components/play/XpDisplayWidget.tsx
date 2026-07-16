import React from "react";
import { Lightning } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import iconPoints from "@/assets/cleaner-play/icon-points.webp";

export const XpDisplayWidget: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const totalXp = data?.totalXp ?? 0;
  const level = data?.level ?? 1;
  const xpToNext = data?.xpToNextLevel ?? 500;
  const todayXp = data?.todayXp ?? 0;

  const xpPerLevel = 500;
  const xpInLevel = xpPerLevel - xpToNext;
  const progress = Math.round((xpInLevel / xpPerLevel) * 100);
  const hasXp = totalXp > 0;

  return (
    <div className="flex h-full flex-col gap-3 rounded-play-card-sm border border-border bg-play-gold-soft p-4 shadow-play-soft-card">
      {hasXp ? (
        <>
          <div className="flex items-center gap-3">
            <img src={iconPoints} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
            <div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-h2 font-black leading-none text-play-gold-soft-ink">{totalXp.toLocaleString()}</p>
                <span className="text-caption font-black text-play-ink/60">XP</span>
              </div>
              <p className="text-caption font-bold uppercase tracking-wide text-play-ink/60">Level {level}</p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-3xs font-bold uppercase tracking-wide text-play-ink/60">
              <span>Lvl {level}</span>
              <span>Lvl {level + 1}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/70">
              <div className="h-full rounded-full bg-play-gold transition-all duration-700" style={{ width: `${progress}%` }} /* design-lint-ignore: dynamic progress percentage */ />
            </div>
            <p className="mt-1 text-right text-3xs font-bold uppercase text-play-ink/60">{xpToNext} XP to go</p>
          </div>

          {todayXp > 0 && (
            <div className="inline-flex w-fit items-center gap-1 rounded-full bg-white px-2.5 py-0.5 shadow-sm">
              <Lightning weight="fill" size={14} className="text-play-gold-soft-ink" />
              <span className="text-3xs font-black text-play-ink">+{todayXp} XP today</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <img src={iconPoints} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
          <p className="text-body font-black leading-tight text-play-ink">
            Earn your first XP in a lesson today
          </p>
        </div>
      )}
    </div>
  );
};
