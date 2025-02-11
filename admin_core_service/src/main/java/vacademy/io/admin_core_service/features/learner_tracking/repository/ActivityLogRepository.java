package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;

import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog,String> {
    @Query(value = """ 
    SELECT 
        (EXTRACT(EPOCH FROM (MAX(vt.end_time) - MIN(vt.start_time))) * 1000) / v.video_length * 100 AS percentage_watched
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
        v.id, a.user_id, a.slide_id, v.video_length
    """,
            nativeQuery = true)
    Double getPercentageVideoWatched(@Param("slideId") String slideId, @Param("userId") String userId);


    @Query(value = """
    SELECT 
        COALESCE((COUNT(DISTINCT dt.page_number) * 100.0 / MAX(ds.total_pages)), 0) AS percentage_watched
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


}