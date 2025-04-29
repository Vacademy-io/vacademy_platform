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
                SELECT 
                    c.id AS id,
                    c.chapter_name AS chapterName,
                    c.status AS status,
                    c.file_id AS fileId,
                    c.description AS description,
                    MAX(CASE 
                        WHEN lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED' AND lo.value ~ '^[0-9]+(.[0-9]+)?$' 
                        THEN CAST(lo.value AS FLOAT) 
                        ELSE 0.0 
                    END) AS percentageCompleted,
                    MAX(CASE WHEN lo.operation = 'LAST_SLIDE_VIEWED' THEN lo.value END) AS lastSlideViewed,
                    COALESCE(COUNT(DISTINCT CASE WHEN s.source_type = 'VIDEO' THEN s.id END), 0) AS videoCount,
                    COALESCE(COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'PDF' THEN s.id END), 0) AS pdfCount,
                    COALESCE(COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'DOC' THEN s.id END), 0) AS docCount,
                    COALESCE(COUNT(DISTINCT CASE WHEN s.source_type NOT IN ('VIDEO', 'DOCUMENT') THEN s.id END), 0) AS unknownCount
                FROM chapter c
                INNER JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
                INNER JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id AND cpsm.status != 'DELETED'
                LEFT JOIN chapter_to_slides cs ON cs.chapter_id = c.id AND cs.status != 'DELETED'
                LEFT JOIN slide s ON cs.slide_id = s.id AND s.status IN (:slideStatuses)
                LEFT JOIN document_slide d ON d.id = s.source_id
                LEFT JOIN learner_operation lo 
                    ON lo.source_id = c.id
                    AND lo.source = 'CHAPTER'
                    AND lo.operation IN ('PERCENTAGE_CHAPTER_COMPLETED', 'LAST_SLIDE_VIEWED')
                    AND lo.user_id = :userId
                WHERE c.status = 'ACTIVE'
                    AND mcm.module_id = :moduleId
                    AND cpsm.package_session_id = :packageSessionId
                GROUP BY c.id, c.chapter_name, c.status, c.file_id, c.description, cpsm.chapter_order
                ORDER BY cpsm.chapter_order ASC
            """, nativeQuery = true)
    List<ChapterDetailsProjection> getChapterDetails(
            @Param("moduleId") String moduleId,
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("slideStatuses") List<String> slideStatuses
    );

    boolean existsByChapterIdAndModuleId(String chapterId, String moduleId);
}
