package vacademy.io.admin_core_service.features.institute.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SwitchWhatsAppProviderRequest {
    private String newProvider; // "COMBOT", "WATI", or "META"
}
