package vacademy.io.admin_core_service.features.packages.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.packages.entity.CourseStructureChangesLog;

import java.util.List;
import java.util.Optional;

public interface CourseStructureChangesLogRepository extends JpaRepository<CourseStructureChangesLog, String> {
    Optional<CourseStructureChangesLog> findByUserIdAndSourceIdAndSourceTypeAndStatusIn(
        String userId, String sourceId, String sourceType, List<String> statusList
    );
}
