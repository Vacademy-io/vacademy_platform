package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * Normalised call-lifecycle status. Every adapter maps the provider's native
 * status onto one of these so the core domain and the UI don't carry any
 * provider-specific vocabulary.
 *
 * The {@link #rank()} value gates status transitions in
 * {@code CallLogService.applyEvent} — webhooks arriving out of order (Exotel
 * retries an earlier RINGING event after we've already moved to IN_PROGRESS)
 * are silently ignored. Terminal states are highest-rank and never replaced.
 */
public enum CallStatus {
    INITIATED,
    QUEUED,
    COUNSELLOR_RINGING,
    COUNSELLOR_ANSWERED,
    IN_PROGRESS,
    COMPLETED,
    NO_ANSWER,
    BUSY,
    FAILED,
    CANCELLED;

    public boolean isTerminal() {
        return this == COMPLETED || this == NO_ANSWER || this == BUSY
                || this == FAILED || this == CANCELLED;
    }

    /**
     * Lifecycle position. Used to decide whether a newly-received event is
     * worth applying — `applyEvent` only writes when the incoming rank is
     * >= the current row's rank. All terminal states share rank 100 so the
     * row never transitions between them (a fast NO_ANSWER followed by a
     * delayed COMPLETED retry from the provider, for example).
     */
    public int rank() {
        return switch (this) {
            case INITIATED          -> 0;
            case QUEUED             -> 10;
            case COUNSELLOR_RINGING -> 20;
            case COUNSELLOR_ANSWERED-> 30;
            case IN_PROGRESS        -> 40;
            // Terminal states share rank — first one wins.
            case COMPLETED, NO_ANSWER, BUSY, FAILED, CANCELLED -> 100;
        };
    }

    /** Parse the row's stored string back into the enum, defaulting to QUEUED. */
    public static CallStatus parseOrDefault(String s) {
        if (s == null) return QUEUED;
        try { return CallStatus.valueOf(s); } catch (IllegalArgumentException e) { return QUEUED; }
    }
}
