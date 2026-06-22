package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * Loose string-y constants for the supported provider types. Kept as plain
 * String values (not an enum) on the wire so a new provider can be added
 * without a code change in shared modules — we just register a new adapter.
 */
public final class ProviderType {
    public static final String EXOTEL = "EXOTEL";
    /** Airtel IQ Business Connect — a white-labeled Vonage Business Cloud (VBC). */
    public static final String AIRTEL = "AIRTEL";
    // Future: PLIVO, TWILIO, KNOWLARITY, KALEYRA, …

    private ProviderType() {}
}
