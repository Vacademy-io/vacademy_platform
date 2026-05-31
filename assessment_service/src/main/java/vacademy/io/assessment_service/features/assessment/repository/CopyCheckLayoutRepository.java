package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.CopyCheckLayout;

import java.util.Optional;

@Repository
public interface CopyCheckLayoutRepository extends JpaRepository<CopyCheckLayout, String> {

    Optional<CopyCheckLayout> findByEvaluationProcessId(String evaluationProcessId);

    Optional<CopyCheckLayout> findByAttemptId(String attemptId);
}
