/**
 * Chatbot Route Configuration
 * 
 * This file acts as the central source of truth for where the chatbot should be displayed.
 * It allows for both "allowlist" (explicitly enable) and "blocklist" (explicitly disable) validation.
 */

// Routes where the chatbot is explicitly DISABLED
// These are exact match or startWith patterns
export const CHATBOT_DISABLED_ROUTES = [
  "/", // Home/Landing
  "/login",
  "/signup",
  "/register",
  "/privacy-policy",
  "/terms-and-conditions",
  "/referral",
  "/live-class-guest",
  "/institute-selection",
  "/delete-user",
  "/change-password",
  "/logout",
  "/dashboard",
  "/learner-invitation-response",
  "/payment-result",
  "/audience-response",
  // Add other routes here to hide the chatbot
  // "/dashboard", // Example: uncomment to hide on dashboard
];

// Routes where the chatbot is explicitly ENABLED
// If this list is non-empty, ONLY routes matching these patterns will show the chatbot
// If this list is empty, all routes NOT in DISABLED_ROUTES will show the chatbot
export const CHATBOT_ENABLED_ROUTES: string[] = [
  // Example: 
  // "/slides",
  // "/courses"
];

/**
 * Checks if the chatbot should be visible on a given path
 * @param pathname The current route path
 * @returns boolean
 */
export const isChatbotVisibleOnRoute = (pathname: string): boolean => {
  // 1. First check if it's explicitly disabled (Blocklist)
  // We check for exact matches for root ("/") or startsWith for sub-routes
  const isDisabled = CHATBOT_DISABLED_ROUTES.some(route => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  });

  if (isDisabled) return false;

  // 2. If valid enabled routes are defined, check against them (Allowlist)
  // If no specific enabled routes are defined, we default to ALLOW ALL (except disabled ones)
  if (CHATBOT_ENABLED_ROUTES.length > 0) {
    const isExplicitlyEnabled = CHATBOT_ENABLED_ROUTES.some(route => 
      pathname.startsWith(route)
    );
    return isExplicitlyEnabled;
  }

  // 3. Default behavior: Visible on all logged-in routes not explicitly disabled
  return true;
};
