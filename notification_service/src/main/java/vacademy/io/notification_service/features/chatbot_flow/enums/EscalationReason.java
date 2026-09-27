package vacademy.io.notification_service.features.chatbot_flow.enums;

/** Why the chatbot handed a conversation over to a human. */
public enum EscalationReason {
    /** The AI said it does not have the information (escalation marker in its reply). */
    NO_CONTEXT,
    /** The AI conversation hit its configured maxTurns ceiling. */
    MAX_TURNS,
    /** The AI call itself failed (provider error, timeout, non-2xx). */
    AI_ERROR,
    /**
     * The institute is out of AI credits (or the balance could not be confirmed), so no
     * model was called. Unlike AI_ERROR this will not clear on its own — an admin has to
     * top up — which is why it is worth telling them apart in the Inbox.
     */
    NO_CREDITS,
    /** Raised by an admin from the Inbox rather than by the bot. */
    MANUAL
}
