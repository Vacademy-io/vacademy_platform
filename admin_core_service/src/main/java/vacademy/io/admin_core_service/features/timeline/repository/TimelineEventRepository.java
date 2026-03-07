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
}
