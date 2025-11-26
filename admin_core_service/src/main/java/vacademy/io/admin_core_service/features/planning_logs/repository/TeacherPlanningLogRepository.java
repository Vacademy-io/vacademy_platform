package vacademy.io.admin_core_service.features.planning_logs.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.planning_logs.entity.TeacherPlanningLog;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeacherPlanningLogRepository extends JpaRepository<TeacherPlanningLog, String> {

        List<TeacherPlanningLog> findByInstituteIdAndStatusOrderByCreatedAtDesc(String instituteId, String status);

        List<TeacherPlanningLog> findByInstituteIdOrderByCreatedAtDesc(String instituteId);

        Optional<TeacherPlanningLog> findByIdAndInstituteId(String id, String instituteId);

        List<TeacherPlanningLog> findByCreatedByUserIdAndInstituteIdAndStatus(String userId, String instituteId,
                        String status);

        List<TeacherPlanningLog> findByEntityIdAndInstituteIdAndStatus(String entityId, String instituteId,
                        String status);
}
