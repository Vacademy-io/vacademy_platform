package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.sql.Timestamp;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class VideoActivityLogDTO {
    private String id;
    private Timestamp startTime;
    private Timestamp endTime;
}
