package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_reports.dto.LearnerActivityDataProjection;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;

import java.sql.Date;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, String> {
    @Query(value = """ 
            SELECT 
                (EXTRACT(EPOCH FROM (MAX(vt.end_time) - MIN(vt.start_time))) * 1000) / v.published_video_length * 100 AS percentage_watched
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
                v.id, a.user_id, a.slide_id, published_video_length
            """,
            nativeQuery = true)
    Double getPercentageVideoWatched(@Param("slideId") String slideId, @Param("userId") String userId);


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
            LEFT JOIN 
                learner_operation lo 
            ON 
                lo.source_id = cs.slide_id
                AND lo.operation IN (:learnerOperation)
                AND lo.user_id = :userId
            WHERE 
                cs.status = 'PUBLISHED'
                AND cs.chapter_id = :chapterId
            """,
            nativeQuery = true)
    Double getChapterCompletionPercentage(
            @Param("userId") String userId,
            @Param("chapterId") String chapterId,
            @Param("learnerOperation") List<String> learnerOperation
    );

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
        WITH video_progress AS (
            SELECT 
                s.id AS slide_id,
                LEAST(
                    COALESCE(
                        (SUM(EXTRACT(EPOCH FROM (vt.end_time - vt.start_time))) * 1000 
                        / NULLIF(COALESCE(v.published_video_length, 1), 0)) * 100, 
                    0), 
                100) AS video_completion
            FROM slide s
            LEFT JOIN video v ON s.source_id = v.id AND s.source_type = 'VIDEO'
            LEFT JOIN activity_log al ON al.slide_id = s.id
            LEFT JOIN video_tracked vt ON vt.activity_id = al.id
            WHERE 
                al.created_at BETWEEN :startDate AND :endDate
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
            LEFT JOIN document_slide ds ON s.source_id = ds.id AND s.source_type IN ('DOCUMENT', 'PDF')
            LEFT JOIN activity_log al ON al.slide_id = s.id
            LEFT JOIN document_tracked dt ON dt.activity_id = al.id
            WHERE 
                al.created_at BETWEEN :startDate AND :endDate
            GROUP BY s.id, ds.published_document_total_pages
        ),
        slide_completion AS (
            SELECT DISTINCT ON (s.id) 
                s.id AS slide_id,
                COALESCE(
                    CASE 
                        WHEN vp.video_completion IS NOT NULL AND dp.document_completion IS NOT NULL 
                            THEN (vp.video_completion + dp.document_completion) / 2
                        WHEN vp.video_completion IS NOT NULL THEN vp.video_completion
                        WHEN dp.document_completion IS NOT NULL THEN dp.document_completion
                        ELSE 0
                    END, 0) AS slide_completion_percentage
            FROM 
                subject_session sps
            JOIN subject_module_mapping smm ON smm.subject_id = sps.subject_id
            JOIN subject sub ON sub.id = smm.subject_id
            JOIN modules m ON m.id = smm.module_id
            JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
            JOIN chapter c ON c.id = mcm.chapter_id
            JOIN chapter_to_slides cs ON cs.chapter_id = c.id
            JOIN slide s ON s.id = cs.slide_id
            LEFT JOIN video_progress vp ON vp.slide_id = s.id
            LEFT JOIN document_progress dp ON dp.slide_id = s.id
            WHERE 
                sps.session_id = :sessionId
                AND sub.status IN :subjectStatusList
                AND m.status IN :moduleStatusList
                AND c.status IN :chapterStatusList
                AND cs.status IN :slideStatusList
                AND s.status IN :slideStatusList
        )
        SELECT AVG(slide_completion_percentage) 
        FROM slide_completion;
        """, nativeQuery = true)
    Double getBatchCourseCompletionPercentage(
            @Param("sessionId") String sessionId,
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList
    );


    @Query(value = """ 
    WITH activity_duration AS (
        SELECT 
            al.user_id,
            COALESCE(SUM(EXTRACT(EPOCH FROM (al.end_time - al.start_time))) / 60, 0) AS total_time_spent_minutes
        FROM activity_log al
        WHERE al.created_at BETWEEN :startDate AND :endDate
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
    FROM batch_time_spent;
""", nativeQuery = true)
    Double findAverageTimeSpentByBatch(
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList
    );

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
            @Param("statusList") List<String> statusList
    );

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
    GROUP BY s.id, s.full_name, s.email
""", countQuery = """
    SELECT COUNT(s.id)
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
""", nativeQuery = true)
    Page<LearnerActivityDataProjection> getBatchActivityDataWithRankPaginated(
            @Param("startTime") Date startTime,
            @Param("endTime") Date endTime,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList,
            Pageable pageable
    );



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
        COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) / 60, 0)
    FROM date_series ds
    LEFT JOIN student_session_institute_group_mapping ssig 
        ON ssig.package_session_id = :packageSessionId
        AND ssig.status IN (:statusList)
    LEFT JOIN activity_log a 
        ON ssig.user_id = a.user_id 
        AND DATE(a.start_time) = ds.activity_date
    GROUP BY ds.activity_date
    ORDER BY ds.activity_date
""", nativeQuery = true)
    List<Object[]> getBatchAvgDailyTimeSpent(
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList
    );


}