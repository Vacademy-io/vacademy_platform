package vacademy.io.admin_core_service.features.learner_reports.dto;

public interface SubjectProgressProjection {
    String getSubjectId();

    String getSubjectName();

    String getModules(); // This will be the JSON string
}
