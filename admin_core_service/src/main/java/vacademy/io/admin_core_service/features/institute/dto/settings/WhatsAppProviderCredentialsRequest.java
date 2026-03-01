package vacademy.io.admin_core_service.features.institute.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppProviderCredentialsRequest {
    private String providerName; // "combot", "wati", or "meta"
    private Map<String, String> credentials;
}
