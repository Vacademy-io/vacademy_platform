import React from "react";
import { Star } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";

export const XpHeaderPill: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const data = usePlayGamificationStore((s) => s.data);
  const level = data?.level ?? 1;
  const totalXp = data?.totalXp ?? 0;

  return (
    <div className="flex items-center gap-2 rounded-full bg-play-gold px-4 py-2 shadow-play-2d-gold">
      <Star weight="fill" size={18} className="text-play-ink" />
      <span className="text-sm font-black text-play-ink uppercase tracking-wide">
        {t("xp.levelShort", { level })}
      </span>
      <span aria-hidden="true" className="h-4 w-px bg-play-gold-deep" />
      <span className="text-sm font-black text-play-ink">
        {t("xp.xpAmount", { amount: totalXp.toLocaleString() })}
      </span>
    </div>
  );
};
