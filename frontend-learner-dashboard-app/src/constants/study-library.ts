/**
 * Single source of truth for when a slide (or chapter) counts as "complete"
 * in learner-facing progress UI.
 *
 * Value mirrors the backend default: admin_core_service PackageRepository
 * treats a course as completed when progress >= the institute's
 * COURSE_COMPLETION_SETTING completionThresholdPercentage, falling back to 80.
 *
 * Call sites previously disagreed (80 in some views, 90 in others), so the
 * same slide could show "completed" on the course page but "in progress" in
 * the chapter sidebar. Always import this constant instead of hardcoding.
 */
export const SLIDE_COMPLETION_THRESHOLD = 80;
