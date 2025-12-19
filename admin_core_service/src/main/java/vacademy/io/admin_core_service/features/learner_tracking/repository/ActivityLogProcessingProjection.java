package vacademy.io.admin_core_service.features.learner_tracking.repository;

import java.time.LocalDateTime;

public interface ActivityLogProcessingProjection {
        String getId();

        String getSourceType();

        String getRawJson();

        String getProcessedJson();

        String getStatus();

        LocalDateTime getCreatedAt();
}