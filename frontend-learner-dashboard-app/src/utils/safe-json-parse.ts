/**
 * Safely parses JSON from Capacitor Preferences values
 * Handles cases where the value might be the string "undefined" or other invalid JSON
 */
export const safeJsonParse = <T = any>(value: string | null | undefined): T | null => {
  // Check if value exists and is not the string "undefined" or "null"
  if (!value || value === "undefined" || value === "null") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error, "Value:", value);
    return null;
  }
};