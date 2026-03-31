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

  return (
    <div
      className="overflow-hidden rounded-[20px]"
      style={{ backgroundColor: "#FFB800", boxShadow: "0 5px 0 #CC9300" }}
    >
      <div className="flex flex-row md:flex-col">
        {/* SVG: right on mobile, top on desktop */}
        <div className="order-2 md:order-1 w-28 md:w-full flex items-center justify-center bg-white/10 p-2 md:px-6 md:pt-5 md:pb-2 flex-shrink-0">
          <playIllustrations.SteppingUp className="h-24 md:h-32 w-auto text-white" />
        </div>

        {/* Content */}
        <div className="order-1 md:order-2 flex-1 p-4 md:pt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
              <Star weight="fill" size={26} className="text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-black text-white leading-none">{totalXp.toLocaleString()}</p>
                <span className="text-sm font-black text-white/80">XP</span>
              </div>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wide">Level {level}</p>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-[10px] font-bold text-white/60 uppercase tracking-wide mb-1">
              <span>Lvl {level}</span>
              <span>Lvl {level + 1}</span>
            </div>
            <div className="h-3 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${Math.max(progress, 5)}%` }} />
            </div>
            <p className="text-[10px] font-bold text-white/60 mt-1 text-right uppercase">{xpToNext} XP to go</p>
          </div>

          {todayXp > 0 && (
            <div className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-0.5">
              <Lightning weight="fill" size={14} className="text-white" />
              <span className="text-xs font-black text-white">+{todayXp} XP TODAY</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
