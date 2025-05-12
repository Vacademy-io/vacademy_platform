package vacademy.io.admin_core_service.features.learner_study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDetailsProjection;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class LearnerModuleDTOWithDetails {
    private ModuleDTO module;
    private Double percentageCompleted;
    private List<ChapterDetailsProjection> chapters;

    public LearnerModuleDTOWithDetails(ModuleDTO module,Double percentageCompleted, List<ChapterDetailsProjection> chapters) {
        this.module = module;
        this.chapters = chapters;
    }
}