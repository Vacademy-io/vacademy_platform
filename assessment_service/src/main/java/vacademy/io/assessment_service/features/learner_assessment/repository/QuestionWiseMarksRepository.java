package vacademy.io.assessment_service.features.learner_assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.Top3CorrectResponseDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.QuestionStatusDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;

import java.util.List;
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

    @Query(value = """
            SELECT
                qwm.question_id as questionId,
                SUM(CASE WHEN qwm.status = 'CORRECT' THEN 1 ELSE 0 END) AS correctAttempt,
                SUM(CASE WHEN qwm.status = 'INCORRECT' THEN 1 ELSE 0 END) AS incorrectAttempt,
                SUM(CASE WHEN qwm.status = 'PARTIAL_CORRECT' THEN 1 ELSE 0 END) AS partialCorrectAttempt
            FROM question_wise_marks qwm
            WHERE qwm.assessment_id = :assessmentId
            and qwm.question_id  = :questionId
            GROUP BY qwm.question_id
            LIMIT 1
            """, nativeQuery = true)
    QuestionStatusDto findQuestionStatusAssessmentIdAndQuestionId(@Param("assessmentId") String assessmentId,
                                                                  @Param("questionId") String questionId);



    @Query(value = """
            select aur.user_id as userId, aur.participant_name as name, qwm.time_taken_in_seconds as timeTakenInSeconds from question_wise_marks qwm
            join student_attempt sa on sa.id = qwm.attempt_id
            join assessment_user_registration aur on aur.id = sa.registration_id
            WHERE qwm.assessment_id = :assessmentId
            and qwm.question_id  = :questionId
            and qwm.status = 'CORRECT'
             order by qwm.time_taken_in_seconds asc limit 3
            """, nativeQuery = true)
    List<Top3CorrectResponseDto> findTop3ParticipantsForCorrectResponse(@Param("assessmentId") String assessmentId,
                                                                  @Param("questionId") String questionId);


    @Query(value = """
            SELECT qwm.* from question_wise_marks as qwm
            WHERE qwm.question_id IN (:questionIds)
            AND qwm.attempt_id = :attemptId
            """)
    List<QuestionWiseMarks> findAllQuestionWiseMarksForQuestionIdAndAttemptId(@Param("questionIds") List<String> questionIds,
                                                                              @Param("attemptId") String attemptId);
}
