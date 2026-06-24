package vacademy.io.admin_core_service.features.telephony.core;

import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallDecision;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallDecision.Action;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit tests for the AI-call outcome decision (assign vs stop vs retry).
 * No Spring context — the classifier has no I/O.
 */
class AiCallOutcomeClassifierTest {

    private final AiCallOutcomeClassifier classifier = new AiCallOutcomeClassifier();

    private AiCallingSettingsPojo enabled() {
        AiCallingSettingsPojo s = new AiCallingSettingsPojo();
        s.setEnabled(true);
        s.setConnectThresholdSec(20);
        s.setMaxRetries(3);
        s.setAssignOnDispositions(List.of("Interested", "Likely_Interested"));
        s.setStopOnDispositions(List.of("Not_Interested"));
        s.setAssignExhaustedToHuman(true);
        return s;
    }

    @Test
    void disabled_returnsNone() {
        AiCallingSettingsPojo s = enabled();
        s.setEnabled(false);
        assertEquals(Action.NONE, classifier.classify("completed", 120, "Interested", 0, s).action());
    }

    @Test
    void nullSettings_returnsNone() {
        assertEquals(Action.NONE, classifier.classify("completed", 120, "Interested", 0, null).action());
    }

    @Test
    void connectedGoodDisposition_assigns() {
        AiCallDecision d = classifier.classify("completed", 120, "Interested", 0, enabled());
        assertEquals(Action.ASSIGN, d.action());
        assertFalse(d.isExhausted());
    }

    @Test
    void goodDisposition_isCaseInsensitive() {
        assertEquals(Action.ASSIGN, classifier.classify("completed", 120, "likely_interested", 0, enabled()).action());
    }

    @Test
    void connectedStopDisposition_stops() {
        assertEquals(Action.STOP, classifier.classify("completed", 120, "Not_Interested", 0, enabled()).action());
    }

    @Test
    void connectedNeutral_retriesWhenAttemptsLeft() {
        assertEquals(Action.RETRY, classifier.classify("completed", 120, "Incomplete", 0, enabled()).action());
    }

    @Test
    void connectedNeutral_exhausted_assignsToHumanWhenConfigured() {
        AiCallDecision d = classifier.classify("completed", 120, "Incomplete", 3, enabled());
        assertEquals(Action.ASSIGN, d.action());
        assertTrue(d.isExhausted());
    }

    @Test
    void connectedNeutral_exhausted_stopsWhenNotAssigning() {
        AiCallingSettingsPojo s = enabled();
        s.setAssignExhaustedToHuman(false);
        AiCallDecision d = classifier.classify("completed", 120, "Incomplete", 3, s);
        assertEquals(Action.STOP, d.action());
        assertTrue(d.isExhausted());
    }

    @Test
    void notCompleted_isNotConnected_retries() {
        AiCallDecision d = classifier.classify("no-answer", null, null, 0, enabled());
        assertEquals(Action.RETRY, d.action());
        assertEquals("not_connected", d.reason());
    }

    @Test
    void shortCompletedCall_belowThreshold_isNotConnected() {
        AiCallDecision d = classifier.classify("completed", 5, "Incomplete", 0, enabled());
        assertEquals(Action.RETRY, d.action());
        assertEquals("not_connected", d.reason());
    }

    @Test
    void notConnected_exhausted_assignsToHuman() {
        AiCallDecision d = classifier.classify("failed", null, null, 3, enabled());
        assertEquals(Action.ASSIGN, d.action());
        assertTrue(d.isExhausted());
    }
}
