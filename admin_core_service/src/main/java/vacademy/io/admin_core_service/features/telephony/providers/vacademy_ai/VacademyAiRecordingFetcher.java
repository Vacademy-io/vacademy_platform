package vacademy.io.admin_core_service.features.telephony.providers.vacademy_ai;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.providers.plivo.PlivoHttpClient;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

import java.io.IOException;
import java.io.InputStream;

/**
 * VACADEMY_AI call rows carry Plivo recording URLs (the AI call runs on the
 * institute's Vacademy Voice subaccount, recorded via {@code <Record
 * recordSession>}), so fetching simply delegates to the Plivo client. Registered
 * under VACADEMY_AI because {@code RecordingTxOps} resolves the fetcher by the
 * row's provider type.
 */
@Component
public class VacademyAiRecordingFetcher implements RecordingFetcher {

    @Autowired private PlivoHttpClient plivoHttpClient;

    @Override
    public String providerType() {
        return ProviderType.VACADEMY_AI;
    }

    @Override
    public InputStream fetch(String recordingUrl, ProviderCredentials creds) throws IOException {
        return plivoHttpClient.openRecordingStream(recordingUrl, creds);
    }
}
