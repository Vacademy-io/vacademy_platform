package vacademy.io.admin_core_service.features.institute.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteDashboardResponse {
    private String id;
    private String adminName;
    private Integer profileCompletionPercentage;
    private Long batchCount;
    private Long studentCount;
}
