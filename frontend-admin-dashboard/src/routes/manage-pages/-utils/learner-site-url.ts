import { getLearnerPortalOrigin } from '@/lib/learner-portal-url';

/**
 * Absolute origin of the institute's learner portal.
 *
 * Catalogue sites are served by the learner app, not the admin app, so any
 * "view live site" link must be absolute. A root-relative href resolves against
 * the admin origin (admin.<institute>.com/<tag>), which 404s.
 *
 * Re-exported from the shared resolver so catalogue links and every other
 * shareable learner link stay on one implementation.
 */
export { getLearnerPortalOrigin };

/** Public URL of one catalogue site, e.g. https://learner.example.com/course-collections */
export const getCatalogueSiteUrl = (
    tagName: string,
    learnerPortalBaseUrl?: string | null
): string => `${getLearnerPortalOrigin(learnerPortalBaseUrl)}/${encodeURIComponent(tagName)}`;
