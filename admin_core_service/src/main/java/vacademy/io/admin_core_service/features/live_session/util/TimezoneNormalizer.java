package vacademy.io.admin_core_service.features.live_session.util;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Map;

/**
 * Canonicalises IANA timezone strings before they are persisted to
 * {@code live_session.timezone}.
 *
 * <p><b>Why this must run on write, not read.</b> The live-session queries splice the
 * column straight into SQL:
 *
 * <pre>{@code CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')}</pre>
 *
 * The {@code COALESCE} only guards NULL/empty — a non-empty but unresolvable value passes
 * through and makes Postgres raise {@code time zone "..." not recognized}, which aborts the
 * <b>entire query</b> rather than skipping the offending row. Worse,
 * {@link vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository#findStartedInLastMinutes(int)}
 * has no institute filter, so one bad row silently stops {@code LIVE_SESSION_START} dispatch
 * for every institute. That is exactly what happened on 2026-08-14.
 *
 * <p>Prod Postgres (16.14, Ubuntu 26.04 build) ships a tzdata that dropped the legacy
 * {@code Asia/Calcutta} alias, and older browser/ICU builds still report it — so the value
 * cannot be trusted just because a client sent it. Normalizing at the single write point is
 * cheaper and safer than making every read query defensive.
 *
 * <p>Note that the JVM's own {@link ZoneId} still accepts {@code Asia/Calcutta} via its alias
 * table, so {@code ZoneId.of} alone is NOT a sufficient check — the alias must be rewritten
 * explicitly before validation.
 */
public final class TimezoneNormalizer {

    /** Fallback applied when a value is absent or cannot be resolved at all. */
    public static final String DEFAULT_TIMEZONE = "Asia/Kolkata";

    /**
     * Legacy IANA aliases Postgres no longer resolves, plus typos observed in prod rows.
     * Keys are lowercased; lookup is case-insensitive.
     *
     * <p>Every entry was verified absent from prod's {@code pg_timezone_names}. Do NOT add a
     * name Postgres already accepts (e.g. {@code Australia/Canberra}, {@code Asia/Tel_Aviv},
     * {@code Europe/Nicosia}, {@code Europe/Belfast}) — rewriting a working zone silently
     * overrides the admin's stated choice instead of fixing a failure.
     */
    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("asia/calcutta", "Asia/Kolkata"),
            Map.entry("asia/saigon", "Asia/Ho_Chi_Minh"),
            Map.entry("asia/rangoon", "Asia/Yangon"),
            Map.entry("asia/katmandu", "Asia/Kathmandu"),
            Map.entry("europe/kiev", "Europe/Kyiv"),
            Map.entry("america/buenos_aires", "America/Argentina/Buenos_Aires"),
            // Typos found in live_session during the 2026-08-14 incident.
            Map.entry("asia/culcutta", "Asia/Kolkata"),
            Map.entry("europ/london", "Europe/London"));

    private TimezoneNormalizer() {
    }

    /**
     * Canonicalise {@code raw} into a zone Postgres will accept, falling back to
     * {@link #DEFAULT_TIMEZONE}.
     *
     * <p>Strips surrounding quotes — prod rows exist with a literal {@code 'Europe/London'},
     * quotes included, from a bad seed import — then rewrites known aliases and validates.
     *
     * @param raw client-supplied or stored zone; may be null, blank, quoted, or misspelled
     * @return a zone guaranteed to resolve, never null
     */
    public static String normalize(String raw) {
        return normalize(raw, DEFAULT_TIMEZONE);
    }

    /**
     * Canonicalise {@code raw}, falling back to {@code fallback} when it cannot be resolved.
     *
     * @param fallback used verbatim when {@code raw} is unusable; callers are responsible for
     *                 passing a zone that is itself valid
     */
    public static String normalize(String raw, String fallback) {
        if (raw == null) {
            return fallback;
        }

        String cleaned = raw.trim().replaceAll("^['\"]+|['\"]+$", "");
        if (cleaned.isEmpty()) {
            return fallback;
        }

        String canonical = ALIASES.getOrDefault(cleaned.toLowerCase(), cleaned);

        return isResolvable(canonical) ? canonical : fallback;
    }

    /**
     * Like {@link #normalize(String)}, but leaves a blank value blank instead of defaulting it.
     *
     * <p>For persistence, this is the safer entry point: the read queries already treat blank as
     * "unset" via {@code NULLIF(s.timezone, '')}, so substituting a concrete zone would change
     * the column's meaning rather than repair a failure. The guarantee callers get is narrow and
     * deliberate — <b>only values Postgres would reject are altered</b>.
     *
     * @return the original value when blank, otherwise a zone guaranteed to resolve
     */
    public static String normalizePreservingBlank(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return raw;
        }
        return normalize(raw);
    }

    /**
     * Whether the JVM can resolve {@code zone} as a region-based zone.
     *
     * <p>Rejects aliases the JVM tolerates but Postgres does not, so the two stay in agreement.
     */
    public static boolean isResolvable(String zone) {
        if (zone == null || zone.isBlank()) {
            return false;
        }
        if (ALIASES.containsKey(zone.toLowerCase())) {
            // A known-legacy name: valid to the JVM, rejected by Postgres. Treat as unresolvable
            // so callers rewrite it rather than storing it.
            return false;
        }
        try {
            ZoneId.of(zone);
            return true;
        } catch (DateTimeException e) {
            return false;
        }
    }
}
