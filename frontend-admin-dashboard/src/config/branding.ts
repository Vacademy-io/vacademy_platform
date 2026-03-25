export const PRODUCT_NAME = 'Volt';
export const PRODUCT_DESCRIPTION = 'A Live Presentation Platform';

/**
 * Returns the institute-configured AI course creator name.
 * Stored in localStorage by AI Settings page (key: AI_COPILOT_SETTING).
 * Falls back to 'AI' if not configured.
 */
export function getAiProductName(): string {
    try {
        const raw = localStorage.getItem('ai_copilot_setting');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.course_creator_name) return parsed.course_creator_name;
        }
    } catch { /* ignore */ }
    return 'Course AI';
}
