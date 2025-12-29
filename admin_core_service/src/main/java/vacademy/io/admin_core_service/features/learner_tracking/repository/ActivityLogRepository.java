package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.parameters.P;
import vacademy.io.admin_core_service.features.learner_reports.dto.ChapterSlideProgressProjection;
import vacademy.io.admin_core_service.features.learner_reports.dto.LearnerActivityDataProjection;
import vacademy.io.admin_core_service.features.learner_reports.dto.SubjectProgressProjection;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DailyTimeSpentProjection;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogProcessingProjection;
import vacademy.io.admin_core_service.features.slide.dto.LearnerProgressProjection;
import vacademy.io.admin_core_service.features.slide.entity.Slide;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, String> {
    @Query(value = """
            SELECT
                CASE
                    WHEN v.published_video_length IS NULL OR v.published_video_length = 0 THEN 0
                    ELSE
                        EXTRACT(EPOCH FROM (MAX(vt.end_time) - MIN(vt.start_time))) * 1000
                        / v.published_video_length * 100
                END AS percentage_watched
            FROM
                activity_log a
            JOIN
                video_tracked vt ON vt.activity_id = a.id
            JOIN
                slide s ON s.id = a.slide_id
            JOIN
                video v ON s.source_id = v.id
            WHERE
                a.user_id = :userId
                AND a.slide_id = :slideId
            GROUP BY
                v.id, a.user_id, a.slide_id, v.published_video_length
            """, nativeQuery = true)
    Double getPercentageVideoWatched(@Param("slideId") String slideId, @Param("userId") String userId);

    @Query(value = """
            WITH quiz_slide_data AS (
                SELECT qz.id AS quiz_slide_id, COUNT(DISTINCT qq.id) AS total_questions
                FROM slide s
                JOIN quiz_slide qz ON qz.id = s.source_id
                JOIN quiz_slide_question qq ON qq.quiz_slide_id = qz.id
                WHERE s.id = :slideId
                  AND s.source_type = 'QUIZ'
                  AND qq.status IN (:quizSlideStatuses)
                GROUP BY qz.id
            ),
            attempted_questions AS (
                SELECT COUNT(DISTINCT qst.question_id) AS attempted_questions
                FROM activity_log al
                JOIN quiz_slide_question_tracked qst ON qst.activity_id = al.id
                LEFT JOIN quiz_slide_question qq ON qq.id = qst.question_id
                WHERE al.slide_id = :slideId
                  AND al.user_id = :userId
                  AND qq.quiz_slide_id IS NOT NULL
            )
            SELECT
                CASE
                    WHEN qsd.total_questions = 0 THEN 0
                    ELSE ROUND(100.0 * aq.attempted_questions / qsd.total_questions, 2)
                END AS percentage_completed
            FROM quiz_slide_data qsd, attempted_questions aq
            """, nativeQuery = true)
    Double getQuizSlideCompletionPercentage(
            @Param("slideId") String slideId,
            @Param("quizSlideStatuses") List<String> quizSlideStatuses,
            @Param("userId") String userId);

    @Query(value = """
            SELECT vt.start_time, vt.end_time
            FROM activity_log a
            JOIN video_tracked vt ON vt.activity_id = a.id
            WHERE a.user_id = :userId
              AND a.slide_id = :slideId
            """, nativeQuery = true)
    List<Object[]> getVideoTrackedIntervals(@Param("slideId") String slideId, @Param("userId") String userId);

    @Query(value = """
                SELECT
                    COALESCE((COUNT(DISTINCT dt.page_number) * 100.0 / MAX(ds.published_document_total_pages)), 0) AS percentage_watched
                FROM
                    slide s
                JOIN
                    document_slide ds ON s.source_id = ds.id
                JOIN
                    activity_log al ON s.id = al.slide_id
                LEFT JOIN
                    document_tracked dt ON al.id = dt.activity_id  -- LEFT JOIN ensures 0 is returned if no tracking
                WHERE
                    al.user_id = :userId
                    AND s.id = :slideId
                GROUP BY
                    s.id, al.user_id, ds.id
            """, nativeQuery = true)
    Double getPercentageDocumentWatched(@Param("slideId") String slideId, @Param("userId") String userId);

    @Query(value = """
            SELECT
                COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT cs.slide_id), 0) AS percentage_completed
            FROM
                chapter_to_slides cs
            JOIN
                slide s ON cs.slide_id = s.id
            LEFT JOIN
                learner_operation lo
                    ON lo.source_id = cs.slide_id
                    AND lo.operation IN (:learnerOperation)
                    AND lo.user_id = :userId
                    AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
            WHERE
                cs.status IN (:statusList)
                AND cs.chapter_id = :chapterId
                AND s.source_type IN (:sourceTypeList)
            """, nativeQuery = true)
    Double getChapterCompletionPercentage(
            @Param("userId") String userId,
            @Param("chapterId") String chapterId,
            @Param("learnerOperation") List<String> learnerOperation,
            @Param("statusList") List<String> statusList,
            @Param("sourceTypeList") List<String> sourceTypeList);

    @Query(value = """
                SELECT
                    COALESCE(SUM(lo_val.chapter_value), 0) / NULLIF(COUNT(*), 0) AS percentage_completed
                FROM (
                    SELECT DISTINCT mcm.chapter_id
                    FROM module_chapter_mapping mcm
                    JOIN chapter c ON c.id = mcm.chapter_id
                    JOIN chapter_package_session_mapping cpm ON cpm.chapter_id = c.id
                    WHERE mcm.module_id = :moduleId
                      AND cpm.status IN (:chapterStatusList)
                      AND c.status IN (:chapterStatusList)
                ) distinct_chapters
            LEFT JOIN (
                SELECT DISTINCT ON (lo.source_id)
                    lo.source_id,
                    CAST(lo.value AS FLOAT) AS chapter_value
                FROM learner_operation lo
                WHERE lo.operation IN (:learnerOperation)
                  AND lo.user_id = :userId
                  AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
            ) lo_val ON lo_val.source_id = distinct_chapters.chapter_id
            """, nativeQuery = true)
    Double getModuleCompletionPercentage(
            @Param("userId") String userId,
            @Param("moduleId") String moduleId,
            @Param("learnerOperation") List<String> learnerOperation,
            @Param("chapterStatusList") List<String> chapterStatusList);

    @Query(value = """
            SELECT
                COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT smm.module_id), 0) AS percentage_completed
            FROM
                subject_module_mapping smm
            JOIN
                modules m ON m.id = smm.module_id
            LEFT JOIN
                learner_operation lo ON lo.source_id = m.id
                    AND lo.operation IN (:learnerOperation)
                    AND lo.user_id = :userId
                    AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
            WHERE
                smm.subject_id = :subjectId
                AND m.status IN (:moduleStatusList)
            """, nativeQuery = true)
    Double getSubjectCompletionPercentage(
            @Param("userId") String userId,
            @Param("subjectId") String subjectId,
            @Param("learnerOperation") List<String> learnerOperation,
            @Param("moduleStatusList") List<String> moduleStatusList);

    @Query(value = """
            SELECT
                COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT sps.subject_id), 0) AS percentage_completed
            FROM
                subject_session sps
            JOIN
                subject s ON s.id = sps.subject_id
            LEFT JOIN
                learner_operation lo ON lo.source_id = s.id
                    AND lo.operation IN (:learnerOperation)
                    AND lo.user_id = :userId
                    AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
            WHERE
                sps.session_id = :packageSessionId
                AND s.status IN (:subjectStatusList)
            """, nativeQuery = true)
    Double getPackageSessionCompletionPercentage(
            @Param("userId") String userId,
            @Param("learnerOperation") List<String> learnerOperation,
            @Param("packageSessionId") String packageSessionId,
            @Param("subjectStatusList") List<String> subjectStatusList);

    @Query("""
            SELECT DISTINCT al FROM ActivityLog al
            LEFT JOIN FETCH al.videoTracked vt
            WHERE al.userId = :userId AND al.slideId = :slideId
            """)
    Page<ActivityLog> findActivityLogsWithVideos(@Param("userId") String userId,
            @Param("slideId") String slideId,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT al FROM ActivityLog al
            LEFT JOIN FETCH al.questionSlideTracked vt
            WHERE al.userId = :userId AND al.slideId = :slideId
            """)
    Page<ActivityLog> findActivityLogsWithQuestionSlides(@Param("userId") String userId,
            @Param("slideId") String slideId,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT al FROM ActivityLog al
            LEFT JOIN FETCH al.assignmentSlideTracked vt
            WHERE al.userId = :userId AND al.slideId = :slideId
            """)
    Page<ActivityLog> findActivityLogsWithAssignmentSlide(@Param("userId") String userId,
            @Param("slideId") String slideId,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT al FROM ActivityLog al
            LEFT JOIN FETCH al.quizSlideQuestionTracked qt
            WHERE al.userId = :userId AND al.slideId = :slideId
            """)
    Page<ActivityLog> findActivityLogsWithQuizSlide(@Param("userId") String userId,
            @Param("slideId") String slideId,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT al FROM ActivityLog al
            LEFT JOIN FETCH al.videoSlideQuestionTracked vt
            WHERE al.userId = :userId AND al.slideId = :slideId AND al.sourceType = :sourceType
            """)
    Page<ActivityLog> findActivityLogsWithVideoSlideQuestions(
            @Param("userId") String userId,
            @Param("slideId") String slideId,
            @Param("sourceType") String sourceType,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT al FROM ActivityLog al
            LEFT JOIN FETCH al.documentTracked dt
            WHERE al.userId = :userId AND al.slideId = :slideId
            """)
    Page<ActivityLog> findActivityLogsWithDocuments(@Param("userId") String userId,
            @Param("slideId") String slideId,
            Pageable pageable);

    @Query(value = """
            SELECT s.user_id AS userId,
                   s.full_name AS fullName,
                   SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) AS totalTimeSpent,
                   MAX(a.updated_at) AS lastActive
            FROM activity_log a
            JOIN student s ON a.user_id = s.user_id
            WHERE a.slide_id = :slideId
            GROUP BY s.user_id, s.full_name
            ORDER BY lastActive DESC
            """, nativeQuery = true)
    Page<LearnerActivityProjection> findStudentActivityBySlideId(@Param("slideId") String slideId, Pageable pageable);

    @Query(value = """
            WITH individual_slide_progress AS (
                SELECT
                    s.id AS slide_id,
                    al.user_id,
                    CASE
                        WHEN s.source_type = 'VIDEO' THEN
                            LEAST(
                                COALESCE(SUM(EXTRACT(EPOCH FROM (vt.end_time - vt.start_time))) * 1000
                                         / NULLIF(COALESCE(v.published_video_length, 1), 0) * 100,
                                0),
                            100)
                        WHEN s.source_type IN ('DOCUMENT', 'PDF') THEN
                            LEAST(
                                COALESCE(COUNT(DISTINCT dt.page_number) * 100.0
                                         / NULLIF(COALESCE(ds.published_document_total_pages, 1), 0),
                                0),
                            100)
                        ELSE 0
                    END AS slide_completion
                FROM slide s
                LEFT JOIN activity_log al ON al.slide_id = s.id
                LEFT JOIN video_tracked vt ON vt.activity_id = al.id
                LEFT JOIN video v ON s.source_id = v.id AND s.source_type = 'VIDEO'
                LEFT JOIN document_tracked dt ON dt.activity_id = al.id
                LEFT JOIN document_slide ds ON s.source_id = ds.id AND s.source_type IN ('DOCUMENT', 'PDF')
                JOIN chapter_to_slides cs ON cs.slide_id = s.id
                JOIN chapter c ON c.id = cs.chapter_id
                JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
                JOIN modules m ON m.id = mcm.module_id
                JOIN subject_module_mapping smm ON smm.module_id = m.id
                JOIN subject sub ON sub.id = smm.subject_id
                JOIN subject_session sps ON sps.subject_id = sub.id
                JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id AND cpsm.package_session_id = :sessionId
                JOIN student_session_institute_group_mapping ssigm ON ssigm.package_session_id = sps.session_id AND ssigm.user_id = al.user_id

                WHERE
                    al.created_at BETWEEN :startDate AND :endDate
                    AND sps.session_id = :sessionId
                    AND sub.status IN :subjectStatusList
                    AND m.status IN :moduleStatusList
                    AND c.status IN :chapterStatusList
                    AND cpsm.status IN :chapterToSessionStatusList
                    AND s.status IN :slideStatusList
                    AND cs.status IN :slideStatusList
                    AND s.source_type IN :slideTypeList
                    AND ssigm.status IN :ssigmStatusList
                GROUP BY s.id, s.source_type, v.published_video_length, ds.published_document_total_pages, al.user_id
            ),
            user_wise_progress AS (
                SELECT user_id, AVG(slide_completion) AS user_avg_completion
                FROM individual_slide_progress
                GROUP BY user_id
            )
            SELECT COALESCE(AVG(user_avg_completion), 0) FROM user_wise_progress
            """, nativeQuery = true)
    Double getBatchCourseCompletionPercentagePerLearner(
            @Param("sessionId") String sessionId,
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("chapterToSessionStatusList") List<String> chapterToSessionStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("slideTypeList") List<String> slideTypeList,
            @Param("ssigmStatusList") List<String> ssigmStatusList);

    @Query(value = """
                WITH filtered_activity_log AS (
                    SELECT al.*
                    FROM activity_log al
                    JOIN slide s ON s.id = al.slide_id
                    JOIN chapter_to_slides cs ON cs.slide_id = s.id
                    JOIN chapter c ON c.id = cs.chapter_id
                    JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
                    JOIN modules m ON m.id = mcm.module_id
                    JOIN subject_module_mapping smm ON smm.module_id = m.id
                    JOIN subject sub ON sub.id = smm.subject_id
                    JOIN subject_session sps ON sps.subject_id = sub.id
                    JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id AND cpsm.package_session_id = :packageSessionId
                    WHERE
                        al.created_at BETWEEN :startDate AND :endDate
                        AND sps.session_id = :packageSessionId
                        AND sub.status IN :subjectStatusList
                        AND m.status IN :moduleStatusList
                        AND c.status IN :chapterStatusList
                        AND cpsm.status IN :chapterToSessionStatusList
                        AND s.status IN :slideStatusList
                        AND cs.status IN :slideStatusList
                ),
                activity_duration AS (
                    SELECT
                        al.user_id,
                        COALESCE(SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time))) / 60, 0) AS total_time_spent_minutes
                    FROM filtered_activity_log al
                    GROUP BY al.user_id
                ),
                batch_time_spent AS (
                    SELECT
                        ssig.package_session_id,
                        SUM(COALESCE(ad.total_time_spent_minutes, 0)) AS total_time_spent,
                        COUNT(DISTINCT ssig.user_id) AS total_learners
                    FROM student_session_institute_group_mapping ssig
                    LEFT JOIN activity_duration ad ON ssig.user_id = ad.user_id
                    WHERE
                        ssig.package_session_id = :packageSessionId
                        AND ssig.status IN :statusList
                    GROUP BY ssig.package_session_id
                )
                SELECT
                    CASE
                        WHEN total_learners > 0 THEN total_time_spent / total_learners
                        ELSE 0
                    END AS avg_time_spent_minutes
                FROM batch_time_spent
            """, nativeQuery = true)
    Double findAverageTimeSpentByBatch(
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("chapterToSessionStatusList") List<String> chapterToSessionStatusList,
            @Param("slideStatusList") List<String> slideStatusList);

    @Query(value = """
            WITH total_time_spent AS (
                SELECT
                    SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time)) / 60) AS total_minutes_spent
                FROM activity_log al
                JOIN student_session_institute_group_mapping ssig
                    ON al.user_id = ssig.user_id
                WHERE
                    ssig.package_session_id = :packageSessionId
                    AND ssig.status IN :statusList  -- Ensures only students with matching status are considered
                    AND al.created_at BETWEEN :startDate AND :endDate
            )
            SELECT
                COALESCE(total_minutes_spent, 0) / (DATE(:endDate) - DATE(:startDate) + 1) AS avg_daily_minutes_spent
            FROM total_time_spent;
            """, nativeQuery = true)
    Double findAverageDailyTimeSpentByBatch(
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList);

    @Query(value = """
                SELECT
                    s.user_id AS userId,
                    s.full_name AS fullName,
                    s.email AS email,
                    COALESCE(AVG(cs.concentration_score), 0) AS avgConcentration,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))), 0) AS totalTime,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) / NULLIF(COUNT(DISTINCT DATE(a.start_time)), 0), 0) AS dailyAvgTime,
                    DENSE_RANK() OVER (ORDER BY
                        COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))), 0) DESC,
                        COALESCE(AVG(cs.concentration_score), 0) DESC
                    ) AS rank
                FROM student s
                JOIN student_session_institute_group_mapping ssig
                    ON s.user_id = ssig.user_id
                LEFT JOIN activity_log a
                    ON ssig.user_id = a.user_id
                    AND a.start_time BETWEEN :startTime AND :endTime
                LEFT JOIN concentration_score cs
                    ON a.id = cs.activity_id
                WHERE ssig.package_session_id = :packageSessionId
                AND ssig.status IN (:statusList)
                GROUP BY s.user_id, s.full_name, s.email
            """, countQuery = """
                SELECT COUNT(DISTINCT s.user_id)
                FROM student s
                JOIN student_session_institute_group_mapping ssig
                    ON s.user_id = ssig.user_id
                WHERE ssig.package_session_id = :packageSessionId
                AND ssig.status IN (:statusList)
            """, nativeQuery = true)
    Page<LearnerActivityDataProjection> getBatchActivityDataWithRankPaginated(
            @Param("startTime") Date startTime,
            @Param("endTime") Date endTime,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList,
            Pageable pageable);

    @Query(value = """
                WITH date_series AS (
                    SELECT generate_series(
                        CAST(:startDate AS DATE),
                        CAST(:endDate AS DATE),
                        INTERVAL '1 day'
                    ) AS activity_date
                )
                SELECT
                    ds.activity_date,
                    COALESCE(
                        CASE
                            WHEN COUNT(DISTINCT ssig.user_id) > 0
                            THEN SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) / 60 / COUNT(DISTINCT ssig.user_id)
                            ELSE 0
                        END,
                        0
                    ) AS avg_time_spent_per_student
                FROM date_series ds
                LEFT JOIN student_session_institute_group_mapping ssig
                    ON ssig.package_session_id = :packageSessionId
                    AND ssig.status IN (:statusList)
                LEFT JOIN activity_log a
                    ON ssig.user_id = a.user_id
                    AND DATE(a.created_at) BETWEEN CAST(:startDate AS DATE) AND CAST(:endDate AS DATE)  -- Ensure logs fall within the range
                    AND DATE(a.created_at) = ds.activity_date  -- Ensure logs are mapped correctly to each generated date
                GROUP BY ds.activity_date
                ORDER BY ds.activity_date
            """, nativeQuery = true)
    List<Object[]> getAvgTimeSpentPerStudent(
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList);

    @Query(value = """
                WITH SubjectModules AS (
                    SELECT
                        smm.subject_id,
                        smm.module_id,
                        s.subject_name,
                        m.module_name
                    FROM subject_session ss
                    JOIN subject_module_mapping smm ON ss.subject_id = smm.subject_id
                    JOIN subject s ON ss.subject_id = s.id
                    JOIN modules m ON smm.module_id = m.id
                    WHERE ss.session_id = :sessionId
                    AND s.status IN (:subjectStatusList)
                    AND m.status IN (:moduleStatusList)
                ),
                ModuleChapters AS (
                    SELECT
                        sm.subject_id,
                        sm.module_id,
                        sm.subject_name,
                        sm.module_name,
                        mcm.chapter_id
                    FROM SubjectModules sm
                    JOIN module_chapter_mapping mcm ON sm.module_id = mcm.module_id
                ),
                ChapterSlides AS (
                    SELECT
                        mc.subject_id,
                        mc.module_id,
                        mc.subject_name,
                        mc.module_name,
                        mc.chapter_id,
                        cts.slide_id
                    FROM ModuleChapters mc
                    JOIN chapter_to_slides cts ON mc.chapter_id = cts.chapter_id
                    JOIN slide s ON cts.slide_id = s.id
                    JOIN chapter c ON mc.chapter_id = c.id
                    JOIN chapter_package_session_mapping cpsm ON c.id = cpsm.chapter_id
                    WHERE c.status IN (:chapterStatusList)
                    AND cpsm.package_session_id = :sessionId
                    AND cts.status IN (:chapterSlideStatusList)
                    AND s.status IN (:slideStatusList)
                ),
                SlideActivity AS (
                    SELECT
                        cs.subject_id,
                        cs.module_id,
                        cs.subject_name,
                        cs.module_name,
                        cs.chapter_id,
                        SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time))) AS total_time_seconds
                    FROM ChapterSlides cs
                    JOIN activity_log al ON cs.slide_id = al.slide_id
                    JOIN student_session_institute_group_mapping ssigm
                        ON al.user_id = ssigm.user_id
                        AND ssigm.package_session_id = :sessionId
                    WHERE ssigm.status IN (:learnerStatusList)
                    GROUP BY cs.subject_id, cs.module_id, cs.subject_name, cs.module_name, cs.chapter_id
                ),
                DistinctUsers AS (
                    SELECT
                        COUNT(DISTINCT user_id) AS user_count
                    FROM student_session_institute_group_mapping
                    WHERE package_session_id = :sessionId
                    AND status IN (:learnerStatusList)
                ),
                ModuleTime AS (
                    SELECT
                        sa.subject_id,
                        sa.module_id,
                        sa.subject_name,
                        sa.module_name,
                        SUM(sa.total_time_seconds) AS total_module_time_seconds
                    FROM SlideActivity sa
                    GROUP BY sa.subject_id, sa.module_id, sa.subject_name, sa.module_name
                ),
                AvgTimeSpent AS (
                    SELECT
                        mt.subject_id,
                        mt.module_id,
                        mt.subject_name,
                        mt.module_name,
                        (mt.total_module_time_seconds / 60) / du.user_count AS avg_time_per_user_minutes
                    FROM ModuleTime mt
                    CROSS JOIN DistinctUsers du
                ),
                ModuleCompletion AS (
                    SELECT
                        mc.subject_id,
                        mc.module_id,
                        mc.subject_name,
                        mc.module_name,
                        lo.user_id,
                        AVG(
                            CAST(NULLIF(lo.value, '') AS FLOAT)
                        ) AS avg_completion_per_student
                    FROM learner_operation lo
                    JOIN ModuleChapters mc ON lo.source_id = mc.chapter_id
                    WHERE lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
                    AND lo.value ~ '^[0-9\\.]+$' -- Ensure only numeric values
                    GROUP BY mc.subject_id, mc.module_id, mc.subject_name, mc.module_name, lo.user_id
                ),
                FinalModuleCompletion AS (
                    SELECT
                        subject_id,
                        module_id,
                        subject_name,
                        module_name,
                        AVG(avg_completion_per_student) AS module_completion_percentage
                    FROM ModuleCompletion
                    GROUP BY subject_id, module_id, subject_name, module_name
                )
                SELECT
                    sm.subject_id AS subjectId,
                    sm.subject_name AS subjectName,
                    json_agg(
                        jsonb_build_object(
                            'module_id', sm.module_id,
                            'module_name', sm.module_name,
                            'module_completion_percentage', COALESCE(fmc.module_completion_percentage, 0),
                            'avg_time_spent_minutes', COALESCE(ats.avg_time_per_user_minutes, 0)
                        )
                    ) AS modules
                FROM SubjectModules sm
                LEFT JOIN FinalModuleCompletion fmc
                    ON sm.module_id = fmc.module_id
                    AND sm.subject_id = fmc.subject_id
                LEFT JOIN AvgTimeSpent ats
                    ON sm.module_id = ats.module_id
                    AND sm.subject_id = ats.subject_id
                GROUP BY sm.subject_id, sm.subject_name
            """, nativeQuery = true)
    List<SubjectProgressProjection> getModuleCompletionAndTimeSpent(
            @Param("sessionId") String sessionId,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("chapterSlideStatusList") List<String> chapterSlideStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("learnerStatusList") List<String> learnerStatusList);

    @Query(value = """
                WITH RawChapters AS (
                    SELECT
                        mc.chapter_id,
                        ch.chapter_name
                    FROM module_chapter_mapping mc
                    JOIN chapter_package_session_mapping cps
                        ON mc.chapter_id = cps.chapter_id AND cps.status IN (:chapterPackageStatusList)
                    JOIN chapter ch
                        ON mc.chapter_id = ch.id AND ch.status IN (:chapterStatusList)
                    WHERE mc.module_id = :moduleId
                ),
                Chapters AS (
                    SELECT DISTINCT chapter_id, chapter_name FROM RawChapters
                ),
                Slides AS (
                    SELECT DISTINCT
                        csm.chapter_id,
                        s.id AS slide_id,
                        s.title AS slide_title,
                        s.source_type AS slide_source_type
                    FROM chapter_to_slides csm
                    JOIN Chapters c ON csm.chapter_id = c.chapter_id
                    JOIN slide s ON csm.slide_id = s.id AND s.status IN (:slideStatusList)
                    WHERE csm.status IN (:chapterSlideStatusList)
                ),
                LearnerActivity AS (
                    SELECT
                        al.id AS activity_id,
                        al.slide_id,
                        al.start_time,
                        al.end_time,
                        al.user_id,
                        al.created_at
                    FROM activity_log al
                    JOIN Slides s ON al.slide_id = s.slide_id
                    WHERE al.user_id = :userId
                ),
                BatchActivity AS (
                    SELECT
                        al.slide_id,
                        al.id AS activity_id,
                        al.start_time,
                        al.end_time,
                        al.created_at,
                        al.user_id
                    FROM activity_log al
                    JOIN Slides s ON al.slide_id = s.slide_id
                    JOIN student_session_institute_group_mapping ssigm
                        ON al.user_id = ssigm.user_id
                       AND ssigm.package_session_id = :packageSessionId
                    WHERE ssigm.status IN (:learnerStatusList)
                ),
                StudentCount AS (
                    SELECT COUNT(DISTINCT ssigm.user_id) AS distinct_users
                    FROM student_session_institute_group_mapping ssigm
                    WHERE ssigm.package_session_id = :packageSessionId
                      AND ssigm.status IN (:learnerStatusList)
                ),
                LearnerTimeScore AS (
                    SELECT
                        slide_id,
                        (EXTRACT(EPOCH FROM SUM(end_time - start_time)) / 60) AS avg_time_spent,
                        MAX(created_at) AS last_active_date
                    FROM LearnerActivity
                    GROUP BY slide_id
                ),
                LearnerConcentration AS (
                    SELECT
                        la.slide_id,
                        CAST(SUM(cs.concentration_score) AS FLOAT) / NULLIF(COUNT(cs.id), 0) AS avg_concentration_score
                    FROM concentration_score cs
                    JOIN LearnerActivity la ON cs.activity_id = la.activity_id
                    GROUP BY la.slide_id
                ),
                BatchTimeScore AS (
                    SELECT
                        slide_id,
                        (EXTRACT(EPOCH FROM SUM(end_time - start_time)) / 60) / NULLIF((SELECT distinct_users FROM StudentCount), 0) AS avg_time_spent_by_batch
                    FROM BatchActivity
                    GROUP BY slide_id
                ),
                BatchConcentration AS (
                    SELECT
                        ba.slide_id,
                        CAST(SUM(cs.concentration_score) AS FLOAT) / NULLIF(COUNT(cs.id), 0) AS avg_concentration_score_by_batch
                    FROM concentration_score cs
                    JOIN BatchActivity ba ON cs.activity_id = ba.activity_id
                    GROUP BY ba.slide_id
                )
                SELECT
                    c.chapter_id AS chapterId,
                    c.chapter_name AS chapterName,
                    (
                        SELECT JSON_AGG(slide_data)
                        FROM (
                            SELECT DISTINCT ON (s.slide_id)
                                s.slide_id,
                                s.slide_title,
                                s.slide_source_type,
                                COALESCE(lt.avg_time_spent, 0.0) AS avg_time_spent,
                                COALESCE(lc.avg_concentration_score, 0.0) AS avg_concentration_score,
                                COALESCE(CAST(bt.avg_time_spent_by_batch AS TEXT), '0.0') AS avg_time_spent_by_batch,
                                COALESCE(CAST(bc.avg_concentration_score_by_batch AS TEXT), '0.0') AS avg_concentration_score_by_batch,
                                TO_CHAR(COALESCE(lt.last_active_date, NOW()), 'HH24:MI DD/MM/YYYY') AS last_active_date

                            FROM Slides s
                            LEFT JOIN LearnerTimeScore lt ON s.slide_id = lt.slide_id
                            LEFT JOIN LearnerConcentration lc ON s.slide_id = lc.slide_id
                            LEFT JOIN BatchTimeScore bt ON s.slide_id = bt.slide_id
                            LEFT JOIN BatchConcentration bc ON s.slide_id = bc.slide_id
                            WHERE s.chapter_id = c.chapter_id
                            ORDER BY s.slide_id
                        ) slide_data
                    ) AS slides
                FROM Chapters c
                ORDER BY c.chapter_id;
            """, nativeQuery = true)
    List<ChapterSlideProgressProjection> getChapterSlideProgressCombined(
            @Param("moduleId") String moduleId,
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("chapterPackageStatusList") List<String> chapterPackageStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterSlideStatusList") List<String> chapterSlideStatusList,
            @Param("learnerStatusList") List<String> learnerStatusList);

    @Query(value = """
                WITH video_progress AS (
                    SELECT
                        s.id AS slide_id,
                        LEAST(
                            COALESCE(
                                (
                                    EXTRACT(EPOCH FROM (MAX(vt.end_time) - MIN(vt.start_time))) * 1000
                                    / NULLIF(COALESCE(v.published_video_length, 1), 0)
                                ) * 100,
                            0),
                        100) AS video_completion
                    FROM slide s
                    LEFT JOIN video v ON s.source_id = v.id AND s.source_type = 'VIDEO'
                    LEFT JOIN activity_log al ON al.slide_id = s.id AND al.user_id = :userId
                    LEFT JOIN video_tracked vt ON vt.activity_id = al.id
                    WHERE
                        al.created_at BETWEEN :startDate AND :endDate
                        AND s.source_type IN :sourceTypeList
                    GROUP BY s.id, v.published_video_length
                ),
                document_progress AS (
                    SELECT
                        s.id AS slide_id,
                        LEAST(
                            COALESCE(
                                (COUNT(DISTINCT dt.page_number) * 100.0 / NULLIF(COALESCE(ds.published_document_total_pages, 1), 0)),
                            0), 100) AS document_completion
                    FROM slide s
                    LEFT JOIN document_slide ds ON s.source_id = ds.id AND s.source_type IN :sourceTypeList
                    LEFT JOIN activity_log al ON al.slide_id = s.id AND al.user_id = :userId
                    LEFT JOIN document_tracked dt ON dt.activity_id = al.id
                    WHERE
                        al.created_at BETWEEN :startDate AND :endDate
                        AND s.source_type IN :sourceTypeList
                    GROUP BY s.id, ds.published_document_total_pages
                ),
                slide_completion AS (
                    SELECT
                        s.id AS slide_id,
                        COALESCE(vp.video_completion, dp.document_completion, 0) AS slide_completion_percentage
                    FROM
                        subject_session sps
                    JOIN subject_module_mapping smm ON smm.subject_id = sps.subject_id
                    JOIN subject sub ON sub.id = smm.subject_id
                    JOIN modules m ON m.id = smm.module_id
                    JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
                    JOIN chapter c ON c.id = mcm.chapter_id
                    JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id
                    JOIN chapter_to_slides cs ON cs.chapter_id = c.id
                    JOIN slide s ON s.id = cs.slide_id
                    LEFT JOIN video_progress vp ON vp.slide_id = s.id
                    LEFT JOIN document_progress dp ON dp.slide_id = s.id
                    WHERE
                        sps.session_id = :sessionId
                        AND cpsm.package_session_id = :sessionId
                        AND cpsm.status IN :chapterPackageStatusList
                        AND sub.status IN :subjectStatusList
                        AND m.status IN :moduleStatusList
                        AND c.status IN :chapterStatusList
                        AND cs.status IN :slideStatusList
                        AND s.status IN :slideStatusList
                        AND s.source_type IN :sourceTypeList
                )
                SELECT COALESCE(AVG(slide_completion_percentage), 0)
                FROM slide_completion;
            """, nativeQuery = true)
    Double getLearnerCourseCompletionPercentage(
            @Param("sessionId") String sessionId,
            @Param("userId") String userId,
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("sourceTypeList") List<String> sourceTypeList,
            @Param("chapterPackageStatusList") List<String> chapterPackageStatusList);

    @Query(value = """
                SELECT
                    COALESCE(SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time))) / 60, 0) AS total_time_spent_minutes
                FROM activity_log al
                JOIN slide s ON s.id = al.slide_id
                JOIN chapter_to_slides cs ON cs.slide_id = s.id
                JOIN chapter c ON c.id = cs.chapter_id
                JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
                JOIN modules m ON m.id = mcm.module_id
                JOIN subject_module_mapping smm ON smm.module_id = m.id
                JOIN subject sub ON sub.id = smm.subject_id
                JOIN subject_session ss ON ss.subject_id = sub.id
                JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id
                WHERE
                    al.created_at BETWEEN :startDate AND :endDate
                    AND al.user_id = :userId
                    AND ss.session_id = :sessionId
                    AND cpsm.package_session_id = :sessionId
                    AND sub.status IN :subjectStatusList
                    AND m.status IN :moduleStatusList
                    AND c.status IN :chapterStatusList
                    AND cs.status IN :slideStatusList
                    AND s.status IN :slideStatusList
                    AND cpsm.status IN :chapterPackageStatusList
                    AND s.source_type IN :sourceTypeList
            """, nativeQuery = true)
    Double findTimeSpentByLearnerWithFilters(
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("userId") String userId,
            @Param("sessionId") String sessionId,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterPackageStatusList") List<String> chapterPackageStatusList,
            @Param("sourceTypeList") List<String> sourceTypeList);

    @Query(value = """
                WITH date_series AS (
                    SELECT generate_series(
                        CAST(:startDate AS DATE),
                        CAST(:endDate AS DATE),
                        INTERVAL '1 day'
                    ) AS activity_date
                )
                SELECT
                    ds.activity_date,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) / 60, 0) AS time_spent_minutes
                FROM date_series ds
                LEFT JOIN activity_log a
                    ON a.user_id = :userId
                    AND DATE(a.created_at) = ds.activity_date  -- Map logs correctly to each generated date
                GROUP BY ds.activity_date
                ORDER BY ds.activity_date
            """, nativeQuery = true)
    List<Object[]> getTimeSpentByLearnerPerDay(
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("userId") String userId);

    @Query(value = """
                WITH SubjectModules AS (
                    SELECT
                        smm.subject_id,
                        smm.module_id,
                        s.subject_name,
                        m.module_name
                    FROM subject_session ss
                    JOIN subject_module_mapping smm ON ss.subject_id = smm.subject_id
                    JOIN subject s ON ss.subject_id = s.id
                    JOIN modules m ON smm.module_id = m.id
                    WHERE ss.session_id = :sessionId
                    AND s.status IN (:subjectStatusList)
                    AND m.status IN (:moduleStatusList)
                ),
                ModuleChapters AS (
                    SELECT
                        sm.subject_id,
                        sm.module_id,
                        sm.subject_name,
                        sm.module_name,
                        mcm.chapter_id
                    FROM SubjectModules sm
                    JOIN module_chapter_mapping mcm ON sm.module_id = mcm.module_id
                ),
                ChapterSlides AS (
                    SELECT
                        mc.subject_id,
                        mc.module_id,
                        mc.subject_name,
                        mc.module_name,
                        mc.chapter_id,
                        cts.slide_id
                    FROM ModuleChapters mc
                    JOIN chapter_to_slides cts ON mc.chapter_id = cts.chapter_id
                    JOIN slide s ON cts.slide_id = s.id
                    JOIN chapter c ON mc.chapter_id = c.id
                    JOIN chapter_package_session_mapping cpsm ON c.id = cpsm.chapter_id
                    WHERE c.status IN (:chapterStatusList)
                    AND cpsm.package_session_id = :sessionId
                    AND cts.status IN (:chapterSlideStatusList)
                    AND s.status IN (:slideStatusList)
                ),
                LearnerActivity AS (
                    SELECT
                        cs.subject_id,
                        cs.module_id,
                        SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time))) / 60 AS learner_time
                    FROM ChapterSlides cs
                    JOIN activity_log al ON cs.slide_id = al.slide_id
                    WHERE al.user_id = :userId
                    GROUP BY cs.subject_id, cs.module_id
                ),
                BatchActivity AS (
                    SELECT
                        cs.subject_id,
                        cs.module_id,
                        SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time))) / COUNT(DISTINCT ssigm.user_id) / 60 AS batch_time
                    FROM ChapterSlides cs
                    JOIN activity_log al ON cs.slide_id = al.slide_id
                    JOIN student_session_institute_group_mapping ssigm
                        ON al.user_id = ssigm.user_id
                        AND ssigm.package_session_id = :sessionId
                    WHERE ssigm.status IN (:learnerStatusList)
                    GROUP BY cs.subject_id, cs.module_id
                ),
                LearnerCompletion AS (
                    SELECT
                        mc.subject_id,
                        mc.module_id,
                        AVG(CAST(NULLIF(lo.value, '') AS FLOAT)) AS learner_completion
                    FROM learner_operation lo
                    JOIN ModuleChapters mc ON lo.source_id = mc.chapter_id
                    WHERE lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
                    AND lo.user_id = :userId
                    AND lo.value ~ '^[0-9\\.]+$'
                    GROUP BY mc.subject_id, mc.module_id
                ),
                BatchCompletion AS (
                    SELECT
                        mc.subject_id,
                        mc.module_id,
                        AVG(CAST(NULLIF(lo.value, '') AS FLOAT)) AS batch_completion
                    FROM learner_operation lo
                    JOIN ModuleChapters mc ON lo.source_id = mc.chapter_id
                    JOIN student_session_institute_group_mapping ssigm ON lo.user_id = ssigm.user_id
                    WHERE lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
                    AND ssigm.package_session_id = :sessionId
                    AND ssigm.status IN (:learnerStatusList)
                    AND lo.value ~ '^[0-9\\.]+$'
                    GROUP BY mc.subject_id, mc.module_id
                )
                SELECT
                    sm.subject_id,
                    sm.subject_name,
                    json_agg(
                        jsonb_build_object(
                            'module_id', sm.module_id,
                            'module_name', sm.module_name,
                            'module_completion_percentage', COALESCE(lc.learner_completion, 0),
                            'avg_time_spent_minutes', COALESCE(la.learner_time, 0),
                            'module_completion_percentage_by_batch', COALESCE(bc.batch_completion, 0),
                            'avg_time_spent_minutes_by_batch', COALESCE(ba.batch_time, 0)
                        )
                    ) AS modules_json
                FROM SubjectModules sm
                LEFT JOIN LearnerCompletion lc ON sm.subject_id = lc.subject_id AND sm.module_id = lc.module_id
                LEFT JOIN BatchCompletion bc ON sm.subject_id = bc.subject_id AND sm.module_id = bc.module_id
                LEFT JOIN LearnerActivity la ON sm.subject_id = la.subject_id AND sm.module_id = la.module_id
                LEFT JOIN BatchActivity ba ON sm.subject_id = ba.subject_id AND sm.module_id = ba.module_id
                GROUP BY sm.subject_id, sm.subject_name
            """, nativeQuery = true)
    List<Object[]> getModuleCompletionByUserAndBatch(
            @Param("sessionId") String sessionId,
            @Param("userId") String userId,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("chapterSlideStatusList") List<String> chapterSlideStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("learnerStatusList") List<String> learnerStatusList);

    @Query(value = """
            WITH Chapters AS (
                SELECT
                    mc.chapter_id,
                    ch.chapter_name AS chapter_name
                FROM module_chapter_mapping mc
                JOIN chapter_package_session_mapping cps ON mc.chapter_id = cps.chapter_id
                    AND cps.status IN (:chapterPackageStatusList)
                JOIN chapter ch ON mc.chapter_id = ch.id
                    AND ch.status IN (:chapterStatusList)
                WHERE mc.module_id = :moduleId
            ),
            Slides AS (
                SELECT
                    csm.chapter_id,
                    s.id AS slide_id,
                    s.title AS slide_title,
                    s.source_type AS slide_source_type
                FROM chapter_to_slides csm
                JOIN Chapters c ON csm.chapter_id = c.chapter_id
                JOIN slide s ON csm.slide_id = s.id
                    AND s.status IN (:slideStatusList)
                WHERE csm.status IN (:chapterSlideStatusList)
            ),
            ActivityLogs AS (
                SELECT
                    al.id AS activity_id,
                    al.slide_id,
                    al.start_time,
                    al.end_time,
                    al.user_id
                FROM activity_log al
                JOIN Slides s ON al.slide_id = s.slide_id
                WHERE al.user_id = :userId  -- Only fetch logs for the given user
            ),
            AvgTimeSpent AS (
                SELECT
                    al.slide_id,
                    (EXTRACT(EPOCH FROM SUM(al.end_time - al.start_time)) / 60) AS avg_time_spent
                FROM ActivityLogs al
                GROUP BY al.slide_id
            ),
            AvgConcentrationScore AS (
                SELECT
                    al.slide_id,
                    SUM(cs.concentration_score) / NULLIF(COUNT(cs.id), 0) AS avg_concentration_score
                FROM concentration_score cs
                JOIN ActivityLogs al ON cs.activity_id = al.activity_id
                GROUP BY al.slide_id
            )
            SELECT
                c.chapter_id AS chapterId,
                c.chapter_name AS chapterName,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'slide_id', s.slide_id,
                        'slide_title', s.slide_title,
                        'slide_source_type', s.slide_source_type,
                        'avg_time_spent', COALESCE(a.avg_time_spent, 0.0),
                        'avg_concentration_score', COALESCE(cscore.avg_concentration_score, 0.0)
                    )
                ) AS slides
            FROM Chapters c
            JOIN Slides s ON c.chapter_id = s.chapter_id
            LEFT JOIN AvgTimeSpent a ON s.slide_id = a.slide_id
            LEFT JOIN AvgConcentrationScore cscore ON s.slide_id = cscore.slide_id
            GROUP BY c.chapter_id, c.chapter_name
            """, nativeQuery = true)
    List<ChapterSlideProgressProjection> getChapterSlideProgressForLearner(
            @Param("moduleId") String moduleId,
            @Param("userId") String userId,
            @Param("chapterPackageStatusList") List<String> chapterPackageStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterSlideStatusList") List<String> chapterSlideStatusList);

    @Query(value = """
                WITH SubjectModules AS (
                    SELECT
                        smm.subject_id AS subject_id,
                        smm.module_id AS module_id,
                        s.subject_name AS subject_name,
                        m.module_name AS module_name
                    FROM subject_session ss
                    JOIN subject_module_mapping smm ON ss.subject_id = smm.subject_id
                    JOIN subject s ON ss.subject_id = s.id
                    JOIN modules m ON smm.module_id = m.id
                    WHERE ss.session_id = :sessionId
                    AND s.status IN (:subjectStatusList)
                    AND m.status IN (:moduleStatusList)
                ),
                ModuleChapters AS (
                    SELECT
                        sm.subject_id AS subject_id,
                        sm.subject_name AS subject_name,
                        sm.module_id AS module_id,
                        sm.module_name AS module_name,
                        mcm.chapter_id AS chapter_id
                    FROM SubjectModules sm
                    JOIN module_chapter_mapping mcm ON sm.module_id = mcm.module_id
                    JOIN chapter c ON mcm.chapter_id = c.id
                    WHERE c.status IN (:chapterStatusList)
                ),
                ChapterSlides AS (
                    SELECT
                        mc.subject_id AS subject_id,
                        mc.subject_name AS subject_name,
                        mc.module_id AS module_id,
                        mc.module_name AS module_name,
                        mc.chapter_id AS chapter_id,
                        c.chapter_name AS chapter_name,
                        cts.slide_id AS slide_id,
                        s.title AS slide_title
                    FROM ModuleChapters mc
                    JOIN chapter_to_slides cts ON mc.chapter_id = cts.chapter_id
                    JOIN slide s ON cts.slide_id = s.id
                    JOIN chapter c ON mc.chapter_id = c.id
                    JOIN chapter_package_session_mapping cpsm ON c.id = cpsm.chapter_id
                    WHERE cpsm.package_session_id = :sessionId
                    AND s.status IN (:slideStatusList)
                    AND cpsm.status IN (:chapterStatusList)
                ),
                SlideActivity AS (
                    SELECT
                        al.id AS activity_id,
                        cs.subject_id AS subject_id,
                        cs.subject_name AS subject_name,
                        cs.module_id AS module_id,
                        cs.module_name AS module_name,
                        cs.chapter_id AS chapter_id,
                        cs.chapter_name AS chapter_name,
                        cs.slide_id AS slide_id,
                        cs.slide_title AS slide_title,
                        DATE(al.created_at) AS activity_date,
                        COALESCE(SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time)) / 60), 0) AS time_spent_minutes
                    FROM ChapterSlides cs
                    JOIN activity_log al ON cs.slide_id = al.slide_id
                    WHERE al.user_id = :userId
                    AND al.created_at BETWEEN :startDate AND :endDate
                    GROUP BY al.id, cs.subject_id, cs.subject_name, cs.module_id, cs.module_name,
                             cs.chapter_id, cs.chapter_name, cs.slide_id, cs.slide_title, DATE(al.created_at)
                ),
                SlideConcentration AS (
                    SELECT
                        al.id AS activity_id,
                        al.slide_id AS slide_id,
                        COALESCE(AVG(cs.concentration_score), 0) AS avg_concentration_score
                    FROM activity_log al
                    JOIN concentration_score cs ON al.id = cs.activity_id
                    WHERE al.user_id = :userId
                    AND al.created_at BETWEEN :startDate AND :endDate
                    GROUP BY al.id, al.slide_id
                )
                SELECT
                    sa.activity_date AS date,
                    CAST(
                        JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'slide_id', sa.slide_id,
                                'slide_title', sa.slide_title,
                                'chapter_id', sa.chapter_id,
                                'chapter_name', sa.chapter_name,
                                'module_id', sa.module_id,
                                'module_name', sa.module_name,
                                'subject_id', sa.subject_id,
                                'subject_name', sa.subject_name,
                                'concentration_score', COALESCE(sc.avg_concentration_score, 0),
                                'time_spent', COALESCE(sa.time_spent_minutes, 0)
                            )
                        ) AS TEXT
                    ) AS slide_details
                FROM SlideActivity sa
                LEFT JOIN SlideConcentration sc ON sa.activity_id = sc.activity_id
                GROUP BY sa.activity_date
                ORDER BY sa.activity_date
            """, nativeQuery = true)
    List<Object[]> getSlideActivityByDate(
            @Param("sessionId") String sessionId,
            @Param("userId") String userId,
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList);

    @Query(value = """
                SELECT
                    s.user_id AS userId,
                    s.full_name AS fullName,
                    s.email AS email,
                    COALESCE(AVG(cs.concentration_score), 0) AS avgConcentration,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))), 0) AS totalTime,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) / NULLIF(COUNT(DISTINCT DATE(a.start_time)), 0), 0) AS dailyAvgTime,
                    DENSE_RANK() OVER (ORDER BY
                        COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))), 0) DESC,
                        COALESCE(AVG(cs.concentration_score), 0) DESC
                    ) AS rank
                FROM student s
                JOIN student_session_institute_group_mapping ssig
                    ON s.user_id = ssig.user_id
                LEFT JOIN activity_log a
                    ON ssig.user_id = a.user_id
                    AND a.start_time BETWEEN :startTime AND :endTime
                LEFT JOIN concentration_score cs
                    ON a.id = cs.activity_id
                WHERE ssig.package_session_id = :packageSessionId
                AND ssig.status IN (:statusList)
                GROUP BY s.user_id, s.full_name, s.email
            """, countQuery = """
                SELECT COUNT(DISTINCT s.user_id)
                FROM student s
                JOIN student_session_institute_group_mapping ssig
                    ON s.user_id = ssig.user_id
                WHERE ssig.package_session_id = :packageSessionId
                AND ssig.status IN (:statusList)
            """, nativeQuery = true)
    List<LearnerActivityDataProjection> getBatchActivityDataWithRank(
            @Param("startTime") Date startTime,
            @Param("endTime") Date endTime,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList);

    @Query(value = """
            WITH Chapters AS (
                SELECT
                    mc.chapter_id,
                    ch.chapter_name AS chapter_name
                FROM module_chapter_mapping mc
                JOIN chapter_package_session_mapping cps ON mc.chapter_id = cps.chapter_id
                    AND cps.status IN (:chapterPackageStatusList)
                JOIN chapter ch ON mc.chapter_id = ch.id
                    AND ch.status IN (:chapterStatusList)
                WHERE mc.module_id = :moduleId
            ),
            Slides AS (
                SELECT
                    csm.chapter_id,
                    s.id AS slide_id,
                    s.title AS slide_title,
                    s.source_type AS slide_source_type
                FROM chapter_to_slides csm
                JOIN Chapters c ON csm.chapter_id = c.chapter_id
                JOIN slide s ON csm.slide_id = s.id
                    AND s.status IN (:slideStatusList)
                WHERE csm.status IN (:chapterSlideStatusList)
            ),
            ActivityLogs AS (
                SELECT
                    al.id AS activity_id,
                    al.slide_id,
                    al.start_time,
                    al.end_time,
                    al.user_id
                FROM activity_log al
                JOIN Slides s ON al.slide_id = s.slide_id
            ),
            StudentCount AS (
                SELECT COUNT(DISTINCT ssigm.user_id) AS distinct_users
                FROM student_session_institute_group_mapping ssigm
                WHERE ssigm.package_session_id = :packageSessionId
                  AND ssigm.status IN (:learnerStatusList)
            ),
            AvgTimeSpent AS (
                SELECT
                    al.slide_id,
                    (EXTRACT(EPOCH FROM SUM(al.end_time - al.start_time)) / 60) /
                    NULLIF((SELECT distinct_users FROM StudentCount), 0) AS avg_time_spent
                FROM ActivityLogs al
                GROUP BY al.slide_id
            ),
            AvgConcentrationScore AS (
                SELECT
                    al.slide_id,
                    SUM(cs.concentration_score) / NULLIF(COUNT(cs.id), 0) AS avg_concentration_score
                FROM concentration_score cs
                JOIN ActivityLogs al ON cs.activity_id = al.activity_id
                GROUP BY al.slide_id
            )
            SELECT
                c.chapter_id AS chapterId,
                c.chapter_name AS chapterName,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'slide_id', s.slide_id,
                        'slide_title', s.slide_title,
                        'slide_source_type', s.slide_source_type,
                        'avg_time_spent', COALESCE(a.avg_time_spent, 0.0),
                        'avg_concentration_score', COALESCE(cscore.avg_concentration_score, 0.0)
                    )
                ) AS slides
            FROM Chapters c
            JOIN Slides s ON c.chapter_id = s.chapter_id
            LEFT JOIN AvgTimeSpent a ON s.slide_id = a.slide_id
            LEFT JOIN AvgConcentrationScore cscore ON s.slide_id = cscore.slide_id
            GROUP BY c.chapter_id, c.chapter_name
            """, nativeQuery = true)
    List<ChapterSlideProgressProjection> getChapterSlideProgress(
            @Param("moduleId") String moduleId,
            @Param("packageSessionId") String packageSessionId,
            @Param("chapterPackageStatusList") List<String> chapterPackageStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterSlideStatusList") List<String> chapterSlideStatusList,
            @Param("learnerStatusList") List<String> learnerStatusList);

    @Query(value = """
            WITH date_series AS (
                SELECT generate_series(
                    CAST(:startDate AS DATE),
                    CAST(:endDate AS DATE),
                    INTERVAL '1 day'
                ) AS activity_date
            ),

            learner_activities AS (
                SELECT
                    al.user_id,
                    DATE(al.created_at) AS activity_date,
                    EXTRACT(EPOCH FROM (al.end_time - al.start_time)) * 1000 AS activity_duration_millis
                FROM activity_log al

                -- Join slide
                JOIN chapter_to_slides ctsm ON al.slide_id = ctsm.slide_id AND ctsm.status IN (:chapterToSlideStatusList)
                JOIN slide s ON s.id = al.slide_id AND s.status IN (:slideStatusList)

                -- Join chapter
                JOIN chapter ch ON ch.id = ctsm.chapter_id AND ch.status IN (:chapterStatusList)
                JOIN chapter_package_session_mapping cpsm
                    ON cpsm.chapter_id = ch.id
                    AND cpsm.package_session_id IN (:packageSessionIds)
                    AND cpsm.status IN (:chapterPackageSessionStatusList)

                -- Join module and subject
                JOIN module_chapter_mapping mcm ON mcm.chapter_id = ch.id
                JOIN modules m ON m.id = mcm.module_id AND m.status IN (:moduleStatusList)
                JOIN subject_module_mapping smm ON smm.module_id = m.id
                JOIN subject subj ON subj.id = smm.subject_id AND subj.status IN (:subjectStatusList)
                JOIN subject_session ss ON ss.subject_id = subj.id AND ss.session_id IN (:packageSessionIds)

                -- Batch users filter
                JOIN student_session_institute_group_mapping ssigm
                    ON ssigm.user_id = al.user_id
                    AND ssigm.package_session_id IN (:packageSessionIds)
                    AND ssigm.status IN (:learnerStatusList)
                WHERE al.created_at BETWEEN :startDate AND :endDate
            ),

            daily_user_time AS (
                SELECT
                    user_id,
                    activity_date,
                    SUM(activity_duration_millis) AS time_spent_millis
                FROM learner_activities
                GROUP BY user_id, activity_date
            )

            SELECT
                ds.activity_date AS activityDate,
                COALESCE(dut.time_spent_millis, 0) AS timeSpentByUserMillis,
                (
                    SELECT AVG(d2.time_spent_millis)
                    FROM daily_user_time d2
                    WHERE d2.activity_date = ds.activity_date
                ) AS avgTimeSpentByBatchMillis
            FROM date_series ds
            LEFT JOIN daily_user_time dut ON ds.activity_date = dut.activity_date AND dut.user_id = :userId
            ORDER BY ds.activity_date
            """, nativeQuery = true)
    List<DailyTimeSpentProjection> getDailyUserAndBatchTimeSpent(
            @Param("userId") String userId,
            @Param("packageSessionIds") List<String> packageSessionIds,
            @Param("startDate") Timestamp startDate,
            @Param("endDate") Timestamp endDate,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("chapterPackageSessionStatusList") List<String> chapterPackageSessionStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("learnerStatusList") List<String> learnerStatusList);

    @Query(value = """
            SELECT s.id
            FROM slide s
            JOIN chapter_to_slides cts ON cts.slide_id = s.id
            JOIN activity_log al ON al.slide_id = s.id
            WHERE cts.chapter_id = :chapterId
              AND al.user_id = :userId
              AND cts.status IN (:chapterToSlideStatusList)
              AND s.status IN (:slideStatusList)
            ORDER BY al.created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<String> findLatestWatchedSlideIdForChapter(
            @Param("userId") String userId,
            @Param("chapterId") String chapterId,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("slideStatusList") List<String> slideStatusList);

    @Query(value = """
            WITH
            chapter_progress AS (
                SELECT
                    COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT cs.slide_id), 0) AS chapter_completion
                FROM chapter_to_slides cs
                LEFT JOIN learner_operation lo
                    ON lo.source_id = cs.slide_id
                    AND lo.operation IN (:learnerOperation)
                    AND lo.user_id = :userId
                    AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
                WHERE cs.status IN (:chapterToSlideStatusList)
                  AND cs.chapter_id = :chapterId
            ),
            module_chapters AS (
                SELECT DISTINCT mcm.chapter_id
                FROM module_chapter_mapping mcm
                JOIN chapter c ON c.id = mcm.chapter_id
                JOIN chapter_package_session_mapping cpm ON cpm.chapter_id = c.id
                WHERE mcm.module_id = :moduleId
                  AND cpm.status IN (:chapterStatusList)
                  AND c.status IN (:chapterStatusList)
            ),
            module_progress AS (
                SELECT
                    COALESCE(SUM(lo_val.chapter_value), 0) / NULLIF(COUNT(mc.chapter_id), 0) AS module_completion
                FROM module_chapters mc
                LEFT JOIN (
                    SELECT DISTINCT ON (lo.source_id)
                        lo.source_id,
                        CAST(lo.value AS FLOAT) AS chapter_value
                    FROM learner_operation lo
                    WHERE lo.operation IN (:moduleOperation)
                      AND lo.user_id = :userId
                      AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
                ) lo_val ON lo_val.source_id = mc.chapter_id
            ),
            subject_modules AS (
                SELECT DISTINCT smm.module_id
                FROM subject_module_mapping smm
                JOIN modules m ON m.id = smm.module_id
                WHERE smm.subject_id = :subjectId
                  AND m.status IN (:moduleStatusList)
            ),
            subject_progress AS (
                SELECT
                    COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(sm.module_id), 0) AS subject_completion
                FROM subject_modules sm
                LEFT JOIN learner_operation lo
                    ON lo.source_id = sm.module_id
                    AND lo.operation IN (:subjectOperation)
                    AND lo.user_id = :userId
                    AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
            ),
            session_subjects AS (
                SELECT DISTINCT sps.subject_id
                FROM subject_session sps
                JOIN subject s ON s.id = sps.subject_id
                WHERE sps.session_id = :packageSessionId
                  AND s.status IN (:subjectStatusList)
            ),
            session_progress AS (
                SELECT
                    COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(ss.subject_id), 0) AS session_completion
                FROM session_subjects ss
                LEFT JOIN learner_operation lo
                    ON lo.source_id = ss.subject_id
                    AND lo.operation IN (:sessionOperation)
                    AND lo.user_id = :userId
                    AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
            ),
            latest_slide AS (
                SELECT
                    s.id AS slide_id,
                    s.title AS slide_title,
                    al.created_at
                FROM slide s
                JOIN chapter_to_slides cts ON cts.slide_id = s.id
                JOIN activity_log al ON al.slide_id = s.id
                WHERE cts.chapter_id = :chapterId
                  AND al.user_id = :userId
                  AND cts.status IN (:chapterToSlideStatusList)
                  AND s.status IN (:slideStatusList)
                ORDER BY al.created_at DESC
                LIMIT 1
            )
            SELECT
                COALESCE(cp.chapter_completion, 0) AS chapterCompletionPercentage,
                COALESCE(mp.module_completion, 0) AS moduleCompletionPercentage,
                COALESCE(sp.subject_completion, 0) AS subjectCompletionPercentage,
                COALESCE(spp.session_completion, 0) AS packageSessionCompletionPercentage,
                ls.slide_id AS lastWatchedSlideId,
                ls.slide_title AS lastWatchedSlideTitle,
                ls.created_at AS lastWatchedAt
            FROM chapter_progress cp
            FULL JOIN module_progress mp ON true
            FULL JOIN subject_progress sp ON true
            FULL JOIN session_progress spp ON true
            FULL JOIN latest_slide ls ON true
            """, nativeQuery = true)
    Optional<LearnerProgressProjection> getFullLearnerProgress(
            @Param("userId") String userId,
            @Param("chapterId") String chapterId,
            @Param("moduleId") String moduleId,
            @Param("subjectId") String subjectId,
            @Param("packageSessionId") String packageSessionId,
            @Param("learnerOperation") List<String> learnerOperation,
            @Param("moduleOperation") List<String> moduleOperation,
            @Param("subjectOperation") List<String> subjectOperation,
            @Param("sessionOperation") List<String> sessionOperation,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("subjectStatusList") List<String> subjectStatusList);

    /**
     * Find limited activity logs with only necessary fields for processing
     * Used by LLM analytics scheduler to optimize data fetching
     */
    @Query(value = "SELECT id, source_type AS sourceType, raw_json AS rawJson, processed_json AS processedJson, status, created_at AS createdAt FROM activity_log WHERE status IN (:statuses) ORDER BY created_at ASC LIMIT :limit", nativeQuery = true)
    List<ActivityLogProcessingProjection> findProcessingDataByStatusWithLimit(@Param("statuses") List<String> statuses,
            @Param("limit") int limit);

    /**
     * Count activity logs by status
     * Used by scheduler status endpoint to show queue size
     */
    long countByStatus(String status);

    /**
     * Find processed activity logs for a user within a date range (limit to last 5)
     * Used for student analysis report generation
     */
    @Query(value = "SELECT * FROM activity_log " +
            "WHERE user_id = :userId " +
            "AND status = 'processed' " +
            "AND created_at BETWEEN :startDate AND :endDate " +
            "ORDER BY created_at DESC " +
            "LIMIT 5", nativeQuery = true)
    List<ActivityLog> findProcessedLogsForAnalysis(
            @Param("userId") String userId,
            @Param("startDate") java.sql.Timestamp startDate,
            @Param("endDate") java.sql.Timestamp endDate);

    /**
     * Find processed activity logs by user_id and slide_id
     * Used by LLM analytics API to fetch processed data for specific slide
     */
    @Query("SELECT a FROM ActivityLog a WHERE a.userId = :userId AND a.slideId = :slideId AND a.status = 'processed' ORDER BY a.createdAt DESC")
    List<ActivityLog> findByUserIdAndSlideIdAndStatusProcessed(
            @Param("userId") String userId,
            @Param("slideId") String slideId);

    /**
     * Find processed activity logs by user_id and source_id
     * Used by LLM analytics API to fetch processed data for specific source
     */
    @Query("SELECT a FROM ActivityLog a WHERE a.userId = :userId AND a.sourceId = :sourceId AND a.status = 'processed' ORDER BY a.createdAt DESC")
    List<ActivityLog> findByUserIdAndSourceIdAndStatusProcessed(
            @Param("userId") String userId,
            @Param("sourceId") String sourceId);

    /**
     * Update processed JSON and status for an activity log
     * Used by LLM analytics processor to update processed data without loading full
     * entity
     */
    @Modifying
    @Transactional
    @Query("UPDATE ActivityLog a SET a.processedJson = :processedJson, a.status = :status WHERE a.id = :id")
    void updateProcessedData(@Param("id") String id, @Param("processedJson") String processedJson,
            @Param("status") String status);

}