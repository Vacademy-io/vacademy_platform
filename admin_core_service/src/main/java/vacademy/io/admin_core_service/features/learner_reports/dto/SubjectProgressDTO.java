package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class SubjectProgressDTO {
    @JsonProperty("subject_id")
    private String subjectId;

    @JsonProperty("subject_name")
    private String subjectName;

    private List<ModuleProgressDTO> modules;

    @Data
    public static class ModuleProgressDTO {
        @JsonProperty("module_id")
        private String moduleId;

        @JsonProperty("module_name")
        private String moduleName;

        @JsonProperty("module_completion_percentage")
        private Double completionPercentage;

        @JsonProperty("avg_time_spent_minutes")
        private Double avgTimeSpentMinutes;
    }
}