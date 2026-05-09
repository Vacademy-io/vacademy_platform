package vacademy.io.admin_core_service.features.learner_operation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_operation.entity.LearnerOperation;

import java.util.Optional;

public interface LearnerOperationRepository extends JpaRepository<LearnerOperation, String> {
        @Query(value = "SELECT * FROM learner_operation " +
                        "WHERE user_id = :userId " +
                        "AND source = :source " +
                        "AND source_id = :sourceId " +
                        "AND operation = :operation " +
                        "ORDER BY updated_at DESC " + // Order by latest updated_at
                        "LIMIT 1", nativeQuery = true)
        Optional<LearnerOperation> findByUserIdAndSourceAndSourceIdAndOperation(
                        @Param("userId") String userId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("operation") String operation);

        @Modifying
        @Query("DELETE FROM LearnerOperation lo WHERE lo.source = :source AND lo.sourceId = :sourceId AND lo.operation = :operation AND lo.userId = :userId")
        void deleteBySourceAndSourceIdAndOperationAndUserId(String source, String sourceId, String operation,
                        String userId);

        /**
         * Find all learner operations for a user within a date range
         * Used for student analysis report generation
         */
        @Query(value = "SELECT * FROM learner_operation " +
                        "WHERE user_id = :userId " +
                        "AND created_at BETWEEN :startDate AND :endDate " +
                        "ORDER BY created_at DESC", nativeQuery = true)
        java.util.List<LearnerOperation> findByUserIdAndDateRange(
                        @Param("userId") String userId,
                        @Param("startDate") java.sql.Timestamp startDate,
                        @Param("endDate") java.sql.Timestamp endDate);

        /**
         * Returns the highest PERCENTAGE_PACKAGE_SESSION_COMPLETED value across all
         * package_sessions of the given course for the given user. If the learner
         * has no learner_operation rows for this course (e.g., not enrolled or
         * never started), returns NULL.
         *
         * MAX is used (not SUM) so multi-enrollment learners see their best progress
         * for the course, capped naturally at 100.
         */
        @Query(value = """
                        SELECT MAX(CAST(lo.value AS DOUBLE PRECISION))
                        FROM learner_operation lo
                        JOIN package_session ps ON ps.id = lo.source_id
                        WHERE ps.package_id = :courseId
                          AND lo.user_id = :userId
                          AND lo.source = 'PACKAGE_SESSION'
                          AND lo.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
                          AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
                        """, nativeQuery = true)
        Double findMaxCoursePercentageForUser(
                        @Param("courseId") String courseId,
                        @Param("userId") String userId);
}
