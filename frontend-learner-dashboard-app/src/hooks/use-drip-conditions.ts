import { useMemo } from "react";
import type {
  DripConditionJson,
  LearnerProgressData,
  DripConditionEvaluation,
} from "@/utils/drip-conditions";
import {
  parseDripCondition,
  getConditionForLevel,
  evaluateDripCondition,
  evaluateMultipleConditions,
  countLockedAndHidden,
} from "@/utils/drip-conditions";

/**
 * Hook to parse and evaluate drip conditions
 */
export function useDripConditions(
  dripConditionJson: string | null | undefined,
  level: "chapter" | "slide"
) {
  // Parse the JSON string
  const parseResult = useMemo(() => {
    const result = parseDripCondition(dripConditionJson);

    return result;
  }, [dripConditionJson, level]);

  // Get condition for the specific level
  const condition = useMemo(() => {
    if (!parseResult.success || !parseResult.data) {
      return null;
    }

    const levelCondition = getConditionForLevel(parseResult.data, level);

    return levelCondition;
  }, [parseResult, level]);

  return {
    /** Whether parsing was successful */
    isValid: parseResult.success,
    /** Parsing errors if any */
    errors: parseResult.success ? null : parseResult.errors,
    /** Parsed drip condition data */
    dripCondition: parseResult.success ? parseResult.data : null,
    /** Condition for the specified level */
    condition,
    /** Whether drip conditions are active for this level */
    hasConditions: condition !== null,
  };
}

/**
 * Hook to evaluate drip conditions for a single item
 */
export function useEvaluateDripCondition(
  condition: DripConditionJson | null,
  progressData: LearnerProgressData
): DripConditionEvaluation {
  return useMemo(() => {
    return evaluateDripCondition(condition, progressData);
  }, [condition, progressData]);
}

/**
 * Hook to evaluate drip conditions for multiple items
 */
export function useEvaluateMultipleDripConditions(
  condition: DripConditionJson | null,
  progressDataByItemId: Record<string, LearnerProgressData>
): {
  evaluations: Record<string, DripConditionEvaluation>;
  counts: { locked: number; hidden: number; accessible: number };
} {
  const evaluations = useMemo(() => {
    return evaluateMultipleConditions(condition, progressDataByItemId);
  }, [condition, progressDataByItemId]);

  const counts = useMemo(() => {
    return countLockedAndHidden(evaluations);
  }, [evaluations]);

  return { evaluations, counts };
}

/**
 * Hook to build progress data from chapter/slide data
 */
export function useBuildProgressData(
  items: Array<{
    id: string;
    percentage_completed?: number;
  }>,
  options?: {
    /** IDs of prerequisite items (for prerequisite-based rules) */
    prerequisiteIds?: string[];
    /** Recent quiz scores (for completion-based rules) */
    recentScores?: number[];
  }
): Record<string, LearnerProgressData> {
  return useMemo(() => {
    const progressDataByItemId: Record<string, LearnerProgressData> = {};

    items.forEach((item, index) => {
      const previousItem = index > 0 ? items[index - 1] : null;

      progressDataByItemId[item.id] = {
        percentageCompleted: item.percentage_completed || 0,
        recentScores: options?.recentScores || [],
        completedPrerequisiteIds: options?.prerequisiteIds || [],
        prerequisiteCompletions: items.reduce((acc, prereqItem) => {
          acc[prereqItem.id] = prereqItem.percentage_completed || 0;
          return acc;
        }, {} as Record<string, number>),
        previousItemId: previousItem?.id,
        previousItemCompletion: previousItem?.percentage_completed || 0,
      };
    });

    return progressDataByItemId;
  }, [items, options?.prerequisiteIds, options?.recentScores]);
}
