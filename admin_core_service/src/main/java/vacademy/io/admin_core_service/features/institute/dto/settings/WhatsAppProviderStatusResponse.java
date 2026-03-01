package vacademy.io.admin_core_service.features.institute.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppProviderStatusResponse {
    private String instituteId;
    private String activeProvider;
    private List<ProviderDetails> providers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProviderDetails {
        private String name;
        private boolean isConfigured;
        private boolean isActive;
    }
}
