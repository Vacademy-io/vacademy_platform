package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

import java.io.IOException;
import java.io.InputStream;

/**
 * Streams a Plivo recording mp3 (authenticated with the subaccount Basic creds)
 * so {@code RecordingTxOps} can pipe it into media_service. Mirrors
 * {@code ExotelRecordingFetcher}.
 */
@Component
public class PlivoRecordingFetcher implements RecordingFetcher {

    @Autowired private PlivoHttpClient httpClient;

    @Override
    public String providerType() {
        return ProviderType.PLIVO;
    }

    @Override
    public InputStream fetch(String recordingUrl, ProviderCredentials creds) throws IOException {
        return httpClient.openRecordingStream(recordingUrl, creds);
    }
}
