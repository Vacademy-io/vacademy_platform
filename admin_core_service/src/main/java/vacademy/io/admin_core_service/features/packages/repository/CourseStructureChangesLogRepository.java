package vacademy.io.admin_core_service.features.packages.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.security.core.parameters.P;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.entity.CourseStructureChangesLog;

import java.util.List;
import java.util.Optional;

public interface CourseStructureChangesLogRepository extends JpaRepository<CourseStructureChangesLog, String> {
    Optional<CourseStructureChangesLog> findByUserIdAndSourceIdAndSourceTypeAndStatusIn(
        String userId, String sourceId, String sourceType, List<String> statusList
    );

    List<CourseStructureChangesLog> findBySourceTypeAndParentIdAndStatusIn(
        String sourceType,
        String parentId,
        List<String> statuses
    );

    @Query(value = """
    SELECT DISTINCT ON (p_log.source_id, l.id)
        p_log.source_id AS id,
        CAST(p_log.json_data AS jsonb)->>'packageName' AS packageName,
        CAST(p_log.json_data AS jsonb)->>'thumbnailFileId' AS thumbnailFileId,
        CAST(CAST(p_log.json_data AS jsonb)->>'isCoursePublishedToCatalaouge' AS BOOLEAN) AS isCoursePublishedToCatalaouge,
        CAST(p_log.json_data AS jsonb)->>'coursePreviewImageMediaId' AS coursePreviewImageMediaId,
        CAST(p_log.json_data AS jsonb)->>'courseBannerMediaId' AS courseBannerMediaId,
        CAST(p_log.json_data AS jsonb)->>'courseMediaId' AS courseMediaId,
        CAST(p_log.json_data AS jsonb)->>'whyLearnHtml' AS whyLearnHtml,
        CAST(p_log.json_data AS jsonb)->>'whoShouldLearnHtml' AS whoShouldLearnHtml,
        CAST(p_log.json_data AS jsonb)->>'aboutTheCourseHtml' AS aboutTheCourseHtml,
        CAST(p_log.json_data AS jsonb)->>'commaSeparatedTags' AS commaSeparatedTags,
        CAST(CAST(p_log.json_data AS jsonb)->>'courseDepth' AS INTEGER) AS courseDepth,
        CAST(p_log.json_data AS jsonb)->>'courseHtmlDescriptionHtml' AS courseHtmlDescriptionHtml,
        l.id AS levelId,
        l.level_name AS levelName,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p_log.user_id), NULL) AS instructors
    FROM course_structure_changes_log p_log
    JOIN package_session ps ON ps.package_id = p_log.source_id
    JOIN level l ON l.id = ps.level_id
    WHERE p_log.source_type = 'PACKAGE'
      AND (:instituteId IS NULL OR p_log.parent_id = :instituteId)
      AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR l.id IN (:levelIds))
      AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
      AND (
          :#{#tags == null || #tags.isEmpty()} = true OR
          EXISTS (
              SELECT 1 FROM unnest(string_to_array(CAST(p_log.json_data AS jsonb)->>'commaSeparatedTags', ',')) AS tag
              WHERE tag ILIKE ANY (array[:tags])
          )
      )
      AND (:#{#userIds == null || #userIds.isEmpty()} = true OR p_log.user_id IN (:userIds))
      AND (:#{#logStatuses == null || #logStatuses.isEmpty()} = true OR p_log.status IN (:logStatuses))
      AND EXISTS (
          SELECT 1 FROM package_session ps2
          WHERE ps2.package_id = p_log.source_id
          AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps2.status IN (:packageSessionStatus))
      )
    GROUP BY
        p_log.source_id,
        p_log.json_data,
        ps.id,
        ps.status,
        l.id,
        l.level_name,
        l.status
    """,
        countQuery = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT p_log.source_id, l.id
            FROM course_structure_changes_log p_log
            JOIN package_session ps ON ps.package_id = p_log.source_id
            JOIN level l ON l.id = ps.level_id
            WHERE p_log.source_type = 'PACKAGE'
              AND (:instituteId IS NULL OR p_log.parent_id = :instituteId)
              AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR l.id IN (:levelIds))
              AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
              AND (
                  :#{#tags == null || #tags.isEmpty()} = true OR
                  EXISTS (
                      SELECT 1 FROM unnest(string_to_array(CAST(p_log.json_data AS jsonb)->>'commaSeparatedTags', ',')) AS tag
                      WHERE tag ILIKE ANY (array[:tags])
                  )
              )
              AND (:#{#userIds == null || #userIds.isEmpty()} = true OR p_log.user_id IN (:userIds))
              AND (:#{#logStatuses == null || #logStatuses.isEmpty()} = true OR p_log.status IN (:logStatuses))
              AND EXISTS (
                  SELECT 1 FROM package_session ps2
                  WHERE ps2.package_id = p_log.source_id
                  AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps2.status IN (:packageSessionStatus))
              )
        ) sub
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getCourseRequestCatalogDetail(
        @Param("instituteId") String instituteId,
        @Param("levelIds") List<String> levelIds,
        @Param("tags") List<String> tags,
        @Param("userIds") List<String> userIds,
        @Param("logStatuses") List<String> logStatuses,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("levelStatus") List<String> levelStatus,
        Pageable pageable
    );

