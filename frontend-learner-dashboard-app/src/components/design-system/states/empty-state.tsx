import { cn } from "@/lib/utils";
import { Tray, type Icon } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";

export interface EmptyStateProps {
  /** Phosphor icon component. Defaults to a tray glyph. */
  icon?: Icon;
  title: string;
  description?: string;
  /** Primary call-to-action that helps the user populate this surface. */
  action?: { label: string; onClick: () => void };
  /** Tighter spacing for use inside cards/panels rather than full-page. */
  compact?: boolean;
  className?: string;
}

/**
 * Canonical empty state: composed, friendly, and points the user to a next step.
 * Use on any list/grid/section that can legitimately have no data.
 */
export function EmptyState({
  icon: IconCmp = Tray,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8" : "gap-3 py-16",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">
        <IconCmp size={24} weight="duotone" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-title font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="max-w-sm text-body text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <MyButton
          buttonType="primary"
          scale="medium"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </MyButton>
      )}
    </div>
  );
}
