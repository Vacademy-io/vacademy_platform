package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallSpec;

/**
 * Port for an autonomous AI voice-agent provider that places a SINGLE outbound
 * call (the AI talks to the lead). This is the AI analogue of the bridge-shaped
 * {@link OutboundCallInitiator} — kept separate (ISP) because AI providers carry
 * a campaign/persona + arbitrary metadata and have no second (counsellor) leg.
 *
 * Adding a new AI provider = drop a {@code @Component} implementing this (and
 * {@link AiCallReportParser}); {@code AiVoiceProviderRegistry} picks it up. No
 * core changes (OCP).
 */
public interface AiOutboundCaller {

    /** e.g. {@code ProviderType.AAVTAAR}. */
    String providerType();

    /** Trigger one AI call. The {@code correlationId} on the spec must round-trip
     *  back to us on the end-of-call report so the outcome binds to the lead. */
    AiCallHandle placeCall(AiCallSpec spec);
}
