import { CheckCircle, Warning, XCircle, Info } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ParentStatusTone = "good" | "watch" | "action" | "neutral";

const TONE = {
  good: { cls: "bg-success-50 text-success-600", Icon: CheckCircle },
  watch: { cls: "bg-warning-50 text-warning-600", Icon: Warning },
  action: { cls: "bg-danger-50 text-danger-600", Icon: XCircle },
  neutral: { cls: "bg-info-50 text-info-600", Icon: Info },
} as const;

interface ParentStatusChipProps {
  tone: ParentStatusTone;
  label: string;
  className?: string;
}

/**
 * Status shown as colour + icon + text together — never colour alone. This is
 * the accessibility mechanism (colour-blind safe, readable at a glance) and the
 * "click the red icon for attendance" affordance the parent portal leans on.
 */
export function ParentStatusChip({ tone, label, className }: ParentStatusChipProps) {
  const { cls, Icon } = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
        cls,
        className,
      )}
    >
      <Icon weight="fill" className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
