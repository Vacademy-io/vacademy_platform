package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

import java.io.IOException;
import java.io.InputStream;

/**
 * Optional port — providers without recording support simply don't ship a
 * RecordingFetcher bean, and {@code TelephonyProviderRegistry.fetcher(type)}
 * returns an empty Optional.
 */
public interface RecordingFetcher {
    String providerType();

    InputStream fetch(String recordingUrl, ProviderCredentials creds) throws IOException;
}
