import { Lock } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface LockNoticeProps {
  /** Why the content is still closed, e.g. "Unlocks in 4 days (12 Sep)". */
  message?: string | null;
  className?: string;
}

/**
 * Inline "why is this locked" line for content cards.
 *
 * Deliberately not a tooltip: on the card-only course layout most learners are
 * on a phone, where a hover tooltip never opens and a lock icon with no reason
 * next to it just reads as broken.
 */
export function LockNotice({ message, className }: LockNoticeProps) {
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-caption text-muted-foreground",
        className,
      )}
    >
      <Lock size={12} weight="fill" className="shrink-0" />
      <span className="line-clamp-2">{message || "Locked"}</span>
    </p>
  );
}
