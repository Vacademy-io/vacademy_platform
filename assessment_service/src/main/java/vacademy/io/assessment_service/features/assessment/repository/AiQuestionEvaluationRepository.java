package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiQuestionEvaluationRepository extends JpaRepository<AiQuestionEvaluation, String> {

        List<AiQuestionEvaluation> findByEvaluationProcessIdOrderByQuestionNumberAsc(String evaluationProcessId);

        List<AiQuestionEvaluation> findByEvaluationProcessIdAndStatus(String evaluationProcessId, String status);

        Optional<AiQuestionEvaluation> findByEvaluationProcessIdAndQuestionId(String evaluationProcessId,
                        String questionId);

        long countByEvaluationProcessIdAndStatus(String evaluationProcessId, String status);
}
