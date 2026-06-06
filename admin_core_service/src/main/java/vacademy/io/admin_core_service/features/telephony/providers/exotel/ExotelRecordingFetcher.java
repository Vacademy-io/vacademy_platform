package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

import java.io.IOException;
import java.io.InputStream;

@Component
public class ExotelRecordingFetcher implements RecordingFetcher {

    @Autowired
    private ExotelHttpClient httpClient;

    @Override
    public String providerType() {
        return ProviderType.EXOTEL;
    }

    @Override
    public InputStream fetch(String recordingUrl, ProviderCredentials creds) throws IOException {
        return httpClient.openRecordingStream(recordingUrl, creds);
    }
}
