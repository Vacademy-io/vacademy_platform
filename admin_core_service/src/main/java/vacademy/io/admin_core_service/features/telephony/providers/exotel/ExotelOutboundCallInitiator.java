package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundCallInitiator;
import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OutboundCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Map;

@Component
public class ExotelOutboundCallInitiator implements OutboundCallInitiator {

    @Autowired
    private ExotelHttpClient httpClient;

    @Override
    public String providerType() {
        return ProviderType.EXOTEL;
    }

    @Override
    public OutboundCallHandle initiate(BridgeCallRequest req, ProviderCredentials creds) {
        Map<String, Object> body = httpClient.connect(req, creds);
        // Exotel responds with: { "Call": { "Sid": "...", "Status": "..." } }
        Object callObj = body == null ? null : body.get("Call");
        if (!(callObj instanceof Map)) {
            throw new VacademyException("Unexpected response from Exotel");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> call = (Map<String, Object>) callObj;
        String sid = asString(call.get("Sid"));
        String status = asString(call.get("Status"));
        if (sid == null) throw new VacademyException("Exotel did not return a Call Sid");

        return OutboundCallHandle.builder()
                .providerCallId(sid)
                .initialStatus(status)
                .build();
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }
}
