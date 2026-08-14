package vacademy.io.admin_core_service.features.live_session.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TimezoneNormalizerTest {

    @Test
    @DisplayName("rewrites the legacy alias prod Postgres no longer resolves")
    void rewritesCalcuttaAlias() {
        // The 2026-08-14 outage: older ICU clients send this, PG 16.14 rejects it.
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalize("Asia/Calcutta"));
    }

    @Test
    @DisplayName("rewrites other legacy IANA aliases")
    void rewritesOtherAliases() {
        assertEquals("Asia/Ho_Chi_Minh", TimezoneNormalizer.normalize("Asia/Saigon"));
        assertEquals("Europe/Kyiv", TimezoneNormalizer.normalize("Europe/Kiev"));
    }

    @Test
    @DisplayName("matches aliases case-insensitively")
    void matchesAliasesCaseInsensitively() {
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalize("asia/calcutta"));
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalize("ASIA/CALCUTTA"));
    }

    @Test
    @DisplayName("repairs the typos found in prod live_session rows")
    void repairsProdTypos() {
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalize("Asia/Culcutta"));
        assertEquals("Europe/London", TimezoneNormalizer.normalize("Europ/London"));
    }

    @Test
    @DisplayName("strips quotes left by the bad seed import")
    void stripsQuotes() {
        assertEquals("Europe/London", TimezoneNormalizer.normalize("'Europe/London'"));
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalize("\"Asia/Kolkata\""));
    }

    @ParameterizedTest
    @ValueSource(strings = { "Asia/Kolkata", "America/New_York", "Europe/London", "UTC" })
    @DisplayName("passes valid zones through untouched")
    void passesValidZonesThrough(String zone) {
        assertEquals(zone, TimezoneNormalizer.normalize(zone));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = { "", "   ", "Not/AZone", "garbage" })
    @DisplayName("falls back on absent or unusable input")
    void fallsBackOnBadInput(String zone) {
        assertEquals(TimezoneNormalizer.DEFAULT_TIMEZONE, TimezoneNormalizer.normalize(zone));
    }

    @ParameterizedTest
    @ValueSource(strings = { "Australia/Canberra", "Asia/Tel_Aviv", "Europe/Nicosia",
            "Europe/Belfast" })
    @DisplayName("does not rewrite zones Postgres already accepts")
    void doesNotRewriteZonesPostgresAccepts(String zone) {
        // These read like legacy aliases but resolve fine in prod's pg_timezone_names.
        // Rewriting them would silently override the admin's stated choice.
        assertEquals(zone, TimezoneNormalizer.normalize(zone));
    }

    @Test
    @DisplayName("normalizePreservingBlank leaves 'unset' unset")
    void preservesBlank() {
        // Blank means "unset" to the read queries via NULLIF(s.timezone, ''). Substituting a
        // concrete zone would change the column's meaning rather than repair a failure.
        assertEquals("", TimezoneNormalizer.normalizePreservingBlank(""));
        assertEquals("   ", TimezoneNormalizer.normalizePreservingBlank("   "));
        assertNull(TimezoneNormalizer.normalizePreservingBlank(null));
    }

    @Test
    @DisplayName("normalizePreservingBlank still repairs non-blank bad zones")
    void preservingBlankStillRepairs() {
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalizePreservingBlank("Asia/Calcutta"));
        assertEquals("Europe/London", TimezoneNormalizer.normalizePreservingBlank("'Europe/London'"));
        assertEquals("Asia/Kolkata", TimezoneNormalizer.normalizePreservingBlank("Not/AZone"));
    }

    @Test
    @DisplayName("honours an explicit fallback")
    void honoursExplicitFallback() {
        assertEquals("Europe/London", TimezoneNormalizer.normalize(null, "Europe/London"));
        assertEquals("Europe/London", TimezoneNormalizer.normalize("Not/AZone", "Europe/London"));
    }

    @Test
    @DisplayName("treats JVM-tolerated legacy aliases as unresolvable so they get rewritten")
    void legacyAliasIsNotConsideredResolvable() {
        // ZoneId.of("Asia/Calcutta") succeeds — that is exactly why ZoneId alone is an
        // insufficient guard and the alias table has to run first.
        assertFalse(TimezoneNormalizer.isResolvable("Asia/Calcutta"));
        assertTrue(TimezoneNormalizer.isResolvable("Asia/Kolkata"));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = { "Asia/Calcutta", "Asia/Culcutta", "'Europe/London'", "Europ/London",
            "Not/AZone", "" })
    @DisplayName("never returns a value Postgres would reject")
    void neverReturnsUnresolvableZone(String input) {
        assertTrue(TimezoneNormalizer.isResolvable(TimezoneNormalizer.normalize(input)));
    }
}
