package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * Provider-neutral classification of an outbound-call failure. Each adapter
 * maps its own raw error vocabulary onto one of these (via
 * {@code OutboundCallInitiator.translateError}), so the core and the frontend
 * react to a stable code instead of provider-specific free text — no more
 * "top up at my.exotel.com" leaking onto every provider's failure.
 */
public enum ProviderErrorCode {
    /** The provider account/wallet is out of balance. */
    OUT_OF_BALANCE,
    /** Credentials were rejected by the provider. */
    AUTH_FAILED,
    /** The caller-ID / from-number isn't verified/provisioned at the provider. */
    CALLER_ID_UNVERIFIED,
    /** A From/To number was malformed or rejected by the provider. */
    INVALID_NUMBER,
    /** The provider throttled us. */
    RATE_LIMITED,
    /** The requested operation isn't supported by this provider. */
    NOT_SUPPORTED,
    /** Anything we couldn't classify. */
    UNKNOWN
}
