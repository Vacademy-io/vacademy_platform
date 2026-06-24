package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;

/**
 * Renders a provider's synchronous inbound-applet response from a neutral
 * {@link InboundRouteDecision}. Only providers with the
 * {@code SYNC_INBOUND_APPLET} capability register one (Exotel Connect-applet
 * JSON; a Twilio adapter would emit TwiML; Vonage an NCCO). Providers that
 * route inbound natively (Airtel/Vonage VBC) ship no bean — the {@code /route}
 * endpoint simply has nothing to render for them, which is correct.
 *
 * <p>Returns {@code Object} so each provider's wire shape (Map → JSON, XML
 * string, …) is its own concern; the controller serializes whatever it gets.
 */
public interface InboundResponseRenderer {

    /** Matches institute_telephony_config.provider_type, e.g. "EXOTEL". */
    String providerType();

    /**
     * Build the applet response for one routing decision.
     *
     * @param decision      routing decision from {@code InboundRoutingService}
     * @param dialledNumber the number the lead dialled (provider caller-ID context)
     */
    Object render(InboundRouteDecision decision, String dialledNumber);
}
