/**
 * IANA timezone normalization.
 *
 * Prod Postgres (16.14, Ubuntu 26.04 build) ships a tzdata that DROPPED the legacy
 * `Asia/Calcutta` alias — only `Asia/Kolkata` resolves. Any zone string that reaches
 * `AT TIME ZONE` unrecognised raises `time zone "..." not recognized`, and because the
 * live-session queries splice the value into SQL rather than filtering per row, a single
 * bad value aborts the WHOLE query. One poisoned `live_session.timezone` row took down
 * `LIVE_SESSION_START` dispatch for every institute on 2026-08-14.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` still returns the legacy alias on
 * older Android/ICU builds, so the browser value must never be sent raw. The common
 * `?? 'Asia/Kolkata'` guard does NOT help — the alias is a non-empty string, so it
 * sails straight through.
 *
 * Everything that sends a zone to the backend goes through {@link normalizeTimezone}.
 */

/**
 * Legacy IANA aliases → their canonical names, plus typos observed in prod data.
 * Keep keys lowercased; lookup is case-insensitive.
 */
const TIMEZONE_ALIASES: Record<string, string> = {
    // Legacy aliases still emitted by older ICU/browser builds. Every entry here was
    // verified absent from prod's `pg_timezone_names` — do NOT add a name Postgres already
    // accepts (e.g. Australia/Canberra, Asia/Tel_Aviv, Europe/Nicosia, Europe/Belfast),
    // because rewriting a working zone silently overrides the admin's stated choice.
    'asia/calcutta': 'Asia/Kolkata',
    'asia/saigon': 'Asia/Ho_Chi_Minh',
    'asia/rangoon': 'Asia/Yangon',
    'asia/katmandu': 'Asia/Kathmandu',
    'europe/kiev': 'Europe/Kyiv',
    'america/buenos_aires': 'America/Argentina/Buenos_Aires',
    // Typos found in live_session rows during the 2026-08-14 incident.
    'asia/culcutta': 'Asia/Kolkata',
    'europ/london': 'Europe/London',
};

/** Used when the incoming value is missing, malformed, or unresolvable. */
export const FALLBACK_TIMEZONE = 'Asia/Kolkata';

/**
 * True if the runtime can actually resolve `zone` as an IANA timezone.
 *
 * `Intl.DateTimeFormat` throws `RangeError` on an unknown zone, which is the only
 * portable validity check available in the browser.
 */
export function isValidTimezone(zone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

/**
 * Canonicalise a timezone string into something Postgres will accept.
 *
 * Strips surrounding quotes (prod rows exist with a literal `'Europe/London'`, quotes
 * included, from a bad seed import), maps known legacy aliases and typos, then verifies
 * the result actually resolves. Anything still unresolvable falls back rather than being
 * forwarded to the backend, because an unrecognised zone is a 500-level failure there,
 * not a cosmetic one.
 *
 * @param zone     Raw value — browser-detected, user-selected, or server-provided.
 * @param fallback Returned when `zone` is absent or cannot be resolved.
 */
export function normalizeTimezone(
    zone: string | null | undefined,
    fallback: string = FALLBACK_TIMEZONE
): string {
    if (!zone) return fallback;

    const cleaned = zone.trim().replace(/^['"]+|['"]+$/g, '');
    if (!cleaned) return fallback;

    const canonical = TIMEZONE_ALIASES[cleaned.toLowerCase()] ?? cleaned;

    return isValidTimezone(canonical) ? canonical : fallback;
}

/**
 * The browser's timezone, normalized and guaranteed resolvable.
 *
 * Prefer this over reading `Intl.DateTimeFormat().resolvedOptions().timeZone` directly —
 * that returns `Asia/Calcutta` on affected runtimes, which the backend rejects.
 */
export function getBrowserTimezone(fallback: string = FALLBACK_TIMEZONE): string {
    try {
        return normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, fallback);
    } catch {
        return fallback;
    }
}

/**
 * Browser timezone for callers that would rather send nothing than a guess.
 *
 * Returns `undefined` when the zone cannot be resolved, letting the backend apply its own
 * default instead of receiving a value that would blow up its query.
 */
export function getBrowserTimezoneOrUndefined(): string | undefined {
    try {
        const normalized = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, '');
        return normalized || undefined;
    } catch {
        return undefined;
    }
}
