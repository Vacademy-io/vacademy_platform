package vacademy.io.admin_core_service.features.learner_study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.sql.Timestamp;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface LearnerSubjectProjection {
    String getId();
    String getSubjectName();
    String getSubjectCode();
    Integer getCredit();
    String getThumbnailId();
    Timestamp getCreatedAt();
    Timestamp getUpdatedAt();
    Integer getSubjectOrder();
    Double getPercentageCompleted();
}
