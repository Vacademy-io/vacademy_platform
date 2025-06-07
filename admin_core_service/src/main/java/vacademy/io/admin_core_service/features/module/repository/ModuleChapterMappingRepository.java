package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDetailsProjection;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;

import java.util.List;

public interface ModuleChapterMappingRepository extends JpaRepository<ModuleChapterMapping, String> {
    @Query("SELECT mcm.chapter FROM ModuleChapterMapping mcm " +
            "WHERE mcm.module.id = :moduleId " +
            "AND mcm.chapter.status != 'DELETED' " +
            "AND NOT EXISTS (SELECT 1 FROM ChapterPackageSessionMapping cpsm " +
            "                WHERE cpsm.chapter.id = mcm.chapter.id " +
            "                AND cpsm.status = 'DELETED' " +
            "                AND cpsm.packageSession.id = :packageSessionId)")
    List<Chapter> findChaptersByModuleIdAndStatusNotDeleted(String moduleId, String packageSessionId);

    @Query(value = """
    SELECT json_agg(module_data) AS module_array
    FROM (
        SELECT json_build_object(
            'module', json_build_object(
                'id', m.id,
                'module_name', m.module_name,
                'description', m.description
            ),
            'percentage_completed', COALESCE(AVG(chap_data.percentage_completed), 0.0),
            'chapters', COALESCE(json_agg(
                DISTINCT jsonb_build_object(
                    'id', c.id,
                    'chapter_name', c.chapter_name,
                    'status', c.status,
                    'file_id', c.file_id,
                    'description', c.description,
                    'percentage_completed', chap_data.percentage_completed,
                    'last_slide_viewed', chap_data.last_slide_viewed,
                    'video_count', chap_data.video_count,
                    'pdf_count', chap_data.pdf_count,
                    'doc_count', chap_data.doc_count,
                    'question_slide_count', chap_data.question_slide_count,
                    'assignment_slide_count', chap_data.assignment_slide_count,
                    'survey_slide_count', chap_data.survey_slide_count,
                    'unknown_count', chap_data.unknown_count
                )
            ) FILTER (WHERE c.id IS NOT NULL), CAST('[]' AS json))
        ) AS module_data
        FROM subject_module_mapping smm
        JOIN modules m ON smm.module_id = m.id AND m.status IN (:moduleStatusList)
        LEFT JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
        LEFT JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN (:chapterStatusList)
        LEFT JOIN chapter_package_session_mapping cpsm 
            ON cpsm.chapter_id = c.id 
            AND cpsm.status != 'DELETED' 
            AND cpsm.package_session_id = :packageSessionId
        LEFT JOIN (
            SELECT 
                c.id AS chapter_id,
                MAX(CASE 
                    WHEN lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED' AND lo.value ~ '^[0-9]+(\\.[0-9]+)?$' 
                    THEN CAST(lo.value AS FLOAT) 
                    ELSE 0.0 
                END) AS percentage_completed,
                MAX(CASE WHEN lo.operation = 'LAST_SLIDE_VIEWED' THEN lo.value END) AS last_slide_viewed,
                COUNT(DISTINCT CASE WHEN s.source_type = 'VIDEO' THEN s.id END) AS video_count,
                COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'PDF' THEN s.id END) AS pdf_count,
                COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'DOC' THEN s.id END) AS doc_count,
                COUNT(DISTINCT CASE WHEN s.source_type = 'QUESTION' THEN s.id END) AS question_slide_count,
                COUNT(DISTINCT CASE WHEN s.source_type = 'ASSIGNMENT' THEN s.id END) AS assignment_slide_count,
                COUNT(DISTINCT CASE WHEN s.source_type = 'SURVEY' THEN s.id END) AS survey_slide_count,
                COUNT(DISTINCT CASE 
                    WHEN s.source_type NOT IN ('VIDEO', 'DOCUMENT', 'QUESTION', 'ASSIGNMENT', 'SURVEY') 
                         OR s.source_type IS NULL THEN s.id 
                END) AS unknown_count
            FROM chapter c
            LEFT JOIN chapter_to_slides cs ON cs.chapter_id = c.id AND cs.status IN (:chapterToSlideStatusList)
            LEFT JOIN slide s ON cs.slide_id = s.id AND s.status IN (:slideStatusList)
            LEFT JOIN document_slide d ON d.id = s.source_id
            LEFT JOIN learner_operation lo 
                ON lo.source_id = c.id AND lo.source = 'CHAPTER'
                AND lo.operation IN ('PERCENTAGE_CHAPTER_COMPLETED', 'LAST_SLIDE_VIEWED')
                AND lo.user_id = :userId
            GROUP BY c.id
        ) AS chap_data ON chap_data.chapter_id = c.id
        WHERE smm.subject_id = :subjectId
        GROUP BY m.id, m.module_name, m.description
    ) AS module_data
    """, nativeQuery = true)
    String getModuleChapterProgress(
            @Param("subjectId") String subjectId,
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList
    );

    boolean existsByChapterIdAndModuleId(String chapterId, String moduleId);
}
