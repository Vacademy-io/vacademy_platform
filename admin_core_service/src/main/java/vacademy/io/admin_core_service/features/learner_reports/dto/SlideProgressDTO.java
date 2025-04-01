package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SlideProgressDTO {
    private String slideId;
    private String slideTitle;
    private String chapterId;
    private String chapterName;
    private String moduleId;
    private String moduleName;
    private String subjectId;
    private String subjectName;
    private double concentrationScore;
    private String timeSpent;
}
