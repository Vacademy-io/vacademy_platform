package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * How an adapter ties a provider's status/event callback back to our
 * {@code telephony_call_log} row. Declared per adapter via
 * {@code OutboundCallInitiator.correlationStrategy()} so the webhook controller
 * doesn't assume Exotel's echo-the-id model.
 */
public enum CorrelationStrategy {

    /**
     * The provider echoes an arbitrary correlation id we supplied back on every
     * callback (Exotel: our UUID via CustomField → {@code ?corr=}). The row is
     * joined by that id. Requires the provider to accept + return a custom field.
     */
    ECHO_FIELD,

    /**
     * The provider can't echo an arbitrary id, so we join by
     * {@code (providerType, providerCallId)} once we know the provider's own
     * call id. Airtel/Vonage need this: {@code click2dial} returns no id in its
     * response, so the id is discovered by polling active calls (or read off the
     * first VIP event) and then events match on it.
     */
    PROVIDER_CALL_ID,

    /**
     * All events arrive on one shared webhook with no per-call correlation
     * field at all; resolve the institute by the dialled number, then the row by
     * provider call id. (Account-wide single-webhook providers.)
     */
    SHARED_WEBHOOK
}
