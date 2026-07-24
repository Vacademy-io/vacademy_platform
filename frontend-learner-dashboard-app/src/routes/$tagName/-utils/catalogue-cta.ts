/**
 * Helpers for the hardcoded mobile bottom-bar CTAs (Login / Get Started).
 *
 * The desktop header renders its auth buttons from the catalogue's configured
 * `authLinks`, so removing "Get Started" there is a pure config change. The mobile
 * bottom bar historically hardcoded the same buttons, which meant a catalogue that
 * dropped "Get Started" from its header still showed it on mobile. These helpers let
 * the mobile bar mirror the same `authLinks` config so both stay consistent.
 */

type AuthLink = { label?: string; route?: string };

const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Resolve the auth links for the header the learner actually sees on a page: the
 * page's own header component if it has one, else the global header template.
 * Returns [] when the catalogue defines no auth links at all.
 */
export function resolveHeaderAuthLinks(catalogueData: any, pageSlug?: string): AuthLink[] {
    const pages: any[] = catalogueData?.pages || [];
    const page = pages.find((p) =>
        pageSlug
            ? p?.route === pageSlug || p?.route === `/${pageSlug}`
            : p?.id === 'home' || p?.route === 'homepage' || p?.route === '/' || p?.route === ''
    );
    const pageHeader = page?.components?.find((c: any) => c?.type === 'header');
    const links =
        pageHeader?.props?.authLinks ??
        catalogueData?.globalSettings?.layout?.header?.props?.authLinks;
    return Array.isArray(links) ? links : [];
}

/**
 * Whether the mobile "Get Started" CTA should render. It mirrors the header config:
 * shown only when the header advertises a "Get Started" (or signup / lead-form) auth
 * link. When a catalogue defines NO auth links at all, the legacy behaviour is kept
 * (show it) so default-config institutes are unaffected.
 */
export function shouldShowMobileGetStarted(catalogueData: any, pageSlug?: string): boolean {
    const links = resolveHeaderAuthLinks(catalogueData, pageSlug);
    if (links.length === 0) return true; // no authLinks configured → legacy default
    return links.some((l) => {
        const r = norm(l.route);
        const label = norm(l.label);
        return r === 'getstarted' || label === 'getstarted' || r === 'signup';
    });
}
