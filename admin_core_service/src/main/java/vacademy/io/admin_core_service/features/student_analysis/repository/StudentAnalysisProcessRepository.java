package vacademy.io.admin_core_service.features.student_analysis.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;

import java.time.LocalDate;
import java.util.Optional;

public interface StudentAnalysisProcessRepository extends JpaRepository<StudentAnalysisProcess, String> {

        /**
         * Find process by ID
         */
        Optional<StudentAnalysisProcess> findById(String id);

        /**
         * Find all completed reports for a user with pagination
         */
        Page<StudentAnalysisProcess> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, String status,
                        Pageable pageable);

        /**
         * Find the most recent prior COMPLETED v2 report for the same user + packageSession
         * whose report window ends before the given cutoff date.
         *
         * <p>Used by the aggregator to obtain prior-period metrics for trend/change computations.
         * READ-ONLY — SELECT only, no mutations.
         */
        @Query(value = """
                        SELECT * FROM student_analysis_process
                        WHERE user_id = :userId
                          AND package_session_id = :packageSessionId
                          AND status = 'COMPLETED'
                          AND report_version = 'v2'
                          AND end_date_iso < :endDateBefore
                        ORDER BY end_date_iso DESC
                        LIMIT 1
                        """, nativeQuery = true)
        Optional<StudentAnalysisProcess> findMostRecentPriorV2Report(
                        @Param("userId") String userId,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("endDateBefore") LocalDate endDateBefore);
}
