import { CATALOGUE_EDITOR_CONFIG } from '@/constants/catalogue-editor';

/**
 * Absolute origin of the institute's learner portal.
 *
 * Catalogue sites are served by the learner app, not the admin app, so any
 * "view live site" link must be absolute. A root-relative href resolves against
 * the admin origin (admin.<institute>.com/<tag>), which 404s.
 *
 * Falls back to the shared learner dashboard when the institute has no custom
 * domain configured, and always normalises to an https:// origin —
 * learner_portal_base_url is stored bare ("learner.example.com") in most rows.
 */
export const getLearnerPortalOrigin = (learnerPortalBaseUrl?: string | null): string => {
    const base = (learnerPortalBaseUrl || '').trim() || CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL;
    return base.startsWith('http') ? base.replace(/\/+$/, '') : `https://${base.replace(/\/+$/, '')}`;
};

/** Public URL of one catalogue site, e.g. https://learner.example.com/course-collections */
export const getCatalogueSiteUrl = (
    tagName: string,
    learnerPortalBaseUrl?: string | null,
): string => `${getLearnerPortalOrigin(learnerPortalBaseUrl)}/${encodeURIComponent(tagName)}`;
