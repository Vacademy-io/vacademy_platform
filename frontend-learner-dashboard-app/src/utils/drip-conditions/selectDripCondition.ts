import type { DripConditionJson } from "./types";

/**
 * Priority logic for drip conditions:
 * 1. If package-level condition exists and is_enabled !== false, use it
 * 2. If package-level condition is disabled (is_enabled === false) or null, use item-specific condition
 * 3. If both are null/undefined, return null (no drip condition)
 */

/**
 * Select the appropriate drip condition based on priority
 * @param packageCondition - Package-level drip condition (from package API)
 * @param itemCondition - Item-specific drip condition (from chapter/slide data)
 * @returns The drip condition to use, or null if none should be applied
 */
export function selectDripCondition(
  packageCondition: DripConditionJson | null | undefined,
  itemCondition: DripConditionJson | null | undefined
): DripConditionJson | null {
  // Priority 1: Use package condition if it exists and is enabled
  if (packageCondition) {
    // If is_enabled is explicitly false, skip package condition
    if (packageCondition.is_enabled === false) {
      // Fall through to item condition
    } else {
      // Use package condition (is_enabled is true or undefined)
      return packageCondition;
    }
  }

  // Priority 2: Use item-specific condition if package condition is disabled or null
  if (itemCondition) {
    // Check if item condition is enabled
    if (itemCondition.is_enabled === false) {
      return null; // Item condition is disabled, no condition applies
    }
    return itemCondition;
  }

  // No condition applies
  return null;
}

/**
 * Check if a drip condition array has any enabled conditions for a specific target
 * @param conditions - Array of drip conditions or single condition
 * @param target - Target type ('chapter' or 'slide')
 * @returns true if at least one enabled condition exists for the target
 */
export function hasEnabledConditionForTarget(
  conditions: DripConditionJson | DripConditionJson[] | null | undefined,
  target: "chapter" | "slide"
): boolean {
  if (!conditions) return false;

  const conditionsArray = Array.isArray(conditions) ? conditions : [conditions];

  return conditionsArray.some((condition) => {
    // Check if condition targets this level
    if (condition.target && condition.target !== target) {
      return false;
    }

    // Check if condition is enabled (default to true if not specified)
    return condition.is_enabled !== false;
  });
}

/**
 * Get enabled condition for a specific target from an array
 * @param conditions - Array of drip conditions or single condition
 * @param target - Target type ('chapter' or 'slide')
 * @returns The first enabled condition for the target, or null
 */
export function getEnabledConditionForTarget(
  conditions: DripConditionJson | DripConditionJson[] | null | undefined,
  target: "chapter" | "slide"
): DripConditionJson | null {
  if (!conditions) return null;

  const conditionsArray = Array.isArray(conditions) ? conditions : [conditions];

  const matchingCondition = conditionsArray.find((condition) => {
    // Check if condition targets this level (or no target = applies to all)
    const targetsThisLevel = !condition.target || condition.target === target;
    if (!targetsThisLevel) return false;

    // Check if condition is enabled
    return condition.is_enabled !== false;
  });

  return matchingCondition || null;
}
