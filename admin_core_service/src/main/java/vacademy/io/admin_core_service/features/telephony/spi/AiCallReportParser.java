package vacademy.io.admin_core_service.features.telephony.spi;

import com.fasterxml.jackson.databind.JsonNode;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallReport;

/**
 * Port: turn ONE provider-specific end-of-call payload into the provider-neutral
 * {@link AiCallReport}. Mirrors the existing {@link CallWebhookHandler} pattern
 * (provider-keyed, registry-dispatched) but emits the rich AI outcome
 * (disposition, Q&A, rating, recording…) the thin {@code NormalizedCallEvent}
 * can't carry.
 *
 * The generic webhook service handles transport concerns (auth token, array vs
 * single, NaN-sanitising); the adapter only maps fields.
 */
public interface AiCallReportParser {

    String providerType();

    /** Map one call object to the neutral report. The implementation should not
     *  throw on missing optional fields — return what it can. */
    AiCallReport parse(JsonNode callNode);
}