    @Query(value = """
    SELECT
        p_log.source_id AS id,
        CAST(p_log.json_data AS jsonb)->>'packageName' AS packageName,
        CAST(p_log.json_data AS jsonb)->>'thumbnailFileId' AS thumbnailFileId,
        CAST(CAST(p_log.json_data AS jsonb)->>'isCoursePublishedToCatalaouge' AS BOOLEAN) AS isCoursePublishedToCatalaouge,
        CAST(p_log.json_data AS jsonb)->>'coursePreviewImageMediaId' AS coursePreviewImageMediaId,
        CAST(p_log.json_data AS jsonb)->>'courseBannerMediaId' AS courseBannerMediaId,
        CAST(p_log.json_data AS jsonb)->>'courseMediaId' AS courseMediaId,
        CAST(p_log.json_data AS jsonb)->>'whyLearnHtml' AS whyLearnHtml,
        CAST(p_log.json_data AS jsonb)->>'whoShouldLearnHtml' AS whoShouldLearnHtml,
        CAST(p_log.json_data AS jsonb)->>'aboutTheCourseHtml' AS aboutTheCourseHtml,
        CAST(p_log.json_data AS jsonb)->>'commaSeparatedTags' AS commaSeparatedTags,
        CAST(CAST(p_log.json_data AS jsonb)->>'courseDepth' AS INTEGER) AS courseDepth,
        CAST(p_log.json_data AS jsonb)->>'courseHtmlDescriptionHtml' AS courseHtmlDescriptionHtml,
        CAST(CAST(p_log.json_data AS jsonb)->>'percentageCompleted' AS FLOAT) AS percentageCompleted,
        CAST(CAST(p_log.json_data AS jsonb)->>'rating' AS FLOAT) AS rating,
        ps.id AS packageSessionId,
        ps.status AS packageSessionStatus,
        l.id AS levelId,
        l.level_name AS levelName,
        l.status AS levelStatus,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p_log.user_id), NULL) AS instructors
    FROM course_structure_changes_log p_log
    JOIN package_session ps ON ps.package_id = p_log.source_id
    JOIN level l ON l.id = ps.level_id
    WHERE p_log.source_type = 'PACKAGE'
      AND (:instituteId IS NULL OR p_log.parent_id = :instituteId)
      AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
      AND (:#{#userIds == null || #userIds.isEmpty()} = true OR p_log.user_id IN (:userIds))
      AND (:#{#logStatuses == null || #logStatuses.isEmpty()} = true OR p_log.status IN (:logStatuses))
      AND EXISTS (
          SELECT 1 FROM package_session ps2
          WHERE ps2.package_id = p_log.source_id
          AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps2.status IN (:packageSessionStatus))
      )
      AND (
          :name IS NULL OR
          LOWER(CAST(p_log.json_data AS jsonb)->>'packageName') LIKE LOWER(CONCAT('%', :name, '%'))
      )
    GROUP BY
        p_log.source_id,
        p_log.json_data,
        ps.id,
        ps.status,
        l.id,
        l.level_name,
        l.status
    """,
        countQuery = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT p_log.source_id, l.id
            FROM course_structure_changes_log p_log
            JOIN package_session ps ON ps.package_id = p_log.source_id
            JOIN level l ON l.id = ps.level_id
            WHERE p_log.source_type = 'PACKAGE'
              AND (:instituteId IS NULL OR p_log.parent_id = :instituteId)
              AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
              AND (:#{#userIds == null || #userIds.isEmpty()} = true OR p_log.user_id IN (:userIds))
              AND (:#{#logStatuses == null || #logStatuses.isEmpty()} = true OR p_log.status IN (:logStatuses))
              AND EXISTS (
                  SELECT 1 FROM package_session ps2
                  WHERE ps2.package_id = p_log.source_id
                  AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps2.status IN (:packageSessionStatus))
              )
              AND (
                  :name IS NULL OR
                  LOWER(CAST(p_log.json_data AS jsonb)->>'packageName') LIKE LOWER(CONCAT('%', :name, '%'))
              )
        ) sub
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getCatalogSearch(
        @Param("name") String name,
        @Param("userIds") List<String> userIds,
        @Param("instituteId") String instituteId,
        @Param("logStatuses") List<String> logStatuses,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("levelStatus") List<String> levelStatus,
        Pageable pageable
    );

}
