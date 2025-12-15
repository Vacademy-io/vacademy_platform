import { ReactNode } from "react";
import { LockedBadge, UnlockRequirements } from "@/components/drip-conditions";
import type { DripConditionEvaluation } from "@/utils/drip-conditions";

interface DripConditionWrapperProps {
  evaluation: DripConditionEvaluation | undefined;
  children: ReactNode;
  /** Whether to show unlock requirements inline */
  showUnlockRequirements?: boolean;
  /** Whether to render as locked (disabled) or completely hide */
  hideCompletely?: boolean;
}

/**
 * Wrapper component to apply drip condition logic to content
 */
export function DripConditionWrapper({
  evaluation,
  children,
  showUnlockRequirements = false,
  hideCompletely = true,
}: DripConditionWrapperProps) {
  // No evaluation or fully accessible
  if (!evaluation || (!evaluation.isLocked && !evaluation.isHidden)) {
    return <>{children}</>;
  }

  // Hidden content - don't render at all
  if (evaluation.isHidden && hideCompletely) {
    return null;
  }

  // Locked content - render with lock badge and disabled styling
  if (evaluation.isLocked) {
    return (
      <div className="relative">
        <div className="opacity-60 pointer-events-none">{children}</div>
        <div className="absolute top-2 right-2 z-10">
          <LockedBadge size="sm" />
        </div>
        {showUnlockRequirements && evaluation.unlockMessage && (
          <div className="mt-1 px-2">
            <UnlockRequirements
              unlockMessage={evaluation.unlockMessage}
              compact
            />
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
