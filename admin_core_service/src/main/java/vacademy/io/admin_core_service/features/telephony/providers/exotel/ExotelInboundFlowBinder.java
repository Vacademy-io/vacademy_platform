package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.InboundFlowBinder;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

/**
 * Exotel implementation of {@link InboundFlowBinder}: attach an ExoPhone to the
 * institute's App-Bazaar flow via {@code PUT /IncomingPhoneNumbers/<sid>}. Holds
 * the only reference to {@code ExotelHttpClient.attachExoPhoneToFlow} — moved
 * out of the core {@code InboundFlowAttacher}, which is now provider-neutral.
 */
@Component
public class ExotelInboundFlowBinder implements InboundFlowBinder {

    @Autowired private ExotelHttpClient httpClient;

    @Override
    public String providerType() {
        return ProviderType.EXOTEL;
    }

    @Override
    public void attach(String providerResourceId, String flowSid, ProviderCredentials creds) {
        httpClient.attachExoPhoneToFlow(providerResourceId, flowSid, creds);
    }
}
