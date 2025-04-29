package vacademy.io.admin_core_service.features.level.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AddLevelWithCourseDTO {
    private String id;
    private Boolean newLevel;
    private String levelName;
    private Integer durationInDays;
    private String thumbnailFileId;
}
