package vacademy.io.assessment_service.features.learner_assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
            AND qwm.question_id = :questionId
            AND qwm.section_id = :sectionId LIMIT 1
            """, nativeQuery = true)
    Optional<QuestionWiseMarks> findByAssessmentIdAndStudentAttemptIdAndQuestionIdAndSectionId(
            @Param("assessmentId") String assessmentId,
            @Param("attemptId") String attemptId,
            @Param("questionId") String questionId,
            @Param("sectionId") String sectionId);

    @Query(value = """
            SELECT
                qwm.question_id as questionId,
                SUM(CASE WHEN qwm.status = 'CORRECT' THEN 1 ELSE 0 END) AS correctAttempt,
                SUM(CASE WHEN qwm.status = 'INCORRECT' THEN 1 ELSE 0 END) AS incorrectAttempt,
                SUM(CASE WHEN qwm.status = 'PARTIAL_CORRECT' THEN 1 ELSE 0 END) AS partialCorrectAttempt
            FROM question_wise_marks qwm
            WHERE qwm.assessment_id = :assessmentId
            and qwm.question_id  = :questionId
            and qwm.section_id = :sectionId
            GROUP BY qwm.question_id
            LIMIT 1
            """, nativeQuery = true)
    QuestionStatusDto findQuestionStatusAssessmentIdAndQuestionId(@Param("assessmentId") String assessmentId,
            @Param("questionId") String questionId,
            @Param("sectionId") String sectionId);

    @Query(value = """
            select aur.user_id as userId, aur.participant_name as name, qwm.time_taken_in_seconds as timeTakenInSeconds from question_wise_marks qwm
            join student_attempt sa on sa.id = qwm.attempt_id
            join assessment_user_registration aur on aur.id = sa.registration_id
            WHERE qwm.assessment_id = :assessmentId
            and qwm.question_id  = :questionId
            and qwm.section_id = :sectionId
            and qwm.status = 'CORRECT'
             order by qwm.time_taken_in_seconds asc limit 3
            """, nativeQuery = true)
    List<Top3CorrectResponseDto> findTop3ParticipantsForCorrectResponse(@Param("assessmentId") String assessmentId,
            @Param("questionId") String questionId,
            @Param("sectionId") String sectionId);

    @Query(value = """
            SELECT qwm.* from question_wise_marks as qwm
            WHERE qwm.question_id IN (:questionIds)
            AND qwm.attempt_id = :attemptId
            AND qwm.section_id = :sectionId
            """, nativeQuery = true)
    List<QuestionWiseMarks> findAllQuestionWiseMarksForQuestionIdAndAttemptId(
            @Param("questionIds") List<String> questionIds,
            @Param("attemptId") String attemptId,
            @Param("sectionId") String sectionId);

    List<QuestionWiseMarks> findByStudentAttemptId(String attemptId);

    /**
     * Fetch QuestionWiseMarks with eagerly loaded Question and Options to avoid
     * lazy initialization errors
     * Used in async AI evaluation where session is not available
     */
    @Query("SELECT DISTINCT qwm FROM QuestionWiseMarks qwm " +
            "LEFT JOIN FETCH qwm.question q " +
            "LEFT JOIN FETCH q.options " +
            "WHERE qwm.studentAttempt.id = :attemptId")
    List<QuestionWiseMarks> findByStudentAttemptIdWithQuestionDetails(@Param("attemptId") String attemptId);

    List<QuestionWiseMarks> findByStudentAttemptIdAndAssessmentId(String attemptId, String assessmentId);

    @Query(value = """
            SELECT qwm.* from question_wise_marks as qwm
            WHERE qwm.question_id = :questionId
            AND qwm.assessment_id = :assessmentId
            AND qwm.section_id = :sectionId
            ORDER BY qwm.created_at DESC
            """, nativeQuery = true)
    List<QuestionWiseMarks> findByAssessmentIdAndQuestionIdAndSectionId(@Param("questionId") String questionId,
            @Param("assessmentId") String assessmentId,
            @Param("sectionId") String sectionId);

    @Query(value = """
            select COUNT(distinct aur.user_id) from question_wise_marks qwm
            join assessment a on qwm.assessment_id = a.id
            join student_attempt sa on sa.id = qwm.attempt_id
            join assessment_user_registration aur on sa.registration_id = aur.id
            and qwm.assessment_id = :assessmentId
            """, nativeQuery = true)
    Long countUniqueRespondentForAssessment(@Param("assessmentId") String assessmentId);

    @Query(value = """
            SELECT qwm.*
            FROM question_wise_marks qwm
            JOIN student_attempt sa
              ON qwm.attempt_id = sa.id
            JOIN assessment_user_registration qur
              ON sa.registration_id = qur.id
            WHERE sa.id IN (
                SELECT DISTINCT ON (sa2.registration_id) sa2.id
                FROM student_attempt sa2
                ORDER BY sa2.registration_id, sa2.start_time DESC
            )
            AND (:name IS NULL OR (qur.participant_name ILIKE %:name% OR qur.user_email ILIKE %:name%))
            AND (:instituteId IS NULL OR qur.institute_id = :instituteId)
            AND (:questionIds IS NULL OR qwm.question_id IN (:questionIds))
            AND (:assessmentIds IS NULL OR qwm.assessment_id IN (:assessmentIds))
            AND (:sectionIds IS NULL OR qwm.section_id IN (:sectionIds))
            AND (:status IS NULL OR qur.status IN (:status))
            """, countQuery = """
            SELECT COUNT(*)
            FROM question_wise_marks qwm
            JOIN student_attempt sa
              ON qwm.attempt_id = sa.id
            JOIN assessment_user_registration qur
              ON sa.registration_id = qur.id
            WHERE sa.id IN (
                SELECT DISTINCT ON (sa2.registration_id) sa2.id
                FROM student_attempt sa2
                ORDER BY sa2.registration_id, sa2.start_time DESC
            )
            AND (:name IS NULL OR (qur.participant_name ILIKE %:name% OR qur.user_email ILIKE %:name%))
            AND (:instituteId IS NULL OR qur.institute_id = :instituteId)
            AND (:questionIds IS NULL OR qwm.question_id IN (:questionIds))
            AND (:assessmentIds IS NULL OR qwm.assessment_id IN (:assessmentIds))
            AND (:sectionIds IS NULL OR qwm.section_id IN (:sectionIds))
            AND (:status IS NULL OR qur.status IN (:status))
            """, nativeQuery = true)
    Page<QuestionWiseMarks> findSurveyResponseWithFilterAndSearch(
            @Param("name") String name,
            @Param("instituteId") String instituteId,
            @Param("questionIds") List<String> questionIds,
            @Param("assessmentIds") List<String> assessmentIds,
            @Param("sectionIds") List<String> sectionIds,
            @Param("status") List<String> status,
            Pageable pageable);

    @Query(value = """
            SELECT qwm.*
            FROM question_wise_marks qwm
            JOIN student_attempt sa
              ON qwm.attempt_id = sa.id
            JOIN assessment_user_registration qur
              ON sa.registration_id = qur.id
            AND (:name IS NULL OR (qur.participant_name ILIKE %:name% OR qur.user_email ILIKE %:name%))
            AND (:instituteId IS NULL OR qur.institute_id = :instituteId)
            AND (:attemptIds IS NULL OR qwm.attempt_id IN (:attemptIds))
            AND (:assessmentIds IS NULL OR qwm.assessment_id IN (:assessmentIds))
            AND (:status IS NULL OR qur.status IN (:status))
            """, countQuery = """
            SELECT COUNT(*)
            FROM question_wise_marks qwm
            JOIN student_attempt sa
              ON qwm.attempt_id = sa.id
            JOIN assessment_user_registration qur
              ON sa.registration_id = qur.id
            AND (:name IS NULL OR (qur.participant_name ILIKE %:name% OR qur.user_email ILIKE %:name%))
            AND (:instituteId IS NULL OR qur.institute_id = :instituteId)
            AND (:attemptIds IS NULL OR qwm.attempt_id IN (:attemptIds))
            AND (:assessmentIds IS NULL OR qwm.assessment_id IN (:assessmentIds))
            AND (:status IS NULL OR qur.status IN (:status))
            """, nativeQuery = true)
    Page<QuestionWiseMarks> findResponseForRespondentWithFilterAndSearch(
            @Param("name") String name,
            @Param("instituteId") String instituteId,
            @Param("attemptIds") List<String> attemptIds,
            @Param("assessmentIds") List<String> assessmentIds,
            @Param("status") List<String> status,
            Pageable pageable);

    @Query(value = """
            SELECT qwm.*
            FROM question_wise_marks qwm
            JOIN student_attempt sa ON qwm.attempt_id = sa.id
            JOIN assessment_user_registration qur ON sa.registration_id = qur.id
            WHERE qwm.assessment_id = :assessmentId
            AND qur.user_id = :userId
            AND qur.institute_id = :instituteId
            AND sa.id IN (
                SELECT DISTINCT ON (sa2.registration_id) sa2.id
                FROM student_attempt sa2
                JOIN assessment_user_registration qur2 ON sa2.registration_id = qur2.id
                WHERE qur2.user_id = :userId
                AND qur2.institute_id = :instituteId
                ORDER BY sa2.registration_id, sa2.start_time DESC
            )
            ORDER BY qwm.section_id, qwm.created_at
            """, nativeQuery = true)
    List<QuestionWiseMarks> findStudentSurveyResponsesByAssessmentAndUser(
            @Param("assessmentId") String assessmentId,
            @Param("userId") String userId,
            @Param("instituteId") String instituteId);

    @Query(value = """
            SELECT DISTINCT ON (aur.user_id) sa.id
            FROM question_wise_marks qwm
            JOIN assessment a ON qwm.assessment_id = a.id
            JOIN student_attempt sa ON sa.id = qwm.attempt_id
            JOIN assessment_user_registration aur ON sa.registration_id = aur.id
            WHERE qwm.assessment_id = :assessmentId
            ORDER BY aur.user_id, sa.start_time DESC;
            """, nativeQuery = true)
    List<String> findDistinctAttemptIdsForAssessment(@Param("assessmentId") String assessmentId);
}
