import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ParentStatusChip } from "./ParentStatusChip";
import type { AttentionItem } from "../-lib/summaries";

interface AttentionCardProps {
  childId: string;
  items: AttentionItem[];
}

/**
 * "What needs your attention" — at most three items. When empty, shows a calm
 * reassurance line, NEVER an empty box. Each item routes to its module on tap.
 */
export function AttentionCard({ childId, items }: AttentionCardProps) {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-50">
          <CheckCircle weight="fill" className="size-5 text-success-600" aria-hidden />
        </span>
        <p className="text-body text-foreground">{t("home.allClear")}</p>
      </div>
    );
  }

  return (
    <div data-tour="attention-card" className="flex flex-col gap-2">
      <h2 className="text-body font-semibold text-foreground">{t("home.attentionTitle")}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <button
              onClick={() =>
                navigate({ to: `/parent/child/${childId}/${item.module}` as never })
              }
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 text-start shadow-sm",
                "transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              )}
            >
              <div className="flex items-center gap-3">
                <ParentStatusChip tone={item.tone} label={t(`tone.${item.tone}`)} />
                <span className="text-body text-foreground">{item.text}</span>
              </div>
              <CaretRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
