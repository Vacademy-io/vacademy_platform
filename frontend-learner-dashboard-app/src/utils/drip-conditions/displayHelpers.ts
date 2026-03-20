import type { DripConditionJson, DripConditionBehavior } from "./types";

/**
 * Format unlock requirements for display to user
 */
export function formatUnlockMessage(unlockMessage: string | null): string {
  if (!unlockMessage) {
    return "";
  }

  // Clean up and format the message
  return unlockMessage
    .split(";")
    .map((msg) => msg.trim())
    .filter(Boolean)
    .join(" • ");
}

/**
 * Get a short summary of drip condition rules
 */
export function getDripConditionSummary(
  condition: DripConditionJson | null
): string {
  if (!condition || !condition.rules || condition.rules.length === 0) {
    return "No restrictions";
  }

  const ruleCount = condition.rules.length;
  const ruleTypes = condition.rules.map((rule) => {
    switch (rule.type) {
      case "date_based":
        return "date";
      case "completion_based":
        return "performance";
      case "prerequisite":
        return "prerequisites";
      case "sequential":
        return "sequence";
      default:
        return "custom";
    }
  });

  if (ruleCount === 1) {
    return `${ruleTypes[0]}-based unlock`;
  }

  return `${ruleCount} unlock conditions`;
}

/**
 * Format behavior for display
 */
export function formatBehavior(behavior: DripConditionBehavior): string {
  switch (behavior) {
    case "lock":
      return "Locked";
    case "hide":
      return "Hidden";
    case "both":
      return "Locked & Hidden";
    default:
      return "Restricted";
  }
}
