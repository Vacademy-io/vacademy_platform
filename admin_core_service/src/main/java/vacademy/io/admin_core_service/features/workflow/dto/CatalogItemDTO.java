package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CatalogItemDTO {
    private String key;
    private String label;
    private String description;
    private String category;
    private List<String> requiredParams;
}
