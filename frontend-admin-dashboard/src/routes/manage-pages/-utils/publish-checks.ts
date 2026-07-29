/**
 * Pre-publish checks — the "are you sure this is ready?" pass.
 *
 * WHY: the builder happily publishes a broken page without a word, and every
 * failure below shipped to a live institute site during our own field testing:
 * popup buttons with no campaign chosen, template placeholder copy left in,
 * product-page offers pointing nowhere, pages with no meta description, dead
 * nav links. A layman has no way to know any of it happened.
 *
 * These WARN, never block. The admin stays in charge; we just stop silent
 * mistakes from reaching visitors.
 */

export type CheckSeverity = 'error' | 'warning';

export interface PublishIssue {
    severity: CheckSeverity;
    /** Short, plain-language problem statement. */
    title: string;
    /** What to do about it, in the admin's words. */
    fix: string;
    pageId?: string;
    pageName?: string;
    componentId?: string;
}

/** Copy shipped in templates/AI scaffolds that must never reach a visitor. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
    /lorem ipsum/i,
    /\byour (?:institute|company|school) name\b/i,
    /\breplace (?:this|with)\b/i,
    /\bplaceholder\b/i,
    /\bexample\.com\b/i,
    /\bnew program\b/i,
    /\bsecond program\b/i,
    /\bdetail (?:one|two)\b/i,
    /\bwho can join\b/i,
];

const walk = (components: any[], visit: (c: any) => void) => {
    for (const c of components || []) {
        if (!c) continue;
        visit(c);
        const slots = c?.props?.slots;
        if (Array.isArray(slots)) {
            for (const slot of slots) if (Array.isArray(slot)) walk(slot, visit);
        }
    }
};

/** Collect every string value in a props tree, for placeholder scanning. */
const collectStrings = (node: any, out: string[], depth = 0) => {
    if (depth > 6 || node == null) return;
    if (typeof node === 'string') {
        out.push(node);
    } else if (Array.isArray(node)) {
        for (const v of node) collectStrings(v, out, depth + 1);
    } else if (typeof node === 'object') {
        for (const v of Object.values(node)) collectStrings(v, out, depth + 1);
    }
};

export const runPublishChecks = (config: any): PublishIssue[] => {
    const issues: PublishIssue[] = [];
    const pages: any[] = config?.pages || [];
    const routes = new Set(
        pages.map((p) => String(p?.route || '').replace(/^\//, '').toLowerCase()),
    );

    for (const page of pages) {
        const pageName = page?.title || page?.route || 'Untitled page';
        const ctx = { pageId: page?.id, pageName };

        // SEO — the fields exist and are now actually served to crawlers.
        if (!page?.seo?.metaDescription?.trim()) {
            issues.push({
                severity: 'warning',
                title: `“${pageName}” has no meta description`,
                fix: 'Add one in Properties → SEO. It becomes the text under your link on Google and in WhatsApp previews.',
                ...ctx,
            });
        }

        walk(page?.components || [], (c) => {
            const p = c?.props || {};
            const cctx = { ...ctx, componentId: c?.id };

            // Capture surfaces wired to nothing.
            const wantsForm =
                p.action === 'openForm' || p.button?.action === 'openForm';
            const formAudience = String(p.audienceId || p.button?.audienceId || '').trim();
            if (wantsForm && !formAudience) {
                issues.push({
                    severity: 'error',
                    title: 'A button opens a form but no campaign is selected',
                    fix: 'Pick a campaign for it, or change the button back to a link. Right now it does nothing when tapped.',
                    ...cctx,
                });
            }
            if (c?.type === 'leadForm' && !String(p.audienceId || '').trim()) {
                issues.push({
                    severity: 'error',
                    title: 'A Lead Form section has no campaign selected',
                    fix: 'Choose a campaign so its fields render — the section is invisible to visitors until then.',
                    ...cctx,
                });
            }
            if (c?.type === 'productPageOffer' && !String(p.productPageCode || '').trim()) {
                issues.push({
                    severity: 'error',
                    title: 'A course section has no product page selected',
                    fix: 'Pick a product page in its properties, or remove the section. It is hidden from visitors as-is.',
                    ...cctx,
                });
            }

            // Header/footer nav pointing at pages that do not exist.
            for (const link of [...(p.navLinks || []), ...(p.authLinks || [])]) {
                const raw = String(link?.route || '').replace(/^\//, '').toLowerCase();
                if (!raw) continue;
                if (/^(https?:|mailto:|tel:|#)/.test(raw)) continue;
                if (['login', 'signup', 'get-started', 'getstarted'].includes(raw)) continue;
                if (String(link?.audienceId || '').trim()) continue;
                if (!routes.has(raw)) {
                    issues.push({
                        severity: 'warning',
                        title: `Menu link “${link?.label || raw}” points to a page that doesn’t exist`,
                        fix: `Nothing on this site has the address “${raw}”. Fix the link or create that page.`,
                        ...cctx,
                    });
                }
            }

            // Template/AI placeholder copy left behind.
            const strings: string[] = [];
            collectStrings(p, strings);
            const hit = strings.find((s) =>
                s.length < 400 && PLACEHOLDER_PATTERNS.some((re) => re.test(s)),
            );
            if (hit) {
                issues.push({
                    severity: 'warning',
                    title: 'Placeholder text is still on the page',
                    fix: `“${hit.slice(0, 60)}${hit.length > 60 ? '…' : ''}” looks like sample copy. Replace it with your own words.`,
                    ...cctx,
                });
            }
        });
    }

    // Site-wide: measurement is the difference between a website and a
    // marketing asset, so nudge once (never per page).
    const t = config?.globalSettings?.tracking || {};
    if (!t.ga4MeasurementId && !t.metaPixelId && !t.gtmId) {
        issues.push({
            severity: 'warning',
            title: 'No analytics connected',
            fix: 'Add a Google Analytics or Meta Pixel ID in Global Settings → Tracking to see where your enquiries come from.',
        });
    }

    // Errors first, then warnings; stable within group.
    return issues.sort((a, b) =>
        a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
    );
};
