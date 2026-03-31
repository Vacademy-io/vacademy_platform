import React from "react";
import { Star } from "@phosphor-icons/react";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";

export const XpHeaderPill: React.FC = () => {
  const data = usePlayGamificationStore((s) => s.data);
  const level = data?.level ?? 1;
  const totalXp = data?.totalXp ?? 0;

  return (
    <div
      className="flex items-center gap-2 rounded-full px-4 py-2"
      style={{
        backgroundColor: "#FFB800",
        boxShadow: "0 3px 0 #CC9300",
      }}
    >
      <Star weight="fill" size={18} className="text-white" />
      <span className="text-sm font-black text-white uppercase tracking-wide">
        Lvl {level}
      </span>
      <span className="text-white/50 font-bold">|</span>
      <span className="text-sm font-black text-white">
        {totalXp.toLocaleString()} XP
      </span>
    </div>
  );
};
