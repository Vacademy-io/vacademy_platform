package vacademy.io.admin_core_service.features.learner_tracking.repository;

import java.time.LocalDateTime;

public interface ActivityLogProcessingProjection {
        String getId();

        /**
         * The learner the activity belongs to. Needed to resolve the owning institute
         * so the LLM spend can be attributed and charged - activity_log itself has no
         * institute_id column.
         */
        String getUserId();

        String getSourceType();

        String getRawJson();

        String getProcessedJson();

        String getStatus();

        LocalDateTime getCreatedAt();
}