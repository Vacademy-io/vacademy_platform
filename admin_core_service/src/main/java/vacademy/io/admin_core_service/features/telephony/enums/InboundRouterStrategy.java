package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * String keys for inbound routing strategies. Matched by
 * {@link vacademy.io.admin_core_service.features.telephony.spi.InboundLeadRouter#strategyKey()}
 * and ordered by the routing service into a priority chain.
 */
public final class InboundRouterStrategy {
    /** Most recent OUTBOUND call's counsellor for this lead's phone. */
    public static final String LAST_COUNSELLOR = "LAST_COUNSELLOR";
    /** Final fallback: the institute's configured voicemail number. */
    public static final String VOICEMAIL_FALLBACK = "VOICEMAIL_FALLBACK";

    private InboundRouterStrategy() {}
}
