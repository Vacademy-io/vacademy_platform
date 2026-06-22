package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallDecision;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallDecision.Action;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;

import java.util.List;

/**
 * Pure decision logic: given a call's outcome + the institute's policy, decide
 * whether to assign a counsellor, stop, or retry. No I/O — fully unit-testable.
 *
 * Two axes:
 *  1. Connectivity — a call that didn't really connect (not "completed", or
 *     shorter than the connect threshold) is a no-connect → retry / exhausted.
 *  2. Disposition — for a connected call, the configured assign/stop lists decide
 *     the action; anything unmapped is treated as neutral → retry / exhausted.
 */
@Component
public class AiCallOutcomeClassifier {

    public AiCallDecision classify(String status, Integer durationSec, String disposition,
                                   int priorAttempts, AiCallingSettingsPojo s) {
        if (s == null || !s.isEnabled()) {
            return new AiCallDecision(Action.NONE, "ai_calling_disabled");
        }

        boolean canRetry = priorAttempts < s.getMaxRetries();

        if (!isConnected(status, durationSec, s.getConnectThresholdSec())) {
            return canRetry ? new AiCallDecision(Action.RETRY, "not_connected") : exhausted(s);
        }

        String d = disposition == null ? "" : disposition.trim();
        if (containsIgnoreCase(s.getAssignOnDispositions(), d)) {
            return new AiCallDecision(Action.ASSIGN, "good:" + d);
        }
        if (containsIgnoreCase(s.getStopOnDispositions(), d)) {
            return new AiCallDecision(Action.STOP, "stop:" + d);
        }
        // Neutral / unmapped disposition (e.g. Incomplete, Requirement_Not_Clear).
        return canRetry ? new AiCallDecision(Action.RETRY, "neutral:" + d) : exhausted(s);
    }

    private AiCallDecision exhausted(AiCallingSettingsPojo s) {
        return s.isAssignExhaustedToHuman()
                ? new AiCallDecision(Action.ASSIGN, "exhausted")
                : new AiCallDecision(Action.STOP, "exhausted");
    }

    private boolean isConnected(String status, Integer durationSec, int thresholdSec) {
        if (status == null || !status.trim().equalsIgnoreCase("completed")) return false;
        return durationSec != null && durationSec >= thresholdSec;
    }

    private boolean containsIgnoreCase(List<String> list, String value) {
        if (list == null || value == null || value.isBlank()) return false;
        return list.stream().anyMatch(x -> x != null && x.equalsIgnoreCase(value));
    }
}
