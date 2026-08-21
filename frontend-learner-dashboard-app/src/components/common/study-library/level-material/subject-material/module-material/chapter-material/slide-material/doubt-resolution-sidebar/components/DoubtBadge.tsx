import { cn } from "@/lib/utils";

export type DoubtBadgeTone = "neutral" | "success" | "warning" | "info";

/**
 * Flat status/role pill for the doubts panel: a solid token tint, neutral ink,
 * and the semantic colour carried by the icon. Tinted backgrounds with same-hue
 * text don't clear 4.5:1 at badge sizes, so the ink stays neutral and legible
 * while the icon still reads as success / pending / answered at a glance.
 *
 * (design-system StatusChip isn't used here: its INFO variant renders an "X",
 * which reads as "failed" on a pending doubt.)
 */
const TONES: Record<DoubtBadgeTone, { surface: string; icon: string }> = {
  neutral: { surface: "bg-neutral-100", icon: "text-neutral-500" },
  success: { surface: "bg-success-50", icon: "text-success-600" },
  warning: { surface: "bg-warning-50", icon: "text-warning-600" },
  info: { surface: "bg-info-50", icon: "text-info-600" },
};

export const DoubtBadge = ({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: DoubtBadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => {
  const { surface, icon: iconColor } = TONES[tone];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold text-neutral-800",
        surface,
        className
      )}
    >
      {icon && <span className={cn("flex items-center", iconColor)}>{icon}</span>}
      {children}
    </span>
  );
};
