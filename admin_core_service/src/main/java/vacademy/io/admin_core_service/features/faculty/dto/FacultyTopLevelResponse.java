package vacademy.io.admin_core_service.features.faculty.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.dto.SubjectTopLevelDto;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;


@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class FacultyTopLevelResponse {
    private String id;
    private String userId;
    private String name;
    private List<SubjectTopLevelDto> subjects;
}
