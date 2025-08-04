package vacademy.io.admin_core_service.features.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface InstituteSearchProjection {
    String getId();
    String getInstituteName();
}
