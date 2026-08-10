package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/** One course the client has locally installed, as reported at check-in. */
@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineInstalledCourseDTO {
    private String packageSessionId;
    private Long manifestVersion;
}
