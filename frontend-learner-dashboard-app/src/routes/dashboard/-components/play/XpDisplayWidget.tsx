import React from "react";
import { Star, Lightning } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import { playIllustrations } from "@/assets/play-illustrations";

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
    <div className="overflow-hidden rounded-play-card bg-play-gold shadow-play-4d-gold">
      <div className="flex flex-row md:flex-col">
        {/* SVG: right on mobile, top on desktop */}
        <div className="order-2 md:order-1 w-28 md:w-full flex items-center justify-center bg-white/10 p-2 md:px-6 md:pt-5 md:pb-2 flex-shrink-0">
          <playIllustrations.SteppingUp className="h-24 md:h-32 w-auto text-white" />
        </div>

        {/* Content */}
        <div className="order-1 md:order-2 flex-1 p-4 md:pt-3">
          {hasXp ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-play-2d-gold">
                  <Star weight="fill" size={26} className="text-play-warn" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-black text-play-ink leading-none">{totalXp.toLocaleString()}</p>
                    <span className="text-sm font-black text-play-ink">XP</span>
                  </div>
                  <p className="text-xs font-bold text-play-ink uppercase tracking-wide">Level {level}</p>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-caption font-bold text-play-ink uppercase tracking-wide mb-1">
                  <span>Lvl {level}</span>
                  <span>Lvl {level + 1}</span>
                </div>
                <div className="h-3 rounded-full bg-play-gold-deep overflow-hidden">
                  {/* dynamic: computed progress percentage */}
                  <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-caption font-bold text-play-ink mt-1 text-right uppercase">{xpToNext} XP to go</p>
              </div>

              {todayXp > 0 && (
                <div className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 shadow-play-2d-gold">
                  <Lightning weight="fill" size={14} className="text-play-warn" />
                  <span className="text-xs font-black text-play-ink">+{todayXp} XP today</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-play-2d-gold">
                <Star weight="fill" size={26} className="text-play-warn" />
              </div>
              <p className="text-base font-black text-play-ink leading-tight">
                Earn your first XP in a lesson today
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
