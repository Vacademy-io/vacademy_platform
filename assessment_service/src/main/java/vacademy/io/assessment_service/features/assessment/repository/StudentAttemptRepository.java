package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;

import java.util.List;

@Repository
public interface StudentAttemptRepository extends CrudRepository<StudentAttempt, String> {


    @Query(value = """
            SELECT
                sa.id AS attemptId,
                aur.user_id AS userId,
                aur.participant_name AS studentName,
                aur.source_id AS batchId,
                sa.total_time_in_seconds AS completionTimeInSeconds,
                sa.total_marks AS achievedMarks,
                DENSE_RANK() OVER (ORDER BY sa.total_marks DESC, sa.total_time_in_seconds ASC) AS rank
            FROM student_attempt sa
            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
            WHERE aur.assessment_id = :assessmentId
            AND aur.institute_id = :instituteId
            AND sa.status IN ('LIVE', 'ENDED')
            AND (:statusList IS NULL OR aur.status IN (:statusList))
            """,countQuery = """
            SELECT
                count(sa.id)
            FROM student_attempt sa
            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
            WHERE aur.assessment_id = :assessmentId
            AND aur.institute_id = :instituteId
            AND sa.status IN ('LIVE', 'ENDED')
            AND (:statusList IS NULL OR aur.status IN (:statusList))
            """,nativeQuery = true)
    public Page<LeaderBoardDto> findLeaderBoardForAssessmentAndInstituteIdWithoutSearch(@Param("assessmentId") String assessmentId,
                                                                                        @Param("instituteId") String instituteId,
                                                                                        @Param("statusList") List<String> statusList,
                                                                                        Pageable pageable);


    @Query(value = """
            SELECT
                sa.id AS attemptId,
                aur.user_id AS userId,
                aur.participant_name AS studentName,
                aur.source_id AS batchId,
                sa.total_time_in_seconds AS completionTimeInSeconds,
                sa.total_marks AS achievedMarks,
                DENSE_RANK() OVER (ORDER BY sa.total_marks DESC, sa.total_time_in_seconds ASC) AS rank
            FROM student_attempt sa
            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
            WHERE aur.assessment_id = :assessmentId
            AND aur.institute_id = :instituteId
            AND (
                    to_tsvector('simple', concat(
                    aur.participant_name
                    )) @@ plainto_tsquery('simple', :name)
                    OR aur.participant_name LIKE :name || '%'
                   )
            AND sa.status IN ('LIVE', 'ENDED')
            AND (:statusList IS NULL OR aur.status IN (:statusList))
            """,countQuery = """
            SELECT
                count(sa.id)
            FROM student_attempt sa
            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
            WHERE aur.assessment_id = :assessmentId
            AND aur.institute_id = :instituteId
            AND (
                    to_tsvector('simple', concat(
                    aur.participant_name
                    )) @@ plainto_tsquery('simple', :name)
                    OR aur.participant_name LIKE :name || '%'
                   )
            AND sa.status IN ('LIVE', 'ENDED')
            AND (:statusList IS NULL OR aur.status IN (:statusList))
            """, nativeQuery = true)
    public Page<LeaderBoardDto> findLeaderBoardForAssessmentAndInstituteIdWithSearch(@Param("name") String name,
                                                                                     @Param("assessmentId") String assessmentId,
                                                                                        @Param("instituteId") String instituteId,
                                                                                        @Param("statusList") List<String> statusList,
                                                                                        Pageable pageable);
}