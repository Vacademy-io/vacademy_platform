package vacademy.io.admin_core_service.features.course.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.session.dto.AddNewSessionDTO;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AddCourseDTO {
    private String id;
    private Boolean newCourse;
    private String courseName;
    private String thumbnailFileId;
    private Boolean containLevels;
    private List<AddNewSessionDTO> sessions;
    private Boolean isCoursePublishedToCatalaouge;
    private String coursePreviewImageMediaId;
    private String courseBannerMediaId;
    private String courseMediaId;
    private String whyLearnHtml;
    private String whoShouldLearnHtml;
    private String aboutTheCourseHtml;
    private List<String> tags;
    private Integer courseDepth;
    private String courseHtmlDescription;
    private List<AddFacultyToCourseDTO>addFacultyToCourse;
}
