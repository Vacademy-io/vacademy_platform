import axios from 'axios';
import {
    DOMAIN_ROUTING_RESOLVE,
    DOMAIN_ROUTING_RESOLVE_BY_INSTITUTE,
    GET_PUBLIC_URL_PUBLIC,
} from '@/constants/urls';
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
    // When this portal's domain maps to a specific sub-org (a white-label SUB-ORG
    // admin portal), this holds that sub-org's own institute id. The backend sets
    // it from `institute_domain_routing.sub_org_id` and additionally overlays the
    // sub-org's logo/name/theme. Login uses it to scope access to the sub-org:
    // only users mapped to this sub-org (or unrestricted parent admins) may log in
    // on this portal. Null/absent for parent or non-sub-org portals.
    subOrgId?: string | null;
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
    // When true, the institute name is stacked below the logo instead of beside
    // it. Default (undefined/false): name sits to the right of the logo.
    stackNameBelowLogo?: boolean | null;
};

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

/**
 * Fallback country picker order used when the institute hasn't configured any.
 * India ('in') is first so an empty/null `commaSeparatedPreferredCountry`
 * defaults phone inputs to India.
 */
export const DEFAULT_PREFERRED_COUNTRIES = ['in', 'us', 'gb', 'au'];

/**
 * Resolves the default selected country and the ordered country-picker list for
 * phone inputs from the institute's configured preferred countries, falling back
 * to {@link DEFAULT_PREFERRED_COUNTRIES} (India default) when nothing is
 * configured. The first entry is the default; the full list orders the picker.
 */
export function getPreferredPhoneCountries(): {
    defaultCountry: string;
    preferredCountries: string[];
} {
    const cached = getCachedPreferredCountries();
    const list = cached.length > 0 ? cached : DEFAULT_PREFERRED_COUNTRIES;
    return { defaultCountry: list[0] ?? 'in', preferredCountries: list };
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

/**
 * Resolve institute branding/theme by a fixed institute id, rather than the
 * request host. Used by native flavors (e.g. Vacademy Admin) whose WebView has
 * no meaningful hostname but which are anchored to one institute.
 *
 * Returns null if the endpoint is unavailable (e.g. not yet deployed) or the
 * institute has no domain-routing config — callers fall back to default
 * branding while still treating the institute id as the selected institute.
 */
export async function resolveInstituteById(
    instituteId: string
): Promise<DomainResolveResponse | null> {
    if (!instituteId) return null;
    try {
        const { data } = await axios.get<DomainResolveResponse>(
            DOMAIN_ROUTING_RESOLVE_BY_INSTITUTE,
            {
                params: { instituteId },
                timeout: 5000,
            }
        );
        return data;
    } catch (_error) {
        return null;
    }
}

/**
 * Resolve institute branding by a FIXED domain + subdomain (not the request
 * host). Used by native flavors (e.g. Vacademy Admin → vacademy.io/admin-app)
 * which have no meaningful WebView hostname but map to a known
 * `institute_domain_routing` row. Uses the same deployed public endpoint as
 * host-based resolution.
 */
export async function resolveInstituteForDomain(
    domain: string,
    subdomain: string
): Promise<DomainResolveResponse | null> {
    if (!domain || !subdomain) return null;
    try {
        const { data } = await axios.get<DomainResolveResponse>(DOMAIN_ROUTING_RESOLVE, {
            params: { domain, subdomain },
            timeout: 5000,
        });
        return data;
    } catch (_error) {
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
    payload: DomainResolveResponse & { instituteLogoUrl?: string; tabIconUrl?: string },
    options?: { setSelectedInstitute?: boolean }
): void {
    // Native flavors that brand by a FIXED institute (e.g. Vacademy Admin → ca3c…)
    // pass setSelectedInstitute:false so the app shows that institute's theme while
    // login still resolves the user's OWN institute. Web (host-based) keeps the
    // default behaviour where the resolved institute IS the working institute.
    const setSelected = options?.setSelectedInstitute !== false;
    try {
        if (instituteId) {
            localStorage.setItem(instituteId, JSON.stringify(payload));
            if (setSelected) {
                localStorage.setItem('selectedInstituteId', instituteId);
            }
        }
        // Always store as current domain branding for robust fallback (drives the
        // app's theme/title/favicon via index.html pre-paint + ThemeProvider).
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
