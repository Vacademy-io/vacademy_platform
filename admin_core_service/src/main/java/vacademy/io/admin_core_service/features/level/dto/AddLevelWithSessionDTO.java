package vacademy.io.admin_core_service.features.level.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.course.dto.AddFacultyToCourseDTO;
import vacademy.io.admin_core_service.features.group.dto.AddGroupDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AddLevelWithSessionDTO {
    private String id;
    private Boolean newLevel;
    private String levelName;
    private Integer durationInDays;
    private String thumbnailFileId;
    private String packageId;
    private AddGroupDTO group;
    private String status;
    private String packageSessionStatus;
    private String packageSessionId;
    private boolean newPackageSession;
    private List<AddFacultyToCourseDTO> addFacultyToCourse;
}
