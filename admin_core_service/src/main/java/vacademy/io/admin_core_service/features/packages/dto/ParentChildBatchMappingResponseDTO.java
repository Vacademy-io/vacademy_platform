package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * Response payload for parent/child batch mapping.
 */
@Data
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ParentChildBatchMappingResponseDTO {

    private String parentPackageSessionId;
    private int updatedChildCount;
    private List<String> updatedChildPackageSessionIds;
}

