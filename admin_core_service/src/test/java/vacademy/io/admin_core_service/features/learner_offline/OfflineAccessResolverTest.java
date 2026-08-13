package vacademy.io.admin_core_service.features.learner_offline;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineAccessResolver;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure-logic tests for {@link OfflineAccessResolver}, written before the
 * implementation (offline plan Part A1 resolution algorithm). The resolver
 * takes an unordered list of explicit "allow" rule values found anywhere on
 * the ancestor chain [PACKAGE, PACKAGE_SESSION, SUBJECT, MODULE, CHAPTER,
 * SLIDE] (null = no rule at that level = inherit), plus the course default
 * and the institute-wide feature flag, and applies:
 *   1. any explicit false anywhere on the chain -> false
 *   2. else any explicit true anywhere on the chain -> true
 *   3. else the course default
 *   0. institute disabled short-circuits everything to false
 */
class OfflineAccessResolverTest {

    @Test
    @DisplayName("explicit false on an ancestor beats an explicit true on a descendant (chapter false, slide true -> false)")
    void explicitFalseOnAncestorWinsOverExplicitTrueOnDescendant() {
        // chain: PACKAGE, PACKAGE_SESSION, SUBJECT, MODULE, CHAPTER=false, SLIDE=true
        boolean result = OfflineAccessResolver.resolve(
                Arrays.asList(null, null, null, null, Boolean.FALSE, Boolean.TRUE),
                /* courseDefaultEnabled */ true,
                /* instituteOfflineEnabled */ true);
        assertFalse(result, "an explicit false anywhere on the chain must win, regardless of position");
    }

    @Test
    @DisplayName("explicit true beats an inherited course default of false (course default false + chapter true -> true)")
    void explicitTrueBeatsInheritedDefaultFalse() {
        boolean result = OfflineAccessResolver.resolve(
                Arrays.asList(null, null, null, null, Boolean.TRUE, null),
                /* courseDefaultEnabled */ false,
                /* instituteOfflineEnabled */ true);
        assertTrue(result);
    }

    @Test
    @DisplayName("a PACKAGE_SESSION-level rule (batch override) applies on its own, independent of course default")
    void packageSessionLevelRuleAppliesIndependently() {
        // Only the PACKAGE_SESSION slot carries an explicit allow=true.
        boolean allowed = OfflineAccessResolver.resolve(
                Arrays.asList(null, Boolean.TRUE, null, null, null, null),
                /* courseDefaultEnabled */ false,
                /* instituteOfflineEnabled */ true);
        assertTrue(allowed, "a batch-level allow rule should enable offline for that package session");

        // A PACKAGE_SESSION-level block overrides an explicit true elsewhere on the chain.
        boolean blocked = OfflineAccessResolver.resolve(
                Arrays.asList(null, Boolean.FALSE, null, null, Boolean.TRUE, null),
                /* courseDefaultEnabled */ true,
                /* instituteOfflineEnabled */ true);
        assertFalse(blocked, "a batch-level block rule should disable offline for that package session's slides");
    }

    @Test
    @DisplayName("no explicit rules anywhere on the chain falls back to the course default")
    void noRulesFallsBackToCourseDefault() {
        assertTrue(OfflineAccessResolver.resolve(
                Collections.nCopies(6, null), true, true));
        assertFalse(OfflineAccessResolver.resolve(
                Collections.nCopies(6, null), false, true));
    }

    @Test
    @DisplayName("empty/no rules at all (null chain) also falls back to the course default")
    void nullChainFallsBackToCourseDefault() {
        assertTrue(OfflineAccessResolver.resolve(null, true, true));
        assertFalse(OfflineAccessResolver.resolve(null, false, true));
    }

    @Test
    @DisplayName("institute-level offline disabled zeroes everything, even explicit true rules")
    void instituteDisabledZeroesEverything() {
        boolean result = OfflineAccessResolver.resolve(
                Arrays.asList(Boolean.TRUE, Boolean.TRUE, Boolean.TRUE, Boolean.TRUE, Boolean.TRUE, Boolean.TRUE),
                /* courseDefaultEnabled */ true,
                /* instituteOfflineEnabled */ false);
        assertFalse(result);
    }
}
