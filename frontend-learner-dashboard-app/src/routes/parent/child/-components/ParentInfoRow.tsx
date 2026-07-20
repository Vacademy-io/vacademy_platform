import type { Icon } from "@phosphor-icons/react";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type InfoTone = "good" | "watch" | "action" | "neutral";

const PILL_TONE: Record<InfoTone, string> = {
  good: "bg-success-50 text-success-600",
  watch: "bg-warning-50 text-warning-600",
  action: "bg-danger-50 text-danger-600",
  neutral: "bg-info-50 text-info-600",
};

const ICON_TONE: Record<InfoTone, string> = {
  good: "bg-success-50 text-success-600",
  watch: "bg-warning-50 text-warning-600",
  action: "bg-danger-50 text-danger-600",
  neutral: "bg-primary-50 text-primary-500",
};

interface ParentInfoRowProps {
  icon: Icon;
  title: string;
  /** short status text shown as a pill (e.g. "90%", "2 due", "All paid") */
  value?: string | null;
  tone?: InfoTone;
  onClick: () => void;
  className?: string;
}

/**
 * A CuePilot-style info row: soft icon chip + title on the left, a status pill +
 * chevron on the right, in a white rounded card. Used for the "Attendance
 * overview · 90%" / "Fees · 2 due" at-a-glance rows.
 */
export function ParentInfoRow({ icon: IconCmp, title, value, tone = "neutral", onClick, className }: ParentInfoRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 text-start shadow-sm",
        "transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", ICON_TONE[tone])}>
          <IconCmp weight="duotone" className="size-5" aria-hidden />
        </span>
        <span className="truncate text-body font-semibold text-foreground">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {value ? (
          <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-semibold", PILL_TONE[tone])}>
            {value}
          </span>
        ) : null}
        <CaretRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
      </div>
    </button>
  );
}
