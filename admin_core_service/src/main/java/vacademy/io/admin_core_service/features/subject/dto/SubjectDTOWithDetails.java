package vacademy.io.admin_core_service.features.subject.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.common.institute.dto.SubjectDTO;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class SubjectDTOWithDetails {
    private SubjectDTO subjectDTO;
    private List<LearnerModuleDTOWithDetails> modules;
}
