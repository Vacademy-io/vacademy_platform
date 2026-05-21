package vacademy.io.admin_core_service.features.admin_activity_logs.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminActivityLogFilterDTO {
    private Timestamp startDate;
    private Timestamp endDate;
    private String actorId;
    private String entityType;
    private String entityId;
    private String action;
}
