import type { DripConditionJson, DripConditionParseResult } from "./types";

/**
 * Parse drip condition JSON string to typed object
 * Handles both single object and array (max 2 targets)
 *
 * API currently returns: {"target":"chapter","behavior":"lock","rules":[...]}
 * Future API may return: [{"target":"chapter",...}, {"target":"slide",...}]
 */
export function parseDripCondition(
  jsonString: string | null | undefined
): DripConditionParseResult {
  if (!jsonString || jsonString.trim() === "") {
    return {
      success: true,
      data: null,
    };
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Handle single object (current API format)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // Validate it has required fields
      if (!parsed.behavior || !Array.isArray(parsed.rules)) {
        return {
          success: false,
          errors: [
            {
              field: "root",
              message: "Drip condition must have behavior and rules array",
            },
          ],
        };
      }

      // Return as-is (matches DripConditionJson interface)
      return {
        success: true,
        data: parsed as DripConditionJson,
      };
    }

    // Handle array format (future API format - max 2 targets)
    // For now, we'll return the first one as we process them separately
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return {
          success: true,
          data: null,
        };
      }

      if (parsed.length > 2) {
        return {
          success: false,
          errors: [
            {
              field: "targets",
              message: "Maximum 2 targets allowed in drip condition array",
            },
          ],
        };
      }

      // Validate each target
      const validationErrors: Array<{ field: string; message: string }> = [];
      parsed.forEach((target, index) => {
        if (!target.behavior || !Array.isArray(target.rules)) {
          validationErrors.push({
            field: `array[${index}]`,
            message: "Each drip condition must have behavior and rules array",
          });
        }
      });

      if (validationErrors.length > 0) {
        return {
          success: false,
          errors: validationErrors,
        };
      }

      // Store the full array - we'll filter by target level later
      // API returns array like: [{target: 'slide', ...}, {target: 'chapter', ...}]
      return {
        success: true,
        data: parsed as DripConditionJson | DripConditionJson[],
      };
    }

    return {
      success: false,
      errors: [
        {
          field: "root",
          message: "Drip condition must be an object or array",
        },
      ],
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: "json",
          message: `Invalid JSON: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
    };
  }
}

/**
 * Get drip condition for a specific target level (chapter or slide)
 * Handles both single condition and array of conditions
 * If the condition has a target field matching the level, return it
 * If no target field (package-level condition), return it for both levels
 * Respects is_enabled flag - only returns enabled conditions
 */
export function getConditionForLevel(
  dripCondition: DripConditionJson | DripConditionJson[] | null,
  level: "chapter" | "slide"
): DripConditionJson | null {
  if (!dripCondition) {
    return null;
  }

  // Handle array of conditions - find the first enabled one matching the target level
  if (Array.isArray(dripCondition)) {
    const matchingCondition = dripCondition.find((condition) => {
      const targetsLevel = condition.target === level || !condition.target;
      const isEnabled = condition.is_enabled !== false;

      return targetsLevel && isEnabled;
    });

    return matchingCondition || null;
  }

  // Handle single condition object
  // Check if disabled
  if (dripCondition.is_enabled === false) {
    return null;
  }

  // If target is specified, only return if it matches
  if (dripCondition.target) {
    const matches = dripCondition.target === level;
    return matches ? dripCondition : null;
  }

  return dripCondition;
}
