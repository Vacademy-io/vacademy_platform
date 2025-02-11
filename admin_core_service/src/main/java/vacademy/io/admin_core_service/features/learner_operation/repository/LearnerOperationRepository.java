package vacademy.io.admin_core_service.features.learner_operation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
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
            "LIMIT 1", nativeQuery = true)
    Optional<LearnerOperation> findByUserIdAndSourceAndSourceIdAndOperation(
            @Param("userId") String userId,
            @Param("source") String source,
            @Param("sourceId") String sourceId,
            @Param("operation") String operation
    );
}
