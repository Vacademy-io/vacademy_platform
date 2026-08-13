/**
 * Course-details tabs that stay hidden unless a role's display settings
 * explicitly turn them on. Unlike the other tabs (which default to visible when
 * a role config doesn't mention them), these default to OFF.
 *
 * Shared by the course-details tab strip and the per-role settings UIs so the
 * toggle an admin sees in Settings → Display → Course Details Tabs always
 * matches what the course page actually renders.
 */
export const DEFAULT_HIDDEN_COURSE_DETAILS_TABS = new Set<string>(['CERTIFICATES']);

/**
 * Course-details tabs that only mean anything while the institute-wide
 * OFFLINE_ACCESS_SETTING master switch is on. They keep their own per-role
 * visibility toggle — an admin can hide Downloads for a role even with offline
 * access enabled — but the master switch always wins: with offline access off
 * the tab is force-hidden on the course page AND shown as off (and locked) in
 * Display Settings, without overwriting the role's stored preference. Turning
 * offline access back on restores whatever the role had configured.
 */
export const OFFLINE_GATED_COURSE_DETAILS_TABS = new Set<string>(['DOWNLOADS']);
