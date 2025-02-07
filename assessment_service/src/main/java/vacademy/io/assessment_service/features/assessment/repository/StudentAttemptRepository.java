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
        WITH RankedAttempts AS (
            SELECT
                sa.id AS attemptId,
                aur.user_id AS userId,
                aur.participant_name AS studentName,
                aur.source_id AS batchId,
                sa.total_time_in_seconds AS completionTimeInSeconds,
                sa.total_marks AS achievedMarks,
                aur.status,
                sa.submit_time,
                ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
            FROM student_attempt sa
            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
            WHERE aur.assessment_id = :assessmentId
            AND aur.institute_id = :instituteId
            AND sa.status IN ('LIVE', 'ENDED')
            AND (:statusList IS NULL OR aur.status IN (:statusList))
        )
        SELECT
            attemptId,
            userId,
            studentName,
            batchId,
            completionTimeInSeconds,
            achievedMarks,
            status,
            DENSE_RANK() OVER (ORDER BY achievedMarks DESC, completionTimeInSeconds ASC) AS rank
        FROM RankedAttempts
        WHERE rn = 1
        ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
        """,
            countQuery = """
        WITH RankedAttempts AS (
            SELECT
                sa.id AS attemptId,
                ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
            FROM student_attempt sa
            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
            WHERE aur.assessment_id = :assessmentId
            AND aur.institute_id = :instituteId
            AND sa.status IN ('LIVE', 'ENDED')
            AND (:statusList IS NULL OR aur.status IN (:statusList))
        )
        SELECT count(attemptId)
        FROM RankedAttempts
        WHERE rn = 1
        ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
        """,
            nativeQuery = true)
    Page<LeaderBoardDto> findLeaderBoardForAssessmentAndInstituteIdWithoutSearch(
            @Param("assessmentId") String assessmentId,
            @Param("instituteId") String instituteId,
            @Param("statusList") List<String> statusList,
            Pageable pageable);



    @Query(value = """
            WITH RankedAttempts AS (
                SELECT
                    sa.id AS attemptId,
                    aur.user_id AS userId,
                    aur.participant_name AS studentName,
                    aur.source_id AS batchId,
                    sa.total_time_in_seconds AS completionTimeInSeconds,
                    sa.total_marks AS achievedMarks,
                    aur.status,
                    sa.submit_time,
                    ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
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
            )
            SELECT
                attemptId,
                userId,
                studentName,
                batchId,
                completionTimeInSeconds,
                achievedMarks,
                status,
                DENSE_RANK() OVER (ORDER BY achievedMarks DESC, completionTimeInSeconds ASC) AS rank
            FROM RankedAttempts
            WHERE rn = 1
            ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
            """,countQuery = """
            WITH RankedAttempts AS (
                SELECT
                    sa.id AS attemptId,
                    ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
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
            )
            SELECT
                count(attemptId)
            FROM RankedAttempts
            WHERE rn = 1
            ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
            """, nativeQuery = true)
    public Page<LeaderBoardDto> findLeaderBoardForAssessmentAndInstituteIdWithSearch(@Param("name") String name,
                                                                                     @Param("assessmentId") String assessmentId,
                                                                                        @Param("instituteId") String instituteId,
                                                                                        @Param("statusList") List<String> statusList,
                                                                                        Pageable pageable);
}



