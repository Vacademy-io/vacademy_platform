package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public interface SubjectProgressProjection {
    String getSubjectId();
    String getSubjectName();
    String getModules(); // This will be the JSON string
}
