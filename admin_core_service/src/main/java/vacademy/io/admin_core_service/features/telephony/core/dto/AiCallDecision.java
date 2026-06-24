package vacademy.io.admin_core_service.features.telephony.core.dto;

/**
 * What to do with a lead after an AI call's outcome is known.
 *
 *  ASSIGN — hand the lead to a counsellor (good response, or no-answer-exhausted
 *           when "assign exhausted to human" is on). The {@code reason} prefix
 *           ("good:" / "exhausted") tells the processor which status to stamp.
 *  STOP   — terminal, no counsellor (e.g. Not_Interested, or exhausted without
 *           the assign-to-human option).
 *  RETRY  — the lead should be called again (no-answer / neutral, retries left).
 *  NONE   — AI calling disabled / nothing to do.
 */
public record AiCallDecision(Action action, String reason) {

    public enum Action { ASSIGN, STOP, RETRY, NONE }

    public boolean isAssign() {
        return action == Action.ASSIGN;
    }

    public boolean isExhausted() {
        return reason != null && reason.startsWith("exhausted");
    }
}
