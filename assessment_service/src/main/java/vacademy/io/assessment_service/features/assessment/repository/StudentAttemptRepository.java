package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.AssessmentOverviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.MarksRankDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.ParticipantsQuestionOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportDto;
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
                                ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn,
                                DENSE_RANK() OVER (ORDER BY sa.total_marks DESC, sa.total_time_in_seconds ASC) AS rank
                            FROM student_attempt sa
                            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                            WHERE aur.assessment_id = :assessmentId
                            AND aur.institute_id = :instituteId
                            AND sa.status IN ('LIVE', 'ENDED')
                            AND (:statusList IS NULL OR aur.status IN (:statusList))
                        )
                        ,TotalParticipants AS (
                            SELECT COUNT(*) AS totalParticipants FROM RankedAttempts WHERE rn = 1
                        )
                        SELECT
                            attemptId,
                            userId,
                            studentName,
                            batchId,
                            completionTimeInSeconds,
                            achievedMarks,
                            status,
                            rank,
                            ROUND(CAST(100.0 * (1.0 - (CAST(ra.rank - 1 AS FLOAT) / NULLIF(t.totalParticipants * 1.0, 0))) AS NUMERIC), 2) AS percentile
                        FROM RankedAttempts as ra, TotalParticipants as t
                        WHERE rn = 1
                        ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
        """,
            countQuery = """
                    WITH RankedAttempts AS (
                                    SELECT
                                        sa.id AS attemptId,
                                    FROM student_attempt sa
                                    JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                                    WHERE aur.assessment_id = :assessmentId
                                    AND aur.institute_id = :instituteId
                                    AND sa.status IN ('LIVE', 'ENDED')
                                    AND (:statusList IS NULL OR aur.status IN (:statusList))
                                )
                                ,TotalParticipants AS (
                                    SELECT COUNT(*) AS totalParticipants FROM RankedAttempts WHERE rn = 1
                                )
                                SELECT
                                    count(attemptId)
                                FROM RankedAttempts as ra, TotalParticipants as t
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
                                ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn,
                                DENSE_RANK() OVER (ORDER BY sa.total_marks DESC, sa.total_time_in_seconds ASC) AS rank
                            FROM student_attempt sa
                            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                            WHERE aur.assessment_id = :assessmentId
                            AND aur.institute_id = :instituteId
                            AND sa.status IN ('LIVE', 'ENDED')
                            AND (:statusList IS NULL OR aur.status IN (:statusList))
                        )
                        ,TotalParticipants AS (
                                        SELECT COUNT(*) AS totalParticipants FROM RankedAttempts WHERE rn = 1
                                    )
                        SELECT
                            attemptId,
                            userId,
                            studentName,
                            batchId,
                            completionTimeInSeconds,
                            achievedMarks,
                            status,
                            rank,
                            ROUND(CAST(100.0 * (1.0 - (CAST(ra.rank - 1 AS FLOAT) / NULLIF(t.totalParticipants * 1.0, 0))) AS NUMERIC), 2) AS percentile
                        FROM RankedAttempts as ra,TotalParticipants as t
                        WHERE rn = 1
                        AND (
                                to_tsvector('simple', concat(
                                ra.studentName
                                )) @@ plainto_tsquery('simple', :name)
                                OR ra.studentName LIKE :name || '%'
                               )
                        ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
            """,countQuery = """
            WITH RankedAttempts AS (
                            SELECT
                                sa.id AS attemptId,
                                ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn,
                                DENSE_RANK() OVER (ORDER BY sa.total_marks DESC, sa.total_time_in_seconds ASC) AS rank
                            FROM student_attempt sa
                            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                            WHERE aur.assessment_id = :assessmentId
                            AND aur.institute_id = :instituteId
                            AND sa.status IN ('LIVE', 'ENDED')
                            AND (:statusList IS NULL OR aur.status IN (:statusList))
                        )
                        SELECT
                            count(attemptId)
                        WHERE rn = 1
                        AND (
                                to_tsvector('simple', concat(
                                ra.studentName
                                )) @@ plainto_tsquery('simple', :name)
                                OR ra.studentName LIKE :name || '%'
                               )
                        ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
            """, nativeQuery = true)
    public Page<LeaderBoardDto> findLeaderBoardForAssessmentAndInstituteIdWithSearch(@Param("name") String name,
                                                                                     @Param("assessmentId") String assessmentId,
                                                                                        @Param("instituteId") String instituteId,
                                                                                        @Param("statusList") List<String> statusList,
                                                                                        Pageable pageable);


    @Query(value = """
            WITH LatestAttempts AS (
                SELECT sa.id AS attemptId, sa.total_marks AS achievedMarks, aur.user_id AS userId,
                       ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
                FROM student_attempt sa
                JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                WHERE aur.assessment_id = :assessmentId
                AND aur.institute_id = :instituteId
                AND sa.status in ('ENDED','LIVE')
            ),
            RankedAttempts AS (
                SELECT achievedMarks,
                       DENSE_RANK() OVER (ORDER BY achievedMarks DESC) AS rank,
                       COUNT(*) OVER (PARTITION BY achievedMarks) AS noOfParticipants
                FROM LatestAttempts
                WHERE rn = 1
            ),
            TotalParticipants AS (
                SELECT COUNT(*) AS totalParticipants FROM LatestAttempts WHERE rn = 1
            )
            SELECT
                distinct r.achievedMarks as marks,
                r.rank as rank,
                r.noOfParticipants as noOfParticipants,
                ROUND(CAST(100.0 * (1.0 - (CAST(r.rank - 1 AS FLOAT) / NULLIF(t.totalParticipants * 1.0, 0))) AS NUMERIC), 2) AS percentile
            FROM RankedAttempts r, TotalParticipants t
            ORDER BY r.rank ASC
            """, nativeQuery = true)
    List<MarksRankDto> findMarkRankForAssessment(@Param("assessmentId") String assessmentId,
                                                        @Param("instituteId") String instituteId);



    @Query(value = """
            WITH LatestAttempts AS (
                SELECT
                    sa.id AS attemptId,
                    sa.total_marks AS achievedMarks,
                    sa.total_time_in_seconds AS totalTime,
                    aur.user_id AS userId,
                    sa.status AS attemptStatus,
                    ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
                FROM student_attempt sa
                JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                WHERE aur.assessment_id = :assessmentId
                AND aur.institute_id = :instituteId
                AND sa.status IN ('ENDED', 'LIVE')
            ),
            AssessmentInfo AS (
                SELECT
                    a.id AS assessment_id,
                    a.created_at,
                    a.bound_start_time,
                    a.bound_end_time,
                    a.duration,
                    aim.subject_id
                FROM assessment a
                JOIN assessment_institute_mapping aim ON a.id = aim.assessment_id
                WHERE a.id = :assessmentId
            )
            SELECT
                ai.created_at AS createdOn,
                ai.bound_start_time AS startDateAndTime,
                ai.bound_end_time AS endDateAndTime,
                ai.duration AS durationInMin,
                ai.subject_id AS subjectId,
                COUNT(la.userId) AS totalParticipants,
                COALESCE(AVG(la.totalTime), 0) AS averageDuration,
                COALESCE(AVG(la.achievedMarks), 0) AS averageMarks,
                COUNT(CASE WHEN la.attemptStatus = 'ENDED' THEN 1 END) AS totalAttempted,
                COUNT(CASE WHEN la.attemptStatus = 'LIVE' THEN 1 END) AS totalOngoing
            FROM AssessmentInfo ai
            LEFT JOIN LatestAttempts la ON 1=1
            WHERE la.rn = 1 OR la.rn IS NULL
            GROUP BY ai.created_at, ai.bound_start_time, ai.bound_end_time, ai.duration, ai.subject_id;
            """, nativeQuery = true)
    AssessmentOverviewDto findAssessmentOverviewDetails(@Param("assessmentId") String assessmentId,
                                                        @Param("instituteId") String instituteId);


    @Query(value = """
            SELECT
                a.id AS assessmentId,
                a.name AS assessmentName,
                sa.id AS attemptId,
                a.bound_start_time AS startTime,
                a.bound_end_time AS endTime,
                COALESCE(sa.status, 'PENDING') AS attemptStatus,
                sa.created_at AS attemptDate,
                sa.total_time_in_seconds AS durationInSeconds,
                sa.total_marks AS totalMarks,
                aim.subject_id as subjectId,
                CASE
                    WHEN a.bound_end_time < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 'ENDED'
                    ELSE 'LIVE'
                END AS assessmentStatus
            FROM public.assessment a
            LEFT JOIN public.assessment_institute_mapping aim
                ON a.id = aim.assessment_id
            LEFT JOIN public.assessment_user_registration aur
                ON a.id = aur.assessment_id
                AND aur.user_id = :userId
            LEFT JOIN public.student_attempt sa
                ON aur.id = sa.registration_id
                AND sa.id = (
                    SELECT sa_inner.id
                    FROM public.student_attempt sa_inner
                    WHERE sa_inner.registration_id = aur.id
                    ORDER BY sa_inner.created_at DESC
                    LIMIT 1
                )
            WHERE aim.institute_id = :instituteId
            AND COALESCE(sa.status, 'PENDING') IN (:statusList)
            and a.status = 'PUBLISHED'
            """,countQuery = """
            SELECT COUNT(*)
            FROM public.assessment a
            LEFT JOIN public.assessment_institute_mapping aim
                ON a.id = aim.assessment_id
            LEFT JOIN public.assessment_user_registration aur
                ON a.id = aur.assessment_id
                AND aur.user_id = :userId
            LEFT JOIN public.student_attempt sa
                ON aur.id = sa.registration_id
                AND sa.id = (
                    SELECT sa_inner.id
                    FROM public.student_attempt sa_inner
                    WHERE sa_inner.registration_id = aur.id
                    ORDER BY sa_inner.created_at DESC
                    LIMIT 1
                )
            WHERE aim.institute_id = :instituteId
            AND COALESCE(sa.status, 'PENDING') IN (:statusList)
            and a.status = 'PUBLISHED'
            """, nativeQuery = true)
    Page<StudentReportDto> findAssessmentForUserWithFilter(@Param("userId") String userId,
                                                     @Param("instituteId") String instituteId,
                                                     @Param("statusList") List<String> statusList,
                                                     Pageable pageable);


    @Query(value = """
            SELECT
                a.id AS assessmentId,
                a.name AS assessmentName,
                sa.id AS attempt_id,
                a.bound_start_time AS startTime,
                a.bound_end_time AS endTime,
                COALESCE(sa.status, 'PENDING') AS attemptStatus,
                sa.created_at AS attemptDate,
                sa.total_time_in_seconds AS durationInSeconds,
                sa.total_marks AS totalMarks,
                aim.subject_id as subjectId,
                CASE
                    WHEN a.bound_end_time < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 'ENDED'
                    ELSE 'LIVE'
                END AS assessmentStatus
            FROM public.assessment a
            LEFT JOIN public.assessment_institute_mapping aim
                ON a.id = aim.assessment_id
            LEFT JOIN public.assessment_user_registration aur
                ON a.id = aur.assessment_id
                AND aur.user_id = :userId
            LEFT JOIN public.student_attempt sa
                ON aur.id = sa.registration_id
                AND sa.id = (
                    SELECT sa_inner.id
                    FROM public.student_attempt sa_inner
                    WHERE sa_inner.registration_id = aur.id
                    ORDER BY sa_inner.created_at DESC
                    LIMIT 1
                )
            WHERE aim.institute_id = :instituteId
            AND (
                    to_tsvector('simple', concat(
                    a.name
                    )) @@ plainto_tsquery('simple', :name)
                    OR a.name LIKE :name || '%'
                   )
            AND COALESCE(sa.status, 'PENDING') IN (:statusList)
            and a.status = 'PUBLISHED'
            """,countQuery = """
            SELECT COUNT(*)
            FROM public.assessment a
            LEFT JOIN public.assessment_institute_mapping aim
                ON a.id = aim.assessment_id
            LEFT JOIN public.assessment_user_registration aur
                ON a.id = aur.assessment_id
                AND aur.user_id = :userId
            LEFT JOIN public.student_attempt sa
                ON aur.id = sa.registration_id
                AND sa.id = (
                    SELECT sa_inner.id
                    FROM public.student_attempt sa_inner
                    WHERE sa_inner.registration_id = aur.id
                    ORDER BY sa_inner.created_at DESC
                    LIMIT 1
                )
            WHERE aim.institute_id = :instituteId
            AND (
                    to_tsvector('simple', concat(
                    a.name
                    )) @@ plainto_tsquery('simple', :name)
                    OR a.name LIKE :name || '%'
                   )
            AND COALESCE(sa.status, 'PENDING') IN (:statusList)
            and a.status = 'PUBLISHED'
            """, nativeQuery = true)
    Page<StudentReportDto> findAssessmentForUserWithFilterAndSearch(@Param("name") String name,
                                                                    @Param("userId") String userId,
                                                                    @Param("instituteId") String instituteId,
                                                                    @Param("statusList") List<String> statusList,
                                                                    Pageable pageable);

    @Query(value = """
            WITH RankedAttempts AS (
                SELECT
                    sa.id AS attemptId,
                    aur.user_id AS userId,
                    sa.total_time_in_seconds AS completionTimeInSeconds,
                    sa.total_marks AS achievedMarks,
                    aur.status,
                    sa.submit_time,
                    sa.start_time AS startTime,
                    aim.subject_id AS subjectId,
                    ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn
                FROM student_attempt sa
                JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                JOIN assessment a ON a.id = aur.assessment_id
                JOIN assessment_institute_mapping aim ON aim.assessment_id = a.id
                WHERE aur.assessment_id = :assessmentId
                AND aim.institute_id = :instituteId
                AND sa.status IN ('LIVE', 'ENDED')
                AND aur.status IN ('ACTIVE')
            ),
            TotalParticipants AS (
                SELECT COUNT(*) AS totalParticipants
                FROM assessment_user_registration aur2
                WHERE aur2.assessment_id = :assessmentId
            ),
            AttemptInformation AS (
                SELECT
                    attempt_id,
                    COUNT(*) FILTER (WHERE status = 'CORRECT') AS correct_count,
                    COUNT(*) FILTER (WHERE status = 'INCORRECT') AS wrong_count,
                    COUNT(*) FILTER (WHERE status = 'PARTIAL_CORRECT') AS partial_correct_count,
                    COUNT(*) FILTER (WHERE status IS NULL OR status = 'PENDING') AS skipped_count,
                    COALESCE(SUM(marks) FILTER (WHERE status = 'CORRECT'), 0) AS totalCorrectMarks,
                    COALESCE(SUM(marks) FILTER (WHERE status = 'INCORRECT'), 0) AS totalIncorrectMarks,
                    COALESCE(SUM(marks) FILTER (WHERE status = 'PARTIAL_CORRECT'), 0) AS totalPartialMarks
                FROM question_wise_marks
                WHERE attempt_id = :attemptId
                GROUP BY attempt_id
            ),
            RankedWithTotal AS (
                SELECT
                    attemptId,
                    userId,
                    completionTimeInSeconds,
                    achievedMarks,
                    status,
                    startTime,
                    subjectId,
                    DENSE_RANK() OVER (ORDER BY achievedMarks DESC, completionTimeInSeconds ASC) AS rank,
                    (SELECT totalParticipants FROM TotalParticipants) AS totalParticipants
                FROM RankedAttempts
                WHERE rn = 1
            )
            SELECT
                tb.attemptId,
                tb.userId,
                tb.completionTimeInSeconds,
                tb.achievedMarks,
                tb.startTime,
                tb.subjectId,
                ROUND(CAST(100.0 * (1.0 - (CAST(tb.rank - 1 AS FLOAT) / NULLIF(tb.totalParticipants * 1.0, 0))) AS NUMERIC), 2) AS percentile,
                ai.correct_count AS correctAttempt,
                ai.wrong_count AS wrongAttempt,
                ai.partial_correct_count AS partialCorrectAttempt,
                ai.skipped_count AS skippedCount,
                ai.totalCorrectMarks,
                ai.totalIncorrectMarks,
                ai.totalPartialMarks,
                tb.rank
            FROM RankedWithTotal tb
            LEFT JOIN AttemptInformation ai ON tb.attemptId = ai.attempt_id
            WHERE tb.attemptId = :attemptId
            ORDER BY tb.achievedMarks DESC, tb.completionTimeInSeconds ASC;
            
            """,nativeQuery = true)
    ParticipantsQuestionOverallDetailDto findParticipantsQuestionOverallDetails(@Param("assessmentId") String assessmentId,
                                                                                @Param("instituteId") String instituteId,
                                                                                @Param("attemptId") String attemptId);

    @Query(value = """
            select sa.* from student_attempt sa
            join assessment_user_registration aur on aur.id = sa.registration_id
            join assessment a on a.id = aur.assessment_id
            where a.id = :assessmentId
            and aur.status not in (:statusList)
            """, nativeQuery = true)
    List<StudentAttempt> findAllParticipantsFromAssessmentAndStatusNotIn(@Param("assessmentId") String assessmentId,
                                                                         @Param("statusList") List<String> statusList);


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
                                ROW_NUMBER() OVER (PARTITION BY aur.user_id ORDER BY sa.created_at DESC) AS rn,
                                DENSE_RANK() OVER (ORDER BY sa.total_marks DESC, sa.total_time_in_seconds ASC) AS rank
                            FROM student_attempt sa
                            JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                            WHERE aur.assessment_id = :assessmentId
                            AND aur.institute_id = :instituteId
                            AND sa.status IN ('LIVE', 'ENDED')
                            AND (:statusList IS NULL OR aur.status IN (:statusList))
                        )
                        ,TotalParticipants AS (
                                        SELECT COUNT(*) AS totalParticipants FROM RankedAttempts WHERE rn = 1
                                    )
                        SELECT
                            attemptId,
                            userId,
                            studentName,
                            batchId,
                            completionTimeInSeconds,
                            achievedMarks,
                            status,
                            rank,
                            ROUND(CAST(100.0 * (1.0 - (CAST(ra.rank - 1 AS FLOAT) / NULLIF(t.totalParticipants * 1.0, 0))) AS NUMERIC), 2) AS percentile
                        FROM RankedAttempts as ra,TotalParticipants as t
                        WHERE rn = 1
                        ORDER BY achievedMarks DESC, completionTimeInSeconds ASC
            """,nativeQuery = true)
    public List<LeaderBoardDto> findLeaderBoardForAssessmentAndInstituteId(@Param("assessmentId") String assessmentId,
                                                                           @Param("instituteId") String instituteId,
                                                                           @Param("statusList") List<String> statusList);
}



