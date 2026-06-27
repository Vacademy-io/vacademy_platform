package vacademy.io.admin_core_service.features.telephony.providers.aavtaar;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.AiOutboundCaller;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallSpec;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Aavtaar adapter for the {@link AiOutboundCaller} port. Builds the metadata bag
 * (with our correlation id, echoed back on the webhook) and delegates to
 * {@link AavtaarHttpClient}. Aavtaar's click-to-call returns a free-text string,
 * so {@code providerCallId} is null here — it arrives later on the report.
 */
@Component
@RequiredArgsConstructor
public class AavtaarOutboundCaller implements AiOutboundCaller {

    private final AavtaarHttpClient httpClient;

    @Override
    public String providerType() {
        return ProviderType.AAVTAAR;
    }

    @Override
    public AiCallHandle placeCall(AiCallSpec spec) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("correlationId", spec.getCorrelationId());
        if (spec.getInstituteId() != null) metadata.put("instituteId", spec.getInstituteId());
        if (spec.getUserId() != null) metadata.put("userId", spec.getUserId());
        if (spec.getResponseId() != null) metadata.put("responseId", spec.getResponseId());
        if (spec.getMetadata() != null) metadata.putAll(spec.getMetadata());

        AavtaarHttpClient.Result r = httpClient.clickToCall(
                spec.getInstituteId(), spec.getPhoneNumber(), spec.getCampaignId(),
                spec.getCustomerName(), spec.getCustomerEmail(), metadata);

        return AiCallHandle.builder()
                // Aavtaar now returns its call id on the click-to-call response — store it
                // as provider_call_id so the end-of-call webhook maps back to THIS exact
                // call (callUuid -> provider_call_id). Null when not returned → phone fallback.
                .providerCallId(r.callUuid())
                .accepted(r.success())
                .message(r.message())
                .build();
    }
}
