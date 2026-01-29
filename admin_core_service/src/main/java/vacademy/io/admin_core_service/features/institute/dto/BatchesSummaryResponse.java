package vacademy.io.admin_core_service.features.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Summary/aggregates response for package sessions.
 * Provides filter options (unique packages, levels, sessions) efficiently.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BatchesSummaryResponse {

    private long totalBatches;

    private boolean hasOrgAssociated;

    private List<IdNameDTO> packages;

    private List<IdNameDTO> levels;

    private List<IdNameDTO> sessions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class IdNameDTO {
        private String id;
        private String name;
    }
}
