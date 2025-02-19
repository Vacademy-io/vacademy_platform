package vacademy.io.admin_core_service.features.learner_tracking.dto;

import java.sql.Timestamp;
public interface LearnerActivityProjection {
    String getUserId();
    String getFullName();
    Long getTotalTimeSpent();
    Timestamp getLastActive();
}
