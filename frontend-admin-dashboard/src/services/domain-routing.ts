import axios from 'axios';
import { DOMAIN_ROUTING_RESOLVE, GET_PUBLIC_URL_PUBLIC } from '@/constants/urls';
import { getMainDomain, getSubdomain } from '@/utils/subdomain';

export type DomainResolveResponse = {
    instituteId: string | null;
    instituteName: string;
    instituteLogoFileId?: string;
    instituteThemeCode?: string;
    role?: string;
    redirect?: string;
    privacyPolicyUrl?: string;
    afterLoginRoute?: string;
    termsAndConditionUrl?: string;
    theme?: string;
    tabText?: string;
    allowSignup?: boolean;
    tabIconFileId?: string;
    fontFamily?: string;
    allowGoogleAuth?: boolean;
    allowGithubAuth?: boolean;
    allowEmailOtpAuth?: boolean;
    allowPhoneAuth?: boolean;
    allowUsernamePasswordAuth?: boolean;
    learnerPortalUrl?: string | null;
    instructorPortalUrl?: string | null;
    convertUsernamePasswordToLowercase?: boolean;
    // Comma-separated ISO 3166-1 alpha-2 country codes (e.g. "in,us,gb,au").
    // Drives the default selection and ordering of country options in phone inputs.
    commaSeparatedPreferredCountry?: string | null;
    // When true, the institute name is hidden alongside the logo on the login
    // page and in the sidebar. Default (undefined/false): name is shown.
    hideInstituteName?: boolean | null;
    // Optional pixel overrides for logo sizing. When set, take precedence over
    // the default responsive classes.
    logoWidthPx?: number | null;
    logoHeightPx?: number | null;
};

/**
 * Splits a routing role string (which may be custom like "MANAGE_LEAD" or a
 * comma-separated list like "ADMIN,MANAGE_LEAD,EVALUATOR") into a normalized
 * uppercase array. Empty / whitespace parts are dropped.
 */
export function parseRoutingRoles(role: string | null | undefined): string[] {
    if (!role) return [];
    return role
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter((r) => r.length > 0);
}

/**
 * Returns true when the user's auth roles satisfy the portal's routing role
 * requirement. The check is fully generic — it works for the standard three
 * (LEARNER/ADMIN/TEACHER) and for any custom role configured via white-label
 * settings (e.g. "MANAGE_LEAD") or any comma-separated combination
 * ("ADMIN,MANAGE_LEAD").
 *
 * Semantics: the user passes if AT LEAST ONE of the routing role parts is
 * present in their auth roles. An empty routing role means no restriction.
 */
export function userMatchesRoutingRole(
    routingRole: string | null | undefined,
    userRoles: string[],
): boolean {
    const required = parseRoutingRoles(routingRole);
    if (required.length === 0) return true;
    const userRoleSet = new Set(userRoles.map((r) => r.toUpperCase()));
    return required.some((r) => userRoleSet.has(r));
}

/**
 * Human-friendly display label for a routing role string.
 *
 * "ADMIN"               -> "Admin"
 * "TEACHER"             -> "Teacher"
 * "MANAGE_LEAD"         -> "Manage Lead"
 * "ADMIN,EVALUATOR"     -> "Admin"  (uses the first part)
 * null / empty          -> "Admin"  (safe default)
 *
 * No specific role names are hard-coded here — any value, custom or
 * standard, is rendered by title-casing the first comma-separated part.
 */
export function formatRoutingRoleLabel(role: string | null | undefined): string {
    if (!role) return 'Admin';
    const first = role
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)[0];
    if (!first) return 'Admin';
    return first
        .toLowerCase()
        .split(/[_\s]+/)
        .filter((w) => w.length > 0)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Parses the institute's `commaSeparatedPreferredCountry` (from domain routing)
 * into a normalized lowercase array of ISO 3166-1 alpha-2 country codes.
 * Reads from the cached domain routing branding so callers don't need to refetch.
 */
export function getCachedPreferredCountries(): string[] {
    try {
        const branding = getCachedInstituteBranding();
        const raw = branding?.commaSeparatedPreferredCountry;
        if (!raw) return [];
        return raw
            .split(',')
            .map((code) => code.trim().toLowerCase())
            .filter((code) => code.length > 0);
    } catch {
        return [];
    }
}

export async function resolveInstituteForCurrentHost(): Promise<DomainResolveResponse | null> {
    try {
        const hostname = window.location.hostname;

        const isLocal =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname.endsWith('.localhost');

        let domain: string = hostname;
        let subdomain: string = '*';

        if (isLocal) {
            // admin.localhost -> domain=localhost, subdomain=admin
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
                domain = 'localhost';
                subdomain = '*';
            } else {
                const parts = hostname.split('.');
                subdomain = parts[0] || '*';
                domain = 'localhost';
            }
        } else {
            // Regular domains: derive main domain and subdomain
            domain = getMainDomain() || hostname;
            subdomain = getSubdomain() || '*';
        }

        // Add timeout to prevent indefinite hanging on slow/failing requests
        const { data } = await axios.get<DomainResolveResponse>(DOMAIN_ROUTING_RESOLVE, {
            params: { domain, subdomain },
            timeout: 5000, // 5 second timeout
        });
        return data;
    } catch (_error) {
        // Return null on any error (404, timeout, network failure, etc.)
        // The app will use default branding in this case
        return null;
    }
}

export async function getPublicUrl(fileId?: string | null): Promise<string | null> {
    if (!fileId) return null;
    try {
        const response = await axios.get<string>(GET_PUBLIC_URL_PUBLIC, {
            params: { fileId, expiryDays: 1 },
            timeout: 5000, // 5 second timeout
        });
        return response.data || null;
    } catch (_error) {
        return null;
    }
}

export function cacheInstituteBranding(
    instituteId: string | null | undefined,
    payload: DomainResolveResponse & { instituteLogoUrl?: string; tabIconUrl?: string }
): void {
    try {
        // Store with key as institute id per requirement
        if (instituteId) {
            localStorage.setItem(instituteId, JSON.stringify(payload));
            localStorage.setItem('selectedInstituteId', instituteId);
        }
        // Also store as current domain branding for robust fallback
        localStorage.setItem('current_domain_branding', JSON.stringify(payload));
    } catch (_err) {
        // ignore storage failures
    }
}

export function getCachedInstituteBranding(
    id?: string
): (DomainResolveResponse & { instituteLogoUrl?: string; tabIconUrl?: string }) | null {
    try {
        // 1. Try the specifically requested ID
        if (id) {
            const specific = localStorage.getItem(id);
            if (specific) return JSON.parse(specific);
        }

        // 2. Try the currently selected ID (handling empty string as valid key)
        const selectedId = localStorage.getItem('selectedInstituteId');
        if (selectedId !== null) {
            const selected = localStorage.getItem(selectedId);
            if (selected) return JSON.parse(selected);
        }

        // 3. Fallback to the dedicated current domain key
        const currentDomain = localStorage.getItem('current_domain_branding');
        if (currentDomain) return JSON.parse(currentDomain);

        return null;
    } catch {
        return null;
    }
}
