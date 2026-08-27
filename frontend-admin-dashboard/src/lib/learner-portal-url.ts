import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

/**
 * Canonical resolver for "which learner URL do we hand out to a human?".
 *
 * Every shareable link an admin copies — assessment join links, QR codes,
 * catalogue sites, campaign forms, invite links — must sit on the institute's
 * OWN learner domain. A link built on the shared learner.vacademy.io fallback
 * leaks Vacademy branding twice over: the domain itself is visible in the
 * message, and when WhatsApp unfurls it the og:image resolves to Vacademy's
 * branding instead of the institute's (link previews are branded by hostname —
 * see functions/_middleware.ts).
 *
 * This logic used to be copy-pasted inline at a dozen call sites, and roughly
 * half of them forgot the `learner_portal_base_url` lookup entirely and shipped
 * the hardcoded fallback. Import this instead of reaching for
 * BASE_URL_LEARNER_DASHBOARD directly.
 *
 * `learner_portal_base_url` is stored bare ("students.zoeedtech.com") in most
 * rows, so the scheme is normalised here and trailing slashes are stripped.
 */
export const getLearnerPortalOrigin = (learnerPortalBaseUrl?: string | null): string => {
    const base = (learnerPortalBaseUrl || '').trim() || BASE_URL_LEARNER_DASHBOARD;
    const trimmed = base.replace(/\/+$/, '');
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

/**
 * Absolute learner-portal URL for a path, on the institute's own domain.
 * `path` may be given with or without a leading slash.
 */
export const getLearnerPortalUrl = (path: string, learnerPortalBaseUrl?: string | null): string => {
    const origin = getLearnerPortalOrigin(learnerPortalBaseUrl);
    if (!path) return origin;
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Shareable link a learner uses to join an assessment by code. */
export const getAssessmentJoinUrl = (
    assessmentCode: string | null | undefined,
    learnerPortalBaseUrl?: string | null
): string =>
    getLearnerPortalUrl(
        `/register?code=${encodeURIComponent(assessmentCode || '')}`,
        learnerPortalBaseUrl
    );
