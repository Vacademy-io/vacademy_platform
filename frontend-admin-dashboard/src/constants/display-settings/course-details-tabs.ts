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
