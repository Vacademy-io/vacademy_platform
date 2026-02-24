package vacademy.io.admin_core_service.features.level.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.course.dto.AddFacultyToCourseDTO;
import vacademy.io.admin_core_service.features.group.dto.AddGroupDTO;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AddLevelWithCourseDTO {
    private String id;
    private Boolean newLevel;
    private String levelName;
    private Integer durationInDays;
    private String thumbnailFileId;
    private AddGroupDTO group;
    private List<AddFacultyToCourseDTO> addFacultyToCourse;
    /** Optional: whether this batch is a parent. Backward compatible: not sent = false. */
    private Boolean isParent;
    /** Optional: parent batch id if this is a child batch. */
    private String parentId;
}
