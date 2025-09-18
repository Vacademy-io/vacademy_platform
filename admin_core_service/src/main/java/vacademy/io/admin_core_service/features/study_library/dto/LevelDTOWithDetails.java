package vacademy.io.admin_core_service.features.study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Level;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LevelDTOWithDetails {
    private String id;
    private String name;
    private Integer durationInDays;
    private List<SubjectDTO> subjects;
    private List<UserDTO> instructors;
    private Double readTimeInMinutes;

    public LevelDTOWithDetails(Level level, List<SubjectDTO> subjects,List<UserDTO> instructors) {
        this.id = level.getId();
        this.name = level.getLevelName();
        this.durationInDays = level.getDurationInDays();
        this.subjects = subjects;
        this.instructors = instructors;
    }
}
