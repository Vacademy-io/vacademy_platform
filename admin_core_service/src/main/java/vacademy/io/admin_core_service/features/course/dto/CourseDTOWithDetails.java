package vacademy.io.admin_core_service.features.course.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.common.institute.dto.SessionDTO;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class CourseDTOWithDetails {
    private CourseDTO course;
    private List<SessionDTOWithDetails> sessions;

    public CourseDTOWithDetails(CourseDTO course, List<SessionDTOWithDetails> sessions) {
        this.course = course;
        this.sessions = sessions;
    }
}
