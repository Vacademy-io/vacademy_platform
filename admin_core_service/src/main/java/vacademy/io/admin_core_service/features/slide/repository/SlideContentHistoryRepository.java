package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.slide.entity.SlideContentHistory;

public interface SlideContentHistoryRepository extends JpaRepository<SlideContentHistory, Long> {

    Page<SlideContentHistory> findBySourceTableAndSourceIdOrderByChangedAtDesc(String sourceTable,
            String sourceId,
            Pageable pageable);
}
