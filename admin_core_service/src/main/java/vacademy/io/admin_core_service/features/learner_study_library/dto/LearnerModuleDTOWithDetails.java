package vacademy.io.admin_core_service.features.learner_study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.chapter.dto.LearnerChapterDetailsDTO;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@NoArgsConstructor
public class LearnerModuleDTOWithDetails {
    private ModuleDTO module;
    private Double percentageCompleted;
    private List<LearnerChapterDetailsDTO> chapters;

    public LearnerModuleDTOWithDetails(ModuleDTO module,Double percentageCompleted, List<LearnerChapterDetailsDTO> chapters) {
        this.module = module;
        this.chapters = chapters;
    }
}