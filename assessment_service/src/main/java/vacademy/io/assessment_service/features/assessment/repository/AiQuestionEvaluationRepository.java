package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

        /**
         * Per-process count of questions in a given status across a whole
         * assessment, as [processId, count] rows. One query for the dashboard's
         * "needs review" badge, avoiding an N+1 count per process.
         */
        @Query("SELECT q.evaluationProcess.id, COUNT(q) FROM AiQuestionEvaluation q " +
                        "WHERE q.evaluationProcess.assessment.id = :assessmentId AND q.status = :status " +
                        "GROUP BY q.evaluationProcess.id")
        List<Object[]> countByAssessmentGroupedByProcess(@Param("assessmentId") String assessmentId,
                        @Param("status") String status);
}
