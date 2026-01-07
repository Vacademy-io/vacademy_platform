package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiEvaluationProcessRepository extends JpaRepository<AiEvaluationProcess, String> {

        Optional<AiEvaluationProcess> findByStudentAttempt_Id(String attemptId);

        Optional<AiEvaluationProcess> findByStudentAttemptId(String attemptId);

        List<AiEvaluationProcess> findByStatus(String status);

        List<AiEvaluationProcess> findByStatusAndRetryCountLessThan(String status, Integer maxRetryCount);

        List<AiEvaluationProcess> findByAssessmentId(String assessmentId);

        /**
         * Fetch AiEvaluationProcess with eagerly loaded StudentAttempt to avoid lazy
         * initialization errors
         */
        @Query("SELECT p FROM AiEvaluationProcess p LEFT JOIN FETCH p.studentAttempt WHERE p.id = :processId")
        Optional<AiEvaluationProcess> findByIdWithStudentAttempt(@Param("processId") String processId);

        /**
         * Fetch AiEvaluationProcess with eagerly loaded StudentAttempt, Registration,
         * and Assessment
         * for the progress API
         */
        @Query("SELECT p FROM AiEvaluationProcess p " +
                        "LEFT JOIN FETCH p.studentAttempt sa " +
                        "LEFT JOIN FETCH sa.registration reg " +
                        "LEFT JOIN FETCH reg.assessment " +
                        "WHERE p.id = :processId")
        Optional<AiEvaluationProcess> findByIdWithCompleteDetails(@Param("processId") String processId);
}
