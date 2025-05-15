package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSlidesDetailDTO;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerRecentSlideDTO {
    private String packageId;
    private String levelId;
    private String subjectId;
    private String chapterId;
    private String moduleId;
    private LearnerSlidesDetailDTO slide;
}
