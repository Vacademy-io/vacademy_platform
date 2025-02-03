package vacademy.io.assessment_service.features.learner_assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;

import java.util.Optional;

@Repository
public interface QuestionWiseMarksRepository extends JpaRepository<QuestionWiseMarks, String> {
    @Query(value = """
            SELECT qwm.* from question_wise_marks qwm
            WHERE qwm.assessment_id = :assessmentId
            AND qwm.attempt_id = :attemptId
            AND qwm.question_id = :questionId  LIMIT 1
            """, nativeQuery = true)
    Optional<QuestionWiseMarks> findByAssessmentIdAndStudentAttemptIdAndQuestionId(@Param("assessmentId") String assessmentId,
                                                                                   @Param("attemptId") String attemptId,
                                                                                   @Param("questionId") String questionId);
}
