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
                    id AS assessment_id,
                    created_at,
                    bound_start_time,
                    bound_end_time,
                    duration
                FROM assessment
                WHERE id = :assessmentId
            )
            SELECT
                ai.created_at as createdOn,
                ai.bound_start_time as startDateAndTime,
                ai.bound_end_time as endDateAndTime,
                ai.duration as durationInMin,
                COUNT(la.userId) AS totalParticipants,
                COALESCE(AVG(la.totalTime), 0) AS averageDuration,
                COALESCE(AVG(la.achievedMarks), 0) AS averageMarks,
                COUNT(CASE WHEN la.attemptStatus = 'ENDED' THEN 1 END) AS totalAttempted,
                COUNT(CASE WHEN la.attemptStatus = 'LIVE' THEN 1 END) AS totalOngoing
            FROM AssessmentInfo ai
            LEFT JOIN LatestAttempts la ON 1=1
            WHERE la.rn = 1 OR la.rn IS NULL
            GROUP BY ai.created_at, ai.bound_start_time, ai.bound_end_time, ai.duration;
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
            AND COALESCE(sa.status, 'PENDING') IN (:statusList);
            
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
            AND COALESCE(sa.status, 'PENDING') IN (:statusList);
            
            """, nativeQuery = true)
    Page<StudentReportDto> findAssessmentForUserWithFilterAndSearch(@Param("name") String name,
                                                                    @Param("userId") String userId,
                                                                    @Param("instituteId") String instituteId,
                                                                    @Param("statusList") List<String> statusList,
                                                                    Pageable pageable);
}



