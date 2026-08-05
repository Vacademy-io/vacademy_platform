package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * Who asked for an AI call — decides which of the pre-dial throttles apply.
 *
 * <p>The throttles ({@code SKIPPED_ASSIGNED}, {@code SKIPPED_DAILY_CAP},
 * {@code SKIPPED_DUPLICATE}) all return HTTP 200 with {@code dispatched=false} and
 * dial nothing, so applying the wrong one to the wrong caller makes calling look
 * broken rather than throttled. They exist to bound AUTOMATION, which can loop,
 * re-enter and fan out — not to overrule a person who pressed a button.
 */
public enum CallTrigger {

    /** Workflow node, scheduler, retry re-dialer. Every throttle applies. */
    AUTOMATION,

    /**
     * One person, one click, one lead. No throttle applies: if they ask for a call,
     * a phone rings. Notably the already-assigned guard, which refused a counsellor
     * on every lead she owns — her leads are assigned by definition.
     */
    MANUAL,

    /**
     * A person started a bulk campaign over leads they picked. Skips the
     * already-assigned guard for the same reason as {@link #MANUAL} — they chose
     * these leads deliberately — but KEEPS the daily cap and the duplicate window,
     * because a fan-out is exactly what those two are there to bound.
     */
    BULK_MANUAL;

    /** True when the lead already having a counsellor should block the dial. */
    public boolean enforcesAssignedLeadGuard() {
        return this == AUTOMATION;
    }

    /** True when the institute's rolling 24h dial cap should block the dial. */
    public boolean enforcesDailyCap() {
        return this != MANUAL;
    }

    /** True when a near-simultaneous duplicate for the same lead should be collapsed. */
    public boolean enforcesDuplicateWindow() {
        return this != MANUAL;
    }
}
