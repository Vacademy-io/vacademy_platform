import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface QuickFilterChip {
  id: string;
  label: string;
  active: boolean;
}

/** "Popular · New · Free · Hindi · Under ₹1,000" — toggle chips; one scrolling row on phones. */
export const QuickFilterBar: React.FC<{
  chips: QuickFilterChip[];
  onToggle: (id: string) => void;
}> = ({ chips, onToggle }) => {
  const { t } = useTranslation("coursePlayerB");
  if (!chips.length) return null;
  return (
    <div
      className="catalogue-no-scrollbar mb-4 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible"
      role="group"
      aria-label={t("courseCatalog.quickFiltersAriaLabel", "Quick filters")}
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.active}
          onClick={() => onToggle(chip.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-catalogue-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
            chip.active
              ? "border-primary-500 bg-primary-50 text-catalogue-brand-ink"
              : "border-catalogue-border bg-catalogue-bg-elevated text-catalogue-text-secondary hover:border-catalogue-border-strong hover:text-catalogue-text-primary",
          )}
        >
          {chip.active && <Check size={14} weight="bold" aria-hidden="true" />}
          {chip.label}
        </button>
      ))}
    </div>
  );
};
