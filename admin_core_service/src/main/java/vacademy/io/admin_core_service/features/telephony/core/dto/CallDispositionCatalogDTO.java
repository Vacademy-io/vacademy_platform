package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.CallDispositionCatalog;

/**
 * Outward projection of a call-outcome catalog entry — powers the disposition
 * picker and the dashboard's disposition filter options.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallDispositionCatalogDTO {

    private String id;
    private String dispositionKey;
    private String label;
    private String color;
    private String category;
    /** Whether choosing this outcome also advances the lead's pipeline status. */
    private boolean mapsToLeadStatus;

    public static CallDispositionCatalogDTO from(CallDispositionCatalog c) {
        return CallDispositionCatalogDTO.builder()
                .id(c.getId())
                .dispositionKey(c.getDispositionKey())
                .label(c.getLabel())
                .color(c.getColor())
                .category(c.getCategory())
                .mapsToLeadStatus(c.getMapsToLeadStatusId() != null)
                .build();
    }
}
