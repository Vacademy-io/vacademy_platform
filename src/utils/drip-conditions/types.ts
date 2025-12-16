/**
 * Drip Condition Types
 * Re-exported from the root drip-conditions.ts file for internal use
 */

import type { DripConditionJson as BaseDripConditionJson } from "./drip-conditions";

export type {
  DripConditionLevel,
  DripConditionBehavior,
  DripConditionRuleType,
  DateBasedParams,
  CompletionBasedParams,
  PrerequisiteParams,
  SequentialParams,
  DripConditionRuleParams,
  DripConditionRule,
  DripConditionTarget,
  DripConditionJson,
} from "./drip-conditions";

export {
  isDateBasedParams,
  isCompletionBasedParams,
  isPrerequisiteParams,
  isSequentialParams,
  PACKAGE_RULE_TYPES,
  DEFAULT_COMPLETION_THRESHOLD,
} from "./drip-conditions";

// Aliases for consistency
export { isPrerequisiteParams as isPrerequisiteBasedParams } from "./drip-conditions";
export { isSequentialParams as isSequentialBasedParams } from "./drip-conditions";

// ============================================================================
// Parse Result Types (not in drip-conditions.ts)
// ============================================================================

/**
 * Validation error for drip conditions
 */
export interface DripConditionValidationError {
  field: string;
  message: string;
}

/**
 * Result of parsing drip condition JSON
 */
export interface DripConditionParseResult {
  success: boolean;
  data?: BaseDripConditionJson | BaseDripConditionJson[] | null;
  errors?: DripConditionValidationError[];
}
