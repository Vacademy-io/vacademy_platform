import type { DripConditionEvaluation } from "@/utils/drip-conditions";

/**
 * Helper to check if an item should be filtered out completely
 */
export function shouldFilterItem(
  evaluation: DripConditionEvaluation | undefined
): boolean {
  return evaluation?.isHidden === true;
}

/**
 * Helper to check if an item is locked
 */
export function isItemLocked(
  evaluation: DripConditionEvaluation | undefined
): boolean {
  return evaluation?.isLocked === true;
}
