/**
 * Zoho Meeting SDK CDN script URL.
 * NOTE: Verify this URL against Zoho's latest developer documentation:
 *       https://www.zoho.com/meeting/developer/
 */
export const ZOHO_MEETING_SDK_URL =
    "https://static.zohocdn.com/meeting/js/v1/ZohoMeeting.js";

/** Global variable name that Zoho SDK exposes on window */
export const ZOHO_MEETING_SDK_GLOBAL = "ZohoMeeting";

/** How long (ms) to wait for the SDK to become available after script load */
export const ZOHO_SDK_INIT_TIMEOUT_MS = 10_000;
