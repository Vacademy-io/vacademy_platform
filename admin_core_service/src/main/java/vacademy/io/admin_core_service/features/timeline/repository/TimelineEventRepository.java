package vacademy.io.admin_core_service.features.timeline.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.timeline.entity.TimelineEvent;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, String> {

        /**
         * Fetch timeline events for a specific entity type and ID, ordered by creation
         * date descending.
         * This powers the main timeline UI.
         */
        Page<TimelineEvent> findByTypeAndTypeIdOrderByCreatedAtDesc(String type, String typeId, Pageable pageable);

        /**
         * Fetch ALL timeline events/notes for a student across all stages (enquiry, application, enrollment).
         * Pinned notes appear first, then ordered by creation date descending.
         */
        Page<TimelineEvent> findByStudentUserIdOrderByIsPinnedDescCreatedAtDesc(String studentUserId, Pageable pageable);

        /**
         * Fetch timeline events for a specific entity, with pinned first.
         * Used for notes-enhanced timeline view.
         */
        Page<TimelineEvent> findByTypeAndTypeIdOrderByIsPinnedDescCreatedAtDesc(String type, String typeId, Pageable pageable);

        /**
         * Count timeline events for an entity (used by lead scoring engagement factor).
         */
        long countByTypeAndTypeId(String type, String typeId);

        /**
         * Count timeline events across multiple entity IDs of the same type.
         * Used by UserLeadProfileService to aggregate events across all audience responses.
         */
        long countByTypeAndTypeIdIn(String type, java.util.List<String> typeIds);
}
