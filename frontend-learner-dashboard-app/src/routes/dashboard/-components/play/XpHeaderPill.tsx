import React from "react";
import { Star } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";

export const XpHeaderPill: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const level = data?.level ?? 1;
  const totalXp = data?.totalXp ?? 0;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-yellow-50 border-2 border-yellow-200 px-3 py-1.5 shadow-sm">
      <Star weight="fill" size={16} className="text-yellow-500" />
      <span className="text-xs font-bold text-yellow-700">
        Lvl {level}
      </span>
      <span className="text-xs text-yellow-400">|</span>
      <span className="text-xs font-semibold text-yellow-600">
        {totalXp.toLocaleString()} XP
      </span>
    </div>
  );
};
