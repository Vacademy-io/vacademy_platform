package vacademy.io.admin_core_service.features.instructor_copilot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.instructor_copilot.entity.InstructorCopilotLog;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface InstructorCopilotLogRepository extends JpaRepository<InstructorCopilotLog, String> {

    @Query("SELECT l FROM InstructorCopilotLog l WHERE l.instituteId = :instituteId AND l.status = :status AND l.createdAt BETWEEN :startDate AND :endDate ORDER BY l.createdAt DESC")
    List<InstructorCopilotLog> findLogsByInstituteAndStatusAndDateRange(
            @Param("instituteId") String instituteId,
            @Param("status") String status,
            @Param("startDate") Timestamp startDate,
            @Param("endDate") Timestamp endDate);

    List<InstructorCopilotLog> findByInstituteId(String instituteId);
}
