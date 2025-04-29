package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface BatchProjection {
    String getPackageSessionId();
    String getBatchName();
    String getBatchStatus();
    String getStartDate();
    Long getCountStudents();
    String getInviteCode();
}
