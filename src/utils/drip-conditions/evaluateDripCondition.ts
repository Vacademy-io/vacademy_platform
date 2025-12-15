import type {
  DripConditionJson,
  DripConditionRule,
  DateBasedParams,
  CompletionBasedParams,
  PrerequisiteParams,
  SequentialParams,
} from "./types";
import {
  isDateBasedParams,
  isCompletionBasedParams,
  isPrerequisiteBasedParams,
  isSequentialBasedParams,
} from "./types";

/**
 * Learner progress data for evaluating drip conditions
 */
export interface LearnerProgressData {
  /** Percentage completed for current item (0-100) */
  percentageCompleted: number;
  /** Array of recent quiz/assessment scores for average calculation */
  recentScores?: number[];
  /** IDs of completed prerequisite chapters/slides */
  completedPrerequisiteIds?: string[];
  /** Percentage completion of prerequisite items (keyed by ID) */
  prerequisiteCompletions?: Record<string, number>;
  /** ID of the previous item in sequence */
  previousItemId?: string;
  /** Percentage completion of the previous item */
  previousItemCompletion?: number;
  /** Zero-based index of current item in the list (for count-based exceptions) */
  itemIndex?: number;
}

/**
 * Result of drip condition evaluation
 */
export interface DripConditionEvaluation {
  /** Whether content is locked (show with lock icon) */
  isLocked: boolean;
  /** Whether content is hidden (don't show at all) */
  isHidden: boolean;
  /** Human-readable message explaining unlock requirements */
  unlockMessage: string | null;
  /** Detailed reason for lock/hide (for debugging) */
  reason?: string;
}

/**
 * Evaluate a single drip condition rule
 */
function evaluateRule(
  rule: DripConditionRule,
  progressData: LearnerProgressData,
  currentDate: Date = new Date()
): { passed: boolean; message?: string } {
  const { type, params } = rule;

  switch (type) {
    case "date_based": {
      if (!isDateBasedParams(params)) {
        return { passed: true, message: "Invalid date params" };
      }
      // Parse the unlock date from UTC (as stored in backend)
      const unlockDateUTC = new Date((params as DateBasedParams).unlock_date);

      // Current date is already in user's local timezone
      // Compare directly - JavaScript Date objects handle timezone internally
      const isPassed = currentDate >= unlockDateUTC;

      // Format unlock date in user's local timezone for display
      const unlockDateFormatted = unlockDateUTC.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        passed: isPassed,
        message: isPassed ? undefined : `Available from ${unlockDateFormatted}`,
      };
    }

    case "completion_based": {
      if (!isCompletionBasedParams(params)) {
        return { passed: true, message: "Invalid completion params" };
      }
      const completionParams = params as CompletionBasedParams;
      const { metric, threshold, count } = completionParams;

      if (metric === "average_of_last_n") {
        const scores = progressData.recentScores || [];
        const requiredCount = count || 1;
        if (scores.length < requiredCount) {
          return {
            passed: false,
            message: `Complete ${requiredCount} more slides/chapters to unlock`,
          };
        }
        const lastNScores = scores.slice(-requiredCount);
        const average =
          lastNScores.reduce((sum, score) => sum + score, 0) /
          lastNScores.length;
        const isPassed = average >= threshold;
        return {
          passed: isPassed,
          message: isPassed
            ? undefined
            : `Score average of ${threshold}% needed (current: ${Math.round(
                average
              )}%)`,
        };
      }

      return { passed: true };
    }

    case "prerequisite": {
      if (!isPrerequisiteBasedParams(params)) {
        return { passed: true, message: "Invalid prerequisite params" };
      }
      const prereqParams = params as PrerequisiteParams;
      const { required_chapters, required_slides, threshold } = prereqParams;

      // Combine required items
      const prerequisiteIds = [
        ...(required_chapters || []),
        ...(required_slides || []),
      ];

      const completedCount = prerequisiteIds.filter((id: string) => {
        const completion = progressData.prerequisiteCompletions?.[id] || 0;
        const isComplete = completion >= threshold;

        return isComplete;
      }).length;

      const isPassed = completedCount === prerequisiteIds.length;
      return {
        passed: isPassed,
        message: isPassed
          ? undefined
          : `Complete ${
              prerequisiteIds.length - completedCount
            } prerequisite(s) with ${threshold}% completion`,
      };
    }

    case "sequential": {
      if (!isSequentialBasedParams(params)) {
        return { passed: true, message: "Invalid sequential params" };
      }
      const seqParams = params as SequentialParams;
      const { threshold } = seqParams;

      const previousCompletion = progressData.previousItemCompletion || 0;
      const isPassed = previousCompletion >= threshold;
      return {
        passed: isPassed,
        message: isPassed
          ? undefined
          : `Complete previous item with ${threshold}% (current: ${previousCompletion}%)`,
      };
    }

    default:
      return { passed: true };
  }
}

/**
 * Evaluate drip condition for a specific item
 */
export function evaluateDripCondition(
  condition: DripConditionJson | null,
  progressData: LearnerProgressData,
  currentDate: Date = new Date()
): DripConditionEvaluation {
  // No drip condition = fully accessible
  if (!condition || !condition.rules || condition.rules.length === 0) {
    return {
      isLocked: false,
      isHidden: false,
      unlockMessage: null,
    };
  }

  // Check if condition is disabled via is_enabled flag
  if (condition.is_enabled === false) {
    return {
      isLocked: false,
      isHidden: false,
      unlockMessage: null,
    };
  }

  // EXCEPTION: First item (index 0) is ALWAYS accessible
  // Users need at least one item to start with
  const itemIndex = progressData.itemIndex ?? 0;
  if (itemIndex === 0) {
    return {
      isLocked: false,
      isHidden: false,
      unlockMessage: null,
    };
  }

  // Check for count-based exception: if rule has average_of_last_n with count N,
  // first N items should be accessible (they need to be completed to unlock further items)
  const completionRule = condition.rules.find(
    (r) =>
      r.type === "completion_based" &&
      isCompletionBasedParams(r.params) &&
      (r.params as CompletionBasedParams).metric === "average_of_last_n"
  );

  if (completionRule && isCompletionBasedParams(completionRule.params)) {
    const count = (completionRule.params as CompletionBasedParams).count || 1;

    // First N items are always accessible (needed to calculate average)
    if (itemIndex < count) {
      return {
        isLocked: false,
        isHidden: false,
        unlockMessage: null,
      };
    }
  }

  // Evaluate all rules (AND logic - all must pass)
  const failedRules: string[] = [];
  for (const rule of condition.rules) {
    const result = evaluateRule(rule, progressData, currentDate);
    if (!result.passed && result.message) {
      failedRules.push(result.message);
    }
  }

  // All rules passed = accessible
  if (failedRules.length === 0) {
    return {
      isLocked: false,
      isHidden: false,
      unlockMessage: null,
    };
  }

  // Some rules failed = apply behavior
  const unlockMessage = failedRules.join("; ");
  const { behavior } = condition;

  switch (behavior) {
    case "lock":
      return {
        isLocked: true,
        isHidden: false,
        unlockMessage,
        reason: "Rules not met, content locked",
      };

    case "hide":
      return {
        isLocked: false,
        isHidden: true,
        unlockMessage,
        reason: "Rules not met, content hidden",
      };

    case "both":
      return {
        isLocked: true,
        isHidden: true,
        unlockMessage,
        reason: "Rules not met, content locked and hidden",
      };

    default:
      return {
        isLocked: false,
        isHidden: false,
        unlockMessage: null,
      };
  }
}

/**
 * Evaluate multiple conditions (for batch evaluation)
 */
export function evaluateMultipleConditions(
  condition: DripConditionJson | null,
  progressDataByItemId: Record<string, LearnerProgressData>,
  currentDate: Date = new Date()
): Record<string, DripConditionEvaluation> {
  const results: Record<string, DripConditionEvaluation> = {};

  for (const [itemId, progressData] of Object.entries(progressDataByItemId)) {
    results[itemId] = evaluateDripCondition(
      condition,
      progressData,
      currentDate
    );
  }

  return results;
}

/**
 * Count locked and hidden items
 */
export function countLockedAndHidden(
  evaluations: Record<string, DripConditionEvaluation>
): { locked: number; hidden: number; accessible: number } {
  let locked = 0;
  let hidden = 0;
  let accessible = 0;

  for (const evaluation of Object.values(evaluations)) {
    if (evaluation.isHidden) {
      hidden++;
    } else if (evaluation.isLocked) {
      locked++;
    } else {
      accessible++;
    }
  }

  return { locked, hidden, accessible };
}
